/**
 * DRAAD 149 FINAL FIX - COMPOSITE KEY DEDUPLICATION
 * 
 * This is the ACTUAL CODE CHANGE needed to fix the UPSERT error.
 * Insert this function into /app/api/v1/solve-schedule/route.ts
 * RIGHT BEFORE the batch UPSERT operation.
 * 
 * Error: "ON CONFLICT DO UPDATE command cannot affect row a second time"
 * Root Cause: Duplicate composite keys in batch INSERT
 * Solution: Deduplicate by (roster_id + employee_id + service_id + slot_date + slot_type)
 */

/**
 * COMPOSITE KEY DEDUPLICATION FUNCTION
 * 
 * The [FIX4] basic deduplication checks for OBJECT REFERENCE equality,
 * but MISSES COMPOSITE KEY duplicates.
 * 
 * This function ensures NO two assignments have the same composite key.
 * PostgreSQL UPSERT will then succeed because each unique key is updated only once.
 */
function deduplicateByCompositeKey(assignments: any[]): any[] {
  const keyMap = new Map<string, any>();
  
  for (const assignment of assignments) {
    // Build composite key from unique identifiers
    const key = [
      assignment.roster_id,
      assignment.employee_id,
      assignment.service_id,
      assignment.slot_date,
      assignment.slot_type  // morning, afternoon, night, etc.
    ].join('|');
    
    // Keep LAST occurrence - overwrites previous with same composite key
    // This is idempotent and safe for roster planning
    keyMap.set(key, assignment);
  }
  
  return Array.from(keyMap.values());
}

/**
 * USAGE IN route.ts:
 * ===================
 * 
 * Step 1: Extract assignments from solver (already done)
 * const assignments = extractedAssignments;  // 1137 items
 * 
 * Step 2: Run [FIX4] basic dedup (already done)
 * console.log('[FIX4] INPUT:', assignments.length);
 * 
 * Step 3: ADD THIS NEW DEDUP (THE FIX)
 * const deduplicatedAssignments = deduplicateByCompositeKey(assignments);
 * console.log('[DRAAD149] After composite key dedup:', deduplicatedAssignments.length);
 * 
 * Step 4: Batch UPSERT with deduplicatedAssignments (already done)
 * const result = await supabase
 *   .from('roster_assignments')
 *   .upsert(deduplicatedAssignments, {
 *     onConflict: 'roster_id,employee_id,service_id,slot_date,slot_type'
 *   })
 * 
 * EXPECTED OUTCOME:
 * ================
 * ✅ Assignments: 1137 → ~1135-1137 (zero-1 dupes removed)
 * ✅ Batch UPSERT: SUCCESS (no "cannot affect row a second time" error)
 * ✅ Dashboard: "Rooster generatie voltooid" ✓
 */

// Export for use in route.ts
export const DRAAD149_COMPOSITE_KEY_DEDUP = {
  functionCode: deduplicateByCompositeKey.toString(),
  
  explanation: `
    The PostgreSQL error "ON CONFLICT DO UPDATE command cannot affect row a second time" 
    occurs when the same composite key appears multiple times in a single UPSERT batch.
    
    Root Cause: Solver output contains assignments with identical composite keys:
    - Same roster_id
    - Same employee_id  
    - Same service_id
    - Same slot_date
    - Same slot_type
    
    But possibly different in other fields (e.g., shift notes).
    
    The [FIX4] deduplication checks object REFERENCE equality, not COMPOSITE KEY equality,
    so duplicate keys slip through into the batch.
    
    Solution: This function deduplicates by the 5-field composite key using a Map.
    Last-write-wins ensures we keep the most recent assignment for each slot.
  `,
  
  severity: 'CRITICAL',
  affectedArea: '/api/v1/solve-schedule POST endpoint',
  deploymentStatus: 'READY_FOR_IMPLEMENTATION',
  expectedImpact: 'Resolves "cannot affect row a second time" error permanently',
  testingNeeded: 'Run rooster generation with 13+ employees, 5+ weeks, complex constraints',
  
  deploymentDate: '2025-12-09T20:00:00Z'
};

/**
 * WHY THIS WASN'T CAUGHT BEFORE:
 * ===============================
 * 1. [FIX4] was checked with console.log('No duplicates found')
 * 2. [FIX4] ONLY checked OBJECT REFERENCE duplicates
 * 3. It NEVER checked COMPOSITE KEY duplicates
 * 4. The logs showed "CLEAN" but actually had hidden composite key dupes
 * 5. PostgreSQL batch UPSERT fails on the hidden dupes
 * 
 * LESSON LEARNED:
 * ===============
 * - Always deduplicate by the actual UNIQUE CONSTRAINT keys
 * - Not by object reference
 * - Especially in batch database operations with ON CONFLICT clauses
 */
