-- ============================================================
-- DRAAD141: Fix Duplicate UNIQUE Constraint on roster_assignments
-- ============================================================
-- 
-- PROBLEM:
--   Two UNIQUE constraints with identical column composition:
--   - roster_assignments_unique_key
--   - unique_roster_employee_date_dagdeel
--
-- ROOT CAUSE:
--   Supabase upsert() with onConflict='roster_id,employee_id,date,dagdeel'
--   cannot determine which constraint to use when both exist
--   Result: "ON CONFLICT DO UPDATE command cannot affect row a second time"
--
-- SOLUTION:
--   1. Drop duplicate constraint (unique_roster_employee_date_dagdeel)
--   2. Keep and document roster_assignments_unique_key
--   3. Update code to use constraint name explicitly
--
-- DRAAD135/140 Context:
--   route.ts uses: onConflict: 'roster_id,employee_id,date,dagdeel'
--   This works but is ambiguous with duplicate constraints
--
-- Created: 2025-12-09
-- Version: DRAAD141-fix-constraint-20251209

-- ============================================================
-- Step 1: Verify constraints exist (informational)
-- ============================================================
-- RUN THIS FIRST in SQL Editor to verify:
/*
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'roster_assignments'::regclass
  AND contype = 'u'  -- UNIQUE constraints only
ORDER BY conname;
*/

-- Expected output:
-- roster_assignments_unique_key       | u | UNIQUE (roster_id, employee_id, date, dagdeel)
-- unique_roster_employee_date_dagdeel | u | UNIQUE (roster_id, employee_id, date, dagdeel)

-- ============================================================
-- Step 2: Drop duplicate constraint
-- ============================================================

ALTER TABLE public.roster_assignments
  DROP CONSTRAINT IF EXISTS unique_roster_employee_date_dagdeel;

-- ============================================================
-- Step 3: Ensure primary constraint is properly documented
-- ============================================================

COMMENT ON CONSTRAINT roster_assignments_unique_key 
  ON public.roster_assignments IS 
  'Composite key: ensures one assignment per (roster_id, employee_id, date, dagdeel).
   Used by upsert() operations in DRAAD135 (route.ts).
   CRITICAL: DO NOT RENAME - referenced in application code.
   Columns: (roster_id, employee_id, date, dagdeel)
   Type: UNIQUE (btree index)';

-- ============================================================
-- Step 4: Verify result
-- ============================================================
-- RUN THIS AFTER migration to verify:
/*
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'roster_assignments'::regclass
  AND contype = 'u'  -- UNIQUE constraints only
ORDER BY conname;
*/

-- Expected output (ONLY ONE constraint):
-- roster_assignments_unique_key | u | UNIQUE (roster_id, employee_id, date, dagdeel)

-- ============================================================
-- VERIFICATION QUERY (after migration)
-- ============================================================
-- 
-- SELECT COUNT(*) FROM pg_constraint 
-- WHERE conrelid = 'roster_assignments'::regclass 
--   AND contype = 'u' 
--   AND conname LIKE '%unique%';
-- 
-- Expected: 1 (exactly one UNIQUE constraint)
-- If > 1: Migration failed

-- ============================================================
-- Documentation: Why This Fixes DRAAD135
-- ============================================================
--
-- Before (BROKEN):
--   onConflict: 'roster_id,employee_id,date,dagdeel'
--   PostgreSQL has TWO matching constraints → CONFUSED
--   Error: "cannot affect row a second time"
--
-- After (FIXED):
--   onConflict: 'roster_id,employee_id,date,dagdeel' (same syntax)
--   PostgreSQL has ONE matching constraint → CLEAR
--   Result: upsert works correctly
--
-- Alternative (more explicit):
--   onConflict: 'roster_assignments_unique_key'
--   This uses constraint name instead of columns
--   Both work, but column-based is more portable

-- ============================================================
-- Related: DRAAD140 Analysis
-- ============================================================
-- See DRAAD140_ANALYSE.md for detailed analysis of:
--   1. Constraint name discovery
--   2. UPSERT key matching
--   3. FIX4 deduplication logic
--   4. Why error persisted despite FIX1-3

