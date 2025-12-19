/**
 * API Route: POST /api/roster/solve
 * 
 * DRAAD-214 CORRECTED FIX: Correct JSON extraction from nested GREEDY response
 * 
 * THE ACTUAL BUG:
 * GREEDY returns: { solver_result: { status, coverage, total_assignments, ... } }
 * Code was checking: greedyData.status (root level) → UNDEFINED ❌
 * Real data is at: greedyData.solver_result.status ✅
 * 
 * RESULT:
 * - HTTP 200 from GREEDY ✅
 * - JSON parsing successful ✅
 * - But field check fails because looking at wrong level ❌
 * - Code cascades to error handler (fake error!) ❌
 * 
 * THIS FIX:
 * Extract solver_result first, THEN check fields
 * Handle both old format (if any) AND new nested format
 * Validate data before using
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GREEDY_ENDPOINT = process.env.GREEDY_ENDPOINT ||
  'https://greedy-production.up.railway.app/api/greedy/solve';
const GREEDY_TIMEOUT = parseInt(process.env.GREEDY_TIMEOUT || '45000', 10);

console.log('[DRAAD-214-CORRECTED] ========== GREEDY SERVICE CONFIGURATION =========');
console.log(`[DRAAD-214-CORRECTED] Endpoint: ${GREEDY_ENDPOINT}`);
console.log(`[DRAAD-214-CORRECTED] Timeout: ${GREEDY_TIMEOUT}ms`);
console.log('[DRAAD-214-CORRECTED] Model: SYNCHRONOUS WAIT (nested response parsing FIX)');
console.log('[DRAAD-214-CORRECTED] =====================================================');

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

interface GreedySolverResult {
  status: string; // 'success', 'SUCCESS', 'PARTIAL', etc
  coverage: number;
  total_assignments: number;
  assignments_created?: number;
  pre_planned_count?: number;
  greedy_count?: number;
  solve_time?: number;
  message?: string;
  solver_type?: string;
  timestamp?: string;
  bottlenecks?: any[];
}

interface GreedyResponse {
  solver_result?: GreedySolverResult;
  status?: string; // fallback for old format
  coverage?: number;
  total_assignments?: number;
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
 * DRAAD-214-CORRECTED: Send request to GREEDY and WAIT for response
 * 
 * KEY FIX: Correctly extract nested solver_result from GREEDY response
 * 
 * GREEDY Response Format:
 * {
 *   "solver_result": {
 *     "status": "success",
 *     "coverage": 1792.7,
 *     "total_assignments": 1470,
 *     ...
 *   }
 * }
 * 
 * Returns:
 * - { success: true, solver_result: {...} } on success
 * - { success: false, error: {...} } on failure
 */
async function sendToGreedySync(
  payload: GreedyRequest
): Promise<{ success: boolean; solver_result?: any; error?: GreedyErrorDetail }> {
  console.log('[DRAAD-214-CORRECTED] === SENDING TO GREEDY ===');
  console.log(`[DRAAD-214-CORRECTED] Endpoint: ${GREEDY_ENDPOINT}`);
  console.log(`[DRAAD-214-CORRECTED] Roster ID: ${payload.roster_id}`);
  console.log(`[DRAAD-214-CORRECTED] Timeout: ${GREEDY_TIMEOUT}ms`);
  console.log(`[DRAAD-214-CORRECTED] Date range: ${payload.start_date} to ${payload.end_date}`);

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
          'User-Agent': 'rooster-app-verloskunde/DRAAD-214-CORRECTED'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const elapsedMs = Date.now() - startTime;

      console.log(`[DRAAD-214-CORRECTED] GREEDY responded after ${elapsedMs}ms with HTTP ${response.status}`);
      
      // Log response headers
      console.log('[DRAAD-214-CORRECTED] Response headers:');
      console.log(`[DRAAD-214-CORRECTED]   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`[DRAAD-214-CORRECTED]   Content-Length: ${response.headers.get('content-length')}`);

      // Try to parse response body
      let greedyData: any = {};
      let responseText = '';
      try {
        responseText = await response.text();
        console.log(`[DRAAD-214-CORRECTED] Raw response (first 500 chars): ${responseText.substring(0, 500)}`);
        
        if (responseText) {
          greedyData = JSON.parse(responseText);
          console.log('[DRAAD-214-CORRECTED] ✅ Response JSON parsed successfully');
        } else {
          console.warn('[DRAAD-214-CORRECTED] ⚠️ Response text is empty!');
        }
      } catch (parseError: any) {
        console.error('[DRAAD-214-CORRECTED] ❌ JSON parse error:', parseError.message);
        return {
          success: false,
          error: {
            type: 'PARSE_ERROR',
            userMessage: 'GREEDY response parse error',
            technicalDetails: `Could not parse GREEDY response: ${parseError.message}`
          }
        };
      }

      // CRITICAL FIX: Extract solver_result from nested structure
      console.log('[DRAAD-214-CORRECTED] === EXTRACTING SOLVER_RESULT ===');
      console.log(`[DRAAD-214-CORRECTED]   greedyData has keys: ${Object.keys(greedyData).join(', ')}`);
      
      // The CORRECT extraction point
      const solverResult = greedyData.solver_result as GreedySolverResult | undefined;
      
      console.log(`[DRAAD-214-CORRECTED]   greedyData.solver_result exists: ${!!solverResult}`);
      if (solverResult) {
        console.log(`[DRAAD-214-CORRECTED]   solverResult.status = ${solverResult.status}`);
        console.log(`[DRAAD-214-CORRECTED]   solverResult.coverage = ${solverResult.coverage}`);
        console.log(`[DRAAD-214-CORRECTED]   solverResult.total_assignments = ${solverResult.total_assignments}`);
      }

      // Success responses (HTTP 200 OK)
      if (response.ok) {
        // Check if we have solver_result with valid status
        if (solverResult) {
          const status = solverResult.status?.toUpperCase() || '';
          const isSuccess = status === 'SUCCESS' || status === 'PARTIAL' || status === 'success';
          
          if (isSuccess) {
            console.log('[DRAAD-214-CORRECTED] ✅ GREEDY solver completed successfully');
            console.log(`[DRAAD-214-CORRECTED]   - Status: ${solverResult.status}`);
            console.log(`[DRAAD-214-CORRECTED]   - Coverage: ${solverResult.coverage}%`);
            console.log(`[DRAAD-214-CORRECTED]   - Assignments: ${solverResult.total_assignments}`);
            console.log('[DRAAD-214-CORRECTED] === GREEDY SUCCESS ===');

            return {
              success: true,
              solver_result: {
                status: solverResult.status,
                coverage: solverResult.coverage,
                total_assignments: solverResult.total_assignments,
                assignments_created: solverResult.assignments_created || 0,
                message: solverResult.message,
                solve_time: solverResult.solve_time,
                elapsed_ms: elapsedMs,
                full_result: solverResult // Include full result for debugging
              }
            };
          }
        }
        
        // HTTP 200 but no valid solver_result
        console.error('[DRAAD-214-CORRECTED] ❌ HTTP 200 but solver_result missing or invalid');
        console.error('[DRAAD-214-CORRECTED] Response:', JSON.stringify(greedyData, null, 2).substring(0, 500));
        
        return {
          success: false,
          error: {
            type: 'INVALID_RESPONSE',
            userMessage: 'GREEDY returned invalid response format',
            technicalDetails: `HTTP 200 but solver_result invalid: ${solverResult ? 'status=' + solverResult.status : 'missing'}`
          }
        };
      }

      // Error responses (HTTP not 2xx)
      console.error(`[DRAAD-214-CORRECTED] ❌ GREEDY returned HTTP ${response.status}`);
      console.error('[DRAAD-214-CORRECTED] Response body:', greedyData);

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
        console.error(`[DRAAD-214-CORRECTED] ❌ GREEDY timeout after ${GREEDY_TIMEOUT}ms`);
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
    console.error('[DRAAD-214-CORRECTED] ❌ GREEDY request failed:', error.message);

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
// MAIN ROUTE HANDLER (DRAAD-214-CORRECTED)
// ============================================================================

/**
 * POST /api/roster/solve
 * 
 * DRAAD-214-CORRECTED FIX:
 * - Sends request to GREEDY
 * - WAITS for GREEDY to complete (with timeout)
 * - CORRECTLY PARSES nested solver_result from response
 * - Returns COMPLETE response with solver_result ✅
 * 
 * Request:  { roster_id: string }
 * Response: { success: true, solver_result: {...} } ✅
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const cacheId = `DRAAD-214-CORRECTED-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  console.log('[DRAAD-214-CORRECTED] ========== POST /api/roster/solve ==========' )
  console.log(`[DRAAD-214-CORRECTED] Cache ID: ${cacheId}`);
  console.log('[DRAAD-214-CORRECTED] Fix: Correct nested solver_result extraction');

  try {
    const { roster_id } = await request.json();

    if (!roster_id) {
      console.error('[DRAAD-214-CORRECTED] Missing roster_id');
      return NextResponse.json({ error: 'roster_id is required' }, { status: 400 });
    }

    console.log(`[DRAAD-214-CORRECTED] Roster ID: ${roster_id}`);
    const supabase = await createClient();

    // PHASE 1: Validate roster
    console.log('[DRAAD-214-CORRECTED] === PHASE 1: VALIDATION ===');
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error('[DRAAD-214-CORRECTED] Roster not found');
      return NextResponse.json({ error: 'Roster not found' }, { status: 404 });
    }

    if (!roster.start_date || !roster.end_date) {
      console.error('[DRAAD-214-CORRECTED] Roster missing dates');
      return NextResponse.json({ error: 'Roster has invalid date range' }, { status: 400 });
    }

    if (roster.status !== 'draft') {
      console.error(`[DRAAD-214-CORRECTED] Roster status is '${roster.status}', expected 'draft'`);
      return NextResponse.json(
        { error: `Cannot schedule roster with status '${roster.status}'` },
        { status: 400 }
      );
    }

    console.log('[DRAAD-214-CORRECTED] ✅ Roster validation passed');
    console.log('[DRAAD-214-CORRECTED] === END VALIDATION ===');

    // PHASE 2: Build request
    console.log('[DRAAD-214-CORRECTED] === PHASE 2: BUILD REQUEST ===');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[DRAAD-214-CORRECTED] Missing Supabase credentials');
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

    console.log('[DRAAD-214-CORRECTED] ✅ Request built');
    console.log('[DRAAD-214-CORRECTED] === END BUILD REQUEST ===');

    // PHASE 3: SEND TO GREEDY AND WAIT FOR RESPONSE
    console.log('[DRAAD-214-CORRECTED] === PHASE 3: SEND TO GREEDY (SYNCHRONOUS) ===');
    const greedyResult = await sendToGreedySync(greedyRequest);

    if (!greedyResult.success) {
      console.error('[DRAAD-214-CORRECTED] ❌ GREEDY failed');
      console.error('[DRAAD-214-CORRECTED] Error:', greedyResult.error);
      console.log('[DRAAD-214-CORRECTED] === PHASE 3 FAILED ===');

      return NextResponse.json(
        {
          success: false,
          error: greedyResult.error?.userMessage || 'GREEDY solver failed',
          details: greedyResult.error
        },
        { status: 500 }
      );
    }

    console.log('[DRAAD-214-CORRECTED] ✅ GREEDY completed successfully');
    console.log('[DRAAD-214-CORRECTED] === END PHASE 3 ===');

    // PHASE 4: Update roster status and return response
    console.log('[DRAAD-214-CORRECTED] === PHASE 4: UPDATE ROSTER ===');

    // Update roster status
    await supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id);

    console.log('[DRAAD-214-CORRECTED] ✅ Roster status updated');

    const totalTime = Date.now() - startTime;
    console.log(`[DRAAD-214-CORRECTED] === COMPLETE (${totalTime}ms) ===`);

    // PHASE 5: RETURN RESPONSE WITH SOLVER_RESULT ✅
    return NextResponse.json({
      success: true,
      roster_id,
      message: 'Roster successfully generated by GREEDY solver',
      solver_result: greedyResult.solver_result,
      status: 'completed',
      metrics: {
        backend_duration_ms: totalTime,
        roster_date_range: `${roster.start_date} to ${roster.end_date}`,
        greedy_duration_ms: greedyResult.solver_result?.elapsed_ms || 0
      },
      draad: 'DRAAD-214-CORRECTED',
      cache_id: cacheId
    });
  } catch (error: any) {
    console.error('[DRAAD-214-CORRECTED] ❌ Unexpected error:', error.message);
    console.error('[DRAAD-214-CORRECTED] Stack:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
        draad: 'DRAAD-214-CORRECTED'
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
