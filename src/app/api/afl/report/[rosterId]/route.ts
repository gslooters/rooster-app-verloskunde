import { NextRequest, NextResponse } from 'next/server';
import { generateAflReport, exportReportToPdf, exportReportToExcel } from '../../../../lib/afl/report-engine';
import type { AflReport } from '../../../../lib/afl/types';

/**
 * GET /api/afl/report/[rosterId]
 *
 * Generate and return AFL execution report in requested format
 *
 * Query Parameters:
 *   ?format=json   - Return JSON report (default)
 *   ?format=pdf    - Return PDF file
 *   ?format=excel  - Return Excel file
 *   ?afl_run_id=xxx - AFL Run ID (optional, generates fresh report if not provided)
 *
 * Examples:
 *   GET /api/afl/report/abc123?format=json
 *   GET /api/afl/report/abc123?format=pdf
 *   GET /api/afl/report/abc123?format=excel
 *
 * Build timestamp: ${Date.now()}
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

    // ===== GET QUERY PARAMETERS =====
    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const afl_run_id = url.searchParams.get('afl_run_id') || undefined;

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
    let report: AflReport;
    try {
      // NOTE: generateAflReport() requires full parameters object from AFL pipeline
      // In this MVP endpoint, we'll fetch a cached/stored report or generate from parameters
      // For now, we return error directing users to run AFL pipeline first

      // FUTURE: Fetch report from afl_execution_reports table if available
      // or regenerate from scratch with all required parameters

      // Placeholder: Attempt to call with minimal params (will likely fail gracefully)
      report = await generateAflReport({
        rosterId,
        afl_run_id: afl_run_id || `api-${Date.now()}`,
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
      console.error(`[AFL Report API] Generation failed for roster ${rosterId}:`, errorMsg);

      return NextResponse.json(
        {
          error: 'Report generation failed',
          message: errorMsg,
          rosterId,
          hint: 'Ensure AFL pipeline has been executed for this roster and report is stored in database',
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
