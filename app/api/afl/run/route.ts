import { NextRequest, NextResponse } from 'next/server';

/**
 * 🤖 AFL (AutoFill) API Endpoint
 * 
 * DRAAD337: AFL Pipeline API with cache-busting
 * DRAAD335: AFL Pipeline API Integration
 * 
 * DOEL:
 * - Execute complete AFL pipeline (FASE 1-5)
 * - Return comprehensive coverage report
 * - Store results in afl_execution_reports table
 * 
 * PIPELINE FLOW:
 * 1. FASE 1: Load data (roster + employees + services)
 *    - Client-side sorting (DRAAD337 fix)
 * 2. FASE 2: Solve planning (assign services to slots)
 * 3. FASE 3: Chain validation (DIO/DDO checks)
 * 4. FASE 4: Write to database (roster_assignments)
 * 5. FASE 5: Generate report (metrics + bottlenecks)
 * 
 * PERFORMANCE:
 * - Expected: 5-7 seconds for full roster
 * - Target coverage: 87-95% (210-240 assignments)
 * 
 * REQUEST:
 * POST /api/afl/run
 * { "rosterId": "uuid-string" }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "afl_run_id": "...",
 *   "execution_time_ms": 6234,
 *   "report": { ... }
 * }
 */

// Force dynamic rendering (no cache!)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const deploymentTimestamp = '2025-12-22T21:14:00Z'; // DRAAD337 deployment marker

  try {
    console.log('🤖 [AFL API] AFL execution requested');
    console.log(`📍 [DRAAD337] Deployment version: ${deploymentTimestamp}`);
    console.log(`⏱️ [Request Start] ${new Date(startTime).toISOString()}`);

    // STAP 1: Parse request body
    let rosterId: string;
    try {
      const body = await request.json();
      rosterId = body.rosterId;

      if (!rosterId || typeof rosterId !== 'string') {
        console.error('❌ [AFL API] Invalid request: rosterId missing or invalid');
        return NextResponse.json(
          {
            success: false,
            error: 'rosterId is required and must be a string'
          },
          { status: 400 }
        );
      }
    } catch (parseError) {
      console.error('❌ [AFL API] JSON parse error:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      );
    }

    console.log(`🤖 [AFL API] Starting AFL pipeline for roster: ${rosterId}`);
    console.log(`📊 [Phase 1] Loading data from database...`);

    // STAP 2: Run AFL Pipeline (complete FASE 1-5)
    // Dynamic import to avoid Supabase env requirement during build
    const { runAflPipeline } = await import('@/src/lib/afl');

    const phase2Start = Date.now();
    const result = await runAflPipeline(rosterId);
    const phase2Duration = Date.now() - phase2Start;

    // STAP 3: Check pipeline result
    if (!result.success) {
      console.error(`❌ [AFL API] Pipeline failed for roster ${rosterId}:`);
      console.error(`   Error: ${result.error}`);
      console.error(`   Duration: ${result.execution_time_ms}ms`);
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'AFL pipeline execution failed',
          rosterId,
          execution_time_ms: result.execution_time_ms
        },
        { status: 500 }
      );
    }

    // STAP 4: Success - return complete result
    const totalTime = Date.now() - startTime;

    console.log(`✅ [AFL API] Pipeline completed successfully for roster ${rosterId}`);
    console.log(`   📈 Total execution time: ${result.execution_time_ms}ms`);
    console.log(`   🎯 AFL Run ID: ${result.afl_run_id}`);
    console.log(`   📊 Phase Timings:`);
    console.log(`      - Load: ${result.phase_timings?.load_ms}ms`);
    console.log(`      - Solve: ${result.phase_timings?.solve_ms}ms`);
    console.log(`      - Chains: ${result.phase_timings?.dio_chains_ms}ms`);
    console.log(`      - Write: ${result.phase_timings?.database_write_ms}ms`);
    console.log(`      - Report: ${result.phase_timings?.report_generation_ms}ms`);
    console.log(`   📈 Coverage: ${result.report?.summary.coverage_percent.toFixed(1)}%`);
    console.log(`   👥 Assigned: ${result.report?.summary.total_planned} / ${result.report?.summary.total_required}`);

    const cacheToken = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return NextResponse.json(
      {
        success: true,
        afl_run_id: result.afl_run_id,
        rosterId: result.rosterId,
        execution_time_ms: result.execution_time_ms,
        report: result.report,
        message: 'AFL execution completed successfully',
        deployment_version: deploymentTimestamp
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-AFL-Run-ID': result.afl_run_id,
          'X-Execution-Time': `${result.execution_time_ms}ms`,
          'X-Cache-Bust': cacheToken,
          'X-Deployment': deploymentTimestamp,
          'X-DRAAD': '337'
        }
      }
    );

  } catch (error: any) {
    const totalTime = Date.now() - startTime;

    console.error('❌ [AFL API] Unexpected error:', {
      error: error?.message ?? String(error),
      stack: error?.stack,
      duration: `${totalTime}ms`,
      draad: 'DRAAD337'
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error?.stack ?? null,
        deployment_version: '2025-12-22T21:14:00Z'
      },
      { 
        status: 500,
        headers: {
          'X-Cache-Bust': `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          'X-DRAAD': '337'
        }
      }
    );
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-DRAAD': '337'
      }
    }
  );
}