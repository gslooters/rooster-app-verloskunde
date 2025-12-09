/**
 * DRAAD149B: Deduplication Key with Service ID
 * Fix: Include service_id in dedup key to prevent duplicate conflict
 * 
 * ROOT CAUSE:
 * Solver returns assignments with same (roster_id, employee_id, date, dagdeel)
 * but different service_id values. Original dedup key was incomplete.
 * 
 * SOLUTION:
 * Add service_id to dedup key so different services in same slot stay separate.
 * This prevents UPSERT from trying to update the same row twice.
 * 
 * AFFECTED:
 * - logDuplicates() function: Line 73-74
 * - deduplicateAssignments() function: Line 205-206
 */
export const CACHE_BUST_DRAAD149B = {
  version: 'DRAAD149B_DEDUP_WITH_SERVICE_ID',
  timestamp: Date.now(),
  random: Math.floor(Math.random() * 100000),
  cacheBustId: `DRAAD149B-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  description: 'Include service_id in deduplication key',
  fix: 'Prevent duplicate assignments with same slot but different service',
  impact: 'UPSERT now handles multiple services per slot correctly',
  changes: [
    'logDuplicates: key now includes service_id',
    'deduplicateAssignments: key now includes service_id'
  ]
} as const;
