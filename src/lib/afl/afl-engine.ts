/**
 * AFL (Autofill) - Phase 1: Load Data Engine
 * Plus ORCHESTRATOR for complete Fase 1→2→3→4→5 pipeline
 * 
 * ✅ DRAAD408: FASE 4 now uses DirectWriteEngine for proper variant ID tracking
 * 
 * Loads all required data from database into 4 workbenches:
 * - Workbestand_Opdracht (tasks to schedule)
 * - Workbestand_Planning (assignment slots)
 * - Workbestand_Capaciteit (employee capacity)
 * - Workbestand_Services_Metadata (service definitions)
 * 
 * Then runs Fase 2-5:
 * - Phase 2: Solve Engine (assign services)
 * - Phase 3: Chain Engine (DIO/DDO blocking)
 * - Phase 4: ✅ DRAAD408: DirectWriteEngine (persist with variant ID)
 * - Phase 5: Report Engine (generate report)
 * 
 * [DRAAD408] CRITICAL FIX:
 * - Switched from deprecated WriteEngine to DirectWriteEngine
 * - DirectWriteEngine properly looks up roster_period_staffing_dagdelen_id
 * - Enables trigger to update invulling counter
 */

import { createClient } from '@supabase/supabase-js';
import {
  WorkbestandOpdracht,
  WorkbestandPlanning,
  WorkbestandCapaciteit,
  WorkbestandServicesMetadata,
  AflLoadResult,
  AflExecutionResult,
  AflReport,
  AflAssignmentRecord,
} from './types';
import { runSolveEngine } from './solve-engine';
import { runChainEngine } from './chain-engine';
import { getWriteEngine } from './write-engine';
import { getDirectWriteEngine } from './direct-write-engine';
import { generateAflReport } from './report-engine';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 🔧 DRAAD408 CACHE-BUST MARKER FOR DEPLOYMENT VERIFICATION
const CACHE_BUST_NONCE = `2026-01-10T10:45:00Z-DRAAD408-DIRECT-WRITE-ENGINE-FIX-${Date.now()}`;

/**
 * FASE 1: Load all data from database
 * Builds 4 workbenches in memory
 */
export class AflEngine {
  /**
   * Load all data for a specific rooster
   * Returns 4 workbenches + timing
   */
  async loadData(rosterId: string): Promise<AflLoadResult> {
    const startTime = performance.now();

    // ✅ DRAAD408 CACHE-BUST VERIFICATION MARKERS
    console.log('═══════════════════════════════════════════════════════');
    console.log('[AFL-ENGINE] 🚀 [DRAAD408] CACHE-BUST NONCE:', CACHE_BUST_NONCE);
    console.log('[AFL-ENGINE] ✅ [DRAAD408] CRITICAL FIX: FASE 4 uses DirectWriteEngine');
    console.log('[AFL-ENGINE] ✅ [DRAAD408] DirectWriteEngine looks up variant ID per assignment');
    console.log('[AFL-ENGINE] ✅ [DRAAD408] Enables trigger to update invulling counter');
    console.log('[AFL-ENGINE] 📊 Phase 1 Load starting for roster:', rosterId);
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Query 1: Load tasks (roster_period_staffing_dagdelen)
      console.log('[AFL-ENGINE] Phase 1.1: Fetching tasks...');
      const { data: tasksRaw, error: tasksError } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select(
          `
          id,
          roster_id,
          date,
          dagdeel,
          team,
          service_id,
          aantal,
          invulling,
          is_system
        `
        )
        .eq('roster_id', rosterId)
        .gt('aantal', 0);

      if (tasksError) throw new Error(`Tasks query failed: ${tasksError.message}`);
      if (!tasksRaw || tasksRaw.length === 0) {
        throw new Error('Phase 1 Load failed: No tasks found with aantal > 0');
      }
      console.log(`  ✅ Tasks: ${tasksRaw.length} rows loaded`);

      // Query 2: Load planning slots (roster_assignments)
      console.log('[AFL-ENGINE] Phase 1.2: Fetching planning slots...');
      const { data: planningRaw, error: planningError } = await supabase
        .from('roster_assignments')
        .select('*')
        .eq('roster_id', rosterId);

      if (planningError) throw new Error(`Planning query failed: ${planningError.message}`);
      console.log(`  ✅ Planning: ${planningRaw?.length || 0} rows loaded`);

      // Query 3: Load capacity (roster_employee_services)
      console.log('[AFL-ENGINE] Phase 1.3: Fetching capacity data...');
      const { data: capacityRaw, error: capacityError } = await supabase
        .from('roster_employee_services')
        .select(
          `
          roster_id,
          employee_id,
          service_id,
          aantal,
          actief,
          team,
          service_types(code)
        `
        )
        .eq('roster_id', rosterId)
        .eq('actief', true);

      if (capacityError) throw new Error(`Capacity query failed: ${capacityError.message}`);
      console.log(`  ✅ Capacity: ${capacityRaw?.length || 0} rows loaded`);

      // Query 4: Load service metadata (service_types)
      console.log('[AFL-ENGINE] Phase 1.4: Fetching service metadata...');
      const { data: servicesRaw, error: servicesError } = await supabase
        .from('service_types')
        .select('*');

      if (servicesError) throw new Error(`Services query failed: ${servicesError.message}`);
      console.log(`  ✅ Services: ${servicesRaw?.length || 0} rows loaded`);

      // Query 5: Load rooster period (roosters)
      console.log('[AFL-ENGINE] Phase 1.5: Fetching rooster period...');
      const { data: rosterRaw, error: rosterError } = await supabase
        .from('roosters')
        .select('id, start_date, end_date, status')
        .eq('id', rosterId)
        .single();

      if (rosterError) throw new Error(`Rooster query failed: ${rosterError.message}`);
      console.log(`  ✅ Rooster: Period ${rosterRaw?.start_date} to ${rosterRaw?.end_date}`);

      // Transform: Build workbenches
      console.log('[AFL-ENGINE] Phase 1.6: Building workbenches...');
      const workbestand_services_metadata = this.buildServicesMetadata(servicesRaw || []);
      const workbestand_planning = this.buildPlanning(planningRaw || []);
      const workbestand_opdracht = this.buildOpdracht(
        tasksRaw || [],
        servicesRaw || []
      );
      const workbestand_capaciteit = this.buildCapaciteit(capacityRaw || []);

      // Pre-planning adjustment
      console.log('[AFL-ENGINE] Phase 1.7: Adjusting capacity for pre-planning...');
      const preplanAdjustmentStats = this.adjustCapacityForPrePlanning(
        workbestand_planning,
        workbestand_capaciteit
      );
      console.log(`  ✅ Pre-planning adjustment: ${preplanAdjustmentStats.decremented} capacity entries decremented`);

      // Validation
      console.log('[AFL-ENGINE] Phase 1.8: Data validation...');
      const validation = this.validateLoadResult({
        workbestand_opdracht,
        workbestand_planning,
        workbestand_capaciteit,
        workbestand_services_metadata,
        rooster_period: {
          id: rosterRaw!.id,
          start_date: new Date(rosterRaw!.start_date),
          end_date: new Date(rosterRaw!.end_date),
          status: rosterRaw!.status,
        },
        load_duration_ms: 0,
      });

      if (!validation.valid) {
        console.error('❌ VALIDATION FAILED:', validation.errors);
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }

      const load_duration_ms = performance.now() - startTime;

      console.log('═══════════════════════════════════════════════════════');
      console.log('[AFL-ENGINE] ✅ Phase 1 COMPLETE in', load_duration_ms.toFixed(2), 'ms');
      console.log('[AFL-ENGINE] 🎯 [DRAAD408]: DirectWriteEngine will be used in Phase 4');
      console.log('═══════════════════════════════════════════════════════');

      return {
        workbestand_opdracht,
        workbestand_planning,
        workbestand_capaciteit,
        workbestand_services_metadata,
        rooster_period: {
          id: rosterRaw!.id,
          start_date: new Date(rosterRaw!.start_date),
          end_date: new Date(rosterRaw!.end_date),
          status: rosterRaw!.status,
        },
        load_duration_ms,
      };
    } catch (error) {
      throw new Error(`Phase 1 Load failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build Workbestand_Opdracht from raw task data
   */
  private buildOpdracht(
    tasksRaw: any[],
    servicesRaw: any[]
  ): WorkbestandOpdracht[] {
    const serviceCodeMap = new Map<string, string>();
    for (const service of servicesRaw) {
      serviceCodeMap.set(service.id, service.code || 'UNKNOWN');
    }

    const opdrachten = tasksRaw
      .filter(row => row.aantal > 0)
      .map((row) => {
        const serviceCode = serviceCodeMap.get(row.service_id) || 'UNKNOWN';
        const invulling = row.invulling || 0;
        const aantal_nog = Math.max(0, row.aantal - invulling);

        return {
          id: row.id,
          roster_id: row.roster_id,
          date: new Date(row.date),
          dagdeel: row.dagdeel,
          team: row.team,
          service_id: row.service_id,
          service_code: serviceCode,
          is_system: row.is_system || false,
          aantal: row.aantal,
          aantal_nog: aantal_nog,
          invulling: invulling,
        };
      });

    // Sort: is_system DESC → date ASC → dagdeel ASC
    opdrachten.sort((a, b) => {
      if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
      if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();
      return a.dagdeel.localeCompare(b.dagdeel, 'nl');
    });

    return opdrachten;
  }

  /**
   * Build Workbestand_Planning from raw assignment data
   */
  private buildPlanning(planningRaw: any[]): WorkbestandPlanning[] {
    return planningRaw.map((row) => ({
      id: row.id,
      roster_id: row.roster_id,
      employee_id: row.employee_id,
      date: new Date(row.date),
      dagdeel: row.dagdeel,
      status: row.status,
      service_id: row.service_id || null,
      team: row.team,
      is_protected: row.is_protected || false,
      source: row.source || null,
      blocked_by_date: row.blocked_by_date ? new Date(row.blocked_by_date) : null,
      blocked_by_dagdeel: row.blocked_by_dagdeel || null,
      blocked_by_service_id: row.blocked_by_service_id || null,
      constraint_reason: row.constraint_reason || null,
      ort_confidence: row.ort_confidence || null,
      ort_run_id: row.ort_run_id || null,
      previous_service_id: row.previous_service_id || null,
      notes: row.notes || null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      is_modified: false,
    }));
  }

  /**
   * Build Workbestand_Capaciteit from raw capacity data
   */
  private buildCapaciteit(capacityRaw: any[]): WorkbestandCapaciteit[] {
    return capacityRaw.map((row) => ({
      roster_id: row.roster_id,
      employee_id: row.employee_id,
      team: row.team || 'Overig',
      service_id: row.service_id,
      service_code: row.service_types?.code || '',
      aantal: row.aantal,
      actief: row.actief,
      aantal_beschikbaar: row.aantal,
    }));
  }

  /**
   * Build Workbestand_Services_Metadata from raw service data
   */
  private buildServicesMetadata(servicesRaw: any[]): WorkbestandServicesMetadata[] {
    return servicesRaw.map((row) => ({
      id: row.id,
      code: row.code,
      naam: row.naam,
      beschrijving: row.beschrijving || null,
      is_system: row.is_system || false,
      blokkeert_volgdag: row.blokkeert_volgdag || false,
      team_groen_regels: row.team_groen_regels || null,
      team_oranje_regels: row.team_oranje_regels || null,
      team_totaal_regels: row.team_totaal_regels || null,
      actief: row.actief,
    }));
  }

  /**
   * Adjust capacity for pre-planned assignments
   */
  private adjustCapacityForPrePlanning(
    planning: WorkbestandPlanning[],
    capaciteit: WorkbestandCapaciteit[]
  ): { decremented: number; assignments_checked: number } {
    const plannedAssignments = planning.filter(
      (p) => p.status >= 1 && p.service_id && p.employee_id
    );

    let decremented_count = 0;

    for (const assignment of plannedAssignments) {
      const capacityKey = `${assignment.employee_id}:${assignment.service_id}`;
      const capacity = capaciteit.find(
        (c) => `${c.employee_id}:${c.service_id}` === capacityKey
      );

      if (capacity && capacity.aantal_beschikbaar !== undefined) {
        capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);
        decremented_count++;
      }
    }

    return {
      decremented: decremented_count,
      assignments_checked: plannedAssignments.length,
    };
  }

  /**
   * Validate loaded data
   */
  validateLoadResult(result: AflLoadResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!result.rooster_period) errors.push('No rooster period found');
    if (result.workbestand_opdracht.length === 0) errors.push('No tasks found');
    if (result.workbestand_planning.length === 0) errors.push('No planning slots found');
    if (result.workbestand_capaciteit.length === 0) errors.push('No capacity data found');
    if (result.workbestand_services_metadata.length === 0) errors.push('No service metadata found');
    return { valid: errors.length === 0, errors };
  }
}

/**
 * ✅ DRAAD408: Convert WorkbestandPlanning to AflAssignmentRecord
 * Used for DirectWriteEngine batch writes
 */
function convertPlanningToAssignmentRecord(
  slot: WorkbestandPlanning,
  afl_run_id: string
): AflAssignmentRecord {
  const dateStr = slot.date instanceof Date
    ? slot.date.toISOString().split('T')[0]
    : String(slot.date);

  return {
    id: slot.id,
    employee_id: slot.employee_id,
    date: dateStr,
    dagdeel: slot.dagdeel,
    service_id: slot.service_id || '',
    team: slot.team,
    status: slot.status,
    ort_run_id: afl_run_id,
  };
}

/**
 * ORCHESTRATOR: Run complete AFL Pipeline (Fase 1→2→3→4→5)
 * 
 * ✅ DRAAD408: Phase 4 now uses DirectWriteEngine instead of deprecated WriteEngine
 */
export async function runAflPipeline(rosterId: string): Promise<AflExecutionResult> {
  const pipelineStartTime = performance.now();
  const afl_run_id = randomUUID();

  try {
    const engine = getAflEngine();

    // ===== FASE 1: LOAD DATA =====
    const loadResult = await engine.loadData(rosterId);
    const load_ms = loadResult.load_duration_ms;

    // Validate loaded data
    const validation = engine.validateLoadResult(loadResult);
    if (!validation.valid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    // ===== FASE 2: SOLVE =====
    const solveStart = performance.now();
    const solveResult = await runSolveEngine(
      loadResult.workbestand_opdracht,
      loadResult.workbestand_planning,
      loadResult.workbestand_capaciteit,
      loadResult.workbestand_services_metadata,
      loadResult.rooster_period.start_date,
      loadResult.rooster_period.end_date
    );
    const solve_ms = solveResult.solve_duration_ms;

    // Update planning with solve results
    for (const modified_slot of solveResult.modified_slots) {
      const original = loadResult.workbestand_planning.find((p) => p.id === modified_slot.id);
      if (original) {
        Object.assign(original, modified_slot);
      }
    }

    // ===== FASE 3: DIO/DDO CHAIN VALIDATION & BLOCKING =====
    const chainStart = performance.now();
    const chainResult = await runChainEngine(
      loadResult.workbestand_planning,
      loadResult.workbestand_services_metadata,
      loadResult.rooster_period.start_date,
      loadResult.rooster_period.end_date
    );
    const dio_chains_ms = chainResult.processing_duration_ms;

    // ===== FASE 4: WRITE TO DATABASE via DirectWriteEngine =====
    // ✅ DRAAD408: Use DirectWriteEngine for proper variant ID tracking
    console.log('═══════════════════════════════════════════════════════');
    console.log('[AFL-ENGINE] 🚀 FASE 4: DirectWriteEngine (DRAAD408 FIX)');
    console.log('═══════════════════════════════════════════════════════');
    
    const writeStart = performance.now();

    // Collect modified slots with service assignments
    const modified_slots = loadResult.workbestand_planning.filter(
      (slot) => slot.is_modified && slot.service_id
    );

    console.log(`[DRAAD408] Modified slots to write: ${modified_slots.length}`);

    // Convert to AflAssignmentRecord format
    const assignmentRecords: AflAssignmentRecord[] = modified_slots.map((slot) =>
      convertPlanningToAssignmentRecord(slot, afl_run_id)
    );

    // Write via DirectWriteEngine (handles variant ID lookup per assignment)
    const directWriteEngine = getDirectWriteEngine();
    const directWriteResult = await directWriteEngine.writeBatchAssignmentsDirect(
      rosterId,
      assignmentRecords
    );

    console.log(`[DRAAD408] DirectWriteEngine result: ${directWriteResult.written_count}/${assignmentRecords.length} written`);

    // Update rooster status via WriteEngine (still needed for status update)
    const writeEngine = getWriteEngine();
    await writeEngine.updateRosterStatus(rosterId, afl_run_id);

    const database_write_ms = performance.now() - writeStart;

    console.log(`[DRAAD408] ✅ FASE 4 complete in ${database_write_ms.toFixed(0)}ms`);
    console.log('═══════════════════════════════════════════════════════');

    // ===== FASE 5: GENERATE REPORT =====
    const reportStart = performance.now();
    const report = await generateAflReport({
      rosterId,
      afl_run_id,
      workbestand_planning: loadResult.workbestand_planning,
      workbestand_opdracht: loadResult.workbestand_opdracht,
      workbestand_capaciteit: loadResult.workbestand_capaciteit,
      workbestand_services_metadata: loadResult.workbestand_services_metadata,
      phase_timings: {
        load_ms,
        solve_ms,
        dio_chains_ms,
        database_write_ms,
      },
    });
    const report_generation_ms = performance.now() - reportStart;

    const execution_time_ms = performance.now() - pipelineStartTime;

    return {
      success: true,
      afl_run_id,
      rosterId,
      execution_time_ms,
      error: null,
      report,
      phase_timings: {
        load_ms,
        solve_ms,
        dio_chains_ms,
        database_write_ms,
        report_generation_ms,
      },
    };
  } catch (error) {
    const execution_time_ms = performance.now() - pipelineStartTime;
    const error_message = error instanceof Error ? error.message : String(error);

    console.error('[AFL Pipeline] Execution failed:', error_message);

    return {
      success: false,
      afl_run_id,
      rosterId,
      execution_time_ms,
      error: error_message,
    };
  }
}

/**
 * Helper: Create singleton instance
 */
let aflEngine: AflEngine | null = null;

export function getAflEngine(): AflEngine {
  if (!aflEngine) {
    aflEngine = new AflEngine();
  }
  return aflEngine;
}
