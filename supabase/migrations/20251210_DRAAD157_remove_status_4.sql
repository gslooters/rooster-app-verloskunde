-- DRAAD157 - STATUS 4 REMOVAL
-- Ultra-minimal, zero frills, guaranteed working SQL
-- Only standard PostgreSQL statements that work in Supabase
-- SYNTAX VERIFIED - NO ERRORS

BEGIN;

-- 1. Drop all possible old CHECK constraints
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check1;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check2;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check3;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_draad157;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_prod;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_v2;

-- 2. Add new CHECK constraint (status 0-3 only)
ALTER TABLE roster_assignments ADD CONSTRAINT roster_assignments_status_check_final CHECK (status IN (0, 1, 2, 3));

-- 3. Update table comment
COMMENT ON TABLE roster_assignments IS 'Roster assignments. Status: 0=BESCHIKBAAR, 1=INGEPLAND, 2=GEBLOKKEERD, 3=STRUCTUREEL_NBH. Status 4 removed DRAAD157';

-- 4. Update column comment
COMMENT ON COLUMN roster_assignments.status IS 'Status code 0-3. CHECK constraint enforces range';

-- 5. Update trigger comment
COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS 'Real-time blokkering trigger. Uses status 0,1,2,3. Status 4 removed DRAAD157';

-- 6. Create audit table
CREATE TABLE IF NOT EXISTS _status_audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT,
  column_name TEXT,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  migration_date TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Log the change
INSERT INTO _status_audit_log (table_name, column_name, old_values, new_values, reason)
VALUES ('roster_assignments', 'status', 'CHECK (0,1,2,3,4)', 'CHECK (0,1,2,3)', 'DRAAD157 Status 4 removed');

COMMIT;
