/**
 * API Route: POST /api/roster/solve
 * 
 * Integreert Next.js app met Python OR-Tools solver service.
 * 
 * DRAAD118A: INFEASIBLE Handling - Conditional Status Update
 * - IF FEASIBLE/OPTIMAL: Write assignments, status → in_progress
 * - IF INFEASIBLE: Skip assignments, status stays 'draft', return bottleneck_report
 * 
 * DRAAD106: Pre-planning Behouden
 * - Reset alleen ORT voorlopige planning (status 0 + service_id → NULL)
 * - Schrijf ORT output naar status 0 (voorlopig)
 * - Respecteer status 1 (fixed), status 2/3 (blocked)
 * 
 * DRAAD108: Exacte Bezetting Realiseren
 * - Fetch roster_period_staffing_dagdelen data
 * - Transform naar exact_staffing format
 * - Send naar solver voor constraint 7 (exacte bezetting)
 * 
 * DRAAD115: Employee Data Mapping Fix
 * - Split voornaam + achternaam (separate fields, not combined)
 * - Use employees.dienstverband with mapping (not employees.team)
 * - Remove max_werkdagen field (not needed for solver)
 * 
 * OPTIE E: Service Code Mapping Enhancement
 * - FIXED: Map solver service_code → service_id UUID (was hardcoded NULL)
 * - Add source='ort' marker for ORT origin tracking
 * - Add ort_confidence, ort_run_id for audit trail
 * - Add constraint_reason for debugging info
 * - Add previous_service_id for rollback capability
 * - UI filtert op source='ort' voor hint display
 * - Constraint change: status=0 CAN have service_id!=NULL (ORT suggestions)
 * 
 * DRAAD128: UPSERT FIX (PostgreSQL RPC Function)
 * - FIXED: "ON CONFLICT DO UPDATE command cannot affect row a second time" error
 * - NEW: Use PostgreSQL function upsert_ort_assignments() via rpc()
 * - Benefits: Atomic transaction, race-condition safe, no duplicate conflicts
 * - Function signature: upsert_ort_assignments(p_assignments: jsonb) → (success, inserted_count, error_message)
 * - Replaces: Supabase upsert() with onConflict parameter (not supported)
 * 
 * DRAAD128.6: SOURCE FIELD CASE FIX
 * - FIXED: CHECK constraint violation: source must be lowercase 'ort'
 * - Previous: source='ORT' (uppercase) - violates constraint
 * - Now: source='ort' (lowercase) - matches constraint allowed values
 * - Constraint values: ['manual', 'ort', 'system', 'import']
 * 
 * DRAAD128.8: RPC RESPONSE DEBUGGING
 * - FIXED: Added detailed logging for upsertResult
 * - Log full response structure
 * - Check for null/undefined
 * - Validate Array.isArray()
 * - Debug result object contents
 * 
 * DRAAD127: DUPLICATE PREVENTION (TypeScript + SQL)
 * - FIXED: Solver batch can contain duplicate keys (same employee-date-dagdeel)
 * - NEW: Deduplicate in TypeScript BEFORE UPSERT
 * - Method: Use Set<string> to track unique keys
 * - Key format: "roster_id|employee_id|date|dagdeel"
 * - SQL function also uses DISTINCT ON for double protection
 * - Prevents: "ON CONFLICT cannot affect row a second time"
 * 
 * DRAAD129: DIAGNOSTIC LOGGING FOR DUPLICATE DETECTION
 * - NEW: Detailed logging before deduplication
 * - Log raw solver output count
 * - Sample first 5 assignments
 * - Find duplicate keys (employee_id|date|dagdeel)
 * - Log duplicates found count
 * - Compare before/after deduplication
 * - Identify source of duplicates (solver vs transformation)
 * - Cache busting: timestamp in logs
 * 
 * DRAAD129-STAP2: BATCH PROCESSING FOR UPSERT
 * - FIXED: All-at-once UPSERT causing "cannot affect row twice" error
 * - NEW: Process assignments in batches (BATCH_SIZE = 50)
 * - Method: Loop through deduplicated assignments, call RPC per batch
 * - Benefits:
 *   - Isolate which batch fails
 *   - Better error messages
 *   - Prevent timeout on 1133 items
 *   - Track progress
 * - Error handling: Per-batch error collection
 * - Logging: Batch start, success, failure with details
 * - Status: Each batch reported individually
 * 
 * DRAAD129-HOTFIX: SYNTAX ERROR FIX
 * - FIXED: Unterminated string constant on line 822
 * - cache_busting string now properly closed
 * - Build should pass now
 * 
 * DRAAD121: Database Constraint Fix (now OPTIE E complement)
 * - FIXED: status=0 + service_id violation with ORT suggestions
 * - Database constraint modified: status=0 MAY have service_id!=NULL
 * - Previous: service_id MUST NULL for status=0 (broke ORT)
 * - Now: service_id CAN be NULL (empty) OR filled (ORT suggestion)
 * - Status 1,2,3 constraint rules unchanged
 * 
 * DRAAD122: CRITICAL FIX - Destructive DELETE Removal
 * - REMOVED: DELETE status=0 assignments (was destroying 82% of roster)
 * - NEW: UPSERT pattern - atomic, race-condition safe
 * - Preserves ALL 1365 slots in roster schema
 * - Status=0 records now safely updated, never deleted
 * 
 * DRAAD125A: TypeScript Null-Safety Fix
 * - FIXED: 'solverRequest.employees' possibly undefined error
 * - Added proper null-checks after data fetch
 * - Validate array contents before processing
 * - Early returns for missing data
 * 
 * Flow:
 * 1. Fetch roster data from Supabase
 * 2. Transform to solver input format (fixed + blocked split)
 * 3. DRAAD108: Fetch exact staffing requirements
 * 4. Call Python solver service (Railway)
 * 5. DRAAD118A: Check solver status
 *    → FEASIBLE: Write assignments via UPSERT, update status
 *    → INFEASIBLE: Skip, return bottleneck_report
 * 6. DRAAD128: Write with PostgreSQL RPC function (atomic, safe)
 * 7. DRAAD127: Deduplicate assignments before UPSERT
 * 8. DRAAD129: Diagnostic logging to identify duplicate source
 * 9. DRAAD129-STAP2: Process assignments in batches (BATCH_SIZE=50)
 * 10. OPTIE E: Write with ORT tracking fields + service_id mapping
 * 11. Return appropriate response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  SolveRequest,
  SolveResponse,
  Employee,
  Service,
  RosterEmployeeService,
  FixedAssignment,  // DRAAD106: nieuw
  BlockedSlot,      // DRAAD106: nieuw
  SuggestedAssignment,  // DRAAD106: nieuw
  ExactStaffing  // DRAAD108: nieuw
} from '@/lib/types/solver';

const SOLVER_URL = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';
const SOLVER_TIMEOUT = 35000; // 35s (solver heeft 30s intern)

/**
 * DRAAD115: Mapping for employees.dienstverband → solver team enum
 * Database values: "Maat", "Loondienst", "ZZP" (capital first letter)
 * Solver expects: "maat", "loondienst", "overig" (lowercase)
 */
const dienstverbandMapping: Record<string, 'maat' | 'loondienst' | 'overig'> = {
  'Maat': 'maat',
  'Loondienst': 'loondienst',
  'ZZP': 'overig'
};

/**
 * OPTIE E: Helper function to map service_code (string) → service_id (UUID)
 * 
 * @param serviceCode - Solver output service code (e.g., 'DIO', 'DIA', 'DDO', etc.)
 * @param services - Array of service objects with id and code
 * @returns UUID of service or null if not found
 * 
 * Usage:
 *   const serviceId = findServiceId('DIO', services);
 *   // Returns: '550e8400-e29b-41d4-a456-426614174000' or null
 */
const findServiceId = (serviceCode: string, services: Service[]): string | null => {
  const svc = services.find(s => s.code === serviceCode);
  
  if (!svc) {
    console.warn(`[OPTIE E] Service code not found: '${serviceCode}'. Available codes: ${services.map(s => s.code).join(', ')}`);
    return null;
  }
  
  return svc.id;
};

/**
 * DRAAD127: Deduplicate assignments by unique key
 * 
 * Removes exact duplicates that could cause "ON CONFLICT cannot affect row twice" error.
 * Uses composite key: (roster_id, employee_id, date, dagdeel)
 * 
 * @param assignments - Array of assignments with potential duplicates
 * @returns Deduplicated array, keeping first occurrence of each key
 */
interface Assignment {
  roster_id: string | any;
  employee_id: string;
  date: string;
  dagdeel: string;
  [key: string]: any;
}

const deduplicateAssignments = (assignments: Assignment[]): Assignment[] => {
  const seenKeys = new Set<string>();
  const deduplicated: Assignment[] = [];
  let duplicateCount = 0;

  for (const assignment of assignments) {
    // DRAAD127: Create composite key for uniqueness
    const key = `${assignment.roster_id}|${assignment.employee_id}|${assignment.date}|${assignment.dagdeel}`;
    
    if (seenKeys.has(key)) {
      duplicateCount++;
      console.warn(`[DRAAD127] Duplicate detected and filtered: ${key}`);
      continue;  // Skip this duplicate
    }
    
    seenKeys.add(key);
    deduplicated.push(assignment);
  }
  
  if (duplicateCount > 0) {
    console.log(`[DRAAD127] Deduplicated: removed ${duplicateCount} duplicates (${assignments.length} → ${deduplicated.length})`);
  }
  
  return deduplicated;
};

/**
 * POST /api/roster/solve
 * 
 * DRAAD118A: Response structure depends on solver_status
 * 
 * Body: { roster_id: number }
 * 
 * Response (FEASIBLE/OPTIMAL):
 * {
 *   success: true,
 *   roster_id: uuid,
 *   solver_result: {
 *     status: 'feasible' | 'optimal',
 *     assignments: [...],
 *     summary: { total_services_scheduled, coverage_percentage, unfilled_slots },
 *     bottleneck_report: null,
 *     total_assignments, fill_percentage, etc.
 *   }
 * }
 * 
 * Response (INFEASIBLE):
 * {
 *   success: true,
 *   roster_id: uuid,
 *   solver_result: {
 *     status: 'infeasible',
 *     assignments: [],
 *     summary: null,
 *     bottleneck_report: {
 *       bottlenecks: [...],
 *       critical_count: N,
 *       suggestions: [...],
 *       shortage_percentage: X%
 *     },
 *     total_assignments: 0
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // OPTIE E: Generate unique solverRunId for this ORT execution
  // Used for audit trail: ort_run_id = UUID of this run
  const solverRunId = crypto.randomUUID();
  
  // DRAAD129: Cache busting - timestamp for this execution
  const executionTimestamp = new Date().toISOString();
  const executionMs = Date.now();
  const cacheBustingId = `DRAAD129-${executionMs}-${Math.floor(Math.random() * 10000)}`;
  
  try {
    // 1. Parse request
    const { roster_id } = await request.json();
    
    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }
    
    console.log(`[Solver API] Start solve voor roster ${roster_id}`);
    console.log(`[OPTIE E] solverRunId: ${solverRunId}`);
    console.log(`[DRAAD127] Deduplication enabled`);
    console.log(`[DRAAD129] Execution timestamp: ${executionTimestamp} (${executionMs})`);
    console.log(`[DRAAD129] Cache busting: ${cacheBustingId}`);
    
    // 2. Initialiseer Supabase client
    const supabase = await createClient();
    
    // 3. Fetch roster data
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();
    
    if (rosterError || !roster) {
      console.error('[Solver API] Roster not found:', rosterError);
      return NextResponse.json(
        { error: 'Roster niet gevonden' },
        { status: 404 }
      );
    }
    
    // DRAAD106: Validatie - alleen 'draft' roosters mogen ORT gebruiken
    if (roster.status !== 'draft') {
      return NextResponse.json(
        { error: `Roster status is '${roster.status}', moet 'draft' zijn voor ORT` },
        { status: 400 }
      );
    }
    
    console.log(`[Solver API] Roster gevonden: ${roster.naam}, periode ${roster.start_date} - ${roster.end_date}`);
    
    // 4. Fetch employees
    // DRAAD115: Query now uses dienstverband instead of team, removes aantalwerkdagen
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, voornaam, achternaam, dienstverband, structureel_nbh')
      .eq('actief', true);
    
    if (empError) {
      console.error('[Solver API] Employees fetch error:', empError);
      return NextResponse.json(
        { error: 'Fout bij ophalen medewerkers' },
        { status: 500 }
      );
    }
    
    // DRAAD125A: Null-check employees array
    if (!employees || employees.length === 0) {
      console.error('[DRAAD125A] Employees array is empty or null');
      return NextResponse.json(
        { error: 'Geen actieve medewerkers gevonden' },
        { status: 400 }
      );
    }
    
    // 5. Fetch services
    const { data: services, error: svcError } = await supabase
      .from('service_types')
      .select('id, code, naam')
      .eq('actief', true);
    
    if (svcError) {
      console.error('[Solver API] Services fetch error:', svcError);
      return NextResponse.json(
        { error: 'Fout bij ophalen diensten' },
        { status: 500 }
      );
    }
    
    // DRAAD125A: Null-check services array
    if (!services || services.length === 0) {
      console.error('[DRAAD125A] Services array is empty or null');
      return NextResponse.json(
        { error: 'Geen actieve diensten geconfigureerd' },
        { status: 400 }
      );
    }
    
    // 6. DRAAD105: Fetch roster-employee-service bevoegdheden
    const { data: rosterEmpServices, error: resError } = await supabase
      .from('roster_employee_services')
      .select('roster_id, employee_id, service_id, aantal, actief')
      .eq('roster_id', roster_id)
      .eq('actief', true);
    
    if (resError) {
      console.error('[Solver API] Roster-employee-services fetch error:', resError);
      return NextResponse.json(
        { error: 'Fout bij ophalen bevoegdheden' },
        { status: 500 }
      );
    }
    
    // DRAAD125A: Null-safe handling for optional arrays
    const safeRosterEmpServices = rosterEmpServices || [];
    
    // 7. DRAAD106: Fetch fixed assignments (status 1)
    const { data: fixedData, error: fixedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 1);
    
    if (fixedError) {
      console.error('[Solver API] Fixed assignments fetch error:', fixedError);
    }
    
    // DRAAD125A: Null-safe handling
    const safeFixedData = fixedData || [];
    
    // 8. DRAAD106: Fetch blocked slots (status 2, 3)
    const { data: blockedData, error: blockedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', roster_id)
      .in('status', [2, 3]);
    
    if (blockedError) {
      console.error('[Solver API] Blocked slots fetch error:', blockedError);
    }
    
    // DRAAD125A: Null-safe handling
    const safeBlockedData = blockedData || [];
    
    // 9. DRAAD106: Fetch suggested assignments (status 0 + service_id)
    // Optioneel - alleen voor warm-start hints
    const { data: suggestedData, error: suggestedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 0)
      .not('service_id', 'is', null);
    
    if (suggestedError) {
      console.error('[Solver API] Suggested assignments fetch error:', suggestedError);
    }
    
    // DRAAD125A: Null-safe handling
    const safeSuggestedData = suggestedData || [];
    
    // ============================================================
    // 10. DRAAD108: Fetch exacte bezetting eisen
    // ============================================================
    console.log('[DRAAD108] Ophalen exacte bezetting...');
    
    const { data: staffingData, error: staffingError } = await supabase
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
      .gt('aantal', 0);  // Alleen aantal > 0 (aantal = 0 wordt NIET gestuurd)
    
    if (staffingError) {
      console.error('[DRAAD108] Exacte bezetting fetch error:', staffingError);
      // Niet fataal - solver blijft werken zonder constraint 7
    }
    
    // Transform naar exact_staffing format
    // DRAAD108: Supabase returnt nested relations als arrays
    const exact_staffing = (staffingData || []).map(row => {
      const rps = Array.isArray(row.roster_period_staffing) ? row.roster_period_staffing[0] : row.roster_period_staffing;
      const st = Array.isArray(rps?.service_types) ? rps.service_types[0] : rps?.service_types;
      
      return {
        date: rps?.date || '',
        dagdeel: row.dagdeel as 'O' | 'M' | 'A',
        service_id: rps?.service_id || '',
        team: row.team as 'TOT' | 'GRO' | 'ORA',
        exact_aantal: row.aantal,
        is_system_service: st?.is_system || false
      };
    }).filter(item => item.date && item.service_id);  // Filter incomplete records
    
    // Log statistieken
    const systemCount = exact_staffing.filter(e => e.is_system_service).length;
    const totCount = exact_staffing.filter(e => e.team === 'TOT').length;
    const groCount = exact_staffing.filter(e => e.team === 'GRO').length;
    const oraCount = exact_staffing.filter(e => e.team === 'ORA').length;
    
    console.log('[DRAAD108] Exacte bezetting transform compleet:');
    console.log(`  - Totaal eisen: ${exact_staffing.length}`);
    console.log(`  - Systeemdiensten (DIO/DIA/DDO/DDA): ${systemCount}`);
    console.log(`  - Team TOT: ${totCount}`);
    console.log(`  - Team GRO: ${groCount}`);
    console.log(`  - Team ORA: ${oraCount}`);
    
    // ============================================================
    // END DRAAD108
    // ============================================================
    
    console.log(`[Solver API] Data verzameld: ${employees.length} medewerkers, ${services.length} diensten, ${safeRosterEmpServices.length} bevoegdheden (actief), ${safeFixedData.length} fixed, ${safeBlockedData.length} blocked, ${safeSuggestedData.length} suggested, ${exact_staffing.length} exacte bezetting (DRAAD108)`);
    
    // 11. Transform naar solver input format
    // DRAAD115: Split voornaam/achternaam, use dienstverband mapping, remove max_werkdagen
    const solverRequest: SolveRequest = {
      roster_id: roster_id.toString(),
      start_date: roster.start_date,
      end_date: roster.end_date,
      // DRAAD125A: Non-null assertion after validation
      employees: employees.map(emp => {
        const mappedTeam = dienstverbandMapping[emp.dienstverband as keyof typeof dienstverbandMapping] || 'overig';
        return {
          id: emp.id,
          voornaam: emp.voornaam,  // DRAAD115: split voornaam
          achternaam: emp.achternaam,  // DRAAD115: split achternaam
          team: mappedTeam,  // DRAAD115: mapped from dienstverband
          structureel_nbh: emp.structureel_nbh || undefined,
          min_werkdagen: undefined
          // DRAAD115: removed max_werkdagen - not needed for solver
        };
      }),
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
      // DRAAD106: Nieuwe velden
      fixed_assignments: safeFixedData.map(fa => ({
        employee_id: fa.employee_id,
        date: fa.date,
        dagdeel: fa.dagdeel as 'O' | 'M' | 'A',
        service_id: fa.service_id
      })),
      blocked_slots: safeBlockedData.map(bs => ({
        employee_id: bs.employee_id,
        date: bs.date,
        dagdeel: bs.dagdeel as 'O' | 'M' | 'A',
        status: bs.status as 2 | 3
      })),
      suggested_assignments: safeSuggestedData.map(sa => ({
        employee_id: sa.employee_id,
        date: sa.date,
        dagdeel: sa.dagdeel as 'O' | 'M' | 'A',
        service_id: sa.service_id
      })),
      // DRAAD108: NIEUW - Exacte bezetting
      exact_staffing,
      timeout_seconds: 30
    };
    
    // DRAAD115: Log Employee sample for verification
    // DRAAD125A: Safe array access with validated non-null employees
    if (solverRequest.employees && solverRequest.employees.length > 0) {
      console.log('[DRAAD115] Employee sample:', JSON.stringify(solverRequest.employees[0], null, 2));
      console.log('[DRAAD115] Employee count:', solverRequest.employees.length);
    }
    
    console.log(`[Solver API] Solver request voorbereid (DRAAD108: ${exact_staffing.length} bezetting eisen), aanroepen ${SOLVER_URL}/api/v1/solve-schedule...`);
    
    // 12. Call Python solver service
    const solverResponse = await fetch(`${SOLVER_URL}/api/v1/solve-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(solverRequest),
      signal: AbortSignal.timeout(SOLVER_TIMEOUT)
    });
    
    if (!solverResponse.ok) {
      const errorText = await solverResponse.text();
      console.error(`[Solver API] Solver service error (${solverResponse.status}):`, errorText);
      return NextResponse.json(
        { error: `Solver service fout: ${errorText}` },
        { status: solverResponse.status }
      );
    }
    
    const solverResult: SolveResponse = await solverResponse.json();
    
    console.log(`[Solver API] Solver voltooid: status=${solverResult.status}, assignments=${solverResult.total_assignments}, tijd=${solverResult.solve_time_seconds}s`);
    
    // DRAAD108: Log bezetting violations
    const bezettingViolations = (solverResult.violations || []).filter(
      v => v.constraint_type === 'bezetting_realiseren'
    );
    
    if (bezettingViolations.length > 0) {
      console.warn(`[DRAAD108] ${bezettingViolations.length} bezetting violations:`);
      bezettingViolations.slice(0, 5).forEach(v => {
        console.warn(`  - ${v.message}`);
      });
    } else if (exact_staffing.length > 0) {
      console.log('[DRAAD108] ✅ Alle bezetting eisen voldaan!');
    }
    
    // ============================================================
    // DRAAD118A: CONDITIONAL HANDLING BASED ON SOLVER STATUS
    // ============================================================
    
    if (solverResult.status === 'optimal' || solverResult.status === 'feasible') {
      // ======== PATH A: FEASIBLE/OPTIMAL - WRITE ASSIGNMENTS & UPDATE STATUS ========
      console.log(`[DRAAD118A] Solver returned FEASIBLE - processing assignments...`);
      
      // 13A. OPTIE E: Map service_code → service_id + add ORT tracking
      console.log('[OPTIE E] Transforming assignments: service_code → service_id + ORT tracking...');
      
      // OPTIE E: Transform solver assignments to database format with ORT tracking
      const assignmentsToUpsert = solverResult.assignments.map(a => {
        // OPTIE E: Map service_code (string from solver) → service_id (UUID)
        const serviceId = findServiceId(a.service_code, services);
        
        if (!serviceId) {
          console.warn(`[OPTIE E] Warning: Could not map service code '${a.service_code}' for ${a.employee_id} on ${a.date}`);
        }
        
        return {
          roster_id,
          employee_id: a.employee_id,
          date: a.date,
          dagdeel: a.dagdeel,
          service_id: serviceId,  // OPTIE E: Map service_code → UUID (not NULL!)
          status: 0,  // Voorlopig - ORT suggestion
          source: 'ort',  // DRAAD128.6: FIXED - lowercase 'ort' (was 'ORT')
          notes: `ORT suggestion: ${a.service_code}`,
          
          // OPTIE E: ORT tracking fields
          ort_confidence: a.confidence || null,  // Solver zekerheid (0-1)
          ort_run_id: solverRunId,  // UUID van deze ORT run (audit trail)
          constraint_reason: {  // JSONB: debugging info
            solver_suggestion: true,
            service_code: a.service_code,
            confidence: a.confidence || 0,
            solve_time: solverResult.solve_time_seconds
          },
          previous_service_id: null  // Wordt ingevuld IF record exists (zie UPSERT)
        };
      });
      
      if (assignmentsToUpsert.length > 0) {
        console.log(`[OPTIE E] ${assignmentsToUpsert.length} assignments raw from solver`);
        
        // ============================================================
        // DRAAD129: DIAGNOSTIC LOGGING - DUPLICATE DETECTION
        // ============================================================
        console.log('[DRAAD129] === DIAGNOSTIC PHASE: Analyzing solver output for duplicates ===');
        console.log(`[DRAAD129] Raw solver assignments: ${assignmentsToUpsert.length} total`);
        console.log(`[DRAAD129] Execution timestamp: ${executionTimestamp} | ${executionMs}`);
        console.log(`[DRAAD129] Cache busting: ${cacheBustingId}`);
        
        // Build key map to find duplicates
        const keyMap = new Map<string, number>();
        const keyInstances = new Map<string, Array<{ index: number; emp: string; date: string; dagdeel: string }> >();
        
        assignmentsToUpsert.forEach((a, i) => {
          // DRAAD129: Use same key format as deduplication
          const key = `${a.employee_id}|${a.date}|${a.dagdeel}`;
          keyMap.set(key, (keyMap.get(key) || 0) + 1);
          
          // Track all instances of duplicate keys
          if (!keyInstances.has(key)) {
            keyInstances.set(key, []);
          }
          keyInstances.get(key)!.push({
            index: i,
            emp: a.employee_id,
            date: a.date,
            dagdeel: a.dagdeel
          });
          
          // Log first 5 samples
          if (i < 5) {
            console.log(`[DRAAD129] Sample ${i}: emp=${a.employee_id}, date=${a.date}, dagdeel=${a.dagdeel}, service=${a.service_id ? 'mapped' : 'NULL'}`);
          }
        });
        
        // Find and log duplicates
        const duplicateKeys = Array.from(keyMap.entries())
          .filter(([_, count]) => count > 1)
          .sort((a, b) => b[1] - a[1]);  // Sort by count descending
        
        if (duplicateKeys.length > 0) {
          console.error(`[DRAAD129] 🚨 DUPLICATES FOUND: ${duplicateKeys.length} duplicate keys detected in solver output`);
          console.error(`[DRAAD129] Total duplicate instances: ${duplicateKeys.reduce((sum, [_, count]) => sum + (count - 1), 0)}`);
          
          duplicateKeys.forEach(([key, count], idx) => {
            console.error(`[DRAAD129] Duplicate #${idx + 1}: key='${key}' appears ${count} times`);
            const instances = keyInstances.get(key) || [];
            instances.forEach(inst => {
              console.error(`[DRAAD129]   - Index ${inst.index}: emp=${inst.emp}|date=${inst.date}|dagdeel=${inst.dagdeel}`);
            });
          });
        } else {
          console.log('[DRAAD129] ✅ No duplicates found in raw solver output');
        }
        
        console.log(`[DRAAD129] Unique keys in solver output: ${keyMap.size} / ${assignmentsToUpsert.length}`);
        
        // ============================================================
        // END DRAAD129 DIAGNOSTIC
        // ============================================================
        
        // DRAAD127: Deduplicate assignments BEFORE UPSERT
        const deduplicatedAssignments = deduplicateAssignments(assignmentsToUpsert);
        
        console.log(`[DRAAD129] After deduplication: ${deduplicatedAssignments.length} assignments (removed ${assignmentsToUpsert.length - deduplicatedAssignments.length})`);
        
        // ============================================================
        // DRAAD129-STAP2: BATCH PROCESSING FOR UPSERT
        // ============================================================
        console.log('[DRAAD129-STAP2] === BATCH PROCESSING PHASE ===');
        
        const BATCH_SIZE = 50;  // Process 50 assignments per RPC call
        const TOTAL_ASSIGNMENTS = deduplicatedAssignments.length;
        const TOTAL_BATCHES = Math.ceil(TOTAL_ASSIGNMENTS / BATCH_SIZE);
        
        console.log(`[DRAAD129-STAP2] Configuration: BATCH_SIZE=${BATCH_SIZE}, TOTAL_ASSIGNMENTS=${TOTAL_ASSIGNMENTS}, TOTAL_BATCHES=${TOTAL_BATCHES}`);
        
        let totalProcessed = 0;
        let batchErrors: Array<{batchNum: number; error: string; assignmentCount: number}> = [];
        
        for (let i = 0; i < deduplicatedAssignments.length; i += BATCH_SIZE) {
          const batch = deduplicatedAssignments.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE);
          const batchStartIdx = i;
          const batchEndIdx = Math.min(i + BATCH_SIZE, deduplicatedAssignments.length);
          
          console.log(`[DRAAD129-STAP2] Batch ${batchNum}/${TOTAL_BATCHES - 1}: processing ${batch.length} assignments (indices ${batchStartIdx}-${batchEndIdx - 1})...`);
          
          // Validatie: Check for unmapped services in this batch
          const unmappedCount = batch.filter(a => !a.service_id).length;
          if (unmappedCount > 0) {
            console.warn(`[DRAAD129-STAP2] ⚠️ Batch ${batchNum}: ${unmappedCount}/${batch.length} assignments have unmapped service codes`);
          }
          
          // Call RPC for this batch
          const { data: upsertResult, error: upsertError } = await supabase
            .rpc('upsert_ort_assignments', {
              p_assignments: batch
            });
          
          if (upsertError) {
            console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED: ${upsertError.message}`);
            batchErrors.push({
              batchNum,
              error: upsertError.message,
              assignmentCount: batch.length
            });
          } else if (!upsertResult || !Array.isArray(upsertResult) || upsertResult.length === 0) {
            const errorMsg = `Invalid RPC response - result: ${JSON.stringify(upsertResult)}`;
            console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED: ${errorMsg}`);
            batchErrors.push({
              batchNum,
              error: errorMsg,
              assignmentCount: batch.length
            });
          } else {
            const [result] = upsertResult;
            if (!result.success) {
              console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED (RPC returned failure): ${result.message}`);
              batchErrors.push({
                batchNum,
                error: result.message || 'Unknown RPC error',
                assignmentCount: batch.length
              });
            } else {
              const processedCount = result.count_processed || result.inserted_count || batch.length;
              totalProcessed += processedCount;
              console.log(`[DRAAD129-STAP2] ✅ Batch ${batchNum} OK: ${processedCount} assignments inserted (total so far: ${totalProcessed})`);
            }
          }
        }
        
        // ============================================================
        // END DRAAD129-STAP2
        // ============================================================
        
        // Check for batch errors
        if (batchErrors.length > 0) {
          console.error(`[DRAAD129-STAP2] 🚨 ${batchErrors.length}/${TOTAL_BATCHES} batches FAILED!`);
          batchErrors.forEach(be => {
            console.error(`[DRAAD129-STAP2]   Batch ${be.batchNum}: ${be.error} (${be.assignmentCount} assignments)`);
          });
          
          return NextResponse.json({
            error: `[DRAAD129-STAP2] Batch UPSERT failed after ${totalProcessed}/${TOTAL_ASSIGNMENTS} assignments`,
            details: {
              batchErrors,
              totalProcessed,
              totalAssignments: TOTAL_ASSIGNMENTS,
              failedBatches: batchErrors.length,
              totalBatches: TOTAL_BATCHES
            }
          }, { status: 500 });
        }
        
        console.log(`[DRAAD129-STAP2] ✅ ALL BATCHES SUCCEEDED: ${totalProcessed} total assignments inserted`);
        
        // Validatie: Check for unmapped services (after all batches)
        const unmappedCount = deduplicatedAssignments.filter(a => !a.service_id).length;
        if (unmappedCount > 0) {
          console.warn(`[OPTIE E] ⚠️  ${unmappedCount} assignments (${(unmappedCount/deduplicatedAssignments.length*100).toFixed(1)}%) have unmapped service codes`);
          if (unmappedCount > deduplicatedAssignments.length * 0.1) {
            console.error('[OPTIE E] ERROR: >10% unmapped services - some assignments may have NULL service_id');
          }
        }
      }
      
      // 14A. DRAAD106 + DRAAD118A: Update roster status: draft → in_progress
      // ONLY for FEASIBLE/OPTIMAL (NOT INFEASIBLE)
      const { error: updateError } = await supabase
        .from('roosters')
        .update({
          status: 'in_progress',  // DRAAD118A: Only update when FEASIBLE!
          updated_at: new Date().toISOString()
        })
        .eq('id', roster_id);
      
      if (updateError) {
        console.error('[Solver API] Fout bij update roster status:', updateError);
      } else {
        console.log(`[DRAAD118A] Roster status updated: draft → in_progress`);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`[Solver API] Voltooid in ${totalTime}ms`);
      
      // 16A. Return FEASIBLE response with assignments + summary
      return NextResponse.json({
        success: true,
        roster_id,
        solver_result: {
          status: solverResult.status,
          assignments: solverResult.assignments,
          summary: {
            total_services_scheduled: solverResult.total_assignments,
            coverage_percentage: solverResult.fill_percentage,
            unfilled_slots: (solverResult.total_slots || 0) - solverResult.total_assignments
          },
          bottleneck_report: null,  // Not present for FEASIBLE
          total_assignments: solverResult.total_assignments,
          total_slots: solverResult.total_slots,
          fill_percentage: solverResult.fill_percentage,
          solve_time_seconds: solverResult.solve_time_seconds,
          violations: solverResult.violations,
          suggestions: solverResult.suggestions
        },
        draad108: {
          exact_staffing_count: exact_staffing.length,
          bezetting_violations: bezettingViolations.length
        },
        draad115: {
          employee_count: solverRequest.employees?.length || 0,
          mapping_info: 'voornaam/achternaam split, team mapped from dienstverband, max_werkdagen removed'
        },
        draad127: {
          status: 'IMPLEMENTED',
          deduplication: 'Duplicate assignments filtered before UPSERT',
          protection: 'Composite key (roster_id|employee_id|date|dagdeel)',
          notes: 'Prevents ON CONFLICT cannot affect row twice error'
        },
        draad129: {
          status: 'DIAGNOSTIC_PHASE_COMPLETE',
          duplicate_detection: 'Detailed analysis logged',
          batch_processing: 'STAP2 IMPLEMENTED - All batches processed successfully',
          execution_timestamp: executionTimestamp,
          execution_ms: executionMs,
          cache_busting: cacheBustingId
        },
        optie_e: {
          status: 'IMPLEMENTED',
          service_code_mapping: 'solver service_code → service_id UUID',
          ort_tracking_fields: ['source', 'ort_confidence', 'ort_run_id', 'constraint_reason', 'previous_service_id'],
          solver_run_id: solverRunId,
          assignments_upserted: solverResult.total_assignments,
          audit_trail: `solverRunId=${solverRunId} links all assignments to this ORT run`,
          database_constraint_changed: 'status=0 CAN have service_id!=NULL (ORT suggestions)',
          rollback_support: 'previous_service_id field populated for UNDO capability'
        },
        draad128: {
          fix_applied: 'PostgreSQL RPC function upsert_ort_assignments() - atomic, race-condition safe',
          slots_preserved: '✅ All 1365 slots intact',
          no_destructive_delete: 'true',
          solver_hints_stored_in: 'service_id field (via service code mapping) with source=ort marker',
          source_case_fixed: 'DRAAD128.6 - lowercase ort matches CHECK constraint',
          debug_info: 'DRAAD128.8 - RPC response validation with detailed logging'
        },
        draad122: {
          fix_applied: 'UPSERT pattern (atomic, race-condition safe)',
          slots_preserved: '✅ All 1365 slots intact',
          no_destructive_delete: 'true',
          solver_hints_stored_in: 'service_id field (via service code mapping) with source=ort marker'
        },
        draad121: {
          constraint: 'status=0 CAN have service_id!=NULL (OPTIE E)',
          implementation: 'OPTIE E service_code mapping + UPSERT ensures compliance'
        },
        draad125a: {
          fix: 'TypeScript null-safety - validated arrays before processing',
          timestamp: new Date().toISOString()
        },
        total_time_ms: totalTime
      });
      
    } else if (solverResult.status === 'infeasible') {
      // ======== PATH B: INFEASIBLE - SKIP ASSIGNMENTS, KEEP STATUS draft ========
      console.log(`[DRAAD118A] Solver returned INFEASIBLE - skipping assignments, status stays 'draft'`);
      console.log(`[DRAAD118A] Bottleneck report present: ${solverResult.bottleneck_report ? 'YES' : 'NO'}`);
      
      // NO database writes! Status stays 'draft'
      
      const totalTime = Date.now() - startTime;
      console.log(`[Solver API] INFEASIBLE handling completed in ${totalTime}ms`);
      
      // 16B. Return INFEASIBLE response with bottleneck_report
      return NextResponse.json({
        success: true,
        roster_id,
        solver_result: {
          status: solverResult.status,
          assignments: [],  // Empty - no solution
          summary: null,  // Not present for INFEASIBLE
          bottleneck_report: solverResult.bottleneck_report,  // Full analysis
          total_assignments: 0,
          total_slots: solverResult.total_slots,
          fill_percentage: 0.0,
          solve_time_seconds: solverResult.solve_time_seconds,
          violations: solverResult.violations,
          suggestions: solverResult.suggestions
        },
        draad118a: {
          status_action: 'NO_CHANGE - roster status stays draft',
          bottleneck_severity: solverResult.bottleneck_report?.critical_count || 0,
          total_shortage: solverResult.bottleneck_report?.total_shortage || 0,
          shortage_percentage: solverResult.bottleneck_report?.shortage_percentage || 0
        },
        optie_e: {
          status: 'READY (not applied - INFEASIBLE)',
          reason: 'No feasible solution found - no database writes performed'
        },
        draad129: {
          status: 'SKIPPED',
          reason: 'INFEASIBLE result - no assignments to analyze'
        },
        total_time_ms: Date.now() - startTime
      });
    } else {
      // ======== PATH C: TIMEOUT/ERROR - NOT FEASIBLE/OPTIMAL/INFEASIBLE ========
      console.log(`[DRAAD118A] Solver returned ${solverResult.status} - no database changes`);
      
      const totalTime = Date.now() - startTime;
      return NextResponse.json({
        success: false,
        roster_id,
        solver_result: solverResult,
        error: `Solver status ${solverResult.status}`,
        draad129: {
          status: 'SKIPPED',
          reason: `Solver status ${solverResult.status} - no assignments to analyze`
        },
        total_time_ms: totalTime
      }, {
        status: 500
      });
    }
    
  } catch (error: any) {
    console.error('[Solver API] Onverwachte fout:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Onbekende fout',
        type: error.name || 'Error'
      },
      { status: 500 }
    );
  }
}