-- =====================================================
-- DRAAD 99A: TRIGGER FUNCTION VOOR AUTOMATISCHE BLOKKERING
-- =====================================================
-- Datum: 3 dec 2025
-- Update: 13 dec 2025 (DRAAD 167: enddate check toegevoegd)
-- Doel: Automatisch blokkeren van dagdelen bij INSERT/UPDATE/DELETE van diensten
--
-- Blokkeerlogica:
-- - DIO (dagdienst O): blokkeert M van zelfde dag
-- - DDO (dagdienst O): blokkeert M van zelfde dag  
-- - DIA (nachtdienst A): blokkeert O+M van volgende dag
-- - DDA (nachtdienst A): blokkeert O+M van volgende dag
--
-- KRITIEK: Status 3 (structureel NB) mag NOOIT worden overschreven!
-- KRITIEK: Datums >= rooster.enddate worden geblokkeerd (grensvalidatie)
-- =====================================================

-- Drop trigger en functie als ze al bestaan (voor herhaalde uitvoering)
DROP TRIGGER IF EXISTS trg_roster_assignment_auto_blocking ON roster_assignments;
DROP FUNCTION IF EXISTS trg_roster_assignment_status_management();

-- =====================================================
-- TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION trg_roster_assignment_status_management()
RETURNS TRIGGER AS $$
DECLARE
    v_blocked_rec RECORD;
    v_service_code TEXT;
    v_roster_enddate DATE;
BEGIN
    -- ===================================================
    -- SCENARIO 1: INSERT - Nieuwe dienst ingepland
    -- ===================================================
    IF (TG_OP = 'INSERT') THEN
        -- Alleen acteren als status van 0 naar 1 gaat (inplanning)
        IF NEW.status = 1 AND NEW.service_id IS NOT NULL THEN
            
            -- GRENSVALIDATIE: Haal rooster enddate op
            SELECT enddate INTO v_roster_enddate 
            FROM roosters 
            WHERE id = NEW.roster_id;
            
            -- Blokkeer als datum op of na rooster.enddate is
            IF NEW.date >= v_roster_enddate THEN
                RETURN NEW;
            END IF;
            
            -- Haal alle te blokkeren dagdelen op via de functie uit vorige sessie
            FOR v_blocked_rec IN 
                SELECT block_date, block_dagdeel 
                FROM get_blocked_dagdelen_info(
                    NEW.service_id,
                    NEW.dagdeel,
                    NEW.date
                )
            LOOP
                -- UPSERT: Insert or Update de blokkering
                -- KRITIEK: Alleen status 0 mag naar 2, status 3 NOOIT overschrijven!
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
                    NULL, -- Geen service_id bij blokkering
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
                -- Status 3 wordt hierdoor NOOIT overschreven
                
            END LOOP;
        END IF;
        
        RETURN NEW;
    END IF;

    -- ===================================================
    -- SCENARIO 2: UPDATE - Dienst gewijzigd
    -- ===================================================
    IF (TG_OP = 'UPDATE') THEN
        
        -- Check of de service_id is gewijzigd
        IF (OLD.service_id IS DISTINCT FROM NEW.service_id) THEN
            
            -- GRENSVALIDATIE: Haal rooster enddate op
            SELECT enddate INTO v_roster_enddate 
            FROM roosters 
            WHERE id = NEW.roster_id;
            
            -- STAP 1: Deblokkeer oude dienst (als die bestond)
            IF OLD.service_id IS NOT NULL AND OLD.status = 1 THEN
                -- Verwijder blokkades die door de OUDE dienst zijn veroorzaakt
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
            
            -- STAP 2: Blokkeer nieuwe dienst (als die bestaat en binnen periode is)
            IF NEW.service_id IS NOT NULL AND NEW.status = 1 AND NEW.date < v_roster_enddate THEN
                FOR v_blocked_rec IN 
                    SELECT block_date, block_dagdeel 
                    FROM get_blocked_dagdelen_info(
                        NEW.service_id,
                        NEW.dagdeel,
                        NEW.date
                    )
                LOOP
                    -- Zelfde UPSERT logica als bij INSERT
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
        
        -- Deblokkeer alle dagdelen die door deze dienst zijn geblokkeerd
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
     - Bij INSERT (status 0→1): Blokkeer benodigde dagdelen (status 0→2)
     - Bij UPDATE (dienst wijzigt): Deblokkeer oude dienst, blokkeer nieuwe dienst  
     - Bij DELETE: Deblokkeer alle geblokkeerde dagdelen
     - GRENSVALIDATIE: Datums >= rooster.enddate worden genegeerd
     - KRITIEK: Status 3 (structureel NB) wordt NOOIT automatisch overschreven!';

COMMENT ON TRIGGER trg_roster_assignment_auto_blocking ON roster_assignments IS
    'Automatische blokkering van dagdelen obv service_types.blokkeert_volgdag.
     Gebruikt get_blocked_dagdelen_info() functie voor blokkeerlogica.
     Geïmplementeerd: DRAAD 99A (3 dec 2025)
     Update: DRAAD 167 - roosterperiode grensvalidatie (13 dec 2025)';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ DRAAD 167: Trigger trg_roster_assignment_auto_blocking SUCCESVOL geupdate!';
    RAISE NOTICE '📋 Functie: trg_roster_assignment_status_management()';
    RAISE NOTICE '🔒 Blokkeerlogica actief voor: DIO, DDO, DIA, DDA';
    RAISE NOTICE '⚠️  Status 3 (structureel NB) wordt NOOIT overschreven';
    RAISE NOTICE '📅 GRENSVALIDATIE: Datums >= rooster.enddate worden genegeerd';
    RAISE NOTICE '🛡️  Voorkomt duplicate records op roosterperiode-grens';
END $$;
