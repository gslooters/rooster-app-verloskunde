/**
 * DirectWriteEngine - Real-Time Per-Assignment Database Writes
 * 
 * Purpose:
 * Replicate manual planning behavior: real-time INSERT/UPDATE with trigger-driven invulling
 * 
 * Problem solved:
 * - OLD (write-engine): Batch UPDATE → trigger doesn't fire → invulling updates async & fail
 * - NEW (DirectWriteEngine): Per-assignment INSERT/UPDATE → trigger fires → atomair & reliable
 * 
 * Two Scenarios:
 * A) NEW ASSIGNMENT: INSERT → trigger auto-increments invulling
 * B) EXISTING ASSIGNMENT: UPDATE + manual invulling increment
 * 
 * Imported from: src/lib/afl/direct-write-engine.ts
 * Used by: solve-engine.ts Phase 4A
 * 
 * @see DRAAD407 - Full specification
 */

import { createClient } from '@supabase/supabase-js';
import type { AflAssignmentRecord, DirectWriteResult, BatchDirectWriteResult } from './types';

/**
 * DirectWriteEngine - Real-time per-assignment writer
 */
export class DirectWriteEngine {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  private debug_enabled: boolean = true;

  constructor() {
    if (this.debug_enabled) {
      console.log('[DRAAD407] DirectWriteEngine initialized');
    }
  }

  /**
   * Main entry point: Write single assignment (INSERT or UPDATE)
   * 
   * Flow:
   * 1. Validate variant exists
   * 2. Find existing assignment (if any)
   * 3. If not exists: INSERT (scenario A)
   * 4. If exists: UPDATE (scenario B)
   * 5. Return result
   */
  public async writeSingleAssignmentDirect(
    assignment: AflAssignmentRecord,
    rosterId: string,
    variantId: string
  ): Promise<DirectWriteResult> {
    try {
      if (this.debug_enabled) {
        console.log(`[DRAAD407] Starting write: ${assignment.employee_id} ${assignment.dagdeel} on ${assignment.date}`);
      }

      // Step 1: Validate variant exists
      const variantCheck = await this.supabase
        .from('roster_period_staffing_dagdelen')
        .select('id, invulling, aantal')
        .eq('id', variantId)
        .single();

      if (variantCheck.error) {
        return {
          success: false,
          error: `Variant not found: ${variantId}`,
        };
      }

      const variant = variantCheck.data;

      // Step 2: Find existing assignment
      const existing = await this.findExistingAssignment(
        rosterId,
        assignment.employee_id,
        assignment.date,
        assignment.dagdeel
      );

      // Step 3a: INSERT if new
      if (!existing) {
        if (this.debug_enabled) {
          console.log(`  [DRAAD407] SCENARIO A: INSERT new assignment`);
        }
        return await this.insertNewAssignment(
          assignment,
          rosterId,
          variantId,
          variant.id
        );
      }

      // Step 3b: UPDATE if exists
      if (this.debug_enabled) {
        console.log(`  [DRAAD407] SCENARIO B: UPDATE existing assignment`);
      }
      return await this.updateExistingAssignment(
        existing.id,
        assignment,
        variantId,
        variant.invulling
      );
    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD407] Error in writeSingleAssignmentDirect: ${err_msg}`);
      return {
        success: false,
        error: err_msg,
      };
    }
  }

  /**
   * Scenario A: INSERT new assignment
   * 
   * Flow:
   * 1. INSERT roster_assignments (with variant_id)
   * 2. Wait for trigger (100ms)
   * 3. Return success
   * 
   * Trigger behavior:
   * - INSERT roster_assignments → roster_period_staffing_dagdelen trigger fires
   * - Trigger increments invulling +1
   * - Result: Atomic, invulling auto-updated
   */
  private async insertNewAssignment(
    assignment: AflAssignmentRecord,
    rosterId: string,
    variantId: string,
    variantDagdelenId: string
  ): Promise<DirectWriteResult> {
    try {
      // Step 1: INSERT assignment
      const { data, error } = await this.supabase
        .from('roster_assignments')
        .insert([
          {
            roster_id: rosterId,
            employee_id: assignment.employee_id,
            date: assignment.date,
            dagdeel: assignment.dagdeel,
            service_id: assignment.service_id,
            team: assignment.team || '',
            status: 1, // Active
            roster_period_staffing_dagdelen_id: variantDagdelenId,
            ort_run_id: assignment.ort_run_id || null,
            source: 'autofill',
          },
        ])
        .select('id')
        .single();

      if (error) {
        return {
          success: false,
          error: `INSERT failed: ${error.message}`,
        };
      }

      const newAssignmentId = data.id;

      // Step 2: Wait for trigger execution
      await this.delay(100);

      if (this.debug_enabled) {
        console.log(`    [DRAAD407] INSERT successful: ${newAssignmentId}`);
        console.log(`    [DRAAD407] Trigger should auto-increment invulling`);
      }

      // Step 3: Return success
      return {
        success: true,
        assignment_id: newAssignmentId,
        invulling_updated: true, // Trigger handled it
      };
    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD407] INSERT error: ${err_msg}`);
      return {
        success: false,
        error: err_msg,
      };
    }
  }

  /**
   * Scenario B: UPDATE existing assignment
   * 
   * Flow:
   * 1. UPDATE roster_assignments (service_id, variant_id, status)
   * 2. Manual UPDATE invulling +1 in roster_period_staffing_dagdelen
   * 3. If both succeed: return success
   * 4. If any fail: return error
   * 
   * Important: Trigger doesn't fire on UPDATE, so we must manually increment
   */
  private async updateExistingAssignment(
    assignmentId: string,
    assignment: AflAssignmentRecord,
    variantId: string,
    currentInvulling: number
  ): Promise<DirectWriteResult> {
    try {
      // Step 1: UPDATE assignment
      const updateResult = await this.supabase
        .from('roster_assignments')
        .update({
          service_id: assignment.service_id,
          roster_period_staffing_dagdelen_id: variantId,
          status: 1, // Set to active
          ort_run_id: assignment.ort_run_id || null,
        })
        .eq('id', assignmentId);

      if (updateResult.error) {
        return {
          success: false,
          error: `UPDATE assignment failed: ${updateResult.error.message}`,
        };
      }

      if (this.debug_enabled) {
        console.log(`    [DRAAD407] UPDATE assignment successful`);
      }

      // Step 2: Manual UPDATE invulling
      const newInvulling = currentInvulling + 1;
      const invullingResult = await this.supabase
        .from('roster_period_staffing_dagdelen')
        .update({ invulling: newInvulling })
        .eq('id', variantId);

      if (invullingResult.error) {
        return {
          success: false,
          error: `UPDATE invulling failed: ${invullingResult.error.message}. Assignment was updated but invulling increment failed!`,
        };
      }

      if (this.debug_enabled) {
        console.log(`    [DRAAD407] UPDATE invulling successful: ${currentInvulling} → ${newInvulling}`);
      }

      // Step 3: Both succeeded
      return {
        success: true,
        assignment_id: assignmentId,
        invulling_updated: true,
      };
    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD407] UPDATE error: ${err_msg}`);
      return {
        success: false,
        error: err_msg,
      };
    }
  }

  /**
   * Helper: Find existing assignment
   * 
   * Query:
   * SELECT * FROM roster_assignments
   * WHERE roster_id = ?
   * AND employee_id = ?
   * AND date = ?
   * AND dagdeel = ?
   * LIMIT 1
   */
  private async findExistingAssignment(
    rosterId: string,
    employeeId: string,
    date: string,
    dagdeel: string
  ): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('roster_assignments')
      .select('id, service_id, status, roster_period_staffing_dagdelen_id')
      .eq('roster_id', rosterId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .eq('dagdeel', dagdeel)
      .limit(1)
      .single();

    if (error) {
      // Not found is OK
      if (error.code === 'PGRST116') {
        return null;
      }
      console.warn(`[DRAAD407] Error finding existing assignment: ${error.message}`);
      return null;
    }

    return data;
  }

  /**
   * Batch write wrapper: Write multiple assignments
   * 
   * Flow:
   * 1. For each assignment:
   *    a. Get variant ID from preloaded map
   *    b. Write via writeSingleAssignmentDirect()
   *    c. Track result
   * 2. Return batch result
   */
  public async writeBatchAssignmentsDirect(
    rosterId: string,
    assignments: AflAssignmentRecord[],
    variantIdMap: Map<string, string>
  ): Promise<BatchDirectWriteResult> {
    const results: DirectWriteResult[] = [];
    const errors: string[] = [];

    if (this.debug_enabled) {
      console.log(`[DRAAD407] Starting batch write: ${assignments.length} assignments`);
    }

    for (const assignment of assignments) {
      try {
        // Get variant ID from map
        const key = this.buildVariantKey(
          assignment.date,
          assignment.dagdeel,
          assignment.service_id,
          assignment.team || 'Overig'
        );

        const variantId = variantIdMap.get(key);
        if (!variantId) {
          errors.push(
            `No variant found for ${key} (${assignment.employee_id} ${assignment.date})`
          );
          continue;
        }

        // Write single assignment
        const result = await this.writeSingleAssignmentDirect(
          assignment,
          rosterId,
          variantId
        );

        results.push(result);

        if (!result.success) {
          errors.push(result.error || 'Unknown error');
        }
      } catch (error) {
        const err_msg = error instanceof Error ? error.message : String(error);
        errors.push(err_msg);
      }
    }

    const written_count = results.filter((r) => r.success).length;
    const failed_count = results.filter((r) => !r.success).length;

    if (this.debug_enabled) {
      console.log(`[DRAAD407] Batch complete: ${written_count}/${assignments.length} written`);
      if (errors.length > 0) {
        console.log(`[DRAAD407] Errors: ${errors.length}`);
        errors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
      }
    }

    return {
      success: failed_count === 0,
      written_count,
      failed_count,
      errors,
    };
  }

  /**
   * Helper: Build variant key from assignment attributes
   * Key = "date_dagdeel_service_id_team"
   */
  private buildVariantKey(
    date: string,
    dagdeel: string,
    serviceId: string,
    team: string
  ): string {
    return `${date}_${dagdeel}_${serviceId}_${team}`;
  }

  /**
   * Helper: Sleep utility for trigger execution wait
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let directWriteEngine: DirectWriteEngine | null = null;

/**
 * Get or create DirectWriteEngine singleton
 */
export function getDirectWriteEngine(): DirectWriteEngine {
  if (!directWriteEngine) {
    directWriteEngine = new DirectWriteEngine();
  }
  return directWriteEngine;
}
