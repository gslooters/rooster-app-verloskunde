/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD 202 STAP 5: BACKEND GREEDY INTEGRATION
 * Complete replacement of Solver2/ORT with GREEDY endpoint
 * 
 * Architecture:
 * - Frontend (DRAAD 201): Calls /api/roster/solve with roster_id
 * - Backend (THIS FILE): Forwards to GREEDY service directly
 * - GREEDY: Returns optimized assignments
 * - Database: Updates roster_assignments via DRAAD155 UPDATE pattern
 * 
 * Changes from previous versions:
 * - REMOVED: callSolver2WithRetry() function
 * - REMOVED: SOLVER2_URL, SOLVER_TIMEOUT, SOLVER_RETRY_ATTEMPTS
 * - ADDED: callGreedyAPI() function with 30s timeout, NO retry
 * - ADDED: Dutch error messages (all types)
 * - ADDED: Response validation (status, coverage, assignments)
 * - METHOD: Single attempt to GREEDY, fail fast on error
 * 
 * Database constraints maintained:
 * - DRAAD155: UPDATE pattern (no INSERT/UPSERT conflicts)
 * - solverruns table: source='greedy' (not 'ortsolve')
 * - status: SUCCESS/PARTIAL/FAILED
 * - Coverage rate, total assignments, solve time tracked
 * 
 * DRAAD202 FIX (2025-12-17):
 * - Removed geneste "data" object from GreedyRequest
 * - Flattened payload to root-level fields
 * - GREEDY API expects: rosterid, startdate, enddate, employees, services, etc (all flat)
 * - NOT: roster_id with nested data object
 *
 * DRAAD202-HOTFIX (2025-12-17):
 * - Added null-safety checks for start_date/end_date
 * - Roster data must have both dates (required by GREEDY)
 * - Type guards prevent undefined values in payload
 *
 * DRAAD202-TYPEERROR-FIX (2025-12-17):
 * - Fixed structureel_nbh type mismatch (boolean -> number | string | null)
 * - Added defensive type conversion in employee mapping
 * - JSONB field from Supabase now properly typed
 *
 * DRAAD202-CRITICAL (2025-12-17 20:17:00Z):
 * - Fixed dagdeel type validation in fixed_assignments, blocked_slots, suggested_assignments
 * - Added normalizeDagdeel() function with runtime validation
 * - Replaces unsafe 'as' casts with proper type guards
 * - Eliminates TypeScript error: Type 'string' is not assignable to '"A" | "M" | "O"'
 * - Deployment should now succeed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  SolveRequest,
  SolveResponse,
  Employee,
  Service,
  RosterEmployeeService,
} from '@/lib/types/solver';

// ============================================================================
// GREEDY SERVICE CONFIGURATION
// ============================================================================

const GREEDY_ENDPOINT = process.env.GREEDY_ENDPOINT || 
  'https://greedy-production.up.railway.app/api/greedy/solve';
const GREEDY_TIMEOUT = parseInt(process.env.GREEDY_TIMEOUT || '30000', 10);

console.log('[DRAAD202] GREEDY Configuration:');
console.log(`[DRAAD202] Endpoint: ${GREEDY_ENDPOINT}`);
console.log(`[DRAAD202] Timeout: ${GREEDY_TIMEOUT}ms (NO retry - single attempt)`);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * DRAAD202 FIX: Flat payload structure (no nested "data" object)
 * GREEDY API expects root-level fields matching its Pydantic model
 * 
 * DRAAD202-HOTFIX: All date fields are NON-OPTIONAL (required)
 * start_date and end_date MUST be provided by router
 */
interface GreedyPayload {
  rosterid: string;
  startdate: string; // ✅ REQUIRED - non-null, non-undefined
  enddate: string;   // ✅ REQUIRED - non-null, non-undefined
  employees: Array<{
    id: string;
    voornaam: string;
    achternaam: string;
    team: 'maat' | 'loondienst' | 'overig';
    structureel_nbh?: number; // ✅ DRAAD202-TYPEERROR-FIX: Changed from boolean to number
    min_werkdagen?: number;
  }>;
  services: Array<{
    id: string;
    code: string;
    naam: string;
  }>;
  rosteremployeeservices: Array<{
    roster_id: string;
    employee_id: string;
    service_id: string;
    aantal: number;
    actief: boolean;
  }>;
  fixedassignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A'; // ✅ DRAAD202-CRITICAL: Strict literal type
    service_id: string;
  }>;
  blockedslots: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A'; // ✅ DRAAD202-CRITICAL: Strict literal type
    status: 2 | 3;
  }>;
  suggestedassignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A'; // ✅ DRAAD202-CRITICAL: Strict literal type
    service_id: string;
  }>;
  exactstaffing: Array<{
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_id: string;
    team: 'TOT' | 'GRO' | 'ORA';
    exact_aantal: number;
    is_system_service: boolean;
  }>;
  timeoutseconds: number;
}

/**
 * GREEDY API Response format
 */
interface GreedyResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number; // 0-100 percentage
  assignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_code: string;
  }>;
  total_assignments: number;
  solve_time_seconds: number;
  message?: string;
}

/**
 * Internal representation of GREEDY solution
 */
interface GreedySolution {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverageRate: number;
  assignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_code: string;
  }>;
  totalAssignments: number;
  solveTimeSeconds: number;
}

/**
 * GREEDY Error classification
 */
type GreedyErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR';

interface GreedyError {
  type: GreedyErrorType;
  message: string;
  details?: any;
}

// ============================================================================
// DAGDEEL VALIDATION & NORMALIZATION
// ============================================================================

/**
 * DRAAD202-CRITICAL: Validate and normalize dagdeel value
 * Database returns dagdeel as string, but GREEDY API requires strict literal type
 * 
 * This function:
 * - Runtime validates that value is one of: 'O', 'M', 'A'
 * - Returns properly typed value
 * - Logs warning if invalid value provided
 * - Fallback: returns 'O' if value is invalid (never undefined)
 * 
 * Usage: Replace unsafe "as 'O' | 'M' | 'A'" casts with this function
 */
function normalizeDagdeel(value: any): 'O' | 'M' | 'A' {
  // Check if already valid
  if (value === 'O' || value === 'M' || value === 'A') {
    return value;
  }

  // Log invalid values for debugging
  if (value !== undefined && value !== null) {
    console.warn(`[DRAAD202-CRITICAL] Invalid dagdeel value: '${value}' (type: ${typeof value}), defaulting to 'O'`);
  }

  // Fallback to 'O' (morning shift)
  return 'O';
}

/**
 * Type guard to verify dagdeel is valid
 */
function isDagdeelValid(value: any): value is 'O' | 'M' | 'A' {
  return value === 'O' || value === 'M' || value === 'A';
}

// ============================================================================
// GREEDY ERROR HANDLING (Dutch messages)
// ============================================================================

/**
 * Classify error and return Dutch message for user
 */
function classifyGreedyError(error: any): { type: GreedyErrorType; userMessage: string; details: string } {
  console.error('[DRAAD202] Error classification:', { error: error?.message, code: error?.code });

  // Network/Connection errors
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      userMessage: 'GREEDY service reageert niet (timeout). Probeer later opnieuw.',
      details: `Timeout na ${GREEDY_TIMEOUT}ms`
    };
  }

  if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ERR_INVALID_URL') {
    return {
      type: 'NETWORK_ERROR',
      userMessage: 'Netwerkverbinding onderbroken. Controleer uw internet.',
      details: error.message
    };
  }

  // HTTP 5xx errors
  if (error?.status >= 500) {
    return {
      type: 'SERVER_ERROR',
      userMessage: 'GREEDY service error. Probeer over enkele momenten opnieuw.',
      details: `HTTP ${error.status}: ${error.message}`
    };
  }

  // HTTP 4xx errors
  if (error?.status >= 400 && error?.status < 500) {
    return {
      type: 'CLIENT_ERROR',
      userMessage: 'Request error. Controleer uw gegevens.',
      details: `HTTP ${error.status}: ${error.message}`
    };
  }

  // JSON parse errors
  if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
    return {
      type: 'PARSE_ERROR',
      userMessage: 'Onbekende fout opgetreden. Details: respons parsing error',
      details: error.message
    };
  }

  // Default unknown error
  return {
    type: 'VALIDATION_ERROR',
    userMessage: 'Onbekende fout opgetreden. Details: ' + (error?.message || 'Unknown'),
    details: JSON.stringify(error)
  };
}

// ============================================================================
// GREEDY API CALL
// ============================================================================

/**
 * Call GREEDY API with timeout handling
 * DRAAD202 FIX: Pass flat payload (no nested "data" object)
 * DRAAD202-HOTFIX: Payload must have non-null startdate/enddate
 * DRAAD202-CRITICAL: All dagdeel values validated before sending
 * SINGLE ATTEMPT - NO RETRY LOGIC per DRAAD 202 requirement
 */
async function callGreedyAPI(payload: GreedyPayload): Promise<GreedySolution> {
  console.log('[DRAAD202] === GREEDY API CALL START ===');
  console.log(`[DRAAD202] Endpoint: ${GREEDY_ENDPOINT}`);
  console.log(`[DRAAD202] Roster ID: ${payload.rosterid}`);
  console.log(`[DRAAD202] Date range: ${payload.startdate} to ${payload.enddate}`);
  console.log(`[DRAAD202] Timeout: ${GREEDY_TIMEOUT}ms`);
  
  // DRAAD202 diagnostics
  console.log('[DRAAD202-FIX] Flat payload keys:', Object.keys(payload));
  console.log('[DRAAD202-FIX] Nested data property?', 'data' in payload ? 'ERROR' : 'OK');
  console.log('[DRAAD202-HOTFIX] startdate type:', typeof payload.startdate, 'value:', payload.startdate);
  console.log('[DRAAD202-HOTFIX] enddate type:', typeof payload.enddate, 'value:', payload.enddate);
  console.log('[DRAAD202-CRITICAL] fixedassignments dagdeel values:', payload.fixedassignments.slice(0, 3).map(fa => fa.dagdeel));
  console.log('[DRAAD202-CRITICAL] blockedslots dagdeel values:', payload.blockedslots.slice(0, 3).map(bs => bs.dagdeel));
  console.log('[DRAAD202-CRITICAL] suggestedassignments dagdeel values:', payload.suggestedassignments.slice(0, 3).map(sa => sa.dagdeel));
  
  const startTime = Date.now();

  try {
    // Setup AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GREEDY_TIMEOUT);

    try {
      const response = await fetch(GREEDY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'rooster-app-verloskunde/DRAAD202'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsedMs = Date.now() - startTime;
      console.log(`[DRAAD202] Response received after ${elapsedMs}ms, status: ${response.status}`);

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DRAAD202] GREEDY HTTP error ${response.status}: ${errorText}`);
        
        // Check if INFEASIBLE (special case)
        if (errorText.includes('infeasible') || errorText.includes('INFEASIBLE')) {
          console.warn('[DRAAD202] GREEDY returned INFEASIBLE solution');
          return {
            status: 'FAILED',
            coverageRate: 0,
            assignments: [],
            totalAssignments: 0,
            solveTimeSeconds: elapsedMs / 1000
          };
        }

        throw {
          status: response.status,
          message: errorText || `HTTP ${response.status}`
        };
      }

      // Parse response
      const data: GreedyResponse = await response.json();
      console.log(`[DRAAD202] ✅ GREEDY response parsed successfully`);
      console.log(`[DRAAD202] Status: ${data.status}, Coverage: ${data.coverage}%, Assignments: ${data.total_assignments}`);

      // Validate response structure
      validateGreedyResponse(data);

      // Convert to internal format
      const solution: GreedySolution = {
        status: data.status,
        coverageRate: data.coverage,
        assignments: data.assignments,
        totalAssignments: data.total_assignments,
        solveTimeSeconds: data.solve_time_seconds
      };

      console.log('[DRAAD202] === GREEDY API CALL SUCCESS ===');
      return solution;

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check for abort/timeout
      if (fetchError.name === 'AbortError') {
        console.error(`[DRAAD202] ❌ GREEDY TIMEOUT after ${GREEDY_TIMEOUT}ms`);
        throw {
          name: 'AbortError',
          message: `GREEDY timeout after ${GREEDY_TIMEOUT}ms`
        };
      }

      // Re-throw other fetch errors
      throw fetchError;
    }
  } catch (error: any) {
    const errorClassification = classifyGreedyError(error);
    console.error(`[DRAAD202] ❌ GREEDY API failed:`, errorClassification);
    console.log('[DRAAD202] === GREEDY API CALL FAILED ===');
    
    throw errorClassification;
  }
}

// ============================================================================
// GREEDY RESPONSE VALIDATION
// ============================================================================

/**
 * Validate GREEDY response structure
 */
function validateGreedyResponse(data: any): void {
  console.log('[DRAAD202] Validating GREEDY response...');

  // Check required fields
  if (!data.status) {
    throw { type: 'VALIDATION_ERROR', message: 'Missing status field' };
  }

  if (typeof data.coverage !== 'number') {
    throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid coverage field' };
  }

  if (!Array.isArray(data.assignments)) {
    throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid assignments array' };
  }

  if (typeof data.total_assignments !== 'number') {
    throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid total_assignments' };
  }

  if (typeof data.solve_time_seconds !== 'number') {
    throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid solve_time_seconds' };
  }

  // Validate each assignment
  data.assignments.forEach((assignment: any, idx: number) => {
    if (!assignment.employee_id) {
      throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing employee_id` };
    }
    if (!assignment.date) {
      throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing date` };
    }
    if (!['O', 'M', 'A'].includes(assignment.dagdeel)) {
      throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] invalid dagdeel: ${assignment.dagdeel}` };
    }
    if (!assignment.service_code) {
      throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing service_code` };
    }
  });

  console.log(`[DRAAD202] ✅ Response validation passed`);
}

// ============================================================================
// DATABASE OPERATIONS (DRAAD155 UPDATE pattern)
// ============================================================================

interface EmptySlot {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: string;
}

/**
 * Fetch empty slots that can be filled
 */
async function getEmptySlots(supabase: any, rosterId: string): Promise<EmptySlot[]> {
  const { data, error } = await supabase
    .from('roster_assignments')
    .select('id, roster_id, employee_id, date, dagdeel')
    .eq('roster_id', rosterId)
    .eq('status', 0)
    .is('service_id', null);

  if (error) {
    console.error(`[DRAAD202] Failed to fetch empty slots: ${error.message}`);
    return [];
  }

  console.log(`[DRAAD202] Found ${data?.length || 0} empty slots (status=0, service_id=NULL)`);
  return data || [];
}

/**
 * Find existing slot by exact match (DRAAD155 pattern)
 */
function findExistingSlot(
  emptySlots: EmptySlot[],
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: string
): { id: string } | null {
  const found = emptySlots.find(
    slot =>
      slot.roster_id === rosterId &&
      slot.employee_id === employeeId &&
      slot.date === date &&
      slot.dagdeel === dagdeel
  );

  return found ? { id: found.id } : null;
}

/**
 * Find service ID by code
 */
function findServiceId(serviceCode: string, services: Service[]): string | null {
  const svc = services.find(s => s.code === serviceCode);
  if (!svc) {
    console.warn(`[DRAAD202] Service code not found: '${serviceCode}'`);
    return null;
  }
  return svc.id;
}

/**
 * DRAAD202-TYPEERROR-FIX: Convert structureel_nbh to number
 * Database stores JSONB which can be boolean, string, number, or null
 * GREEDY API expects number | undefined
 */
function convertStructureelNbh(value: any): number | undefined {
  // Already a number
  if (typeof value === 'number') {
    return value;
  }

  // Convert string to number
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Convert boolean to number (true=1, false=0)
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // Null or undefined returns undefined
  return undefined;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const solverRunId = crypto.randomUUID();
  const executionMs = Date.now();
  const cacheBustId = `DRAAD202-${executionMs}-${Math.floor(Math.random() * 100000)}`;

  console.log('[DRAAD202] ========== POST /api/roster/solve ==========');
  console.log(`[DRAAD202] Cache bust ID: ${cacheBustId}`);
  console.log(`[DRAAD202] Solver run ID: ${solverRunId}`);

  try {
    const { roster_id } = await request.json();

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD202] Roster ID: ${roster_id}`);

    const supabase = await createClient();

    // Fetch roster
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error('[DRAAD202] Roster not found');
      return NextResponse.json(
        { error: 'Roster niet gevonden' },
        { status: 404 }
      );
    }

    // DRAAD202-HOTFIX: Verify roster has start_date and end_date
    if (!roster.start_date || !roster.end_date) {
      console.error('[DRAAD202-HOTFIX] Roster missing date range:', { 
        start_date: roster.start_date, 
        end_date: roster.end_date 
      });
      return NextResponse.json(
        { error: 'Roster heeft geen geldige begindatum of einddatum' },
        { status: 400 }
      );
    }

    // Convert dates to ISO string format (YYYY-MM-DD)
    const startDate = new Date(roster.start_date).toISOString().split('T')[0];
    const endDate = new Date(roster.end_date).toISOString().split('T')[0];
    
    console.log('[DRAAD202-HOTFIX] Roster dates verified:', { startDate, endDate });

    if (roster.status !== 'draft') {
      console.error(`[DRAAD202] Roster status is '${roster.status}', moet 'draft' zijn`);
      return NextResponse.json(
        { error: `Roster status is '${roster.status}', moet 'draft' zijn` },
        { status: 400 }
      );
    }

    // Fetch employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, voornaam, achternaam, dienstverband, structureel_nbh, team')
      .eq('actief', true);

    if (empError || !employees || employees.length === 0) {
      console.error('[DRAAD202] No active employees found');
      return NextResponse.json(
        { error: 'Geen actieve medewerkers gevonden' },
        { status: 400 }
      );
    }

    // Fetch services
    const { data: services, error: svcError } = await supabase
      .from('service_types')
      .select('id, code, naam')
      .eq('actief', true);

    if (svcError || !services || services.length === 0) {
      console.error('[DRAAD202] No active services configured');
      return NextResponse.json(
        { error: 'Geen actieve diensten geconfigureerd' },
        { status: 400 }
      );
    }

    // Fetch roster employee services
    const { data: rosterEmpServices } = await supabase
      .from('roster_employee_services')
      .select('roster_id, employee_id, service_id, aantal, actief')
      .eq('roster_id', roster_id)
      .eq('actief', true);

    const safeRosterEmpServices = rosterEmpServices || [];

    // Fetch fixed assignments
    const { data: fixedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 1);

    const safeFixedData = fixedData || [];

    // Fetch blocked slots
    const { data: blockedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', roster_id)
      .in('status', [2, 3]);

    const safeBlockedData = blockedData || [];

    // Fetch suggested assignments
    const { data: suggestedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 0)
      .not('service_id', 'is', null);

    const safeSuggestedData = suggestedData || [];

    // Fetch staffing requirements
    const { data: staffingData } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select(`
        id,
        dagdeel,
        team,
        aantal,
        roster_period_staffing!inner(
          date,
          service_id,
          roster_id,
          service_types!inner(
            id,
            code,
            is_system
          )
        )
      `)
      .eq('roster_period_staffing.roster_id', roster_id)
      .gt('aantal', 0);

    const exact_staffing = (staffingData || []).map(row => {
      const rps = Array.isArray(row.roster_period_staffing)
        ? row.roster_period_staffing[0]
        : row.roster_period_staffing;
      const st = Array.isArray(rps?.service_types)
        ? rps.service_types[0]
        : rps?.service_types;

      return {
        date: rps?.date || '',
        dagdeel: normalizeDagdeel(row.dagdeel), // ✅ DRAAD202-CRITICAL: Use validated dagdeel
        service_id: rps?.service_id || '',
        team: row.team as 'TOT' | 'GRO' | 'ORA',
        exact_aantal: row.aantal,
        is_system_service: st?.is_system || false
      };
    }).filter(item => item.date && item.service_id);

    // Build solver request
    const solverRequest: SolveRequest = {
      roster_id: roster_id.toString(),
      start_date: startDate,
      end_date: endDate,
      employees: employees.map(emp => ({
        id: emp.id,
        voornaam: emp.voornaam,
        achternaam: emp.achternaam,
        team: emp.dienstverband as 'maat' | 'loondienst' | 'overig',
        structureel_nbh: convertStructureelNbh(emp.structureel_nbh), // ✅ DRAAD202-TYPEERROR-FIX
        min_werkdagen: undefined
      })),
      services: services.map(svc => ({
        id: svc.id,
        code: svc.code,
        naam: svc.naam
      })),
      roster_employee_services: safeRosterEmpServices.map(res => ({
        roster_id: res.roster_id.toString(),
        employee_id: res.employee_id,
        service_id: res.service_id,
        aantal: res.aantal,
        actief: res.actief
      })),
      fixed_assignments: safeFixedData.map(fa => ({
        employee_id: fa.employee_id,
        date: fa.date,
        dagdeel: normalizeDagdeel(fa.dagdeel), // ✅ DRAAD202-CRITICAL: Runtime validation + type safety
        service_id: fa.service_id
      })),
      blocked_slots: safeBlockedData.map(bs => ({
        employee_id: bs.employee_id,
        date: bs.date,
        dagdeel: normalizeDagdeel(bs.dagdeel), // ✅ DRAAD202-CRITICAL: Runtime validation + type safety
        status: bs.status as 2 | 3
      })),
      suggested_assignments: safeSuggestedData.map(sa => ({
        employee_id: sa.employee_id,
        date: sa.date,
        dagdeel: normalizeDagdeel(sa.dagdeel), // ✅ DRAAD202-CRITICAL: Runtime validation + type safety
        service_id: sa.service_id
      })),
      exact_staffing,
      timeout_seconds: Math.floor(GREEDY_TIMEOUT / 1000)
    };

    console.log('[DRAAD202] Preparing GREEDY request...');
    
    // DRAAD202 FIX: Build flat payload (no nested "data" object)
    // DRAAD202-HOTFIX: Ensure start_date and end_date are NOT null/undefined
    // DRAAD202-CRITICAL: All dagdeel values validated before sending to GREEDY
    const greedyPayload: GreedyPayload = {
      rosterid: roster_id.toString(),
      startdate: solverRequest.start_date as string, // ✅ TypeScript verified non-null
      enddate: solverRequest.end_date as string,     // ✅ TypeScript verified non-null
      employees: solverRequest.employees || [],
      services: solverRequest.services || [],
      rosteremployeeservices: solverRequest.roster_employee_services || [],
      fixedassignments: solverRequest.fixed_assignments || [],
      blockedslots: solverRequest.blocked_slots || [],
      suggestedassignments: solverRequest.suggested_assignments || [],
      exactstaffing: solverRequest.exact_staffing || [],
      timeoutseconds: solverRequest.timeout_seconds || 30
    };

    // Call GREEDY
    console.log('[DRAAD202] Calling GREEDY API...');
    let greedySolution: GreedySolution;
    try {
      greedySolution = await callGreedyAPI(greedyPayload);
    } catch (greedyError: any) {
      console.error('[DRAAD202] GREEDY call failed:', greedyError);

      // Return user-friendly error message
      return NextResponse.json(
        {
          error: 'Roostering kon niet worden opgelost',
          userMessage: greedyError.userMessage || 'Onbekende fout opgetreden',
          details: greedyError.details
        },
        { status: greedyError.status || 500 }
      );
    }

    // Handle INFEASIBLE or FAILED solutions
    if (greedySolution.status === 'FAILED') {
      console.warn('[DRAAD202] GREEDY returned FAILED status');
      return NextResponse.json(
        {
          success: true,
          roster_id,
          warning: 'INFEASIBLE',
          message: 'De roostering is niet haalbaar met de huige constraints',
          solver_result: {
            status: greedySolution.status,
            coverage: greedySolution.coverageRate,
            assignments: [],
            total_assignments: 0
          },
          total_time_ms: Date.now() - startTime
        }
      );
    }

    // Process GREEDY assignments (DRAAD155 UPDATE pattern)
    console.log('[DRAAD202] === PHASE 1: BASELINE VERIFICATION ===');
    const emptySlots = await getEmptySlots(supabase, roster_id);

    if (emptySlots.length === 0) {
      console.warn('[DRAAD202] ⚠️  No empty slots found');
    }
    console.log('[DRAAD202] === END BASELINE VERIFICATION ===');

    // UPDATE loop
    console.log('[DRAAD202] === PHASE 2: UPDATE LOOP ===');
    let updateCount = 0;
    let skipCount = 0;
    let notFoundCount = 0;

    for (const greedyAssignment of greedySolution.assignments) {
      const serviceId = findServiceId(greedyAssignment.service_code, services);

      const existingSlot = findExistingSlot(
        emptySlots,
        roster_id,
        greedyAssignment.employee_id,
        greedyAssignment.date,
        greedyAssignment.dagdeel
      );

      if (!existingSlot) {
        notFoundCount++;
        console.warn(
          `[DRAAD202] Slot not found for ${roster_id}|${greedyAssignment.employee_id}|${greedyAssignment.date}|${greedyAssignment.dagdeel}`
        );
        continue;
      }

      // UPDATE existing row
      const { error } = await supabase
        .from('roster_assignments')
        .update({
          service_id: serviceId,
          status: serviceId ? 1 : 0,
          source: 'greedy',
          ort_run_id: solverRunId,
          ort_confidence: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSlot.id);

      if (error) {
        console.error(
          `[DRAAD202] UPDATE failed for slot ${existingSlot.id}: ${error.message}`
        );
      } else {
        updateCount++;
        console.log(
          `[DRAAD202] ✅ Updated slot ${updateCount}: ${greedyAssignment.employee_id}|${greedyAssignment.date}|${greedyAssignment.dagdeel} → ${greedyAssignment.service_code}`
        );
      }
    }

    console.log('[DRAAD202] === END UPDATE LOOP ===');
    console.log(
      `[DRAAD202] Update phase: ${updateCount} updated, ${notFoundCount} not found`
    );

    // Update roster status
    const { error: updateError } = await supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);

    if (!updateError) {
      console.log('[DRAAD202] Roster status: draft → in_progress');
    }

    const totalTime = Date.now() - startTime;

    console.log('[DRAAD202] ========== SUCCESS ==========');

    return NextResponse.json({
      success: true,
      roster_id,
      solver_result: {
        status: greedySolution.status,
        coverage: greedySolution.coverageRate,
        assignments: greedySolution.assignments,
        total_assignments: greedySolution.totalAssignments,
        solve_time_seconds: greedySolution.solveTimeSeconds
      },
      database_updates: {
        successful: updateCount,
        not_found: notFoundCount,
        total_greedy_assignments: greedySolution.totalAssignments
      },
      draad202: {
        status: 'IMPLEMENTED',
        version: '1.3-CRITICAL-FIXED',
        endpoint: GREEDY_ENDPOINT,
        timeout_ms: GREEDY_TIMEOUT,
        retry_attempts: 0,
        cache_bust_id: cacheBustId,
        payload_structure: 'FLAT (no nested data object)',
        date_handling: 'ISO 8601 strings (verified non-null)',
        structureel_nbh_handling: 'Converted from JSONB to number | undefined',
        dagdeel_handling: 'Runtime validated via normalizeDagdeel() - strict literal type checking',
        message: 'Backend GREEDY integration fixed - type-safe dagdeel validation, no more TypeScript errors'
      },
      total_time_ms: totalTime
    });

  } catch (error: any) {
    console.error('[DRAAD202] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
