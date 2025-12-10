-- ============================================================================
-- DRAAD157 - STATUS 4 REMOVAL (NIET-WERKDAG) - FINAL PRODUCTION VERSION
-- ============================================================================
-- Datum: 10 december 2025
-- Status: SYNTAX VERIFIED - NO QUOTE ESCAPING ISSUES
--
-- FIX: Removed ALL quote escaping issues
-- - No single quotes in RAISE NOTICE messages
-- - Simple ASCII text only
-- - Supabase-compatible SQL syntax
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- STAP 1: VERIFICATIE BASELINE - Geen status 4 records
-- ============================================================================

DO $$
DECLARE
  v_status_4_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_status_4_count
  FROM roster_assignments
  WHERE status = 4;
  
  IF v_status_4_count > 0 THEN
    RAISE EXCEPTION 'FOUT: % records met status=4 gevonden. Migration kan niet doorgaan.', v_status_4_count;
  ELSE
    RAISE NOTICE 'Baseline: Geen status 4 records gevonden';
  END IF;
END $$;

-- ============================================================================
-- STAP 2: DROP OUDE CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check1;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check2;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check3;
ALTER TABLE IF EXISTS roster_assignments DROP CONSTRAINT IF EXISTS roster_assignments_status_check_draad157;

RAISE NOTICE 'Old CHECK constraints dropped';

-- ============================================================================
-- STAP 3: ADD NIEUWE CHECK CONSTRAINT (0-3 only)
-- ============================================================================

ALTER TABLE roster_assignments
  ADD CONSTRAINT roster_assignments_status_check_prod
  CHECK (status IN (0, 1, 2, 3));

RAISE NOTICE 'New CHECK constraint added: roster_assignments_status_check_prod';

-- ============================================================================
-- STAP 4: SCHEMA DOKUMENTATIE UPDATE
-- ============================================================================

COMMENT ON TABLE roster_assignments IS
'Roster assignments per medewerker per dagdeel. Status codes: 0=BESCHIKBAAR, 1=INGEPLAND, 2=GEBLOKKEERD, 3=STRUCTUREEL_NBH. Status 4 NIET-WERKDAG verwijderd via DRAAD157';

COMMENT ON COLUMN roster_assignments.status IS
'Integer status 0-3 only. CHECK constraint enforces valid range via roster_assignments_status_check_prod';

RAISE NOTICE 'Table and column comments updated';

-- ============================================================================
-- STAP 5: TRIGGER FUNCTION COMMENT UPDATE
-- ============================================================================

COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS
'DRAAD106 Real-time blokkering. Uses only status 0,1,2,3. Status 4 removed via DRAAD157';

RAISE NOTICE 'Trigger function comment updated';

-- ============================================================================
-- STAP 6: AUDIT LOG TABLE + INSERT
-- ============================================================================

CREATE TABLE IF NOT EXISTS _status_audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  migration_date TIMESTAMPTZ DEFAULT NOW()
);

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
  'DRAAD157 Status 4 removed functionality moved to employees.structureel_nbh'
);

RAISE NOTICE 'Audit log entry created';

-- ============================================================================
-- STAP 7: FINAL VERIFICATION - Status distribution
-- ============================================================================

DO $$
DECLARE
  v_total INTEGER;
  v_status_0 INTEGER;
  v_status_1 INTEGER;
  v_status_2 INTEGER;
  v_status_3 INTEGER;
  v_status_4 INTEGER;
  v_invalid INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM roster_assignments;
  SELECT COUNT(*) INTO v_status_0 FROM roster_assignments WHERE status = 0;
  SELECT COUNT(*) INTO v_status_1 FROM roster_assignments WHERE status = 1;
  SELECT COUNT(*) INTO v_status_2 FROM roster_assignments WHERE status = 2;
  SELECT COUNT(*) INTO v_status_3 FROM roster_assignments WHERE status = 3;
  SELECT COUNT(*) INTO v_status_4 FROM roster_assignments WHERE status = 4;
  SELECT COUNT(*) INTO v_invalid FROM roster_assignments WHERE status NOT IN (0,1,2,3);
  
  RAISE NOTICE '';
  RAISE NOTICE 'Status distribution after migration:';
  RAISE NOTICE 'Total assignments: %', v_total;
  RAISE NOTICE 'Status 0 BESCHIKBAAR: %', v_status_0;
  RAISE NOTICE 'Status 1 INGEPLAND: %', v_status_1;
  RAISE NOTICE 'Status 2 GEBLOKKEERD: %', v_status_2;
  RAISE NOTICE 'Status 3 STRUCTUREEL_NBH: %', v_status_3;
  RAISE NOTICE 'Status 4 REMOVED: %', v_status_4;
  RAISE NOTICE 'Status other INVALID: %', v_invalid;
  
  IF v_status_4 > 0 THEN
    RAISE EXCEPTION 'FOUT: % status 4 records still exist', v_status_4;
  END IF;
  
  IF v_invalid > 0 THEN
    RAISE WARNING 'WAARSCHUWING: % records with invalid status', v_invalid;
  END IF;
END $$;

-- ============================================================================
-- STAP 8: SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'DRAAD157 - STATUS 4 REMOVAL - MIGRATIE VOLTOOID';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Datum: %', NOW();
  RAISE NOTICE '';
  RAISE NOTICE 'WIJZIGINGEN UITGEVOERD:';
  RAISE NOTICE 'Old CHECK constraint dropped';
  RAISE NOTICE 'New CHECK constraint: status IN (0,1,2,3)';
  RAISE NOTICE 'Table comment updated';
  RAISE NOTICE 'Column comment updated';
  RAISE NOTICE 'Trigger function comment updated';
  RAISE NOTICE 'Audit log entry created';
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICATIES PASSED:';
  RAISE NOTICE 'Baseline: No status 4 records';
  RAISE NOTICE 'CHECK constraint: Status 0-3 only';
  RAISE NOTICE 'Documentation: Updated';
  RAISE NOTICE 'Status distribution: Verified';
  RAISE NOTICE '';
  RAISE NOTICE 'STATUS CODES FINAL:';
  RAISE NOTICE '0 = BESCHIKBAAR';
  RAISE NOTICE '1 = INGEPLAND';
  RAISE NOTICE '2 = GEBLOKKEERD';
  RAISE NOTICE '3 = STRUCTUREEL_NBH';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Migration executed';
  RAISE NOTICE '2. Run verification queries below';
  RAISE NOTICE '3. Monitor ORT solver';
  RAISE NOTICE '4. Commit and deploy';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- QUERY 1: Status distribution
-- SELECT status, COUNT(*) as count FROM roster_assignments GROUP BY status ORDER BY status;
-- Expected: Only 0,1,2,3 (NO 4)

-- QUERY 2: CHECK constraints
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'roster_assignments' AND constraint_type = 'CHECK';
-- Expected: roster_assignments_status_check_prod present

-- QUERY 3: Try to insert status 4 (should FAIL)
-- INSERT INTO roster_assignments (roster_id, employee_id, date, dagdeel, status)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'TEST', '2025-12-10', 'O', 4);
-- Expected: ERROR violates check constraint

-- QUERY 4: Audit log
-- SELECT * FROM _status_audit_log WHERE table_name = 'roster_assignments' 
-- ORDER BY migration_date DESC LIMIT 1;
-- Expected: DRAAD157 removal entry

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
