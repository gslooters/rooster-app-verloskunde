-- ============================================================
-- SIMPLE RPC TEST - Copy-paste in Supabase SQL Editor
-- ============================================================
-- Test of upsert_ort_assignments() werkt
-- 
-- INSTRUCTIES:
-- 1. Open Supabase → SQL Editor
-- 2. Copy-paste deze HELE file
-- 3. Klik "RUN"
-- 4. Kijk naar resultaat:
--    - success = true  → RPC WERKT! ✅
--    - success = false → RPC FAALT ❌ (zie error_message)

-- TEST met MINIMALE data (1 assignment)
SELECT * FROM upsert_ort_assignments(
  '[
    {
      "roster_id": "00000000-0000-0000-0000-000000000001",
      "employee_id": "TEST_EMP",
      "date": "2025-12-15",
      "dagdeel": "O",
      "service_id": "00000000-0000-0000-0000-000000000002",
      "status": 0,
      "source": "ort",
      "notes": "TEST",
      "ort_confidence": 0.9,
      "ort_run_id": "00000000-0000-0000-0000-000000000003",
      "constraint_reason": {"test": true},
      "previous_service_id": null,
      "created_at": "2025-12-08T17:00:00Z"
    }
  ]'::jsonb
);

-- ============================================================
-- VERWACHT RESULTAAT:
-- ============================================================
-- Als ALLES WERKT:
--   success | inserted_count | error_message
--   --------|----------------|---------------
--   true    | 1              | null
--
-- Als FOREIGN KEY FOUT (roster niet bestaat):
--   success | inserted_count | error_message
--   --------|----------------|---------------
--   false   | 0              | "foreign key violation..."
--
-- Dit is NORMAAL! Het betekent RPC functie werkt, maar test data bestaat niet.
-- De echte ORT run gebruikt ECHTE roster_id's die WEL bestaan.

-- ============================================================
-- CLEANUP na test (optioneel)
-- ============================================================
-- DELETE FROM roster_assignments 
-- WHERE employee_id = 'TEST_EMP';
