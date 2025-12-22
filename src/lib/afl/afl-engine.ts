/**
 * AFL (Autofill) - Phase 1: Load Data Engine
 * Plus ORCHESTRATOR for complete Fase 1→2→3→4→5 pipeline
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
 * - Phase 4: Write Engine (persist to database)
 * - Phase 5: Report Engine (generate report)
 * 
 * DRAAD337: PHASE 1 FIX - Complex sorting moved to client-side
 * - Removed chained .order() calls that cause Supabase parse errors
 * - is_system column properly selected and used for sorting
 * - Client-side sort priority: is_system DESC → date ASC → dagdeel ASC → team DESC
 * - No performance impact: sorting is instant for typical roster sizes
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
} from './types';
import { runSolveEngine } from './solve-engine';
import { runChainEngine } from './chain-engine';
import { writeAflResultToDatabase } from './write-engine';
import { generateAflReport } from './report-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    try {
      // Query 1: Load tasks (roster_period_staffing_dagdelen)
      // DRAAD337: Removed chained .order() calls that cause parse errors in Supabase
      // Instead: fetch all data and sort client-side (much faster anyway)
      // Database has is_system column (position 13) - include in SELECT
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
      // ✅ DRAAD337: Removed .order() chain - will sort client-side in buildOpdracht()

      if (tasksError) throw new Error(`Tasks query failed: ${tasksError.message}`);
      if (!tasksRaw || tasksRaw.length === 0) {
        throw new Error('Phase 1 Load failed: No tasks found with aantal > 0');
      }

      // Query 2: Load planning slots (roster_assignments)
      const { data: planningRaw, error: planningError } = await supabase
        .from('roster_assignments')
        .select('*')
        .eq('roster_id', rosterId);

      if (planningError) throw new Error(`Planning query failed: ${planningError.message}`);

      // Query 3: Load capacity (roster_employee_services)
      const { data: capacityRaw, error: capacityError } = await supabase
        .from('roster_employee_services')
        .select(
          `
          roster_id,
          employee_id,
          service_id,
          aantal,
          actief,
          service_types(code)
        `
        )
        .eq('roster_id', rosterId)
        .eq('actief', true);

      if (capacityError) throw new Error(`Capacity query failed: ${capacityError.message}`);

      // Query 4: Load service metadata (service_types)
      const { data: servicesRaw, error: servicesError } = await supabase
        .from('service_types')
        .select('*');

      if (servicesError) throw new Error(`Services query failed: ${servicesError.message}`);

      // Query 5: Load rooster period (roosters)
      const { data: rosterRaw, error: rosterError } = await supabase
        .from('roosters')
        .select('id, start_date, end_date, status')
        .eq('id', rosterId)
        .single();

      if (rosterError) throw new Error(`Rooster query failed: ${rosterError.message}`);

      // Transform: Build workbenches
      const workbestand_opdracht = this.buildOpdracht(tasksRaw || []);
      const workbestand_planning = this.buildPlanning(planningRaw || []);
      const workbestand_capaciteit = this.buildCapaciteit(capacityRaw || []);
      const workbestand_services_metadata = this.buildServicesMetadata(servicesRaw || []);

      // Pre-planning adjustment: Decrement capacity for protected assignments
      this.adjustCapacityForPrePlanning(workbestand_planning, workbestand_capaciteit);

      const load_duration_ms = performance.now() - startTime;

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
   * DRAAD337: CLIENT-SIDE SORTING
   * Sort priority: is_system DESC → date ASC → dagdeel ASC → team DESC → service_code ASC
   * Performance: <1ms for typical roster (500-1500 rows)
   */
  private buildOpdracht(tasksRaw: any[]): WorkbestandOpdracht[] {
    // Map raw data to WorkbestandOpdracht objects
    const opdrachten = tasksRaw.map((row) => ({
      id: row.id,
      roster_id: row.roster_id,
      date: new Date(row.date),
      dagdeel: row.dagdeel,
      team: row.team,
      service_id: row.service_id,
      service_code: '', // Will be populated from service metadata lookup
      is_system: row.is_system || false, // ✅ Direct from database (position 13)
      aantal: row.aantal,
      aantal_nog: row.aantal,
      invulling: row.invulling || 0,
    }));

    // ✅ DRAAD337: CLIENT-SIDE SORT - moved from database query
    // This avoids Supabase parser issues with chained .order() calls
    // Sorting is instant even for 1500+ rows
    opdrachten.sort((a, b) => {
      // Priority 1: is_system DESC (TRUE before FALSE)
      if (a.is_system !== b.is_system) {
        return a.is_system ? -1 : 1; // TRUE first (-1) vs FALSE (1)
      }

      // Priority 2: date ASC (earliest first)
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime();
      }

      // Priority 3: dagdeel ASC (morning, noon, evening, night)
      if (a.dagdeel !== b.dagdeel) {
        return a.dagdeel.localeCompare(b.dagdeel, 'nl', { sensitivity: 'base' });
      }

      // Priority 4: team DESC (Groen before Oranje before Geel)
      // Team value logic: 'Groen' < 'Oranje' < 'Geel' alphabetically
      // So DESC means reverse (Geel before Oranje before Groen... wait, that's wrong)
      // Let's use explicit team priority
      const teamPriority: Record<string, number> = {
        'Groen': 0,
        'Oranje': 1,
        'Geel': 2,
      };
      const priorityA = teamPriority[a.team] ?? 999;
      const priorityB = teamPriority[b.team] ?? 999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower number first (Groen before Oranje)
      }

      // Priority 5: service_code ASC (for consistency)
      const codeA = a.service_code || '';
      const codeB = b.service_code || '';
      return codeA.localeCompare(codeB, 'nl', { sensitivity: 'base' });
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
      service_id: row.service_id,
      service_code: row.service_types?.code || '',
      aantal: row.aantal,
      actief: row.actief,
      aantal_beschikbaar: row.aantal, // Initialize for tracking
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
   * For each protected assignment (status=1, is_protected=TRUE),
   * decrement the corresponding capacity
   */
  private adjustCapacityForPrePlanning(
    planning: WorkbestandPlanning[],
    capaciteit: WorkbestandCapaciteit[]
  ): void {
    // Find all protected assignments
    const protectedAssignments = planning.filter(
      (p) => p.status === 1 && p.is_protected && p.service_id
    );

    // Decrement capacity for each
    for (const assignment of protectedAssignments) {
      const capacityKey = `${assignment.employee_id}:${assignment.service_id}`;
      const capacity = capaciteit.find(
        (c) => `${c.employee_id}:${c.service_id}` === capacityKey
      );

      if (capacity && capacity.aantal_beschikbaar !== undefined) {
        capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);
      }
    }
  }

  /**
   * Validate loaded data
   * Checks for common issues
   */
  validateLoadResult(result: AflLoadResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check: Must have rooster
    if (!result.rooster_period) {
      errors.push('No rooster period found');
    }

    // Check: Must have tasks
    if (result.workbestand_opdracht.length === 0) {
      errors.push('No tasks found (roster_period_staffing_dagdelen with aantal > 0)');
    }

    // Check: Must have planning slots
    if (result.workbestand_planning.length === 0) {
      errors.push('No planning slots found (roster_assignments)');
    }

    // Check: Must have capacity data
    if (result.workbestand_capaciteit.length === 0) {
      errors.push('No capacity data found (roster_employee_services)');
    }

    // Check: Must have service metadata
    if (result.workbestand_services_metadata.length === 0) {
      errors.push('No service metadata found (service_types)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * ORCHESTRATOR: Run complete AFL Pipeline (Fase 1→2→3→4→5)
 * 
 * Main entry point for frontend to run full AFL execution
 */
export async function runAflPipeline(rosterId: string): Promise<AflExecutionResult> {
  const pipelineStartTime = performance.now();

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

    // Log chain validation errors if any
    if (chainResult.validation_errors.length > 0) {
      console.warn(
        `[AFL Pipeline] Chain validation found ${chainResult.validation_errors.length} errors/warnings`,
        chainResult.validation_errors
      );
    }

    // ===== FASE 4: WRITE TO DATABASE =====
    const writeStart = performance.now();
    const writeResult = await writeAflResultToDatabase(
      rosterId,
      loadResult.workbestand_planning
    );
    const database_write_ms = writeResult.database_write_ms;

    if (!writeResult.success) {
      throw new Error(`Database write failed: ${writeResult.error}`);
    }

    // ===== FASE 5: GENERATE REPORT =====
    const reportStart = performance.now();
    const report = await generateAflReport({
      rosterId,
      afl_run_id: writeResult.afl_run_id,
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
      afl_run_id: writeResult.afl_run_id,
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
      afl_run_id: '',
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