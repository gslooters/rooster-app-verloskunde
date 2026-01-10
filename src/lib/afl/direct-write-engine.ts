/**
 * DirectWriteEngine - Real-Time Per-Assignment Database Writes
 * ✅ DRAAD408 v4.0 - TEAM NORMALIZATION FIX
 * 
 * Purpose:
 * Replicate manual planning behavior: real-time INSERT/UPDATE with trigger-driven invulling
 * 
 * 🔴 DRAAD408 ROOT CAUSE ANALYSIS:
 * - service_id in assignment is UUID (correct from solve-engine)
 * - roster_period_staffing_dagdelen.service_id is UUID (correct)
 * - PROBLEM: team mismatch between assignment (e.g. "Groen") and tasks (e.g. "GRO")
 * 
 * ✅ DRAAD408 FIXES:
 * - Added normalizeTeamCode() to convert between team formats
 * - Added comprehensive debug logging for variant lookup
 * - Improved error messages for debugging
 * 
 * Two Scenarios:
 * A) NEW ASSIGNMENT: INSERT → trigger auto-increments invulling (atomic)
 * B) EXISTING ASSIGNMENT: UPDATE → trigger auto-updates invulling (atomic)
 * 
 * @see DRAAD408 - Team normalization fix
 */

import { createClient } from '@supabase/supabase-js';
import type { AflAssignmentRecord, DirectWriteResult, BatchDirectWriteResult } from './types';

// ✅ DRAAD408: Cache-busting timestamp for Railway deployment
const CACHE_BUST_TIMESTAMP = 1736502660000;

/**
 * ✅ DRAAD407-HOTFIX: Safe date conversion with proper type narrowing
 */
function convertDateToString(date: string | Date | unknown): string {
  if (typeof date === 'string') {
    return date;
  }
  if (date && typeof date === 'object' && 'toISOString' in date) {
    const dateObj = date as Date;
    return dateObj.toISOString().split('T')[0];
  }
  return String(date);
}

/**
 * ✅ DRAAD408: Normalize team code between formats
 * 
 * Database roster_period_staffing_dagdelen uses: GRO, ORA, TOT
 * Employee/Planning data uses: Groen, Oranje, Overig
 * 
 * This function converts to DATABASE format (GRO, ORA, TOT)
 */
function normalizeTeamToDbFormat(team: string): string {
  const normalized = team?.trim() || 'TOT';
  
  // Map full names to codes
  const teamMap: Record<string, string> = {
    'Groen': 'GRO',
    'groen': 'GRO',
    'GROEN': 'GRO',
    'GRO': 'GRO',
    'Oranje': 'ORA',
    'oranje': 'ORA',
    'ORANJE': 'ORA',
    'ORA': 'ORA',
    'Overig': 'TOT',
    'overig': 'TOT',
    'OVERIG': 'TOT',
    'TOT': 'TOT',
    'Totaal': 'TOT',
  };
  
  return teamMap[normalized] || 'TOT';
}

/**
 * DirectWriteEngine - Real-time per-assignment writer (v4.0 DRAAD408)
 * ✅ Team normalization fix
 * ✅ Enhanced debug logging
 * ✅ Atomic per-assignment writes
 */
export class DirectWriteEngine {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  private debug_enabled: boolean = true;
  private cache_buster: string = `${CACHE_BUST_TIMESTAMP}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  constructor() {
    if (this.debug_enabled) {
      console.log(`[DRAAD408] DirectWriteEngine v4.0 initialized (Team Normalization Fix)`);
      console.log(`[DRAAD408] Cache buster: ${this.cache_buster}`);
      console.log(`[DRAAD408] Railway trigger: railway-${CACHE_BUST_TIMESTAMP}`);
    }
  }

  /**
   * ✅ MAIN ENTRY POINT: Write single assignment (INSERT or UPDATE)
   */
  public async writeSingleAssignmentDirect(
    assignment: AflAssignmentRecord,
    rosterId: string
  ): Promise<DirectWriteResult> {
    try {
      // ===== VALIDATION PHASE =====
      if (!assignment.service_id) {
        const error = `[DRAAD408] Assignment missing service_id: ${assignment.employee_id} ${assignment.date} ${assignment.dagdeel}`;
        console.error(error);
        return { success: false, error };
      }

      const dateStr = convertDateToString(assignment.date);
      
      // ✅ DRAAD408: Normalize team to database format
      const rawTeam = assignment.team || 'Overig';
      const normalizedTeam = normalizeTeamToDbFormat(rawTeam);

      if (this.debug_enabled) {
        console.log(`[DRAAD408] Starting write for: ${assignment.employee_id} ${dateStr} ${assignment.dagdeel}`);
        console.log(`[DRAAD408]   service_id (UUID): ${assignment.service_id}`);
        console.log(`[DRAAD408]   team raw: "${rawTeam}" → normalized: "${normalizedTeam}"`);
      }

      // ===== VARIANT LOOKUP PHASE (LIVE) =====
      const variantData = await this.getVariantId(
        rosterId,
        dateStr,
        assignment.dagdeel,
        assignment.service_id,
        normalizedTeam  // ✅ DRAAD408: Use normalized team
      );

      if (!variantData) {
        const error = `[DRAAD408] Variant not found: ${dateStr} ${assignment.dagdeel} Service=${assignment.service_id} Team=${normalizedTeam} (raw: ${rawTeam})`;
        console.warn(error);
        return { success: false, error };
      }

      // ===== CAPACITY CHECK PHASE =====
      if (variantData.invulling >= variantData.aantal) {
        const error = `[DRAAD408] Capacity full: ${variantData.invulling}/${variantData.aantal}`;
        console.warn(error);
        return { success: false, error };
      }

      // ===== EXISTENCE CHECK PHASE =====
      const existing = await this.findExistingAssignment(
        rosterId,
        assignment.employee_id,
        dateStr,
        assignment.dagdeel
      );

      // ===== WRITE PHASE =====
      if (!existing) {
        if (this.debug_enabled) {
          console.log(`[DRAAD408] ✅ SCENARIO A (NEW): Inserting assignment`);
        }
        return await this.insertNewAssignment(
          assignment,
          rosterId,
          dateStr,
          rawTeam,  // Keep original team for roster_assignments
          variantData
        );
      }

      if (this.debug_enabled) {
        console.log(`[DRAAD408] ✅ SCENARIO B (UPDATE): Updating assignment`);
      }
      return await this.updateExistingAssignment(
        existing.id,
        assignment,
        dateStr,
        rawTeam,  // Keep original team for roster_assignments
        variantData
      );

    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD408] ✘ Fatal error: ${err_msg}`);
      return { success: false, error: err_msg };
    }
  }

  /**
   * ✅ LIVE VARIANT LOOKUP
   * ✅ DRAAD408: Enhanced with team normalization + debug logging
   */
  private async getVariantId(
    rosterId: string,
    date: string,
    dagdeel: string,
    serviceId: string,
    team: string  // ✅ Already normalized to GRO/ORA/TOT format
  ): Promise<{ id: string; invulling: number; aantal: number } | null> {
    try {
      if (this.debug_enabled) {
        console.log(`[DRAAD408] getVariantId() lookup:`);
        console.log(`  roster_id: ${rosterId}`);
        console.log(`  date: ${date}`);
        console.log(`  dagdeel: ${dagdeel}`);
        console.log(`  service_id: ${serviceId}`);
        console.log(`  team: ${team}`);
      }

      const { data, error } = await this.supabase
        .from('roster_period_staffing_dagdelen')
        .select('id, invulling, aantal')
        .eq('roster_id', rosterId)
        .eq('date', date)
        .eq('dagdeel', dagdeel)
        .eq('service_id', serviceId)
        .eq('team', team)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          if (this.debug_enabled) {
            console.log(`[DRAAD408] Variant lookup: no record found (PGRST116)`);
          }
          return null;
        }
        console.warn(`[DRAAD408] Variant lookup error: ${error.message} (code: ${error.code})`);
        return null;
      }

      if (!data) {
        if (this.debug_enabled) {
          console.log(`[DRAAD408] Variant lookup: data is null`);
        }
        return null;
      }

      if (this.debug_enabled) {
        console.log(`[DRAAD408] ✅ Variant found: id=${data.id}, invulling=${data.invulling}, aantal=${data.aantal}`);
      }

      return {
        id: data.id,
        invulling: data.invulling || 0,
        aantal: data.aantal || 0,
      };

    } catch (err) {
      console.warn(`[DRAAD408] Exception in getVariantId: ${err}`);
      return null;
    }
  }

  /**
   * ✅ SCENARIO A: INSERT NEW ASSIGNMENT
   */
  private async insertNewAssignment(
    assignment: AflAssignmentRecord,
    rosterId: string,
    dateStr: string,
    team: string,
    variantData: { id: string; invulling: number; aantal: number }
  ): Promise<DirectWriteResult> {
    try {
      const { data, error } = await this.supabase
        .from('roster_assignments')
        .insert([
          {
            roster_id: rosterId,
            employee_id: assignment.employee_id,
            date: dateStr,
            dagdeel: assignment.dagdeel,
            service_id: assignment.service_id,
            team: team,
            status: 1,
            roster_period_staffing_dagdelen_id: variantData.id,
            ort_run_id: assignment.ort_run_id || null,
            source: 'autofill',
            notes: null,
          },
        ])
        .select('id')
        .single();

      if (error) {
        const err_msg = `INSERT failed: ${error.message}`;
        console.error(`[DRAAD408] ✘ ${err_msg}`);
        return { success: false, error: err_msg };
      }

      const newAssignmentId = data?.id;
      await this.delay(100);

      if (this.debug_enabled) {
        console.log(`[DRAAD408]   → INSERT successful: ${newAssignmentId}`);
        console.log(`[DRAAD408]   → ✅ Trigger auto-incremented invulling`);
      }

      return {
        success: true,
        assignment_id: newAssignmentId,
        invulling_updated: true,
      };

    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD408] ✘ Exception in INSERT: ${err_msg}`);
      return { success: false, error: err_msg };
    }
  }

  /**
   * ✅ SCENARIO B: UPDATE EXISTING ASSIGNMENT
   */
  private async updateExistingAssignment(
    assignmentId: string,
    assignment: AflAssignmentRecord,
    dateStr: string,
    team: string,
    variantData: { id: string; invulling: number; aantal: number }
  ): Promise<DirectWriteResult> {
    try {
      const updateResult = await this.supabase
        .from('roster_assignments')
        .update({
          service_id: assignment.service_id,
          team: team,
          status: 1,
          roster_period_staffing_dagdelen_id: variantData.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (updateResult.error) {
        const err_msg = `UPDATE failed: ${updateResult.error.message}`;
        console.error(`[DRAAD408] ✘ ${err_msg}`);
        return { success: false, error: err_msg };
      }

      if (this.debug_enabled) {
        console.log(`[DRAAD408]   → UPDATE successful: ${assignmentId}`);
      }

      await this.delay(100);

      return {
        success: true,
        assignment_id: assignmentId,
        invulling_updated: true,
      };

    } catch (error) {
      const err_msg = error instanceof Error ? error.message : String(error);
      console.error(`[DRAAD408] ✘ Exception in UPDATE: ${err_msg}`);
      return { success: false, error: err_msg };
    }
  }

  /**
   * ✅ HELPER: Find existing assignment
   */
  private async findExistingAssignment(
    rosterId: string,
    employeeId: string,
    date: string,
    dagdeel: string
  ): Promise<{ id: string; status: number } | null> {
    try {
      const { data, error } = await this.supabase
        .from('roster_assignments')
        .select('id, status')
        .eq('roster_id', rosterId)
        .eq('employee_id', employeeId)
        .eq('date', date)
        .eq('dagdeel', dagdeel)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.warn(`[DRAAD408] Error finding existing assignment: ${error.message}`);
        return null;
      }

      return data as { id: string; status: number } | null;

    } catch (err) {
      return null;
    }
  }

  /**
   * ✅ BATCH WRAPPER: Write multiple assignments
   */
  public async writeBatchAssignmentsDirect(
    rosterId: string,
    assignments: AflAssignmentRecord[]
  ): Promise<BatchDirectWriteResult> {
    const results: DirectWriteResult[] = [];
    const errors: string[] = [];

    console.log(`[DRAAD408] 🚀 Starting batch write: ${assignments.length} assignments`);
    console.log(`[DRAAD408] Railway cache-bust: ${this.cache_buster}`);

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      try {
        const result = await this.writeSingleAssignmentDirect(
          assignment,
          rosterId
        );

        results.push(result);

        if (!result.success) {
          errors.push(result.error || 'Unknown error');
          if (this.debug_enabled && errors.length <= 5) {
            console.warn(`[DRAAD408]   ✘ [${i + 1}/${assignments.length}] ${result.error}`);
          }
        }

      } catch (error) {
        const err_msg = error instanceof Error ? error.message : String(error);
        errors.push(err_msg);
        if (this.debug_enabled && errors.length <= 5) {
          console.error(`[DRAAD408]   ✘ [${i + 1}/${assignments.length}] Exception: ${err_msg}`);
        }
      }
    }

    const written_count = results.filter((r) => r.success).length;
    const failed_count = results.filter((r) => !r.success).length;

    console.log(`[DRAAD408] ✅ Batch complete: ${written_count}/${assignments.length} written, ${failed_count} failed`);
    if (errors.length > 0) {
      console.log(`[DRAAD408]   Errors (showing first 5):`);
      errors.slice(0, 5).forEach((err) => console.log(`     - ${err}`));
    }

    return {
      success: failed_count === 0,
      written_count,
      failed_count,
      errors,
    };
  }

  /**
   * ✅ HELPER: Sleep utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * ✅ SINGLETON INSTANCE
 */
let directWriteEngine: DirectWriteEngine | null = null;

export function getDirectWriteEngine(): DirectWriteEngine {
  if (!directWriteEngine) {
    directWriteEngine = new DirectWriteEngine();
  }
  return directWriteEngine;
}
