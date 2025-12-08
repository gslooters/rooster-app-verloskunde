-- DRAAD129-STAP3 FIXED: Upsert ORT assignments with VALUES clause
-- 
-- PROBLEM: CREATE TEMP TABLE causes "relation already exists" in batched calls
-- PostgreSQL temp tables are session-scoped and persist between function calls
-- When processing batch N after batch N-1, CREATE TEMP fails
--
-- SOLUTION: Use VALUES clause with DISTINCT ON
-- - No temp table creation
-- - Deduplication at source  
-- - Batch-safe (no session state)
-- - Still fully atomic transaction
-- - Same deduplication logic

CREATE OR REPLACE FUNCTION public.upsert_ort_assignments(
  p_assignments jsonb
)
RETURNS TABLE (success boolean, message text, count_processed integer) AS $$
DECLARE
  v_count integer;
  v_error text;
BEGIN
  -- DRAAD129-STAP3-FIXED: Convert JSONB array to deduplicated rows
  -- Using VALUES with DISTINCT ON to deduplicate by composite key
  -- (roster_id, employee_id, date, dagdeel) - keeping last occurrence
  
  INSERT INTO roster_assignments (
    roster_id, employee_id, date, dagdeel, service_id, status,
    source, notes, ort_confidence, ort_run_id, constraint_reason,
    previous_service_id, created_at, updated_at
  )
  SELECT DISTINCT ON (roster_id, employee_id, date, dagdeel)
    (item->>'roster_id')::uuid as roster_id,
    item->>'employee_id' as employee_id,
    (item->>'date')::date as date,
    item->>'dagdeel' as dagdeel,
    (item->>'service_id')::uuid as service_id,
    (item->>'status')::integer as status,
    item->>'source' as source,
    item->>'notes' as notes,
    (item->>'ort_confidence')::numeric as ort_confidence,
    (item->>'ort_run_id')::uuid as ort_run_id,
    item->'constraint_reason' as constraint_reason,
    (item->>'previous_service_id')::uuid as previous_service_id,
    now() as created_at,
    now() as updated_at
  FROM jsonb_array_elements(p_assignments) as item
  ORDER BY roster_id, employee_id, date, dagdeel,
           (item->>'created_at') DESC NULLS LAST
  ON CONFLICT (roster_id, employee_id, date, dagdeel) DO UPDATE SET
    service_id = EXCLUDED.service_id,
    status = EXCLUDED.status,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes,
    ort_confidence = EXCLUDED.ort_confidence,
    ort_run_id = EXCLUDED.ort_run_id,
    constraint_reason = EXCLUDED.constraint_reason,
    previous_service_id = EXCLUDED.previous_service_id,
    updated_at = EXCLUDED.updated_at;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Success response
  RETURN QUERY SELECT true, 'Upsert completed successfully'::text, v_count;
  
EXCEPTION WHEN OTHERS THEN
  -- Error response with detailed message
  GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  RETURN QUERY SELECT false, ('Error: ' || v_error)::text, 0;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment to track version
COMMENT ON FUNCTION public.upsert_ort_assignments(jsonb) IS 
'DRAAD129-STAP3-FIXED: Upsert OR-Tools assignments using VALUES with DISTINCT ON.
Fixed: Removed CREATE TEMP TABLE to avoid session conflicts in batched calls.
Uses direct DISTINCT ON in SELECT to deduplicate by composite key.
Combined with TypeScript deduplication (DRAAD127) and batch processing (DRAAD129-STAP2).';
