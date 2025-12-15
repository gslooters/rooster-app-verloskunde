/**
 * API Route: POST /api/roster/solve-greedy
 * 
 * DRAAD 185: GREEDY ENGINE INTEGRATION
 * Replaces external Solver2 (OR-Tools) with local GREEDY implementation
 * DRAAD-191: Type Fix - Aligned GREEDY status responses with handler expectations
 * DRAAD-193: Fix hardcoded localhost in GREEDY_SOLVER_URL (use env var instead)
 * 
 * Features:
 * - 5-phase GREEDY algorithm (lock pre-planned, allocate, analyze, save, return)
 * - HC1-HC6 hard constraints
 * - 2-5 second solve time
 * - 98%+ coverage target
 * - Detailed bottleneck analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DRAAD-193: Use GREEDY_SOLVER_URL environment variable
// Fallback to localhost for development, but Railway will set the production URL
const GREEDY_SOLVER_URL = process.env.GREEDY_SOLVER_URL || 'http://localhost:5000';

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
    summary?: {
      total_services_scheduled: number;
      coverage_percentage: number;
      unfilled_slots: number;
    };
  };
  total_time_ms: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const solverRunId = crypto.randomUUID();
  const executionTimestamp = new Date().toISOString();

  try {
    const { roster_id } = (await request.json()) as SolveRequest;

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is required' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD185-GREEDY] Starting GREEDY solve for roster ${roster_id}`);
    console.log(`[DRAAD193] Using GREEDY_SOLVER_URL: ${GREEDY_SOLVER_URL}`);

    const supabase = await createClient();

    // Verify roster exists and is in draft status
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error(`[DRAAD185-GREEDY] Roster not found: ${roster_id}`);
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    if (roster.status !== 'draft') {
      console.error(`[DRAAD185-GREEDY] Roster status is '${roster.status}', expected 'draft'`);
      return NextResponse.json(
        {
          error: `Roster status is '${roster.status}', must be 'draft'`,
        },
        { status: 400 }
      );
    }

    console.log(`[DRAAD185-GREEDY] Calling GREEDY solver service at ${GREEDY_SOLVER_URL}`);

    // Call the GREEDY solver (Python service or local)
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
        signal: AbortSignal.timeout(35000),
      }
    );

    if (!greedySolveResponse.ok) {
      const errorText = await greedySolveResponse.text();
      console.error(`[DRAAD185-GREEDY] Solver error: ${errorText}`);
      return NextResponse.json(
        { error: `GREEDY solver failed: ${errorText}` },
        { status: greedySolveResponse.status }
      );
    }

    const solverResult = await greedySolveResponse.json();

    console.log(`[DRAAD185-GREEDY] Solver result:`);
    console.log(`  - Status: ${solverResult.status}`);
    console.log(`  - Coverage: ${solverResult.coverage}%`);
    console.log(`  - Assignments: ${solverResult.assignments_created}/${solverResult.total_required}`);
    console.log(`  - Time: ${solverResult.solve_time}s`);

    // DRAAD-191: Compute summary for GREEDY success/partial outcomes
    // Using Optie C: No explicit null initialization, declare only when assigned
    let summary: SolveResponse['solver_result']['summary'];
    if (solverResult.status === 'success' || solverResult.status === 'partial') {
      const totalSlots = solverResult.total_required;
      const scheduledSlots = solverResult.assignments_created;
      const unfilledSlots = Math.max(0, totalSlots - scheduledSlots);
      const coveragePercentage = totalSlots > 0 ? Math.round((scheduledSlots / totalSlots) * 100) : 0;

      summary = {
        total_services_scheduled: scheduledSlots,
        coverage_percentage: coveragePercentage,
        unfilled_slots: unfilledSlots,
      };

      console.log(`[DRAAD185-GREEDY] Summary generated: ${scheduledSlots}/${totalSlots} (${coveragePercentage}%)`);
    }

    // If GREEDY succeeded, save solver run metadata
    if (solverResult.status === 'success' || solverResult.status === 'partial') {
      const { error: metadataError } = await supabase
        .from('solver_runs')
        .insert([
          {
            id: solverRunId,
            roster_id,
            status: solverResult.status,
            solver_status: solverResult.status,
            solve_time: solverResult.solve_time,
            solve_time_seconds: solverResult.solve_time,
            coverage_rate: solverResult.coverage / 100,
            total_assignments: solverResult.assignments_created,
            constraint_violations: solverResult.bottlenecks,
            solver_config: {
              algorithm: 'GREEDY',
              version: 'DRAAD185',
              max_shifts_per_employee: 8,
            },
            metadata: {
              pre_planned_count: solverResult.pre_planned_count,
              greedy_count: solverResult.greedy_count,
              bottleneck_count: solverResult.bottlenecks.length,
            },
            created_at: executionTimestamp,
            started_at: executionTimestamp,
            completed_at: new Date().toISOString(),
          },
        ]);

      if (metadataError) {
        console.warn(`[DRAAD185-GREEDY] Failed to save solver run metadata: ${metadataError.message}`);
      } else {
        console.log(`[DRAAD185-GREEDY] Solver run metadata saved: ${solverRunId}`);
      }

      // Update roster status
      const { error: updateError } = await supabase
        .from('roosters')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', roster_id);

      if (!updateError) {
        console.log(`[DRAAD185-GREEDY] Roster status updated: draft → in_progress`);
      }
    } else if (solverResult.status === 'failed') {
      // DRAAD-191: Save failed solver run for bottleneck analysis
      const { error: metadataError } = await supabase
        .from('solver_runs')
        .insert([
          {
            id: solverRunId,
            roster_id,
            status: 'completed',
            solver_status: 'failed',
            solve_time: solverResult.solve_time,
            solve_time_seconds: solverResult.solve_time,
            coverage_rate: solverResult.coverage / 100,
            total_assignments: solverResult.assignments_created,
            constraint_violations: solverResult.bottlenecks,
            solver_config: {
              algorithm: 'GREEDY',
              version: 'DRAAD185',
            },
            metadata: {
              pre_planned_count: solverResult.pre_planned_count,
              greedy_count: solverResult.greedy_count,
              bottleneck_count: solverResult.bottlenecks.length,
              reason: solverResult.message,
            },
            created_at: executionTimestamp,
            started_at: executionTimestamp,
            completed_at: new Date().toISOString(),
          },
        ]);

      if (metadataError) {
        console.warn(`[DRAAD185-GREEDY] Failed to save failed solver run: ${metadataError.message}`);
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
        summary, // DRAAD-191: Include summary for feasible outcomes
      },
      total_time_ms: totalTime,
    };

    console.log(`[DRAAD185-GREEDY] Complete - Total time: ${totalTime}ms`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[DRAAD185-GREEDY] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}