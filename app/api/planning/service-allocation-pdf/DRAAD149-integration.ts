/**
 * DRAAD 149 INTEGRATION EXAMPLE
 * 
 * This shows how to integrate the assignment deduplicator into your
 * solver response handler.
 * 
 * Find where you have:
 *   const { error } = await supabase.from('roster_assignments').upsert(assignments)
 * 
 * And replace it with this pattern.
 */

import {
  prepareAssignmentsForInsert,
  logDeduplicationStats,
  type RosterAssignment,
} from '@/lib/utils/assignment-deduplicator';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Process solver assignments with deduplication and batching
 */
async function insertSolverAssignments(
  rosterId: string,
  assignments: RosterAssignment[]
): Promise<{ success: boolean; error?: Error; stats: any }> {
  try {
    // Step 1: Prepare assignments (deduplicate + batch)
    const stats = prepareAssignmentsForInsert(assignments, 150);
    logDeduplicationStats(stats);

    // Step 2: Delete existing assignments for this roster
    // (Important: BEFORE inserting new ones)
    const { error: deleteError } = await supabase
      .from('roster_assignments')
      .delete()
      .eq('roster_id', rosterId);

    if (deleteError) {
      console.error('[DRAAD149] Delete error:', deleteError);
      return { success: false, error: deleteError, stats };
    }

    // Step 3: Insert batches
    let totalInserted = 0;

    for (let batchIndex = 0; batchIndex < stats.batches.length; batchIndex++) {
      const batch = stats.batches[batchIndex];

      console.log(`[DRAAD149] Inserting batch ${batchIndex + 1}/${stats.batchCount} (${batch.length} assignments)`);

      const { error: upsertError, data } = await supabase
        .from('roster_assignments')
        .upsert(batch, {
          onConflict: 'roster_slot_id,employee_id',
        });

      if (upsertError) {
        console.error(`[DRAAD149] Batch ${batchIndex} failed:`, upsertError);
        return {
          success: false,
          error: new Error(`Batch ${batchIndex} insert failed: ${upsertError.message}`),
          stats: { ...stats, failedAtBatch: batchIndex },
        };
      }

      totalInserted += batch.length;
      console.log(`[DRAAD149] Batch ${batchIndex + 1} completed. Total inserted: ${totalInserted}`);
    }

    // Step 4: Verify
    const { count: finalCount } = await supabase
      .from('roster_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('roster_id', rosterId);

    console.log(`[DRAAD149] Final verification: ${finalCount} assignments in roster ${rosterId}`);

    return {
      success: true,
      stats: {
        ...stats,
        totalInserted,
        finalCount,
      },
    };
  } catch (error) {
    console.error('[DRAAD149] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      stats: null,
    };
  }
}

/**
 * Example usage in your solver endpoint:
 * 
 * POST /api/planning/service-allocation-pdf
 * 
 * export async function POST(request: Request) {
 *   try {
 *     // Call solver
 *     const solverResponse = await callSolverAPI(...);
 *     const assignments = solverResponse.assignments;
 *     
 *     // Use DRAAD149 fix
 *     const result = await insertSolverAssignments(rosterId, assignments);
 *     
 *     if (!result.success) {
 *       return Response.json({
 *         error: result.error?.message,
 *         stats: result.stats,
 *       }, { status: 500 });
 *     }
 *     
 *     return Response.json({
 *       success: true,
 *       message: `Successfully inserted ${result.stats.totalInserted} assignments`,
 *       stats: result.stats,
 *     });
 *   } catch (error) {
 *     return Response.json({ error: String(error) }, { status: 500 });
 *   }
 * }
 */

export { insertSolverAssignments };
