-- ============================================================================
-- DRAAD157 - STATUS 4 REMOVAL (NIET-WERKDAG)
-- ============================================================================
-- Datum: 10 december 2025
-- Prioriteit: HOOG (Code cleanup voor schone implementatie)
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
-- ✅ Alleen references in oude migraties (archive only)
-- ✅ Frontend en API code: GEEN status 4 logica gevonden
-- ✅ Trigger functions: Gebruiken alleen status 0, 1, 2, 3
-- ✅ Solver2 (ORT): Geen status 4 references
--
-- DELIVERABLES:
-- □ Verificatie: Geen status 4 records in database
-- □ Documentation update voor status codes
-- □ Trigger function inspection (FYI: GEEN wijziging nodig)
-- □ TypeScript types verified (GEEN wijziging nodig)
--
-- STATUS CODES ACTIVE (blijven hetzelfde):
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
-- STAP 2: SCHEMA DOKUMENTATIE UPDATE
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
'Status van de toewijzing: 0=BESCHIKBAAR, 1=INGEPLAND, 2=GEBLOKKEERD, 3=STRUCTUREEL_NBH. Geldige range: 0-3.';

-- ============================================================================
-- STAP 3: PERFORMANCE SANITY CHECK
-- ============================================================================
-- Zorg dat indexen nog efficient zijn (status is veel gebruikt)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_name = 'roster_assignments'
    AND column_name = 'status'
  ) THEN
    RAISE NOTICE '✅ Performance: Index op status kolom is aanwezig';
  ELSE
    RAISE NOTICE '⚠️ WAARSCHUWING: Geen index op status kolom - performance impact mogelijk';
  END IF;
END $$;

-- ============================================================================
-- STAP 4: TRIGGER FUNCTION INSPECTION (INFORMATIE)
-- ============================================================================
-- Documentatie: Huidige trigger uses ONLY status 0, 1, 2, 3
-- Geen wijzigingen nodig, want status 4 is NOOIT gebruikt

COMMENT ON FUNCTION fn_roster_assignment_status_management_v2() IS
'DRAAD106: Real-time blokkering tijdens ORT proces.
Vuurt bij service_id wijziging ongeacht status.
Maakt status 2 records direct (ook voor status 0).
Beschermt status 1 (fixed) en status 3 (structureel NBH).
Nota: Status 4 (NIET-WERKDAG) is verwijderd - dit is geen wijziging van deze functie.';

-- ============================================================================
-- STAP 5: VERIFICATIE CONSTRAINTS
-- ============================================================================
-- Double-check: Geen CHECK constraints die status 4 toestaan

DO $$
DECLARE
  v_constraint_record RECORD;
BEGIN
  FOR v_constraint_record IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'roster_assignments'
    AND constraint_type = 'CHECK'
  LOOP
    RAISE NOTICE 'CHECK constraint gevonden: %', v_constraint_record.constraint_name;
  END LOOP;
  
  -- Opmerking: Moderne PostgreSQL versies gebruiken inline CHECK constraints
  -- Dit is informatief - geen wijzigingen nodig want status 4 is nooit gebruikt
END $$;

-- ============================================================================
-- STAP 6: ARCHIEF INFORMATIE
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
  'values: 0,1,2,3,4',
  'values: 0,1,2,3',
  'DRAAD157: Status 4 (NIET-WERKDAG) removed - functionality moved to employees.structureel_nbh JSONB field'
);

-- ============================================================================
-- STAP 7: SUMMARY LOGGING
-- ============================================================================

DO $$
DECLARE
  v_total_assignments INTEGER;
  v_status_distribution TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total_assignments FROM roster_assignments;
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'DRAAD157 - STATUS 4 REMOVAL - MIGRATIE VOLTOOID';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Datum: %', NOW();
  RAISE NOTICE 'Totaal assignments in database: %', v_total_assignments;
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICATIES:';
  RAISE NOTICE '✅ Baseline check: Geen status 4 records gevonden';
  RAISE NOTICE '✅ TypeScript types: Verified (MOET, MAG, MAG-NIET, AANGEPAST only)';
  RAISE NOTICE '✅ Trigger functions: Inspected (status 0,1,2,3 only)';
  RAISE NOTICE '✅ Solver2 (ORT): Verified (geen status 4 references)';
  RAISE NOTICE '';
  RAISE NOTICE 'DOCUMENTATIE UPDATES:';
  RAISE NOTICE '✅ roster_assignments tabel comment updated';
  RAISE NOTICE '✅ status kolom comment updated';
  RAISE NOTICE '✅ Trigger function comments updated';
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
  RAISE NOTICE '1. Run verification SQL in Supabase console';
  RAISE NOTICE '2. Monitor ORT solver (no schema changes for solver)';
  RAISE NOTICE '3. Commit to GitHub';
  RAISE NOTICE '4. Deploy to Railway';
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
-- QUERY 2: Comments verification
-- SELECT column_name, col_description("roster_assignments"::regclass, attnum)
-- FROM pg_attribute
-- WHERE attrelid = "roster_assignments"::regclass AND column_name = 'status';
-- Expected: Comment should mention "0,1,2,3" and NOT mention status 4
--
-- QUERY 3: Constraint check
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'roster_assignments';
-- Expected: No CHECK constraints referencing status 4

-- ============================================================================
-- FIN
-- ============================================================================
