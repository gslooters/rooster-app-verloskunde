import { NextRequest, NextResponse } from 'next/server';
import { runAflPipeline } from '@/src/lib/afl';

/**
 * 🤖 AFL (AutoFill) API Endpoint
 * 
 * DRAAD335: AFL Pipeline API Integration
 * 
 * DOEL:
 * - Execute complete AFL pipeline (FASE 1-5)
 * - Return comprehensive coverage report
 * - Store results in afl_execution_reports table
 * 
 * PIPELINE FLOW:
 * 1. FASE 1: Load data (roster + employees + services)
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

  try {
    console.log('🤖 [AFL API] AFL execution requested');

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

    // STAP 2: Run AFL Pipeline (complete FASE 1-5)
    const result = await runAflPipeline(rosterId);

    // STAP 3: Check pipeline result
    if (!result.success) {
      console.error(`❌ [AFL API] Pipeline failed for roster ${rosterId}:`, result.error);
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
    console.log(`   - Execution time: ${result.execution_time_ms}ms`);
    console.log(`   - AFL Run ID: ${result.afl_run_id}`);
    console.log(`   - Coverage: ${result.report?.summary.coverage_percent.toFixed(1)}%`);
    console.log(`   - Assigned: ${result.report?.summary.total_planned} / ${result.report?.summary.total_required}`);

    return NextResponse.json(
      {
        success: true,
        afl_run_id: result.afl_run_id,
        rosterId: result.rosterId,
        execution_time_ms: result.execution_time_ms,
        report: result.report,
        message: 'AFL execution completed successfully'
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-AFL-Run-ID': result.afl_run_id,
          'X-Execution-Time': `${result.execution_time_ms}ms`
        }
      }
    );

  } catch (error: any) {
    const totalTime = Date.now() - startTime;

    console.error('❌ [AFL API] Unexpected error:', {
      error: error.message,
      stack: error.stack,
      duration: `${totalTime}ms`
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error.stack
      },
      { status: 500 }
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
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
  );
}
