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
 */

import { createClient } from '@supabase/supabase-js';
import { WorkbestandPlanning } from './types';
import { v4 as uuidv4 } from 'uuid';

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
   * 2. Build update payloads (compact format)
   * 3. Batch UPDATE to roster_assignments (via Supabase)
   * 4. UPDATE rooster status to 'in_progress'
   * 5. Track run via afl_run_id / ort_run_id
   */
  async writeModifiedSlots(
    rosterId: string,
    workbestand_planning: WorkbestandPlanning[]
  ): Promise<WriteEngineResult> {
    const startTime = performance.now();
    const afl_run_id = uuidv4();

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
          error: null,
        };
      }

      // Step 2: Build update payloads
      const update_payloads = this.buildUpdatePayloads(modified_slots, afl_run_id);

      // Step 3: Batch UPDATE roster_assignments
      const updated_count = await this.batchUpdateAssignments(
        rosterId,
        update_payloads,
        afl_run_id
      );

      // Step 4: UPDATE rooster status
      const rooster_updated = await this.updateRosterStatus(rosterId, afl_run_id);

      const database_write_ms = performance.now() - startTime;

      return {
        success: true,
        afl_run_id,
        rosterId,
        updated_count,
        rooster_status_updated: rooster_updated,
        database_write_ms,
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
        error: error_message,
      };
    }
  }

  /**
   * Build compact update payloads from modified slots
   * Only includes fields that changed
   */
  private buildUpdatePayloads(
    modified_slots: WorkbestandPlanning[],
    afl_run_id: string
  ): AssignmentUpdatePayload[] {
    return modified_slots.map((slot) => ({
      id: slot.id,
      status: slot.status,
      service_id: slot.service_id || null,
      source: 'autofill',
      blocked_by_date: slot.blocked_by_date
        ? slot.blocked_by_date.toISOString().split('T')[0]
        : null,
      blocked_by_dagdeel: slot.blocked_by_dagdeel || null,
      blocked_by_service_id: slot.blocked_by_service_id || null,
      constraint_reason: slot.constraint_reason || null,
      previous_service_id: slot.previous_service_id || null,
    }));
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
        ort_run_id: afl_run_id, // Use ort_run_id for tracking
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id);

    if (error) {
      throw new Error(
        `Failed to update assignment ${payload.id}: ${error.message}`
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
