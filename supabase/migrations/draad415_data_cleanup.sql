-- DRAAD415: Data Cleanup
-- Reset invulling counters to correct values
-- 
-- PURPOSE:
-- - Reset all invulling values to 0
-- - Recalculate correct invulling based on actual assignments
-- - Simulate what the new trigger should have done
-- 
-- WARNING: 
-- - This will recalculate ALL invulling values from scratch
-- - Run AFTER trigger update (draad415_trigger_fix.sql)
-- - Run BEFORE testing new AFL runs
-- 
-- Deployment: 
-- 1. Run draad415_trigger_fix.sql first
-- 2. Update [ROSTER_ID] placeholder below with your test roster ID
-- 3. Run this script in Supabase SQL Editor
-- 4. Verify with queries at bottom
-- 
-- Datum: 2026-01-13
-- Versie: 0.1.12-draad415-smart-trigger

-- =================================================================
-- CONFIGURATIE: Update this with your test roster ID
-- =================================================================

-- VERVANG '[ROSTER_ID]' met je test roster ID!
-- Bijvoorbeeld: '550e8400-e29b-41d4-a716-446655440000'
DO $$
DECLARE
  test_roster_id UUID := '[ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  RAISE NOTICE '[DRAAD415] Starting data cleanup for roster: %', test_roster_id;
END $$;

-- =================================================================
-- STAP 1: Reset alle invulling naar 0
-- =================================================================

RAISE NOTICE '[DRAAD415] Stap 1: Resetting all invulling counters to 0...';

UPDATE roster_period_staffing_dagdelen
SET invulling = 0, updated_at = NOW()
WHERE roster_id = '[ROSTER_ID]'; -- ← VERVANG DIT!

RAISE NOTICE '[DRAAD415] Reset complete. All invulling values are now 0.';

-- =================================================================
-- STAP 2: Recalculate invulling from assignments
-- =================================================================

RAISE NOTICE '[DRAAD415] Stap 2: Recalculating invulling from actual assignments...';

-- This query simulates what the trigger should have done:
-- For each assignment with status=1, find the best matching variant
-- and increment its invulling counter

WITH assignment_counts AS (
  -- Count assignments per date/dagdeel/service/team
  SELECT 
    ra.roster_id,
    ra.date,
    ra.dagdeel,
    ra.service_id,
    ra.team as assignment_team,
    COUNT(*) as num_assignments
  FROM roster_assignments ra
  WHERE ra.roster_id = '[ROSTER_ID]' -- ← VERVANG DIT!
    AND ra.status = 1
    AND ra.service_id IS NOT NULL
  GROUP BY ra.roster_id, ra.date, ra.dagdeel, ra.service_id, ra.team
),
best_variants AS (
  -- For each assignment group, find the best matching variant
  -- Using same priority logic as trigger:
  -- 1) Employee team + capacity
  -- 2) TOT team + capacity  
  -- 3) ANY team + capacity (highest aantal first)
  SELECT DISTINCT ON (ac.roster_id, ac.date, ac.dagdeel, ac.service_id, ac.assignment_team)
    rpsd.id as variant_id,
    ac.num_assignments,
    ac.assignment_team,
    rpsd.team as variant_team
  FROM assignment_counts ac
  JOIN roster_period_staffing_dagdelen rpsd ON
    rpsd.roster_id = ac.roster_id
    AND rpsd.date = ac.date
    AND rpsd.dagdeel = ac.dagdeel
    AND rpsd.service_id = ac.service_id
    AND rpsd.aantal > 0
    AND rpsd.status != 'MAG_NIET'
  ORDER BY 
    ac.roster_id, ac.date, ac.dagdeel, ac.service_id, ac.assignment_team,
    CASE 
      WHEN rpsd.team = ac.assignment_team THEN 1  -- Priority 1: Match team
      WHEN rpsd.team = 'TOT' THEN 2                -- Priority 2: Total pool
      ELSE 3                                       -- Priority 3: Other teams
    END,
    rpsd.aantal DESC  -- Prefer variants with more capacity
)
UPDATE roster_period_staffing_dagdelen rpsd
SET 
  invulling = bv.num_assignments,
  updated_at = NOW()
FROM best_variants bv
WHERE rpsd.id = bv.variant_id;

RAISE NOTICE '[DRAAD415] Recalculation complete.';

-- =================================================================
-- STAP 3: Verification queries
-- =================================================================

RAISE NOTICE '[DRAAD415] Stap 3: Running verification queries...';

-- Query 1: Count rows with invulling > 0
RAISE NOTICE '[DRAAD415] Query 1: Rows with invulling > 0';
SELECT 
  'Corrected invulling' as check_type,
  COUNT(*) as rows_with_invulling,
  SUM(invulling) as total_invulling
FROM roster_period_staffing_dagdelen
WHERE roster_id = '[ROSTER_ID]' -- ← VERVANG DIT!
  AND invulling > 0;

-- Expected: rows_with_invulling ≈ 212, total_invulling = 212

-- Query 2: Check for violations (invulling > aantal)
RAISE NOTICE '[DRAAD415] Query 2: Violations (invulling > aantal)';
SELECT 
  'Violations check' as check_type,
  COUNT(*) as violation_count
FROM roster_period_staffing_dagdelen
WHERE roster_id = '[ROSTER_ID]' -- ← VERVANG DIT!
  AND invulling > aantal;

-- Expected: violation_count = 0

-- Query 3: Team distribution
RAISE NOTICE '[DRAAD415] Query 3: Team distribution';
SELECT 
  team,
  COUNT(*) FILTER (WHERE invulling > 0) as rows_with_invulling,
  SUM(invulling) as team_invulling_sum,
  SUM(aantal) as team_aantal_sum
FROM roster_period_staffing_dagdelen
WHERE roster_id = '[ROSTER_ID]' -- ← VERVANG DIT!
GROUP BY team
ORDER BY team;

-- Expected: NOT equal sums per team
-- GRO: ~80, ORA: ~80, TOT: ~52 (varies by actual planning)
-- NOT: GRO: 213, ORA: 213, TOT: 214 (that was the bug)

-- Query 4: Detail per service
RAISE NOTICE '[DRAAD415] Query 4: Detail per service';
SELECT 
  st.code as service,
  rpsd.team,
  rpsd.aantal,
  rpsd.invulling,
  (rpsd.aantal - rpsd.invulling) as remaining
FROM roster_period_staffing_dagdelen rpsd
JOIN service_types st ON st.id = rpsd.service_id
WHERE rpsd.roster_id = '[ROSTER_ID]' -- ← VERVANG DIT!
  AND rpsd.invulling > 0
ORDER BY st.code, rpsd.team;

RAISE NOTICE '[DRAAD415] Data cleanup complete!';
RAISE NOTICE '[DRAAD415] Controleer de query resultaten hierboven';
RAISE NOTICE '[DRAAD415] Verwacht: ~212 rijen met invulling > 0, GEEN violations';
RAISE NOTICE '[DRAAD415] RUN NEXT: draad415_tests.sql voor complete test suite';
