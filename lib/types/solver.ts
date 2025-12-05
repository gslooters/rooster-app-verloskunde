/**
 * TypeScript types voor OR-Tools Solver API
 * 
 * Deze types komen overeen met de Pydantic models in solver/models.py
 * Zorgt voor type-safety tussen Next.js en Python service.
 * 
 * DRAAD106: Status semantiek:
 * - Status 0 + NULL: Beschikbaar slot
 * - Status 0 + service_id: ORT voorlopig (hint)
 * - Status 1 + service_id: Fixed (handmatig of gefinaliseerd)
 * - Status 2 + NULL: Geblokkeerd door DIA/DDA/DIO/DDO
 * - Status 3 + NULL: Structureel NBH
 * 
 * DRAAD108: Bezetting realiseren:
 * - ExactStaffing interface voor exacte bezetting per dienst/dagdeel/team
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
export interface Service {
  id: number;
  code: string;
  naam: string;
}

// Employee-Service bevoegdheid (legacy)
export interface EmployeeService {
  employee_id: number;
  service_id: number;
}

// DRAAD105: RosterEmployeeService
export interface RosterEmployeeService {
  roster_id: number;
  employee_id: number;
  service_id: number;
  aantal: number;      // Streefgetal: min=max, 0=ZZP/reserve
  actief: boolean;     // Alleen actieve bevoegdheden toewijzen (harde eis)
}

// ============================================================================
// DRAAD106: NIEUWE TYPES VOOR STATUS SEMANTIEK
// ============================================================================

/**
 * Status 1: Handmatig gepland of gefinaliseerd, MOET worden gerespecteerd.
 */
export interface FixedAssignment {
  employee_id: number;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: number;
}

/**
 * Status 2, 3: Niet beschikbaar voor ORT.
 * - Status 2: Geblokkeerd door DIA/DDA/DIO/DDO (automatisch)
 * - Status 3: Structureel NBH (handmatig)
 */
export interface BlockedSlot {
  employee_id: number;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  status: 2 | 3;
  blocked_by_service_id?: number; // Voor status 2
}

/**
 * Status 0 + service_id: Hint van vorige ORT run.
 */
export interface SuggestedAssignment {
  employee_id: number;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: number;
}

/**
 * Pre-assignment (DEPRECATED - gebruik FixedAssignment + BlockedSlot)
 */
export interface PreAssignment {
  employee_id: number;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: number;
  status: number; // 1=Fixed, 2=Blocked, 3=Structureel NBH
}

// ============================================================================
// DRAAD108: NIEUWE TYPES VOOR BEZETTING REALISEREN
// ============================================================================

/**
 * DRAAD108: Exacte bezetting per dienst/dagdeel/team uit roster_period_staffing_dagdelen.
 * 
 * Logica:
 * - exact_aantal > 0: ORT MOET exact dit aantal plannen (min=max tegelijk)
 * - exact_aantal = 0: ORT MAG NIET plannen (verboden)
 * 
 * Team mapping:
 * - 'TOT' → alle medewerkers (geen filter)
 * - 'GRO' → employees.team = 'maat'
 * - 'ORA' → employees.team = 'loondienst'
 * 
 * Priority: HARD CONSTRAINT (is_fixed: true in solver)
 */
export interface ExactStaffing {
  date: string;  // ISO date string
  dagdeel: Dagdeel;  // 'O', 'M', 'A'
  service_id: string;  // UUID als string
  team: 'TOT' | 'GRO' | 'ORA';  // Team scope
  exact_aantal: number;  // 0-9: exact aantal vereist (0=verboden, >0=exact aantal)
  is_system_service: boolean;  // Voor prioritering: systeemdiensten eerst (DIO, DIA, DDO, DDA)
}

// ============================================================================
// SOLVE REQUEST & RESPONSE
// ============================================================================

// Solve Request (naar Python service)
export interface SolveRequest {
  roster_id: number;
  start_date: string; // ISO date
  end_date: string; // ISO date
  employees: Employee[];
  services: Service[];
  roster_employee_services: RosterEmployeeService[];  // DRAAD105
  
  // DRAAD106: Nieuwe velden (preferred)
  fixed_assignments?: FixedAssignment[];      // Status 1: MOET respecteren
  blocked_slots?: BlockedSlot[];              // Status 2, 3: MAG NIET gebruiken
  suggested_assignments?: SuggestedAssignment[]; // Status 0 + service_id: Hints
  
  // DRAAD108: Nieuwe veld voor exacte bezetting
  exact_staffing?: ExactStaffing[];  // Exacte bezetting eisen per dienst/dagdeel/team
  
  // DEPRECATED: Backwards compatibility
  pre_assignments?: PreAssignment[];
  
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
