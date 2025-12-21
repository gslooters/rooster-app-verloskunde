/**
 * AFL (Autofill) - Shared Type Definitions
 * 
 * All interfaces and types used across AFL phases
 */

/**
 * WorkbestandOpdracht (Task List)
 * Source: roster_period_staffing_dagdelen
 * Purpose: Defines what services need to be scheduled for which day/time/team
 */
export interface WorkbestandOpdracht {
  id: string; // FROM roster_period_staffing_dagdelen.id
  roster_id: string;
  date: Date; // Service date (35 days in period)
  dagdeel: 'O' | 'M' | 'A'; // Ochtend, Middag, Avond
  team: 'GRO' | 'ORA' | 'TOT'; // Team requirement
  service_id: string; // UUID from service_types
  service_code: string; // DIO, DIA, DDO, DDA, RO, etc (from service_types)
  is_system: boolean; // Is hardcoded system service (from service_types)
  aantal: number; // Total required for this task
  aantal_nog: number; // Remaining to assign (decrements during solve)
  invulling: number; // 0=open, 1=autofill, 2=manual pre-planning
}

/**
 * WorkbestandPlanning (Assignment Slots)
 * Source: roster_assignments
 * Purpose: Current state of each employee slot (date/dagdeel)
 * MUTABLE during solve phase
 */
export interface WorkbestandPlanning {
  id: string; // roster_assignments.id - PK for UPDATE
  roster_id: string;
  employee_id: string;
  date: Date;
  dagdeel: 'O' | 'M' | 'A';
  status: 0 | 1 | 2 | 3; // 0=open, 1=assigned, 2=blocked, 3=unavailable
  service_id: string | null; // MUTABLE: null or service UUID
  is_protected: boolean; // TRUE = skip this (pre-planning)
  source: 'autofill' | 'manual' | 'pre_planning' | null;
  blocked_by_date: Date | null; // MUTABLE: which date caused block
  blocked_by_dagdeel: string | null; // MUTABLE: which dagdeel caused block
  blocked_by_service_id: string | null; // MUTABLE: which service caused block
  constraint_reason: Record<string, unknown> | null; // JSONB: blocking reason
  ort_confidence: number | null; // Reused from ORT
  ort_run_id: string | null; // Tracking
  previous_service_id: string | null; // Service chain tracking
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  
  // Runtime tracking (not in DB)
  is_modified?: boolean; // Marked for UPDATE
}

/**
 * WorkbestandCapaciteit (Employee Capacity)
 * Source: roster_employee_services
 * Purpose: Per employee/service, how many slots available
 * MUTABLE: decrements as services assigned
 */
export interface WorkbestandCapaciteit {
  roster_id: string;
  employee_id: string;
  service_id: string;
  service_code: string;
  aantal: number; // MUTABLE: decrements as assigned
  actief: boolean; // Qualification flag
  
  // Runtime tracking
  aantal_beschikbaar?: number; // Adjusted for pre-planning
}

/**
 * WorkbestandServicesMetadata (Service Types)
 * Source: service_types
 * Purpose: Service definition and rules
 * READ ONLY
 */
export interface WorkbestandServicesMetadata {
  id: string;
  code: string; // DIO, DIA, DDO, DDA, RO, etc
  naam: string;
  beschrijving: string | null;
  is_system: boolean; // TRUE for DIO, DIA, DDO, DDA
  blokkeert_volgdag: boolean; // Does this block next day? (TRUE for DIO, DDO)
  team_groen_regels: Record<string, unknown> | null;
  team_oranje_regels: Record<string, unknown> | null;
  team_totaal_regels: Record<string, unknown> | null;
  actief: boolean;
}

/**
 * Employee Runtime Info
 * For FASE 2 solve loop candidate finding
 */
export interface EmployeeCandidate {
  employee_id: string;
  employee_name: string;
  team: string; // Groen, Oranje, Overig
  dienstverband: string; // Maat, Loondienst, ZZP
  capacity_remaining: number; // For this specific service
  last_worked: Date | null; // Last date worked
  fair_score: number; // For fairness tiebreaker
}

/**
 * AFL Data Loader Result
 * All workbenches loaded in FASE 1
 */
export interface AflLoadResult {
  workbestand_opdracht: WorkbestandOpdracht[];
  workbestand_planning: WorkbestandPlanning[];
  workbestand_capaciteit: WorkbestandCapaciteit[];
  workbestand_services_metadata: WorkbestandServicesMetadata[];
  rooster_period: {
    id: string;
    start_date: Date;
    end_date: Date;
    status: string;
  };
  load_duration_ms: number;
}

/**
 * AFL Execution Result
 * After complete solve
 */
export interface AflExecutionResult {
  success: boolean;
  afl_run_id: string;
  rosterId: string;
  execution_time_ms: number;
  error?: string | null;
  
  // Phase-specific timings
  phase_timings?: {
    load_ms: number;
    solve_ms: number;
    dio_chains_ms: number;
    database_write_ms: number;
    report_generation_ms: number;
  };
}

/**
 * AFL Report
 * Comprehensive statistics and bottleneck analysis
 */
export interface AflReport {
  success: boolean;
  afl_run_id: string;
  rosterId: string;
  execution_time_ms: number;
  
  summary: {
    total_required: number;
    total_planned: number;
    total_open: number;
    coverage_percent: number;
    coverage_rating: 'excellent' | 'good' | 'fair' | 'poor';
  };
  
  planned_by_service: Array<{
    service_code: string;
    required: number;
    planned: number;
    open: number;
    completion_percent: number;
  }>;
  
  bottleneck_services: Array<{
    service_code: string;
    required: number;
    planned: number;
    open: number;
    reason: string;
  }>;
  
  employee_capacity_remaining: Array<{
    employee_id: string;
    employee_name: string;
    assignments_total: number;
    capacity_by_service: Array<{
      service_code: string;
      planned: number;
      capacity_was: number;
      capacity_remaining: number;
    }>;
  }>;
  
  open_services: Array<{
    date: Date;
    dagdeel: 'O' | 'M' | 'A';
    team: string;
    service_code: string;
    aantal: number;
    reason: string;
  }>;
  
  phase_breakdown: {
    load_ms: number;
    solve_ms: number;
    dio_chains_ms: number;
    database_write_ms: number;
    report_generation_ms: number;
  };
}
