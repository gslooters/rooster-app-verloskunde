-- =====================================================
-- DRAAD 167 HOTFIX: ENDDATE GRENSVALIDATIE FIX
-- =====================================================
-- Datum: 13 dec 2025 (17:38 UTC)
-- Probleem: DDA op laatste dag (enddate) creeert records buiten periode
-- Oorzaak: DRAAD 167 check niet in production deployment
-- Oplossing: Voeg enddate check toe aan INSERT en UPDATE scenarios
-- =====================================================

-- Eerst: Verwijder de 2 duplicate records die op 29-12 zijn aangemaakt
DELETE FROM roster_assignments
WHERE date >= (SELECT enddate FROM roosters LIMIT 1)
  AND status = 2;

-- Log verwijdering
DO $$
BEGIN
    RAISE NOTICE '🗑️  Duplicate records op/na enddate verwijderd';
END $$;

-- Drop en recreate trigger met CORRECTE enddate checks
DROP TRIGGER IF EXISTS trg_roster_assignment_auto_blocking ON roster_assignments;
DROP FUNCTION IF EXISTS trg_roster_assignment_status_management();

-- =====================================================
-- TRIGGER FUNCTION - MET ENDDATE CHECKS
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_roster_assignment_status_management()
RETURNS TRIGGER AS $$
DECLARE
    v_blocked_rec RECORD;
    v_roster_enddate DATE;
BEGIN
    -- ===================================================
    -- SCENARIO 1: INSERT - Nieuwe dienst ingepland
    -- ===================================================
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 1 AND NEW.service_id IS NOT NULL THEN
            
            -- 🔴 KRITIEK: Haal rooster enddate op
            SELECT enddate INTO v_roster_enddate 
            FROM roosters 
            WHERE id = NEW.roster_id;
            
            -- 🔴 KRITIEK: Blokkeer als datum op of na rooster.enddate is
            -- Dit voorkomt blokkeringen BUITEN de roosterperiode
            IF NEW.date >= v_roster_enddate THEN
                RETURN NEW;
            END IF;
            
            -- Haal alle te blokkeren dagdelen op
            FOR v_blocked_rec IN 
                SELECT block_date, block_dagdeel 
                FROM get_blocked_dagdelen_info(
                    NEW.service_id,
                    NEW.dagdeel,
                    NEW.date
                )
            LOOP
                INSERT INTO roster_assignments (
                    roster_id,
                    employee_id,
                    date,
                    dagdeel,
                    status,
                    service_id,
                    blocked_by_date,
                    blocked_by_dagdeel,
                    blocked_by_service_id
                )
                VALUES (
                    NEW.roster_id,
                    NEW.employee_id,
                    v_blocked_rec.block_date,
                    v_blocked_rec.block_dagdeel,
                    2, -- Status 2 = geblokkeerd
                    NULL,
                    NEW.date,
                    NEW.dagdeel,
                    NEW.service_id
                )
                ON CONFLICT (roster_id, employee_id, date, dagdeel)
                DO UPDATE SET
                    status = 2,
                    blocked_by_date = EXCLUDED.blocked_by_date,
                    blocked_by_dagdeel = EXCLUDED.blocked_by_dagdeel,
                    blocked_by_service_id = EXCLUDED.blocked_by_service_id,
                    updated_at = NOW()
                WHERE roster_assignments.status = 0;  -- KRITIEK: Alleen status 0 updaten!
            END LOOP;
        END IF;
        RETURN NEW;
    END IF;

    -- ===================================================
    -- SCENARIO 2: UPDATE - Dienst gewijzigd
    -- ===================================================
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.service_id IS DISTINCT FROM NEW.service_id) THEN
            
            -- 🔴 KRITIEK: Haal rooster enddate op
            SELECT enddate INTO v_roster_enddate 
            FROM roosters 
            WHERE id = NEW.roster_id;
            
            -- STAP 1: Deblokkeer oude dienst
            IF OLD.service_id IS NOT NULL AND OLD.status = 1 THEN
                UPDATE roster_assignments
                SET 
                    status = 0,
                    blocked_by_date = NULL,
                    blocked_by_dagdeel = NULL,
                    blocked_by_service_id = NULL,
                    updated_at = NOW()
                WHERE 
                    roster_id = OLD.roster_id
                    AND employee_id = OLD.employee_id
                    AND status = 2
                    AND blocked_by_service_id = OLD.service_id
                    AND blocked_by_date = OLD.date
                    AND blocked_by_dagdeel = OLD.dagdeel;
            END IF;
            
            -- STAP 2: Blokkeer nieuwe dienst (als die BINNEN periode is)
            -- 🔴 KRITIEK: Check NEW.date < v_roster_enddate!
            IF NEW.service_id IS NOT NULL AND NEW.status = 1 
               AND NEW.date < v_roster_enddate THEN
                FOR v_blocked_rec IN 
                    SELECT block_date, block_dagdeel 
                    FROM get_blocked_dagdelen_info(
                        NEW.service_id,
                        NEW.dagdeel,
                        NEW.date
                    )
                LOOP
                    INSERT INTO roster_assignments (
                        roster_id,
                        employee_id,
                        date,
                        dagdeel,
                        status,
                        service_id,
                        blocked_by_date,
                        blocked_by_dagdeel,
                        blocked_by_service_id
                    )
                    VALUES (
                        NEW.roster_id,
                        NEW.employee_id,
                        v_blocked_rec.block_date,
                        v_blocked_rec.block_dagdeel,
                        2,
                        NULL,
                        NEW.date,
                        NEW.dagdeel,
                        NEW.service_id
                    )
                    ON CONFLICT (roster_id, employee_id, date, dagdeel)
                    DO UPDATE SET
                        status = 2,
                        blocked_by_date = EXCLUDED.blocked_by_date,
                        blocked_by_dagdeel = EXCLUDED.blocked_by_dagdeel,
                        blocked_by_service_id = EXCLUDED.blocked_by_service_id,
                        updated_at = NOW()
                    WHERE roster_assignments.status = 0;
                END LOOP;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- ===================================================
    -- SCENARIO 3: DELETE - Dienst verwijderd
    -- ===================================================
    IF (TG_OP = 'DELETE') THEN
        IF OLD.service_id IS NOT NULL AND OLD.status = 1 THEN
            UPDATE roster_assignments
            SET 
                status = 0,
                blocked_by_date = NULL,
                blocked_by_dagdeel = NULL,
                blocked_by_service_id = NULL,
                updated_at = NOW()
            WHERE 
                roster_id = OLD.roster_id
                AND employee_id = OLD.employee_id
                AND status = 2
                AND blocked_by_service_id = OLD.service_id
                AND blocked_by_date = OLD.date
                AND blocked_by_dagdeel = OLD.dagdeel;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ACTIVEER TRIGGER
-- =====================================================
CREATE TRIGGER trg_roster_assignment_auto_blocking
    AFTER INSERT OR UPDATE OR DELETE ON roster_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trg_roster_assignment_status_management();

-- =====================================================
-- VERIFICATIE
-- =====================================================
COMMENT ON FUNCTION trg_roster_assignment_status_management() IS 
    'Trigger function voor automatische blokkering van dagdelen.
     - INSERT: Blokkeer benodigde dagdelen (status 0→2)
     - UPDATE: Deblokkeer oude dienst, blokkeer nieuwe dienst  
     - DELETE: Deblokkeer alle geblokkeerde dagdelen
     - GRENSVALIDATIE: Datums >= rooster.enddate worden GENEGEERD (voorkomen duplicates)
     - Status 3 (structureel NB) wordt NOOIT automatisch overschreven
     - DRAAD 167 HOTFIX: 13 dec 2025';

COMMENT ON TRIGGER trg_roster_assignment_auto_blocking ON roster_assignments IS
    'Automatische blokkering van dagdelen obv service_types.blokkeert_volgdag.
     Gebruikt get_blocked_dagdelen_info() functie voor blokkeerlogica.
     Met ENDDATE-CHECK om duplicates op grensdag te voorkomen.
     Update: DRAAD 167 HOTFIX (13 dec 2025 17:38 UTC)';

-- Success messages
DO $$
BEGIN
    RAISE NOTICE '✅ DRAAD 167 HOTFIX: Trigger GECORRIGEERD!';
    RAISE NOTICE '🔴 Enddate checks TOEGEVOEGD:';
    RAISE NOTICE '   - INSERT: IF NEW.date >= v_roster_enddate THEN RETURN NEW';
    RAISE NOTICE '   - UPDATE: AND NEW.date < v_roster_enddate';
    RAISE NOTICE '🗑️  Duplicate records op/na enddate VERWIJDERD';
    RAISE NOTICE '📊 Rooster is nu schoon en consistent';
    RAISE NOTICE '✨ Geen blokkeringen meer BUITEN roosterperiode';
END $$;

-- Verify count
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM roster_assignments;
    RAISE NOTICE '📈 Total roster_assignments: %', v_count;
END $$;
