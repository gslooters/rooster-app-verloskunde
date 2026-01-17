-- DRAAD416: FINAL FIX - Anti-Duplicate Trigger Protection
-- 
-- PROBLEEM (DRAAD415 + EVALUATIE):
-- - UI doet TWEE UPSERTs per assignment:
--   1) INSERT/UPSERT met status=1, variant_id=NULL
--   2) UPDATE met variant_id=xxx (zelfde assignment)
-- - Trigger vurst TWEE KEER → invulling +2 i.p.v. +1
-- - Conditie (NEW.status = 1 AND OLD.status != 1) werkt NIET bij UPDATE 1→1
-- - Resultaat: invulling=2 of invulling=3 voor aantal=1 diensten
--
-- ROOT CAUSE:
-- - UPSERT in preplanning-storage.ts triggert UPDATE zelfs als status unchanged
-- - Trigger heeft GEEN bescherming tegen duplicate updates
-- - Condition checkt alleen status change, niet variant_id change
--
-- OPLOSSING:
-- - Add EXTRA conditie: Check of variant_id CHANGED
-- - Bij INSERT: variant_id change (NULL → value) = OK
-- - Bij UPDATE: variant_id change maar status unchanged = SKIP
-- - Only increment/decrement als DAADWERKELIJKE status change (0→1 of 1→0)
--
-- LOGICA:
-- INCREMENT: NEW.status = 1 AND (OLD IS NULL OR OLD.status != 1)
-- DECREMENT: OLD.status = 1 AND NEW.status != 1
-- 
-- Deployment: Run dit script in Supabase SQL Editor
-- Datum: 2026-01-17
-- Versie: 0.1.13-draad416-anti-duplicate

-- =================================================================
-- STAP 1: Drop oude trigger en functie
-- =================================================================

DROP TRIGGER IF EXISTS on_roster_assignment_status_change ON roster_assignments;
DROP FUNCTION IF EXISTS update_invulling_on_assignment_change();

-- =================================================================
-- STAP 2: Nieuwe ANTI-DUPLICATE trigger function
-- =================================================================

CREATE OR REPLACE FUNCTION update_invulling_on_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
  target_variant_id UUID;
  employee_team TEXT;
BEGIN
  -- ========================================
  -- ANTI-DUPLICATE CHECK
  -- ========================================
  -- Check of dit een ECHTE status change is
  -- NIET triggeren bij:
  -- - UPDATE van status=1 naar status=1 (variant_id update)
  -- - UPDATE van andere velden zonder status change
  
  IF (OLD IS NOT NULL) THEN
    -- Dit is een UPDATE (niet INSERT)
    
    -- Check of status echt veranderd is
    IF NOT (OLD.status IS DISTINCT FROM NEW.status) THEN
      -- Status unchanged - SKIP trigger logic
      RAISE NOTICE '[DRAAD416] SKIP - Status unchanged (OLD=%/NEW=%) for assignment % - variant_id update only', 
        OLD.status, NEW.status, NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  -- ========================================
  -- INCREMENT INVULLING (status → 1)
  -- ========================================
  IF (NEW.status = 1 AND (OLD IS NULL OR OLD.status != 1)) THEN

    -- Get employee team from assignments table
    employee_team := NEW.team;

    -- Strategy A: Use explicit variant_id if provided
    IF (NEW.roster_period_staffing_dagdelen_id IS NOT NULL) THEN

      UPDATE roster_period_staffing_dagdelen
      SET 
        invulling = invulling + 1,
        updated_at = NOW()
      WHERE id = NEW.roster_period_staffing_dagdelen_id
        AND invulling < aantal;  -- Safety check

      IF FOUND THEN
        RAISE NOTICE '[DRAAD416] Invulling +1 via variant_id % for assignment %', NEW.roster_period_staffing_dagdelen_id, NEW.id;
        RETURN NEW;
      ELSE
        RAISE WARNING '[DRAAD416] variant_id % not found or at capacity', NEW.roster_period_staffing_dagdelen_id;
        -- Fall through to Strategy B
      END IF;
    END IF;

    -- Strategy B: Find best matching variant
    -- Priority: 1) Employee team, 2) TOT team, 3) Other teams
    SELECT id INTO target_variant_id
    FROM roster_period_staffing_dagdelen
    WHERE roster_id = NEW.roster_id
      AND date = NEW.date
      AND dagdeel = NEW.dagdeel
      AND service_id = NEW.service_id
      AND aantal > 0
      AND status != 'MAG_NIET'
      AND invulling < aantal  -- Only variants with remaining capacity
    ORDER BY 
      CASE 
        WHEN team = employee_team THEN 1  -- Priority 1: Employee's team
        WHEN team = 'TOT' THEN 2           -- Priority 2: Total pool
        ELSE 3                              -- Priority 3: Other teams
      END,
      aantal DESC  -- Prefer variants with more capacity
    LIMIT 1;

    IF target_variant_id IS NOT NULL THEN
      UPDATE roster_period_staffing_dagdelen
      SET 
        invulling = invulling + 1,
        updated_at = NOW()
      WHERE id = target_variant_id;

      RAISE NOTICE '[DRAAD416] Invulling +1 via fallback for assignment % → variant %', NEW.id, target_variant_id;
    ELSE
      RAISE WARNING '[DRAAD416] No suitable variant found for assignment %: roster_id=%, date=%, dagdeel=%, service_id=%, team=%', 
        NEW.id, NEW.roster_id, NEW.date, NEW.dagdeel, NEW.service_id, employee_team;
    END IF;

  END IF;

  -- ========================================
  -- DECREMENT INVULLING (status 1 → other)
  -- ========================================
  IF (OLD IS NOT NULL AND OLD.status = 1 AND NEW.status != 1) THEN

    -- Get employee team from OLD record
    employee_team := OLD.team;

    -- Strategy A: Use old variant_id if available
    IF (OLD.roster_period_staffing_dagdelen_id IS NOT NULL) THEN

      UPDATE roster_period_staffing_dagdelen
      SET 
        invulling = GREATEST(0, invulling - 1),
        updated_at = NOW()
      WHERE id = OLD.roster_period_staffing_dagdelen_id;

      IF FOUND THEN
        RAISE NOTICE '[DRAAD416] Invulling -1 via old variant_id % for assignment %', OLD.roster_period_staffing_dagdelen_id, OLD.id;
        RETURN NEW;
      END IF;
    END IF;

    -- Strategy B: Decrement first variant with invulling > 0
    UPDATE roster_period_staffing_dagdelen
    SET 
      invulling = GREATEST(0, invulling - 1),
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM roster_period_staffing_dagdelen
      WHERE roster_id = OLD.roster_id
        AND date = OLD.date
        AND dagdeel = OLD.dagdeel
        AND service_id = OLD.service_id
        AND invulling > 0
      ORDER BY 
        CASE 
          WHEN team = employee_team THEN 1
          WHEN team = 'TOT' THEN 2
          ELSE 3
        END
      LIMIT 1
    );

    IF FOUND THEN
      RAISE NOTICE '[DRAAD416] Invulling -1 via fallback for assignment %', OLD.id;
    ELSE
      RAISE WARNING '[DRAAD416] Could not decrement invulling for assignment % - no variant with invulling > 0', OLD.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- STAP 3: Attach trigger to roster_assignments
-- =================================================================

CREATE TRIGGER on_roster_assignment_status_change
AFTER INSERT OR UPDATE ON roster_assignments
FOR EACH ROW
EXECUTE FUNCTION update_invulling_on_assignment_change();

-- =================================================================
-- STAP 4: Add metadata comment
-- =================================================================

COMMENT ON FUNCTION update_invulling_on_assignment_change() IS 
'DRAAD416: Anti-duplicate trigger with status change detection.
Prevents double increment when UI does UPSERT with variant_id update.
Only triggers invulling change on ACTUAL status transitions (0→1 or 1→0).
Skips trigger logic when status unchanged (variant_id update only).
Version: 0.1.13-draad416-anti-duplicate
Datum: 2026-01-17';

-- =================================================================
-- STAP 5: Deployment bevestiging
-- =================================================================

DO $$
BEGIN
  RAISE NOTICE '=========================================';
  RAISE NOTICE '✅ DRAAD416 ANTI-DUPLICATE TRIGGER INSTALLED';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'Trigger will now SKIP updates where status unchanged';
  RAISE NOTICE 'Only REAL status changes (0→1 or 1→0) trigger invulling updates';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Clean database: DELETE FROM roster_assignments WHERE roster_id = ...';
  RAISE NOTICE '2. Reset counters: UPDATE roster_period_staffing_dagdelen SET invulling = 0';
  RAISE NOTICE '3. Test handmatige pre-planning (4 assignments)';
  RAISE NOTICE '4. Verify: SELECT invulling, COUNT(*) FROM roster_period_staffing_dagdelen WHERE aantal=1 GROUP BY invulling';
  RAISE NOTICE '5. Expected: invulling IN (0,1) only - NO invulling=2 or invulling=3!';
  RAISE NOTICE '=========================================';
END $$;
