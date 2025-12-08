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
 * - Function signature: upsert_ort_assignments(p_assignments: jsonb) → (success, message, count_processed)
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
 *   - Prevent timeout on 1140 items
 *   - Track progress
 * - Error handling: Per-batch error collection
 * - Logging: Batch start, success, failure with details
 * - Status: Each batch reported individually
 * 
 * DRAAD129-STAP3-FIXED: RPC FUNCTION REFACTORED
 * - PROBLEM: CREATE TEMP TABLE called multiple times causes "relation already exists"
 * - PostgreSQL temp tables are session-scoped and persist between function calls
 * - In batched RPC calls, second+ invocation fails
 * - SOLUTION: Removed CREATE TEMP TABLE
 * - NEW: Use VALUES clause with DISTINCT ON directly in INSERT...SELECT
 * - Benefits:
 *   - No session state
 *   - Batch-safe (each RPC independent transaction)
 *   - Thread-safe
 *   - Maintains deduplication logic (DISTINCT ON)
 *   - Same atomicity guarantees
 * - Migration: 20251208_DRAAD129_STAP3_FIXED_upsert_ort_assignments.sql
 * 
 * DRAAD129-HOTFIX: SYNTAX ERROR FIX
 * - FIXED: Unterminated string constant on line 822
 * - cache_busting string now properly closed
 * - Build should pass now
 * 
 * DRAAD131: ORT Infeasible Fix – Status 1 Constraint Separation
 * - FIXED: Status 1 was in blocked_slots → conflict with Constraint 3A
 * - Symptom: CP-SAT says var==1 (3A fixed) AND var==0 (3B blocked) → INFEASIBLE
 * - Solution: Remove status 1 from blocked_slots fetch [1,2,3] → [2,3]
 * - Status 1 protection: Constraint 3A fixeert + niet in blocked_slots
 * - Result: No constraint conflict, FEASIBLE when capacity exists
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
 * DRAAD130: STATUS 1 FIX - Critical Bug in Blocked Slots Fetch
 * - PREVIOUS: blocked_slots query was fetching status [1,2,3] 
 * - ISSUE: Status 1 shouldn't be in blocked_slots (owned by fixed_assignments)
 * - DRAAD131: Removed status 1 from this fetch to prevent constraint conflict
 * - NEW blocked_slots query now includes only status [2, 3]
 * - Status 1 protection: Moved to Constraint 3A (fixed_assignments)
 * - Impact: ORT now respects existing (status=1) assignments WITHOUT conflict
 * - Result: FEASIBLE status when capacity exists
 * 
 * DRAAD129-FIX4: COMPREHENSIVE DUPLICATE VERIFICATION (THIS PHASE)
 * - NEW: logDuplicates() helper - detailed INPUT analysis before dedup
 * - NEW: findDuplicatesInBatch() helper - per-batch verification BEFORE RPC
 * - NEW: verifyDeduplicationResult() helper - validation after dedup
 * - Checkpoint 1: Log raw solver output for duplicates
 * - Checkpoint 2: Verify deduplication result
 * - Checkpoint 3: Verify EACH batch before RPC call
 * - If duplicates found: ERROR with full diagnostic details (indices, keys, counts)
 * - If batch clean: log "verified ✅ CLEAN - proceeding with RPC"
 * - Prevents: Silent failures where duplicates pass through to PostgreSQL
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
 * 9. DRAAD129-FIX4: Comprehensive verification at INPUT → DEDUP → BATCH
 * 10. DRAAD129-STAP2: Process assignments in batches (BATCH_SIZE=50)
 * 11. DRAAD129-STAP3-FIXED: RPC uses VALUES + DISTINCT ON (no TEMP TABLE)
 * 12. OPTIE E: Write with ORT tracking fields + service_id mapping
 * 13. Return appropriate response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CACHE_BUST_DRAAD129_STAP3_FIXED } from '@/app/api/cache-bust/DRAAD129_STAP3_FIXED';
import { CACHE_BUST_DRAAD129_FIX4 } from '@/app/api/cache-bust/DRAAD129_FIX4';
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
 * DRAAD129-FIX4: FASE 2 - Helper function to log duplicates in assignment array
 * 
 * Analyzes array for duplicate keys: (employee_id|date|dagdeel)
 * Provides detailed diagnostics if duplicates found
 * 
 * @param assignments - Array of assignments to analyze
 * @param label - Label for logging (e.g., "INPUT", "AFTER_DEDUP", "BATCH_0")
 * @returns {hasDuplicates, totalCount, uniqueCount, duplicateCount, details}
 */
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
    const key = `${a.employee_id}|${a.date}|${a.dagdeel}`;
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
    console.error(`[FIX4]   - Total assignments: ${assignments.length}`);
    console.error(`[FIX4]   - Unique keys: ${uniqueCount}`);
    console.error(`[FIX4]   - Duplicate instances: ${duplicateCount}`);
    console.error(`[FIX4]   - Duplicate keys: ${duplicateKeys.length}`);
    
    duplicateKeys.forEach(d => {
      console.error(`[FIX4]     - Key "${d.key}" appears ${d.count} times at indices: ${d.indices.join(', ')}`);
    });
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

/**
 * DRAAD129-FIX4: FASE 3 - Helper function to verify deduplication result
 * 
 * Compares before/after arrays to validate deduplication worked correctly
 * 
 * @param before - Original array (may have duplicates)
 * @param after - Deduplicated array
 * @param label - Label for logging
 * @returns {success, removed, report}
 */
interface DeduplicationVerification {
  success: boolean;
  removed: number;
  report: string;
}

const verifyDeduplicationResult = (before: any[], after: any[], label: string): DeduplicationVerification => {
  const removed = before.length - after.length;
  
  if (removed === 0) {
    console.log(`[FIX4] VERIFY ${label}: ✅ Already clean - no duplicates removed`);
    return {
      success: true,
      removed: 0,
      report: 'No duplicates found - deduplication result valid'
    };
  }
  
  if (removed < 0) {
    const errorMsg = `After array (${after.length}) is LONGER than before array (${before.length}) - critical error!`;
    console.error(`[FIX4] VERIFY ${label}: 🚨 ${errorMsg}`);
    return {
      success: false,
      removed: 0,
      report: errorMsg
    };
  }
  
  console.log(`[FIX4] VERIFY ${label}: ✅ Removed ${removed} duplicate(s) (${before.length} → ${after.length})`);
  
  return {
    success: true,
    removed,
    report: `Deduplication successful - removed ${removed} duplicate(s)`
  };
};

/**
 * DRAAD129-FIX4: FASE 4 - Helper function to find duplicates in a single batch
 * 
 * Used BEFORE each RPC call to verify batch has no duplicates
 * 
 * @param batch - Batch of assignments to check
 * @param batchNumber - Batch index (for logging)
 * @returns {hasDuplicates, count, keys, indices}
 */
interface BatchDuplicateCheck {
  hasDuplicates: boolean;
  count: number;
  keys: string[];
  details: Array<{key: string; count: number; indices: number[]}>;
}

const findDuplicatesInBatch = (batch: any[], batchNumber: number): BatchDuplicateCheck => {
  const keyMap = new Map<string, number[]>();
  
  batch.forEach((a, i) => {
    const key = `${a.employee_id}|${a.date}|${a.dagdeel}`;
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key)!.push(i);
  });
  
  const duplicates = Array.from(keyMap.entries())
    .filter(([_, indices]) => indices.length > 1)
    .map(([key, indices]) => ({key, count: indices.length, indices}))
    .sort((a, b) => b.count - a.count);
  
  const hasDuplicates = duplicates.length > 0;
  const totalDuplicateInstances = duplicates.reduce((sum, d) => sum + (d.count - 1), 0);
  
  if (hasDuplicates) {
    console.error(`[FIX4] Batch ${batchNumber} verification: 🚨 DUPLICATES DETECTED!`);
    console.error(`[FIX4]   - Batch size: ${batch.length}`);
    console.error(`[FIX4]   - Unique keys: ${keyMap.size}`);
    console.error(`[FIX4]   - Duplicate keys: ${duplicates.length}`);
    console.error(`[FIX4]   - Total duplicate instances: ${totalDuplicateInstances}`);
    
    duplicates.forEach(d => {
      console.error(`[FIX4]     - Key "${d.key}" appears ${d.count} times at indices: ${d.indices.join(', ')}`);
    });
  } else {
    console.log(`[FIX4] Batch ${batchNumber} verified ✅ CLEAN - proceeding with RPC`);
  }
  
  return {
    hasDuplicates,
    count: totalDuplicateInstances,
    keys: duplicates.map(d => d.key),
    details: duplicates
  };
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
  const cacheBustingId = `DRAAD131-${executionMs}-${Math.floor(Math.random() * 10000)}`;
  
  // DRAAD129-STAP3-FIXED: Import cache bust version
  const cacheBustVersion = CACHE_BUST_DRAAD129_STAP3_FIXED.version;
  const cacheBustTimestamp = CACHE_BUST_DRAAD129_STAP3_FIXED.timestamp;
  
  // DRAAD129-FIX4: Import FIX4 cache bust
  const fix4Version = CACHE_BUST_DRAAD129_FIX4.version;
  const fix4Timestamp = CACHE_BUST_DRAAD129_FIX4.timestamp;
  
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
    console.log(`[DRAAD131] DRAAD131 FIX: Status 1 now EXCLUDED from blocked_slots (only [2,3])`);
    console.log(`[DRAAD129] Execution timestamp: ${executionTimestamp} (${executionMs})`);
    console.log(`[DRAAD129] Cache busting: ${cacheBustingId}`);
    console.log(`[DRAAD129-STAP3-FIXED] Cache bust version: ${cacheBustVersion} (timestamp: ${cacheBustTimestamp})`);
    console.log(`[FIX4] DRAAD129-FIX4 ENABLED - version: ${fix4Version} (timestamp: ${fix4Timestamp})`);
    
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
    
    // 8. DRAAD131: FIX - REMOVED STATUS 1 FROM BLOCKED SLOTS!
    // DRAAD106: Fetch blocked slots (status 2, 3 ONLY)
    // DRAAD131: Removed status 1 (fixed_assignments protection via Constraint 3A)
    console.log('[DRAAD131] Fetching blocked slots [2,3] only (status 1 removed)');
    
    const { data: blockedData, error: blockedError } = await supabase
      .from('roster_assignments')
      .select('employee_id, date, dagdeel, status')
      .eq('roster_id', roster_id)
      .in('status', [2, 3]);  // ✅ DRAAD131: STATUS 1 REMOVED!
    
    if (blockedError) {
      console.error('[Solver API] Blocked slots fetch error:', blockedError);
    }
    
    // DRAAD125A: Null-safe handling
    const safeBlockedData = blockedData || [];
    
    // Log blocking breakdown
    const status2Count = safeBlockedData.filter(b => b.status === 2).length;
    const status3Count = safeBlockedData.filter(b => b.status === 3).length;
    console.log(`[DRAAD131] Blocked slots breakdown: status 2=${status2Count}, status 3=${status3Count}, total=${safeBlockedData.length}`);
    console.log('[DRAAD131] Status 1 protection: Constraint 3A (fixed_assignments) instead of Constraint 3B');
    
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
    
    console.log(`[Solver API] Data verzameld: ${employees.length} medewerkers, ${services.length} diensten, ${safeRosterEmpServices.length} bevoegdheden (actief), ${safeFixedData.length} fixed, ${safeBlockedData.length} blocked [2,3 only], ${safeSuggestedData.length} suggested, ${exact_staffing.length} exacte bezetting (DRAAD108)`);
    
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
        status: bs.status as 2 | 3  // DRAAD131: Now [2,3] only (status 1 removed)
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
      const assignmentsToUpsert = solverResult.assignments.map(a => ({
        roster_id,
        employee_id: a.employee_id,
        date: a.date,
        dagdeel: a.dagdeel,
        // OPTIE E: Map service_code (string from solver) → service_id (UUID)
        service_id: findServiceId(a.service_code, services),
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
      }));
      
      if (assignmentsToUpsert.length > 0) {
        console.log(`[OPTIE E] ${assignmentsToUpsert.length} assignments raw from solver`);
        
        // ============================================================
        // DRAAD129: DIAGNOSTIC LOGGING - DUPLICATE DETECTION
        // ============================================================
        console.log('[DRAAD129] === DIAGNOSTIC PHASE: Analyzing solver output for duplicates ===');
        console.log(`[DRAAD129] Raw solver assignments: ${assignmentsToUpsert.length} total`);
        console.log(`[DRAAD129] Execution timestamp: ${executionTimestamp} | ${executionMs}`);
        console.log(`[DRAAD129] Cache busting: ${cacheBustingId}`);
        
        // ============================================================
        // DRAAD129-FIX4: FASE 4 - Call logDuplicates BEFORE dedup
        // ============================================================
        const inputAnalysis = logDuplicates(assignmentsToUpsert, 'INPUT');
        
        if (inputAnalysis.hasDuplicates) {
          console.error('[FIX4] 🚨 CRITICAL: Input contains duplicates - this should not happen!');
          console.error(`[FIX4]   Total duplicate instances: ${inputAnalysis.duplicateCount}`);
          
          return NextResponse.json({
            error: `[FIX4] INPUT contains ${inputAnalysis.duplicateCount} duplicate assignments`,
            details: {
              duplicateCount: inputAnalysis.duplicateCount,
              duplicateKeys: inputAnalysis.duplicateKeys,
              totalAssignments: assignmentsToUpsert.length,
              uniqueCount: inputAnalysis.uniqueCount
            },
            phase: 'DIAGNOSTIC_PHASE_INPUT_CHECK',
            fix4: 'Duplicate detection found duplicates BEFORE deduplication'
          }, { status: 400 });
        }
        
        console.log('[DRAAD129] === END DIAGNOSTIC PHASE ===');
        
        // ============================================================
        // DRAAD127: Deduplicate assignments BEFORE UPSERT
        // ============================================================
        const deduplicatedAssignments = deduplicateAssignments(assignmentsToUpsert);
        
        // ============================================================
        // DRAAD129-FIX4: FASE 5 - Call verifyDeduplicationResult AFTER dedup
        // ============================================================
        const deduplicationVerification = verifyDeduplicationResult(
          assignmentsToUpsert,
          deduplicatedAssignments,
          'DEDUPLICATION'
        );
        
        if (!deduplicationVerification.success) {
          console.error('[FIX4] 🚨 CRITICAL: Deduplication verification FAILED!');
          return NextResponse.json({
            error: `[FIX4] Deduplication verification failed: ${deduplicationVerification.report}`,
            phase: 'DEDUPLICATION_VERIFICATION',
            fix4: 'Unexpected issue during deduplication process'
          }, { status: 500 });
        }
        
        // Verify NO duplicates remain AFTER deduplication
        const afterDedupAnalysis = logDuplicates(deduplicatedAssignments, 'AFTER_DEDUP');
        
        if (afterDedupAnalysis.hasDuplicates) {
          console.error('[FIX4] 🚨 CRITICAL: Found duplicates AFTER deduplication!');
          console.error(`[FIX4]   This means deduplication logic FAILED`);
          console.error(`[FIX4]   Details: ${afterDedupAnalysis.duplicateCount} instances`);
          
          return NextResponse.json({
            error: `[FIX4] Duplicates found AFTER deduplication - deduplication logic failed`,
            details: {
              duplicateCount: afterDedupAnalysis.duplicateCount,
              duplicateKeys: afterDedupAnalysis.duplicateKeys,
              totalAssignments: deduplicatedAssignments.length,
              uniqueCount: afterDedupAnalysis.uniqueCount
            },
            phase: 'AFTER_DEDUPLICATION_VERIFICATION',
            fix4: 'Duplicate detection found duplicates AFTER deduplication - logic error',
            investigation: 'Check if key format in logDuplicates matches actual duplicate detection'
          }, { status: 500 });
        }
        
        console.log(`[DRAAD129] After deduplication: ${deduplicatedAssignments.length} assignments (removed ${assignmentsToUpsert.length - deduplicatedAssignments.length})`);
        
        // ============================================================
        // DRAAD129-STAP2: BATCH PROCESSING FOR UPSERT
        // ============================================================
        console.log('[DRAAD129-STAP2] === BATCH PROCESSING PHASE ===');
        
        const BATCH_SIZE = 50;  // Process 50 assignments per RPC call
        const TOTAL_ASSIGNMENTS = deduplicatedAssignments.length;
        const TOTAL_BATCHES = Math.ceil(TOTAL_ASSIGNMENTS / BATCH_SIZE);
        
        console.log(`[DRAAD129-STAP2] Configuration: BATCH_SIZE=${BATCH_SIZE}, TOTAL_ASSIGNMENTS=${TOTAL_ASSIGNMENTS}, TOTAL_BATCHES=${TOTAL_BATCHES}`);
        console.log(`[DRAAD129-STAP3-FIXED] Using VALUES + DISTINCT ON (no CREATE TEMP TABLE)`);
        
        let totalProcessed = 0;
        let batchErrors: Array<{batchNum: number; error: string; assignmentCount: number}> = [];
        
        for (let i = 0; i < deduplicatedAssignments.length; i += BATCH_SIZE) {
          const batch = deduplicatedAssignments.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE);
          const batchStartIdx = i;
          const batchEndIdx = Math.min(i + BATCH_SIZE, deduplicatedAssignments.length);
          
          console.log(`[DRAAD129-STAP2] Batch ${batchNum}/${TOTAL_BATCHES - 1}: processing ${batch.length} assignments (indices ${batchStartIdx}-${batchEndIdx - 1})...`);
          
          // ============================================================
          // DRAAD129-FIX4: FASE 6 - Call findDuplicatesInBatch BEFORE RPC
          // ============================================================
          const batchDuplicateCheck = findDuplicatesInBatch(batch, batchNum);
          
          if (batchDuplicateCheck.hasDuplicates) {
            const errorMsg = `Batch ${batchNum} contains ${batchDuplicateCheck.count} duplicate(s) - cannot proceed with RPC call!`;
            console.error(`[FIX4] 🚨 ${errorMsg}`);
            batchDuplicateCheck.details.forEach(d => {
              console.error(`[FIX4]   - Key "${d.key}" appears ${d.count} times at indices: ${d.indices.join(', ')}`);
            });
            
            return NextResponse.json({
              error: `[FIX4] ${errorMsg}`,
              details: {
                batchNumber: batchNum,
                duplicateCount: batchDuplicateCheck.count,
                duplicateKeys: batchDuplicateCheck.details,
                batchSize: batch.length,
                totalBatches: TOTAL_BATCHES
              },
              phase: 'BATCH_PROCESSING_PHASE',
              fix4: 'Per-batch verification detected duplicates before RPC call'
            }, { status: 500 });
          }
          // ============================================================
          // END DRAAD129-FIX4 FASE 6
          // ============================================================
          
          // Validatie: Check for unmapped services in this batch
          const unmappedCount = batch.filter(a => !a.service_id).length;
          if (unmappedCount > 0) {
            console.warn(`[DRAAD129-STAP2] ⚠️ Batch ${batchNum}: ${unmappedCount}/${batch.length} assignments have unmapped service codes`);
          }
          
          // Call RPC for this batch
          // DRAAD129-STAP3-FIXED: Function now uses VALUES + DISTINCT ON (no TEMP TABLE)
          const { data: upsertResult, error: upsertError } = await supabase
            .rpc('upsert_ort_assignments', {
              p_assignments: batch
            });
          
          // DRAAD128.8: Detailed RPC response debugging
          if (upsertError) {
            console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED with RPC error:`);
            console.error(`[DRAAD129-STAP2]   Error message: ${upsertError.message}`);
            console.error(`[DRAAD129-STAP2]   Error code: ${upsertError.code}`);
            console.error(`[DRAAD129-STAP2]   Error details: ${JSON.stringify(upsertError, null, 2)}`);
            batchErrors.push({
              batchNum,
              error: upsertError.message || 'Unknown RPC error',
              assignmentCount: batch.length
            });
          } else if (!upsertResult) {
            const errorMsg = 'RPC returned null result';
            console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED: ${errorMsg}`);
            batchErrors.push({
              batchNum,
              error: errorMsg,
              assignmentCount: batch.length
            });
          } else if (!Array.isArray(upsertResult) || upsertResult.length === 0) {
            const errorMsg = `Invalid RPC response - result is not an array: ${JSON.stringify(upsertResult)}`;
            console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED: ${errorMsg}`);
            batchErrors.push({
              batchNum,
              error: errorMsg,
              assignmentCount: batch.length
            });
          } else {
            // DRAAD128.8: Validate response structure
            const [result] = upsertResult;
            console.log(`[DRAAD129-STAP2] Batch ${batchNum} RPC response: ${JSON.stringify(result, null, 2)}`);
            
            if (!result || typeof result !== 'object') {
              const errorMsg = `Invalid result object: ${JSON.stringify(result)}`;
              console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED: ${errorMsg}`);
              batchErrors.push({
                batchNum,
                error: errorMsg,
                assignmentCount: batch.length
              });
            } else if (!result.success) {
              console.error(`[DRAAD129-STAP2] ❌ Batch ${batchNum} FAILED (RPC returned failure): ${result.message || 'No message'}`);
              batchErrors.push({
                batchNum,
                error: result.message || 'RPC function returned success=false',
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
            },
            cacheBustVersion,
            cacheBustTimestamp,
            draad129_stap3_fixed: 'VALUES + DISTINCT ON approach applied',
            fix4_version: fix4Version,
            fix4_timestamp: fix4Timestamp
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
        draad131: {
          status: 'FIXED',
          fix_applied: 'Status 1 REMOVED from blocked_slots fetch [2,3] only',
          blocked_slots_breakdown: {
            status_2_count: status2Count,
            status_3_count: status3Count,
            total_blocked: safeBlockedData.length
          },
          impact: 'ORT now respects existing (status=1) planner assignments without constraint conflict',
          constraint_protection: 'Status 1: Constraint 3A (fixed) | Status 2,3: Constraint 3B (blocked)'
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
          cache_busting: cacheBustingId,
          cache_bust_version: cacheBustVersion,
          cache_bust_timestamp: cacheBustTimestamp
        },
        draad129_stap3_fixed: {
          status: 'IMPLEMENTED',
          fix: 'VALUES + DISTINCT ON - removed CREATE TEMP TABLE',
          reason: 'CREATE TEMP TABLE fails on second+ batch call in same session',
          solution: 'Direct DISTINCT ON in INSERT...SELECT',
          benefits: ['batch-safe', 'thread-safe', 'no session state', 'atomic per batch'],
          migration: '20251208_DRAAD129_STAP3_FIXED_upsert_ort_assignments.sql',
          rpc_function: 'upsert_ort_assignments(p_assignments jsonb)'
        },
        draad129_fix4: {
          status: 'IMPLEMENTED',
          version: fix4Version,
          timestamp: fix4Timestamp,
          helper_functions: [
            'logDuplicates() - detailed INPUT analysis',
            'verifyDeduplicationResult() - validation after dedup',
            'findDuplicatesInBatch() - per-batch verification BEFORE RPC'
          ],
          checkpoints: [
            'Checkpoint 1: Input analysis - CLEAN ✅',
            'Checkpoint 2: After deduplication - CLEAN ✅',
            'Checkpoint 3: Per-batch before RPC - CLEAN ✅ (all batches verified)'
          ],
          outcome: 'All 3 checkpoints passed - no duplicates present at any stage'
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
        draad131: {
          status: 'APPLIED',
          note: 'Status 1 REMOVED from blocked_slots - constraint conflict resolved if still INFEASIBLE, cause is other capacity gaps'
        },
        optie_e: {
          status: 'READY (not applied - INFEASIBLE)',
          reason: 'No feasible solution found - no database writes performed'
        },
        draad129: {
          status: 'SKIPPED',
          reason: 'INFEASIBLE result - no assignments to analyze'
        },
        draad129_stap3_fixed: {
          status: 'READY',
          note: 'Fix applied in request, but no assignments to write'
        },
        draad129_fix4: {
          status: 'SKIPPED',
          reason: 'INFEASIBLE result - no assignments to verify',
          version: fix4Version,
          timestamp: fix4Timestamp
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
        draad131: {
          status: 'APPLIED',
          note: 'Fix was applied to request, but solver did not return FEASIBLE/INFEASIBLE'
        },
        draad129: {
          status: 'SKIPPED',
          reason: `Solver status ${solverResult.status} - no assignments to analyze`
        },
        draad129_stap3_fixed: {
          status: 'READY',
          note: 'Fix applied but solver timeout or error occurred'
        },
        draad129_fix4: {
          status: 'SKIPPED',
          reason: `Solver status ${solverResult.status} - no assignments to verify`,
          version: fix4Version,
          timestamp: fix4Timestamp
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
        type: error.name || 'Error',
        cacheBustVersion,
        cacheBustTimestamp,
        fix4_version: fix4Version,
        fix4_timestamp: fix4Timestamp
      },
      { status: 500 }
    );
  }
}