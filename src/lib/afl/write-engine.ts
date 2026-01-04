/**
 * AFL (Autofill) - Phase 4: Database Writer Engine
 * 
 * Writes all modified planning slots from Fase 2+3 back to PostgreSQL via Supabase.
 * 
 * Strategy:
 * - Updates ONLY (no INSERT/DELETE)
 * - Batch operations for performance
 * - Atomic transaction semantics (use RPC or single update per rosterId)
 * - Full run tracking via ort_run_id / afl_run_id
 * - Comprehensive error handling
 * 
 * Performance target: 500-700ms
 * 
 * [DRAAD369] UPDATE: Now includes roster_period_staffing_dagdelen_id lookup
 * [DRAAD403B] FOUT 2 & 3 FIXES: Variant ID lookup + invulling update
 * [DRAAD403B] DEPLOYMENT FIX: Type safety for undefined team field
 */

import { createClient } from '@supabase/supabase-js';
import { WorkbestandPlanning } from './types';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Update payload for a single assignment
 * Compact representation of changes to persist
 */
interface AssignmentUpdatePayload {
  id: string; // roster_assignments.id (PK for WHERE clause)
  status?: 0 | 1 | 2 | 3;
  service_id?: string | null;
  source?: 'autofill' | 'manual' | 'pre_planning';
  blocked_by_date?: string | null; // ISO date string
  blocked_by_dagdeel?: string | null;
  blocked_by_service_id?: string | null;
  constraint_reason?: Record<string, unknown> | null;
  previous_service_id?: string | null;
  roster_period_staffing_dagdelen_id?: string | null; // [DRAAD369] NEW!
}

/**
 * Staffing record for variant ID lookup
 * [DRAAD403B FOUT 2] Used to find the demand record
 */
interface StaffingRecord {
  id: string; // roster_period_staffing_dagdelen.id
  invulling: number; // Current invulling count
  aantal: number; // Required count
}

/**
 * Write Engine Result
 * Returned after Phase 4 database writes
 */
export interface WriteEngineResult {
  success: boolean;
  afl_run_id: string; // UUID for run tracking
  rosterId: string;
  updated_count: number; // How many roster_assignments records updated
  rooster_status_updated: boolean; // Did we update rooster.status?
  database_write_ms: number;
  invulling_updates_count: number; // [DRAAD403B FOUT 3] How many invulling records updated
  error?: string | null;
}

/**
 * Main Database Writer Class
 */
export class WriteEngine {
  /**
   * Write all modified planning slots to database
   * 
   * Performs:
   * 1. Collect modified records from workbestand_planning
   * 2. Build update payloads with variant ID lookup (FOUT 2 FIX)
   * 3. Batch UPDATE to roster_assignments (via Supabase)
   * 4. Batch UPDATE to roster_period_staffing_dagdelen (FOUT 3 FIX)
   * 5. UPDATE rooster status to 'in_progress'
   * 6. Track run via afl_run_id / ort_run_id
   * 
   * [DRAAD369] Now includes variant ID lookups
   * [DRAAD403B] Now includes invulling updates
   * [DRAAD403B] DEPLOYMENT FIX: Type safety for undefined fields
   */
  async writeModifiedSlots(
    rosterId: string,
    workbestand_planning: WorkbestandPlanning[]
  ): Promise<WriteEngineResult> {
    const startTime = performance.now();
    const afl_run_id = randomUUID();

    try {
      // Step 1: Collect modified records
      const modified_slots = workbestand_planning.filter((slot) => slot.is_modified);

      if (modified_slots.length === 0) {
        // No changes - still update rooster status
        await this.updateRosterStatus(rosterId, afl_run_id);
        const database_write_ms = performance.now() - startTime;
        return {
          success: true,
          afl_run_id,
          rosterId,
          updated_count: 0,
          rooster_status_updated: true,
          database_write_ms,
          invulling_updates_count: 0,
          error: null,
        };
      }

      // Step 2: Build update payloads with variant ID lookups
      // [DRAAD403B FOUT 2] FIX: Lookup variant IDs before building payloads
      const update_payloads = await this.buildUpdatePayloadsWithVariantIds(
        modified_slots,
        afl_run_id,
        rosterId
      );

      // Step 3: Batch UPDATE roster_assignments
      const updated_count = await this.batchUpdateAssignments(
        rosterId,
        update_payloads,
        afl_run_id
      );

      // Step 4: [DRAAD403B FOUT 3] Update invulling counters
      const invulling_updates_count = await this.updateInvullingCounters(
        modified_slots,
        rosterId
      );

      // Step 5: UPDATE rooster status
      const rooster_updated = await this.updateRosterStatus(rosterId, afl_run_id);

      const database_write_ms = performance.now() - startTime;

      return {
        success: true,
        afl_run_id,
        rosterId,
        updated_count,
        rooster_status_updated: rooster_updated,
        database_write_ms,
        invulling_updates_count,
        error: null,
      };
    } catch (error) {
      const database_write_ms = performance.now() - startTime;
      const error_message = error instanceof Error ? error.message : String(error);

      console.error('[WriteEngine] Error writing to database:', error_message);

      return {
        success: false,
        afl_run_id,
        rosterId,
        updated_count: 0,
        rooster_status_updated: false,
        database_write_ms,
        invulling_updates_count: 0,
        error: error_message,
      };
    }
  }

  /**
   * [DRAAD403B FOUT 3] NEW: Update invulling counters
   * 
   * After assignments are made, increment the invulling counter
   * for the corresponding roster_period_staffing_dagdelen record
   * 
   * Process:
   * 1. Collect all unique staffing record IDs that got assigned
   * 2. For each record, count how many assignments point to it
   * 3. UPDATE invulling = invulling + count
   */
  private async updateInvullingCounters(
    modified_slots: WorkbestandPlanning[],
    rosterId: string
  ): Promise<number> {
    const invulling_updates_count = 0;

    try {
      // Group assignments by their variant ID
      const variant_counts: Map<string, number> = new Map();

      for (const slot of modified_slots) {
        // Only count successful assignments (status=1)
        if (slot.status !== 1 || !slot.service_id) {
          continue;
        }

        // Lookup variant ID
        const dateStr = slot.date instanceof Date
          ? slot.date.toISOString().split('T')[0]
          : slot.date;

        // [DRAAD403B DEPLOYMENT FIX] Type-safe team handling
        const team = slot.team || 'default';

        const variantId = await this.getVariantId(
          rosterId,
          dateStr,
          slot.dagdeel,
          slot.service_id,
          team
        );

        if (variantId) {
          variant_counts.set(
            variantId,
            (variant_counts.get(variantId) || 0) + 1
          );
        }
      }

      // Update each variant's invulling counter
      const update_promises = Array.from(variant_counts.entries()).map(
        async ([variantId, count]) => {
          try {
            const { data, error } = await supabase
              .from('roster_period_staffing_dagdelen')
              .select('invulling')
              .eq('id', variantId)
              .single();

            if (error || !data) {
              console.warn(
                `[DRAAD403B FOUT 3] Failed to read invulling for ${variantId}:`,
                error?.message
              );
              return 0;
            }

            // UPDATE invulling += count
            const new_invulling = (data.invulling || 0) + count;
            const { error: updateError } = await supabase
              .from('roster_period_staffing_dagdelen')
              .update({ invulling: new_invulling })
              .eq('id', variantId);

            if (updateError) {
              console.warn(
                `[DRAAD403B FOUT 3] Failed to update invulling for ${variantId}:`,
                updateError.message
              );
              return 0;
            }

            console.log(
              `[DRAAD403B FOUT 3] Updated invulling for ${variantId}: +${count} (new total: ${new_invulling})`
            );
            return 1;
          } catch (err) {
            console.warn(
              `[DRAAD403B FOUT 3] Exception updating invulling for ${variantId}:`,
              err
            );
            return 0;
          }
        }
      );

      const results = await Promise.allSettled(update_promises);
      const successful_updates = results.reduce((sum, result) => {
        if (result.status === 'fulfilled') {
          return sum + (result.value || 0);
        }
        return sum;
      }, 0);

      console.log(
        `[DRAAD403B FOUT 3] Completed invulling updates: ${successful_updates}/${variant_counts.size} staffing records`
      );

      return successful_updates;
    } catch (error) {
      console.error(
        '[DRAAD403B FOUT 3] Critical error in updateInvullingCounters:',
        error instanceof Error ? error.message : String(error)
      );
      return 0;
    }
  }

  /**
   * [DRAAD403B FOUT 2] HELPER: Lookup variant ID from database
   * 
   * Matches roster_period_staffing_dagdelen record by:
   * - roster_id
   * - date
   * - dagdeel
   * - service_id
   * - team
   */
  private async getVariantId(
    rosterId: string,
    date: string,
    dagdeel: string,
    serviceId: string,
    team: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('id')
        .eq('roster_id', rosterId)
        .eq('date', date)
        .eq('dagdeel', dagdeel)
        .eq('service_id', serviceId)
        .eq('team', team)
        .single();

      if (error) {
        console.warn('[DRAAD403B FOUT 2] Variant ID lookup failed:', {
          rosterId,
          date,
          dagdeel,
          serviceId,
          team,
          error: error.message,
        });
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.warn('[DRAAD403B FOUT 2] Variant ID lookup exception:', err);
      return null;
    }
  }

  /**
   * [DRAAD403B FOUT 2] Build update payloads with variant ID resolution
   * [DRAAD403B DEPLOYMENT FIX] Type-safe undefined field handling
   * 
   * For each modified slot:
   * 1. Lookup variant ID via getVariantId()
   * 2. Warn if not found (non-blocking)
   * 3. Include variant_id in payload
   */
  private async buildUpdatePayloadsWithVariantIds(
    modified_slots: WorkbestandPlanning[],
    afl_run_id: string,
    rosterId: string
  ): Promise<AssignmentUpdatePayload[]> {
    const payloads: AssignmentUpdatePayload[] = [];

    for (const slot of modified_slots) {
      // Extract required fields for variant lookup
      const dateStr = slot.date instanceof Date 
        ? slot.date.toISOString().split('T')[0]
        : slot.date;

      // [DRAAD403B DEPLOYMENT FIX] Type-safe team handling with null-coalescing
      const team = slot.team || 'default';

      // Lookup variant ID [DRAAD403B FOUT 2]
      let variantId: string | null = null;
      if (slot.service_id) {
        variantId = await this.getVariantId(
          rosterId,
          dateStr,
          slot.dagdeel,
          slot.service_id,
          team
        );
      }

      if (!variantId && slot.status === 1 && slot.service_id) {
        console.warn(
          '[DRAAD403B FOUT 2] No variant ID found for assignment',
          {
            employee: slot.employee_id,
            date: dateStr,
            dagdeel: slot.dagdeel,
            service_id: slot.service_id,
            team: team,
          }
        );
      }

      const payload: AssignmentUpdatePayload = {
        id: slot.id,
        status: slot.status,
        service_id: slot.service_id || null,
        source: 'autofill',
        blocked_by_date: slot.blocked_by_date
          ? (slot.blocked_by_date instanceof Date
              ? slot.blocked_by_date.toISOString().split('T')[0]
              : slot.blocked_by_date)
          : null,
        blocked_by_dagdeel: slot.blocked_by_dagdeel || null,
        blocked_by_service_id: slot.blocked_by_service_id || null,
        constraint_reason: slot.constraint_reason || null,
        previous_service_id: slot.previous_service_id || null,
        roster_period_staffing_dagdelen_id: variantId, // [DRAAD403B FOUT 2] FIX!
      };

      payloads.push(payload);
    }

    console.log(
      `[DRAAD403B FOUT 2] Built ${payloads.length} update payloads with variant IDs`
    );
    return payloads;
  }

  /**
   * Batch UPDATE roster_assignments records
   * 
   * Strategy:
   * - Collect all IDs and payloads
   * - Use Supabase batch update pattern
   * - For each record, UPDATE matching fields
   * - Include ort_run_id for tracking
   * 
   * Note: Supabase doesn't natively support complex batch updates with per-record payloads.
   * We'll use individual updates in parallel (Promise.all) for better atomicity perception.
   */
  private async batchUpdateAssignments(
    rosterId: string,
    update_payloads: AssignmentUpdatePayload[],
    afl_run_id: string
  ): Promise<number> {
    if (update_payloads.length === 0) return 0;

    let updated_count = 0;

    // Split into chunks to avoid payload size issues
    const chunk_size = 50;
    for (let i = 0; i < update_payloads.length; i += chunk_size) {
      const chunk = update_payloads.slice(i, i + chunk_size);
      const chunk_ids = chunk.map((p) => p.id);

      // Update all records in this chunk in parallel
      const update_promises = chunk.map((payload) =>
        this.updateSingleAssignment(payload, afl_run_id)
      );

      const results = await Promise.allSettled(update_promises);

      // Count successful updates
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          updated_count++;
        } else if (result.status === 'rejected') {
          console.warn(
            '[WriteEngine] Failed to update assignment:',
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          );
        }
      }
    }

    return updated_count;
  }

  /**
   * Update a single roster_assignments record
   * [DRAAD403B FOUT 2] Now includes roster_period_staffing_dagdelen_id
   */
  private async updateSingleAssignment(
    payload: AssignmentUpdatePayload,
    afl_run_id: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('roster_assignments')
      .update({
        status: payload.status,
        service_id: payload.service_id,
        source: payload.source,
        blocked_by_date: payload.blocked_by_date,
        blocked_by_dagdeel: payload.blocked_by_dagdeel,
        blocked_by_service_id: payload.blocked_by_service_id,
        constraint_reason: payload.constraint_reason,
        previous_service_id: payload.previous_service_id,
        roster_period_staffing_dagdelen_id: payload.roster_period_staffing_dagdelen_id, // [DRAAD403B FOUT 2] NEW!
        ort_run_id: afl_run_id, // Use ort_run_id for tracking
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id);

    if (error) {
      throw new Error(
        `[DRAAD403B FOUT 2] Failed to update assignment ${payload.id}: ${error.message}`
      );
    }

    return true;
  }

  /**
   * Update rooster status to indicate AFL has processed it
   * Status: 'draft' → 'in_progress'
   */
  private async updateRosterStatus(
    rosterId: string,
    afl_run_id: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rosterId);

    if (error) {
      console.error(
        '[WriteEngine] Failed to update rooster status:',
        error.message
      );
      return false;
    }

    return true;
  }
}

/**
 * Helper: Create singleton instance
 */
let writeEngine: WriteEngine | null = null;

export function getWriteEngine(): WriteEngine {
  if (!writeEngine) {
    writeEngine = new WriteEngine();
  }
  return writeEngine;
}

/**
 * Export the main write function for direct use
 */
export async function writeAflResultToDatabase(
  rosterId: string,
  workbestand_planning: WorkbestandPlanning[]
): Promise<WriteEngineResult> {
  const engine = getWriteEngine();
  return engine.writeModifiedSlots(rosterId, workbestand_planning);
}
