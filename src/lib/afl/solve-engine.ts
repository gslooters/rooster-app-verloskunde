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
 * 
 * ✅ DRAAD405 PATCHES APPLIED:
 * - PATCH 1A/1B/1C: DIO/DIA validation methods
 * - PATCH 2: Enhanced findCandidates() with validation
 * - PATCH 3: Enhanced prepareForChaining() with logging
 * - PATCH 4: Cache-busting + performance optimization (v2.0)
 * - PATCH 5: ✅ TypeScript memory.property fix (use process.memoryUsage())
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
 * Performance tracking interface
 */
interface PerformanceMetrics {
  total_duration_ms: number;
  preload_duration_ms: number;
  findcandidates_calls: number;
  findcandidates_total_ms: number;
  validation_cache_hits: number;
  validation_cache_misses: number;
  chain_prep_count: number;
  chain_prep_total_ms: number;
  memory_peak_mb: number;
  cache_hit_rate: number;
}

/**
 * Solve Engine - Main FASE 2 Algorithm
 * ✅ v2.0: With cache-busting + performance instrumentation
 * ✅ v2.1: Fixed TypeScript memory property error
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
  
  // ✅ PATCH 1A/1B/1C: Team filtering verification tracking
  private team_filter_stats: Map<string, { searched_teams: string[]; found_teams: Set<string>; count: number }> = new Map();

  // ✅ PATCH 4: Cache-busting + Performance
  private dio_service_id_cache: string | null = null;
  private dio_service_id_cache_timestamp: number = 0;
  private cache_busting_timestamp: number = Date.now();
  private validation_result_cache: Map<string, boolean> = new Map();
  private performance_metrics: PerformanceMetrics = {
    total_duration_ms: 0,
    preload_duration_ms: 0,
    findcandidates_calls: 0,
    findcandidates_total_ms: 0,
    validation_cache_hits: 0,
    validation_cache_misses: 0,
    chain_prep_count: 0,
    chain_prep_total_ms: 0,
    memory_peak_mb: 0,
    cache_hit_rate: 0,
  };

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
    this.cache_busting_timestamp = Date.now(); // ✅ Set cache-buster at init
    this.preloadEmployeesByTeam();
  }

  /**
   * ✅ PATCH 4: Preload employees by team for faster lookup
   * With performance instrumentation
   */
  private preloadEmployeesByTeam(): void {
    const startTime = performance.now();
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

    this.performance_metrics.preload_duration_ms = performance.now() - startTime;

    if (this.debug_enabled) {
      console.log(`✅ SOLVE v2.1: Preloaded employees by team:`, {
        teams: Array.from(this.employees_by_team.keys()),
        total_employees: unique_employees.size,
        duration_ms: this.performance_metrics.preload_duration_ms.toFixed(2),
        timestamp: this.cache_busting_timestamp,
      });
    }
  }

  /**
   * ✅ PATCH 1A: Valideer DIO-keten volledigheid
   * 
   * Voor DIO: alle 3 dagdelen (O, M, A) moeten beschikbaar zijn (status=0)
   * Voor DIA: DIO moet al toegewezen zijn op dezelfde dag in dagdeel O
   * 
   * Returns: { valid: boolean; reason?: string }
   */
  private validateDIOChainComplete(
    employee_id: string,
    date: Date,
    team: string,
    service_code: string
  ): { valid: boolean; reason?: string } {
    const dateTime = date.getTime();
    
    // ✅ PATCH 4: Check validation cache first
    const cache_key = `${employee_id}_${dateTime}_${service_code}`;
    if (this.validation_result_cache.has(cache_key)) {
      this.performance_metrics.validation_cache_hits += 1;
      const cached = this.validation_result_cache.get(cache_key);
      return cached ? { valid: true } : { valid: false, reason: 'cached result' };
    }
    this.performance_metrics.validation_cache_misses += 1;

    // REGEL 1: DIO vereist ALLE 3 dagdelen beschikbaar
    if (service_code === 'DIO' || service_code === 'DDO') {
      const required_dagdelen = ['O', 'M', 'A'];
      const unavailable_dagdelen: string[] = [];

      for (const dagdeel of required_dagdelen) {
        const slot = this.workbestand_planning.find(
          (p) =>
            p.employee_id === employee_id &&
            p.date.getTime() === dateTime &&
            p.dagdeel === dagdeel &&
            p.status === 0 // Moet open zijn
        );

        if (!slot) {
          unavailable_dagdelen.push(dagdeel);
        }
      }

      if (unavailable_dagdelen.length > 0) {
        const result = {
          valid: false,
          reason: `DIO requires all 3 dagdelen available, missing: ${unavailable_dagdelen.join(',')}`,
        };
        this.validation_result_cache.set(cache_key, false);
        return result;
      }
    }

    // REGEL 2: DIA vereist DIO eerder in dezelfde dag
    if (service_code === 'DIA') {
      const dio_service_id = this.getDIOServiceId();

      const dio_assigned = this.workbestand_planning.some(
        (p) =>
          p.employee_id === employee_id &&
          p.date.getTime() === dateTime &&
          p.dagdeel === 'O' &&
          p.service_id === dio_service_id &&
          p.status === 1 // Must be assigned
      );

      if (!dio_assigned) {
        const result = {
          valid: false,
          reason: `DIA requires DIO to be assigned first on same day in Ochtend`,
        };
        this.validation_result_cache.set(cache_key, false);
        return result;
      }
    }

    // ✅ Cache positive result
    this.validation_result_cache.set(cache_key, true);
    return { valid: true };
  }

  /**
   * ✅ PATCH 1B + PATCH 4: Helper - Get DIO service ID
   * Enhanced with caching (avoid repeated lookups)
   */
  private getDIOServiceId(): string {
    const now = Date.now();
    
    // ✅ Cache for 60 seconds (handles Railway redeploys)
    if (
      this.dio_service_id_cache &&
      now - this.dio_service_id_cache_timestamp < 60000
    ) {
      return this.dio_service_id_cache;
    }

    const dio_service = this.workbestand_services_metadata.find(
      (s) => s.code === 'DIO'
    );
    
    const result = dio_service?.id || '';
    this.dio_service_id_cache = result;
    this.dio_service_id_cache_timestamp = now;
    
    return result;
  }

  /**
   * ✅ PATCH 1C: Check dagdeel-quota (prevent duplicates)
   * 
   * Per dagdeel mag maar 1x DIA/DIO/etc per team toegewezen zijn
   * (tenzij service-config zegt anders)
   */
  private checkDagdeelQuota(
    date: Date,
    dagdeel: string,
    team: string,
    service_id: string
  ): { available: boolean; current_count: number; max_allowed: number } {
    const dateTime = date.getTime();

    // Tellen hoeveel al toegewezen zijn
    const current_count = this.workbestand_planning.filter(
      (p) =>
        p.date.getTime() === dateTime &&
        p.dagdeel === dagdeel &&
        p.team === team &&
        p.service_id === service_id &&
        p.status === 1 // Assigned
    ).length;

    // Service config - hoeveel mag per dagdeel?
    const service_meta = this.workbestand_services_metadata.find(
      (s) => s.id === service_id
    );

    // Default: 1 per dagdeel per team (unless overridden)
    const max_allowed = 1;

    return {
      available: current_count < max_allowed,
      current_count,
      max_allowed,
    };
  }

  /**
   * ✅ PATCH 5: Get memory usage (Node.js compatible)
   * Uses process.memoryUsage() instead of performance.memory
   * Which is not available in TypeScript strict mode
   */
  private getMemoryPeakMb(): number {
    try {
      // ✅ Use Node.js native API - works in server-side context
      return process.memoryUsage().heapUsed / 1024 / 1024;
    } catch (error) {
      // Fallback if process not available
      console.warn('⚠️  Memory tracking unavailable');
      return 0;
    }
  }

  /**
   * MAIN SOLVE LOOP - FIX 1: CRITICAL LOOP CONDITION CORRECTED
   * ✅ PATCH 4: With performance metrics + cache-busting trigger
   * ✅ PATCH 5: Fixed memory tracking
   * Iterate through tasks and assign services
   */
  solve(): {
    modified_slots: WorkbestandPlanning[];
    solve_duration_ms: number;
    assigned_count: number;
    open_count: number;
    task_stats: { processed: number; open: number; total: number };
    team_filter_stats?: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }>;
    performance_metrics?: PerformanceMetrics;
    cache_busting_timestamp?: number;
  } {
    const startTime = performance.now();
    this.modified_slots = [];
    this.task_processed_count = 0;
    this.task_open_count = 0;
    this.team_filter_stats.clear();
    this.validation_result_cache.clear(); // ✅ Clear cache each solve run

    if (this.debug_enabled) {
      console.log(`🚀 SOLVE v2.1: Starting main loop with ${this.workbestand_opdracht.length} tasks`, {
        cache_busting_timestamp: this.cache_busting_timestamp,
        railway_trigger: `railway-${this.cache_busting_timestamp}`, // ✅ Railway deployment trigger
      });
    }

    // Main loop: for each task
    for (const task of this.workbestand_opdracht) {
      // ✅ FIX 1: CORRECT CONDITION
      if (task.aantal_nog === 0) {
        // ✅ Task fully assigned - skip
        this.task_processed_count++;
        continue;
      }

      // Inner loop: assign one at a time until aantal_nog = 0
      while (task.aantal_nog > 0) {
        // Step 1: Find candidates
        const findcandidates_start = performance.now();
        const candidates = this.findCandidates(task);
        this.performance_metrics.findcandidates_total_ms +=
          performance.now() - findcandidates_start;

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
          const chain_start = performance.now();
          this.prepareForChaining(task, slot);
          this.performance_metrics.chain_prep_total_ms +=
            performance.now() - chain_start;
          this.performance_metrics.chain_prep_count += 1;
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

    // ✅ Calculate final performance metrics
    this.performance_metrics.total_duration_ms = solve_duration_ms;
    this.performance_metrics.findcandidates_calls = this.team_filter_stats.size;
    this.performance_metrics.cache_hit_rate =
      this.performance_metrics.validation_cache_hits /
      (this.performance_metrics.validation_cache_hits +
        this.performance_metrics.validation_cache_misses) *
      100;
    // ✅ PATCH 5: Fixed memory tracking using Node.js API
    this.performance_metrics.memory_peak_mb = this.getMemoryPeakMb();

    // ✅ OPTIE A: Log team filter statistics
    if (this.debug_enabled) {
      const stats_for_log: Record<string, { searched_teams: string[]; found_teams: string[]; count: number }> = {};
      for (const [key, value] of this.team_filter_stats.entries()) {
        stats_for_log[key] = {
          searched_teams: value.searched_teams,
          found_teams: Array.from(value.found_teams),
          count: value.count,
        };
      }
      console.log(`✅ SOLVE v2.1: Team Filter Statistics:`, stats_for_log);
      console.log(`✅ SOLVE v2.1: Performance Metrics:`, this.performance_metrics);
    }

    if (this.debug_enabled) {
      console.log(`✅ SOLVE v2.1: Complete`, {
        duration_ms: solve_duration_ms.toFixed(0),
        assigned: assigned_count,
        open: open_count,
        modified_slots: this.modified_slots.length,
        task_stats: {
          processed: this.task_processed_count,
          open: this.task_open_count,
          total: this.workbestand_opdracht.length,
        },
        cache_hit_rate_percent: this.performance_metrics.cache_hit_rate.toFixed(1),
        memory_peak_mb: this.performance_metrics.memory_peak_mb.toFixed(2),
        railway_trigger: `railway-${this.cache_busting_timestamp}`,
      });
    }

    // ✅ OPTIE A: Return stats for reporting
    const stats_for_return: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }> = new Map();
    for (const [key, value] of this.team_filter_stats.entries()) {
      stats_for_return.set(key, {
        searched_teams: value.searched_teams,
        found_teams: Array.from(value.found_teams),
        count: value.count,
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
      performance_metrics: this.performance_metrics, // ✅ Return metrics
      cache_busting_timestamp: this.cache_busting_timestamp, // ✅ Return for Railway
    };
  }

  /**
   * Find all available candidates for a task
   * 
   * ✅ PATCH 2: Enhanced with DIO/DIA chain validation + quota check
   * ✅ PATCH 4: With performance instrumentation
   * 
   * Criteria:
   * - In correct team (or fallback)
   * - Has available slot on date/dagdeel with status=0
   * - Has capacity > 0 for this service
   * - Not blocked by pre-planning (is_protected=FALSE)
   * - ✅ PATCH 2A: QUOTA CHECK FIRST
   * - ✅ PATCH 2B: DIO/DIA CHAIN VALIDATION
   * - ✅ Employee status !== 3 (not unavailable)
   */
  private findCandidates(task: WorkbestandOpdracht): SolveCandidate[] {
    const candidates: SolveCandidate[] = [];
    this.performance_metrics.findcandidates_calls += 1;

    // ✅ PATCH 2A: QUOTA CHECK FIRST
    const quota = this.checkDagdeelQuota(
      task.date,
      task.dagdeel,
      task.team,
      task.service_id
    );

    if (!quota.available) {
      if (this.debug_enabled) {
        console.log(
          `⛔ QUOTA FULL: Service already assigned ${quota.current_count}x on ${task.dagdeel} for team ${task.team}`
        );
      }
      return []; // Return empty - quota reached
    }

    // Step 1: Determine team search order
    const teams_to_try = this.getTeamSearchOrder(task.team);

    // ✅ OPTIE A: Track team search for this task
    const task_key = `${task.date.toISOString().split('T')[0]}_${task.dagdeel}_${task.team}_${task.service_code}`;
    if (!this.team_filter_stats.has(task_key)) {
      this.team_filter_stats.set(task_key, {
        searched_teams: teams_to_try,
        found_teams: new Set<string>(),
        count: 0,
      });
    }

    if (this.debug_enabled) {
      console.log(`🔍 FINDCANDIDATES: Service=${task.service_code} Date=${task.date.toISOString().split('T')[0]} Dagdeel=${task.dagdeel} Teams=${teams_to_try.join(',')}`);\n    }\n\n    // Step 2: Search by team\n    for (const team of teams_to_try) {\n      const employees_in_team = this.employees_by_team.get(team) || [];\n\n      for (const emp of employees_in_team) {\n        // Check: Bevoegd (actief) voor deze service?\n        const capacity_row = this.workbestand_capaciteit.find(\n          (c) => c.employee_id === emp.employee_id && c.service_id === task.service_id\n        );\n\n        if (!capacity_row || !capacity_row.actief || (capacity_row.aantal_beschikbaar || 0) <= 0) {\n          continue; // Not qualified or no capacity\n        }\n\n        // ✅ PATCH 2B: DIO/DIA CHAIN VALIDATION\n        const chain_validation = this.validateDIOChainComplete(\n          emp.employee_id,\n          task.date,\n          task.team,\n          task.service_code\n        );\n\n        if (!chain_validation.valid) {\n          if (this.debug_enabled) {\n            console.log(\n              `⛔ CHAIN INVALID: ${emp.employee_id} - ${chain_validation.reason}`\n            );\n          }\n          continue; // Skip this employee\n        }\n\n        // Check: Employee status !== 3 (not unavailable)\n        // Status 3 = NB (niet beschikbaar = not available)\n        const employee_status_in_slot = this.workbestand_planning.find(\n          (p) =>\n            p.employee_id === emp.employee_id &&\n            p.date.getTime() === task.date.getTime() &&\n            p.dagdeel === task.dagdeel\n        )?.status;\n\n        if (employee_status_in_slot === 3) {\n          if (this.debug_enabled) {\n            console.log(\n              `⏭️  UNAVAILABLE: ${emp.employee_id} has status=3 on ${task.dagdeel}`\n            );\n          }\n          continue; // Status 3 = NB (not available)\n        }\n\n        // Check: Available slot on this date/dagdeel/status=0?\n        const available_slot = this.workbestand_planning.find(\n          (p) =>\n            p.employee_id === emp.employee_id &&\n            p.date.getTime() === task.date.getTime() &&\n            p.dagdeel === task.dagdeel &&\n            p.status === 0 &&\n            !p.is_protected\n        );\n\n        if (!available_slot) {\n          continue; // No slot available\n        }\n\n        // ✅ Valid candidate found\n        candidates.push({\n          employee_id: emp.employee_id,\n          employee_name: emp.employee_name,\n          team: emp.team,\n          dienstverband: emp.dienstverband,\n          capacity_remaining: capacity_row.aantal_beschikbaar || 0,\n          last_worked: emp.last_worked,\n          fair_score: emp.fair_score,\n          slot: available_slot,\n        });\n\n        // ✅ OPTIE A: Track team of found candidate\n        if (this.team_filter_stats.has(task_key)) {\n          const stats = this.team_filter_stats.get(task_key)!;\n          stats.found_teams.add(emp.team);\n          stats.count += 1;\n        }\n      }\n\n      // If candidates found, don't try next team (fallback only if empty)\n      if (candidates.length > 0) {\n        if (this.debug_enabled) {\n          const stats = this.team_filter_stats.get(task_key);\n          console.log(`✅ FOUND: ${candidates.length} candidates in teams:`, Array.from(stats?.found_teams || []));\n        }\n        break;\n      }\n    }\n\n    if (candidates.length === 0 && this.debug_enabled) {\n      console.log(\n        `❌ NO CANDIDATES: Service ${task.service_code} on ${task.dagdeel}`\n      );\n    }\n\n    return candidates;\n  }\n\n  /**\n   * Determine team search order (primary team first, then fallbacks)\n   * FIX 2: CORRECTED TEAM NAME MAPPING\n   * ✅ OPTIE A: Strict team isolation\n   */\n  private getTeamSearchOrder(team: string): string[] {\n    // ✅ FIX 2: Use correct database team names\n    // ✅ OPTIE A: Strict search order - GRO NEVER looks in ORA, ORA NEVER in GRO\n    switch (team) {\n      case 'GRO':\n        return ['Groen', 'Overig']; // GRO: First Groen, then Overig (NEVER Oranje)\n      case 'ORA':\n        return ['Oranje', 'Overig']; // ORA: First Oranje, then Overig (NEVER Groen)\n      case 'TOT':\n        return ['Groen', 'Oranje', 'Overig']; // TOT: All teams\n      default:\n        return ['Groen', 'Oranje', 'Overig'];\n    }\n  }\n\n  /**\n   * Get all employees in a specific team\n   * Use preloaded cache\n   */\n  private getEmployeesByTeam(team: string): any[] {\n    return this.employees_by_team.get(team) || [];\n  }\n\n  /**\n   * Get employee info by ID\n   * Build from capacity data + planning data\n   */\n  private getEmployeeInfo(employee_id: string): any {\n    // Check cache first\n    if (this.employee_cache.has(employee_id)) {\n      return this.employee_cache.get(employee_id);\n    }\n\n    // Extract from capacity data\n    const capacity_row = this.workbestand_capaciteit.find((c) => c.employee_id === employee_id);\n    if (!capacity_row) {\n      return null; // Unknown employee\n    }\n\n    // Get last worked date\n    const last_slot = this.workbestand_planning\n      .filter((p) => p.employee_id === employee_id && p.status === 1 && p.service_id)\n      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];\n\n    const emp_info = {\n      employee_id,\n      employee_name: employee_id, // Simplified: use ID as name (can be enhanced)\n      team: this.extractTeamFromEmployeeId(employee_id),\n      dienstverband: 'Maat', // Simplified: default\n      last_worked: last_slot?.date || null,\n      fair_score: this.calculateFairnessScore(employee_id),\n    };\n\n    this.employee_cache.set(employee_id, emp_info);\n    return emp_info;\n  }\n\n  /**\n   * Extract team from employee capacity data ONLY\n   * ✅ DRAAD 342 PRIORITEIT 2: Cleaned up to use ONLY workbestand_capaciteit.team\n   * \n   * REASON:\n   * - roster_assignments (planning source) has NO team column\n   * - The authoritative team source is roster_employee_services.team\n   * - Which gets mapped into workbestand_capaciteit.team\n   * \n   * This method now uses ONE clear source, not multiple fallbacks\n   */\n  private extractTeamFromEmployeeId(employee_id: string): string {\n    // ✅ ONLY source: workbestand_capaciteit (which comes from roster_employee_services)\n    const capacity_rows = this.workbestand_capaciteit.filter(\n      (c) => c.employee_id === employee_id\n    );\n\n    if (capacity_rows.length > 0) {\n      // Get first non-empty team or fallback\n      const teams = capacity_rows.map((c) => c.team).filter(Boolean);\n      if (teams.length > 0) {\n        return teams[0];\n      }\n    }\n\n    // Safe default if no capacity found\n    return 'Overig';\n  }\n\n  /**\n   * Calculate fairness score for an employee\n   * Lower score = recently worked more = should get fewer assignments\n   * 0.0 = brand new, 1.0 = hasn't worked in a while\n   */\n  private calculateFairnessScore(employee_id: string): number {\n    // Count recent assignments\n    const recent_count = this.workbestand_planning.filter(\n      (p) =>\n        p.employee_id === employee_id &&\n        p.status === 1 &&\n        p.service_id &&\n        p.date.getTime() >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()\n    ).length;\n\n    // Normalize: fewer recent assignments = higher score\n    const max_recent = 10;\n    return Math.max(0, Math.min(1, 1 - recent_count / max_recent));\n  }\n\n  /**\n   * Select the BEST candidate using tiebreaker logic\n   * \n   * Tiebreaker order:\n   * 1. PRIMARY: Capacity remaining (higher = better)\n   * 2. SECONDARY: Fairness score (lower = recently worked, better to skip)\n   * 3. TERTIARY: Alphabetical name (deterministic)\n   */\n  private selectBestCandidate(candidates: SolveCandidate[]): SolveCandidate {\n    const sorted = candidates.sort((a, b) => {\n      // Primary: Capacity remaining (DESC - higher is better)\n      if (a.capacity_remaining !== b.capacity_remaining) {\n        return b.capacity_remaining - a.capacity_remaining;\n      }\n\n      // Secondary: Fairness score (ASC - lower means recently worked more)\n      if (a.fair_score !== b.fair_score) {\n        return a.fair_score - b.fair_score;\n      }\n\n      // Tertiary: Name (alphabetical, deterministic)\n      return a.employee_name.localeCompare(b.employee_name, 'nl');\n    });\n\n    return sorted[0];\n  }\n\n  /**\n   * Decrement capacity for employee/service\n   */\n  private decrementCapacity(employee_id: string, service_id: string): void {\n    const capacity = this.workbestand_capaciteit.find(\n      (c) => c.employee_id === employee_id && c.service_id === service_id\n    );\n\n    if (capacity && capacity.aantal_beschikbaar !== undefined) {\n      capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);\n    }\n  }\n\n  /**\n   * ✅ PATCH 3: Prepare for DIO/DDO chaining (Phase 3 prep)\n   * Enhanced with comprehensive logging\n   * \n   * DIO logic:\n   * - Ochtend: Assign DIO\n   * - Middag: Block (werkt al)\n   * - Avond: Assign DIA (auto)\n   * - Next day O+M: Block (too tired)\n   */\n  private prepareForChaining(task: WorkbestandOpdracht, slot: WorkbestandPlanning): void {\n    const employee_id = slot.employee_id;\n    const assign_date = slot.date;\n    const service_code = task.service_code;\n\n    // DIO only applies to Ochtend dagdeel\n    if (slot.dagdeel !== 'O' || !['DIO', 'DDO'].includes(service_code)) {\n      return;\n    }\n\n    if (this.debug_enabled) {\n      console.log(\n        `🔗 CHAIN START: ${employee_id} - ${service_code} on ${assign_date.toISOString().split('T')[0]}`\n      );\n    }\n\n    // Step 1: Block Middag (same day)\n    const middag_slot = this.workbestand_planning.find(\n      (p) =>\n        p.employee_id === employee_id &&\n        p.date.getTime() === assign_date.getTime() &&\n        p.dagdeel === 'M' &&\n        p.status === 0\n    );\n\n    if (middag_slot) {\n      middag_slot.status = 2; // Blocked\n      middag_slot.blocked_by_date = assign_date;\n      middag_slot.blocked_by_dagdeel = 'O';\n      middag_slot.blocked_by_service_id = task.service_id;\n      middag_slot.is_modified = true;\n      this.modified_slots.push(middag_slot);\n\n      if (this.debug_enabled) {\n        console.log(\n          `  ✅ BLOCKED: Middag (already works ${service_code} in Ochtend)`\n        );\n      }\n    } else {\n      if (this.debug_enabled) {\n        console.log(\n          `  ⚠️  MIDDAG SLOT NOT FOUND (might already be blocked/assigned)`\n        );\n      }\n    }\n\n    // Step 2: Assign DIA to Avond (same day)\n    const avond_slot = this.workbestand_planning.find(\n      (p) =>\n        p.employee_id === employee_id &&\n        p.date.getTime() === assign_date.getTime() &&\n        p.dagdeel === 'A' &&\n        p.status === 0\n    );\n\n    if (avond_slot) {\n      const dia_service = this.workbestand_services_metadata.find(\n        (s) => s.code === 'DIA'\n      );\n\n      if (dia_service) {\n        avond_slot.service_id = dia_service.id;\n        avond_slot.status = 1; // Assigned\n        avond_slot.source = 'autofill';\n        avond_slot.is_modified = true;\n        this.modified_slots.push(avond_slot);\n\n        if (this.debug_enabled) {\n          console.log(\n            `  ✅ DIA ASSIGNED: Avond (${employee_id})`\n          );\n        }\n\n        // Update capacity for DIA\n        this.decrementCapacity(employee_id, dia_service.id);\n      } else {\n        if (this.debug_enabled) {\n          console.log(`  ❌ DIA SERVICE NOT FOUND`);\n        }\n      }\n    } else {\n      if (this.debug_enabled) {\n        console.log(\n          `  ⚠️  AVOND SLOT NOT FOUND (cannot assign DIA)`\n        );\n      }\n    }\n\n    // Step 3: Block next day O+M (if not beyond end date)\n    const next_date = new Date(assign_date.getTime() + 24 * 60 * 60 * 1000);\n    if (next_date.getTime() <= this.rooster_end_date.getTime()) {\n      // Block next day Ochtend\n      const next_ochtend = this.workbestand_planning.find(\n        (p) =>\n          p.employee_id === employee_id &&\n          p.date.getTime() === next_date.getTime() &&\n          p.dagdeel === 'O' &&\n          p.status === 0\n      );\n\n      if (next_ochtend) {\n        next_ochtend.status = 2; // Blocked\n        next_ochtend.blocked_by_date = assign_date;\n        next_ochtend.blocked_by_dagdeel = 'O';\n        next_ochtend.blocked_by_service_id = task.service_id;\n        next_ochtend.constraint_reason = {\n          reason: 'DIO_recovery',\n          by_service_code: service_code,\n        };\n        next_ochtend.is_modified = true;\n        this.modified_slots.push(next_ochtend);\n\n        if (this.debug_enabled) {\n          console.log(\n            `  ✅ BLOCKED: Next day Ochtend (recovery)`\n          );\n        }\n      }\n\n      // Block next day Middag\n      const next_middag = this.workbestand_planning.find(\n        (p) =>\n          p.employee_id === employee_id &&\n          p.date.getTime() === next_date.getTime() &&\n          p.dagdeel === 'M' &&\n          p.status === 0\n      );\n\n      if (next_middag) {\n        next_middag.status = 2; // Blocked\n        next_middag.blocked_by_date = assign_date;\n        next_middag.blocked_by_dagdeel = 'O';\n        next_middag.blocked_by_service_id = task.service_id;\n        next_middag.constraint_reason = {\n          reason: 'DIO_recovery',\n          by_service_code: service_code,\n        };\n        next_middag.is_modified = true;\n        this.modified_slots.push(next_middag);\n\n        if (this.debug_enabled) {\n          console.log(\n            `  ✅ BLOCKED: Next day Middag (recovery)`\n          );\n        }\n      }\n    }\n\n    if (this.debug_enabled) {\n      console.log(\n        `🔗 CHAIN COMPLETE: ${employee_id} ${service_code} chain processed`\n      );\n    }\n  }\n\n  /**\n   * Count assigned services\n   */\n  private countAssignedServices(): number {\n    return this.workbestand_planning.filter((p) => p.status === 1 && p.service_id).length;\n  }\n\n  /**\n   * Count open services (assignments not made)\n   */\n  private countOpenServices(): number {\n    return this.workbestand_opdracht.reduce((sum, task) => sum + task.aantal_nog, 0);\n  }\n}\n\n/**\n * Helper: Create SolveEngine and run solve\n * ✅ v2.1: Fixed TypeScript memory property error\n * ✅ Returns performance metrics + cache-busting timestamp\n */\nexport async function runSolveEngine(\n  workbestand_opdracht: WorkbestandOpdracht[],\n  workbestand_planning: WorkbestandPlanning[],\n  workbestand_capaciteit: WorkbestandCapaciteit[],\n  workbestand_services_metadata: WorkbestandServicesMetadata[],\n  rooster_start_date: Date,\n  rooster_end_date: Date\n): Promise<{\n  modified_slots: WorkbestandPlanning[];\n  solve_duration_ms: number;\n  assigned_count: number;\n  open_count: number;\n  task_stats: { processed: number; open: number; total: number };\n  team_filter_stats?: Map<string, { searched_teams: string[]; found_teams: string[]; count: number }>;\n  performance_metrics?: PerformanceMetrics;\n  cache_busting_timestamp?: number;\n}> {\n  const engine = new SolveEngine(\n    workbestand_opdracht,\n    workbestand_planning,\n    workbestand_capaciteit,\n    workbestand_services_metadata,\n    rooster_start_date,\n    rooster_end_date\n  );\n\n  return engine.solve();\n}\n