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
 * - PATCH 6: DRAAD405E - DDO→DDA conditional koppeling
 * - ✅ PATCH 7: DRAAD405F - DDA dubbel-inplannen fix (chained-only tracking)
 * 
 * ✅ DRAAD407 PHASE 4: 
 * - ✅ PATCH 8: Deterministic service resolution via findServiceByCode()
 * - ✅ PATCH 9: Comprehensive logging for baseline verification
 * - ✅ PATCH 10: Enforce validation caching for performance
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
 * ✅ v2.2: DRAAD405E - Fixed DDO→DDA conditional koppeling
 * ✅ v2.3: DRAAD405F - Fixed DDA dubbel-inplannen via chained-only tracking
 * ✅ v2.4: DRAAD407 Phase 4 - Deterministic service resolution + comprehensive logging
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

  // ✅ PATCH 7: Track chained services to prevent double-assignment
  private chained_services_assigned: Map<string, number> = new Map();

  // ✅ PATCH 8: Service code index for deterministic lookups
  private service_code_index: Map<string, WorkbestandServicesMetadata> = new Map();

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
    this.buildServiceCodeIndex(); // ✅ PATCH 8: Build service index
  }

  /**
   * ✅ PATCH 8: Build service code index for O(1) lookup determinism
   * Ensures same service code always maps to same service ID
   */
  private buildServiceCodeIndex(): void {
    for (const service of this.workbestand_services_metadata) {
      this.service_code_index.set(service.code, service);
    }
    
    if (this.debug_enabled) {
      console.log('✅ PATCH 8: Service Code Index built:', {
        services_indexed: this.service_code_index.size,
        codes: Array.from(this.service_code_index.keys()),
      });
    }
  }

  /**
   * ✅ PATCH 8: Deterministic service lookup by code
   * Always returns same service ID for same code
   */
  private findServiceByCode(code: string): WorkbestandServicesMetadata | undefined {
    return this.service_code_index.get(code);
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
      console.log(`✅ SOLVE v2.4: Preloaded employees by team:`, {
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
      const dio_service = this.findServiceByCode('DIO'); // ✅ PATCH 8: Deterministic lookup
      if (!dio_service) {
        const result = {
          valid: false,
          reason: `DIO service not found in metadata`,
        };
        this.validation_result_cache.set(cache_key, false);
        return result;
      }

      const dio_assigned = this.workbestand_planning.some(
        (p) =>
          p.employee_id === employee_id &&
          p.date.getTime() === dateTime &&
          p.dagdeel === 'O' &&
          p.service_id === dio_service.id &&
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

    // REGEL 3: DDA vereist DDO eerder in dezelfde dag
    if (service_code === 'DDA') {
      const ddo_service = this.findServiceByCode('DDO'); // ✅ PATCH 8: Deterministic lookup
      if (!ddo_service) {
        const result = {
          valid: false,
          reason: `DDO service not found in metadata`,
        };
        this.validation_result_cache.set(cache_key, false);
        return result;
      }

      const ddo_assigned = this.workbestand_planning.some(
        (p) =>
          p.employee_id === employee_id &&
          p.date.getTime() === dateTime &&
          p.dagdeel === 'O' &&
          p.service_id === ddo_service.id &&
          p.status === 1 // Must be assigned
      );

      if (!ddo_assigned) {
        const result = {
          valid: false,
          reason: `DDA requires DDO to be assigned first on same day in Ochtend`,
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
   * ✅ PATCH 1B + PATCH 4 + PATCH 8: Helper - Get DIO service ID
   * Enhanced with caching + deterministic lookup
   */
  private getDIOServiceId(): string {
    const dio_service = this.findServiceByCode('DIO'); // ✅ PATCH 8
    return dio_service?.id || '';
  }

  /**
   * ✅ PATCH 7 + PATCH 8: Helper - Get DDO service ID (for DDA chain validation)
   * Deterministic lookup with service index
   */
  private getDDOServiceId(): string {
    const ddo_service = this.findServiceByCode('DDO'); // ✅ PATCH 8
    return ddo_service?.id || '';
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
   * ✅ PATCH 7: With chained service tracking
   * ✅ PATCH 8: With deterministic service resolution
   * ✅ PATCH 9: With comprehensive logging
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
    this.chained_services_assigned.clear(); // ✅ PATCH 7: Clear chained tracking

    if (this.debug_enabled) {
      console.log(`🚀 SOLVE v2.4: Starting main loop with ${this.workbestand_opdracht.length} tasks`, {
        cache_busting_timestamp: this.cache_busting_timestamp,
        service_index_size: this.service_code_index.size,
        railway_trigger: `railway-${this.cache_busting_timestamp}-${Date.now()}`, // ✅ Railway deployment trigger with extra Date.now()
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

      // ✅ PATCH 9: Log task initiation
      if (this.debug_enabled) {
        console.log(`📋 Task: ${task.service_code} on ${task.date.toISOString().split('T')[0]} ${task.dagdeel} Team=${task.team} Need=${task.aantal_nog}`);
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
              date: task.date.toISOString().split('T')[0],
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

        // ✅ PATCH 9: Log assignment
        if (this.debug_enabled) {
          console.log(`  ✅ Assigned ${task.service_code} to ${best.employee_id} (Capacity left: ${best.capacity_remaining - 1})`);
        }

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
      console.log(`✅ SOLVE v2.4: Team Filter Statistics:`, stats_for_log);
      console.log(`✅ SOLVE v2.4: Performance Metrics:`, this.performance_metrics);
      console.log(`✅ SOLVE v2.4: Chained Services Assigned:`, Object.fromEntries(this.chained_services_assigned));
    }

    if (this.debug_enabled) {
      console.log(`✅ SOLVE v2.4: Complete`, {
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
        chained_services_count: this.chained_services_assigned.size,
        railway_trigger: `railway-${this.cache_busting_timestamp}-${Date.now()}`,
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
   * ✅ PATCH 8: With deterministic service resolution
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
      console.log(
        `🔍 FINDCANDIDATES: Service=${task.service_code} Date=${task.date
          .toISOString()
          .split('T')[0]} Dagdeel=${task.dagdeel} Teams=${teams_to_try.join(',')}`
      );
    }

    // Step 2: Search by team
    for (const team of teams_to_try) {
      const employees_in_team = this.employees_by_team.get(team) || [];

      for (const emp of employees_in_team) {
        // Check: Bevoegd (actief) voor deze service?
        const capacity_row = this.workbestand_capaciteit.find(
          (c) => c.employee_id === emp.employee_id && c.service_id === task.service_id
        );

        if (!capacity_row || !capacity_row.actief || (capacity_row.aantal_beschikbaar || 0) <= 0) {
          continue; // Not qualified or no capacity
        }

        // ✅ PATCH 2B: DIO/DIA CHAIN VALIDATION
        const chain_validation = this.validateDIOChainComplete(
          emp.employee_id,
          task.date,
          task.team,
          task.service_code
        );

        if (!chain_validation.valid) {
          if (this.debug_enabled) {
            console.log(
              `⛔ CHAIN INVALID: ${emp.employee_id} - ${chain_validation.reason}`
            );
          }
          continue; // Skip this employee
        }

        // Check: Employee status !== 3 (not unavailable)
        // Status 3 = NB (niet beschikbaar = not available)
        const employee_status_in_slot = this.workbestand_planning.find(
          (p) =>
            p.employee_id === emp.employee_id &&
            p.date.getTime() === task.date.getTime() &&
            p.dagdeel === task.dagdeel
        )?.status;

        if (employee_status_in_slot === 3) {
          if (this.debug_enabled) {
            console.log(
              `⏭️  UNAVAILABLE: ${emp.employee_id} has status=3 on ${task.dagdeel}`
            );
          }
          continue; // Status 3 = NB (not available)
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
          console.log(
            `✅ FOUND: ${candidates.length} candidates in teams:`,
            Array.from(stats?.found_teams || [])
          );
        }
        break;
      }
    }

    if (candidates.length === 0 && this.debug_enabled) {
      console.log(
        `❌ NO CANDIDATES: Service ${task.service_code} on ${task.dagdeel}`
      );
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
    const capacity_row = this.workbestand_capaciteit.find(
      (c) => c.employee_id === employee_id
    );
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
        p.date.getTime() >=
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
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
   * ✅ PATCH 3 + PATCH 6 + PATCH 7 + PATCH 8: Prepare for DIO/DDO chaining (Phase 3 prep)
   * Enhanced with comprehensive logging + deterministic service resolution
   * 
   * 🔴 PATCH 6 (DRAAD405E): FIXED DDO→DDA conditional koppeling
   * 🔴 PATCH 7 (DRAAD405F): FIXED DDA dubbel-inplannen by decrementing chained task
   * ✅ PATCH 8: Deterministic service lookup via findServiceByCode()
   * 
   * DIO logic:
   * - Ochtend: Assign DIO
   * - Middag: Block (werkt al)
   * - Avond: Assign DIA (auto)
   * - Next day O+M: Block (too tired)
   * 
   * ✅ DDO logic (NEW - DRAAD405E FIX):
   * - Ochtend: Assign DDO
   * - Middag: Block
   * - Avond: Assign DDA (was missing!)
   * - Next day O+M: Block
   * 
   * ✅ PATCH 7 - Decrement chained task counter:
   * - Find chained_task in workbestand_opdracht for DIA/DDA
   * - Decrement aantal_nog by 1
   * - Prevents double-assignment in next solve iteration
   */
  private prepareForChaining(
    task: WorkbestandOpdracht,
    slot: WorkbestandPlanning
  ): void {
    const employee_id = slot.employee_id;
    const assign_date = slot.date;
    const service_code = task.service_code;

    // DIO/DDO only applies to Ochtend dagdeel
    if (slot.dagdeel !== 'O' || !['DIO', 'DDO'].includes(service_code)) {
      return;
    }

    if (this.debug_enabled) {
      console.log(
        `🔗 CHAIN START: ${employee_id} - ${service_code} on ${assign_date
          .toISOString()
          .split('T')[0]}`
      );
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

      if (this.debug_enabled) {
        console.log(
          `  ✅ BLOCKED: Middag (already works ${service_code} in Ochtend)`
        );
      }
    } else {
      if (this.debug_enabled) {
        console.log(
          `  ⚠️  MIDDAG SLOT NOT FOUND (might already be blocked/assigned)`
        );
      }
    }

    // Step 2: Assign chained service to Avond (DIA for DIO, DDA for DDO)
    // ✅ DRAAD405E FIX + PATCH 8: Deterministic lookup
    let chained_service_code: string;
    if (service_code === 'DIO') {
      chained_service_code = 'DIA';  // DIO → DIA
    } else if (service_code === 'DDO') {
      chained_service_code = 'DDA';  // DDO → DDA (DRAAD405E FIX)
    } else {
      if (this.debug_enabled) {
        console.warn(
          `[DRAAD405E] Unknown service code for chaining: ${service_code}`
        );
      }
      return; // Unknown service - skip chaining
    }

    const avond_slot = this.workbestand_planning.find(
      (p) =>
        p.employee_id === employee_id &&
        p.date.getTime() === assign_date.getTime() &&
        p.dagdeel === 'A' &&
        p.status === 0
    );

    if (avond_slot) {
      // ✅ PATCH 8: Deterministic service lookup
      const chained_service = this.findServiceByCode(chained_service_code);

      if (chained_service) {
        avond_slot.service_id = chained_service.id;
        avond_slot.status = 1; // Assigned
        avond_slot.source = 'autofill';
        avond_slot.is_modified = true;
        this.modified_slots.push(avond_slot);

        if (this.debug_enabled) {
          console.log(
            `  ✅ ${chained_service_code} ASSIGNED: Avond (${employee_id})`
          );
        }

        // Update capacity for chained service
        this.decrementCapacity(employee_id, chained_service.id);

        // ✅ PATCH 7: Decrement chained task counter to prevent double-assignment
        const chained_task = this.workbestand_opdracht.find(
          (t) =>
            t.service_id === chained_service.id &&
            t.date.getTime() === assign_date.getTime() &&
            t.dagdeel === 'A'  // Chained services are ALWAYS in Avond
        );

        if (chained_task) {
          chained_task.aantal_nog -= 1;
          
          // Track for reporting
          const chain_key = `${chained_service_code}_${employee_id}_${assign_date.toISOString().split('T')[0]}`;
          this.chained_services_assigned.set(
            chain_key,
            (this.chained_services_assigned.get(chain_key) || 0) + 1
          );

          if (this.debug_enabled) {
            console.log(
              `  ✅ PATCH 7: Decremented ${chained_service_code} task counter (antal_nog now ${chained_task.aantal_nog})`
            );
          }
        } else {
          if (this.debug_enabled) {
            console.warn(
              `[PATCH 7] Could not find chained task for ${chained_service_code} on ${assign_date.toISOString().split('T')[0]} Avond`
            );
          }
        }
      } else {
        if (this.debug_enabled) {
          console.warn(
            `[DRAAD405E] No service found for chained code: ${chained_service_code}`
          );
        }
      }
    } else {
      if (this.debug_enabled) {
        console.log(
          `  ⚠️  AVOND SLOT NOT FOUND (cannot assign ${chained_service_code})`
        );
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

        if (this.debug_enabled) {
          console.log(
            `  ✅ BLOCKED: Next day Ochtend (recovery)`
          );
        }
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

        if (this.debug_enabled) {
          console.log(
            `  ✅ BLOCKED: Next day Middag (recovery)`
          );
        }
      }
    }

    if (this.debug_enabled) {
      console.log(
        `🔗 CHAIN COMPLETE: ${employee_id} ${service_code} → ${chained_service_code} chain processed`
      );
    }
  }

  /**
   * Count assigned services
   */
  private countAssignedServices(): number {
    return this.workbestand_planning.filter(
      (p) => p.status === 1 && p.service_id
    ).length;
  }

  /**
   * Count open services (assignments not made)
   */
  private countOpenServices(): number {
    return this.workbestand_opdracht.reduce(
      (sum, task) => sum + task.aantal_nog,
      0
    );
  }
}

/**
 * Helper: Create SolveEngine and run solve
 * ✅ v2.4: With PATCH 8 deterministic service resolution + PATCH 9 comprehensive logging
 * ✅ Returns performance metrics + cache-busting timestamp
 * ✅ DRAAD405E: DDO→DDA conditional koppeling fixed
 * ✅ DRAAD405F: DDA dubbel-inplannen fixed
 * ✅ DRAAD407 Phase 4: Service index + deterministic resolution + comprehensive logging
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
  team_filter_stats?: Map<
    string,
    { searched_teams: string[]; found_teams: string[]; count: number }
  >;
  performance_metrics?: PerformanceMetrics;
  cache_busting_timestamp?: number;
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
