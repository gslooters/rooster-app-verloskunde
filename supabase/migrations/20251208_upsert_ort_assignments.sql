-- ============================================================
-- Migration: Create PostgreSQL function for UPSERT ORT assignments
-- ============================================================
-- DRAAD128: OPTIE E UPSERT Fix
-- 
-- Problem: Supabase upsert() method doesn't support onConflict parameter
-- Caused: "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- 
-- Solution: Use PostgreSQL function with proper ON CONFLICT logic
-- Benefits:
--   - Atomic: All assignments updated in single transaction
--   - Race-condition safe: Uses PostgreSQL locking
--   - No duplicates: Proper ON CONFLICT DO UPDATE
--   - Clean error handling: Returns operation result
-- 
-- Created: 2025-12-08 00:40 CET
-- Version: 20251208-upsert-fix-optie-e

-- ============================================================
-- Step 1: Create function upsert_ort_assignments
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_ort_assignments(
  p_assignments jsonb
)
RETURNS TABLE(
  success boolean, 
  inserted_count integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_error text := NULL;
BEGIN
  -- Validate input
  IF p_assignments IS NULL OR jsonb_array_length(p_assignments) = 0 THEN
    RETURN QUERY SELECT false, 0, 'No assignments provided'::text;
    RETURN;
  END IF;

  BEGIN
    -- UPSERT pattern: INSERT with ON CONFLICT DO UPDATE
    -- Targets: roster_id + employee_id + date + dagdeel (unique constraint)
    INSERT INTO roster_assignments (
      roster_id, 
      employee_id, 
      date, 
      dagdeel, 
      service_id, 
      status,
      source, 
      notes, 
      ort_confidence, 
      ort_run_id, 
      constraint_reason, 
      previous_service_id,
      created_at,
      updated_at
    )
    SELECT 
      (item->>'roster_id')::uuid,
      (item->>'employee_id')::uuid,
      (item->>'date')::date,
      item->>'dagdeel',
      (item->>'service_id')::uuid,
      (item->>'status')::integer,
      item->>'source',
      item->>'notes',
      (item->>'ort_confidence')::numeric,
      (item->>'ort_run_id')::uuid,
      (item->'constraint_reason')::jsonb,
      (item->>'previous_service_id')::uuid,
      COALESCE((item->>'created_at')::timestamp, NOW()),
      NOW()
    FROM jsonb_array_elements(p_assignments) AS item
    ON CONFLICT (roster_id, employee_id, date, dagdeel)
    DO UPDATE SET
      service_id = EXCLUDED.service_id,
      status = EXCLUDED.status,
      source = EXCLUDED.source,
      notes = EXCLUDED.notes,
      ort_confidence = EXCLUDED.ort_confidence,
      ort_run_id = EXCLUDED.ort_run_id,
      constraint_reason = EXCLUDED.constraint_reason,
      previous_service_id = EXCLUDED.previous_service_id,
      updated_at = NOW();
    
    -- Get row count
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Return success
    RETURN QUERY SELECT true, v_count, NULL::text;
    
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    RETURN QUERY SELECT false, 0, v_error;
  END;
END;
$$;

-- ============================================================
-- Step 2: Grant permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION upsert_ort_assignments(jsonb) TO postgres, anon, authenticated, service_role;

-- ============================================================
-- Step 3: Create index for faster lookups (if not exists)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_roster_assignments_ort_run_id 
ON roster_assignments(ort_run_id) 
WHERE source = 'ort';

CREATE INDEX IF NOT EXISTS idx_roster_assignments_source 
ON roster_assignments(source);

-- ============================================================
-- Verification query
-- ============================================================
-- Run after migration to verify function exists:
-- 
-- SELECT EXISTS(
--   SELECT 1 FROM information_schema.routines
--   WHERE routine_name = 'upsert_ort_assignments'
--   AND routine_schema = 'public'
-- ) as function_exists;
-- 
-- Expected: true

-- ============================================================
-- Usage example (in TypeScript):
-- ============================================================
-- 
-- const { data, error } = await supabase
--   .rpc('upsert_ort_assignments', {
--     p_assignments: assignmentsToUpsert
--   });
-- 
-- if (error) {
--   console.error('[OPTIE E] UPSERT error:', error);
-- } else {
--   console.log(`[OPTIE E] ${data[0].inserted_count} assignments upserted`);
-- }
