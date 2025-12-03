/**
 * API Route: POST /api/roster/solve
 * 
 * Integreert Next.js app met Python OR-Tools solver service.
 * 
 * Flow:
 * 1. Fetch roster data from Supabase
 * 2. Transform to solver input format
 * 3. Call Python solver service (Railway)
 * 4. Write solution to roster_assignments
 * 5. Update roster status → 'in_progress'
 * 6. Store solver metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  SolveRequest,
  SolveResponse,
  Employee,
  Service,
  EmployeeService,
  PreAssignment
} from '@/lib/types/solver';

const SOLVER_URL = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';
const SOLVER_TIMEOUT = 35000; // 35s (solver heeft 30s intern)

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
    
    // Validatie: alleen 'draft' roosters mogen ORT gebruiken
    if (roster.status !== 'draft') {
      return NextResponse.json(
        { error: `Roster status is '${roster.status}', moet 'draft' zijn voor ORT` },
        { status: 400 }
      );
    }
    
    console.log(`[Solver API] Roster gevonden: ${roster.naam}, periode ${roster.start_date} - ${roster.end_date}`);
    
    // 4. Fetch employees - FIX DRAAD98A: gebruik voornaam + achternaam ipv naam
    // FIX DRAAD98B: aantalwerkdagen ipv max/min_werkdagen
    // FIX DRAAD98C: actief ipv active (Nederlands schema)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, voornaam, achternaam, team, structureel_nbh, aantalwerkdagen')
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
      .from('services')
      .select('id, code, naam, dagdeel, is_nachtdienst')
      .eq('active', true);
    
    if (svcError) {
      console.error('[Solver API] Services fetch error:', svcError);
      return NextResponse.json(
        { error: 'Fout bij ophalen diensten' },
        { status: 500 }
      );
    }
    
    // 6. Fetch employee-service bevoegdheden
    const { data: empServices, error: esError } = await supabase
      .from('roster_employee_services')
      .select('employee_id, service_id')
      .eq('roster_id', roster_id);
    
    if (esError) {
      console.error('[Solver API] Employee-services fetch error:', esError);
      return NextResponse.json(
        { error: 'Fout bij ophalen bevoegdheden' },
        { status: 500 }
      );
    }
    
    // 7. Fetch pre-assignments (status > 0)
    // FIX DRAAD98B: date ipv datum
    const { data: preAssignments, error: paError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id, status')
      .eq('roster_id', roster_id)
      .gt('status', 0);
    
    if (paError) {
      console.error('[Solver API] Pre-assignments fetch error:', paError);
      // Niet-fataal, doorgaan zonder pre-assignments
    }
    
    console.log(`[Solver API] Data verzameld: ${employees?.length || 0} medewerkers, ${services?.length || 0} diensten, ${empServices?.length || 0} bevoegdheden, ${preAssignments?.length || 0} pre-assignments`);
    
    // 8. Transform naar solver input format - FIX DRAAD98A: samenvoegen voornaam + achternaam
    // FIX DRAAD98B: aantalwerkdagen mapping
    const solverRequest: SolveRequest = {
      roster_id,
      start_date: roster.start_date,
      end_date: roster.end_date,
      employees: (employees || []).map(emp => ({
        id: emp.id,
        name: `${emp.voornaam} ${emp.achternaam}`.trim(), // FIX: voornaam + achternaam
        team: emp.team as 'maat' | 'loondienst' | 'overig',
        structureel_nbh: emp.structureel_nbh || undefined,
        max_werkdagen: emp.aantalwerkdagen || undefined,
        min_werkdagen: undefined
      })),
      services: (services || []).map(svc => ({
        id: svc.id,
        code: svc.code,
        naam: svc.naam,
        dagdeel: svc.dagdeel as 'O' | 'M' | 'A',
        is_nachtdienst: svc.is_nachtdienst || false
      })),
      employee_services: (empServices || []).map(es => ({
        employee_id: es.employee_id,
        service_id: es.service_id
      })),
      pre_assignments: (preAssignments || []).map(pa => ({
        employee_id: pa.employee_id,
        date: pa.date,
        dagdeel: pa.dagdeel as 'O' | 'M' | 'A',
        service_id: pa.service_id,
        status: pa.status
      })),
      timeout_seconds: 30
    };
    
    console.log(`[Solver API] Solver request voorbereid, aanroepen ${SOLVER_URL}/api/v1/solve-schedule...`);
    
    // 9. Call Python solver service
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
    
    // 10. Write assignments naar database (alleen status=0 slots)
    if (solverResult.status === 'optimal' || solverResult.status === 'feasible') {
      // Delete oude ORT assignments (status=1) voor deze roster
      const { error: deleteError } = await supabase
        .from('roster_assignments')
        .delete()
        .eq('roster_id', roster_id)
        .eq('status', 1);
      
      if (deleteError) {
        console.error('[Solver API] Fout bij verwijderen oude ORT assignments:', deleteError);
      }
      
      // Insert nieuwe assignments (status=1)
      // FIX DRAAD98B: date ipv datum, verwijder created_at (DB heeft default)
      const assignmentsToInsert = solverResult.assignments.map(a => ({
        roster_id,
        employee_id: a.employee_id,
        date: a.date,
        dagdeel: a.dagdeel,
        service_id: a.service_id,
        status: 1 // ORT-gegenereerd
      }));
      
      if (assignmentsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('roster_assignments')
          .insert(assignmentsToInsert);
        
        if (insertError) {
          console.error('[Solver API] Fout bij insert assignments:', insertError);
          return NextResponse.json(
            { error: 'Fout bij opslaan oplossing' },
            { status: 500 }
          );
        }
        
        console.log(`[Solver API] ${assignmentsToInsert.length} assignments opgeslagen`);
      }
    }
    
    // 11. Update roster status: draft → in_progress
    const { error: updateError } = await supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);
    
    if (updateError) {
      console.error('[Solver API] Fout bij update roster status:', updateError);
    } else {
      console.log(`[Solver API] Roster status updated: draft → in_progress`);
    }
    
    // 12. Store solver run metadata (optioneel - nieuwe tabel)
    // TODO: Implementeer solver_runs tabel voor history tracking
    
    const totalTime = Date.now() - startTime;
    console.log(`[Solver API] Voltooid in ${totalTime}ms`);
    
    // 13. Return response
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
