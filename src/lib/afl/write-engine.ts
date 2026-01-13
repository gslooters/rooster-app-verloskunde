/**
 * AFL (Autofill) - Phase 4: Database Writer Engine
 * 
 * Writes all modified planning slots from Fase 2+3 back to PostgreSQL via Supabase.
 * 
 * UPDATED [DRAAD415]: 
 * - KRITIEKE FIX: Smart variant_id lookup met fallback strategies
 * - Write-engine probeert correcte variant_id te vinden per assignment
 * - Database trigger gebruikt variant_id als primary, smart fallback als secondary
 * - Alleen variants met aantal > 0 en status != 'MAG_NIET'
 * - buildUpdatePayloads() is weer async (voor variant_id lookup)
 * - Batch processing voor performance (50 per batch)
 * 
 * PREVIOUS [DRAAD414] PROBLEEM:
 * - roster_period_staffing_dagdelen_id was ALTIJD null
 * - Trigger verhoogde invulling op ALLE team variants (GRO, ORA, TOT)
 * - Resultaat: 387 rijen met invulling > 0 (verwacht: 212)
 * - Elke dienst telde 3× mee (voor alle teams)
 * - Invulling counter was onbruikbaar
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
 * Strategy [DRAAD415]:
 * - Smart variant_id lookup met 3 fallback strategies
 * - Strategy 1: Match employee team + capacity + allowed
 * - Strategy 2: Match TOT team + capacity + allowed
 * - Strategy 3: Match ANY team + capacity + allowed (highest aantal first)
 * - Database trigger gebruikt variant_id als primary, fallback als secondary
 * - Voorkomt multiple team updates
 * - Updates ONLY to roster_assignments (no INSERT/DELETE)
 * - Batch operations for performance
 * - Full run tracking via ort_run_id / afl_run_id
 * - Comprehensive error handling
 * 
 * Performance target: 400-600ms (includes variant_id lookups)
 * 
 * [DRAAD415] FIX: Smart variant_id lookup + team-aware trigger fallback
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
  roster_period_staffing_dagdelen_id?: string | null; // [DRAAD415] Smart lookup result or null
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
  variant_id_stats?: {
    with_variant_id: number;
    without_variant_id: number;
    percentage: number;
  };
}

/**
 * [DRAAD415] Smart variant ID lookup met fallback strategies
 * 
 * Strategies (in order):
 * 1. Match employee team + capacity + allowed
 * 2. Match TOT team + capacity + allowed
 * 3. Match ANY team + capacity + allowed (highest aantal first)
 * 
 * Returns: variant_id or null
 */
async function getSmartVariantId(
  rosterId: string,
  date: string,
  dagdeel: string,
  serviceId: string,
  employeeTeam: string
): Promise<string | null> {
  console.log(`[DRAAD415] Looking for variant: team=${employeeTeam}, service=${serviceId}, date=${date}, dagdeel=${dagdeel}`);

  // Strategy 1: Match employee team with capacity
  const { data: teamMatch, error: e1 } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select('id, team, aantal, invulling, status')
    .eq('roster_id', rosterId)
    .eq('date', date)
    .eq('dagdeel', dagdeel)
    .eq('service_id', serviceId)
    .eq('team', employeeTeam)
    .gt('aantal', 0)
    .neq('status', 'MAG_NIET')
    .maybeSingle();

  if (teamMatch?.id) {
    console.log(`[DRAAD415] ✓ Strategy 1: Found team match ${employeeTeam}`);
    return teamMatch.id;
  }

  if (e1 && e1.code !== 'PGRST116') {
    console.warn('[DRAAD415] Strategy 1 error:', e1.message);
  }

  // Strategy 2: Try TOT (totaal) variant
  const { data: totMatch, error: e2 } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select('id, team, aantal, invulling, status')
    .eq('roster_id', rosterId)
    .eq('date', date)
    .eq('dagdeel', dagdeel)
    .eq('service_id', serviceId)
    .eq('team', 'TOT')
    .gt('aantal', 0)
    .neq('status', 'MAG_NIET')
    .maybeSingle();

  if (totMatch?.id) {
    console.log(`[DRAAD415] ✓ Strategy 2: Found TOT variant`);
    return totMatch.id;
  }

  if (e2 && e2.code !== 'PGRST116') {
    console.warn('[DRAAD415] Strategy 2 error:', e2.message);
  }

  // Strategy 3: Any variant with capacity (highest aantal first)
  const { data: anyMatch, error: e3 } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select('id, team, aantal, invulling, status')
    .eq('roster_id', rosterId)
    .eq('date', date)
    .eq('dagdeel', dagdeel)
    .eq('service_id', serviceId)
    .gt('aantal', 0)
    .neq('status', 'MAG_NIET')
    .order('aantal', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anyMatch?.id) {
    console.log(`[DRAAD415] ✓ Strategy 3: Found any variant (team=${anyMatch.team})`);
    return anyMatch.id;
  }

  if (e3 && e3.code !== 'PGRST116') {
    console.warn('[DRAAD415] Strategy 3 error:', e3.message);
  }

  console.warn(`[DRAAD415] ✗ No suitable variant found for ${employeeTeam}/${serviceId}/${date}/${dagdeel}`);
  return null;
}

/**
 * Main Database Writer Class
 * [DRAAD415] UPGRADED: Smart variant_id lookup with fallback strategies
 * [DRAAD414] SIMPLIFIED: No variant_id lookup - trigger-based invulling management
 * [DRAAD407] REFACTORED: Now handles only rooster_assignments batch updates
 */
export class WriteEngine {
  /**
   * Write all modified planning slots
   * [DRAAD415] UPGRADED: Async buildUpdatePayloads with smart variant_id lookup
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
          variant_id_stats: {
            with_variant_id: 0,
            without_variant_id: 0,
            percentage: 0,
          },
        };
      }

      console.log('[DRAAD415] AFL write starting - smart variant_id lookup with trigger fallback');
      console.log(`[DRAAD415] ${modified_slots.length} assignments will be updated`);
      console.log('[DRAAD415] Write-engine will try to find correct variant_id per assignment');
      console.log('[DRAAD415] Database trigger will use variant_id as primary, smart fallback as secondary');

      // Step 2: Build update payloads (NOW ASYNC with smart variant_id lookup!)
      const update_payloads = await this.buildUpdatePayloads(
        modified_slots,
        afl_run_id,
        rosterId
      );

      // Count variant_id coverage
      const with_variant_id = update_payloads.filter(p => p.roster_period_staffing_dagdelen_id !== null).length;
      const without_variant_id = update_payloads.length - with_variant_id;
      const percentage = Math.round((with_variant_id / update_payloads.length) * 100);

      console.log(`[DRAAD415] Variant_id coverage: ${with_variant_id}/${update_payloads.length} (${percentage}%)`);

      // Step 3: Batch UPDATE roster_assignments
      const updated_count = await this.batchUpdateAssignments(
        rosterId,
        update_payloads,
        afl_run_id
      );

      // Step 4: UPDATE rooster status
      const rooster_updated = await this.updateRosterStatus(rosterId, afl_run_id);

      const database_write_ms = performance.now() - startTime;

      console.log(`[DRAAD415] AFL write complete: ${updated_count} assignments updated`);
      console.log(`[DRAAD415] Database trigger will use variant_id where available, fallback otherwise`);

      return {
        success: true,
        afl_run_id,
        rosterId,
        updated_count,
        rooster_status_updated: rooster_updated,
        database_write_ms,
        error: null,
        variant_id_stats: {
          with_variant_id,
          without_variant_id,
          percentage,
        },
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
   * [DRAAD415] ASYNC: Smart variant_id lookup with fallback strategies
   * [DRAAD414] SIMPLIFIED: No async, no variant_id lookup - always set to null
   * 
   * Batch processing to avoid too many concurrent database queries
   */
  private async buildUpdatePayloads(
    modified_slots: WorkbestandPlanning[],
    afl_run_id: string,
    rosterId: string
  ): Promise<AssignmentUpdatePayload[]> {
    const payloads: AssignmentUpdatePayload[] = [];

    console.log(`[DRAAD415] Building payloads with smart variant_id lookup...`);

    // Batch processing to avoid overwhelming the database
    const batch_size = 50;
    for (let i = 0; i < modified_slots.length; i += batch_size) {
      const batch = modified_slots.slice(i, i + batch_size);

      const batch_promises = batch.map(async (slot) => {
        // Extract date string
        const dateStr = slot.date instanceof Date 
          ? slot.date.toISOString().split('T')[0]
          : slot.date;

        // [DRAAD415] Smart variant_id lookup
        let variant_id: string | null = null;
        if (slot.service_id && slot.team && slot.status === 1) {
          variant_id = await getSmartVariantId(
            rosterId,
            dateStr,
            slot.dagdeel,
            slot.service_id,
            slot.team
          );

          if (!variant_id) {
            console.warn('[DRAAD415] No suitable variant found:', {
              slot_id: slot.id,
              date: dateStr,
              dagdeel: slot.dagdeel,
              service_id: slot.service_id,
              team: slot.team,
            });
          }
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
          roster_period_staffing_dagdelen_id: variant_id, // [DRAAD415] Smart lookup!
        };

        return payload;
      });

      const batch_payloads = await Promise.all(batch_promises);
      payloads.push(...batch_payloads);
    }

    const with_variant_id = payloads.filter(p => p.roster_period_staffing_dagdelen_id !== null).length;
    console.log(`[DRAAD415] Built ${payloads.length} payloads, ${with_variant_id} with variant_id (${Math.round(with_variant_id/payloads.length*100)}%)`);

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
   * [DRAAD415] roster_period_staffing_dagdelen_id may be null (trigger handles fallback)
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
        roster_period_staffing_dagdelen_id: payload.roster_period_staffing_dagdelen_id, // [DRAAD415] Smart lookup or null
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
