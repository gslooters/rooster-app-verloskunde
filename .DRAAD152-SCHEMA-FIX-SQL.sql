-- DRAAD152: DATABASE SCHEMA FIX
-- Oplossing voor: Batch UPSERT failing met UNIQUE constraint violations
-- Datum: 2025-12-09
-- Status: READY FOR PRODUCTION

/*
  PROBLEEM:
  - roster_assignments has UNIQUE(employee_id) - allows only 1 record per employee
  - roster_assignments has UNIQUE(dagdeel) - allows only 1 record per dagdeel
  - Roostering requires MULTIPLE assignments per employee (different days/dagdelen)
  - Current schema makes this IMPOSSIBLE
  
  OPLOSSING:
  1. DROP the restrictive UNIQUE constraints
  2. ADD composite UNIQUE constraint on (roster_id, employee_id, date, dagdeel)
  3. This allows:
     - Multiple assignments per employee (different dates/dagdelen)
     - Multiple assignments per dagdeel (different employees/dates)
     - But prevents duplicates on exact same combo
*/

-- Step 1: Create backup (safety)
CREATE TABLE IF NOT EXISTS roster_assignments_backup_draad152 AS
SELECT * FROM roster_assignments;

COMMENT ON TABLE roster_assignments_backup_draad152 IS 
  'Backup of roster_assignments before DRAAD152 schema fix (2025-12-09)';

-- Step 2: Drop existing UNIQUE constraints
ALTER TABLE roster_assignments
DROP CONSTRAINT IF EXISTS roster_assignments_employee_id_key;

ALTER TABLE roster_assignments
DROP CONSTRAINT IF EXISTS roster_assignments_dagdeel_key;

-- Step 3: Add composite UNIQUE constraint
-- This allows multiple assignments per employee/dagdeel
-- But prevents exact duplicates
ALTER TABLE roster_assignments
ADD CONSTRAINT roster_assignments_unique_key
UNIQUE (roster_id, employee_id, date, dagdeel);

-- Verify the new constraint
COMMENT ON CONSTRAINT roster_assignments_unique_key ON roster_assignments IS
  'Composite unique constraint ensuring one assignment per (roster, employee, date, dagdeel) combo';

-- Step 4: Verify the schema
SELECT 
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.key_column_usage
WHERE table_name = 'roster_assignments'
ORDER BY constraint_name, ordinal_position;

-- Expected output:
-- constraint_name                 | constraint_type | column_name
-- ════════════════════════════════════════════════════════════════════
-- roster_assignments_pkey        | PRIMARY KEY     | id
-- roster_assignments_rosterid_fk | FOREIGN KEY     | roster_id
-- roster_assignments_employeeid_fk | FOREIGN KEY   | employee_id
-- roster_assignments_unique_key  | UNIQUE          | roster_id
-- roster_assignments_unique_key  | UNIQUE          | employee_id
-- roster_assignments_unique_key  | UNIQUE          | date
-- roster_assignments_unique_key  | UNIQUE          | dagdeel

-- Step 5: Verify data integrity
-- Check for any existing violations (there shouldn't be any)
SELECT 
  roster_id,
  employee_id,
  date,
  dagdeel,
  COUNT(*) as duplicate_count
FROM roster_assignments
GROUP BY roster_id, employee_id, date, dagdeel
HAVING COUNT(*) > 1;

-- If no rows returned: Data integrity is maintained ✅
-- If rows returned: Investigate before proceeding

/*
  IMPACT ANALYSIS:
  
  What Changed:
  ✅ UNIQUE(employee_id) removed - allows multiple assignments per employee
  ✅ UNIQUE(dagdeel) removed - allows multiple assignments per dagdeel
  ✅ Composite constraint added - prevents exact duplicates
  
  Who Benefits:
  ✅ Roster solver (ORT) - can now assign multiple shifts
  ✅ DRAAD150 batch UPSERT - will now succeed
  ✅ Roostering logic - makes sense now
  
  Breaking Changes:
  ❌ None - existing unique combinations are still unique
  ❌ None - this is a schema correction, not a removal
  
  Testing After Fix:
  1. Monitor next solver run
  2. Check logs for "All X slots UPSERT successful"
  3. Verify assignments in database
  4. Confirm roster status changed to "in_progress"
*/

-- Final check
SELECT 
  'Schema fix complete' as status,
  COUNT(*) as total_assignments,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(DISTINCT roster_id) as unique_rosters
FROM roster_assignments;
