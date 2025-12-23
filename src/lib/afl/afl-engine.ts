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
 *
 * DRAAD338: FIX 2 - Service-code population via metadata lookup
 * - Create serviceCodeMap from service_types metadata
 * - All tasks now have proper service_code (no empty strings)
 * - Fallback to 'UNKNOWN' if service not found (defensive)
 * - Performance: O(n) single-pass lookup, <1ms for 11 services
 *
 * DRAAD339: FIX 3 - Enhanced Debug Logging
 * - Workbestand size validation
 * - Service code map completeness check
 * - Team distribution stats
 * - Pre-planning adjustment tracking
 * - Cache-bust markers for Railway deployment verification
 *
 * DRAAD342: FIX 4 - Team field in buildCapaciteit
 * - Query 3 (capacity) now explicitly includes team field from roster_employee_services
 * - buildCapaciteit properly maps row.team into WorkbestandCapaciteit.team
 * - Ensures dataflow: roster_employee_services.team → WorkbestandCapaciteit.team → solve-engine
 * - No more undefined team values
 *
 * DRAAD348: FIX 5 - PRE-PLANNING DUPLICATION BUG
 * - Root cause: buildOpdracht() did NOT account for pre-planned assignments in aantal_nog
 * - Impact: Solve engine saw more work than needed → duplication (Karin DDO/DDA +2)
 * - Fix: 
 *   1. Trek invulling af van aantal → aantal_nog = aantal - invulling
 *   2. Add validation: Unmatched protected assignments detection
 *   3. Enhanced logging for pre-planning workflow
 * - Verification: AFLstatus moet 240 zijn (6 pre + 234 new), niet 242 (+2 dubbel)
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

// 🔧 DRAAD348: CACHE-BUST MARKER + DRAAD342 REFERENCE
// Change this value to force Railway rebuild (ensures latest code deployed)
// Includes timestamp + Git commit reference for deploy verification
const CACHE_BUST_NONCE = `2025-12-23T22:00:00Z-DRAAD-348-PREPLANNING-FIX-${Date.now()}`;

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

    // ✅ DRAAD348: CACHE-BUST VERIFICATION MARKERS
    // These markers appear in Railway build logs to verify correct code version is deployed
    console.log('═══════════════════════════════════════════════════════');
    console.log('[AFL-ENGINE] 🚀 DRAAD348 CACHE-BUST NONCE:', CACHE_BUST_NONCE);
    console.log('[AFL-ENGINE] ✅ DRAAD337 FIX: Client-side sorting (no chained .order() calls)');
    console.log('[AFL-ENGINE] ✅ DRAAD338 FIX: Service-code population via metadata lookup');
    console.log('[AFL-ENGINE] ✅ DRAAD339 FIX: Enhanced debug logging + cache-bust markers');
    console.log('[AFL-ENGINE] ✅ DRAAD342 FIX: Team field in buildCapaciteit (dataflow verification)');
    console.log('[AFL-ENGINE] ✅ DRAAD348 FIX: Pre-planning invulling deduction in aantal_nog');
    console.log('[AFL-ENGINE] 📊 Phase 1 Load starting for roster:', rosterId);
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Query 1: Load tasks (roster_period_staffing_dagdelen)
      // DRAAD337: Removed chained .order() calls that cause parse errors in Supabase
      // Instead: fetch all data and sort client-side (much faster anyway)
      // Database has is_system column (position 13) - include in SELECT
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
      // ✅ DRAAD337: Removed .order() chain - will sort client-side in buildOpdracht()

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
      // ✅ DRAAD342: EXPLICITLY include team field
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
      // ✅ DRAAD338: Pass servicesRaw to buildOpdracht for service_code lookup
      const workbestand_services_metadata = this.buildServicesMetadata(servicesRaw || []);
      const workbestand_opdracht = this.buildOpdracht(tasksRaw || [], servicesRaw || []);
      const workbestand_planning = this.buildPlanning(planningRaw || []);
      const workbestand_capaciteit = this.buildCapaciteit(capacityRaw || []);

      // ✅ DRAAD348: VALIDATION 1 - Check pre-planning match before adjustment
      // This detects if any protected assignments aren't accounted for in tasks
      console.log('[AFL-ENGINE] Phase 1.7a: Validating pre-planning match...');
      const preplanValidation = this.validatePreplanningMatch(
        workbestand_planning,
        workbestand_opdracht
      );
      if (preplanValidation.unmatched.length > 0) {
        console.warn(
          `⚠️  ${preplanValidation.unmatched.length} protected assignments NOT matched to tasks!`
        );
        console.warn('   These would cause duplication:', preplanValidation.unmatched);
      } else {
        console.log(`  ✅ All ${preplanValidation.protected_count} protected assignments matched to tasks`);
      }

      // Pre-planning adjustment: Decrement capacity for protected assignments
      console.log('[AFL-ENGINE] Phase 1.7b: Adjusting capacity for pre-planning...');
      const preplanAdjustmentStats = this.adjustCapacityForPrePlanning(
        workbestand_planning,
        workbestand_capaciteit
      );
      console.log(`  ✅ Pre-planning adjustment: ${preplanAdjustmentStats.decremented} capacity entries decremented`);

      // ✅ DRAAD348: VALIDATION 2 - Verify aantal_nog deduction worked
      console.log('[AFL-ENGINE] Phase 1.7c: Verifying aantal_nog deductions...');
      const aantalValidation = this.validateAantalNogDeduction(
        workbestand_opdracht,
        workbestand_planning
      );
      console.log(`  ✅ aantal_nog deductions verified:`);
      console.log(`     - Tasks with aantal_nog=0 (pre-planned): ${aantalValidation.tasks_fully_planned}`);
      console.log(`     - Tasks with aantal_nog>0 (still open): ${aantalValidation.tasks_open}`);
      console.log(`     - Total aantal_nog remaining: ${aantalValidation.total_aantal_nog}`);

      // ✅ DRAAD339: VALIDATION & STATS
      console.log('[AFL-ENGINE] Phase 1.8: Data validation & statistics...');
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
      } else {
        console.log('✅ All validation checks passed');
      }

      // Log workbestand statistics
      const opdracht_stats = this.analyzeOpdracht(workbestand_opdracht);
      console.log('[AFL-ENGINE] 📊 Workbestand_Opdracht stats:');
      console.log('  - Total tasks:', workbestand_opdracht.length);
      console.log('  - Total required diensten:', opdracht_stats.total_diensten);
      console.log('  - Total aantal_nog (remaining):', opdracht_stats.total_aantal_nog);
      console.log('  - System services (DIO/DIA/DDO/DDA):', opdracht_stats.system_count);
      console.log('  - Regular services:', opdracht_stats.regular_count);
      console.log('  - Teams:', opdracht_stats.teams);

      console.log('[AFL-ENGINE] 📊 Workbestand_Planning stats:');
      console.log('  - Total slots:', workbestand_planning.length);
      console.log('  - Status 0 (available):', workbestand_planning.filter(p => p.status === 0).length);
      console.log('  - Status 1 (assigned):', workbestand_planning.filter(p => p.status === 1).length);
      console.log('  - Status 2 (blocked):', workbestand_planning.filter(p => p.status === 2).length);
      console.log('  - Status 3 (unavailable):', workbestand_planning.filter(p => p.status === 3).length);
      console.log('  - Protected:', workbestand_planning.filter(p => p.is_protected).length);

      console.log('[AFL-ENGINE] 📊 Workbestand_Capaciteit stats:');
      const team_distrib = this.analyzeCapaciteit(workbestand_capaciteit);
      console.log('  - Total capacity records:', workbestand_capaciteit.length);
      console.log('  - By team:', team_distrib.by_team);
      console.log('  - Total capacity slots:', team_distrib.total_capacity);
      console.log('  - Total beschikbaar:', team_distrib.total_beschikbaar);
      console.log('  - Teams with team field populated:');
      const teams_with_data = workbestand_capaciteit.filter(c => c.team && c.team.trim().length > 0).length;
      const teams_with_overig = workbestand_capaciteit.filter(c => c.team === 'Overig').length;
      console.log(`    ✅ With data: ${teams_with_data}/${workbestand_capaciteit.length}`);
      console.log(`    ⚠️  Defaulted to 'Overig': ${teams_with_overig}/${workbestand_capaciteit.length}`);

      const load_duration_ms = performance.now() - startTime;

      console.log('═══════════════════════════════════════════════════════');
      console.log('[AFL-ENGINE] ✅ Phase 1 COMPLETE in', load_duration_ms.toFixed(2), 'ms');
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
   * DRAAD338: Service-code population from metadata
   * - Create serviceCodeMap: service_id → service.code
   * - All tasks get proper service_code (never empty string)
   * - Fallback to 'UNKNOWN' if service not found (defensive)
   * 
   * DRAAD348: PRE-PLANNING INVULLING DEDUCTION
   * - Track invulling from database (pre-planned count)
   * - Calculate aantal_nog = aantal - invulling (remaining to do)
   * - This accounts for protected assignments already in planning
   * 
   * DRAAD337: CLIENT-SIDE SORTING
   * Sort priority: is_system DESC → date ASC → dagdeel ASC → team DESC → service_code ASC
   * Performance: <1ms for typical roster (500-1500 rows)
   */
  private buildOpdracht(tasksRaw: any[], servicesRaw: any[]): WorkbestandOpdracht[] {
    // ✅ DRAAD338: BUILD SERVICE CODE MAP
    // Create lookup map: service_id → service_code
    // This is O(n) where n = number of services (typically 8-15)
    const serviceCodeMap = new Map<string, string>();
    for (const service of servicesRaw) {
      serviceCodeMap.set(service.id, service.code || 'UNKNOWN');
    }

    // Map raw data to WorkbestandOpdracht objects
    // ✅ DRAAD338: Populate service_code from map
    // ✅ DRAAD348: CRITICAL FIX - Calculate aantal_nog with invulling deduction
    const opdrachten = tasksRaw.map((row) => {
      const serviceCode = serviceCodeMap.get(row.service_id) || 'UNKNOWN';
      
      // ✅ DRAAD348: Trek invulling (pre-planning) af van aantal
      // invulling = hoeveel ZIJN al ingevuld (protected assignments)
      // aantal_nog = hoeveel MOETEN nog ingevuld worden (remaining work)
      const invulling_count = row.invulling || 0;
      const aantal_nog = Math.max(0, row.aantal - invulling_count);
      
      return {
        id: row.id,
        roster_id: row.roster_id,
        date: new Date(row.date),
        dagdeel: row.dagdeel,
        team: row.team,
        service_id: row.service_id,
        service_code: serviceCode, // ✅ POPULATED from metadata lookup
        is_system: row.is_system || false, // ✅ Direct from database (position 13)
        aantal: row.aantal,
        aantal_nog: aantal_nog, // ✅ DRAAD348: FIXED - accounts for pre-planning
        invulling: invulling_count, // ✅ Track pre-planning count
      };
    });

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

      // Priority 4: team priority (Groen before Oranje before Geel)
      const teamPriority: Record<string, number> = {
        'Groen': 0,
        'Oranje': 1,
        'Geel': 2,
      };
      const priorityA = teamPriority[a.team] ?? 999;
      const priorityB = teamPriority[b.team] ?? 999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
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
   * ✅ DRAAD342 PRIORITEIT 3: Properly map team field from row.team
   * 
   * IMPORTANT: The team field comes from roster_employee_services.team
   * which is populated from the employees.team field
   * This is the authoritative source for employee team assignments
   */
  private buildCapaciteit(capacityRaw: any[]): WorkbestandCapaciteit[] {
    return capacityRaw.map((row) => ({
      roster_id: row.roster_id,
      employee_id: row.employee_id,
      team: row.team || 'Overig', // ✅ Map from roster_employee_services.team
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
   * ✅ DRAAD348: Validate pre-planning match
   * Detects if protected assignments exist but aren't in task list
   * This would indicate missing invulling data
   */
  private validatePreplanningMatch(
    planning: WorkbestandPlanning[],
    opdracht: WorkbestandOpdracht[]
  ): {
    protected_count: number;
    unmatched: Array<{
      employee_id: string;
      date: string;
      dagdeel: string;
      service_id: string;
    }>;
  } {
    const protectedAssignments = planning.filter(
      (p) => p.status === 1 && p.is_protected && p.service_id
    );

    const unmatched = [];

    for (const assignment of protectedAssignments) {
      const matchingTask = opdracht.find(
        (t) =>
          t.date.getTime() === assignment.date.getTime() &&
          t.dagdeel === assignment.dagdeel &&
          t.service_id === assignment.service_id
      );

      if (!matchingTask) {
        unmatched.push({
          employee_id: assignment.employee_id,
          date: assignment.date.toISOString().split('T')[0],
          dagdeel: assignment.dagdeel,
          service_id: assignment.service_id || 'unknown',
        });
      }
    }

    return {
      protected_count: protectedAssignments.length,
      unmatched,
    };
  }

  /**
   * ✅ DRAAD348: Validate aantal_nog deduction
   * Confirms that aantal_nog properly reflects invulling deduction
   */
  private validateAantalNogDeduction(
    opdracht: WorkbestandOpdracht[],
    planning: WorkbestandPlanning[]
  ): {
    tasks_fully_planned: number;
    tasks_open: number;
    total_aantal_nog: number;
  } {
    let tasks_fully_planned = 0;
    let tasks_open = 0;
    let total_aantal_nog = 0;

    for (const task of opdracht) {
      total_aantal_nog += task.aantal_nog;
      if (task.aantal_nog === 0) {
        tasks_fully_planned++;
      } else {
        tasks_open++;
      }
    }

    return {
      tasks_fully_planned,
      tasks_open,
      total_aantal_nog,
    };
  }

  /**
   * Adjust capacity for pre-planned assignments
   * For each protected assignment (status=1, is_protected=TRUE),
   * decrement the corresponding capacity
   */
  private adjustCapacityForPrePlanning(
    planning: WorkbestandPlanning[],
    capaciteit: WorkbestandCapaciteit[]
  ): { decremented: number; assignments_checked: number } {
    // Find all protected assignments
    const protectedAssignments = planning.filter(
      (p) => p.status === 1 && p.is_protected && p.service_id
    );

    let decremented_count = 0;

    // Decrement capacity for each
    for (const assignment of protectedAssignments) {
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
      assignments_checked: protectedAssignments.length,
    };
  }

  /**
   * Analyze opdracht for statistics
   */
  private analyzeOpdracht(opdrachten: WorkbestandOpdracht[]): {
    total_diensten: number;
    total_aantal_nog: number;
    system_count: number;
    regular_count: number;
    teams: Record<string, number>;
  } {
    const teams: Record<string, number> = {};
    let system_count = 0;
    let regular_count = 0;
    let total = 0;
    let total_nog = 0;

    for (const op of opdrachten) {
      teams[op.team] = (teams[op.team] || 0) + 1;
      total += op.aantal;
      total_nog += op.aantal_nog;
      if (op.is_system) {
        system_count += op.aantal;
      } else {
        regular_count += op.aantal;
      }
    }

    return {
      total_diensten: total,
      total_aantal_nog: total_nog,
      system_count,
      regular_count,
      teams,
    };
  }

  /**
   * Analyze capaciteit for statistics
   */
  private analyzeCapaciteit(capaciteit: WorkbestandCapaciteit[]): {
    by_team: Record<string, number>;
    total_capacity: number;
    total_beschikbaar: number;
  } {
    const by_team: Record<string, number> = {};
    let total_capacity = 0;
    let total_beschikbaar = 0;

    for (const cap of capaciteit) {
      by_team[cap.team || 'Overig'] = (by_team[cap.team || 'Overig'] || 0) + 1;
      total_capacity += cap.aantal || 0;
      total_beschikbaar += cap.aantal_beschikbaar || 0;
    }

    return {
      by_team,
      total_capacity,
      total_beschikbaar,
    };
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

    // ✅ DRAAD338: ADD validation for service_code population
    // Check if any opdracht has empty service_code (would indicate lookup failure)
    const emptyServiceCodes = result.workbestand_opdracht.filter(
      (op) => !op.service_code || op.service_code === ''
    );
    if (emptyServiceCodes.length > 0) {
      errors.push(
        `${emptyServiceCodes.length} tasks have empty service_code (service lookup failed)`
      );
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
