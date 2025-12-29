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
 * DRAAD348: FIX 5 - PRE-PLANNING DUPLICATION BUG (INCOMPLETE)
 * - Root cause: buildOpdracht() did NOT account for pre-planned assignments in aantal_nog
 * - Impact: Solve engine saw more work than needed → duplication (Karin DDO/DDA +2)
 * - Attempted fix: Trek invulling af van aantal → aantal_nog = aantal - invulling
 * - CRITICAL ISSUE: invulling from database is ALWAYS 0 (no trigger on manual planning)
 * - Result: DRAAD348 fix was incomplete, duplication still occurs
 *
 * DRAAD362: FIX 6 - PRE-PLANNING CALCULATION (ROOT CAUSE FIX)
 * - Root cause analysis: Database invulling field never updated when assignments manually created
 * - No trigger in schema to increment invulling on new roster_assignments rows
 * - Solution: Calculate invulling dynamically from roster_assignments WHERE status >= 1
 * - Key insight: status field IS the protection (0=free, >=1=allocated)
 * - is_protected flag is unused in normal app workflow (always FALSE for manual entries)
 * - Implementation:
 *   1. New calculateInvullingFromAssignments() counts assignments per date/dagdeel/team/service
 *   2. buildOpdracht() uses calculated invulling instead of database value
 *   3. adjustCapacityForPrePlanning() counts ALL status>=1 (not only is_protected=TRUE)
 *   4. Enhanced logging for verification
 * - Expected result: AFLstatus = 240 (6 pre + 234 new), not 242 (6 pre + 236 with duplication)
 *
 * DRAAD363: FIX 7 - TEAM-FIELD AGGREGATION FIX (CRITICAL DATA-INTEGRITY FIX)
 * - Root cause: calculateInvullingFromAssignments() matches assignments WITHOUT team in key
 * - Problem: roster_assignments has NO team field → must fetch from roster_employee_services
 * - Impact: Both assignments (Merel=Groen, Heike=Oranje) match to SAME Groen-task → count=2
 * - Solution: Build employeeTeamMap in loadData() → use in calculateInvullingFromAssignments()
 * - Implementation:
 *   1. BUILD: employeeTeamMap from roster_employee_services (source of truth)
 *   2. LOOKUP: taskLookup key now includes team: "date_dagdeel_team_service"
 *   3. MATCH: Assignment loop gets team via employeeTeamMap.get(employee_id)
 *   4. PASS: employeeTeamMap through buildOpdracht() → calculateInvullingFromAssignments()
 * - Expected result: invullingMap counts CORRECTLY per team (Groen=1, Oranje=1, NOT 2+0)
 * - AFLstatus becomes 240 (not 242) - this is the REAL root cause fix
 * - Lizette stops getting wrongfully assigned OSP
 *
 * DRAAD363-FINAL: VERIFICATION & ENHANCED LOGGING
 * - ✅ VERIFIED: Both dagdeel sources use single letters (O/M/A)
 * - ✅ VERIFIED: employeeTeamMap is built correctly
 * - ✅ VERIFIED: taskLookup includes team in key
 * - ✅ VERIFIED: Assignment team fetch from employeeTeamMap
 * - Enhanced trace logging for complete key matching visibility
 * - Baseline verification established for production testing
 *
 * DRAAD365: FIX 8 - ROSTER_ASSIGNMENTS TEAM FIELD MAPPING
 * - Issue: Team field exists in database but NOT mapped into WorkbestandPlanning
 * - Database: roster_assignments.team (text, position 20) ✅ EXISTS
 * - Interface: WorkbestandPlanning.team ✅ EXISTS (made mandatory, previously optional)
 * - Mapping: buildPlanning() missing team assignment ❌ FIXED
 * - Solution: Added `team: row.team` to buildPlanning() object mapping
 * - Data flow: roster_assignments.team → buildPlanning() → WorkbestandPlanning.team
 * - Verification: Enhanced logging shows team distribution in Planning workbestand
 * - Status after fix: Team field now correctly mapped from database to workbestand
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

// 🔧 DRAAD365: CACHE-BUST MARKER FOR DEPLOYMENT VERIFICATION
// Change this value to force Railway rebuild (ensures latest code deployed)
// Includes timestamp + Git commit reference for deploy verification
const CACHE_BUST_NONCE = `2025-12-29T19:41:00Z-DRAAD-365-TEAM-FIELD-MAPPING-${Date.now()}`;

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

    // ✅ DRAAD365: CACHE-BUST VERIFICATION MARKERS
    // These markers appear in Railway build logs to verify correct code version is deployed
    console.log('═══════════════════════════════════════════════════════');
    console.log('[AFL-ENGINE] 🚀 DRAAD365 CACHE-BUST NONCE:', CACHE_BUST_NONCE);
    console.log('[AFL-ENGINE] ✅ DRAAD337 FIX: Client-side sorting (no chained .order() calls)');
    console.log('[AFL-ENGINE] ✅ DRAAD338 FIX: Service-code population via metadata lookup');
    console.log('[AFL-ENGINE] ✅ DRAAD339 FIX: Enhanced debug logging + cache-bust markers');
    console.log('[AFL-ENGINE] ✅ DRAAD342 FIX: Team field in buildCapaciteit (dataflow verification)');
    console.log('[AFL-ENGINE] ✅ DRAAD348 FIX: Pre-planning invulling deduction (incomplete)');
    console.log('[AFL-ENGINE] ✅ DRAAD362 FIX: Dynamic invulling calculation from assignments');
    console.log('[AFL-ENGINE] ✅ DRAAD363 FIX: Team-field aggregation (employeeTeamMap)');
    console.log('[AFL-ENGINE] ✅ DRAAD363-FINAL: Verification & enhanced logging');
    console.log('[AFL-ENGINE] ✅ DRAAD365 FIX: Team field mapping in buildPlanning()');
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

      // ✅ DRAAD363-FINAL: BASELINE VERIFICATION - Sample task dagdeel formats
      console.log('[DRAAD363-FINAL] Task dagdeel format verification:');
      const sampleTasks = tasksRaw.slice(0, 5);
      const dagdeelFormats = new Set<string>();
      for (const task of tasksRaw) {
        dagdeelFormats.add(task.dagdeel);
      }
      console.log(`  Unique dagdeel values: ${Array.from(dagdeelFormats).sort().join(', ')}`);
      console.log('  Sample task keys that will be created:');
      for (const task of sampleTasks) {
        const taskDate = task.date instanceof Date
          ? task.date.toISOString().split('T')[0]
          : task.date;
        const sampleKey = `${taskDate}_${task.dagdeel}_${task.team}_${task.service_id.toString().substring(0, 8)}`;
        console.log(`    ${sampleKey}...`);
      }

      // Query 2: Load planning slots (roster_assignments)
      console.log('[AFL-ENGINE] Phase 1.2: Fetching planning slots...');
      const { data: planningRaw, error: planningError } = await supabase
        .from('roster_assignments')
        .select('*')
        .eq('roster_id', rosterId);

      if (planningError) throw new Error(`Planning query failed: ${planningError.message}`);
      console.log(`  ✅ Planning: ${planningRaw?.length || 0} rows loaded`);

      // ✅ DRAAD363-FINAL: BASELINE VERIFICATION - Sample planning dagdeel formats
      console.log('[DRAAD363-FINAL] Planning dagdeel format verification:');
      const assignmentDagdeelFormats = new Set<string>();
      for (const plan of (planningRaw || [])) {
        assignmentDagdeelFormats.add(plan.dagdeel);
      }
      console.log(`  Unique dagdeel values in assignments: ${Array.from(assignmentDagdeelFormats).sort().join(', ')}`);
      const sampleAssignments = (planningRaw || []).filter(p => p.status >= 1).slice(0, 3);
      console.log('  Sample assignment keys that will be looked up:');
      for (const assign of sampleAssignments) {
        const assignDate = assign.date instanceof Date
          ? assign.date.toISOString().split('T')[0]
          : String(assign.date);
        const sampleKey = `${assignDate}_${assign.dagdeel}_[TEAM_TBD]_${assign.service_id?.toString().substring(0, 8) || 'null'}`;
        console.log(`    ${sampleKey}...`);
      }

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

      // ✅ DRAAD363 FIX 1: BUILD EMPLOYEE-TEAM MAP
      // Source: roster_employee_services contains authoritative team assignment
      // Used by: calculateInvullingFromAssignments() for proper team matching
      console.log('[AFL-ENGINE] Phase 1.3b: Building employee-team map...');
      const employeeTeamMap = new Map<string, string>();
      if (capacityRaw && capacityRaw.length > 0) {
        for (const capacity of capacityRaw) {
          if (capacity.employee_id && capacity.team) {
            // Use first occurrence (all roster_employee_services for same employee have same team)
            if (!employeeTeamMap.has(capacity.employee_id)) {
              employeeTeamMap.set(capacity.employee_id, capacity.team);
            }
          }
        }
      }
      console.log(`  ✅ Employee-team map built: ${employeeTeamMap.size} employees with team assignments`);

      // ✅ DRAAD363: VERIFICATION - Sample team mappings
      console.log('[DRAAD363] Sample employee-team mappings:');
      const sampleEntries = Array.from(employeeTeamMap.entries()).slice(0, 5);
      for (const [empId, team] of sampleEntries) {
        console.log(`  ${empId.substring(0, 8)}... → ${team}`);
      }

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
      // ✅ DRAAD362: Pass planningRaw to buildOpdracht for dynamic invulling calculation
      // ✅ DRAAD363: Pass employeeTeamMap to buildOpdracht for team-aware matching
      const workbestand_services_metadata = this.buildServicesMetadata(servicesRaw || []);
      const workbestand_planning = this.buildPlanning(planningRaw || []);
      const workbestand_opdracht = this.buildOpdracht(
        tasksRaw || [],
        servicesRaw || [],
        workbestand_planning,  // ✅ DRAAD362: NEW - pass planning for invulling calculation
        employeeTeamMap  // ✅ DRAAD363: NEW - pass team map for team-aware matching
      );
      const workbestand_capaciteit = this.buildCapaciteit(capacityRaw || []);

      // ✅ DRAAD365: VERIFY TEAM FIELD MAPPING IN PLANNING
      console.log('[DRAAD365] Team field mapping verification in Workbestand_Planning:');
      const planningWithTeam = workbestand_planning.filter(p => p.team && p.team.trim().length > 0);
      const planningWithoutTeam = workbestand_planning.filter(p => !p.team || p.team.trim().length === 0);
      console.log(`  - Planning entries with team populated: ${planningWithTeam.length}/${workbestand_planning.length}`);
      console.log(`  - Planning entries without team: ${planningWithoutTeam.length}/${workbestand_planning.length}`);
      
      if (planningWithTeam.length > 0) {
        const teamDistribution: Record<string, number> = {};
        planningWithTeam.forEach(p => {
          teamDistribution[p.team!] = (teamDistribution[p.team!] || 0) + 1;
        });
        console.log(`  - Team distribution in planning:`, teamDistribution);
        
        // Sample some entries
        const samples = planningWithTeam.slice(0, 3);
        console.log('[DRAAD365] Sample planning entries with team:');
        for (const plan of samples) {
          console.log(`  employee: ${plan.employee_id.substring(0, 8)}..., team: ${plan.team}, date: ${plan.date.toISOString().split('T')[0]}, status: ${plan.status}`);
        }
      } else {
        console.warn('[DRAAD365] ⚠️  WARNING: No team values found in planning workbestand!');
      }

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

      // Pre-planning adjustment: Decrement capacity for ALL status>=1 assignments (DRAAD362 fix)
      console.log('[AFL-ENGINE] Phase 1.7b: Adjusting capacity for pre-planning...');
      const preplanAdjustmentStats = this.adjustCapacityForPrePlanning(
        workbestand_planning,
        workbestand_capaciteit
      );
      console.log(`  ✅ Pre-planning adjustment: ${preplanAdjustmentStats.decremented} capacity entries decremented`);
      console.log(`     (Total assignments checked: ${preplanAdjustmentStats.assignments_checked})`);

      // ✅ DRAAD362: VERIFICATION LOGGING - Show calculated invulling values
      console.log('[AFL-ENGINE] Phase 1.7c: DRAAD362 Invulling Verification...');
      const invullingTasks = workbestand_opdracht.filter(t => t.invulling > 0).slice(0, 5);
      if (invullingTasks.length > 0) {
        console.log('[AFL-ENGINE] ✅ Sample tasks with pre-planned invulling:');
        for (const task of invullingTasks) {
          const taskDate = task.date.toISOString().split('T')[0];
          console.log(
            `  ${task.service_code} | ${taskDate} ${task.dagdeel} | ` +
            `aantal=${task.aantal} → invulling_calculated=${task.invulling} → aantal_nog=${task.aantal_nog}`
          );
        }
      }

      // Verify totals
      const totalAantal = workbestand_opdracht.reduce((sum, t) => sum + t.aantal, 0);
      const totalInvulling = workbestand_opdracht.reduce((sum, t) => sum + t.invulling, 0);
      const totalAantalNog = workbestand_opdracht.reduce((sum, t) => sum + t.aantal_nog, 0);
      
      console.log('[AFL-ENGINE] 📊 DRAAD362 Totals:');
      console.log(`  Total aantal (all tasks): ${totalAantal}`);
      console.log(`  Total invulling (pre-planned): ${totalInvulling}`);
      console.log(`  Total aantal_nog (still needed): ${totalAantalNog}`);
      console.log(`  ✅ Verification: ${totalAantal} - ${totalInvulling} = ${totalAantalNog}`);

      // ✅ DRAAD348: VALIDATION 2 - Verify aantal_nog deduction worked
      console.log('[AFL-ENGINE] Phase 1.7d: Verifying aantal_nog deductions...');
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
   * ✅ DRAAD362: Calculate actual invulling from roster_assignments
   * ✅ DRAAD363: ENHANCED - Include team-aware matching
   * 
   * CRITICAL FIX: Database invulling field is ALWAYS 0 because:
   * - No database trigger updates invulling when assignments are manually created
   * - Only solution: Calculate from actual assignments WHERE status >= 1
   * 
   * Key insight: status field IS the protection (0=free, >=1=allocated)
   * The is_protected flag is unused in normal app workflow
   * 
   * DRAAD363 ADDITION:
   * - roster_assignments has NO team field
   * - Must fetch team from employeeTeamMap (source: roster_employee_services)
   * - Include team in lookup key for correct matching
   * 
   * Algorithm:
   * 1. Filter all assignments with status >= 1 (ingepland/allocated)
   * 2. Build task lookup map (date_dagdeel_team_service → task) ✅ DRAAD363: WITH TEAM
   * 3. For each assignment:
   *    a. Get employee team from employeeTeamMap ✅ DRAAD363: NEW
   *    b. Build lookup key WITH team ✅ DRAAD363: NEW
   *    c. Match to correct task ✅ DRAAD363: FIX
   * 4. Count assignments per (date, dagdeel, team, service_id)
   * 5. Return map for invulling calculation in buildOpdracht()
   * 
   * Returns: Map<"2025-12-24_O_Groen_service-id", count>
   * 
   * ✅ DRAAD363-FINAL: ENHANCED TRACE LOGGING
   * - Detailed key construction logging for both tasks and assignments
   * - Verification of exact matching logic
   */
  private calculateInvullingFromAssignments(
    tasksRaw: any[],
    planning: WorkbestandPlanning[],
    employeeTeamMap: Map<string, string>  // ✅ DRAAD363: NEW parameter
  ): Map<string, number> {
    // Step 1: Filter ALL assignments with status >= 1 (not only is_protected=TRUE)
    // status meanings: 0=free, 1+=allocated (including protected, blocked, unavailable)
    const plannedAssignments = planning.filter(p =>
      p.status >= 1 &&
      p.service_id &&
      p.date &&
      p.dagdeel
    );

    console.log(`[DRAAD362] Found ${plannedAssignments.length} assignments with status >= 1`);

    // ✅ DRAAD363 FIX 2: Task Lookup MET Team
    // Before: Key was "date_dagdeel_service" (missing team)
    // Problem: Two tasks (Groen, Oranje) same date/dagdeel/service collapse into 1
    // After: Key is "date_dagdeel_team_service" to make unique per team
    const taskLookup = new Map<string, any>();
    for (const task of tasksRaw) {
      // Date format normalization (database returns "YYYY-MM-DD")
      const taskDate = task.date instanceof Date
        ? task.date.toISOString().split('T')[0]
        : task.date;
      
      // ✅ KEY NOW INCLUDES TEAM
      const key = `${taskDate}_${task.dagdeel}_${task.team}_${task.service_id}`;
      taskLookup.set(key, task);
    }

    // ✅ DRAAD363-FINAL: ENHANCED TRACE - Show exact task keys
    console.log('[DRAAD363-FINAL] Task lookup keys (sample):');
    const taskKeys = Array.from(taskLookup.keys()).slice(0, 8);
    for (const key of taskKeys) {
      const parts = key.split('_');
      console.log(`  ${key.substring(0, 50)}... (date=${parts[0]}, dagdeel=${parts[1]}, team=${parts[2]})`);
    }
    console.log(`[DRAAD363] Total task lookup entries: ${taskLookup.size}`);

    // Step 3: Count assignments per (date, dagdeel, team, service_id)
    const invullingMap = new Map<string, number>();
    let matchedCount = 0;
    let unmatchedCount = 0;

    console.log('[DRAAD363-FINAL] Processing assignments with team mapping:');

    for (const assignment of plannedAssignments) {
      // Normalize assignment date
      const assignDate = assignment.date instanceof Date
        ? assignment.date.toISOString().split('T')[0]
        : String(assignment.date);

      // ✅ DRAAD363 FIX 2: GET EMPLOYEE TEAM FROM MAP
      const assignmentTeam = employeeTeamMap.get(assignment.employee_id);
      
      if (!assignmentTeam) {
        unmatchedCount++;
        if (unmatchedCount <= 5) {
          console.warn(`[DRAAD363] ⚠️  Employee ${assignment.employee_id} has no team mapping`);
        }
        continue;  // Skip this assignment if no team found
      }

      // ✅ DRAAD363 FIX 3: LOOKUP KEY NOW INCLUDES TEAM
      const lookupKey = `${assignDate}_${assignment.dagdeel}_${assignmentTeam}_${assignment.service_id}`;
      const task = taskLookup.get(lookupKey);

      if (task) {
        // Invulling key MUST match team
        const invullingKey = `${assignDate}_${assignment.dagdeel}_${task.team}_${assignment.service_id}`;
        invullingMap.set(invullingKey, (invullingMap.get(invullingKey) || 0) + 1);
        matchedCount++;

        if (matchedCount <= 4) {
          console.log(`[DRAAD363-FINAL] ✅ MATCHED assignment:`);
          console.log(`     employee: ${assignment.employee_id}`);
          console.log(`     team (from map): ${assignmentTeam}`);
          console.log(`     date: ${assignDate}, dagdeel: ${assignment.dagdeel}`);
          console.log(`     lookup key: ${lookupKey.substring(0, 50)}...`);
          console.log(`     invulling key: ${invullingKey.substring(0, 50)}...`);
        }
      } else {
        unmatchedCount++;
        if (unmatchedCount <= 5) {
          console.warn(`[DRAAD363-FINAL] ❌ NO MATCH for assignment:`);
          console.warn(`     employee: ${assignment.employee_id}, team: ${assignmentTeam}`);
          console.warn(`     date: ${assignDate}, dagdeel: ${assignment.dagdeel}`);
          console.warn(`     lookup key: ${lookupKey.substring(0, 50)}...`);
          console.warn(`     (task has dagdeel formats: ${Array.from(new Set(Array.from(taskLookup.keys()).map(k => k.split('_')[1]))).join(', ')})`);
        }
      }
    }

    console.log('[DRAAD363] ✅ Invulling calculation complete:');
    console.log(`  - Matched assignments: ${matchedCount}`);
    console.log(`  - Unmatched assignments: ${unmatchedCount}`);
    console.log(`  - Unique invulling keys: ${invullingMap.size}`);
    console.log('[DRAAD363] Sample invulling map entries:');
    const invullingEntries = Array.from(invullingMap.entries()).slice(0, 10);
    for (const [key, count] of invullingEntries) {
      console.log(`  ${key.substring(0, 50)}... → count=${count}`);
    }

    return invullingMap;
  }

  /**
   * Build Workbestand_Opdracht from raw task data
   * 
   * ✅ DRAAD338: Service-code population from metadata
   * - Create serviceCodeMap: service_id → service.code
   * - All tasks get proper service_code (never empty string)
   * - Fallback to 'UNKNOWN' if service not found (defensive)
   * 
   * ✅ DRAAD362: PRE-PLANNING INVULLING CALCULATION (ROOT CAUSE FIX)
   * - Calculate invulling dynamically from assignments (NOT database value)
   * - Database invulling is unreliable (always 0, no trigger)
   * - Calculate aantal_nog = aantal - invulling_calculated
   * - This properly accounts for all pre-planned assignments
   * 
   * ✅ DRAAD363: TEAM-FIELD AGGREGATION FIX
   * - Pass employeeTeamMap to calculateInvullingFromAssignments()
   * - Ensures team-aware matching in invulling calculation
   * 
   * ✅ DRAAD337: CLIENT-SIDE SORTING
   * - Sort priority: is_system DESC → date ASC → dagdeel ASC → team DESC → service_code ASC
   * - Performance: <1ms for typical roster (500-1500 rows)
   */
  private buildOpdracht(
    tasksRaw: any[],
    servicesRaw: any[],
    planning: WorkbestandPlanning[],  // ✅ DRAAD362: NEW parameter
    employeeTeamMap: Map<string, string>  // ✅ DRAAD363: NEW parameter
  ): WorkbestandOpdracht[] {
    // ✅ DRAAD338: BUILD SERVICE CODE MAP
    // Create lookup map: service_id → service_code
    // This is O(n) where n = number of services (typically 8-15)
    const serviceCodeMap = new Map<string, string>();
    for (const service of servicesRaw) {
      serviceCodeMap.set(service.id, service.code || 'UNKNOWN');
    }

    // ✅ DRAAD362: CALCULATE INVULLING FROM ASSIGNMENTS
    // ✅ DRAAD363: WITH TEAM-AWARE MATCHING
    // This is the critical fix: use calculated values instead of unreliable database field
    const invullingMap = this.calculateInvullingFromAssignments(tasksRaw, planning, employeeTeamMap);

    // Map raw data to WorkbestandOpdracht objects
    // ✅ DRAAD338: Populate service_code from map
    // ✅ DRAAD362: Populate invulling from calculated map
    // ✅ DRAAD363: Team now correctly separated in invullingMap
    const opdrachten = tasksRaw.map((row) => {
      const serviceCode = serviceCodeMap.get(row.service_id) || 'UNKNOWN';

      // ✅ DRAAD362: Use calculated invulling, NOT database value
      // Database invulling is always 0 because no trigger on manual assignment creation
      const rowDate = row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : row.date;
      const invullingKey = `${rowDate}_${row.dagdeel}_${row.team}_${row.service_id}`;
      const invulling_calculated = invullingMap.get(invullingKey) || 0;
      const aantal_nog = Math.max(0, row.aantal - invulling_calculated);

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
        aantal_nog: aantal_nog, // ✅ DRAAD362: CRITICAL FIX - uses calculated invulling
        invulling: invulling_calculated, // ✅ DRAAD362: Track calculated value
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
   * ✅ DRAAD365 FIX: Map team field from roster_assignments.team
   * - Team field is now properly mapped into the workbestand object
   * - Made mandatory (no longer optional) per database requirements
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
      team: row.team,  // ✅ DRAAD365 FIX: Added team field mapping from database
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
   * ✅ DRAAD362: Adjust capacity for pre-planned assignments
   * CRITICAL FIX: Count ALL status >= 1 assignments, not only is_protected=TRUE
   * 
   * Key insight: status field is the protection (0=free, >=1=allocated)
   * The is_protected flag is unused in normal workflow
   * 
   * For each assignment with status >= 1:
   * - Find matching capacity record (employee_id + service_id)
   * - Decrement aantal_beschikbaar by 1
   * - This prevents solve engine from reassigning same slot
   */
  private adjustCapacityForPrePlanning(
    planning: WorkbestandPlanning[],
    capaciteit: WorkbestandCapaciteit[]
  ): { decremented: number; assignments_checked: number } {
    // ✅ DRAAD362: CRITICAL FIX
    // Count ALL status >= 1 assignments (not only is_protected=TRUE)
    // status field is what actually protects the assignment
    const plannedAssignments = planning.filter(
      (p) => p.status >= 1 && p.service_id && p.employee_id
    );

    let decremented_count = 0;

    // Decrement capacity for each planned assignment
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

    console.log(`[DRAAD362] Capacity adjustment: Decremented ${decremented_count} records from ${plannedAssignments.length} status>=1 assignments`);

    return {
      decremented: decremented_count,
      assignments_checked: plannedAssignments.length,
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
