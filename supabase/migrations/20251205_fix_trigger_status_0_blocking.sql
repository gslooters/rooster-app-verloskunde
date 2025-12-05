-- DRAAD106: SQL Trigger Fix - Status 0 Detectie voor Real-time Blokkering
-- 
-- Datum: 5 december 2025
-- Prioriteit: KRITIEK
--
-- PROBLEEM:
-- Huidige trigger vuurt alleen bij status=1 (handmatige planning)
-- ORT schrijft naar status=0, dus geen real-time blokkering tijdens solve!
--
-- OPLOSSING:
-- Detecteer service_id wijziging ongeacht status
-- Maak status 2 records direct (ook voor status 0)
-- Alleen status 0 slots mogen naar status 2 (bescherm status 1/3)
--
-- WORKFLOW:
-- 1. ORT plant DDA-dienst → status 0 + service_id = 'DDA'
-- 2. Trigger vuurt direct → maakt Ma O en Ma M status 2
-- 3. ORT ziet status 2 → kan niet meer plannen
-- 4. Bij finalize: status 0 → 1 (status 2 blijft staan)

-- Drop oude trigger
DROP TRIGGER IF EXISTS trg_roster_assignment_status_management ON roster_assignments;
DROP FUNCTION IF EXISTS fn_roster_assignment_status_management();

-- Nieuwe trigger functie met status 0 detectie
CREATE OR REPLACE FUNCTION fn_roster_assignment_status_management_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_service_code TEXT;
    v_dagdeel_type TEXT;
    v_blocked_dagdelen TEXT[];
    v_next_date DATE;
    v_blocked_dagdeel TEXT;
    v_existing_status INT;
BEGIN
    -- ===================================================================
    -- DEEL 1: SERVICE_ID GEWIJZIGD (INSERT OF UPDATE)
    -- ===================================================================
    
    IF NEW.service_id IS NOT NULL AND 
       (OLD IS NULL OR OLD.service_id IS DISTINCT FROM NEW.service_id) THEN
        
        -- Haal service code op
        SELECT code INTO v_service_code
        FROM service_types
        WHERE id = NEW.service_id;
        
        -- Bepaal welke dagdelen geblokkeerd moeten worden
        v_blocked_dagdelen := NULL;
        
        IF v_service_code IN ('DDA', 'DDA-BER') THEN
            -- DDA-dienst op zondag → Blokkeer Ma O + Ma M
            IF EXTRACT(DOW FROM NEW.date) = 0 AND NEW.dagdeel = 'A' THEN
                v_next_date := NEW.date + INTERVAL '1 day';
                v_blocked_dagdelen := ARRAY['O', 'M'];
            END IF;
        ELSIF v_service_code IN ('DDO', 'DDO-BER') THEN
            -- DDO-dienst op zaterdag → Blokkeer Zo O + Zo M
            IF EXTRACT(DOW FROM NEW.date) = 6 AND NEW.dagdeel = 'A' THEN
                v_next_date := NEW.date + INTERVAL '1 day';
                v_blocked_dagdelen := ARRAY['O', 'M'];
            END IF;
        ELSIF v_service_code IN ('DIO') THEN
            -- DIO-dienst → Blokkeer volgende dag O + M
            IF NEW.dagdeel = 'A' THEN
                v_next_date := NEW.date + INTERVAL '1 day';
                v_blocked_dagdelen := ARRAY['O', 'M'];
            END IF;
        ELSIF v_service_code IN ('DIA') THEN
            -- DIA-dienst → Blokkeer volgende dag O + M  
            IF NEW.dagdeel = 'A' THEN
                v_next_date := NEW.date + INTERVAL '1 day';
                v_blocked_dagdelen := ARRAY['O', 'M'];
            END IF;
        END IF;
        
        -- Maak status 2 records (als geblokkeerde dagdelen gevonden)
        IF v_blocked_dagdelen IS NOT NULL AND array_length(v_blocked_dagdelen, 1) > 0 THEN
            FOREACH v_blocked_dagdeel IN ARRAY v_blocked_dagdelen LOOP
                
                -- Check huidige status van deze slot
                SELECT status INTO v_existing_status
                FROM roster_assignments
                WHERE roster_id = NEW.roster_id
                  AND employee_id = NEW.employee_id
                  AND date = v_next_date
                  AND dagdeel = v_blocked_dagdeel;
                
                -- KRITIEK: Alleen status 0 mag naar status 2
                -- Status 1 (fixed) en status 3 (structureel NBH) NOOIT overschrijven!
                IF v_existing_status IS NULL OR v_existing_status = 0 THEN
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
                    ) VALUES (
                        NEW.roster_id,
                        NEW.employee_id,
                        v_next_date,
                        v_blocked_dagdeel,
                        2,  -- Status 2: geblokkeerd door dienst
                        NULL,  -- Geen service in geblokkeerd slot
                        NEW.date,  -- Referentie naar blokkerende dienst
                        NEW.dagdeel,
                        NEW.service_id
                    )
                    ON CONFLICT (roster_id, employee_id, date, dagdeel) 
                    DO UPDATE SET
                        status = 2,
                        service_id = NULL,
                        blocked_by_date = EXCLUDED.blocked_by_date,
                        blocked_by_dagdeel = EXCLUDED.blocked_by_dagdeel,
                        blocked_by_service_id = EXCLUDED.blocked_by_service_id,
                        updated_at = NOW()
                    WHERE roster_assignments.status = 0;  -- Alleen updaten als status 0
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    -- ===================================================================
    -- DEEL 2: SERVICE_ID VERWIJDERD (UPDATE naar NULL OF DELETE)
    -- ===================================================================
    
    IF (TG_OP = 'UPDATE' AND OLD.service_id IS NOT NULL AND NEW.service_id IS NULL) OR
       (TG_OP = 'DELETE' AND OLD.service_id IS NOT NULL) THEN
        
        -- Verwijder alle status 2 records die door deze dienst geblokkeerd zijn
        DELETE FROM roster_assignments
        WHERE roster_id = OLD.roster_id
          AND employee_id = OLD.employee_id
          AND status = 2
          AND blocked_by_date = OLD.date
          AND blocked_by_dagdeel = OLD.dagdeel
          AND blocked_by_service_id = OLD.service_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Maak nieuwe trigger (BEFORE voor INSERT en UPDATE, AFTER voor DELETE)
CREATE TRIGGER trg_roster_assignment_status_management_v2
BEFORE INSERT OR UPDATE ON roster_assignments
FOR EACH ROW
EXECUTE FUNCTION fn_roster_assignment_status_management_v2();

-- Trigger voor DELETE (moet AFTER zijn voor OLD values)
CREATE TRIGGER trg_roster_assignment_status_cleanup
AFTER DELETE ON roster_assignments
FOR EACH ROW
EXECUTE FUNCTION fn_roster_assignment_status_management_v2();

-- Commentaar voor documentatie
COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS 
'DRAAD106: Real-time blokkering tijdens ORT proces.
Vuurt bij service_id wijziging ongeacht status.
Maakt status 2 records direct (ook voor status 0).
Beschermt status 1 (fixed) en status 3 (structureel NBH).';
