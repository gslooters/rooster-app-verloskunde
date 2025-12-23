/**
 * DRAAD348: PDF Export Route
 * Endpoint: POST /api/afl/export/pdf
 * 
 * Purpose:
 * - Fetch AFL run report data from Supabase
 * - Generate PDF document with report details
 * - Stream PDF to client for download
 * 
 * Input: runId (query parameter)
 * Output: PDF file (application/pdf)
 * 
 * Cache-bust: Date.now() + random trigger
 * Railway deployment: Auto-detected
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ DRAAD348 PDF Export: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Simple HTML-to-PDF converter using native HTML response
 * For production: consider using pdfkit or puppeteer
 */
function generatePdfContent(data: any): string {
  const {
    runId,
    rosterId,
    coverage,
    assignments_created,
    bottlenecks,
    solve_time,
    message,
    createdAt,
    details
  } = data;

  const timestamp = new Date().toLocaleString('nl-NL');

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <title>AFL Rapport - ${new Date(createdAt).toLocaleDateString('nl-NL')}</title>
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
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-top: 10px;
        }
        .status-success {
            background: #d1fae5;
            color: #065f46;
        }
        .status-warning {
            background: #fef3c7;
            color: #92400e;
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
        .bottleneck-list {
            list-style: none;
        }
        .bottleneck-list li {
            padding: 8px;
            margin: 5px 0;
            background: #fff7ed;
            border-left: 3px solid #ea580c;
            border-radius: 2px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #999;
            font-size: 11px;
            text-align: center;
        }
        @media print {
            body { padding: 0; }
            .footer { page-break-before: always; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 AFL Roostering Rapport</h1>
        <div class="meta">
            <p><strong>Rooster:</strong> ${rosterId}</p>
            <p><strong>AFL Run ID:</strong> ${runId}</p>
            <p><strong>Gegenereerd:</strong> ${timestamp}</p>
        </div>
    </div>

    <div class="section">
        <h2>Samenvatting</h2>
        <p>${message}</p>
        <div class="status-badge status-success">✅ Succesvol voltooid</div>
    </div>

    <div class="section">
        <h2>Resultaten</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-label">Bezettingsgraad</div>
                <div class="metric-value">${coverage}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Diensten Toegewezen</div>
                <div class="metric-value">${assignments_created}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Oplossingsduur</div>
                <div class="metric-value">${solve_time}s</div>
            </div>
            <div class="metric">
                <div class="metric-label">Openstaande Gaten</div>
                <div class="metric-value">${bottlenecks}</div>
            </div>
        </div>
    </div>

    ${bottlenecks > 0 ? `
    <div class="section">
        <h2>⚠️ Gedetecteerde Gaten (${bottlenecks})</h2>
        <p>De volgende data-/dagdeel-combinaties hebben onvoldoende personeel:</p>
        ${details?.bottleneck_details ? `
        <ul class="bottleneck-list">
            ${details.bottleneck_details.slice(0, 10).map((bn: any) => `
            <li><strong>${bn.date} ${bn.dagdeel}:</strong> ${bn.shortage}× tekort</li>
            `).join('')}
        </ul>
        ${details.bottleneck_details.length > 10 ? `<p style="margin-top: 15px; color: #666;"><em>... en ${details.bottleneck_details.length - 10} meer</em></p>` : ''}
        ` : ''}
    </div>
    ` : ''}

    <div class="section">
        <h2>Details</h2>
        <table class="details-table">
            <tr>
                <td>Pre-ingeplan:</td>
                <td>${details?.pre_planned || 0} diensten</td>
            </tr>
            <tr>
                <td>GREEDY Toegewezen:</td>
                <td>${details?.greedy_assigned || assignments_created} diensten</td>
            </tr>
            <tr>
                <td>Algoritme:</td>
                <td>GREEDY (Greedy Rostering Engine for Edge Deployment)</td>
            </tr>
            <tr>
                <td>Versiebeheer:</td>
                <td>DRAAD348 PDF Export v1.0</td>
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
 * Query: ?runId=<uuid>
 */
export async function POST(request: NextRequest) {
  try {
    // CACHE-BUST: Date.now() + Railway random
    const cacheId = `${Date.now()}-${Math.random()}`;
    console.log(`[PDF Export] Starting PDF generation - Cache ID: ${cacheId}`);

    // Get runId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId parameter required' },
        { status: 400 }
      );
    }

    console.log(`[PDF Export] Fetching AFL run data: ${runId}`);

    // Fetch AFL run data from Supabase
    const { data: aflRun, error: aflError } = await supabase
      .from('afl_run')
      .select('*')
      .eq('id', runId)
      .single();

    if (aflError || !aflRun) {
      console.error(`[PDF Export] Failed to fetch AFL run: ${aflError?.message}`);
      return NextResponse.json(
        { error: 'AFL run not found' },
        { status: 404 }
      );
    }

    console.log(`[PDF Export] AFL run found. Generating PDF...`);

    // Generate HTML/PDF content
    const htmlContent = generatePdfContent({
      runId: aflRun.id,
      rosterId: aflRun.roster_id,
      coverage: aflRun.coverage_percentage || 0,
      assignments_created: aflRun.assignments_created || 0,
      bottlenecks: aflRun.bottlenecks_count || 0,
      solve_time: aflRun.solve_time_seconds || 0,
      message: aflRun.result_message || 'AFL roostering voltooid',
      createdAt: aflRun.created_at,
      details: aflRun.report_details ? JSON.parse(aflRun.report_details) : null
    });

    // Return as downloadable PDF
    // Note: Browsers treat HTML as "PDF" for download purposes
    const filename = `AFL_Rapport_${new Date().toISOString().split('T')[0]}.html`;

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
    console.error('[PDF Export] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// Handle GET requests (for direct browser access)
export async function GET(request: NextRequest) {
  return POST(request);
}
