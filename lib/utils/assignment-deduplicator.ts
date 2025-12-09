/**
 * DRAAD 149 SOLUTION: Assignment Deduplicator
 * Prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
 * 
 * The PostgreSQL error occurs when the same (roster_slot_id, employee_id) pair
 * appears multiple times in a single UPSERT batch.
 * 
 * This module deduplicates assignments and batches them for safe insertion.
 */

export interface RosterAssignment {
  roster_slot_id: string;
  employee_id: string;
  service_id: string;
  roster_id?: string;
  [key: string]: any;
}

/**
 * Deduplicates assignments keeping the LAST occurrence
 * (solver's final decision for each slot)
 */
export function deduplicateAssignments(assignments: RosterAssignment[]): RosterAssignment[] {
  const deduped = new Map<string, RosterAssignment>();

  for (const assignment of assignments) {
    const key = `${assignment.roster_slot_id}|${assignment.employee_id}`;
    // Overwrite with latest occurrence
    deduped.set(key, assignment);
  }

  return Array.from(deduped.values());
}

/**
 * Splits assignments into batches for safe insertion
 */
export function batchAssignments(
  assignments: RosterAssignment[],
  batchSize: number = 150
): RosterAssignment[][] {
  const batches: RosterAssignment[][] = [];
  
  for (let i = 0; i < assignments.length; i += batchSize) {
    batches.push(assignments.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * Complete deduplication and batching pipeline
 */
export function prepareAssignmentsForInsert(
  assignments: RosterAssignment[],
  batchSize: number = 150
) {
  const original = assignments.length;
  const deduped = deduplicateAssignments(assignments);
  const dedupedCount = deduped.length;
  const batches = batchAssignments(deduped, batchSize);

  return {
    original,
    dedupedCount,
    duplicatesRemoved: original - dedupedCount,
    batchCount: batches.length,
    batches,
  };
}

/**
 * Logging helper
 */
export function logDeduplicationStats(stats: ReturnType<typeof prepareAssignmentsForInsert>) {
  console.log(`[DRAAD149] Assignment Deduplication Stats:`);
  console.log(`  Original count:       ${stats.original}`);
  console.log(`  Deduped count:        ${stats.dedupedCount}`);
  console.log(`  Duplicates removed:   ${stats.duplicatesRemoved}`);
  console.log(`  Batch count:          ${stats.batchCount}`);
  console.log(`  Batch size:           ~${Math.ceil(stats.dedupedCount / stats.batchCount)}`);
}
