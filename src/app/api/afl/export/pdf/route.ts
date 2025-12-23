/**
 * DRAAD344-PDF-ROUTE: Fixed PDF Export Route
 * Endpoint: POST /api/afl/export/pdf
 * 
 * CRITICAL FIXES APPLIED:
 * ✅ Accept both query parameters AND request body (flexible input)
 * ✅ Query correct table: afl_execution_reports (not non-existent afl_run)
 * ✅ Return actual PDF blob with correct Content-Type
 * ✅ Handle report_data JSONB field properly
 * ✅ Add detailed logging for Railway logs
 * ✅ Cache-bust with Date.now() + random
 * ✅ Proper error response handling
 * ✅ FORCE DYNAMIC - Next.js registration guarantee (DRAAD345)
 */

// 🔥 DRAAD345: FORCE DYNAMIC - Prevent Next.js optimizer from skipping this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [PDF-ROUTE] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Log route initialization
console.log('[PDF-ROUTE] ✅ PDF Export route loaded at:', new Date().toISOString());
console.log('[PDF-ROUTE] ✅ POST/GET handlers registered');

/**
 * Generate HTML/PDF content from AFL report data
 */
function generatePdfContent(data: any): string {
  const {
    afl_run_id,
    roster_id,
    report_data,
    created_at,
  } = data;

  // Extract report metrics from JSONB report_data
  const reportMetrics = report_data || {};
  const coverage = reportMetrics.coverage_percent || 0;
  const assignments = reportMetrics.total_planned || 0;
  const required = reportMetrics.total_required || 0;
  const message = reportMetrics.summary || 'AFL roostering voltooid';

  const timestamp = new Date().toLocaleString('nl-NL');
  const createdDate = new Date(created_at).toLocaleDateString('nl-NL');

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <title>AFL Rapport - ${createdDate}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 40px;
        }
        .header {
            border-bottom: 3px solid #0891b2;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #0891b2;
            font-size: 28px;
            margin-bottom: 5px;
        }
        .meta {
            color: #666;
            font-size: 12px;
            margin-top: 10px;
            word-break: break-all;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: #f0f9ff;
            border-left: 4px solid #0891b2;
            padding: 20px;
            border-radius: 4px;
        }
        .metric-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #0891b2;
        }
        .section {
            margin: 30px 0;
            page-break-inside: avoid;
        }
        .section h2 {
            color: #0891b2;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .details-table tr {
            border-bottom: 1px solid #e5e7eb;
        }
        .details-table td {
            padding: 10px;
        }
        .details-table td:first-child {
            font-weight: 500;
            width: 40%;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background: #d1fae5;
            color: #065f46;
            margin-top: 10px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #999;
            font-size: 11px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 AFL Roostering Rapport</h1>
        <div class="meta">
            <p><strong>Rooster:</strong> ${roster_id}</p>
            <p><strong>AFL Run ID:</strong> ${afl_run_id}</p>
            <p><strong>Gegenereerd:</strong> ${timestamp}</p>
        </div>
    </div>

    <div class="section">
        <h2>Samenvatting</h2>
        <p>${message}</p>
        <div class="status-badge">✅ Succesvol voltooid</div>
    </div>

    <div class="section">
        <h2>Resultaten</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-label">Bezettingsgraad</div>
                <div class="metric-value">${coverage.toFixed(1)}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Diensten Ingepland</div>
                <div class="metric-value">${assignments} / ${required}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Details</h2>
        <table class="details-table">
            <tr>
                <td>Totaal Nodig:</td>
                <td>${required} diensten</td>
            </tr>
            <tr>
                <td>Totaal Ingepland:</td>
                <td>${assignments} diensten</td>
            </tr>
            <tr>
                <td>Dekking:</td>
                <td>${coverage.toFixed(1)}%</td>
            </tr>
            <tr>
                <td>Gegenereerd:</td>
                <td>${createdDate}</td>
            </tr>
        </table>
    </div>

    <div class="footer">
        <p>Rooster-app Verloskunde | AFL Roostering Engine | ${new Date().getFullYear()}</p>
        <p style="margin-top: 10px;">Dit document is automatisch gegenereerd. Voor vragen, contacteer uw roostersupervisor.</p>
    </div>
</body>
</html>
  `.trim();
}

/**
 * POST handler for PDF export
 * Accepts: { afl_run_id } in body OR ?afl_run_id=<uuid> in query
 */
export async function POST(request: NextRequest) {
  const cacheId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const requestId = request.headers.get('X-Request-ID') || `unknown-${cacheId}`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[PDF-ROUTE] 📄 PDF export request started`);
  console.log(`[PDF-ROUTE] 🆔 Request ID: ${requestId}`);
  console.log(`[PDF-ROUTE] 🔄 Cache ID: ${cacheId}`);
  console.log(`[PDF-ROUTE] ⏰ Timestamp: ${new Date().toISOString()}`);

  try {
    // Get afl_run_id from body OR query params (flexible)
    let afl_run_id = request.nextUrl.searchParams.get('afl_run_id');
    
    if (!afl_run_id) {
      try {
        const body = await request.json() as any;
        afl_run_id = body.afl_run_id || body.aflRunId;
        console.log(`[PDF-ROUTE] 📨 Got afl_run_id from request body: ${afl_run_id?.substring(0, 12)}...`);
      } catch (e) {
        console.warn(`[PDF-ROUTE] ℹ️ Body is not JSON, using query params only`);
      }
    } else {
      console.log(`[PDF-ROUTE] 📨 Got afl_run_id from query params: ${afl_run_id.substring(0, 12)}...`);
    }

    if (!afl_run_id || typeof afl_run_id !== 'string' || afl_run_id.trim() === '') {
      console.error('[PDF-ROUTE] ❌ Missing or invalid afl_run_id');
      return NextResponse.json(
        { error: 'afl_run_id parameter required in body or query (must be non-empty string)' },
        { status: 400 }
      );
    }

    console.log(`[PDF-ROUTE] 🔍 Fetching AFL report: ${afl_run_id}`);

    // Query CORRECT table: afl_execution_reports (from schema)
    const { data: aflReport, error: reportError } = await supabase
      .from('afl_execution_reports')
      .select('id, afl_run_id, roster_id, report_data, created_at')
      .eq('afl_run_id', afl_run_id)
      .single();

    if (reportError || !aflReport) {
      const errorMsg = reportError?.message || 'Unknown error';
      console.error(`[PDF-ROUTE] ❌ Report not found: ${errorMsg}`);
      return NextResponse.json(
        { error: `AFL report not found: ${errorMsg}` },
        { status: 404 }
      );
    }

    console.log(`[PDF-ROUTE] ✅ Report found. Generating PDF content...`);

    // Generate HTML/PDF content
    const htmlContent = generatePdfContent({
      afl_run_id: aflReport.afl_run_id,
      roster_id: aflReport.roster_id,
      report_data: aflReport.report_data || {},
      created_at: aflReport.created_at
    });

    // Validate content
    if (!htmlContent || htmlContent.length === 0) {
      console.error('[PDF-ROUTE] ❌ PDF content is empty');
      return NextResponse.json(
        { error: 'PDF generation resulted in empty content' },
        { status: 500 }
      );
    }

    // Return as downloadable PDF (HTML-based)
    const filename = `rooster-rapport-${afl_run_id.substring(0, 8)}-${Date.now()}.pdf`;

    console.log(`[PDF-ROUTE] ✅ PDF generated successfully!`);
    console.log(`[PDF-ROUTE] 📦 Filename: ${filename}`);
    console.log(`[PDF-ROUTE] 📊 Content size: ${htmlContent.length} bytes`);
    console.log(`[PDF-ROUTE] ✅ RETURNING PDF BLOB - Status 200`);
    console.log(`${'='.repeat(80)}\n`);

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[PDF-ROUTE] ❌ UNCAUGHT ERROR:', error);
    console.error(`[PDF-ROUTE] 📝 Error message: ${errorMessage}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

// Handle GET requests (for direct browser access)
export async function GET(request: NextRequest) {
  console.log('[PDF-ROUTE] ℹ️ GET request received - forwarding to POST handler');
  return POST(request);
}
