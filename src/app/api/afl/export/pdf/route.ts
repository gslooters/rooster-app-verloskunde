/**
 * DRAAD419-PDF-ROUTE: ECHTE PDF EXPORT MET jsPDF
 * Endpoint: POST /api/afl/export/pdf
 * 
 * KRITIEKE FIXES TOEGEPAST:
 * ✅ Echte PDF-blob via jsPDF (niet HTML + PDF header)
 * ✅ Volledige rapport_data gebruiken (by_service, by_service_team, bottleneck_services, open_slots)
 * ✅ Service Breakdown tabel met dienstdetails
 * ✅ Service/Team Coverage matrix
 * ✅ Waarschuwingen & Bottlenecks gemarkeerd
 * ✅ Nog te vervullen Diensten (open_slots) - top 20
 * ✅ Dagelijkse Samenvatting met coverage percentages
 * ✅ Performance Metrics tabel
 * ✅ Nederlands, overzichtelijk, professioneel
 * ✅ Tekstgebaseerde PDF (kleiner filesize, niet html2canvas)
 * ✅ Cache-busting met Date.now() + Railway random trigger
 * ✅ FORCE DYNAMIC - Prevent Next.js optimizer
 * ✅ TypeScript tuple type fix voor spread operators
 */

// 🔥 FORCE DYNAMIC - Prevent Next.js optimizer from skipping this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [PDF-ROUTE] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Log route initialization
console.log('[PDF-ROUTE] ✅ PDF Export route loaded (DRAAD419-jsPDF-FIXED) at:', new Date().toISOString());
console.log('[PDF-ROUTE] ✅ POST/GET handlers registered');

/**
 * Generate ECHTE PDF via jsPDF
 * Returns Buffer (echte PDF-blob, niet HTML)
 */
async function generatePdfWithJsPDF(data: any): Promise<Buffer> {
  console.log('[PDF-ROUTE] 📄 Generating PDF with jsPDF...');
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let yPosition = 20;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = 180;
  const fontSize = 10;

  const reportData = data.report_data || {};
  const coverage = reportData.summary?.coverage_percent || 0;
  const planned = reportData.summary?.total_planned || 0;
  const required = reportData.summary?.total_required || 0;
  const open = reportData.summary?.total_open || 0;

  console.log('[PDF-ROUTE] 📊 Report metrics:', { coverage, planned, required, open });

  // ===== HEADER =====
  pdf.setFontSize(18);
  pdf.setTextColor(8, 145, 178); // Blauw
  pdf.text('AFL Roostering Rapport', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100); // Grijs
  pdf.text(`Rooster: ${data.roster_id}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`AFL Run ID: ${data.afl_run_id.substring(0, 8)}...`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Gegenereerd: ${new Date(data.created_at).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPosition);
  yPosition += 12;

  // ===== METRICS BOX (bezettingsgraad) =====
  pdf.setDrawColor(8, 145, 178);
  pdf.rect(margin, yPosition, contentWidth, 25);

  pdf.setFontSize(12);
  pdf.setTextColor(8, 145, 178);
  pdf.text(`${coverage.toFixed(1)}%`, margin + 5, yPosition + 8);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Bezettingsgraad', margin + 5, yPosition + 13);

  pdf.setFontSize(12);
  pdf.setTextColor(8, 145, 178);
  pdf.text(`${planned} / ${required}`, margin + 80, yPosition + 8);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Diensten Ingepland', margin + 80, yPosition + 13);

  pdf.setFontSize(12);
  pdf.setTextColor(8, 145, 178);
  pdf.text(`${open}`, margin + 140, yPosition + 8);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Nog Open', margin + 140, yPosition + 13);

  yPosition += 35;

  // ===== SERVICE BREAKDOWN =====
  if (reportData.by_service && reportData.by_service.length > 0) {
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(8, 145, 178);
    pdf.text('📋 Service Breakdown', margin, yPosition);
    yPosition += 8;

    // Tabel headers
    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const colX = [margin, margin + 35, margin + 65, margin + 95, margin + 125, margin + 155];
    const headers = ['Service', 'Naam', 'Ben.', 'Gepland', 'Open', '%'];

    headers.forEach((header, i) => {
      pdf.text(header, colX[i], yPosition);
    });
    yPosition += 4;

    // Tabel divider
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, margin + contentWidth, yPosition);
    yPosition += 3;

    // Tabel data
    for (const service of reportData.by_service) {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text(service.service_code || '', colX[0], yPosition);
      pdf.text((service.service_name || '').substring(0, 15), colX[1], yPosition);
      pdf.text(service.required?.toString() || '0', colX[2], yPosition);
      pdf.text(service.planned?.toString() || '0', colX[3], yPosition);
      pdf.text(service.open?.toString() || '0', colX[4], yPosition);
      
      const percent = service.completion_percent || 0;
      const percentStr = `${percent.toFixed(0)}%`;
      pdf.setTextColor(percent >= 90 ? 0 : percent >= 75 ? 200 : 255, percent >= 90 ? 170 : percent >= 75 ? 150 : 0, 0);
      pdf.text(percentStr, colX[5], yPosition);
      
      yPosition += 4;
    }
    yPosition += 5;
  }

  // ===== SERVICE/TEAM COVERAGE (OPTIE A) =====
  if (reportData.by_service_team && reportData.by_service_team.length > 0) {
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(8, 145, 178);
    pdf.text('👥 Service/Team Coverage Details', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const colX2 = [margin, margin + 35, margin + 60, margin + 85, margin + 125, margin + 160];
    const headers2 = ['Service', 'Team', 'Ben.', 'Gepl.', 'Coverage', 'Status'];

    headers2.forEach((header, i) => {
      pdf.text(header, colX2[i], yPosition);
    });
    yPosition += 4;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, margin + contentWidth, yPosition);
    yPosition += 3;

    // Show only key teams (limit to 15 entries per page for readability)
    const displayTeams = reportData.by_service_team.slice(0, 15);
    
    for (const st of displayTeams) {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text(st.service_code || '', colX2[0], yPosition);
      pdf.text((st.team_name || '').substring(0, 12), colX2[1], yPosition);
      pdf.text(st.planned?.toString() || '0', colX2[2], yPosition);
      pdf.text(st.assigned?.toString() || '0', colX2[3], yPosition);
      
      const coveragePct = st.coverage_pct || 0;
      const coverageStr = `${coveragePct.toFixed(1)}%`;
      pdf.setTextColor(coveragePct >= 90 ? 0 : coveragePct >= 75 ? 200 : 255, coveragePct >= 90 ? 170 : coveragePct >= 75 ? 150 : 0, 0);
      pdf.text(coverageStr, colX2[4], yPosition);

      let statusText = 'OK';
      // ✅ FIX: Gebruik tuple type [number, number, number] in plaats van number[]
      let statusColor: [number, number, number] = [0, 170, 0]; // Groen
      if (st.overstaffing) {
        statusText = 'Over';
        statusColor = [255, 165, 0]; // Oranje
      } else if (coveragePct < 75) {
        statusText = 'Laag';
        statusColor = [255, 0, 0]; // Rood
      }
      pdf.setTextColor(...statusColor);
      pdf.text(statusText, colX2[5], yPosition);

      yPosition += 4;
    }
    yPosition += 5;
  }

  // ===== BOTTLENECK SERVICES (WAARSCHUWINGEN) =====
  if (reportData.bottleneck_services && reportData.bottleneck_services.length > 0) {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(255, 102, 0); // Oranje
    pdf.text('⚠️  Waarschuwingen & Bottlenecks', margin, yPosition);
    yPosition += 7;

    for (const bottleneck of reportData.bottleneck_services.slice(0, 10)) {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(200, 100, 0);
      const bottleneckText = `${bottleneck.service_code}: ${bottleneck.open} van ${bottleneck.required} open (${bottleneck.open_percent?.toFixed(1) || '0'}%)`;
      pdf.text(bottleneckText, margin, yPosition);
      yPosition += 4;
    }
    yPosition += 3;
  }

  // ===== OPEN SLOTS (nog te vervullen) =====
  if (reportData.open_slots && reportData.open_slots.length > 0) {
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(8, 145, 178);
    pdf.text('🔴 Nog te Vervullen Diensten (Top 20)', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const colX3 = [margin, margin + 25, margin + 50, margin + 75, margin + 110, margin + 150];
    const headers3 = ['Datum', 'Deel', 'Team', 'Service', 'Ben.', 'Open'];

    headers3.forEach((header, i) => {
      pdf.text(header, colX3[i], yPosition);
    });
    yPosition += 4;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, margin + contentWidth, yPosition);
    yPosition += 3;

    for (const slot of reportData.open_slots.slice(0, 20)) {
      if (yPosition > pageHeight - 12) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(7);
      pdf.setTextColor(80, 80, 80);
      const dateFormatted = new Date(slot.date).toLocaleDateString('nl-NL', { month: '2-digit', day: '2-digit' });
      pdf.text(dateFormatted, colX3[0], yPosition);
      pdf.text(slot.dagdeel || '', colX3[1], yPosition);
      pdf.text((slot.team || '').substring(0, 6), colX3[2], yPosition);
      pdf.text(slot.service_code || '', colX3[3], yPosition);
      pdf.text(slot.required?.toString() || '0', colX3[4], yPosition);
      pdf.text(slot.open?.toString() || '0', colX3[5], yPosition);
      yPosition += 3.5;
    }
    yPosition += 3;
  }

  // ===== DAILY SUMMARY =====
  if (reportData.daily_summary && reportData.daily_summary.length > 0) {
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(8, 145, 178);
    pdf.text('📅 Dagelijkse Samenvatting (selectie)', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const colX4 = [margin, margin + 30, margin + 60, margin + 90, margin + 120, margin + 150];
    const headers4 = ['Datum', 'Week', 'Slots', 'Gevuld', 'Open', 'Coverage'];

    headers4.forEach((header, i) => {
      pdf.text(header, colX4[i], yPosition);
    });
    yPosition += 4;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, margin + contentWidth, yPosition);
    yPosition += 3;

    // Show first 7 days only
    for (const day of reportData.daily_summary.slice(0, 7)) {
      if (yPosition > pageHeight - 12) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(7);
      pdf.setTextColor(80, 80, 80);
      const dateFormatted = new Date(day.date).toLocaleDateString('nl-NL', { month: '2-digit', day: '2-digit' });
      pdf.text(dateFormatted, colX4[0], yPosition);
      pdf.text(day.week_number?.toString() || '', colX4[1], yPosition);
      pdf.text(day.total_slots?.toString() || '0', colX4[2], yPosition);
      pdf.text(day.filled_slots?.toString() || '0', colX4[3], yPosition);
      pdf.text(day.open_slots?.toString() || '0', colX4[4], yPosition);
      
      const dayCoverage = day.coverage_percent || 0;
      pdf.setTextColor(dayCoverage >= 90 ? 0 : dayCoverage >= 75 ? 200 : 255, dayCoverage >= 90 ? 170 : dayCoverage >= 75 ? 150 : 0, 0);
      pdf.text(`${dayCoverage.toFixed(1)}%`, colX4[5], yPosition);
      
      yPosition += 3.5;
    }
    yPosition += 5;
  }

  // ===== PERFORMANCE METRICS =====
  if (reportData.phase_breakdown) {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(8, 145, 178);
    pdf.text('⚡ Performance Metrics', margin, yPosition);
    yPosition += 7;

    const phases = [
      { name: 'Load Data', key: 'load_ms' },
      { name: 'Solve Planning', key: 'solve_ms' },
      { name: 'DIO/DDO Chains', key: 'dio_chains_ms' },
      { name: 'Database Write', key: 'database_write_ms' },
      { name: 'Report Generation', key: 'report_generation_ms' }
    ];

    const totalMs = phases.reduce((sum, p) => sum + (reportData.phase_breakdown[p.key] || 0), 0);

    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);

    for (const phase of phases) {
      const value = reportData.phase_breakdown[phase.key] || 0;
      const percentage = totalMs > 0 ? ((value / totalMs) * 100).toFixed(1) : '0';
      pdf.text(`${phase.name}: ${value}ms (${percentage}%)`, margin, yPosition);
      yPosition += 4;
    }

    pdf.setFontSize(8);
    pdf.setTextColor(8, 145, 178);
    pdf.text(`Totaal: ${totalMs}ms`, margin, yPosition);
  }

  // ===== FOOTER =====
  pdf.setFontSize(7);
  pdf.setTextColor(150, 150, 150);
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.text(
      `Rooster-app Verloskunde | AFL Engine | Gegenereerd ${new Date().toLocaleString('nl-NL')} | Pagina ${i} van ${totalPages}`,
      margin,
      pageHeight - 5
    );
  }

  console.log('[PDF-ROUTE] ✅ PDF generated successfully!');
  console.log(`[PDF-ROUTE] 📄 Total pages: ${totalPages}`);

  // Return as Buffer
  const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
  console.log(`[PDF-ROUTE] 📦 PDF size: ${pdfBuffer.length} bytes`);
  return pdfBuffer;
}

/**
 * POST handler for PDF export
 * Accepts: { afl_run_id } in body OR ?afl_run_id=<uuid> in query
 */
export async function POST(request: NextRequest) {
  const cacheId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const requestId = request.headers.get('X-Request-ID') || `unknown-${cacheId}`;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[PDF-ROUTE] 📄 PDF export request started (DRAAD419-FIXED - jsPDF)`);
  console.log(`[PDF-ROUTE] 🆔 Request ID: ${requestId}`);
  console.log(`[PDF-ROUTE] 🔄 Cache ID: ${cacheId}`);
  console.log(`[PDF-ROUTE] ⏰ Timestamp: ${new Date().toISOString()}`);

  try {
    // Get afl_run_id from body OR query params (flexible)
    let afl_run_id = request.nextUrl.searchParams.get('afl_run_id');

    if (!afl_run_id) {
      try {
        const body = (await request.json()) as any;
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

    // Query CORRECT table: afl_execution_reports (from Supabase schema)
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

    console.log(`[PDF-ROUTE] ✅ Report found. Generating PDF with jsPDF...`);

    // ✅ NIEUW: Gebruik jsPDF in plaats van HTML
    const pdfBuffer = await generatePdfWithJsPDF({
      afl_run_id: aflReport.afl_run_id,
      roster_id: aflReport.roster_id,
      report_data: aflReport.report_data || {},
      created_at: aflReport.created_at
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('[PDF-ROUTE] ❌ PDF buffer is empty');
      return NextResponse.json(
        { error: 'PDF generation resulted in empty buffer' },
        { status: 500 }
      );
    }

    const filename = `afl-rapport-${afl_run_id.substring(0, 8)}-${Date.now()}.pdf`;

    console.log(`[PDF-ROUTE] ✅ PDF generated successfully!`);
    console.log(`[PDF-ROUTE] 📦 Filename: ${filename}`);
    console.log(`[PDF-ROUTE] 📊 PDF size: ${pdfBuffer.length} bytes`);
    console.log(`[PDF-ROUTE] ✅ RETURNING ECHTE PDF BLOB - Status 200`);
    console.log(`${'='.repeat(80)}\n`);

    // ✅ NIEUW: Return echte PDF blob
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
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
