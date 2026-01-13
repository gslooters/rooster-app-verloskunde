-- DRAAD415: Smart Trigger with Variant ID Priority + Fallback
-- 
-- PROBLEEM (DRAAD414):
-- - Trigger update ALLE team variants (GRO, ORA, TOT)
-- - Invulling counter was 387 i.p.v. 212 (3× te hoog)
-- - Elke dienst telde voor alle teams
-- - 342 rijen waar invulling > aantal (logisch onmogelijk)
-- 
-- OPLOSSING:
-- - Gebruik variant_id als primary strategy
-- - Fallback naar smart team selection
-- - Filter op aantal > 0 en status != 'MAG_NIET'
-- - Update ALLEEN de gevonden variant (niet alle teams)
--
-- Deployment: Run dit script in Supabase SQL Editor
-- Datum: 2026-01-13
-- Versie: 0.1.12-draad415-smart-trigger

-- =================================================================
-- STAP 1: Drop oude trigger en functie
-- =================================================================

DROP TRIGGER IF EXISTS on_roster_assignment_status_change ON roster_assignments;
DROP FUNCTION IF EXISTS update_invulling_on_assignment_change();

RAISE NOTICE '[DRAAD415] Oude trigger en functie verwijderd';

-- =================================================================
-- STAP 2: Nieuwe smart trigger function
-- =================================================================

CREATE OR REPLACE FUNCTION update_invulling_on_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
  target_variant_id UUID;
  employee_team TEXT;
BEGIN
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
        RAISE NOTICE '[DRAAD415] Invulling +1 via variant_id % for assignment %', NEW.roster_period_staffing_dagdelen_id, NEW.id;
        RETURN NEW;
      ELSE
        RAISE WARNING '[DRAAD415] variant_id % not found or at capacity', NEW.roster_period_staffing_dagdelen_id;
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

      RAISE NOTICE '[DRAAD415] Invulling +1 via fallback for assignment % → variant %', NEW.id, target_variant_id;
    ELSE
      RAISE WARNING '[DRAAD415] No suitable variant found for assignment %: roster_id=%, date=%, dagdeel=%, service_id=%, team=%', 
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
        RAISE NOTICE '[DRAAD415] Invulling -1 via old variant_id % for assignment %', OLD.roster_period_staffing_dagdelen_id, OLD.id;
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
      RAISE NOTICE '[DRAAD415] Invulling -1 via fallback for assignment %', OLD.id;
    ELSE
      RAISE WARNING '[DRAAD415] Could not decrement invulling for assignment % - no variant with invulling > 0', OLD.id;
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

RAISE NOTICE '[DRAAD415] Nieuwe smart trigger geïnstalleerd';

-- =================================================================
-- STAP 4: Add metadata comment
-- =================================================================

COMMENT ON FUNCTION update_invulling_on_assignment_change() IS 
'DRAAD415: Smart trigger with variant_id priority + team-aware fallback. 
Only updates variants with aantal > 0 and status != MAG_NIET.
Prevents multiple team variants from being incremented for same assignment.
Version: 0.1.12-draad415-smart-trigger
Datum: 2026-01-13';

RAISE NOTICE '[DRAAD415] Trigger fix complete!';
RAISE NOTICE '[DRAAD415] RUN NEXT: draad415_data_cleanup.sql om invulling counters te resetten';
