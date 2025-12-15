/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD192: SOLVER2 ENDPOINT MIGRATION
 * Migrates from local SOLVER_SERVICE_URL to external Solver2 API
 * DRAAD193: Clarify env var usage: SOLVER2_URL (Railway) with localhost fallback for dev
 * Features:
 * - 120s timeout minimum handling
 * - Robust error reporting
 * - Backward compatible response format
 * - Detailed logging for troubleshooting
 * 
 * DRAAD135: DELETE FUNCTIONALITY REMOVED & UPSERT RESTORED
 * DRAAD149: Employee ID type verification (TEXT vs UUID)
 * DRAAD149B: Deduplication key includes service_id to prevent conflicts
 * DRAAD150: Batch UPSERT pattern - sequential processing per slot
 * DRAAD154: FIX ORT UPSERT - set status=1 WITH service_id + failure validation
 * DRAAD155: FIX ORT - Use UPDATE instead of INSERT for empty slots
 * 
 * DRAAD155 ROOT CAUSE:
 * ORT was attempting 1137 UPSERT/INSERT operations → UNIQUE constraint violation
 * Constraint: UNIQUE(roster_id, employee_id, date, dagdeel)
 * Manual planning WORKS because it UPDATEs existing rows by ID
 * 
 * DRAAD155 SOLUTION:
 * 1. Query existing empty slots: status=0, service_id=NULL (~225 slots)
 * 2. Per ORT assignment: Find matching slot by (roster_id, employee_id, date, dagdeel)
 * 3. UPDATE that slot's row (same ID) - no constraint conflict
 * 4. Set status=1 ONLY where service_id is assigned
 * 5. Leave other slots unchanged (status=0 remains)
 * Result: ~225 UPDATEs instead of 1137 failed INSERTs
 * 
 * CRITICAL: roster_assignments records are NEVER deleted
 * Method: UPDATE for ORT assignments, INSERT only for NEW slots outside rooster scope
 * Status preservation: All status (0,1,2,3) maintained via UPDATE
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CACHE_BUST_DRAAD129_STAP3_FIXED } from '@/app/api/cache-bust/DRAAD129_STAP3_FIXED';
import { CACHE_BUST_DRAAD129_FIX4 } from '@/app/api/cache-bust/DRAAD129_FIX4';
import { CACHE_BUST_OPTIE3_CONSTRAINT_RESOLUTION } from '@/app/api/cache-bust/OPTIE3_CONSTRAINT_RESOLUTION';
import { CACHE_BUST_DRAAD135 } from '@/app/api/cache-bust/DRAAD135';
import { CACHE_BUST_DRAAD149 } from '@/app/api/cache-bust/DRAAD149';
import { CACHE_BUST_DRAAD149B } from '@/app/api/cache-bust/DRAAD149B';
import { CACHE_BUST_DRAAD154 } from '@/app/api/cache-bust/DRAAD154';
import { CACHE_BUST_DRAAD155 } from '@/app/api/cache-bust/DRAAD155';
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

// DRAAD192: Solver2 endpoint configuration
// DRAAD193: Use SOLVER2_URL env var (set on Railway), fallback to localhost for local development
const SOLVER2_URL = process.env.SOLVER2_URL || 'http://localhost:8000';
const SOLVER_TIMEOUT = 120000; // 120 seconds minimum per DRAAD192 requirement
const SOLVER_RETRY_ATTEMPTS = 3;
const SOLVER_RETRY_DELAY_MS = 1000;

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

interface EmptySlot {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: string;
}

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
    const key = `${a.roster_id}|${a.employee_id}|${a.date}|${a.dagdeel}|${a.service_id}`;
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
    const key = `${assignment.roster_id}|${assignment.employee_id}|${assignment.date}|${assignment.dagdeel}|${assignment.service_id}`;
    
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

/**
 * DRAAD149: Helper to verify employee_id format
 */
const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * DRAAD150: Group assignments by slot (roster_id, employee_id, date, dagdeel)
 * Then upsert each slot's assignments separately
 */
const groupAssignmentsBySlot = (assignments: Assignment[]): Map<string, Assignment[]> => {
  const slotMap = new Map<string, Assignment[]>();
  
  assignments.forEach(a => {
    const slotKey = `${a.roster_id}|${a.employee_id}|${a.date}|${a.dagdeel}`;
    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, []);
    }
    slotMap.get(slotKey)!.push(a);
  });
  
  return slotMap;
};

/**
 * DRAAD154: Validate ORT result BEFORE UPSERT
 * Returns { valid: boolean, reason?: string }
 */
const validateOrtResult = (result: SolveResponse): { valid: boolean; reason?: string } => {
  console.log('[DRAAD154] === ORT RESULT VALIDATION ===');
  
  if (!result) {
    console.error('[DRAAD154] ORT result is NULL');
    return { valid: false, reason: 'ORT_RETURNED_NULL' };
  }
  
  console.log(`[DRAAD154] ORT status: ${result.status}`);
  
  if (result.status === 'infeasible') {
    console.warn('[DRAAD154] ⚠️  ORT INFEASIBLE - no valid solution found');
    return { valid: false, reason: 'INFEASIBLE' };
  }
  
  if (result.status !== 'optimal' && result.status !== 'feasible') {
    console.error(`[DRAAD154] ORT unexpected status: ${result.status}`);
    return { valid: false, reason: `UNEXPECTED_STATUS_${result.status}` };
  }
  
  if (!result.assignments || result.assignments.length === 0) {
    console.warn('[DRAAD154] ⚠️  ORT returned empty assignments');
    return { valid: false, reason: 'NO_ASSIGNMENTS' };
  }
  
  console.log(`[DRAAD154] ✅ ORT result VALID: ${result.status} with ${result.assignments.length} assignments`);
  console.log('[DRAAD154] === END VALIDATION ===');
  return { valid: true };
};

/**
 * DRAAD155: Fetch empty slots that can be filled by ORT
 * Returns slots with status=0 and service_id=NULL
 */
const getEmptySlots = async (supabase: any, rosterId: string): Promise<EmptySlot[]> => {
  const { data, error } = await supabase
    .from('roster_assignments')
    .select('id, roster_id, employee_id, date, dagdeel')
    .eq('roster_id', rosterId)
    .eq('status', 0)
    .is('service_id', null);
  
  if (error) {
    console.error(`[DRAAD155] Failed to fetch empty slots: ${error.message}`);
    return [];
  }
  
  console.log(`[DRAAD155] Found ${data?.length || 0} empty slots to potentially fill`);
  return data || [];
};

/**
 * DRAAD155: Find existing slot by exact match
 * Returns slot ID if found, null otherwise
 */
const findExistingSlot = (
  emptySlots: EmptySlot[],
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: string
): { id: string } | null => {
  const found = emptySlots.find(
    slot =>
      slot.roster_id === rosterId &&
      slot.employee_id === employeeId &&
      slot.date === date &&
      slot.dagdeel === dagdeel
  );
  
  if (found) {
    console.log(`[DRAAD155] ✅ Found existing slot id=${found.id} for ${employeeId}|${date}|${dagdeel}`);
    return { id: found.id };
  } else {
    console.warn(`[DRAAD155] ⚠️  No slot found for ${rosterId}|${employeeId}|${date}|${dagdeel}`);
    return null;
  }
};

/**
 * DRAAD192: Retry logic with exponential backoff
 */
const callSolver2WithRetry = async (
  payload: SolveRequest,
  attempt: number = 0
): Promise<Response> => {
  try {
    console.log(`[DRAAD192] Solver2 call attempt ${attempt + 1}/${SOLVER_RETRY_ATTEMPTS}`);
    console.log(`[DRAAD192] URL: ${SOLVER2_URL}/api/v1/solve-schedule`);
    console.log(`[DRAAD192] Timeout: ${SOLVER_TIMEOUT}ms`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT);
    
    try {
      const response = await fetch(`${SOLVER2_URL}/api/v1/solve-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'rooster-app-verloskunde/DRAAD192'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check for timeout
      if (fetchError.name === 'AbortError') {
        console.error(`[DRAAD192] ⏱️  Solver2 TIMEOUT after ${SOLVER_TIMEOUT}ms`);
        
        // Retry on timeout
        if (attempt < SOLVER_RETRY_ATTEMPTS - 1) {
          const delayMs = SOLVER_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`[DRAAD192] Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return callSolver2WithRetry(payload, attempt + 1);
        } else {
          throw new Error(`Solver2 timeout after ${SOLVER_RETRY_ATTEMPTS} attempts`);
        }
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error(`[DRAAD192] Solver2 call failed: ${error.message}`);
    throw error;
  }
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const solverRunId = crypto.randomUUID();
  const executionTimestamp = new Date().toISOString();
  const executionMs = Date.now();
  const cacheBustingId = `DRAAD135-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad149CacheBustId = `DRAAD149-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad149bCacheBustId = `DRAAD149B-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad150CacheBustId = `DRAAD150-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad154CacheBustId = `DRAAD154-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad155CacheBustId = `DRAAD155-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  const draad192CacheBustId = `DRAAD192-${executionMs}-${Math.floor(Math.random() * 100000)}`;
  
  const draad135Version = CACHE_BUST_DRAAD135.version;
  const draad135Timestamp = CACHE_BUST_DRAAD135.timestamp;
  const draad149Version = CACHE_BUST_DRAAD149.version;
  const draad149Timestamp = CACHE_BUST_DRAAD149.timestamp;
  const draad149bVersion = CACHE_BUST_DRAAD149B.version;
  const draad149bTimestamp = CACHE_BUST_DRAAD149B.timestamp;
  const draad154Version = CACHE_BUST_DRAAD154.version;
  const draad154Timestamp = CACHE_BUST_DRAAD154.timestamp;
  const draad155Version = CACHE_BUST_DRAAD155.version;
  const draad155Timestamp = CACHE_BUST_DRAAD155.timestamp;
  
  try {
    const { roster_id } = await request.json();
    
    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }
    
    console.log(`[Solver API] Start solve voor roster ${roster_id}`);
    console.log(`[DRAAD192] Solver2 migration active`);
    console.log(`[DRAAD193] SOLVER2_URL environment variable: ${SOLVER2_URL}`);
    console.log(`[DRAAD192] Cache bust: ${draad192CacheBustId}`);
    console.log(`[DRAAD192] Solver endpoint: ${SOLVER2_URL}`);
    console.log(`[DRAAD192] Timeout: ${SOLVER_TIMEOUT}ms (${SOLVER_TIMEOUT / 1000}s)`);
    console.log(`[DRAAD135] Cache bust: ${cacheBustingId}`);
    console.log(`[DRAAD135] Version: ${draad135Version}`);
    console.log(`[DRAAD135] Method: UPSERT (no DELETE)`);
    console.log(`[DRAAD149] Cache bust: ${draad149CacheBustId}`);
    console.log(`[DRAAD149] Version: ${draad149Version}`);
    console.log(`[DRAAD149B] Cache bust: ${draad149bCacheBustId}`);
    console.log(`[DRAAD149B] Version: ${draad149bVersion}`);
    console.log(`[DRAAD149B] Fix: service_id included in dedup key`);
    console.log(`[DRAAD150] Cache bust: ${draad150CacheBustId}`);
    console.log(`[DRAAD150] Method: Batch UPSERT per slot`);
    console.log(`[DRAAD154] Cache bust: ${draad154CacheBustId}`);
    console.log(`[DRAAD154] Version: ${draad154Version}`);
    console.log(`[DRAAD154] Fix: status=1 SET WITH service_id + ORT validation`);
    console.log(`[DRAAD155] Cache bust: ${draad155CacheBustId}`);
    console.log(`[DRAAD155] Version: ${draad155Version}`);
    console.log(`[DRAAD155] Method: UPDATE instead of INSERT/UPSERT`);
    
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
      timeout_seconds: Math.floor(SOLVER_TIMEOUT / 1000)
    };
    
    console.log(`[DRAAD192] Aanroepen Solver2...`);
    
    // DRAAD192: Call Solver2 with retry logic and timeout handling
    let solverResponse: Response;
    try {
      solverResponse = await callSolver2WithRetry(solverRequest);
    } catch (timeoutError: any) {
      console.error(`[DRAAD192] ❌ Solver2 failed after retries: ${timeoutError.message}`);
      return NextResponse.json(
        {
          error: 'Solver2 timeout',
          message: `Solver could not complete within ${SOLVER_TIMEOUT / 1000}s after ${SOLVER_RETRY_ATTEMPTS} attempts`,
          details: {
            timeout_ms: SOLVER_TIMEOUT,
            retry_attempts: SOLVER_RETRY_ATTEMPTS,
            roster_id
          }
        },
        { status: 504 }
      );
    }
    
    if (!solverResponse.ok) {
      const errorText = await solverResponse.text();
      console.error(`[DRAAD192] Solver2 error (${solverResponse.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Solver2 service error: ${errorText}` },
        { status: solverResponse.status }
      );
    }
    
    const solverResult: SolveResponse = await solverResponse.json();
    
    console.log(`[DRAAD192] Solver2 response received`);
    console.log(`[Solver API] Status=${solverResult.status}, assignments=${solverResult.total_assignments}`);
    
    /**
     * DRAAD154: CRITICAL - Validate ORT result BEFORE any DB operations
     */
    const ortValidation = validateOrtResult(solverResult);
    if (!ortValidation.valid) {
      console.warn(`[DRAAD154] ORT result NOT valid: ${ortValidation.reason}`);
      
      if (ortValidation.reason === 'INFEASIBLE') {
        return NextResponse.json({
          success: true,
          roster_id,
          warning: 'INFEASIBLE',
          message: 'De roostering is niet haalbaar met de huidge constraints',
          solver_result: {
            status: solverResult.status,
            assignments: [],
            total_assignments: 0,
            bottleneck_report: solverResult.bottleneck_report
          },
          total_time_ms: Date.now() - startTime
        });
      }
      
      return NextResponse.json({
        error: `ORT validation failed: ${ortValidation.reason}`,
        message: 'ORT kon geen geldige roostering vinden'
      }, { status: 400 });
    }
    
    // ORT succeeded - proceed with UPDATE (not UPSERT/INSERT)
    if (solverResult.status === 'optimal' || solverResult.status === 'feasible') {
      // DRAAD149: Log solver response format BEFORE processing
      if (solverResult.assignments && solverResult.assignments.length > 0) {
        const firstAssignment = solverResult.assignments[0];
        const empIdValue = firstAssignment.employee_id;
        const empIdType = typeof empIdValue;
        const isUUID = isValidUUID(String(empIdValue));
        
        console.log('[DRAAD149] === SOLVER RESPONSE TYPE VERIFICATION ===');
        console.log(`[DRAAD149] employee_id value: ${empIdValue}`);
        console.log(`[DRAAD149] employee_id type: ${empIdType}`);
        console.log(`[DRAAD149] employee_id isUUID: ${isUUID}`);
        console.log(`[DRAAD149] Total solver assignments: ${solverResult.assignments.length}`);
        
        if (isUUID) {
          console.log('[DRAAD149] ⚠️  ALERT: employee_id is UUID format');
          console.log('[DRAAD149] Database expects TEXT format');
          console.log('[DRAAD149] This will cause type mismatch on UPDATE');
        } else {
          console.log('[DRAAD149] ✅ employee_id is TEXT format (matches database)');
        }
        console.log('[DRAAD149] === END TYPE VERIFICATION ===');
      }
      
      /**
       * DRAAD155: PHASE 1 - FETCH BASELINE (empty slots)
       * First verify what exists before attempting updates
       */
      console.log('[DRAAD155] === PHASE 1: BASELINE VERIFICATION ===');
      const emptySlots = await getEmptySlots(supabase, roster_id);
      
      if (emptySlots.length === 0) {
        console.warn('[DRAAD155] ⚠️  WARNING: No empty slots found (status=0, service_id=NULL)');
        console.warn(`[DRAAD155] ORT has ${solverResult.assignments.length} assignments but no slots to fill`);
        // Continue anyway - might be edge case
      }
      console.log('[DRAAD155] === END BASELINE VERIFICATION ===');
      
      /**
       * DRAAD155: PHASE 2 - UPDATE LOOP
       * Process each ORT assignment and UPDATE matching slot
       */
      console.log('[DRAAD155] === PHASE 2: UPDATE LOOP ===');
      let updateCount = 0;
      let skipCount = 0;
      let notFoundCount = 0;
      
      for (const ortAssignment of solverResult.assignments) {
        const serviceId = findServiceId(ortAssignment.service_code, services);
        
        // Find matching empty slot
        const existingSlot = findExistingSlot(
          emptySlots,
          roster_id,
          ortAssignment.employee_id,
          ortAssignment.date,
          ortAssignment.dagdeel
        );
        
        if (!existingSlot) {
          notFoundCount++;
          console.warn(
            `[DRAAD155] ⚠️  Slot not found for ` +
            `${roster_id}|${ortAssignment.employee_id}|${ortAssignment.date}|${ortAssignment.dagdeel}`
          );
          continue;
        }
        
        // UPDATE existing row (not INSERT)
        const { error } = await supabase
          .from('roster_assignments')
          .update({
            service_id: serviceId,
            status: serviceId ? 1 : 0,  // KEY: status=1 ONLY with service_id
            source: 'solver2',
            ort_run_id: solverRunId,
            ort_confidence: ortAssignment.confidence || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSlot.id);  // UPDATE using database row ID
        
        if (error) {
          console.error(
            `[DRAAD155] ❌ UPDATE failed for slot id=${existingSlot.id}: ${error.message}`
          );
        } else {
          updateCount++;
          console.log(
            `[DRAAD155] ✅ Updated slot ${updateCount}: ` +
            `${ortAssignment.employee_id}|${ortAssignment.date}|${ortAssignment.dagdeel} ` +
            `→ service=${serviceId ? ortAssignment.service_code : 'NULL'}`
          );
        }
      }
      
      console.log('[DRAAD155] === END UPDATE LOOP ===');
      console.log(
        `[DRAAD155] ✅ UPDATE phase complete: ` +
        `${updateCount} updated, ${notFoundCount} not found, ` +
        `${solverResult.assignments.length - updateCount - notFoundCount} other`
      );
      
      /**
       * DRAAD155: PHASE 3 - VERIFICATION
       * Confirm data integrity
       */
      if (notFoundCount > 0) {
        console.warn(`[DRAAD155] ⚠️  ${notFoundCount} ORT assignments had no matching slots`);
        console.warn('[DRAAD155] These may be outside the roster scope or slots may be filled already');
      }
      
      if (updateCount === 0 && solverResult.assignments.length > 0) {
        console.error('[DRAAD155] ❌ ERROR: All assignments failed to find matching slots');
        return NextResponse.json({
          error: '[DRAAD155] No matching slots found for any ORT assignment',
          message: 'Kan ORT assignments niet toepassen - geen lege slots beschikbaar',
          details: {
            ort_assignments: solverResult.assignments.length,
            empty_slots_found: emptySlots.length,
            successful_updates: updateCount
          }
        }, { status: 400 });
      }
      
      const { error: updateError } = await supabase
        .from('roosters')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', roster_id);
      
      if (!updateError) {
        console.log('[DRAAD192] Roster status updated: draft → in_progress');
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
        draad192: {
          status: 'IMPLEMENTED',
          version: '1.0',
          solver_endpoint: SOLVER2_URL,
          timeout_ms: SOLVER_TIMEOUT,
          retry_attempts: SOLVER_RETRY_ATTEMPTS,
          message: 'Migrated to Solver2 endpoint with timeout handling'
        },
        draad135: {
          status: 'IMPLEMENTED',
          version: draad135Version,
          method: 'UPDATE (UPSERT deprecated)',
          fix: 'No DELETE, using UPDATE instead of INSERT'
        },
        draad149: {
          status: 'VERIFICATION_ACTIVE',
          version: draad149Version,
          check: 'Employee ID type verification enabled'
        },
        draad149b: {
          status: 'IMPLEMENTED',
          version: draad149bVersion,
          fix: 'service_id included in dedup key'
        },
        draad150: {
          status: 'DEPRECATED',
          version: 'DRAAD150_BATCH_UPSERT',
          reason: 'Replaced by DRAAD155 UPDATE approach',
          cache_bust_id: draad150CacheBustId
        },
        draad154: {
          status: 'IMPLEMENTED',
          version: draad154Version,
          fix: 'ORT result validation before updates',
          validation: 'PASSED',
          cache_bust_id: draad154CacheBustId
        },
        draad155: {
          status: 'IMPLEMENTED',
          version: draad155Version,
          method: 'UPDATE instead of INSERT/UPSERT',
          fix: 'Find empty slots → UPDATE by ID → status=1 only with service_id',
          baseline_slots: emptySlots.length,
          successful_updates: updateCount,
          not_found: notFoundCount,
          message: 'ORT assignments processed via UPDATE (no constraint conflicts)',
          cache_bust_id: draad155CacheBustId
        },
        total_time_ms: totalTime
      });
    }
    
  } catch (error: any) {
    console.error('[Solver API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}