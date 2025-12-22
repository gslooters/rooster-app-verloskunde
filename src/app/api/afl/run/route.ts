import { NextRequest, NextResponse } from 'next/server';
import { runAflPipeline } from '@/lib/afl/afl-engine';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { rosterId } = await request.json();

    if (!rosterId) {
      return NextResponse.json(
        { error: 'rosterId is required' },
        { status: 400 }
      );
    }

    console.log('[AFL API] Starting AFL pipeline for roster:', rosterId);
    const result = await runAflPipeline(rosterId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'AFL pipeline failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      afl_run_id: result.afl_run_id,
      report: result.report,
      message: 'AFL execution completed successfully'
    });

  } catch (error) {
    console.error('[AFL API] Execution failed:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
