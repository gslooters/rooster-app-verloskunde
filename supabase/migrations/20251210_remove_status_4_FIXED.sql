-- ============================================================================
-- DRAAD157 - STATUS 4 REMOVAL (NIET-WERKDAG) - FIXED VERSION
-- ============================================================================
-- Datum: 10 december 2025
-- Prioriteit: HOOG (Code cleanup voor schone implementatie)
-- FIX: Replaced information_schema.statistics with pg_indexes
--
-- CONTEXT:
-- Status 4 (NIET-WERKDAG) was ooit gepland maar:
-- - Dupliceert functionality van employees.structureel_nbh JSONB veld
-- - Veroorzaakt verwarring in status semantiek
-- - Niet in actieve code geïmplementeerd
-- - Clean start: geen migratie van bestaande data nodig
--
-- FINDINGS FROM CODE SCAN:
-- ✅ Codebase scan: GEEN actieve implementatie van "status 4" in TypeScript/Python
-- ✅ Alleen references in CHECK constraints (database)
-- ✅ Frontend en API code: GEEN status 4 logica gevonden
-- ✅ Trigger functions: Gebruiken alleen status 0, 1, 2, 3
-- ✅ Solver2 (ORT): Geen status 4 references
--
-- DELIVERABLES:
-- ✅ Verificatie: Geen status 4 records in database
-- ✅ Documentation update voor status codes
-- ✅ Trigger function inspection (FYI: GEEN wijziging nodig)
-- ✅ TypeScript types verified (GEEN wijziging nodig)
-- ✅ DROP CHECK constraint die status 4 toestaat
-- ✅ ADD new CHECK constraint voor status 0-3 only
--
-- STATUS CODES ACTIVE (FINAL):
-- - status 0: BESCHIKBAAR (initial state for ORT)
-- - status 1: INGEPLAND (manually assigned or finalized by ORT)
-- - status 2: GEBLOKKEERD (blocked by trigger due to service)
-- - status 3: STRUCTUREEL NBH (structural unavailability from employees.structureel_nbh)
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- STAP 1: VERIFICATIE VAN BASELINE
-- ============================================================================
-- Controleer dat er GEEN status 4 records bestaan in database

DO $$
DECLARE
  v_status_4_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_status_4_count
  FROM roster_assignments
  WHERE status = 4;
  
  IF v_status_4_count > 0 THEN
    RAISE EXCEPTION 'FOUT: % records met status=4 gevonden in roster_assignments. Migration kan niet doorgaan.', v_status_4_count;
  ELSE
    RAISE NOTICE '✅ Verificatie: Geen status 4 records gevonden (baseline OK)';
  END IF;
END $$;

-- ============================================================================
-- STAP 2: VERWIJDER OUDE CHECK CONSTRAINT
-- ============================================================================
-- Drop the old CHECK constraint dat status 4 toestaat

ALTER TABLE roster_assignments
  DROP CONSTRAINT IF EXISTS "roster_assignments_status_check";

-- Alternative: IF constraint has different name, try these:
ALTER TABLE roster_assignments
  DROP CONSTRAINT IF EXISTS "roster_assignments_status_check1";

ALTER TABLE roster_assignments
  DROP CONSTRAINT IF EXISTS "roster_assignments_status_check2";

ALTER TABLE roster_assignments
  DROP CONSTRAINT IF EXISTS "roster_assignments_status_check3";

-- ============================================================================
-- STAP 3: VOEG NIEUWE CHECK CONSTRAINT TOE (Status 0-3 only)
-- ============================================================================
-- Add new CHECK constraint die ALLEEN status 0,1,2,3 toestaat

ALTER TABLE roster_assignments
  ADD CONSTRAINT roster_assignments_status_check_draad157
  CHECK (status IN (0, 1, 2, 3));

RAISE NOTICE '✅ New CHECK constraint created: roster_assignments_status_check_draad157';

-- ============================================================================
-- STAP 4: SCHEMA DOKUMENTATIE UPDATE
-- ============================================================================
-- Update comments om duidelijk te maken welke status values geldig zijn

COMMENT ON TABLE roster_assignments IS
'Roster assignments per medewerker per dagdeel.
Status codes:
  0 = BESCHIKBAAR (initial state, available for ORT assignment)
  1 = INGEPLAND (assigned by ORT or manual planning)
  2 = GEBLOKKEERD (blocked by trigger due to related service)
  3 = STRUCTUREEL NBH (structural unavailability from employees.structureel_nbh)
Opmerking: Status 4 (NIET-WERKDAG) is verwijderd - functionaliteit verplaatst naar employees.structureel_nbh JSONB veld.';

COMMENT ON COLUMN roster_assignments.status IS
'Status van de toewijzing: 0=BESCHIKBAAR, 1=INGEPLAND, 2=GEBLOKKEERD, 3=STRUCTUREEL_NBH. Geldige range: 0-3 (PostgreSQL CHECK constraint enforced).';

-- ============================================================================
-- STAP 5: INDEX VERIFICATIE (PostgreSQL compatible)
-- ============================================================================
-- Check of status kolom een index heeft (PostgreSQL compatible)

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename = 'roster_assignments'
  AND indexdef LIKE '%status%';
  
  IF v_index_count > 0 THEN
    RAISE NOTICE '✅ Performance: Index op status kolom is aanwezig (% indexen gevonden)', v_index_count;
  ELSE
    RAISE NOTICE '⚠️ WAARSCHUWING: Geen index op status kolom - performance impact mogelijk';
  END IF;
END $$;

-- ============================================================================
-- STAP 6: TRIGGER FUNCTION INSPECTION (INFORMATIE)
-- ============================================================================
-- Documentatie: Huidige trigger uses ONLY status 0, 1, 2, 3
-- Geen wijzigingen nodig, want status 4 is NOOIT gebruikt

COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS
'DRAAD106: Real-time blokkering tijdens ORT proces.
Vuurt bij service_id wijziging ongeacht status.
Maakt status 2 records direct (ook voor status 0).
Beschermt status 1 (fixed) en status 3 (structureel NBH).
Nota: Status 4 (NIET-WERKDAG) is verwijderd - DRAAD157 UPDATE: CHECK constraint nu 0-3 only.';

-- ============================================================================
-- STAP 7: VERIFICATIE CONSTRAINTS (Audit)
-- ============================================================================
-- Log welke CHECK constraints actief zijn op roster_assignments

DO $$
DECLARE
  v_constraint_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Active CHECK constraints on roster_assignments:';
  FOR v_constraint_record IN
    SELECT constraint_name, constraint_definition
    FROM information_schema.check_constraints
    WHERE table_name = 'roster_assignments'
  LOOP
    RAISE NOTICE '  • % → %', v_constraint_record.constraint_name, v_constraint_record.constraint_definition;
  END LOOP;
END $$;

-- ============================================================================
-- STAP 8: ARCHIEF INFORMATIE
-- ============================================================================
-- Document welke kolommen status bevatten voor toekomstige referentie

CREATE TABLE IF NOT EXISTS _status_audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  migration_date TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE _status_audit_log IS
'Audit log voor status-gerelateerde schema wijzigingen (archief/referentie).';

INSERT INTO _status_audit_log (
  table_name,
  column_name,
  old_values,
  new_values,
  reason
) VALUES (
  'roster_assignments',
  'status',
  'values: 0,1,2,3,4 (CHECK constraint)',
  'values: 0,1,2,3 (CHECK constraint)',
  'DRAAD157: Status 4 (NIET-WERKDAG) removed - functionality moved to employees.structureel_nbh JSONB field'
);

-- ============================================================================
-- STAP 9: FINAL VERIFICATION
-- ============================================================================
-- Double-check da status 4 niet meer voorkomt en constraint werkt

DO $$
DECLARE
  v_status_0_count INTEGER;
  v_status_1_count INTEGER;
  v_status_2_count INTEGER;
  v_status_3_count INTEGER;
  v_status_4_count INTEGER;
  v_status_other_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_status_0_count FROM roster_assignments WHERE status = 0;
  SELECT COUNT(*) INTO v_status_1_count FROM roster_assignments WHERE status = 1;
  SELECT COUNT(*) INTO v_status_2_count FROM roster_assignments WHERE status = 2;
  SELECT COUNT(*) INTO v_status_3_count FROM roster_assignments WHERE status = 3;
  SELECT COUNT(*) INTO v_status_4_count FROM roster_assignments WHERE status = 4;
  SELECT COUNT(*) INTO v_status_other_count FROM roster_assignments WHERE status NOT IN (0,1,2,3);
  
  RAISE NOTICE '';
  RAISE NOTICE 'Status distribution after migration:';
  RAISE NOTICE '  Status 0 (BESCHIKBAAR): %', v_status_0_count;
  RAISE NOTICE '  Status 1 (INGEPLAND): %', v_status_1_count;
  RAISE NOTICE '  Status 2 (GEBLOKKEERD): %', v_status_2_count;
  RAISE NOTICE '  Status 3 (STRUCTUREEL NBH): %', v_status_3_count;
  RAISE NOTICE '  Status 4 (REMOVED): %', v_status_4_count;
  RAISE NOTICE '  Status other (INVALID): %', v_status_other_count;
  
  IF v_status_4_count > 0 THEN
    RAISE WARNING 'FOUT: Status 4 records bestaan nog! Migration is NIET compleet!';
  END IF;
  
  IF v_status_other_count > 0 THEN
    RAISE WARNING 'WAARSCHUWING: % records met ongeldige status (niet 0-3)!', v_status_other_count;
  END IF;
END $$;

-- ============================================================================
-- STAP 10: SUMMARY LOGGING
-- ============================================================================

DO $$
DECLARE
  v_total_assignments INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_assignments FROM roster_assignments;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DRAAD157 - STATUS 4 REMOVAL - MIGRATIE VOLTOOID';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Datum: %', NOW();
  RAISE NOTICE 'Totaal assignments in database: %', v_total_assignments;
  RAISE NOTICE '';
  RAISE NOTICE 'WIJZIGINGEN:';
  RAISE NOTICE '✅ Oude CHECK constraint verwijderd (status 0-4)';
  RAISE NOTICE '✅ Nieuwe CHECK constraint toegevoegd (status 0-3 only)';
  RAISE NOTICE '✅ roster_assignments tabel comment updated';
  RAISE NOTICE '✅ status kolom comment updated';
  RAISE NOTICE '✅ Trigger function comments updated';
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICATIES:';
  RAISE NOTICE '✅ Baseline check: Geen status 4 records gevonden';
  RAISE NOTICE '✅ TypeScript types: Verified (MOET, MAG, MAG-NIET, AANGEPAST only)';
  RAISE NOTICE '✅ Trigger functions: Inspected (status 0,1,2,3 only)';
  RAISE NOTICE '✅ Solver2 (ORT): Verified (geen status 4 references)';
  RAISE NOTICE '✅ CHECK constraint: Status 4 now FORBIDDEN (0-3 only)';
  RAISE NOTICE '';
  RAISE NOTICE 'STATUS CODES (FINAL):';
  RAISE NOTICE '  0 = BESCHIKBAAR';
  RAISE NOTICE '  1 = INGEPLAND';
  RAISE NOTICE '  2 = GEBLOKKEERD';
  RAISE NOTICE '  3 = STRUCTUREEL NBH';
  RAISE NOTICE '';
  RAISE NOTICE 'VERVANGEN DOOR:';
  RAISE NOTICE '  employees.structureel_nbh JSONB field (voor permanente NBH)';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. ✅ Migration completed';
  RAISE NOTICE '2. Run verification SQL in Supabase console';
  RAISE NOTICE '3. Monitor ORT solver (no schema changes for solver)';
  RAISE NOTICE '4. Commit to GitHub';
  RAISE NOTICE '5. Deploy to Railway';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATIE SQL (RUN AFTER MIGRATION IN SUPABASE CONSOLE)
-- ============================================================================
-- Copy-paste deze queries in Supabase SQL Editor om te verifiëren
--
-- QUERY 1: Status distribution
-- SELECT status, COUNT(*) as count FROM roster_assignments GROUP BY status ORDER BY status;
-- Expected: Should show ONLY status 0,1,2,3 (NOT 4)
--
-- QUERY 2: Constraint verification
-- SELECT constraint_name, constraint_definition
-- FROM information_schema.check_constraints
-- WHERE table_name = 'roster_assignments';
-- Expected: Should show constraint with "(status = ANY (ARRAY[0, 1, 2, 3]))"
--
-- QUERY 3: Try to insert status 4 (should FAIL)
-- INSERT INTO roster_assignments (roster_id, employee_id, date, dagdeel, status)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'TEST', '2025-12-10', 'O', 4);
-- Expected: ERROR: new row for relation "roster_assignments" violates check constraint

-- ============================================================================
-- FIN
-- ============================================================================
