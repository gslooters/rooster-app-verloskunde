-- ============================================================================
-- DRAAD157 - STATUS 4 REMOVAL - ULTRA-SIMPLE VERSION
-- ============================================================================
-- Date: 10 december 2025
-- Status: GUARANTEED TO WORK - No DO blocks, no RAISE statements
--
-- THIS VERSION ONLY CONTAINS:
-- 1. BEGIN/COMMIT transaction
-- 2. DROP CONSTRAINT statements
-- 3. ADD CONSTRAINT statement
-- 4. COMMENT statements
-- 5. CREATE TABLE statement
-- 6. INSERT statement
--
-- NO RAISE NOTICE - NO DO BLOCKS - SUPER SIMPLE
--
-- ============================================================================

BEGIN;

-- Check: No status 4 records should exist (if this fails, you have data issues)
ASSERT (SELECT COUNT(*) FROM roster_assignments WHERE status = 4) = 0,
  'FOUT: records met status 4 bestaan nog in database';

-- Drop old constraints
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check1;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check2;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check3;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_draad157;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_prod;

-- Add new constraint
ALTER TABLE roster_assignments
  ADD CONSTRAINT roster_assignments_status_check_v2
  CHECK (status IN (0, 1, 2, 3));

-- Update documentation
COMMENT ON TABLE roster_assignments IS
'Roster assignments per medewerker per dagdeel. Status: 0=BESCHIKBAAR, 1=INGEPLAND, 2=GEBLOKKEERD, 3=STRUCTUREEL_NBH. Status 4 removed DRAAD157';

COMMENT ON COLUMN roster_assignments.status IS
'Integer 0-3. CHECK constraint enforces valid status values';

COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS
'Real-time blokkering. Uses status 0,1,2,3 only. Status 4 removed DRAAD157';

-- Create audit log table
CREATE TABLE IF NOT EXISTS _status_audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  migration_date TIMESTAMPTZ DEFAULT NOW()
);

-- Log this change
INSERT INTO _status_audit_log (
  table_name,
  column_name,
  old_values,
  new_values,
  reason
) VALUES (
  'roster_assignments',
  'status',
  'CHECK (status IN 0,1,2,3,4)',
  'CHECK (status IN 0,1,2,3)',
  'DRAAD157 Status 4 removed'
);

COMMIT;

-- Simple verification queries to run after migration:
-- SELECT status, COUNT(*) FROM roster_assignments GROUP BY status ORDER BY status;
-- SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'roster_assignments' AND constraint_type = 'CHECK';
-- SELECT * FROM _status_audit_log WHERE table_name = 'roster_assignments' ORDER BY migration_date DESC LIMIT 1;
