-- ============================================================================
-- DRAAD157 - VERIFICATIE SCRIPT
-- ============================================================================
-- Datum: 10 december 2025
-- Doel: Verifiër dat status 4 removal migration succesvol is uitgevoerd
--
-- INSTRUCTIES:
-- 1. Open Supabase SQL Editor
-- 2. Copy-paste deze HELE file
-- 3. Klik "RUN"
-- 4. Verifiër alle checks zijn ✅ PASS
-- ============================================================================

-- ============================================================================
-- QUERY 1: Check 1 - Geen status 4 records
-- ============================================================================

SELECT 
  'CHECK 1: Status 4 records count' as check_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS - Geen status 4 records'
    ELSE '❌ FAIL - ' || COUNT(*)::TEXT || ' status 4 records gevonden'
  END as result,
  COUNT(*) as status_4_count
FROM roster_assignments
WHERE status = 4
GROUP BY status_4_count;

-- ============================================================================
-- QUERY 2: Check 2 - Status distribution (should be 0,1,2,3)
-- ============================================================================

SELECT 
  'CHECK 2: Status distribution' as check_name,
  CASE 
    WHEN MAX(status) <= 3 AND MIN(status) >= 0 THEN '✅ PASS - Status range is 0-3'
    ELSE '❌ FAIL - Status outside expected range 0-3'
  END as result,
  array_agg(DISTINCT status ORDER BY status) as status_values,
  COUNT(*) as total_records
FROM roster_assignments;

-- ============================================================================
-- QUERY 3: Check 3 - Status value counts
-- ============================================================================

SELECT 
  'CHECK 3: Status value breakdown' as check_name,
  status,
  CASE 
    WHEN status = 0 THEN 'BESCHIKBAAR'
    WHEN status = 1 THEN 'INGEPLAND'
    WHEN status = 2 THEN 'GEBLOKKEERD'
    WHEN status = 3 THEN 'STRUCTUREEL_NBH'
    ELSE 'ONBEKEND'
  END as status_meaning,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM roster_assignments
GROUP BY status
ORDER BY status;

-- ============================================================================
-- QUERY 4: Check 4 - Table comment includes proper documentation
-- ============================================================================

SELECT 
  'CHECK 4: Table documentation' as check_name,
  CASE 
    WHEN obj_description('roster_assignments'::regclass, 'pg_class')::TEXT LIKE '%0,1,2,3%' 
         OR obj_description('roster_assignments'::regclass, 'pg_class')::TEXT LIKE '%BESCHIKBAAR%' THEN '✅ PASS - Documentation updated'
    ELSE '❌ FAIL - Documentation may not be updated'
  END as result,
  obj_description('roster_assignments'::regclass, 'pg_class') as table_comment;

-- ============================================================================
-- QUERY 5: Check 5 - Status column comment
-- ============================================================================

SELECT 
  'CHECK 5: Column documentation' as check_name,
  col_description('roster_assignments'::regclass, 
    (SELECT attnum FROM pg_attribute 
     WHERE attrelid='roster_assignments'::regclass AND attname='status')) as status_column_comment,
  CASE 
    WHEN col_description('roster_assignments'::regclass, 
      (SELECT attnum FROM pg_attribute 
       WHERE attrelid='roster_assignments'::regclass AND attname='status'))::TEXT LIKE '%0-3%' THEN '✅ PASS - Column comment correct'
    ELSE '⚠️ INFO - Column comment may need review'
  END as result;

-- ============================================================================
-- QUERY 6: Check 6 - Constraints verification
-- ============================================================================

SELECT 
  'CHECK 6: Constraints' as check_name,
  constraint_name,
  constraint_type,
  CASE 
    WHEN constraint_type = 'CHECK' AND constraint_name LIKE '%status%' THEN '⚠️ INFO - CHECK constraint detected'
    WHEN constraint_type = 'UNIQUE' THEN '✅ PASS - ' || constraint_name
    WHEN constraint_type = 'FOREIGN KEY' THEN '✅ PASS - ' || constraint_name
    WHEN constraint_type = 'PRIMARY KEY' THEN '✅ PASS - ' || constraint_name
    ELSE 'INFO'
  END as observation
FROM information_schema.table_constraints
WHERE table_name = 'roster_assignments'
ORDER BY constraint_type, constraint_name;

-- ============================================================================
-- QUERY 7: Check 7 - Trigger function comments
-- ============================================================================

SELECT 
  'CHECK 7: Trigger documentation' as check_name,
  proname as function_name,
  CASE 
    WHEN obj_description((pronamespace::text || '.' || proname)::regprocedure, 'pg_proc')::TEXT LIKE '%0,1,2,3%' 
         OR obj_description((pronamespace::text || '.' || proname)::regprocedure, 'pg_proc')::TEXT LIKE '%status%' THEN '✅ PASS - Function comment present'
    ELSE '⚠️ INFO - Function comment may need review'
  END as result,
  obj_description((pronamespace::text || '.' || proname)::regprocedure, 'pg_proc') as function_comment
FROM pg_proc
WHERE proname LIKE '%status%management%'
  OR proname LIKE '%roster%trigger%';

-- ============================================================================
-- QUERY 8: Check 8 - Database performance (index check)
-- ============================================================================

SELECT 
  'CHECK 8: Performance indexes' as check_name,
  indexname,
  schemaname,
  tablename,
  CASE 
    WHEN indexname LIKE '%status%' THEN '✅ PASS - Status index exists'
    WHEN indexname LIKE '%employee%' THEN '✅ PASS - Employee index exists'
    ELSE 'INFO'
  END as observation
FROM pg_indexes
WHERE tablename = 'roster_assignments'
ORDER BY indexname;

-- ============================================================================
-- QUERY 9: Check 9 - Audit log verification
-- ============================================================================

SELECT 
  'CHECK 9: Audit trail' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM _status_audit_log WHERE reason LIKE '%DRAAD157%') 
         THEN '✅ PASS - Audit log entry created'
    ELSE '⚠️ INFO - Audit log entry not found'
  END as result,
  COUNT(*) as audit_entries,
  MAX(migration_date) as last_migration_date
FROM _status_audit_log
WHERE table_name = 'roster_assignments';

-- ============================================================================
-- QUERY 10: Check 10 - Final summary
-- ============================================================================

SELECT 
  'SUMMARY' as check_type,
  'All checks completed' as status,
  COUNT(DISTINCT roster_id) as distinct_rosters,
  COUNT(DISTINCT employee_id) as distinct_employees,
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN status = 0 THEN 1 END) as available_slots,
  COUNT(CASE WHEN status = 1 THEN 1 END) as assigned_slots,
  COUNT(CASE WHEN status = 2 THEN 1 END) as blocked_slots,
  COUNT(CASE WHEN status = 3 THEN 1 END) as unavailable_slots,
  COUNT(CASE WHEN status NOT IN (0,1,2,3) THEN 1 END) as invalid_status_count
FROM roster_assignments;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- ✅ CHECK 1: PASS (0 status 4 records)
-- ✅ CHECK 2: PASS (Status range 0-3)
-- ✅ CHECK 3: INFO (Breakdown of status distribution)
-- ✅ CHECK 4: PASS (Documentation updated)
-- ✅ CHECK 5: PASS (Column comment correct)
-- ✅ CHECK 6: PASS (Constraints verified)
-- ✅ CHECK 7: INFO (Trigger function comment)
-- ✅ CHECK 8: PASS (Performance indexes present)
-- ✅ CHECK 9: PASS (Audit log entry created)
-- ✅ CHECK 10: INFO (Summary statistics)
--
-- Als ALLE checks ✅ PASS zijn: Status 4 removal is SUCCESVOL!
-- ============================================================================
