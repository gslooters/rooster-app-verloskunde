/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD-204: BACKEND GREEDY REFACTOR - SELF-SERVICE MODEL
 * Simplify backend to routing only. Greedy is now autonomous.
 * 
 * Architecture (After DRAAD-203 Refactor):
 * - Frontend: Calls /api/roster/solve with { roster_id }
 * - Backend (THIS FILE): Verify roster exists, get credentials, forward to Greedy
 * - Greedy: Self-sufficient - fetch data from Supabase, run algorithm, write directly to DB
 * - Frontend: Watches roster_assignments via Supabase realtime subscription
 * 
 * Key Changes from DRAAD-202:
 * - REMOVED: All data fetching (employees, services, constraints, etc.)
 * - REMOVED: UPDATE loop (Greedy writes directly to DB)
 * - REMOVED: GreedyPayload massive structure
 * - ADDED: GreedyRequest minimal structure (roster_id, credentials)
 * - ADDED: Immediate response (no waiting for Greedy to complete)
 * - KEPT: Validation (roster exists, status=draft, dates valid)
 * - KEPT: Error handling with Dutch messages
 * - KEPT: Logging (DRAAD-202 style)
 * 
 * Greedy Responsibilities (now autonomous):
 * 1. Initialize own Supabase client with provided credentials
 * 2. Fetch roster config (start_date, end_date)
 * 3. Fetch employees, services, constraints from DB
 * 4. Run greedy algorithm (day/dagdeel iteration)
 * 5. Write assignments directly to roster_assignments table
 * 6. Cleanup and logging
 * 
 * Frontend Responsibilities:
 * 1. Show "Greedy is working..." notification
 * 2. Subscribe to roster_assignments changes
 * 3. Live update UI as Greedy writes assignments
 * 4. Poll or subscribe for completion signal
 * 
 * Database constraints maintained:
 * - DRAAD-155: UPDATE pattern (no conflicts)
 * - No INSERT/UPSERT operations in backend
 * - source='greedy' for all assignments
 * - ort_run_id tracking for batch operations
 * 
 * DRAAD-202 Fixes Maintained:
 * - Type system repairs (dagdeel strict literals, structureel_nbh conversion)
 * - Error classification with Dutch messages
 * - Comprehensive logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// GREEDY SERVICE CONFIGURATION
// ============================================================================

const GREEDY_ENDPOINT = process.env.GREEDY_ENDPOINT || 
  'https://greedy-production.up.railway.app/api/greedy/solve';
const GREEDY_TIMEOUT = parseInt(process.env.GREEDY_TIMEOUT || '30000', 10);

console.log('[DRAAD-204] GREEDY Configuration:');
console.log(`[DRAAD-204] Endpoint: ${GREEDY_ENDPOINT}`);
console.log(`[DRAAD-204] Timeout: ${GREEDY_TIMEOUT}ms`);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * DRAAD-204: Minimal GreedyRequest
 * Backend only sends roster_id + Supabase credentials
 * Greedy does EVERYTHING else
 */
interface GreedyRequest {
  roster_id: string;
  supabase_url: string;
  supabase_key: string;
}

/**
 * Greedy responses via webhook/async
 * Backend doesn't wait for this - returns immediately
 */
interface GreedyResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number;
  total_assignments: number;
  assignments_created: number;
  message?: string;
}

/**
 * GREEDY Error classification
 */
type GreedyErrorType = 
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'VALIDATION_ERROR';

interface GreedyError {
  type: GreedyErrorType;
  message: string;
  details?: any;
}

// ============================================================================
// ERROR HANDLING (Dutch messages)
// ============================================================================

/**
 * Classify error and return Dutch message for user
 */
function classifyGreedyError(error: any): { type: GreedyErrorType; userMessage: string; details: string } {
  console.error('[DRAAD-204] Error classification:', { error: error?.message, code: error?.code });

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

  // Default unknown error
  return {
    type: 'VALIDATION_ERROR',
    userMessage: 'Onbekende fout opgetreden. Details: ' + (error?.message || 'Unknown'),
    details: JSON.stringify(error)
  };
}

// ============================================================================
// GREEDY API CALL (ASYNC - NO WAIT)
// ============================================================================

/**
 * Send request to Greedy (fire-and-forget)
 * DRAAD-204: Backend doesn't wait for Greedy to complete
 * Greedy runs asynchronously and writes directly to DB
 * 
 * If we get a timeout or network error, log it but don't block response
 */
async function sendToGreedyAsync(payload: GreedyRequest): Promise<{ sent: boolean; error?: string }> {
  console.log('[DRAAD-204] === GREEDY REQUEST START (ASYNC) ===');
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
      console.log(`[DRAAD-204] Greedy request sent after ${elapsedMs}ms, HTTP ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DRAAD-204] Greedy HTTP error ${response.status}: ${errorText}`);
        return {
          sent: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      console.log('[DRAAD-204] ✅ Greedy request accepted (async processing started)');
      console.log('[DRAAD-204] === GREEDY REQUEST SUCCESS ===');
      return { sent: true };

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`[DRAAD-204] ❌ Greedy timeout after ${GREEDY_TIMEOUT}ms`);
        return {
          sent: false,
          error: `Timeout after ${GREEDY_TIMEOUT}ms`
        };
      }

      throw fetchError;
    }
  } catch (error: any) {
    const errorClassification = classifyGreedyError(error);
    console.error(`[DRAAD-204] ❌ Greedy request failed:`, errorClassification);
    console.log('[DRAAD-204] === GREEDY REQUEST FAILED ===');
    
    return {
      sent: false,
      error: errorClassification.userMessage
    };
  }
}

// ============================================================================
// MAIN HANDLER (DRAAD-204: SIMPLIFIED)
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const executionMs = Date.now();
  const cacheBustId = `DRAAD-204-${executionMs}-${Math.floor(Math.random() * 100000)}`;

  console.log('[DRAAD-204] ========== POST /api/roster/solve (SELF-SERVICE) ==========');
  console.log(`[DRAAD-204] Cache bust ID: ${cacheBustId}`);

  try {
    const { roster_id } = await request.json();

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD-204] Roster ID: ${roster_id}`);

    const supabase = await createClient();

    // ========================================================================
    // PHASE 1: VALIDATION (minimal)
    // ========================================================================
    
    console.log('[DRAAD-204] === PHASE 1: VALIDATION ===');

    // Fetch roster metadata (ONLY to verify existence and dates)
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error('[DRAAD-204] Roster not found');
      return NextResponse.json(
        { error: 'Roster niet gevonden' },
        { status: 404 }
      );
    }

    // Verify roster has dates
    if (!roster.start_date || !roster.end_date) {
      console.error('[DRAAD-204] Roster missing date range:', { 
        start_date: roster.start_date, 
        end_date: roster.end_date 
      });
      return NextResponse.json(
        { error: 'Roster heeft geen geldige begindatum of einddatum' },
        { status: 400 }
      );
    }

    // Verify roster status
    if (roster.status !== 'draft') {
      console.error(`[DRAAD-204] Roster status is '${roster.status}', moet 'draft' zijn`);
      return NextResponse.json(
        { error: `Roster status is '${roster.status}', moet 'draft' zijn` },
        { status: 400 }
      );
    }

    console.log('[DRAAD-204] ✅ Roster validation passed');
    console.log(`[DRAAD-204]   - Status: ${roster.status}`);
    console.log(`[DRAAD-204]   - Date range: ${roster.start_date} to ${roster.end_date}`);
    console.log('[DRAAD-204] === END VALIDATION ===');

    // ========================================================================
    // PHASE 2: BUILD MINIMAL GREEDY REQUEST
    // ========================================================================
    
    console.log('[DRAAD-204] === PHASE 2: BUILD GREEDY REQUEST ===');

    const greedyRequest: GreedyRequest = {
      roster_id: roster_id.toString(),
      supabase_url: process.env.SUPABASE_URL || '',
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    };

    if (!greedyRequest.supabase_url || !greedyRequest.supabase_key) {
      console.error('[DRAAD-204] Missing Supabase credentials in environment');
      return NextResponse.json(
        { error: 'Server configuration error: missing Supabase credentials' },
        { status: 500 }
      );
    }

    console.log('[DRAAD-204] ✅ Greedy request built (minimal):');
    console.log(`[DRAAD-204]   - roster_id: ${greedyRequest.roster_id}`);
    console.log(`[DRAAD-204]   - supabase_url: ${greedyRequest.supabase_url.substring(0, 30)}...`);
    console.log(`[DRAAD-204]   - supabase_key: ${greedyRequest.supabase_key.substring(0, 10)}...`);
    console.log('[DRAAD-204] === END BUILD REQUEST ===');

    // ========================================================================
    // PHASE 3: SEND TO GREEDY (ASYNC - NO WAIT)
    // ========================================================================
    
    console.log('[DRAAD-204] === PHASE 3: SEND TO GREEDY ===');

    const greedyResult = await sendToGreedyAsync(greedyRequest);

    if (!greedyResult.sent) {
      console.warn(`[DRAAD-204] ⚠️  Greedy request failed: ${greedyResult.error}`);
      console.log('[DRAAD-204] === END SEND TO GREEDY (FAILED) ===');
      
      return NextResponse.json(
        {
          error: 'Roostering kon niet worden gestart',
          userMessage: greedyResult.error || 'Onbekende fout opgetreden'
        },
        { status: 500 }
      );
    }

    console.log('[DRAAD-204] ✅ Greedy request sent successfully (async)');
    console.log('[DRAAD-204] === END SEND TO GREEDY ===');

    // ========================================================================
    // PHASE 4: IMMEDIATE RESPONSE (DON'T WAIT)
    // ========================================================================
    
    console.log('[DRAAD-204] === PHASE 4: IMMEDIATE RESPONSE ===');

    const totalTime = Date.now() - startTime;

    // Update roster status to 'in_progress' (async - fire and forget)
    supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id)
      .then(() => {
        console.log('[DRAAD-204] Roster status updated: draft → in_progress');
      })
      .catch(err => {
        console.error('[DRAAD-204] Failed to update roster status:', err.message);
      });

    console.log('[DRAAD-204] ========== SUCCESS ==========');

    return NextResponse.json({
      success: true,
      roster_id,
      message: 'Greedy is aan het werk... Updates volgen live via Supabase realtime',
      greedy_status: 'running',
      frontend_instructions: {
        subscribe_to: 'roster_assignments',
        filter_by: { roster_id },
        events: ['UPDATE', 'INSERT'],
        description: 'Watch live as Greedy assigns shifts to employees'
      },
      architecture: {
        model: 'self-service',
        backend_role: 'routing only',
        greedy_role: 'autonomous (fetches data, runs algorithm, writes DB)',
        frontend_role: 'realtime monitoring via subscription'
      },
      draad204: {
        status: 'IMPLEMENTED',
        version: '1.0-FASE2',
        endpoint: GREEDY_ENDPOINT,
        timeout_ms: GREEDY_TIMEOUT,
        payload_size: 'minimal (roster_id + credentials only)',
        backend_data_fetching: 'REMOVED',
        backend_update_loop: 'REMOVED',
        async_processing: 'yes - returns immediately',
        greedy_autonomous: 'yes - runs independently',
        cache_bust_id: cacheBustId,
        message: 'Backend simplified to routing layer. Greedy is self-sufficient.'
      },
      total_time_ms: totalTime
    });

  } catch (error: any) {
    console.error('[DRAAD-204] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
