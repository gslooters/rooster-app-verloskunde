import { NextRequest, NextResponse } from 'next/server';
import {
  generateAflReport,
  exportReportToPdf,
  exportReportToExcel,
} from '@/lib/afl';

/**
 * GET /api/afl/report/[rosterId]
 *
 * Generate and return AFL execution report in requested format
 *
 * Query Parameters:
 *   ?format=json   - Return JSON report (default)
 *   ?format=pdf    - Return PDF file
 *   ?format=excel  - Return Excel file
 *
 * Examples:
 *   GET /api/afl/report/abc123?format=json
 *   GET /api/afl/report/abc123?format=pdf
 *   GET /api/afl/report/abc123?format=excel
 */
export async function GET(
  request: NextRequest,
  context: { params: { rosterId: string } }
): Promise<NextResponse> {
  try {
    const { rosterId } = context.params;

    // ===== VALIDATE PARAMETERS =====
    if (!rosterId || typeof rosterId !== 'string' || rosterId.trim() === '') {
      return NextResponse.json(
        {
          error: 'Missing or invalid rosterId parameter',
          message: 'rosterId must be a non-empty string',
        },
        { status: 400 }
      );
    }

    // ===== GET QUERY PARAMETER =====
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();

    // ===== VALIDATE FORMAT =====
    const validFormats = ['json', 'pdf', 'excel'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        {
          error: 'Invalid format parameter',
          message: `format must be one of: ${validFormats.join(', ')}`,
          received: format,
        },
        { status: 400 }
      );
    }

    // ===== GENERATE REPORT =====
    // Use minimal required parameters - report should be pre-generated via AFL pipeline
    // This endpoint retrieves/validates existing report structure
    let report;
    try {
      // CORRECTED: generateAflReport expects object with rosterId as minimum
      // In MVP, we create a mock report from the rosterId
      // In production, this would fetch from afl_execution_reports table
      report = await generateAflReport({
        rosterId,
        afl_run_id: `api-${Date.now()}`,
        workbestand_planning: [],
        workbestand_opdracht: [],
        workbestand_capaciteit: [],
        workbestand_services_metadata: [],
        phase_timings: {
          load_ms: 0,
          solve_ms: 0,
          dio_chains_ms: 0,
          database_write_ms: 0,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[AFL Report API] Generation failed for roster ${rosterId}:`,
        errorMsg
      );

      return NextResponse.json(
        {
          error: 'Report generation failed',
          message: errorMsg,
          rosterId,
          hint: 'Ensure AFL pipeline has been executed for this roster',
        },
        { status: 500 }
      );
    }

    // ===== HANDLE JSON FORMAT =====
    if (format === 'json') {
      return NextResponse.json(report, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Report-Generated': new Date().toISOString(),
        },
      });
    }

    // ===== HANDLE PDF FORMAT =====
    if (format === 'pdf') {
      try {
        const pdfBuffer = await exportReportToPdf(report);

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `afl-report-${rosterId.substring(0, 8)}-${timestamp}.pdf`;

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Report-Generated': new Date().toISOString(),
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[AFL Report API] PDF export failed for roster ${rosterId}:`,
          errorMsg
        );

        return NextResponse.json(
          {
            error: 'PDF export failed',
            message: errorMsg,
            rosterId,
          },
          { status: 500 }
        );
      }
    }

    // ===== HANDLE EXCEL FORMAT =====
    if (format === 'excel') {
      try {
        const excelBuffer = await exportReportToExcel(report);

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `afl-report-${rosterId.substring(0, 8)}-${timestamp}.xlsx`;

        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Report-Generated': new Date().toISOString(),
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[AFL Report API] Excel export failed for roster ${rosterId}:`,
          errorMsg
        );

        return NextResponse.json(
          {
            error: 'Excel export failed',
            message: errorMsg,
            rosterId,
          },
          { status: 500 }
        );
      }
    }

    // Should never reach here (format was validated above)
    return NextResponse.json(
      { error: 'Unexpected error', message: 'Format validation failed' },
      { status: 500 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[AFL Report API] Unexpected error:', errorMsg);

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight (optional)
 * Only needed if frontend is on different domain
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
