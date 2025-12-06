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
 * 
 * DRAAD115: Employee mapping fix:
 * - voornaam/achternaam als separate velden (niet gecombineerd)
 * - team mapped van employees.dienstverband (niet employees.team)
 * - max_werkdagen verwijderd (niet nodig voor solver)
 * 
 * DRAAD118A: INFEASIBLE handling met Bottleneck Analysis:
 * - BottleneckItem: per-service capacity analysis
 * - BottleneckSuggestion: actionable recommendations
 * - BottleneckReport: complete analysis when INFEASIBLE
 * - FeasibleSummary: summary when FEASIBLE
 */

// Enums
export type TeamType = 'maat' | 'loondienst' | 'overig';
export type Dagdeel = 'O' | 'M' | 'A';
export type SolveStatus = 'optimal' | 'feasible' | 'infeasible' | 'timeout' | 'error';

// Employee
// DRAAD115: Split voornaam/achternaam, use dienstverband mapping
export interface Employee {
  id: string;  // text in database
  voornaam: string;  // DRAAD115: split
  achternaam: string;  // DRAAD115: split
  team: TeamType;  // mapped from dienstverband
  structureel_nbh?: Record<string, Dagdeel[]>; // { "ma": ["O", "M"], "di": ["A"] }
  min_werkdagen?: number;
}

// Service
export interface Service {
  id: string;  // uuid in database
  code: string;
  naam: string;
}

// Employee-Service bevoegdheid (legacy)
export interface EmployeeService {
  employee_id: string;
  service_id: string;
}

// DRAAD105: RosterEmployeeService
export interface RosterEmployeeService {
  roster_id: string;
  employee_id: string;
  service_id: string;
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
  employee_id: string;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: string;
}

/**
 * Status 2, 3: Niet beschikbaar voor ORT.
 * - Status 2: Geblokkeerd door DIA/DDA/DIO/DDO (automatisch)
 * - Status 3: Structureel NBH (handmatig)
 */
export interface BlockedSlot {
  employee_id: string;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  status: 2 | 3;
  blocked_by_service_id?: string; // Voor status 2
}

/**
 * Status 0 + service_id: Hint van vorige ORT run.
 */
export interface SuggestedAssignment {
  employee_id: string;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: string;
}

/**
 * Pre-assignment (DEPRECATED - gebruik FixedAssignment + BlockedSlot)
 */
export interface PreAssignment {
  employee_id: string;
  date: string; // ISO date string
  dagdeel: Dagdeel;
  service_id: string;
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
// DRAAD118A: BOTTLENECK ANALYSIS TYPES FOR INFEASIBLE HANDLING
// ============================================================================

/**
 * DRAAD118A: Per-dienst capacity analysis voor Bottleneck Report.
 * 
 * Analyse van nodig vs beschikbaar per dienst over hele periode.
 */
export interface BottleneckItem {
  service_id: string;
  service_code: string;
  service_naam: string;
  nodig: number;              // Totaal benodigde capaciteit
  beschikbaar: number;        // Totaal beschikbare capaciteit
  tekort: number;             // Capaciteits tekort: max(0, nodig - beschikbaar)
  tekort_percentage: number;  // Tekort als % van benodigde
  is_system_service: boolean; // DRAAD118A: Kritieke systeemdiensten → ROOD in UI
  severity: 'critical' | 'high' | 'medium';  // Prioriteit
}

/**
 * DRAAD118A: Actionable advice voor planner to resolve bottleneck.
 */
export interface BottleneckSuggestion {
  type: 'increase_capability' | 'reduce_requirement' | 'hire_temp';
  service_code: string;
  action: string;      // Concrete, human-readable actie
  impact: string;      // Expected impact
  priority: number;    // 1-10: prioriteit voor planner
}

/**
 * DRAAD118A: Complete analysis when solver returns INFEASIBLE.
 * 
 * Status 'draft' stays (NOT changed to 'in_progress').
 * Frontend shows this report on BottleneckAnalysisScreen.
 */
export interface BottleneckReport {
  total_capacity_needed: number;    // Sum of all nodig values
  total_capacity_available: number; // Sum of all beschikbaar values
  total_shortage: number;           // Sum of all tekort values
  shortage_percentage: number;      // (shortage / needed) × 100
  bottlenecks: BottleneckItem[];    // Per-service analysis, sorted by shortage DESC
  critical_count: number;           // Count of CRITICAL bottlenecks
  suggestions: BottleneckSuggestion[];  // Actionable recommendations
}

/**
 * DRAAD118A: Summary when solver returns FEASIBLE.
 * 
 * Shown on FeasibleSummaryScreen before entering plan view.
 * Status changes to 'in_progress' at this point.
 */
export interface FeasibleSummary {
  total_services_scheduled: number;  // Number of assignments made by solver
  coverage_percentage: number;       // Fill rate: (assignments / slots) × 100
  unfilled_slots: number;            // Available slots without assignment
}

// ============================================================================
// SOLVE REQUEST & RESPONSE
// ============================================================================

// Solve Request (naar Python service)
export interface SolveRequest {
  roster_id: string;
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
  employee_id: string;
  employee_name: string;
  date: string; // ISO date
  dagdeel: Dagdeel;
  service_id: string;
  service_code: string;
  confidence: number; // 0.0 - 1.0
}

// Constraint Violation
export interface ConstraintViolation {
  constraint_type: string;
  employee_id?: string;
  employee_name?: string;
  date?: string; // ISO date
  dagdeel?: Dagdeel;
  service_id?: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

// Suggestion (prescriptive)
export interface Suggestion {
  type: string;
  employee_id?: string;
  employee_name?: string;
  action: string;
  impact: string;
}

// Solve Response (van Python service)
// DRAAD118A: CRITICAL CHANGE - Response structure depends on solver_status
export interface SolveResponse {
  status: SolveStatus;
  roster_id: string;
  assignments: Assignment[];  // Empty [] when INFEASIBLE
  solve_time_seconds: number;
  
  // Statistieken
  total_assignments: number;
  total_slots: number;
  fill_percentage: number;
  
  // DRAAD118A: Conditionele velden
  /** Present only when FEASIBLE/OPTIMAL (not INFEASIBLE) */
  summary?: FeasibleSummary;
  
  /** Present only when INFEASIBLE - full analysis of capacity shortfalls */
  bottleneck_report?: BottleneckReport;
  
  // Rapportage
  violations: ConstraintViolation[];
  suggestions: Suggestion[];
  
  // Metadata
  solver_metadata: Record<string, any>;
}

// API Response (van Next.js route)
// DRAAD118A: Two response patterns based on solver outcome
export interface SolverApiResponse {
  success: boolean;
  roster_id: string;
  
  // Path A: FEASIBLE/OPTIMAL
  // solver_result contains:
  //   - status: 'feasible' | 'optimal'
  //   - assignments: [...]
  //   - summary: { total_services_scheduled, coverage_percentage, unfilled_slots }
  //   - bottleneck_report: null
  
  // Path B: INFEASIBLE
  // solver_result contains:
  //   - status: 'infeasible'
  //   - assignments: []
  //   - summary: null
  //   - bottleneck_report: { bottlenecks, critical_count, suggestions, ... }
  
  solver_result: {
    status: SolveStatus;
    assignments: Assignment[];
    summary?: FeasibleSummary | null;
    bottleneck_report?: BottleneckReport | null;
    total_assignments: number;
    total_slots: number;
    fill_percentage: number;
    solve_time_seconds: number;
    violations: ConstraintViolation[];
    suggestions: Suggestion[];
  };
  
  total_time_ms: number;
}
