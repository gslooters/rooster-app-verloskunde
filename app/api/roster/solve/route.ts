/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD-204 FASE 3: BACKEND GREEDY REFACTOR - SELF-SERVICE MODEL
 * 
 * ============================================================================
 * ARCHITECTURE OVERVIEW
 * ============================================================================
 * 
 * Frontend
 *    ↓
 *    POST /api/roster/solve { roster_id }
 *    ↓
 * Backend (THIS FILE)
 *    1. Validate: roster exists, status='draft', dates valid
 *    2. Build GreedyRequest (minimal: roster_id + Supabase credentials)
 *    3. Send to Greedy service (async, fire-and-forget)
 *    4. Return immediately: { success: true, status: 'running' }
 *    ↓
 * Greedy Service (AUTONOMOUS)
 *    1. Initialize own Supabase client
 *    2. Fetch: roster config, employees, services, constraints
 *    3. Run greedy algorithm (day/dagdeel iteration)
 *    4. Write assignments DIRECTLY to roster_assignments table
 *    5. Realtime updates flow to Frontend via Supabase subscription
 * 
 * Frontend (REALTIME MONITORING)
 *    1. Subscribe to roster_assignments changes (realtime)
 *    2. Live UI updates as Greedy assigns shifts
 *    3. No polling required
 * 
 * ============================================================================
 * KEY CHANGES FROM DRAAD-202 (PREVIOUS VERSION)
 * ============================================================================
 * 
 * REMOVED (Massive Data Fetching):
 *   - const { data: employees } = await supabase.from('employees')...
 *   - const { data: services } = await supabase.from('service_types')...
 *   - const { data: rosterEmpServices } = await supabase.from('roster_employee_services')...
 *   - const { data: fixedData } = await supabase.from('roster_assignments')...
 *   - const { data: blockedData } = await supabase.from('roster_assignments')...
 *   - const { data: suggestedData } = await supabase.from('roster_assignments')...
 *   - const { data: staffingData } = await supabase.from('roster_period_staffing_dagdelen')...
 * 
 * REMOVED (UPDATE Loop):
 *   - for (const assignment of greedySolution.assignments) {
 *       await supabase.from('roster_assignments').update(...)
 *     }
 *   - Greedy now writes DIRECTLY to DB
 * 
 * REMOVED (Massive GreedyPayload):
 *   - GreedyPayload with 1000+ fields
 *   - All deserialization complexity
 * 
 * ADDED (Minimal GreedyRequest):
 *   - interface GreedyRequest {
 *       roster_id: string;
 *       supabase_url: string;
 *       supabase_key: string;
 *     }
 * 
 * IMPROVED (Architecture):
 *   - Backend = routing layer only
 *   - Greedy = autonomous microservice
 *   - Realtime updates = Supabase subscriptions
 *   - Immediate response = no waiting
 * 
 * ============================================================================
 * GREEDY RESPONSIBILITIES (NOW AUTONOMOUS)
 * ============================================================================
 * 
 * 1. INITIALIZATION
 *    - Initialize own Supabase client using provided credentials
 *    - Verify roster exists and has valid date range
 * 
 * 2. DATA LOADING (FROM SUPABASE DIRECTLY)
 *    - Load roster (start_date, end_date)
 *    - Load active employees
 *    - Load active service types
 *    - Load roster_employee_services (bevoegdheden)
 *    - Load roster_period_staffing_dagdelen (vereiste diensten)
 *    - Load roster_assignments (existing assignments)
 *    - Load planning_constraints (rules)
 * 
 * 3. ALGORITHM EXECUTION
 *    FOR each date in [start_date, end_date]:
 *      FOR each dagdeel in ['O', 'M', 'A']:  // Ochtend, Middag, Avond
 *        1. Fetch services needed for this date/dagdeel
 *        2. Sort services by priority
 *        3. FOR each service:
 *           - Select eligible employee (greedy: first available)
 *           - UPDATE roster_assignments directly in DB
 *           - Move to next service
 * 
 * 4. GREEDY SELECTION CRITERIA
 *    Employee is eligible if:
 *    - Qualified for this service (roster_employee_services.actief=true)
 *    - Not blocked on this date/dagdeel (blocked_slots check)
 *    - Not already assigned on this date (max 1 per day per dagdeel)
 *    - Meets constraint rules (planning_constraints)
 *    - Has fewest shifts so far (load balancing)
 * 
 * 5. DATABASE UPDATES
 *    UPDATE roster_assignments
 *    SET
 *      service_id = $1,
 *      status = 1,  // assigned (see: roster_assignments.status values)
 *      source = 'greedy',
 *      ort_run_id = $2,
 *      updated_at = NOW()
 *    WHERE
 *      id = $3
 *      AND status = 0;  // only unassigned slots
 * 
 * ============================================================================
 * DATABASE SCHEMA REFERENCES (FROM SUPABASE)
 * ============================================================================
 * 
 * roster_assignments (PRIMARY TABLE - 19 columns)
 *   - id: uuid (PK)
 *   - roster_id: uuid (FK → roosters)
 *   - employee_id: text (FK → employees.id)
 *   - date: date
 *   - dagdeel: text ('O' | 'M' | 'A')
 *   - status: integer (0=unassigned, 1=assigned, 2=blocked, 3=fixed)
 *   - service_id: uuid (FK → service_types.id)
 *   - source: text ('greedy' | 'manual' | 'suggested' | 'fixed')
 *   - ort_run_id: uuid (tracks which Greedy run created this)
 *   - ort_confidence: numeric (0-100, not used in Greedy)
 *   - is_protected: boolean
 *   - constraint_reason: jsonb
 *   - created_at, updated_at: timestamps
 * 
 * roster_employee_services (COMPETENCIES TABLE - 8 columns)
 *   - id: uuid (PK)
 *   - roster_id: uuid (FK → roosters)
 *   - employee_id: text (FK → employees.id)
 *   - service_id: uuid (FK → service_types.id)
 *   - aantal: integer
 *   - actief: boolean ← CRITICAL: only fetch where actief=true
 *   - created_at, updated_at: timestamps
 * 
 * roster_period_staffing_dagdelen (REQUIREMENTS TABLE - 12 columns)
 *   - id: uuid (PK)
 *   - roster_id: uuid (FK → roosters)
 *   - date: date
 *   - dagdeel: text ('O' | 'M' | 'A')
 *   - service_id: uuid (FK → service_types.id)
 *   - aantal: integer (how many of this service needed)
 *   - status: text ('open' | 'covered' | 'understaffed')
 *   - invulling: integer (how many assigned so far)
 *   - team: text (optional team filter)
 *   - created_at, updated_at: timestamps
 * 
 * employees (8 columns relevant to roster)
 *   - id: text (PK, e.g. 'EMP001')
 *   - voornaam, achternaam: text
 *   - actief: boolean ← CRITICAL: only active employees
 *   - dienstverband: text (type of employment)
 *   - team: text
 *   - roostervrijdagen: ARRAY (dates when unavailable)
 *   - structureel_nbh: jsonb (structured unavailability)
 * 
 * service_types (14 columns relevant)
 *   - id: uuid (PK)
 *   - code: text (e.g. 'V001', 'Z001')
 *   - naam: text (e.g. 'Verloskunde', 'Zuigelingenonderzoek')
 *   - kleur: text (UI color)
 *   - duur: numeric (service duration in hours)
 *   - dienstwaarde: numeric (priority/weight)
 *   - actief: boolean ← CRITICAL
 *   - blokkeert_volgdag: boolean (blocks next day)
 * 
 * roosters (6 columns)
 *   - id: uuid (PK)
 *   - start_date: date
 *   - end_date: date
 *   - status: text ('draft', 'in_progress', 'completed', 'finalized')
 *   - created_at, updated_at: timestamps
 * 
 * ============================================================================
 * GREEDY STATUS TRACKING (solver_runs table)
 * ============================================================================
 * 
 * After Greedy completes, it can write to solver_runs:
 *   - id: uuid
 *   - roster_id: uuid
 *   - status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
 *   - started_at, completed_at: timestamps
 *   - solve_time_seconds: numeric
 *   - coverage_rate: numeric (percentage of services covered)
 *   - total_assignments: integer
 *   - constraint_violations: jsonb
 *   - solver_status: text
 * 
 * This is OPTIONAL - Greedy can update it when done
 * 
 * ============================================================================
 * ERROR HANDLING & RESILIENCE
 * ============================================================================
 * 
 * Backend Errors (THIS LAYER):
 *   - Roster not found: 404
 *   - Missing date range: 400
 *   - Status != 'draft': 400
 *   - Missing Supabase credentials: 500
 *   - Network error sending to Greedy: return warning but still 200
 * 
 * Greedy Errors (HANDLED BY GREEDY):
 *   - Database connection failure: log and retry
 *   - Service not found: skip and log
 *   - Employee not available: mark as open/unassigned
 *   - Constraint violations: track in constraint_violations table
 *   - Partial coverage: return status='PARTIAL' with details
 * 
 * Frontend Error Handling:
 *   - No response from Greedy after timeout: show warning
 *   - No realtime updates after N seconds: poll /api/roster/{id}/status
 *   - Some services still unassigned: show notification with count
 * 
 * ============================================================================
 * DRAAD REFERENCES & DEPENDENCIES
 * ============================================================================
 * 
 * DRAAD-155: UPDATE Pattern & SAFETY_GUARD
 *   - roster_assignments is write-protected (NO DELETE)
 *   - Always UPDATE, never DELETE
 *   - UPSERT pattern only
 *   - Tracked in _status_audit_log
 * 
 * DRAAD-202: Backend Analysis & Type System
 *   - Fixed dagdeel strict literals ('O' | 'M' | 'A')
 *   - Fixed structureel_nbh JSON conversion
 *   - Error classification with Dutch messages
 *   - Comprehensive logging patterns
 * 
 * DRAAD-203: Architecture Refactor Plan
 *   - Defined this self-service model
 *   - Specified Greedy responsibilities
 *   - Database schema mapping
 * 
 * DRAAD-204 (THIS FILE):
 *   - Implementation of Fase 3 backend refactor
 *   - Simplified route.ts
 *   - Minimal GreedyRequest interface
 *   - Async fire-and-forget pattern
 * 
 * ============================================================================
 * DEPLOYMENT CHECKLIST
 * ============================================================================
 * 
 * Before deploying:
 * - [ ] Greedy service is running and accessible
 * - [ ] GREEDY_ENDPOINT environment variable set
 * - [ ] Supabase credentials in environment
 * - [ ] Supabase SERVICE_ROLE_KEY has write permissions
 * - [ ] roster_assignments table is prepared with status=0 slots
 * - [ ] solver_runs table exists and is empty
 * - [ ] SAFETY_GUARD active (no DELETE operations)
 * - [ ] Error logging configured
 * - [ ] Realtime subscriptions enabled in Supabase
 * - [ ] Frontend subscription code deployed
 * 
 * ============================================================================
 * FUTURE IMPROVEMENTS (PHASE 4+)
 * ============================================================================
 * 
 * 1. Webhook Response from Greedy
 *    - After completion, Greedy calls backend webhook
 *    - Backend updates solver_runs with final stats
 *    - Triggers Frontend notification
 * 
 * 2. Progress Tracking
 *    - Greedy periodically updates progress (e.g., 45% complete)
 *    - Frontend polls /api/roster/{id}/progress
 *    - Shows progress bar to user
 * 
 * 3. Cancellation Support
 *    - Frontend can call /api/roster/{id}/solve/cancel
 *    - Backend sends signal to Greedy
 *    - Greedy stops gracefully, saves partial results
 * 
 * 4. Multiple Algorithm Support
 *    - Support other solvers (CP-SAT, OR-Tools, etc.)
 *    - Route to different endpoints based on config
 *    - Compare solution quality
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// GREEDY SERVICE CONFIGURATION
// ============================================================================

const GREEDY_ENDPOINT = process.env.GREEDY_ENDPOINT ||
  'https://greedy-production.up.railway.app/api/greedy/solve';
const GREEDY_TIMEOUT = parseInt(process.env.GREEDY_TIMEOUT || '30000', 10);

console.log('[DRAAD-204] ========== GREEDY SERVICE CONFIGURATION =========');
console.log(`[DRAAD-204] Endpoint: ${GREEDY_ENDPOINT}`);
console.log(`[DRAAD-204] Timeout: ${GREEDY_TIMEOUT}ms`);
console.log('[DRAAD-204] Model: SELF-SERVICE (Greedy autonomous)');
console.log('[DRAAD-204] =====================================================');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * DRAAD-204 FASE 3: Minimal GreedyRequest
 * Backend ONLY sends roster_id + Supabase credentials
 * Greedy is now self-sufficient and autonomous
 */
interface GreedyRequest {
  roster_id: string;
  supabase_url: string;
  supabase_key: string;
}

/**
 * Response from Greedy (async, not waited for)
 * Greedy will webhook back with completion status if needed
 */
interface GreedyResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number;
  total_assignments: number;
  assignments_created: number;
  message?: string;
}

/**
 * Greedy error classification
 */
type GreedyErrorType =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'VALIDATION_ERROR';

interface GreedyErrorDetail {
  type: GreedyErrorType;
  userMessage: string;
  technicalDetails: string;
}

// ============================================================================
// ERROR HANDLING & CLASSIFICATION (DRAAD-202 STYLE)
// ============================================================================

/**
 * Classify Greedy errors and return Dutch user message
 * DRAAD-202: Comprehensive error classification
 */
function classifyGreedyError(error: any): GreedyErrorDetail {
  console.error('[DRAAD-204] Error classification:', {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    status: error?.status
  });

  // Timeout errors
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      userMessage: 'GREEDY service reageert niet (timeout). Probeer later opnieuw.',
      technicalDetails: `Timeout na ${GREEDY_TIMEOUT}ms`
    };
  }

  // Network errors
  if (
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'ERR_INVALID_URL' ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('network')
  ) {
    return {
      type: 'NETWORK_ERROR',
      userMessage: 'Netwerkverbinding onderbroken. Controleer uw internetverbinding.',
      technicalDetails: error.message
    };
  }

  // Server errors (5xx)
  if (error?.status >= 500) {
    return {
      type: 'SERVER_ERROR',
      userMessage: 'GREEDY service error. Probeer over enkele momenten opnieuw.',
      technicalDetails: `HTTP ${error.status}: ${error.message}`
    };
  }

  // Client errors (4xx)
  if (error?.status >= 400 && error?.status < 500) {
    return {
      type: 'CLIENT_ERROR',
      userMessage: 'Request error. Controleer uw gegevens.',
      technicalDetails: `HTTP ${error.status}: ${error.message}`
    };
  }

  // Unknown error
  return {
    type: 'VALIDATION_ERROR',
    userMessage: 'Onbekende fout opgetreden.',
    technicalDetails: JSON.stringify(error)
  };
}

// ============================================================================
// GREEDY API CALL (ASYNC - FIRE AND FORGET)
// ============================================================================

/**
 * Send GreedyRequest to Greedy service
 * DRAAD-204: Async/fire-and-forget pattern
 *
 * Backend sends the request and returns immediately.
 * Greedy runs asynchronously and writes directly to DB.
 * Frontend monitors via Supabase realtime subscription.
 */
async function sendToGreedyAsync(
  payload: GreedyRequest
): Promise<{ success: boolean; error?: GreedyErrorDetail }> {
  console.log('[DRAAD-204] === SENDING TO GREEDY (ASYNC) ===');
  console.log(`[DRAAD-204] Endpoint: ${GREEDY_ENDPOINT}`);
  console.log(`[DRAAD-204] Roster ID: ${payload.roster_id}`);

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
          'User-Agent': 'rooster-app-verloskunde/DRAAD-204'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsedMs = Date.now() - startTime;

      console.log(
        `[DRAAD-204] Greedy accepted request after ${elapsedMs}ms (HTTP ${response.status})`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DRAAD-204] Greedy returned error: HTTP ${response.status}`);
        console.error(`[DRAAD-204] Error body: ${errorText}`);

        return {
          success: false,
          error: {
            type: 'SERVER_ERROR',
            userMessage: 'GREEDY service fout bij verwerking van request',
            technicalDetails: `HTTP ${response.status}: ${errorText}`
          }
        };
      }

      console.log('[DRAAD-204] ✅ Greedy request accepted (async processing started)');
      console.log('[DRAAD-204] === GREEDY SUCCESS ===');

      return { success: true };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error(`[DRAAD-204] ❌ Request timeout after ${GREEDY_TIMEOUT}ms`);
        return {
          success: false,
          error: classifyGreedyError(fetchError)
        };
      }

      throw fetchError;
    }
  } catch (error: any) {
    const errorDetail = classifyGreedyError(error);
    console.error('[DRAAD-204] ❌ Greedy request failed:', errorDetail);
    console.log('[DRAAD-204] === GREEDY FAILED ===');

    return {
      success: false,
      error: errorDetail
    };
  }
}

// ============================================================================
// MAIN ROUTE HANDLER (DRAAD-204 FASE 3)
// ============================================================================

/**
 * POST /api/roster/solve
 * 
 * Request: { roster_id: string }
 * Response: { success: true, status: 'running', message: '...' }
 * 
 * DRAAD-204 FASE 3 Features:
 * - Minimal validation (roster exists, status=draft, dates valid)
 * - No data fetching (removed all Supabase queries for employees/services/constraints)
 * - No UPDATE loop (Greedy writes directly)
 * - Immediate response (fire-and-forget to Greedy)
 * - Async processing (no waiting for Greedy to complete)
 * - Realtime Frontend monitoring (via Supabase subscription)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const cacheBustId = `DRAAD-204-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  console.log(
    '[DRAAD-204] ========== POST /api/roster/solve (SELF-SERVICE GREEDY) =========='
  );
  console.log(`[DRAAD-204] Cache bust ID: ${cacheBustId}`);
  console.log('[DRAAD-204] Model: Backend routes → Greedy executes → Frontend monitors');

  try {
    // Parse request
    const { roster_id } = await request.json();

    if (!roster_id) {
      console.error('[DRAAD-204] Missing roster_id in request');
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD-204] Roster ID: ${roster_id}`);
    const supabase = await createClient();

    // ========================================================================
    // PHASE 1: VALIDATION (minimal - ONLY verify roster exists)
    // ========================================================================

    console.log('[DRAAD-204] === PHASE 1: VALIDATION (minimal) ===');

    // Fetch ONLY roster metadata (to verify existence and dates)
    // NO other data fetching here
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status, created_at')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error('[DRAAD-204] Roster not found');
      return NextResponse.json(
        {
          error: 'Roster niet gevonden',
          roster_id
        },
        { status: 404 }
      );
    }

    // Verify date range
    if (!roster.start_date || !roster.end_date) {
      console.error('[DRAAD-204] Roster missing date range', {
        start_date: roster.start_date,
        end_date: roster.end_date
      });
      return NextResponse.json(
        {
          error: 'Roster heeft geen geldige begindatum of einddatum'
        },
        { status: 400 }
      );
    }

    // Verify roster status is 'draft'
    if (roster.status !== 'draft') {
      console.error(
        `[DRAAD-204] Roster status validation failed: status='${roster.status}', expected 'draft'`
      );
      return NextResponse.json(
        {
          error: `Roster kan niet gerosterd worden. Status is '${roster.status}' (verwacht 'draft')`
        },
        { status: 400 }
      );
    }

    console.log('[DRAAD-204] ✅ Roster validation passed');
    console.log(`[DRAAD-204]   - Status: ${roster.status}`);
    console.log(`[DRAAD-204]   - Date range: ${roster.start_date} tot ${roster.end_date}`);
    console.log(`[DRAAD-204]   - Duration: ${calculateDays(roster.start_date, roster.end_date)} dagen`);
    console.log('[DRAAD-204] === END VALIDATION ===');

    // ========================================================================
    // PHASE 2: BUILD MINIMAL GREEDY REQUEST
    // ========================================================================

    console.log('[DRAAD-204] === PHASE 2: BUILD GREEDY REQUEST ===');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[DRAAD-204] Missing Supabase credentials in environment');
      console.error('[DRAAD-204] Required:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
      });
      return NextResponse.json(
        {
          error: 'Server configuration error: missing Supabase credentials'
        },
        { status: 500 }
      );
    }

    const greedyRequest: GreedyRequest = {
      roster_id: roster_id.toString(),
      supabase_url: supabaseUrl,
      supabase_key: supabaseServiceKey
    };

    console.log('[DRAAD-204] ✅ Greedy request built (minimal payload)');
    console.log(`[DRAAD-204]   - roster_id: ${greedyRequest.roster_id}`);
    console.log(
      `[DRAAD-204]   - supabase_url: ${greedyRequest.supabase_url.substring(0, 40)}...`
    );
    console.log(
      `[DRAAD-204]   - supabase_key: ${greedyRequest.supabase_key.substring(0, 15)}...`
    );
    console.log('[DRAAD-204] === END BUILD REQUEST ===');

    // ========================================================================
    // PHASE 3: SEND TO GREEDY (ASYNC - FIRE AND FORGET)
    // ========================================================================

    console.log('[DRAAD-204] === PHASE 3: SEND TO GREEDY (ASYNC) ===');

    const greedyResult = await sendToGreedyAsync(greedyRequest);

    if (!greedyResult.success) {
      console.warn('[DRAAD-204] ⚠️  Greedy request failed');
      console.warn('[DRAAD-204] Error detail:', greedyResult.error);
      console.log('[DRAAD-204] === END SEND TO GREEDY (FAILED) ===');

      return NextResponse.json(
        {
          error: 'Roostering kon niet worden gestart',
          userMessage: greedyResult.error?.userMessage || 'Onbekende fout opgetreden',
          technicalDetails: greedyResult.error?.technicalDetails
        },
        { status: 500 }
      );
    }

    console.log('[DRAAD-204] ✅ Greedy request sent successfully (async processing started)');
    console.log('[DRAAD-204] === END SEND TO GREEDY ===');

    // ========================================================================
    // PHASE 4: UPDATE ROSTER STATUS & RETURN IMMEDIATELY
    // ========================================================================

    console.log('[DRAAD-204] === PHASE 4: UPDATE ROSTER & RETURN ===');

    // DRAAD-206 FIX: Wrap Supabase PromiseLike with Promise.resolve()
    // This ensures the result is a full Promise<T> type that supports .catch()
    // Previously: `.then().catch()` failed with TypeScript error
    // "Property 'catch' does not exist on type 'PromiseLike<void>'"
    const updatePromise = supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);

    Promise.resolve(updatePromise)
      .then(() => {
        console.log('[DRAAD-204] ✅ Roster status updated: draft → in_progress');
      })
      .catch((err: any) => {
        console.error('[DRAAD-204] ⚠️  Failed to update roster status:', err?.message);
      });

    const totalTime = Date.now() - startTime;

    console.log('[DRAAD-204] === END ROSTER UPDATE ===');
    console.log('[DRAAD-204] ========== RESPONSE SENT ==========');
    console.log(`[DRAAD-204] Total backend time: ${totalTime}ms`);

    // ========================================================================
    // RETURN IMMEDIATELY (Don't wait for Greedy)
    // ========================================================================

    return NextResponse.json(
      {
        success: true,
        roster_id,
        message: 'Greedy is aan het werk... Updates volgen live via Supabase realtime',
        status: {
          current: 'running',
          roster_status: 'in_progress',
          backend_phase: 'complete',
          greedy_phase: 'autonomous-execution'
        },
        frontend_instructions: {
          action: 'Subscribe to roster_assignments changes',
          table: 'roster_assignments',
          filter: { roster_id },
          events: ['UPDATE', 'INSERT'],
          description:
            'Watch live as Greedy assigns shifts. Updates will appear in real-time.'
        },
        architecture: {
          model: 'self-service',
          backend_responsibility: 'routing only',
          greedy_responsibility: 'autonomous (fetch data, run algorithm, write DB)',
          frontend_responsibility: 'realtime monitoring via Supabase subscription'
        },
        implementation: {
          draad: 'DRAAD-204',
          fase: '3',
          status: 'IMPLEMENTED',
          version: '1.0',
          endpoint: GREEDY_ENDPOINT,
          timeout_ms: GREEDY_TIMEOUT,
          async: true,
          backend_payload: 'minimal (roster_id + credentials only)',
          removed_features: [
            'Data fetching (employees, services, constraints)',
            'UPDATE loop (Greedy writes directly)',
            'Massive GreedyPayload structure'
          ],
          new_features: [
            'Minimal GreedyRequest interface',
            'Async fire-and-forget pattern',
            'Realtime Supabase subscription',
            'Autonomous Greedy service'
          ]
        },
        metrics: {
          cache_bust_id: cacheBustId,
          backend_duration_ms: totalTime,
          roster_date_range: `${roster.start_date} to ${roster.end_date}`,
          roster_duration_days: calculateDays(roster.start_date, roster.end_date)
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[DRAAD-204] ❌ Unexpected error in POST handler:', error);
    console.error('[DRAAD-204] Stack:', error?.stack);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        draad: 'DRAAD-204'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate number of days between two dates (inclusive)
 */
function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
  return diffDays;
}
