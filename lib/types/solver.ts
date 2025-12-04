/**
 * TypeScript types voor OR-Tools Solver API
 * 
 * Deze types komen overeen met de Pydantic models in solver/models.py
 * Zorgt voor type-safety tussen Next.js en Python service.
 */

// Enums
export type TeamType = 'maat' | 'loondienst' | 'overig';
export type Dagdeel = 'O' | 'M' | 'A';
export type SolveStatus = 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error';

// Employee
export interface Employee {
  id: number;
  name: string;
  team: TeamType;
  structureel_nbh?: Record<string, Dagdeel[]>; // { "ma": ["O", "M"], "di": ["A"] }
  max_werkdagen?: number;
  min_werkdagen?: number;
}

// Service
// FIX DRAAD100B: VERWIJDER dagdeel - dit is assignment data, NIET service_types data
// dagdeel zit in PreAssignment interface waar het thuishoort
export interface Service {
  id: number;
  code: string;
  naam: string;
  is_nachtdienst: boolean;
}

// Employee-Service bevoegdheid
export interface EmployeeService {
  employee_id: number;
  service_id: number;
}

// Pre-assignment (status > 0)
export interface PreAssignment {
  employee_id: number;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: number;
  status: number; // 1=ORT, 2=uit nacht, 3=handmatig, 4=definitief
}

// Solve Request (naar Python service)
export interface SolveRequest {
  roster_id: number;
  start_date: string; // ISO date
  end_date: string; // ISO date
  employees: Employee[];
  services: Service[];
  employee_services: EmployeeService[];
  pre_assignments: PreAssignment[];
  timeout_seconds: number;
}

// Assignment (resultaat)
export interface Assignment {
  employee_id: number;
  employee_name: string;
  date: string; // ISO date
  dagdeel: Dagdeel;
  service_id: number;
  service_code: string;
  confidence: number; // 0.0 - 1.0
}

// Constraint Violation
export interface ConstraintViolation {
  constraint_type: string;
  employee_id?: number;
  employee_name?: string;
  date?: string; // ISO date
  dagdeel?: Dagdeel;
  service_id?: number;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

// Suggestion (prescriptive)
export interface Suggestion {
  type: string;
  employee_id?: number;
  employee_name?: string;
  action: string;
  impact: string;
}

// Solve Response (van Python service)
export interface SolveResponse {
  status: SolveStatus;
  roster_id: number;
  assignments: Assignment[];
  solve_time_seconds: number;
  
  // Statistieken
  total_assignments: number;
  total_slots: number;
  fill_percentage: number;
  
  // Rapportage
  violations: ConstraintViolation[];
  suggestions: Suggestion[];
  
  // Metadata
  solver_metadata: Record<string, any>;
}

// API Response (van Next.js route)
export interface SolverApiResponse {
  success: boolean;
  roster_id: number;
  solver_result: {
    status: SolveStatus;
    total_assignments: number;
    total_slots: number;
    fill_percentage: number;
    solve_time_seconds: number;
    violations: ConstraintViolation[];
    suggestions: Suggestion[];
  };
  total_time_ms: number;
}
