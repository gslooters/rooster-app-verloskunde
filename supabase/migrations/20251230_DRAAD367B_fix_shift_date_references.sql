-- =====================================================================
-- DRAAD367B - HOTFIX: Fix shift_date/shift_period references
-- =====================================================================
-- 
-- ISSUE: Trigger update_roster_assignment_invulling() used incorrect
--        field names: shift_date and shift_period instead of date and dagdeel
--
-- IMPACT: INSERT/UPDATE/DELETE on roster_assignments triggered errors:
--         "record new has no field shift_date"
--
-- FIX: Replace ALL references in trigger function:
--   OLD: NEW.shift_date → NEW: NEW.date
--   OLD: NEW.shift_period → NEW: NEW.dagdeel
--   OLD: OLD.shift_date → NEW: OLD.date
--   OLD: OLD.shift_period → NEW: OLD.dagdeel
--
-- BASELINE VERIFIED: Columns exist in roster_assignments:
--   ✓ date (date type, position 4)
--   ✓ dagdeel (text type, position 5)
--
-- TARGET TABLE: roster_period_staffing_dagdelen
--   - Columns: date, dagdeel, roster_id, service_id, team, invulling
--
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_roster_assignment_invulling()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_old_record RECORD;
    v_new_record RECORD;
    v_affected_rows INTEGER;
    v_old_count INTEGER;
    v_new_count INTEGER;
BEGIN
    -- =========== INSERT OPERATIE ===========
    IF TG_OP = 'INSERT' THEN
        BEGIN
            -- Voeg invulling toe
            UPDATE roster_period_staffing_dagdelen
            SET invulling = invulling + 1,
                updated_at = NOW()
            WHERE roster_id = NEW.roster_id
              AND date = NEW.date
              AND dagdeel = NEW.dagdeel
              AND team = NEW.team
              AND service_id = NEW.service_id;
            
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
            
            IF v_affected_rows = 0 THEN
                -- ⚠️ KRITISCH: Record zou ALTIJD moeten bestaan
                -- Maar we log het en geven geen error (soft fail)
                RAISE WARNING '[DRAAD367B] INSERT trigger: Record niet gevonden. rosterId=%, date=%, dagdeel=%, team=%, service_id=%',
                    NEW.roster_id, NEW.date, NEW.dagdeel, NEW.team, NEW.service_id;
            ELSE
                RAISE NOTICE '[DRAAD367B] INSERT: invulling++ voor % | % | % | % (service: %)',
                    NEW.date, NEW.dagdeel, NEW.team, NEW.employee_id, NEW.service_id;
            END IF;
            
            RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[DRAAD367B] INSERT error: %', SQLERRM;
            -- Laat error door (transactie rollback)
            RAISE;
        END;
    
    -- =========== DELETE OPERATIE ===========
    ELSIF TG_OP = 'DELETE' THEN
        BEGIN
            -- Verlaag invulling
            UPDATE roster_period_staffing_dagdelen
            SET invulling = GREATEST(invulling - 1, 0),  -- Nooit negatief
                updated_at = NOW()
            WHERE roster_id = OLD.roster_id
              AND date = OLD.date
              AND dagdeel = OLD.dagdeel
              AND team = OLD.team
              AND service_id = OLD.service_id;
            
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
            
            IF v_affected_rows = 0 THEN
                RAISE WARNING '[DRAAD367B] DELETE trigger: Record niet gevonden. rosterId=%, date=%, dagdeel=%, team=%, service_id=%',
                    OLD.roster_id, OLD.date, OLD.dagdeel, OLD.team, OLD.service_id;
            ELSE
                RAISE NOTICE '[DRAAD367B] DELETE: invulling-- voor % | % | % | % (service: %)',
                    OLD.date, OLD.dagdeel, OLD.team, OLD.employee_id, OLD.service_id;
            END IF;
            
            RETURN OLD;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[DRAAD367B] DELETE error: %', SQLERRM;
            RAISE;
        END;
    
    -- =========== UPDATE OPERATIE ===========
    ELSIF TG_OP = 'UPDATE' THEN
        BEGIN
            -- Check OF waarden echt changed
            IF (NEW.date, NEW.dagdeel, NEW.team, NEW.service_id) 
               IS DISTINCT FROM 
               (OLD.date, OLD.dagdeel, OLD.team, OLD.service_id) THEN
                
                -- Oude entry: invulling--
                UPDATE roster_period_staffing_dagdelen
                SET invulling = GREATEST(invulling - 1, 0),
                    updated_at = NOW()
                WHERE roster_id = OLD.roster_id
                  AND date = OLD.date
                  AND dagdeel = OLD.dagdeel
                  AND team = OLD.team
                  AND service_id = OLD.service_id;
                
                GET DIAGNOSTICS v_old_count = ROW_COUNT;
                
                -- Nieuwe entry: invulling++
                UPDATE roster_period_staffing_dagdelen
                SET invulling = invulling + 1,
                    updated_at = NOW()
                WHERE roster_id = NEW.roster_id
                  AND date = NEW.date
                  AND dagdeel = NEW.dagdeel
                  AND team = NEW.team
                  AND service_id = NEW.service_id;
                
                GET DIAGNOSTICS v_new_count = ROW_COUNT;
                
                RAISE NOTICE '[DRAAD367B] UPDATE: old invulling-- (%), new invulling++ (%) | % → %',
                    v_old_count, v_new_count, 
                    CONCAT(OLD.date, '|', OLD.dagdeel, '|', OLD.team, '|', OLD.service_id),
                    CONCAT(NEW.date, '|', NEW.dagdeel, '|', NEW.team, '|', NEW.service_id);
            ELSE
                RAISE NOTICE '[DRAAD367B] UPDATE: geen relevante velden gewijzigd (skip)';
            END IF;
            
            RETURN NEW;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[DRAAD367B] UPDATE error: %', SQLERRM;
            RAISE;
        END;
    
    END IF;
    
    RETURN NULL;  -- Trigger functie mag NULL returnen
    
END;
$function$;

-- =====================================================================
-- VERIFICATIE
-- =====================================================================
-- Trigger remains attached to roster_assignments table via:
--   trg_update_roster_assignment_invulling AFTER INSERT OR DELETE OR UPDATE
--
-- No trigger recreation needed - DROP & CREATE would risk data loss
-- Function replacement is sufficient and safe
-- =====================================================================
