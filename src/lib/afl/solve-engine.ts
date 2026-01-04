/**
 * AFL (Autofill) - Phase 2: Solve Loop Engine
 * 
 * Main algorithm that:
 * - Iterates through all tasks in order
 * - Finds available employees for each task
 * - Selects best candidate using tiebreakers
 * - Assigns service to employee
 * - Updates capacity tracking
 * - Handles DIO/DDO special logic (prep work)
 * 
 * Performance target: 3-5 seconds for full roster
 * Coverage target: 87-95% (210-240 services assigned)
 */

import {
  WorkbestandOpdracht,
  WorkbestandPlanning,
  WorkbestandCapaciteit,
  WorkbestandServicesMetadata,
  EmployeeCandidate,
} from './types';

/**
 * Candidate metadata for selection
 * Extended with additional fields for tiebreaker logic
 */
interface SolveCandidate extends EmployeeCandidate {
  slot: WorkbestandPlanning; // The actual planning slot to assign
}

/**
 * Solve Engine - Main FASE 2 Algorithm
 */
export class SolveEngine {
  private workbestand_opdracht: WorkbestandOpdracht[];
  private workbestand_planning: WorkbestandPlanning[];
  private workbestand_capaciteit: WorkbestandCapaciteit[];
  private workbestand_services_metadata: WorkbestandServicesMetadata[];
  private rooster_start_date: Date;
  private rooster_end_date: Date;
  private employees_by_team: Map<string, any[]> = new Map();

  // Tracking
  private modified_slots: WorkbestandPlanning[] = [];
  private employee_cache: Map<string, any> = new Map();
  private task_processed_count: number = 0;
  private task_open_count: number = 0;
  private debug_enabled: boolean = true;
  
  // ✅ OPTIE A: Team filtering verification tracking
  private team_filter_stats: Map<string, { searched_teams: string[]; found_teams: Set<string>; count: number }> = new Map();

  constructor(
    opdracht: WorkbestandOpdracht[],
    planning: WorkbestandPlanning[],
    capaciteit: WorkbestandCapaciteit[],
    services: WorkbestandServicesMetadata[],
    rooster_start_date: Date,
    rooster_end_date: Date
  ) {
    this.workbestand_opdracht = opdracht;
    this.workbestand_planning = planning;
    this.workbestand_capaciteit = capaciteit;
    this.workbestand_services_metadata = services;
    this.rooster_start_date = rooster_start_date;
    this.rooster_end_date = rooster_end_date;
    this.preloadEmployeesByTeam();
  }

  /**
   * Preload employees by team for faster lookup
   */
  private preloadEmployeesByTeam(): void {
    const unique_employees = new Map<string, any>();

    // Extract from planning data
    for (const slot of this.workbestand_planning) {
      if (!unique_employees.has(slot.employee_id)) {
        const emp_info = this.getEmployeeInfo(slot.employee_id);
        if (emp_info) {
          const team = emp_info.team || 'Overig';
          if (!this.employees_by_team.has(team)) {
            this.employees_by_team.set(team, []);
          }
          this.employees_by_team.get(team)!.push(emp_info);
          unique_employees.set(slot.employee_id, emp_info);
        }
      }
    }

    if (this.debug_enabled) {
      console.log(`✅ SOLVE: Preloaded employees by team:`, {
        teams: Array.from(this.employees_by_team.keys()),
        total_employees: unique_employees.size,
      });
    }
  }

  /**
   * MAIN SOLVE LOOP - FIX 1: CRITICAL LOOP CONDITION CORRECTED
   * Iterate through tasks and assign services
   */
  solve(): {
    modified_slots: WorkbestandPlanning[];
    solve_duration_ms: number;
    assigned_count: number;
    open_count: number;
    task_stats: { processed: number; open: number; total: number };
    team_filter_stats?: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }>; // ✅ OPTIE A
  } {
    const startTime = performance.now();
    this.modified_slots = [];
    this.task_processed_count = 0;
    this.task_open_count = 0;
    this.team_filter_stats.clear(); // ✅ OPTIE A: Reset stats

    if (this.debug_enabled) {
      console.log(`🚀 SOLVE: Starting main loop with ${this.workbestand_opdracht.length} tasks`);
    }

    // Main loop: for each task
    for (const task of this.workbestand_opdracht) {
      // ✅ FIX 1: CORRECT CONDITION
      // OLD (WRONG): const still_needed = task.aantal - task.aantal_nog;
      //               if (still_needed > 0) continue;  ← SKIPS task when work is DONE
      // NEW (CORRECT): if (task.aantal_nog === 0) continue;  ← SKIPS task only when FULLY assigned

      // Check: How many still need assignment?
      if (task.aantal_nog === 0) {
        // ✅ Task fully assigned - skip
        this.task_processed_count++;
        continue;
      }

      // Inner loop: assign one at a time until aantal_nog = 0
      while (task.aantal_nog > 0) {
        // Step 1: Find candidates
        const candidates = this.findCandidates(task);

        if (candidates.length === 0) {
          // ❌ No available employees - task remains OPEN
          this.task_open_count++;
          if (this.debug_enabled) {
            console.log(`⚠️  SOLVE: No candidates for task:`, {
              date: task.date,
              dagdeel: task.dagdeel,
              team: task.team,
              service_code: task.service_code,
              still_needed: task.aantal_nog,
            });
          }
          break;
        }

        // Step 2: Select best candidate
        const best = this.selectBestCandidate(candidates);

        // Step 3: Get the actual planning slot
        const slot = best.slot;
        if (!slot) {
          // This shouldn't happen by design
          break;
        }

        // Step 4: Assign service to slot
        slot.service_id = task.service_id;
        slot.status = 1; // Assigned
        slot.source = 'autofill';
        slot.is_modified = true;
        this.modified_slots.push(slot);

        // Step 5: Update capacity
        this.decrementCapacity(best.employee_id, task.service_id);

        // Step 6: Update task counter
        task.aantal_nog -= 1;

        // Step 7: Handle DIO/DDO chain prep (Phase 2 job)
        if (['DIO', 'DDO'].includes(task.service_code)) {
          this.prepareForChaining(task, slot);
        }
      }

      // After task fully processed or opened
      if (task.aantal_nog === 0) {
        this.task_processed_count++;
      } else {
        this.task_open_count++;
      }
    }

    const solve_duration_ms = performance.now() - startTime;
    const assigned_count = this.countAssignedServices();
    const open_count = this.countOpenServices();

    // ✅ OPTIE A: Log team filter statistics
    if (this.debug_enabled) {
      const stats_for_log: Record<string, { searched_teams: string[]; found_teams: string[]; count: number }> = {};
      for (const [key, value] of this.team_filter_stats.entries()) {
        stats_for_log[key] = {
          searched_teams: value.searched_teams,
          found_teams: Array.from(value.found_teams),
          count: value.count
        };
      }
      console.log(`✅ SOLVE: Team Filter Statistics:`, stats_for_log);
    }

    if (this.debug_enabled) {
      console.log(`✅ SOLVE: Complete`, {
        duration_ms: solve_duration_ms.toFixed(0),
        assigned: assigned_count,
        open: open_count,
        modified_slots: this.modified_slots.length,
        task_stats: {
          processed: this.task_processed_count,
          open: this.task_open_count,
          total: this.workbestand_opdracht.length,
        },
      });
    }

    // ✅ OPTIE A: Return stats for reporting
    const stats_for_return: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }> = new Map();
    for (const [key, value] of this.team_filter_stats.entries()) {
      stats_for_return.set(key, {
        searched_teams: value.searched_teams,
        found_teams: Array.from(value.found_teams),
        count: value.count
      });
    }

    return {
      modified_slots: this.modified_slots,
      solve_duration_ms,
      assigned_count,
      open_count,
      task_stats: {
        processed: this.task_processed_count,
        open: this.task_open_count,
        total: this.workbestand_opdracht.length,
      },
      team_filter_stats: stats_for_return,
    };
  }

  /**
   * Find all available candidates for a task
   * 
   * ✅ FOUT 1 FIX: Status check ontbreekt
   * 
   * Criteria:
   * - In correct team (or fallback)
   * - Has available slot on date/dagdeel with status=0
   * - Has capacity > 0 for this service
   * - Not blocked by pre-planning (is_protected=FALSE)
   * - ✅ NEW: Employee status !== 3 (not unavailable)
   */
  private findCandidates(task: WorkbestandOpdracht): SolveCandidate[] {
    const candidates: SolveCandidate[] = [];

    // Step 1: Determine team search order
    const teams_to_try = this.getTeamSearchOrder(task.team);

    // ✅ OPTIE A: Track team search for this task
    const task_key = `${task.date.toISOString().split('T')[0]}_${task.dagdeel}_${task.team}_${task.service_code}`;
    if (!this.team_filter_stats.has(task_key)) {
      this.team_filter_stats.set(task_key, {
        searched_teams: teams_to_try,
        found_teams: new Set<string>(),
        count: 0
      });
    }

    if (this.debug_enabled) {
      console.log(`🔍 TEAM FILTER: Task team=${task.team}, searching in:`, teams_to_try);
    }

    // Step 2: Search by team
    for (const team of teams_to_try) {
      // Find all employees in this team
      const employees_in_team = this.employees_by_team.get(team) || [];

      // For each employee
      for (const emp of employees_in_team) {
        // Check: Bevoegd (actief) voor deze service?
        const capacity_row = this.workbestand_capaciteit.find(
          (c) => c.employee_id === emp.employee_id && c.service_id === task.service_id
        );

        if (!capacity_row || !capacity_row.actief || (capacity_row.aantal_beschikbaar || 0) <= 0) {
          continue; // Not qualified or no capacity
        }

        // ✅ FOUT 1 FIX: Check employee status !== 3 (not unavailable)
        // Status 3 = NB (niet beschikbaar = not available)
        // We need to check the employee's status in their planning slot
        const employee_status_in_slot = this.workbestand_planning.find(
          (p) =>
            p.employee_id === emp.employee_id &&
            p.date.getTime() === task.date.getTime() &&
            p.dagdeel === task.dagdeel
        )?.status;

        // If status=3 (NB), skip this employee - they are unavailable
        if (employee_status_in_slot === 3) {
          if (this.debug_enabled) {
            console.log(`⏭️  FOUT 1 FIX: Skipping employee ${emp.employee_id} (status=3/NB on ${task.date.toISOString().split('T')[0]})`);
          }
          continue;
        }

        // Check: Available slot on this date/dagdeel/status=0?
        const available_slot = this.workbestand_planning.find(
          (p) =>
            p.employee_id === emp.employee_id &&
            p.date.getTime() === task.date.getTime() &&
            p.dagdeel === task.dagdeel &&
            p.status === 0 &&
            !p.is_protected
        );

        if (!available_slot) {
          continue; // No slot available
        }

        // ✅ Valid candidate found
        candidates.push({
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          team: emp.team,
          dienstverband: emp.dienstverband,
          capacity_remaining: capacity_row.aantal_beschikbaar || 0,
          last_worked: emp.last_worked,
          fair_score: emp.fair_score,
          slot: available_slot,
        });

        // ✅ OPTIE A: Track team of found candidate
        if (this.team_filter_stats.has(task_key)) {
          const stats = this.team_filter_stats.get(task_key)!;
          stats.found_teams.add(emp.team);
          stats.count += 1;
        }
      }

      // If candidates found, don't try next team (fallback only if empty)
      if (candidates.length > 0) {
        if (this.debug_enabled) {
          const stats = this.team_filter_stats.get(task_key);
          console.log(`✅ FOUND: ${candidates.length} candidates in teams:`, Array.from(stats?.found_teams || []));
        }
        break;
      }
    }

    if (candidates.length === 0 && this.debug_enabled) {
      console.log(`❌ NO CANDIDATES: No employees available in teams:`, teams_to_try);
    }

    return candidates;
  }

  /**
   * Determine team search order (primary team first, then fallbacks)
   * FIX 2: CORRECTED TEAM NAME MAPPING
   * ✅ OPTIE A: Strict team isolation
   */
  private getTeamSearchOrder(team: string): string[] {
    // ✅ FIX 2: Use correct database team names
    // ✅ OPTIE A: Strict search order - GRO NEVER looks in ORA, ORA NEVER in GRO
    switch (team) {
      case 'GRO':
        return ['Groen', 'Overig']; // GRO: First Groen, then Overig (NEVER Oranje)
      case 'ORA':
        return ['Oranje', 'Overig']; // ORA: First Oranje, then Overig (NEVER Groen)
      case 'TOT':
        return ['Groen', 'Oranje', 'Overig']; // TOT: All teams
      default:
        return ['Groen', 'Oranje', 'Overig'];
    }
  }

  /**
   * Get all employees in a specific team
   * Use preloaded cache
   */
  private getEmployeesByTeam(team: string): any[] {
    return this.employees_by_team.get(team) || [];
  }

  /**
   * Get employee info by ID
   * Build from capacity data + planning data
   */
  private getEmployeeInfo(employee_id: string): any {
    // Check cache first
    if (this.employee_cache.has(employee_id)) {
      return this.employee_cache.get(employee_id);
    }

    // Extract from capacity data
    const capacity_row = this.workbestand_capaciteit.find((c) => c.employee_id === employee_id);
    if (!capacity_row) {
      return null; // Unknown employee
    }

    // Get last worked date
    const last_slot = this.workbestand_planning
      .filter((p) => p.employee_id === employee_id && p.status === 1 && p.service_id)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    const emp_info = {
      employee_id,
      employee_name: employee_id, // Simplified: use ID as name (can be enhanced)
      team: this.extractTeamFromEmployeeId(employee_id),
      dienstverband: 'Maat', // Simplified: default
      last_worked: last_slot?.date || null,
      fair_score: this.calculateFairnessScore(employee_id),
    };

    this.employee_cache.set(employee_id, emp_info);
    return emp_info;
  }

  /**
   * Extract team from employee capacity data ONLY
   * ✅ DRAAD 342 PRIORITEIT 2: Cleaned up to use ONLY workbestand_capaciteit.team
   * 
   * REASON:
   * - roster_assignments (planning source) has NO team column
   * - The authoritative team source is roster_employee_services.team
   * - Which gets mapped into workbestand_capaciteit.team
   * 
   * This method now uses ONE clear source, not multiple fallbacks
   */
  private extractTeamFromEmployeeId(employee_id: string): string {
    // ✅ ONLY source: workbestand_capaciteit (which comes from roster_employee_services)
    const capacity_rows = this.workbestand_capaciteit.filter(
      (c) => c.employee_id === employee_id
    );

    if (capacity_rows.length > 0) {
      // Get first non-empty team or fallback
      const teams = capacity_rows.map((c) => c.team).filter(Boolean);
      if (teams.length > 0) {
        return teams[0];
      }
    }

    // Safe default if no capacity found
    return 'Overig';
  }

  /**
   * Calculate fairness score for an employee
   * Lower score = recently worked more = should get fewer assignments
   * 0.0 = brand new, 1.0 = hasn't worked in a while
   */
  private calculateFairnessScore(employee_id: string): number {
    // Count recent assignments
    const recent_count = this.workbestand_planning.filter(
      (p) =>
        p.employee_id === employee_id &&
        p.status === 1 &&
        p.service_id &&
        p.date.getTime() >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
    ).length;

    // Normalize: fewer recent assignments = higher score
    const max_recent = 10;
    return Math.max(0, Math.min(1, 1 - recent_count / max_recent));
  }

  /**
   * Select the BEST candidate using tiebreaker logic
   * 
   * Tiebreaker order:
   * 1. PRIMARY: Capacity remaining (higher = better)
   * 2. SECONDARY: Fairness score (lower = recently worked, better to skip)
   * 3. TERTIARY: Alphabetical name (deterministic)
   */
  private selectBestCandidate(candidates: SolveCandidate[]): SolveCandidate {
    const sorted = candidates.sort((a, b) => {
      // Primary: Capacity remaining (DESC - higher is better)
      if (a.capacity_remaining !== b.capacity_remaining) {
        return b.capacity_remaining - a.capacity_remaining;
      }

      // Secondary: Fairness score (ASC - lower means recently worked more)
      if (a.fair_score !== b.fair_score) {
        return a.fair_score - b.fair_score;
      }

      // Tertiary: Name (alphabetical, deterministic)
      return a.employee_name.localeCompare(b.employee_name, 'nl');
    });

    return sorted[0];
  }

  /**
   * Decrement capacity for employee/service
   */
  private decrementCapacity(employee_id: string, service_id: string): void {
    const capacity = this.workbestand_capaciteit.find(
      (c) => c.employee_id === employee_id && c.service_id === service_id
    );

    if (capacity && capacity.aantal_beschikbaar !== undefined) {
      capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);
    }
  }

  /**
   * Prepare for DIO/DDO chaining (Phase 3 prep)
   * 
   * DIO logic:
   * - Ochtend: Assign DIO
   * - Middag: Block (werkt al)
   * - Avond: Assign DIA (auto)
   * - Next day O+M: Block (too tired)
   */
  private prepareForChaining(task: WorkbestandOpdracht, slot: WorkbestandPlanning): void {
    const employee_id = slot.employee_id;
    const assign_date = slot.date;
    const service_code = task.service_code;

    // DIO only applies to Ochtend dagdeel
    if (slot.dagdeel !== 'O' || !['DIO', 'DDO'].includes(service_code)) {
      return;
    }

    // Step 1: Block Middag (same day)
    const middag_slot = this.workbestand_planning.find(
      (p) =>
        p.employee_id === employee_id &&
        p.date.getTime() === assign_date.getTime() &&
        p.dagdeel === 'M' &&
        p.status === 0
    );

    if (middag_slot) {
      middag_slot.status = 2; // Blocked
      middag_slot.blocked_by_date = assign_date;
      middag_slot.blocked_by_dagdeel = 'O';
      middag_slot.blocked_by_service_id = task.service_id;
      middag_slot.is_modified = true;
      this.modified_slots.push(middag_slot);
    }

    // Step 2: Assign DIA to Avond (same day)
    const avond_slot = this.workbestand_planning.find(
      (p) =>
        p.employee_id === employee_id &&
        p.date.getTime() === assign_date.getTime() &&
        p.dagdeel === 'A' &&
        p.status === 0
    );

    if (avond_slot) {
      // Find DIA service
      const dia_service = this.workbestand_services_metadata.find((s) => s.code === 'DIA');
      if (dia_service) {
        avond_slot.service_id = dia_service.id;
        avond_slot.status = 1; // Assigned
        avond_slot.source = 'autofill';
        avond_slot.is_modified = true;
        this.modified_slots.push(avond_slot);

        // Update capacity for DIA
        this.decrementCapacity(employee_id, dia_service.id);
      }
    }

    // Step 3: Block next day O+M (if not beyond end date)
    const next_date = new Date(assign_date.getTime() + 24 * 60 * 60 * 1000);
    if (next_date.getTime() <= this.rooster_end_date.getTime()) {
      // Block next day Ochtend
      const next_ochtend = this.workbestand_planning.find(
        (p) =>
          p.employee_id === employee_id &&
          p.date.getTime() === next_date.getTime() &&
          p.dagdeel === 'O' &&
          p.status === 0
      );

      if (next_ochtend) {
        next_ochtend.status = 2; // Blocked
        next_ochtend.blocked_by_date = assign_date;
        next_ochtend.blocked_by_dagdeel = 'O';
        next_ochtend.blocked_by_service_id = task.service_id;
        next_ochtend.constraint_reason = {
          reason: 'DIO_recovery',
          by_service_code: service_code,
        };
        next_ochtend.is_modified = true;
        this.modified_slots.push(next_ochtend);
      }

      // Block next day Middag
      const next_middag = this.workbestand_planning.find(
        (p) =>
          p.employee_id === employee_id &&
          p.date.getTime() === next_date.getTime() &&
          p.dagdeel === 'M' &&
          p.status === 0
      );

      if (next_middag) {
        next_middag.status = 2; // Blocked
        next_middag.blocked_by_date = assign_date;
        next_middag.blocked_by_dagdeel = 'O';
        next_middag.blocked_by_service_id = task.service_id;
        next_middag.constraint_reason = {
          reason: 'DIO_recovery',
          by_service_code: service_code,
        };
        next_middag.is_modified = true;
        this.modified_slots.push(next_middag);
      }
    }
  }

  /**
   * Count assigned services
   */
  private countAssignedServices(): number {
    return this.workbestand_planning.filter((p) => p.status === 1 && p.service_id).length;
  }

  /**
   * Count open services (assignments not made)
   */
  private countOpenServices(): number {
    return this.workbestand_opdracht.reduce((sum, task) => sum + task.aantal_nog, 0);
  }
}

/**
 * Helper: Create SolveEngine and run solve
 */
export async function runSolveEngine(
  workbestand_opdracht: WorkbestandOpdracht[],
  workbestand_planning: WorkbestandPlanning[],
  workbestand_capaciteit: WorkbestandCapaciteit[],
  workbestand_services_metadata: WorkbestandServicesMetadata[],
  rooster_start_date: Date,
  rooster_end_date: Date
): Promise<{
  modified_slots: WorkbestandPlanning[];
  solve_duration_ms: number;
  assigned_count: number;
  open_count: number;
  task_stats: { processed: number; open: number; total: number };
  team_filter_stats?: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }>; // ✅ OPTIE A
}> {
  const engine = new SolveEngine(
    workbestand_opdracht,
    workbestand_planning,
    workbestand_capaciteit,
    workbestand_services_metadata,
    rooster_start_date,
    rooster_end_date
  );

  return engine.solve();
}
