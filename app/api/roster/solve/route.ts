/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD135: DELETE FUNCTIONALITY REMOVED & UPSERT RESTORED
 * 
 * CRITICAL: roster_assignments records are NEVER deleted
 * Method: UPSERT with onConflict handling (DRAAD132 pattern)
 * Status preservation: All status (0,1,2,3) maintained via UPDATE
 * 
 * What was removed:
 *   DELETE FROM roster_assignments WHERE status=0
 *   ^ This destroyed 1134 records in DRAAD134
 * 
 * What is restored:
 *   UPSERT pattern from DRAAD132 (last working version)
 *   - Inserts new assignments
 *   - Updates existing on composite key conflict
 *   - NEVER deletes any records
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CACHE_BUST_DRAAD129_STAP3_FIXED } from '@/app/api/cache-bust/DRAAD129_STAP3_FIXED';
import { CACHE_BUST_DRAAD129_FIX4 } from '@/app/api/cache-bust/DRAAD129_FIX4';
import { CACHE_BUST_OPTIE3_CONSTRAINT_RESOLUTION } from '@/app/api/cache-bust/OPTIE3_CONSTRAINT_RESOLUTION';
import { CACHE_BUST_DRAAD135 } from '@/app/api/cache-bust/DRAAD135';
import type {
  SolveRequest,
  SolveResponse,
  Employee,
  Service,
  RosterEmployeeService,
  FixedAssignment,
  BlockedSlot,
  SuggestedAssignment,
  ExactStaffing
} from '@/lib/types/solver';

const SOLVER_URL = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';
const SOLVER_TIMEOUT = 35000;

const dienstverbandMapping: Record<string, 'maat' | 'loondienst' | 'overig'> = {
  'Maat': 'maat',
  'Loondienst': 'loondienst',
  'ZZP': 'overig'
};

const findServiceId = (serviceCode: string, services: Service[]): string | null => {
  const svc = services.find(s => s.code === serviceCode);
  if (!svc) {
    console.warn(`[OPTIE E] Service code not found: '${serviceCode}'`);
    return null;
  }
  return svc.id;
};

interface DuplicateAnalysis {
  hasDuplicates: boolean;
  totalCount: number;
  uniqueCount: number;
  duplicateCount: number;
  duplicateKeys: Array<{key: string; count: number; indices: number[]}>;
}

const logDuplicates = (assignments: any[], label: string): DuplicateAnalysis => {
  const keyMap = new Map<string, number[]>();
  
  assignments.forEach((a, i) => {
    const key = `${a.roster_id}|${a.employee_id}|${a.date}|${a.dagdeel}`;
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key)!.push(i);
  });
  
  const duplicateKeys = Array.from(keyMap.entries())
    .filter(([_, indices]) => indices.length > 1)
    .map(([key, indices]) => ({key, count: indices.length, indices}))
    .sort((a, b) => b.count - a.count);
  
  const hasDuplicates = duplicateKeys.length > 0;
  const uniqueCount = keyMap.size;
  const duplicateCount = duplicateKeys.reduce((sum, d) => sum + (d.count - 1), 0);
  
  if (hasDuplicates) {
    console.error(`[FIX4] ${label}: 🚨 DUPLICATES FOUND`);
  } else {
    console.log(`[FIX4] ${label}: ✅ CLEAN - No duplicates found (${assignments.length} total)`);
  }
  
  return {
    hasDuplicates,
    totalCount: assignments.length,
    uniqueCount,
    duplicateCount,
    duplicateKeys
  };
};

interface DeduplicationVerification {
  success: boolean;
  removed: number;
  report: string;
}

const verifyDeduplicationResult = (before: any[], after: any[], label: string): DeduplicationVerification => {
  const removed = before.length - after.length;
  
  if (removed === 0) {
    return {
      success: true,
      removed: 0,
      report: 'No duplicates found'
    };
  }
  
  if (removed < 0) {
    return {
      success: false,
      removed: 0,
      report: `After array (${after.length}) is LONGER than before array (${before.length})`
    };
  }
  
  return {
    success: true,
    removed,
    report: `Removed ${removed} duplicate(s)`
  };
};

interface Assignment {
  roster_id: string | any;
  employee_id: string;
  date: string;
  dagdeel: string;
  [key: string]: any;
}

const deduplicateAssignments = (assignments: Assignment[]): Assignment[] => {
  const keyMap = new Map<string, {assignment: Assignment; originalIndex: number}>();
  let duplicateCount = 0;

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const key = `${assignment.roster_id}|${assignment.employee_id}|${assignment.date}|${assignment.dagdeel}`;
    
    if (keyMap.has(key)) {
      duplicateCount++;
    }
    
    keyMap.set(key, { assignment, originalIndex: i });
  }
  
  const deduplicated = Array.from(keyMap.values())
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(item => item.assignment);
  
  if (duplicateCount > 0) {
    console.log(`[OPTIE3-CR] Removed ${duplicateCount} duplicates`);
  }
  
  return deduplicated;
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const solverRunId = crypto.randomUUID();
  const executionTimestamp = new Date().toISOString();
  const executionMs = Date.now();
  const cacheBustingId = `DRAAD135-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  
  const draad135Version = CACHE_BUST_DRAAD135.version;
  const draad135Timestamp = CACHE_BUST_DRAAD135.timestamp;
  
  try {
    const { roster_id } = await request.json();
    
    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }
    
    console.log(`[Solver API] Start solve voor roster ${roster_id}`);
    console.log(`[DRAAD135] Cache bust: ${cacheBustingId}`);
    console.log(`[DRAAD135] Version: ${draad135Version}`);
    console.log(`[DRAAD135] Method: UPSERT (no DELETE)`);
    
    const supabase = await createClient();
    
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();
    
    if (rosterError || !roster) {
      return NextResponse.json(
        { error: 'Roster niet gevonden' },
        { status: 404 }
      );
    }
    
    if (roster.status !== 'draft') {
      return NextResponse.json(
        { error: `Roster status is '${roster.status}', moet 'draft' zijn` },
        { status: 400 }
      );
    }
    
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, voornaam, achternaam, dienstverband, structureel_nbh')
      .eq('actief', true);
    
    if (empError || !employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'Geen actieve medewerkers gevonden' },
        { status: 400 }
      );
    }
    
    const { data: services, error: svcError } = await supabase
      .from('service_types')
      .select('id, code, naam')
      .eq('actief', true);
    
    if (svcError || !services || services.length === 0) {
      return NextResponse.json(
        { error: 'Geen actieve diensten geconfigureerd' },
        { status: 400 }
      );
    }
    
    const { data: rosterEmpServices } = await supabase
      .from('roster_employee_services')
      .select('roster_id, employee_id, service_id, aantal, actief')
      .eq('roster_id', roster_id)
      .eq('actief', true);
    
    const safeRosterEmpServices = rosterEmpServices || [];
    
    const { data: fixedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 1);
    
    const safeFixedData = fixedData || [];
    
    const { data: blockedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', roster_id)
      .in('status', [2, 3]);
    
    const safeBlockedData = blockedData || [];
    
    const { data: suggestedData } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, service_id')
      .eq('roster_id', roster_id)
      .eq('status', 0)
      .not('service_id', 'is', null);
    
    const safeSuggestedData = suggestedData || [];
    
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
    }).filter(item => item.date && item.service_id);
    
    const solverRequest: SolveRequest = {
      roster_id: roster_id.toString(),
      start_date: roster.start_date,
      end_date: roster.end_date,
      employees: employees.map(emp => {
        const mappedTeam = dienstverbandMapping[emp.dienstverband as keyof typeof dienstverbandMapping] || 'overig';
        return {
          id: emp.id,
          voornaam: emp.voornaam,
          achternaam: emp.achternaam,
          team: mappedTeam,
          structureel_nbh: emp.structureel_nbh || undefined,
          min_werkdagen: undefined
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
      exact_staffing,
      timeout_seconds: 30
    };
    
    console.log(`[Solver API] Aanroepen solver...`);
    
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
      return NextResponse.json(
        { error: `Solver service fout: ${errorText}` },
        { status: solverResponse.status }
      );
    }
    
    const solverResult: SolveResponse = await solverResponse.json();
    
    console.log(`[Solver API] Status=${solverResult.status}, assignments=${solverResult.total_assignments}`);
    
    if (solverResult.status === 'optimal' || solverResult.status === 'feasible') {
      const assignmentsToInsert = solverResult.assignments.map(a => ({
        roster_id,
        employee_id: a.employee_id,
        date: a.date,
        dagdeel: a.dagdeel,
        service_id: findServiceId(a.service_code, services),
        status: 0,
        source: 'ort',
        notes: `ORT suggestion: ${a.service_code}`,
        ort_confidence: a.confidence || null,
        ort_run_id: solverRunId,
        constraint_reason: {
          solver_suggestion: true,
          service_code: a.service_code,
          confidence: a.confidence || 0,
          solve_time: solverResult.solve_time_seconds
        },
        previous_service_id: null
      }));
      
      if (assignmentsToInsert.length > 0) {
        console.log(`[FIX4] INPUT: Analyzing ${assignmentsToInsert.length} assignments...`);
        const inputAnalysis = logDuplicates(assignmentsToInsert, 'INPUT');
        
        if (inputAnalysis.hasDuplicates) {
          return NextResponse.json({
            error: `[FIX4] INPUT contains ${inputAnalysis.duplicateCount} duplicate assignments`,
            details: inputAnalysis
          }, { status: 400 });
        }
        
        const deduplicatedAssignments = deduplicateAssignments(assignmentsToInsert);
        const deduplicationVerification = verifyDeduplicationResult(
          assignmentsToInsert,
          deduplicatedAssignments,
          'DEDUPLICATION'
        );
        
        if (!deduplicationVerification.success) {
          return NextResponse.json({
            error: `[FIX4] Deduplication verification failed`,
            details: deduplicationVerification
          }, { status: 500 });
        }
        
        const afterDedupAnalysis = logDuplicates(deduplicatedAssignments, 'AFTER_DEDUP');
        if (afterDedupAnalysis.hasDuplicates) {
          return NextResponse.json({
            error: `[FIX4] Found duplicates AFTER deduplication`,
            details: afterDedupAnalysis
          }, { status: 500 });
        }
        
        // DRAAD135: UPSERT pattern (restored from DRAAD132)
        // CRITICAL: roster_assignments records are NEVER deleted
        // Method: UPSERT with onConflict handling
        console.log('[DRAAD135] === UPSERT PHASE ===');
        console.log('[DRAAD135] UPSERT: Inserting/updating assignments with onConflict handling...');
        
        const upsertStartTime = Date.now();
        const { error: upsertError } = await supabase
          .from('roster_assignments')
          .upsert(deduplicatedAssignments, {
            onConflict: 'roster_id,employee_id,date,dagdeel',
            ignoreDuplicates: false
          });
        
        if (upsertError) {
          console.error('[DRAAD135] UPSERT failed:', upsertError.message);
          return NextResponse.json({
            error: `[DRAAD135] UPSERT failed: ${upsertError.message}`,
            draad135: 'UPSERT unsuccessful'
          }, { status: 500 });
        }
        
        const upsertTime = Date.now() - upsertStartTime;
        console.log(`[DRAAD135] ✅ UPSERT successful (${upsertTime}ms)`);
        console.log('[DRAAD135] === END UPSERT ===');
      }
      
      const { error: updateError } = await supabase
        .from('roosters')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', roster_id);
      
      if (!updateError) {
        console.log('[DRAAD118A] Roster status updated: draft → in_progress');
      }
      
      const totalTime = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        roster_id,
        solver_result: {
          status: solverResult.status,
          assignments: solverResult.assignments,
          total_assignments: solverResult.total_assignments,
          fill_percentage: solverResult.fill_percentage,
          solve_time_seconds: solverResult.solve_time_seconds
        },
        draad135: {
          status: 'IMPLEMENTED',
          version: draad135Version,
          timestamp: draad135Timestamp,
          method: 'UPSERT with onConflict',
          fix: 'Removed DELETE, restored DRAAD132 UPSERT pattern',
          safety: 'roster_assignments records NEVER deleted - INSERT/UPDATE only',
          rationale: 'Prevent data destruction via DELETE statement'
        },
        total_time_ms: totalTime
      });
      
    } else if (solverResult.status === 'infeasible') {
      return NextResponse.json({
        success: true,
        roster_id,
        solver_result: {
          status: solverResult.status,
          assignments: [],
          total_assignments: 0,
          bottleneck_report: solverResult.bottleneck_report
        },
        total_time_ms: Date.now() - startTime
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Solver status ${solverResult.status}`,
        total_time_ms: Date.now() - startTime
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('[Solver API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        draad135_status: 'ERROR'
      },
      { status: 500 }
    );
  }
}