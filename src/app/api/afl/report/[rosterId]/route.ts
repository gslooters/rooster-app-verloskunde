/**
 * API Endpoint: GET /api/afl/report/[rosterId]
 * 
 * Retrieves the AFL execution report for a specific rooster.
 * Can return JSON, PDF, or Excel format based on query parameter.
 * 
 * Query Parameters:
 * - format: 'json' (default) | 'pdf' | 'excel'
 * 
 * Example:
 * GET /api/afl/report/uuid-123
 * GET /api/afl/report/uuid-123?format=pdf
 * GET /api/afl/report/uuid-123?format=excel
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exportReportToPdf, exportReportToExcel } from '@/lib/afl';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(
  request: NextRequest,
  { params }: { params: { rosterId: string } }
) {
  try {
    const { rosterId } = params;
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';

    // Validate format
    if (![' json', 'pdf', 'excel'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use json, pdf, or excel.' },
        { status: 400 }
      );
    }

    // Try to fetch latest report from database
    const { data: reportData, error: reportError } = await supabase
      .from('afl_execution_reports')
      .select('report_data')
      .eq('roster_id', rosterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If no report in DB, return error
    if (reportError || !reportData) {
      return NextResponse.json(
        {
          error: 'No AFL report found for this rooster',
          rosterId,
          hint: 'Run AFL pipeline first using POST /api/afl/execute',
        },
        { status: 404 }
      );
    }

    const report = reportData.report_data;

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json(report);
    }

    if (format === 'pdf') {
      const pdf = await exportReportToPdf(report);
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="afl-report-${rosterId}-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    }

    if (format === 'excel') {
      const excel = await exportReportToExcel(report);
      return new NextResponse(excel, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="afl-report-${rosterId}-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    // Should not reach here
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    console.error('[API] Report endpoint error:', error_message);

    return NextResponse.json(
      {
        error: 'Failed to retrieve report',
        message: error_message,
      },
      { status: 500 }
    );
  }
}