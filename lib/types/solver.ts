/**
 * DRAAD124: ORT Hulpvelden & Data Integriteit Fix - Type Definitions
 * Phase 3: TypeScript Types voor Solver & Roster Assignment
 */

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
  confidence: number; // 0.0 - 1.0: solver certainty
  constraint_reason: {
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
  solver_status: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error';
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
 */
export interface SolveRequest {
  roster_id: string;

  // Fixed assignments (status=1) - ORT mag niet aanraken
  fixed_assignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    service_id: string;
    service_code: string;
  }>;

  // Blocked slots (status=2,3) - ORT mag niet gebruiken
  blocked_slots: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    status: number;
  }>;

  // Editable slots (status=0) - ORT mag aanpassen
  editable_slots: Array<{
    employee_id: string;
    date: string;
    dagdeel: string;
    service_id: string | null;
  }>;

  // Exact staffing constraints (DRAAD108)
  exact_staffing: Array<{
    service_id: string;
    service_code: string;
    date: string;
    dagdeel: string;
    required_count: number;
    flexibility: 'rigid' | 'flexible';
  }>;

  // Employee capabilities
  employee_services: Array<{
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
}

/**
 * Solve Response (Output from ORT)
 */
export interface SolveResponse {
  success: boolean;
  solver_status: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error';
  assignments: Assignment[];

  // Diagnostics
  solve_time_seconds?: number;
  bottleneck_report?: {
    reason: string;
    missing_assignments: number;
    impossible_constraints: string[];
  };

  metadata?: {
    assignments_fixed: number;
    assignments_protected: number;
    assignments_editable: number;
    total_to_solve: number;
  };
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