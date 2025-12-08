-- DRAAD129 STAP 3: Fix upsert_ort_assignments to handle duplicate assignments
-- 
-- PostgreSQL ON CONFLICT limitation:
-- If you INSERT with duplicate PRIMARY KEYs, PostgreSQL fails:
-- "cannot affect row a second time in same statement"
--
-- Solution: Use DISTINCT ON to deduplicate inside database
-- This is defense-in-depth with TypeScript deduplication (DRAAD127)
-- + Batch processing (DRAAD129-STAP2)

CREATE OR REPLACE FUNCTION public.upsert_ort_assignments(
  p_assignments jsonb
)
RETURNS TABLE (success boolean, message text, count_processed integer) AS $$
DECLARE
  v_count integer;
  v_error text;
BEGIN
  -- DRAAD129-STAP3: Step 1 - Deduplicate assignments using DISTINCT ON
  -- This ensures each (roster_id, employee_id, date, dagdeel) appears only once
  -- Keeps the LAST (most recent) occurrence based on created_at
  CREATE TEMP TABLE temp_assignments AS
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
           (item->>'created_at') DESC NULLS LAST;  -- Keep most recent
  
  -- DRAAD129-STAP3: Step 2 - UPSERT from deduplicated temp table
  -- Now safe because duplicate keys are eliminated
  INSERT INTO roster_assignments (
    roster_id, employee_id, date, dagdeel, service_id, status,
    source, notes, ort_confidence, ort_run_id, constraint_reason,
    previous_service_id, created_at, updated_at
  )
  SELECT * FROM temp_assignments
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
'DRAAD129-STAP3: Upsert OR-Tools assignments with duplicate handling.
Uses DISTINCT ON at database level to handle duplicate keys.
Combined with TypeScript deduplication (DRAAD127) and batch processing (DRAAD129-STAP2).';
