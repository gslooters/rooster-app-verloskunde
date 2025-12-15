/**
 * DRAAD124: ORT Hulpvelden & Data Integriteit Fix - Type Definitions
 * DRAAD125: HOTFIX - Complete type definitions for route.ts compatibility
 * DRAAD125B: Missing Types - BottleneckItem + BottleneckSuggestion + SolverApiResponse
 * DRAAD125C: FeasibleSummary Type Addition - fixes TypeScript compilation error
 * DRAAD-191: GREEDY Solver Type Update - Changed status types for GREEDY engine
 * Phase 3: TypeScript Types voor Solver & Roster Assignment
 */

/**
 * Employee from employees table
 * DRAAD115: voornaam/achternaam split, team mapped from dienstverband
 */
export interface Employee {
  id: string; // UUID
  voornaam: string;
  achternaam: string;
  team: 'maat' | 'loondienst' | 'overig'; // mapped from dienstverband
  structureel_nbh?: boolean;
  min_werkdagen?: number;
}

/**
 * Service Type from service_types table
 */
export interface Service {
  id: string; // UUID
  code: string; // 'DIA', 'DDO', 'NBH', 'STUDIE', etc
  naam: string; // Full name
}

/**
 * Roster Employee Service (bevoegdheden)
 */
export interface RosterEmployeeService {
  roster_id: string;
  employee_id: string;
  service_id: string;
  aantal: number; // max # of shifts for this service
  actief: boolean;
}

/**
 * Fixed Assignment (status=1)
 */
export interface FixedAssignment {
  employee_id: string;
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A';
  service_id: string; // UUID
}

/**
 * Blocked Slot (status=2,3)
 */
export interface BlockedSlot {
  employee_id: string;
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A';
  status: 2 | 3; // 2=blocked, 3=system
}

/**
 * Suggested Assignment (status=0 + service_id)
 * Warm-start hints for ORT solver
 */
export interface SuggestedAssignment {
  employee_id: string;
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A';
  service_id: string; // UUID
}

/**
 * Exact Staffing Requirement (DRAAD108)
 */
export interface ExactStaffing {
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A';
  service_id: string; // UUID
  team?: 'TOT' | 'GRO' | 'ORA'; // optional team filter
  exact_aantal: number; // Required # of staff
  is_system_service?: boolean;
}

/**
 * Assignment Output van ORT Solver Engine
 * Inclusief confidence scoring en constraint reason tracing
 */
export interface Assignment {
  employee_id: string;
  employee_name: string;
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A'; // Ochtend, Middag, Avond
  service_id: string; // UUID van dienst (NOOIT NULL)
  service_code: string; // DIA, DDO, NBH, STUDIE, etc

  // FASE 2: Hulpvelden
  confidence?: number; // 0.0 - 1.0: solver certainty (optional for backward compat)
  constraint_reason?: {
    constraints: string[]; // ['exact_staffing', 'coverage', ...]
    reason_text: string; // "EXACT 2 people required for DIA morning"
    flexibility: 'rigid' | 'medium' | 'flexible';
    can_modify: boolean;
    suggest_modification?: string | null;
  };
}

/**
 * Solver Run Status Tracking
 */
export interface SolverRun {
  id: string; // UUID
  roster_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string; // ISO 8601
  completed_at?: string;
  solve_time_seconds?: number;
  solver_status: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error' | 'success' | 'partial';
  total_assignments: number;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Pre-ORT State Snapshot (validation)
 */
export interface PreOrtState {
  status_0: number; // Editable slots
  status_1: number; // Fixed/manual placements
  status_2_3: number; // Blocked slots
  total: number; // Must = 1365
  countByStatus: Record<number, number>;
}

/**
 * Post-ORT State Snapshot (validation)
 */
export interface PostOrtState {
  status_0: number;
  status_1: number;
  status_2_3: number;
  total: number;
  countByStatus: Record<number, number>;
  validation_errors: string[];
}

/**
 * Roster Assignment Database Record
 * Inclusief alle hulpvelden uit FASE 1
 */
export interface RosterAssignmentRecord {
  // Primary Key
  id?: string; // UUID

  // Foreign Keys
  roster_id: string;
  employee_id: string;

  // Assignment Details
  date: string; // ISO 8601
  dagdeel: string; // 'O', 'M', 'A'
  service_id: string | null;
  status: number; // 0=unassigned, 1=fixed, 2=blocked, 3=system

  // Metadata
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  // Blocking Info
  blocked_by_date?: string | null;
  blocked_by_dagdeel?: string | null;
  blocked_by_service_id?: string | null;

  // FASE 1 Hulpvelden
  source: 'manual' | 'ort' | 'system' | 'import'; // Default: 'manual'
  is_protected: boolean; // Default: false
  ort_confidence: number | null; // Default: null
  ort_run_id: string | null; // UUID, FK: solver_runs.id
  constraint_reason: Record<string, any>; // JSONB, Default: {}
  previous_service_id: string | null; // UUID, Default: null
}

/**
 * Solve Request (Input to ORT)
 * DRAAD115: employees array + exact_staffing (DRAAD108)
 */
export interface SolveRequest {
  roster_id: string;
  start_date?: string; // ISO 8601
  end_date?: string; // ISO 8601

  // Employee data (DRAAD115: new format)
  employees?: Employee[];
  services?: Service[];
  roster_employee_services?: RosterEmployeeService[];

  // Fixed assignments (status=1) - ORT mag niet aanraken
  fixed_assignments?: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    service_id: string;
    service_code?: string;
  }>;

  // Blocked slots (status=2,3) - ORT mag niet gebruiken
  blocked_slots?: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    status: number;
  }>;

  // Suggested assignments (status=0 + service_id) - warm start
  suggested_assignments?: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    service_id: string;
  }>;

  // Editable slots (status=0) - ORT mag aanpassen
  editable_slots?: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    service_id: string | null;
  }>;

  // Exact staffing constraints (DRAAD108)
  exact_staffing?: Array<{
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_id: string;
    team?: 'TOT' | 'GRO' | 'ORA';
    exact_aantal: number;
    is_system_service?: boolean;
  }>;

  // Employee capabilities (backward compat)
  employee_services?: Array<{
    employee_id: string;
    service_id: string;
    actief: boolean;
  }>;

  // System generated services (NBH, STUDIE)
  system_mappings?: Record<string, any>;

  // Solver parameters
  params?: {
    max_iterations?: number;
    time_limit_seconds?: number;
    optimization_level?: 'fast' | 'balanced' | 'optimal';
  };
  timeout_seconds?: number;
}

/**
 * Constraint Violation
 */
export interface Violation {
  constraint_type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  affected_slots?: number;
}

/**
 * Solver Suggestion
 */
export interface SolverSuggestion {
  type: 'increase_staffing' | 'relax_constraint' | 'add_coverage';
  message: string;
  impact: string;
}

/**
 * Bottleneck Item (DRAAD125B)
 * Individual staffing shortage at specific time slot
 */
export interface BottleneckItem {
  date: string; // ISO 8601
  dagdeel: 'O' | 'M' | 'A';
  service_id: string; // UUID
  service_code?: string; // DIA, DDO, NBH, etc
  required: number; // Required staff count
  available: number; // Available staff count
  shortage: number; // required - available
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason?: string; // Why this shortage exists
}

/**
 * Bottleneck Suggestion (DRAAD125B)
 * Actionable recommendation to resolve bottleneck
 */
export interface BottleneckSuggestion {
  type: 'increase_staffing' | 'relax_constraint' | 'swap_assignment' | 'add_capacity';
  message: string;
  affected_dates?: string[]; // ISO 8601 dates
  affected_services?: string[]; // Service IDs
  estimated_impact?: number; // % improvement if applied
  effort_level?: 'low' | 'medium' | 'high';
  priority?: number; // 1-10, higher = more important
}

/**
 * FeasibleSummary - DRAAD125C
 * 
 * Summary data for FEASIBLE solver outcomes
 * Returned from API when solver successfully finds solution
 * 
 * Used by: app/rooster/[id]/feasible-summary/page.tsx
 * Source: app/api/roster/solve/route.ts (line 197-202)
 * 
 * Structure matches the response wrapper from route.ts:
 * - total_services_scheduled: solverResult.total_assignments
 * - coverage_percentage: solverResult.fill_percentage
 * - unfilled_slots: computed from total_slots - assignments
 */
export interface FeasibleSummary {
  /** Total number of services/assignments scheduled by solver */
  total_services_scheduled: number;
  
  /** Coverage percentage (0-100) of filled vs total slots */
  coverage_percentage: number;
  
  /** Number of unfilled/empty roster slots */
  unfilled_slots: number;
}

/**
 * Bottleneck Report (DRAAD118A)
 */
export interface BottleneckReport {
  reason: string;
  missing_assignments: number;
  impossible_constraints: string[];
  bottlenecks?: BottleneckItem[]; // DRAAD125B: typed array
  critical_count?: number;
  total_shortage?: number;
  shortage_percentage?: number;
  suggestions?: BottleneckSuggestion[]; // DRAAD125B: typed array
}

/**
 * DRAAD-191: Solve Response (Output from GREEDY or ORT)
 * 
 * Updated to support both:
 * - ORT legacy: status = 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error'
 * - GREEDY: status = 'success' | 'partial' | 'failed'
 * 
 * NOTE: For GREEDY solver, the status values are:
 *   - 'success' = Feasible solution found with high coverage
 *   - 'partial' = Feasible solution found with lower coverage  
 *   - 'failed' = Infeasible (cannot satisfy constraints)
 */
export interface SolveResponse {
  success?: boolean;
  status: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error' | 'success' | 'partial' | 'failed';
  assignments: Assignment[];
  total_assignments: number;
  total_slots?: number;
  fill_percentage?: number;

  // Diagnostics
  solve_time_seconds?: number;
  bottleneck_report?: BottleneckReport;
  violations?: Violation[];
  suggestions?: SolverSuggestion[];

  // Legacy fields for backward compat
  solver_status?: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error' | 'success' | 'partial' | 'failed';
  metadata?: {
    assignments_fixed: number;
    assignments_protected: number;
    assignments_editable: number;
    total_to_solve: number;
  };
}

/**
 * DRAAD-191: SolverApiResponse - Wrapper response from /api/roster/solve or /api/roster/solve-greedy
 * 
 * Unified interface for both ORT and GREEDY solver responses
 * The API endpoint wraps SolveResponse with metadata and conditionally includes summary
 */
export interface SolverApiResponse {
  success: boolean;
  roster_id: string;
  solver_result: SolveResponse & {
    // Additional fields added by API wrapper
    summary?: {
      total_services_scheduled: number;
      coverage_percentage?: number;
      unfilled_slots: number;
    } | null;
  };
  // Optional metadata from different DRADs
  draad108?: Record<string, any>;
  draad115?: Record<string, any>;
  draad118a?: Record<string, any>;
  draad121?: Record<string, any>;
  draad122?: Record<string, any>;
  draad125a?: Record<string, any>;
  draad191?: Record<string, any>; // GREEDY solver metadata
  error?: string;
  total_time_ms?: number;
}

/**
 * Integrity Validation Result
 */
export interface IntegrityValidation {
  passed: boolean;
  errors: string[];
  warnings: string[];
  pre_state: PreOrtState;
  post_state: PostOrtState;
  records_unchanged: {
    status_1: number;
    status_2_3: number;
  };
  records_changed: number;
  total_constant: boolean;
}