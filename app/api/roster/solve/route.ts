/**
 * API Route: POST /api/roster/solve
 * 
 * Integreert Next.js app met Python OR-Tools solver service.
 * 
 * DRAAD106: Pre-planning Behouden
 * - Reset alleen ORT voorlopige planning (status 0 + service_id → NULL)
 * - Schrijf ORT output naar status 0 (voorlopig)
 * - Respecteer status 1 (fixed), status 2/3 (blocked)
 * - Roster status: draft → in_progress
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
 * Flow:
 * 1. Fetch roster data from Supabase
 * 2. Transform to solver input format (fixed + blocked split)
 * 3. DRAAD108: Fetch exact staffing requirements
 * 4. Call Python solver service (Railway)
 * 5. Write solution to status 0 slots (UPSERT)
 * 6. Update roster status → 'in_progress'
 * 7. Store solver metadata
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
 * POST /api/roster/solve
 * 
 * Body: { roster_id: number }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
    
    // 7. DRAAD106: Fetch fixed assignments (status 1)
    const { data: fixedData, error: fixedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 1);
    
    if (fixedError) {
      console.error('[Solver API] Fixed assignments fetch error:', fixedError);
    }
    
    // 8. DRAAD106: Fetch blocked slots (status 2, 3)
    const { data: blockedData, error: blockedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', roster_id)
      .in('status', [2, 3]);
    
    if (blockedError) {
      console.error('[Solver API] Blocked slots fetch error:', blockedError);
    }
    
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
    
    console.log(`[Solver API] Data verzameld: ${employees?.length || 0} medewerkers, ${services?.length || 0} diensten, ${rosterEmpServices?.length || 0} bevoegdheden (actief), ${fixedData?.length || 0} fixed, ${blockedData?.length || 0} blocked, ${suggestedData?.length || 0} suggested, ${exact_staffing.length} exacte bezetting (DRAAD108)`);
    
    // 11. Transform naar solver input format
    // DRAAD115: Split voornaam/achternaam, use dienstverband mapping, remove max_werkdagen
    const solverRequest: SolveRequest = {
      roster_id: roster_id.toString(),
      start_date: roster.start_date,
      end_date: roster.end_date,
      employees: (employees || []).map(emp => {
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
      services: (services || []).map(svc => ({
        id: svc.id,
        code: svc.code,
        naam: svc.naam
      })),
      roster_employee_services: (rosterEmpServices || []).map(res => ({
        roster_id: res.roster_id.toString(),
        employee_id: res.employee_id,
        service_id: res.service_id,
        aantal: res.aantal,
        actief: res.actief
      })),
      // DRAAD106: Nieuwe velden
      fixed_assignments: (fixedData || []).map(fa => ({
        employee_id: fa.employee_id,
        date: fa.date,
        dagdeel: fa.dagdeel as 'O' | 'M' | 'A',
        service_id: fa.service_id
      })),
      blocked_slots: (blockedData || []).map(bs => ({
        employee_id: bs.employee_id,
        date: bs.date,
        dagdeel: bs.dagdeel as 'O' | 'M' | 'A',
        status: bs.status as 2 | 3
      })),
      suggested_assignments: (suggestedData || []).map(sa => ({
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
    if (solverRequest.employees.length > 0) {
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
    
    // 13. DRAAD106: Write assignments naar database (status 0)
    if (solverResult.status === 'optimal' || solverResult.status === 'feasible') {
      // DRAAD106: Reset ORT voorlopige planning (status 0 + service_id → NULL)
      const { error: resetError } = await supabase
        .from('roster_assignments')
        .update({ service_id: null })
        .eq('roster_id', roster_id)
        .eq('status', 0)
        .not('service_id', 'is', null);
      
      if (resetError) {
        console.error('[Solver API] Fout bij reset ORT voorlopige planning:', resetError);
      }
      
      // DRAAD106: Insert nieuwe assignments (status 0, niet status 1!)
      const assignmentsToInsert = solverResult.assignments.map(a => ({
        roster_id,
        employee_id: a.employee_id,
        date: a.date,
        dagdeel: a.dagdeel,
        service_id: a.service_id,
        status: 0  // DRAAD106: Voorlopig! Wordt status 1 na finalize
      }));
      
      if (assignmentsToInsert.length > 0) {
        // DRAAD106: Use UPSERT voor bestaande status 0 records
        const { error: upsertError } = await supabase
          .from('roster_assignments')
          .upsert(assignmentsToInsert, {
            onConflict: 'roster_id,employee_id,date,dagdeel'
          });
        
        if (upsertError) {
          console.error('[Solver API] Fout bij upsert assignments:', upsertError);
          return NextResponse.json(
            { error: 'Fout bij opslaan oplossing' },
            { status: 500 }
          );
        }
        
        console.log(`[Solver API] ${assignmentsToInsert.length} assignments opgeslagen (status 0)`);
      }
    }
    
    // 14. DRAAD106: Update roster status: draft → in_progress (NIET naar final!)
    const { error: updateError } = await supabase
      .from('roosters')
      .update({
        status: 'in_progress',  // DRAAD106: in_progress, niet final
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);
    
    if (updateError) {
      console.error('[Solver API] Fout bij update roster status:', updateError);
    } else {
      console.log(`[Solver API] Roster status updated: draft → in_progress`);
    }
    
    // 15. Store solver run metadata (optioneel)
    // TODO: Implementeer solver_runs tabel voor history tracking
    
    const totalTime = Date.now() - startTime;
    console.log(`[Solver API] Voltooid in ${totalTime}ms`);
    
    // 16. Return response
    return NextResponse.json({
      success: true,
      roster_id,
      solver_result: {
        status: solverResult.status,
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
        employee_count: solverRequest.employees.length,
        mapping_info: 'voornaam/achternaam split, team mapped from dienstverband, max_werkdagen removed'
      },
      total_time_ms: totalTime
    });
    
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
