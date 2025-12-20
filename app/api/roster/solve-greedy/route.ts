/**
 * API Route: POST /api/roster/solve-greedy
 * 
 * DRAAD 185: GREEDY ENGINE INTEGRATION
 * Replaces external Solver2 (OR-Tools) with local GREEDY implementation
 * DRAAD-191: Type Fix - Aligned GREEDY status responses with handler expectations
 * DRAAD-193: Fix hardcoded localhost in GREEDY_SOLVER_URL (use env var instead)
 * DRAAD-208C: Enhanced error handling + connection validation
 * DRAAD-212: CRITICAL FIX - Initialize summary ALWAYS to prevent undefined in response
 * DRAAD-221: Database schema fix - Remove solver_runs references (table does not exist)
 * 
 * Features:
 * - 5-phase GREEDY algorithm (lock pre-planned, allocate, analyze, save, return)
 * - HC1-HC6 hard constraints
 * - 2-5 second solve time
 * - 98%+ coverage target
 * - Detailed bottleneck analysis
 * - Connection validation before solve
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DRAAD-193: Use GREEDY_SOLVER_URL environment variable
// Fallback to localhost for development, but Railway will set the production URL
const GREEDY_SOLVER_URL = process.env.GREEDY_SOLVER_URL || 'http://localhost:5000';

// DRAAD-208C: Connection validation timeout
const VALIDATION_TIMEOUT = 5000; // 5 seconds
const SOLVE_TIMEOUT = 35000;     // 35 seconds

interface SolveRequest {
  roster_id: string;
}

interface SolveResponse {
  success: boolean;
  roster_id: string;
  solver: 'GREEDY';
  solver_result: {
    status: 'success' | 'partial' | 'failed' | 'error' | 'timeout';
    assignments_created: number;
    total_required: number;
    coverage: number;
    solve_time: number;
    bottlenecks: Array<{
      date: string;
      dagdeel: string;
      service_id: string;
      need: number;
      assigned: number;
      shortage: number;
      reason?: string;
      suggestion?: string;
    }>;
    pre_planned_count: number;
    greedy_count: number;
    message: string;
    summary: {
      total_services_scheduled: number;
      coverage_percentage: number;
      unfilled_slots: number;
    };
  };
  total_time_ms: number;
}

/**
 * DRAAD-208C FIX 2: Validate solver connectivity before attempting solve
 */
async function validateSolverConnection(): Promise<{ valid: boolean; error?: string }> {
  console.log(`[DRAAD208C] Validating GREEDY solver connection to: ${GREEDY_SOLVER_URL}`);
  
  try {
    const healthCheckUrl = `${GREEDY_SOLVER_URL}/health`;
    const response = await fetch(healthCheckUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DRAAD208C] Health check failed with status ${response.status}`);
      console.error(`[DRAAD208C] Response: ${errorText}`);
      return {
        valid: false,
        error: `GREEDY solver health check failed (HTTP ${response.status}): ${errorText.substring(0, 100)}`,
      };
    }
    
    const health = await response.json();
    console.log(`[DRAAD208C] ✓ Solver health check passed:`, health);
    return { valid: true };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[DRAAD208C] ✗ Solver connection validation failed: ${errorMsg}`);
    
    if (error.name === 'AbortError') {
      return {
        valid: false,
        error: `GREEDY solver connection timeout (${VALIDATION_TIMEOUT}ms). Solver may be unreachable or overloaded.`,
      };
    }
    
    return {
      valid: false,
      error: `GREEDY solver connection error: ${errorMsg.substring(0, 150)}`,
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const executionTimestamp = new Date().toISOString();

  try {
    const { roster_id } = (await request.json()) as SolveRequest;

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is required' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD221] Starting GREEDY solve for roster ${roster_id}`);
    console.log(`[DRAAD221] Using GREEDY_SOLVER_URL: ${GREEDY_SOLVER_URL}`);

    const supabase = await createClient();

    // DRAAD-208C: Validate solver connection FIRST
    console.log('[DRAAD221] Step 1: Validating GREEDY solver connection...');
    const connectionCheck = await validateSolverConnection();
    if (!connectionCheck.valid) {
      console.error(`[DRAAD221] ✗ Solver connection invalid: ${connectionCheck.error}`);
      return NextResponse.json(
        {
          error: 'GREEDY solver unreachable',
          details: connectionCheck.error,
          solver_url: GREEDY_SOLVER_URL,
          suggestion: 'Check that the GREEDY_SOLVER_URL environment variable is correct and the solver service is running',
        },
        { status: 503 } // Service Unavailable
      );
    }
    console.log('[DRAAD221] ✓ Solver connection validated');

    // Verify roster exists and is in draft status
    console.log(`[DRAAD221] Step 2: Verifying roster ${roster_id}...`);
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error(`[DRAAD221] ✗ Roster not found: ${roster_id}`);
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    if (roster.status !== 'draft') {
      console.error(`[DRAAD221] ✗ Roster status is '${roster.status}', expected 'draft'`);
      return NextResponse.json(
        {
          error: `Roster status is '${roster.status}', must be 'draft'`,
        },
        { status: 400 }
      );
    }
    console.log(`[DRAAD221] ✓ Roster verified and in draft status`);

    console.log(`[DRAAD221] Step 3: Calling GREEDY solver service...`);

    // Call the GREEDY solver (Python service)
    const greedySolveResponse = await fetch(
      `${GREEDY_SOLVER_URL}/api/v1/solve-greedy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roster_id,
          start_date: roster.start_date,
          end_date: roster.end_date,
        }),
        signal: AbortSignal.timeout(SOLVE_TIMEOUT),
      }
    );

    if (!greedySolveResponse.ok) {
      const errorText = await greedySolveResponse.text();
      console.error(`[DRAAD221] ✗ Solver error: ${errorText}`);
      
      // DRAAD-208C: Enhanced error response
      const errorResponse = {
        error: `GREEDY solver failed with HTTP ${greedySolveResponse.status}`,
        details: errorText.substring(0, 500),
        roster_id,
        solver_url: GREEDY_SOLVER_URL,
        timestamp: executionTimestamp,
      };
      
      return NextResponse.json(
        errorResponse,
        { status: greedySolveResponse.status }
      );
    }

    const solverResult = await greedySolveResponse.json();

    console.log(`[DRAAD221] ✓ Solver result received:`);
    console.log(`  - Status: ${solverResult.status}`);
    console.log(`  - Coverage: ${solverResult.coverage}%`);
    console.log(`  - Assignments: ${solverResult.assignments_created}/${solverResult.total_required}`);
    console.log(`  - Time: ${solverResult.solve_time}s`);

    // DRAAD-212 FIX: ALWAYS initialize summary, even for failed/error states
    // This prevents undefined values in response and ensures type safety
    const totalSlots = solverResult.total_required || 0;
    const scheduledSlots = solverResult.assignments_created || 0;
    const unfilledSlots = Math.max(0, totalSlots - scheduledSlots);
    const coveragePercentage = totalSlots > 0 ? Math.round((scheduledSlots / totalSlots) * 100) : 0;

    const summary = {
      total_services_scheduled: scheduledSlots,
      coverage_percentage: coveragePercentage,
      unfilled_slots: unfilledSlots,
    };

    console.log(`[DRAAD221] ✓ Summary generated: ${scheduledSlots}/${totalSlots} (${coveragePercentage}%)`);

    // DRAAD-221 FIX: Update roster status based on solver result
    // Note: solver_runs table does NOT exist in database schema - removed all references
    if (solverResult.status === 'success' || solverResult.status === 'partial') {
      console.log(`[DRAAD221] Step 4: Updating roster status...`);
      const { error: updateError } = await supabase
        .from('roosters')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', roster_id);

      if (updateError) {
        console.warn(`[DRAAD221] Warning: Failed to update roster status: ${updateError.message}`);
      } else {
        console.log(`[DRAAD221] ✓ Roster status updated: draft → in_progress`);
      }
    }

    const totalTime = Date.now() - startTime;

    const response: SolveResponse = {
      success: solverResult.status !== 'failed' && solverResult.status !== 'error',
      roster_id,
      solver: 'GREEDY',
      solver_result: {
        status: solverResult.status,
        assignments_created: solverResult.assignments_created,
        total_required: solverResult.total_required,
        coverage: solverResult.coverage,
        solve_time: solverResult.solve_time,
        bottlenecks: solverResult.bottlenecks,
        pre_planned_count: solverResult.pre_planned_count,
        greedy_count: solverResult.greedy_count,
        message: solverResult.message,
        summary, // DRAAD-212: ALWAYS include summary - it's ALWAYS initialized now
      },
      total_time_ms: totalTime,
    };

    console.log(`[DRAAD221] ✓ Complete - Total time: ${totalTime}ms`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[DRAAD221] ✗ Error:', error);
    
    // DRAAD-208C: Distinguish between timeout and other errors
    const isTimeout = error.name === 'AbortError';
    const statusCode = isTimeout ? 504 : 500; // 504 Gateway Timeout or 500 Internal Server Error
    const errorMessage = isTimeout 
      ? `GREEDY solver solve timeout after ${SOLVE_TIMEOUT / 1000}s`
      : error.message || 'Internal server error';
    
    return NextResponse.json(
      {
        error: errorMessage,
        error_type: isTimeout ? 'timeout' : 'internal_error',
        details: error.message,
        solver_url: GREEDY_SOLVER_URL,
      },
      { status: statusCode }
    );
  }
}
