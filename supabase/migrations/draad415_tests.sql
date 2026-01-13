-- DRAAD415: Test Suite
-- Verify trigger behaves correctly
-- 
-- PURPOSE:
-- - Automated tests to verify DRAAD415 fix works correctly
-- - Tests should all PASS after trigger fix and data cleanup
-- - If any test fails, DO NOT proceed with deployment
-- 
-- PREREQUISITES:
-- 1. draad415_trigger_fix.sql has been deployed
-- 2. draad415_data_cleanup.sql has been run
-- 3. Test roster has been created with AFL run
-- 
-- Deployment:
-- 1. Update [TEST_ROSTER_ID] placeholder below
-- 2. Run this script in Supabase SQL Editor
-- 3. All tests must show 'PASSED'
-- 4. If any test fails, check logs and fix before proceeding
-- 
-- Datum: 2026-01-13
-- Versie: 0.1.12-draad415-smart-trigger

-- =================================================================
-- CONFIGURATIE
-- =================================================================

-- VERVANG '[TEST_ROSTER_ID]' met je test roster ID!
-- Bijvoorbeeld: '550e8400-e29b-41d4-a716-446655440000'

RAISE NOTICE '============================================';
RAISE NOTICE '[DRAAD415] TEST SUITE';
RAISE NOTICE '============================================';
RAISE NOTICE '';

-- =================================================================
-- TEST 1: Invulling count <= Assignment count
-- =================================================================

RAISE NOTICE '[TEST 1] Invulling count must be <= assignment count';

DO $$
DECLARE
  invulling_count INT;
  assignment_count INT;
  test_roster_id UUID := '[TEST_ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  -- Count rows with invulling > 0
  SELECT COUNT(*) INTO invulling_count
  FROM roster_period_staffing_dagdelen
  WHERE roster_id = test_roster_id AND invulling > 0;

  -- Count assignments with status=1
  SELECT COUNT(*) INTO assignment_count
  FROM roster_assignments
  WHERE roster_id = test_roster_id AND status = 1;

  -- Test assertion
  IF invulling_count <= assignment_count THEN
    RAISE NOTICE '[TEST 1] ✅ PASSED: invulling_count (%) <= assignment_count (%)', invulling_count, assignment_count;
  ELSE
    RAISE EXCEPTION '[TEST 1] ❌ FAILED: invulling_count (%) > assignment_count (%)', invulling_count, assignment_count;
  END IF;
END $$;

-- =================================================================
-- TEST 2: No invulling > aantal violations
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '[TEST 2] No rows should have invulling > aantal';

DO $$
DECLARE
  violation_count INT;
  test_roster_id UUID := '[TEST_ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  -- Count violations
  SELECT COUNT(*) INTO violation_count
  FROM roster_period_staffing_dagdelen
  WHERE roster_id = test_roster_id AND invulling > aantal;

  -- Test assertion
  IF violation_count = 0 THEN
    RAISE NOTICE '[TEST 2] ✅ PASSED: No rows with invulling > aantal';
  ELSE
    RAISE EXCEPTION '[TEST 2] ❌ FAILED: Found % rows where invulling > aantal', violation_count;
  END IF;
END $$;

-- =================================================================
-- TEST 3: Total invulling matches total assignments
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '[TEST 3] Total invulling must equal total assignments';

DO $$
DECLARE
  total_invulling INT;
  total_assignments INT;
  test_roster_id UUID := '[TEST_ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  -- Sum all invulling
  SELECT COALESCE(SUM(invulling), 0) INTO total_invulling
  FROM roster_period_staffing_dagdelen
  WHERE roster_id = test_roster_id;

  -- Count all assignments with status=1
  SELECT COUNT(*) INTO total_assignments
  FROM roster_assignments
  WHERE roster_id = test_roster_id AND status = 1;

  -- Test assertion
  IF total_invulling = total_assignments THEN
    RAISE NOTICE '[TEST 3] ✅ PASSED: total_invulling (%) = total_assignments (%)', total_invulling, total_assignments;
  ELSE
    RAISE EXCEPTION '[TEST 3] ❌ FAILED: total_invulling (%) != total_assignments (%)', total_invulling, total_assignments;
  END IF;
END $$;

-- =================================================================
-- TEST 4: No invulling on aantal=0 rows
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '[TEST 4] Rows with aantal=0 should have invulling=0';

DO $$
DECLARE
  invalid_count INT;
  test_roster_id UUID := '[TEST_ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  -- Count rows with aantal=0 but invulling>0
  SELECT COUNT(*) INTO invalid_count
  FROM roster_period_staffing_dagdelen
  WHERE roster_id = test_roster_id 
    AND aantal = 0 
    AND invulling > 0;

  -- Test assertion
  IF invalid_count = 0 THEN
    RAISE NOTICE '[TEST 4] ✅ PASSED: No rows with aantal=0 and invulling>0';
  ELSE
    RAISE EXCEPTION '[TEST 4] ❌ FAILED: Found % rows with aantal=0 but invulling>0', invalid_count;
  END IF;
END $$;

-- =================================================================
-- TEST 5: Variant_id coverage check
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '[TEST 5] Variant_id coverage should be > 90%';

DO $$
DECLARE
  with_variant_id INT;
  total_assigned INT;
  coverage_pct NUMERIC;
  test_roster_id UUID := '[TEST_ROSTER_ID]'; -- ← VERVANG DIT!
BEGIN
  -- Count assignments with variant_id
  SELECT COUNT(*) FILTER (WHERE roster_period_staffing_dagdelen_id IS NOT NULL) INTO with_variant_id
  FROM roster_assignments
  WHERE roster_id = test_roster_id AND status = 1;

  -- Count total assignments
  SELECT COUNT(*) INTO total_assigned
  FROM roster_assignments
  WHERE roster_id = test_roster_id AND status = 1;

  -- Calculate percentage
  IF total_assigned > 0 THEN
    coverage_pct := (with_variant_id::NUMERIC / total_assigned::NUMERIC) * 100;
  ELSE
    coverage_pct := 0;
  END IF;

  -- Test assertion (>90% coverage is good)
  IF coverage_pct >= 90 THEN
    RAISE NOTICE '[TEST 5] ✅ PASSED: Variant_id coverage %% (% of %)', ROUND(coverage_pct, 1), with_variant_id, total_assigned;
  ELSIF coverage_pct >= 80 THEN
    RAISE WARNING '[TEST 5] ⚠️ WARNING: Variant_id coverage only %% (% of %)', ROUND(coverage_pct, 1), with_variant_id, total_assigned;
  ELSE
    RAISE EXCEPTION '[TEST 5] ❌ FAILED: Variant_id coverage only %% (% of %)', ROUND(coverage_pct, 1), with_variant_id, total_assigned;
  END IF;
END $$;

-- =================================================================
-- DETAIL ANALYSIS (not a test, just informational)
-- =================================================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '[DETAIL ANALYSIS] Per service breakdown';
RAISE NOTICE '============================================';
RAISE NOTICE '';

-- Show detail per service and team
SELECT 
  st.code as service,
  rpsd.team,
  rpsd.aantal,
  rpsd.invulling,
  (rpsd.aantal - rpsd.invulling) as remaining,
  CASE 
    WHEN rpsd.invulling > rpsd.aantal THEN '❌ VIOLATION'
    WHEN rpsd.aantal = 0 AND rpsd.invulling > 0 THEN '❌ INVALID'
    WHEN rpsd.invulling = rpsd.aantal THEN '✅ FULL'
    ELSE '✓ OK'
  END as status,
  (
    SELECT COUNT(*)
    FROM roster_assignments ra
    WHERE ra.roster_id = rpsd.roster_id
      AND ra.date = rpsd.date
      AND ra.dagdeel = rpsd.dagdeel
      AND ra.service_id = rpsd.service_id
      AND ra.team = rpsd.team
      AND ra.status = 1
  ) as actual_assignments_for_team
FROM roster_period_staffing_dagdelen rpsd
JOIN service_types st ON st.id = rpsd.service_id
WHERE rpsd.roster_id = '[TEST_ROSTER_ID]' -- ← VERVANG DIT!
  AND rpsd.invulling > 0
ORDER BY st.code, rpsd.team;

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '[TEAM DISTRIBUTION] Invulling per team';
RAISE NOTICE '============================================';
RAISE NOTICE '';

-- Show team distribution
SELECT 
  team,
  COUNT(*) FILTER (WHERE invulling > 0) as rows_with_invulling,
  SUM(invulling) as total_invulling,
  SUM(aantal) as total_aantal,
  ROUND((SUM(invulling)::NUMERIC / NULLIF(SUM(aantal), 0)::NUMERIC) * 100, 1) as fill_rate_pct
FROM roster_period_staffing_dagdelen
WHERE roster_id = '[TEST_ROSTER_ID]' -- ← VERVANG DIT!
GROUP BY team
ORDER BY team;

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '[DRAAD415] TEST SUITE COMPLETE';
RAISE NOTICE '============================================';
RAISE NOTICE '';
RAISE NOTICE 'Als alle tests PASSED zijn, is DRAAD415 succesvol!';
RAISE NOTICE 'Verwachte resultaten:';
RAISE NOTICE '- Ongeveer 212 rijen met invulling > 0';
RAISE NOTICE '- GEEN violations (invulling > aantal)';
RAISE NOTICE '- Team distributie NIET gelijk (GRO ~80, ORA ~80, TOT ~52)';
RAISE NOTICE '- Variant_id coverage > 90%';
RAISE NOTICE '';
