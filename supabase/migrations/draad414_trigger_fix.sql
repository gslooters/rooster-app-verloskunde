-- DRAAD414: Database Trigger Fix
-- Vereenvoudigde invulling management zonder team dependency
--
-- PROBLEEM:
-- - Oude trigger vereiste roster_period_staffing_dagdelen_id NOT NULL
-- - variant_id lookup faalde door team mismatch
-- - System services hebben multiple team variants
--
-- OPLOSSING:
-- - Trigger update invulling op basis van date/dagdeel/service_id
-- - GEEN team check - alle teams tellen mee
-- - Matches hoe AFL algorithm werkt (per service, niet per team)
--
-- IMPACT:
-- - AFL assignments worden correct verwerkt
-- - invulling counter blijft accuraat
-- - Geen variant_id dependency meer

-- Drop oude trigger en functie
DROP TRIGGER IF EXISTS on_roster_assignment_status_change ON roster_assignments;
DROP FUNCTION IF EXISTS update_invulling_on_assignment_change();

-- Nieuwe trigger functie zonder team check
CREATE OR REPLACE FUNCTION update_invulling_on_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When assignment status changes to 1 (assigned), increment invulling
  IF (NEW.status = 1 AND (OLD IS NULL OR OLD.status != 1)) THEN
    UPDATE roster_period_staffing_dagdelen
    SET 
      invulling = invulling + 1,
      updated_at = NOW()
    WHERE 
      roster_id = NEW.roster_id
      AND date = NEW.date
      AND dagdeel = NEW.dagdeel
      AND service_id = NEW.service_id;
      -- KEY CHANGE: NO TEAM CHECK - all teams count toward invulling
    
    -- Log de update voor debugging
    RAISE NOTICE '[DRAAD414] Invulling +1 for roster_id=%, date=%, dagdeel=%, service_id=%', 
      NEW.roster_id, NEW.date, NEW.dagdeel, NEW.service_id;
  END IF;
  
  -- When assignment is unassigned (status != 1), decrement invulling
  IF (OLD IS NOT NULL AND OLD.status = 1 AND NEW.status != 1) THEN
    UPDATE roster_period_staffing_dagdelen
    SET 
      invulling = GREATEST(0, invulling - 1),
      updated_at = NOW()
    WHERE 
      roster_id = NEW.roster_id
      AND date = NEW.date
      AND dagdeel = NEW.dagdeel
      AND service_id = NEW.service_id;
    
    -- Log de update voor debugging
    RAISE NOTICE '[DRAAD414] Invulling -1 for roster_id=%, date=%, dagdeel=%, service_id=%', 
      NEW.roster_id, NEW.date, NEW.dagdeel, NEW.service_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Herattach trigger aan tabel
CREATE TRIGGER on_roster_assignment_status_change
AFTER INSERT OR UPDATE ON roster_assignments
FOR EACH ROW
EXECUTE FUNCTION update_invulling_on_assignment_change();

-- Verificatie query
-- Deze query toont hoeveel assignments matched met dagdelen records
COMMENT ON FUNCTION update_invulling_on_assignment_change() IS 
'DRAAD414: Simplified invulling management without team dependency. 
Updates invulling based on roster_id + date + dagdeel + service_id only. 
No team check required - all teams count toward service invulling.';

-- Test query om trigger werking te verifiëren:
-- SELECT 
--   ra.roster_id,
--   ra.date,
--   ra.dagdeel,
--   ra.service_id,
--   COUNT(*) as assignments,
--   (
--     SELECT SUM(invulling) 
--     FROM roster_period_staffing_dagdelen rpsd 
--     WHERE rpsd.roster_id = ra.roster_id 
--       AND rpsd.date = ra.date 
--       AND rpsd.dagdeel = ra.dagdeel 
--       AND rpsd.service_id = ra.service_id
--   ) as total_invulling
-- FROM roster_assignments ra
-- WHERE ra.status = 1
-- GROUP BY ra.roster_id, ra.date, ra.dagdeel, ra.service_id
-- HAVING COUNT(*) != COALESCE(
--   (
--     SELECT SUM(invulling) 
--     FROM roster_period_staffing_dagdelen rpsd 
--     WHERE rpsd.roster_id = ra.roster_id 
--       AND rpsd.date = ra.date 
--       AND rpsd.dagdeel = ra.dagdeel 
--       AND rpsd.service_id = ra.service_id
--   ), 0
-- );
-- ^^ This query should return 0 rows when invulling is correct
