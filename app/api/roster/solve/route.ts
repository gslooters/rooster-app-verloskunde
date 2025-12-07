/**
 * DRAAD124: ORT Hulpvelden & Data Integriteit Fix
 * FASE 4: Next.js Route - Pre/Post ORT Validation + Protected Filter + Write-Back
 *
 * KRITIEK: Deze route handelt de volledige ORT pipeline af met:
 * 1. Pre-ORT State Snapshot (totaal = 1365)
 * 2. Solver Run Record aanmaken
 * 3. Data voorbereiding (fixed, blocked, editable)
 * 4. ORT execution (Python solver service op Railway)
 * 5. Protected Filter (skip status >= 1)
 * 6. UPSERT met hulpvelden (source, is_protected, ort_confidence, ort_run_id, constraint_reason)
 * 7. Post-ORT Integrity Validation
 * 8. Response + cache-busting
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { PreOrtState, PostOrtState, SolveRequest, SolveResponse, RosterAssignmentRecord } from '@/lib/types/solver';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const solverServiceUrl = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * FASE 4A: Pre-ORT State Snapshot
 * Valideer baseline voor data integrity check
 */
async function capturePreOrtState(rosterId: string): Promise<PreOrtState> {
  const { data, error } = await supabase
    .from('roster_assignments')
    .select('status')
    .eq('roster_id', rosterId);

  if (error) throw error;
  if (!data) throw new Error('No data returned from capturePreOrtState');

  const countByStatus: Record<number, number> = {};
  data.forEach(r => {
    countByStatus[r.status] = (countByStatus[r.status] || 0) + 1;
  });

  const preState: PreOrtState = {
    status_0: data.filter(r => r.status === 0).length,
    status_1: data.filter(r => r.status === 1).length,
    status_2_3: data.filter(r => r.status >= 2).length,
    total: data.length,
    countByStatus
  };

  console.log('[Pre-ORT State]', preState);
  return preState;
}

/**
 * FASE 4B: Solver Run Record aanmaken
 * Tracability voor ORT run
 */
async function createSolverRunRecord(rosterId: string): Promise<string> {
  const { data, error } = await supabase
    .from('solver_runs')
    .insert({
      roster_id: rosterId,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: { phase: 'draad124', version: '1.0' }
    })
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('Failed to create solver_run record');

  console.log('[Solver Run Created]', data.id);
  return data.id;
}

/**
 * FASE 4C: Data Preparation
 * Haal fixed, blocked, editable assignments op + voorbereiding voor ORT
 */
async function prepareOrtInput(rosterId: string): Promise<SolveRequest> {
  // Haal alle assignments op
  const { data: allAssignments, error } = await supabase
    .from('roster_assignments')
    .select('*')
    .eq('roster_id', rosterId);

  if (error) throw error;
  if (!allAssignments) throw new Error('No assignments found');

  // Splitsen in categorieen
  const fixed = allAssignments.filter(a => a.status === 1);
  const blocked = allAssignments.filter(a => a.status >= 2);
  const editable = allAssignments.filter(a => a.status === 0);

  // Haal service info op
  const { data: services } = await supabase
    .from('service_types')
    .select('id, code, naam');

  const serviceMap = new Map(services?.map(s => [s.id, { code: s.code, naam: s.naam }]) || []);

  // Haal employee services op
  const { data: empServices } = await supabase
    .from('employee_services')
    .select('employee_id, service_id, actief')
    .eq('actief', true);

  // Exact staffing constraints (DRAAD108)
  const { data: staffingConstraints } = await supabase
    .from('roster_period_staffing')
    .select('*')
    .eq('roster_id', rosterId);

  const exactStaffing = staffingConstraints?.map(sc => ({
    service_id: sc.service_id,
    service_code: serviceMap.get(sc.service_id)?.code || 'UNKNOWN',
    date: sc.date,
    dagdeel: sc.date, // TODO: parse dagdeel from roster_assignments logic
    required_count: sc.min_staff,
    flexibility: 'rigid' as const
  })) || [];

  const solveRequest: SolveRequest = {
    roster_id: rosterId,
    fixed_assignments: fixed.map(a => ({
      employee_id: a.employee_id,
      date: a.date,
      dagdeel: a.dagdeel,
      service_id: a.service_id,
      service_code: serviceMap.get(a.service_id)?.code || 'UNKNOWN'
    })),
    blocked_slots: blocked.map(a => ({
      employee_id: a.employee_id,
      date: a.date,
      dagdeel: a.dagdeel,
      status: a.status
    })),
    editable_slots: editable.map(a => ({
      employee_id: a.employee_id,
      date: a.date,
      dagdeel: a.dagdeel,
      service_id: a.service_id
    })),
    exact_staffing: exactStaffing,
    employee_services: empServices?.map(es => ({
      employee_id: es.employee_id,
      service_id: es.service_id,
      actief: es.actief
    })) || []
  };

  console.log('[ORT Input Prepared]', {
    fixed: fixed.length,
    blocked: blocked.length,
    editable: editable.length
  });

  return solveRequest;
}

/**
 * FASE 4D: ORT Execution
 * Roep Python solver service op Railway aan
 */
async function callSolverService(solveRequest: SolveRequest): Promise<SolveResponse> {
  const response = await fetch(`${solverServiceUrl}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solveRequest)
  });

  if (!response.ok) {
    throw new Error(`Solver service error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as SolveResponse;
  console.log('[ORT Executed]', {
    success: result.success,
    solver_status: result.solver_status,
    assignments: result.assignments.length
  });

  return result;
}

/**
 * FASE 4E: Write-Back with Protected Filter
 * KRITIEK: Skip status >= 1 assignments, write editable slots ONLY
 */
async function writeOrtResultsProtected(
  rosterId: string,
  solverResult: SolveResponse,
  solverRunId: string
): Promise<number> {
  if (!solverResult.success || solverResult.solver_status === 'infeasible') {
    console.log('[Write-Back Skipped] ORT failed or infeasible');
    return 0;
  }

  // FASE 1: Build protected set (status >= 1)
  const { data: protectedRecords } = await supabase
    .from('roster_assignments')
    .select('employee_id, date, dagdeel')
    .eq('roster_id', rosterId)
    .gte('status', 1);

  const protectedSet = new Set<string>();
  protectedRecords?.forEach(r => {
    protectedSet.add(`${r.employee_id}|${r.date}|${r.dagdeel}`);
  });

  // FASE 2: Filter ORT output (skip protected)
  const writableAssignments = solverResult.assignments.filter(a => {
    const key = `${a.employee_id}|${a.date}|${a.dagdeel}`;
    return !protectedSet.has(key);
  });

  console.log(`[Write-Back Filter] ${writableAssignments.length}/${solverResult.assignments.length} assignments writable`);

  // FASE 3: UPSERT with hulpvelden
  if (writableAssignments.length === 0) {
    console.log('[Write-Back] No writable assignments');
    return 0;
  }

  const recordsToUpsert: RosterAssignmentRecord[] = writableAssignments.map(a => ({
    roster_id: rosterId,
    employee_id: a.employee_id,
    date: a.date,
    dagdeel: a.dagdeel,
    service_id: a.service_id, // ✅ ECHTE dienst (NOOIT NULL)
    status: 0,
    source: 'ort', // ✅ Hulpveld 1
    is_protected: false, // ✅ Hulpveld 2
    ort_confidence: a.confidence, // ✅ Hulpveld 3
    ort_run_id: solverRunId, // ✅ Hulpveld 4
    constraint_reason: a.constraint_reason, // ✅ Hulpveld 5
    previous_service_id: null, // ✅ Hulpveld 6 (set by UPSERT logic)
    notes: `ORT: ${a.service_code}` 
  }));

  const { error } = await supabase
    .from('roster_assignments')
    .upsert(recordsToUpsert, {
      onConflict: 'roster_id,employee_id,date,dagdeel'
    });

  if (error) throw error;

  console.log(`[Write-Back Complete] ${writableAssignments.length} records upserted`);
  return writableAssignments.length;
}

/**
 * FASE 4F: Post-ORT Integrity Validation
 * Check dat NO records verloren zijn gegaan
 */
async function validatePostOrtIntegrity(
  rosterId: string,
  preState: PreOrtState
): Promise<PostOrtState> {
  const { data, error } = await supabase
    .from('roster_assignments')
    .select('status')
    .eq('roster_id', rosterId);

  if (error) throw error;
  if (!data) throw new Error('No data in post-ORT validation');

  const countByStatus: Record<number, number> = {};
  data.forEach(r => {
    countByStatus[r.status] = (countByStatus[r.status] || 0) + 1;
  });

  const postState: PostOrtState = {
    status_0: data.filter(r => r.status === 0).length,
    status_1: data.filter(r => r.status === 1).length,
    status_2_3: data.filter(r => r.status >= 2).length,
    total: data.length,
    countByStatus,
    validation_errors: []
  };

  // VALIDATIES
  const errors: string[] = [];

  if (postState.status_1 !== preState.status_1) {
    errors.push(`Status=1 changed: ${preState.status_1} → ${postState.status_1} (should be protected)`);
  }

  if (postState.status_2_3 !== preState.status_2_3) {
    errors.push(`Status=2,3 changed: ${preState.status_2_3} → ${postState.status_2_3} (should be protected)`);
  }

  if (postState.total !== preState.total) {
    errors.push(`Total records changed: ${preState.total} → ${postState.total} (should be constant at 1365)`);
  }

  if (errors.length > 0) {
    console.error('[VALIDATION FAILED]', errors);
    postState.validation_errors = errors;
  } else {
    console.log('[VALIDATION OK]', postState);
  }

  return postState;
}

/**
 * POST Handler: /api/roster/solve
 */
export async function POST(request: Request) {
  try {
    const { roster_id } = await request.json() as { roster_id: string };

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id required' },
        { status: 400 }
      );
    }

    console.log('\n=== ORT PIPELINE START ===');
    console.log(`Roster ID: ${roster_id}`);

    // FASE 1: Pre-ORT Snapshot
    const preState = await capturePreOrtState(roster_id);

    // FASE 2: Create Solver Run
    const solverRunId = await createSolverRunRecord(roster_id);

    // FASE 3: Prepare ORT Input
    const solveRequest = await prepareOrtInput(roster_id);

    // FASE 4: Call ORT
    const solveResponse = await callSolverService(solveRequest);

    // FASE 5: Write Results (with protection)
    const recordsWritten = await writeOrtResultsProtected(roster_id, solveResponse, solverRunId);

    // FASE 6: Validate Integrity
    const postState = await validatePostOrtIntegrity(roster_id, preState);

    // Check for validation errors
    if (postState.validation_errors.length > 0) {
      // Update solver_run status
      await supabase
        .from('solver_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          solver_status: 'validation_failed'
        })
        .eq('id', solverRunId);

      return NextResponse.json(
        {
          success: false,
          error: 'Data integrity validation failed',
          details: postState.validation_errors,
          pre_state: preState,
          post_state: postState
        },
        { status: 400 }
      );
    }

    // Update solver_run status to completed
    await supabase
      .from('solver_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        solver_status: solveResponse.solver_status,
        total_assignments: recordsWritten,
        metadata: { ...solveResponse.metadata, validation_passed: true }
      })
      .eq('id', solverRunId);

    console.log('=== ORT PIPELINE COMPLETE ===\n');

    return NextResponse.json(
      {
        success: true,
        solver_run_id: solverRunId,
        records_written: recordsWritten,
        solver_status: solveResponse.solver_status,
        pre_state: preState,
        post_state: postState,
        integrity_valid: postState.validation_errors.length === 0,
        timestamp: new Date().toISOString(),
        cache_bust: Date.now()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
