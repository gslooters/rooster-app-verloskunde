/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD-214 FIX: Make response synchronous (wait for GREEDY completion before returning)
 * 
 * CRITICAL ARCHITECTURE CHANGE:
 * BEFORE (DRAAD-204): Fire-and-forget async → Frontend gets undefined solver_result
 * AFTER (DRAAD-214):  Wait for GREEDY → Frontend gets complete solver_result ✅
 * 
 * ============================================================================
 * ROOT CAUSE ANALYSIS (DRAAD-214)
 * ============================================================================
 * 
 * THE BUG:
 * Backend was sending async request to GREEDY and returning immediately WITHOUT
 * waiting for result or including solver_result in response.
 * 
 * Frontend console error:
 *   [Dashboard] Missing solver_result in response
 *   [DRAAD129] Solver status: undefined
 * 
 * THE FIX:
 * 1. Wait for GREEDY to complete (with timeout)
 * 2. Parse GREEDY response to extract solver_result
 * 3. Return complete response WITH solver_result to frontend
 * 4. Use async/await to make this SYNCHRONOUS from frontend perspective
 * 
 * TIMING:
 * - Frontend sends POST /api/roster/solve
 * - Backend waits for GREEDY (~10-15 seconds)
 * - GREEDY completes and returns solution
 * - Backend returns complete response with solver_result
 * - Frontend receives data and renders schedule ✅
 * 
 * ============================================================================
 * KEY ARCHITECTURE CHANGES
 * ============================================================================
 * 
 * REMOVED (Fire-and-forget async):
 *   - sendToGreedyAsync() - didn't wait for response
 *   - Immediate 200 OK response without solver_result
 *   - Frontend subscription pattern (workaround for missing data)
 * 
 * ADDED (Synchronous wait):
 *   - sendToGreedySync() - waits for complete response
 *   - Parses GREEDY response for solver_result
 *   - Returns solver_result in response body ✅
 *   - Timeout protection (30 sec default)
 * 
 * IMPROVED (Error handling):
 *   - 422 validation errors now caught
 *   - 500 server errors handled
 *   - Timeout errors with clear message
 *   - User-friendly Dutch error messages
 * 
 * ============================================================================
 * DRAAD-214 DEBUG: Response Structure Logging
 * ============================================================================
 * 
 * PROBLEM:
 * GREEDY returns HTTP 200 but parsed response has undefined fields:
 *   - status: undefined
 *   - coverage: undefined
 *   - total_assignments: undefined
 * 
 * HYPOTHESIS:
 * Response structure is wrapped or transformed differently than expected.
 * Log ENTIRE response to diagnose.
 * 
 * SOLUTION:
 * 1. Log complete response.json() output as JSON string
 * 2. Log response headers (Content-Type, etc)
 * 3. Identify correct field names for extraction
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GREEDY_ENDPOINT = process.env.GREEDY_ENDPOINT ||
  'https://greedy-production.up.railway.app/api/greedy/solve';
const GREEDY_TIMEOUT = parseInt(process.env.GREEDY_TIMEOUT || '45000', 10);

console.log('[DRAAD-214] ========== GREEDY SERVICE CONFIGURATION (DRAAD-214 FIX) =========');
console.log(`[DRAAD-214] Endpoint: ${GREEDY_ENDPOINT}`);
console.log(`[DRAAD-214] Timeout: ${GREEDY_TIMEOUT}ms`);
console.log('[DRAAD-214] Model: SYNCHRONOUS WAIT (wait for completion + return solver_result)');
console.log('[DRAAD-214] =====================================================');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GreedyRequest {
  roster_id: string;
  start_date: string;
  end_date: string;
  supabase_url: string;
  supabase_key: string;
}

interface GreedyResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number;
  total_assignments: number;
  assignments_created: number;
  solution?: any; // The solver_result from GREEDY
  solver_result?: any; // Alternative field name
  message?: string;
  error?: string;
}

interface GreedyErrorDetail {
  type: string;
  userMessage: string;
  technicalDetails: string;
}

// ============================================================================
// GREEDY API CALL (SYNCHRONOUS - WAIT FOR RESPONSE)
// ============================================================================

/**
 * DRAAD-214: Send request to GREEDY and WAIT for complete response
 * This is different from DRAAD-204 which was fire-and-forget
 * 
 * Returns:
 * - { success: true, solver_result: {...} } on success
 * - { success: false, error: {...} } on failure
 */
async function sendToGreedySync(
  payload: GreedyRequest
): Promise<{ success: boolean; solver_result?: any; error?: GreedyErrorDetail }> {
  console.log('[DRAAD-214] === SENDING TO GREEDY (SYNCHRONOUS - WAIT FOR RESPONSE) ===');
  console.log(`[DRAAD-214] Endpoint: ${GREEDY_ENDPOINT}`);
  console.log(`[DRAAD-214] Roster ID: ${payload.roster_id}`);
  console.log(`[DRAAD-214] Timeout: ${GREEDY_TIMEOUT}ms`);
  console.log(`[DRAAD-214] Date range: ${payload.start_date} to ${payload.end_date}`);

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
          'User-Agent': 'rooster-app-verloskunde/DRAAD-214'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsedMs = Date.now() - startTime;

      console.log(`[DRAAD-214] GREEDY responded after ${elapsedMs}ms with HTTP ${response.status}`);
      
      // DRAAD-214 DEBUG: Log response headers
      console.log('[DRAAD-214] Response headers:');
      console.log(`[DRAAD-214]   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`[DRAAD-214]   Content-Length: ${response.headers.get('content-length')}`);

      // Try to parse response body regardless of status
      let greedyData: any = {};
      let responseText = '';
      try {
        responseText = await response.text();
        console.log(`[DRAAD-214] Raw response text (first 500 chars): ${responseText.substring(0, 500)}`);
        
        if (responseText) {
          greedyData = JSON.parse(responseText);
          console.log('[DRAAD-214] Raw response JSON parsed successfully');
          console.log(`[DRAAD-214] Response structure: ${JSON.stringify(greedyData, null, 2).substring(0, 1000)}`);
        } else {
          console.warn('[DRAAD-214] Response text is empty!');
        }
      } catch (parseError: any) {
        console.error('[DRAAD-214] ❌ JSON parse error:', parseError.message);
        console.error(`[DRAAD-214] Could not parse GREEDY response as JSON`);
        console.error(`[DRAAD-214] Raw response was: ${responseText}`);
      }

      // DRAAD-214 DEBUG: Log actual field values
      console.log('[DRAAD-214] Parsed field values:');
      console.log(`[DRAAD-214]   greedyData.status = ${greedyData.status} (type: ${typeof greedyData.status})`);
      console.log(`[DRAAD-214]   greedyData.coverage = ${greedyData.coverage} (type: ${typeof greedyData.coverage})`);
      console.log(`[DRAAD-214]   greedyData.total_assignments = ${greedyData.total_assignments} (type: ${typeof greedyData.total_assignments})`);
      console.log(`[DRAAD-214]   greedyData.solution = ${!!greedyData.solution}`);
      console.log(`[DRAAD-214]   greedyData.solver_result = ${!!greedyData.solver_result}`);
      console.log(`[DRAAD-214]   All keys: ${Object.keys(greedyData).join(', ')}`);

      // Success responses
      if (response.ok) {
        if (greedyData.status === 'SUCCESS' || greedyData.status === 'PARTIAL') {
          const solver_result = greedyData.solution || greedyData.solver_result || greedyData;
          console.log('[DRAAD-214] ✅ GREEDY successful');
          console.log(`[DRAAD-214]   - Status: ${greedyData.status}`);
          console.log(`[DRAAD-214]   - Coverage: ${greedyData.coverage}%`);
          console.log(`[DRAAD-214]   - Assignments: ${greedyData.total_assignments}`);
          console.log('[DRAAD-214] === GREEDY SUCCESS ===');

          return {
            success: true,
            solver_result: {
              status: greedyData.status,
              coverage: greedyData.coverage,
              total_assignments: greedyData.total_assignments,
              assignments_created: greedyData.assignments_created,
              message: greedyData.message,
              solution: solver_result,
              elapsed_ms: elapsedMs
            }
          };
        }
      }

      // Error responses
      console.error(`[DRAAD-214] ❌ GREEDY returned HTTP ${response.status}`);
      console.error('[DRAAD-214] Response body:', greedyData);

      // Handle different error codes
      if (response.status === 422) {
        return {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            userMessage: 'GREEDY validatiefout: request data ongeldig',
            technicalDetails: `HTTP 422: ${greedyData.error || 'Validation failed'}`
          }
        };
      }

      if (response.status === 500) {
        return {
          success: false,
          error: {
            type: 'SERVER_ERROR',
            userMessage: 'GREEDY service error. Probeer over enkele momenten opnieuw.',
            technicalDetails: `HTTP 500: ${greedyData.error || 'Internal server error'}`
          }
        };
      }

      return {
        success: false,
        error: {
          type: 'SERVER_ERROR',
          userMessage: 'GREEDY service error',
          technicalDetails: `HTTP ${response.status}: ${greedyData.error || greedyData.message || 'Unknown error'}`
        }
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error(`[DRAAD-214] ❌ GREEDY timeout after ${GREEDY_TIMEOUT}ms`);
        return {
          success: false,
          error: {
            type: 'TIMEOUT',
            userMessage: `GREEDY solver timeout (>${GREEDY_TIMEOUT / 1000}s). Probeer met minder vereisten.`,
            technicalDetails: `Timeout after ${GREEDY_TIMEOUT}ms`
          }
        };
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error('[DRAAD-214] ❌ GREEDY request failed:', error.message);

    let errorType = 'NETWORK_ERROR';
    let userMessage = 'Netwerkverbinding onderbroken';
    let details = error.message;

    if (error.code === 'ECONNREFUSED') {
      userMessage = 'GREEDY service is niet beschikbaar';
    } else if (error.code === 'ENOTFOUND') {
      userMessage = 'GREEDY service kon niet worden bereikt (DNS error)';
    } else if (error.message?.includes('timeout')) {
      errorType = 'TIMEOUT';
      userMessage = 'Aanvraag timeout - GREEDY reageert niet';
    }

    return {
      success: false,
      error: {
        type: errorType,
        userMessage,
        technicalDetails: details
      }
    };
  }
}

// ============================================================================
// MAIN ROUTE HANDLER (DRAAD-214 FIX)
// ============================================================================

/**
 * POST /api/roster/solve
 * 
 * DRAAD-214 FIX:
 * - Sends request to GREEDY
 * - WAITS for GREEDY to complete (with timeout)
 * - Returns COMPLETE response with solver_result
 * 
 * Request:  { roster_id: string }
 * Response: { success: true, solver_result: {...} } ✅ (now includes data!)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const cacheId = `DRAAD-214-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  console.log('[DRAAD-214] ========== POST /api/roster/solve ==========' )
  console.log(`[DRAAD-214] Cache ID: ${cacheId}`);
  console.log('[DRAAD-214] FIX: Return solver_result in response + wait for GREEDY completion');

  try {
    const { roster_id } = await request.json();

    if (!roster_id) {
      console.error('[DRAAD-214] Missing roster_id');
      return NextResponse.json({ error: 'roster_id is required' }, { status: 400 });
    }

    console.log(`[DRAAD-214] Roster ID: ${roster_id}`);
    const supabase = await createClient();

    // PHASE 1: Validate roster
    console.log('[DRAAD-214] === PHASE 1: VALIDATION ===');
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error('[DRAAD-214] Roster not found');
      return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
    }

    if (!roster.start_date || !roster.end_date) {
      console.error('[DRAAD-214] Roster missing dates');
      return NextResponse.json({ error: 'Roster has invalid date range' }, { status: 400 });
    }

    if (roster.status !== 'draft') {
      console.error(`[DRAAD-214] Roster status is '${roster.status}', expected 'draft'`);
      return NextResponse.json(
        { error: `Cannot schedule roster with status '${roster.status}'` },
        { status: 400 }
      );
    }

    console.log('[DRAAD-214] ✅ Roster validation passed');
    console.log('[DRAAD-214] === END VALIDATION ===');

    // PHASE 2: Build request
    console.log('[DRAAD-214] === PHASE 2: BUILD REQUEST ===');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[DRAAD-214] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server misconfiguration: missing Supabase credentials' },
        { status: 500 }
      );
    }

    const greedyRequest: GreedyRequest = {
      roster_id: roster_id.toString(),
      start_date: roster.start_date,
      end_date: roster.end_date,
      supabase_url: supabaseUrl,
      supabase_key: supabaseServiceKey
    };

    console.log('[DRAAD-214] ✅ Request built');
    console.log('[DRAAD-214] === END BUILD REQUEST ===');

    // PHASE 3: SEND TO GREEDY AND WAIT FOR RESPONSE
    console.log('[DRAAD-214] === PHASE 3: SEND TO GREEDY (SYNCHRONOUS) ===');
    const greedyResult = await sendToGreedySync(greedyRequest);

    if (!greedyResult.success) {
      console.error('[DRAAD-214] ❌ GREEDY failed');
      console.error('[DRAAD-214] Error:', greedyResult.error);
      console.log('[DRAAD-214] === PHASE 3 FAILED ===');

      return NextResponse.json(
        {
          success: false,
          error: greedyResult.error?.userMessage || 'GREEDY solver failed',
          details: greedyResult.error
        },
        { status: 500 }
      );
    }

    console.log('[DRAAD-214] ✅ GREEDY completed successfully');
    console.log('[DRAAD-214] === END PHASE 3 ===');

    // PHASE 4: Update roster status and return response
    console.log('[DRAAD-214] === PHASE 4: UPDATE ROSTER ===');

    // Update roster status to 'in_progress' or completed
    await supabase
      .from('roosters')
      .update({
        status: 'in_progress', // Could be 'completed' but keep it in_progress for now
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);

    console.log('[DRAAD-214] ✅ Roster status updated');

    const totalTime = Date.now() - startTime;
    console.log(`[DRAAD-214] === COMPLETE (${totalTime}ms) ===`);

    // PHASE 5: RETURN RESPONSE WITH SOLVER_RESULT ✅
    return NextResponse.json({
      success: true,
      roster_id,
      message: 'Roster successfully generated by GREEDY solver',
      solver_result: greedyResult.solver_result, // ✅ NOW INCLUDED!
      status: 'completed',
      metrics: {
        backend_duration_ms: totalTime,
        roster_date_range: `${roster.start_date} to ${roster.end_date}`,
        greedy_duration_ms: greedyResult.solver_result?.elapsed_ms || 0
      },
      draad: 'DRAAD-214',
      cache_id: cacheId
    });
  } catch (error: any) {
    console.error('[DRAAD-214] ❌ Unexpected error:', error.message);
    console.error('[DRAAD-214] Stack:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
        draad: 'DRAAD-214'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}
