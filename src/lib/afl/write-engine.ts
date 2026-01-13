/**
 * AFL (Autofill) - Phase 4: Database Writer Engine
 * 
 * Writes all modified planning slots from Fase 2+3 back to PostgreSQL via Supabase.
 * 
 * UPDATED [DRAAD414]: 
 * - KRITIEKE FIX: Verwijderd variant_id lookup - laat database trigger het werk doen
 * - roster_period_staffing_dagdelen_id wordt ALTIJD op null gezet
 * - Database trigger update invulling op basis van date/dagdeel/service_id (GEEN team)
 * - buildUpdatePayloads() is niet langer async (geen database lookups meer)
 * - Veel simpeler en robuuster design
 * 
 * PREVIOUS [DRAAD413] FOUT: 
 * - getVariantId() faalde door strict team matching
 * - System services hebben multiple team variants → .single() crashte
 * - Team mismatch gaf NULL variant_id → trigger vuurt niet
 * 
 * UPDATED [DRAAD407]: 
 * - Removed updateInvullingCounters() method (now in DirectWriteEngine)
 * - WriteEngine now handles ONLY roster_assignments updates
 * - All real-time per-assignment writes now go through DirectWriteEngine
 * - This module retained ONLY for updateRosterStatus() in finalize phase
 * 
 * Strategy:
 * - Updates ONLY to roster_assignments (no INSERT/DELETE)
 * - Batch operations for performance
 * - Full run tracking via ort_run_id / afl_run_id
 * - Comprehensive error handling
 * - Database trigger handles invulling updates automatically
 * 
 * Performance target: 300-500ms (improved from 500-700ms)
 * 
 * [DRAAD414] FIX: Simplified trigger-based invulling management
 * [DRAAD407] REFACTOR: Moved per-assignment writes to DirectWriteEngine
 * 
 * Cache-bust: ${Date.now()}
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
  roster_period_staffing_dagdelen_id?: string | null; // [DRAAD414] ALWAYS NULL - trigger handles invulling
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
 * [DRAAD414] SIMPLIFIED: No variant_id lookup - trigger-based invulling management
 * [DRAAD407] REFACTORED: Now handles only rooster_assignments batch updates
 */
export class WriteEngine {
  /**
   * Write all modified planning slots
   * [DRAAD414] SIMPLIFIED: Direct write without variant_id lookup
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
          error: null,
        };
      }

      console.log('[DRAAD414] AFL write starting - new trigger-based invulling pattern');
      console.log(`[DRAAD414] ${modified_slots.length} assignments will be updated`);
      console.log('[DRAAD414] Database trigger will automatically increment invulling counters');

      // Step 2: Build update payloads (NOW SYNC - no database lookups!)
      const update_payloads = this.buildUpdatePayloads(
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

      // Step 4: UPDATE rooster status
      const rooster_updated = await this.updateRosterStatus(rosterId, afl_run_id);

      const database_write_ms = performance.now() - startTime;

      console.log(`[DRAAD414] AFL write complete: ${updated_count} assignments updated`);
      console.log('[DRAAD414] Database trigger has updated invulling counters automatically');

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
   * Build update payloads for batch write
   * [DRAAD414] SIMPLIFIED: No async, no variant_id lookup - always set to null
   * Database trigger will handle invulling updates based on date/dagdeel/service_id
   */
  private buildUpdatePayloads(
    modified_slots: WorkbestandPlanning[],
    afl_run_id: string,
    rosterId: string
  ): AssignmentUpdatePayload[] {
    const payloads: AssignmentUpdatePayload[] = [];

    console.log(`[DRAAD414] Building payloads for ${modified_slots.length} modified slots...`);

    for (const slot of modified_slots) {
      // Extract date string
      const dateStr = slot.date instanceof Date 
        ? slot.date.toISOString().split('T')[0]
        : slot.date;

      // [DRAAD414] SIMPLIFIED: Always set variant_id to null
      // Database trigger will handle invulling updates based on date/dagdeel/service_id
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
        roster_period_staffing_dagdelen_id: null, // [DRAAD414] ✅ ALWAYS NULL - trigger handles it
      };

      payloads.push(payload);
    }

    console.log(`[DRAAD414] Built ${payloads.length} payloads (all with variant_id=null for trigger-based updates)`);

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
   * [DRAAD414] roster_period_staffing_dagdelen_id is always null - trigger handles invulling
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
        roster_period_staffing_dagdelen_id: payload.roster_period_staffing_dagdelen_id, // [DRAAD414] ✅ NULL
        ort_run_id: afl_run_id,
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
   * [DRAAD407] This method is still used by solve-engine finalize phase
   */
  async updateRosterStatus(
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
