-- DRAAD 211: Database Analysis Script
-- Purpose: Analyze why 217 assignments have status=3 (blocked)
-- This is the root cause of zero assignments being generated
-- Run these queries in Supabase SQL Editor

-- ============================================================================
-- QUERY 1: Overview of Assignment Status Distribution
-- ============================================================================

SELECT 
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'  -- Replace with actual roster_id
GROUP BY status
ORDER BY status;

-- Expected results:
-- status | count | percentage
-- 0      | 1246  | 84.75%
-- 1      | 4     | 0.27%
-- 2      | 3     | 0.20%
-- 3      | 217   | 14.76%   ← THESE ARE THE PROBLEM!

-- ============================================================================
-- QUERY 2: Show all Status=3 (BLOCKED) Assignments
-- ============================================================================

SELECT 
    id,
    employee_id,
    date,
    dagdeel,
    service_id,
    status,
    source,
    created_at,
    updated_at
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3
ORDER BY date, dagdeel, employee_id
LIMIT 20;  -- Show first 20

-- This shows WHICH assignments are blocked and WHY they might be blocked

-- ============================================================================
-- QUERY 3: Count Status=3 by Employee
-- ============================================================================

SELECT 
    employee_id,
    COUNT(*) as blocked_count,
    STRING_AGG(DISTINCT date, ', ' ORDER BY date) as dates_blocked
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3
GROUP BY employee_id
ORDER BY blocked_count DESC
LIMIT 20;  -- Top 20 employees with most blocks

-- This shows which employees have the most status=3 records

-- ============================================================================
-- QUERY 4: Count Status=3 by Date
-- ============================================================================

SELECT 
    date,
    COUNT(*) as blocked_count,
    COUNT(DISTINCT employee_id) as unique_employees
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3
GROUP BY date
ORDER BY date;

-- This shows which DATES have the most blocked assignments

-- ============================================================================
-- QUERY 5: Analyze Source of Status=3 Records
-- ============================================================================

SELECT 
    source,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3
GROUP BY source
ORDER BY count DESC;

-- Shows whether status=3 came from 'fixed' (pre-planned) or 'greedy' (auto-generated)

-- ============================================================================
-- QUERY 6: Check Employee Availability/Unavailability Data
-- ============================================================================

SELECT 
    e.id,
    e.voornaam,
    e.achternaam,
    e.team,
    COUNT(DISTINCT ra.date) as blocked_dates_count
FROM employees e
LEFT JOIN roster_assignments ra ON e.id = ra.employee_id 
    AND ra.roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
    AND ra.status = 3
WHERE e.actief = true
GROUP BY e.id, e.voornaam, e.achternaam, e.team
HAVING COUNT(DISTINCT ra.date) > 5
ORDER BY blocked_dates_count DESC;

-- Shows employees with many blocked dates

-- ============================================================================
-- QUERY 7: Check if Status=3 Records are Legitimate Blocks
-- ============================================================================

-- Check unavailability table (if exists)
SELECT 
    id,
    employee_id,
    date,
    dagdeel,
    reason,
    status
FROM employee_unavailability  -- ADJUST TABLE NAME IF NEEDED
WHERE date >= '2025-12-05'
  AND date <= '2025-12-28'
ORDER BY date, employee_id
LIMIT 20;

-- ============================================================================
-- QUERY 8: Sample Status=3 with Context
-- ============================================================================

SELECT 
    ra.id,
    ra.employee_id,
    e.voornaam || ' ' || e.achternaam as employee_name,
    ra.date,
    ra.dagdeel,
    st.naam as service_name,
    ra.status,
    ra.source,
    ra.created_at
FROM roster_assignments ra
LEFT JOIN employees e ON ra.employee_id = e.id
LEFT JOIN service_types st ON ra.service_id = st.id
WHERE ra.roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND ra.status = 3
ORDER BY ra.date, ra.dagdeel
LIMIT 30;

-- ============================================================================
-- QUERY 9: DIAGNOSTIC - Are These Real Blocks or Data Errors?
-- ============================================================================

-- Check if status=3 records should actually be status=0 (available)
SELECT 
    COUNT(*) as total_status_3,
    COUNT(CASE WHEN source = 'fixed' THEN 1 END) as from_fixed_planning,
    COUNT(CASE WHEN source = 'greedy' THEN 1 END) as from_greedy,
    MAX(created_at) as most_recent,
    MIN(created_at) as oldest
FROM roster_assignments
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3;

-- ============================================================================
-- QUERY 10: FIX CANDIDATE - Change Status=3 to Status=0 (if these are errors)
-- ============================================================================

-- ⚠️  DO NOT RUN THIS WITHOUT CONFIRMING ABOVE QUERIES FIRST!
-- This would reset all status=3 to status=0 (available)

-- UPDATE roster_assignments
-- SET status = 0, updated_at = NOW()
-- WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
--   AND status = 3
--   AND source = 'greedy';  -- Only auto-generated ones

-- ============================================================================
-- ANALYSIS CHECKLIST
-- ============================================================================

-- [ ] Query 1: Confirm 217 status=3 records exist
-- [ ] Query 2: Sample 5-10 status=3 records, understand why they're blocked
-- [ ] Query 3: Which employees are most blocked?
-- [ ] Query 4: Which dates have most blocks? (Are they all from same week?)
-- [ ] Query 5: Are status=3 from 'fixed' or 'greedy'? (Should be 'fixed' if legitimate)
-- [ ] Query 6: Do these blocked employees have unavailability records?
-- [ ] Query 7: Check if unavailability data explains the blocks
-- [ ] Query 8: Visual check - do the status=3 records make sense?
-- [ ] Query 9: When were these created? (All at same time = data import issue?)
-- [ ] Decision: Are these LEGITIMATE blocks or DATA ERRORS?
--     - If LEGITIMATE: Greedy algorithm is working correctly (respecting unavailability)
--     - If ERRORS: Delete status=3 records and re-run greedy solver

-- ============================================================================
-- NEXT STEPS
-- ============================================================================

-- 1. Run all 9 queries above
-- 2. Analyze results to determine if status=3 are legitimate or errors
-- 3. If errors: Run Query 10 (after adjusting WHERE clause)
-- 4. Re-run greedy solver
-- 5. Verify new assignments are created
