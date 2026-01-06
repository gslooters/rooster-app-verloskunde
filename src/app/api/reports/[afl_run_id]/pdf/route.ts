/**
 * DRAAD 406: PDF RAPPORT EXPORT ENDPOINT
 * FIX: TypeScript strict mode - setFont() parameter type
 * 
 * Endpoint: GET /api/reports/{afl_run_id}/pdf
 * 
 * FUNCTIONALITY:
 * 1. Validate afl_run_id (UUID format)
 * 2. Query Supabase: afl_execution_reports + roosters join
 * 3. Generate PDF with jsPDF
 * 4. Return PDF with proper headers
 * 5. Error handling: 400 (invalid), 404 (not found), 500 (server)
 * 6. Cache-busting via headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Initialize Supabase client with service role key (for backend queries)
const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key);
};

export async function GET(
  request: NextRequest,
  { params }: { params: { afl_run_id: string } }
) {
  try {
    const { afl_run_id } = params;

    console.log(`[PDF API] Processing request for afl_run_id: ${afl_run_id}`);

    // 1. Validate UUID format
    if (!isValidUUID(afl_run_id)) {
      console.error(`[PDF API] Invalid UUID format: ${afl_run_id}`);
      return NextResponse.json(
        { error: 'Invalid afl_run_id format' },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase client
    const supabase = getSupabaseClient();

    // 3. Query database: afl_execution_reports + roosters join
    const { data: reportData, error: reportError } = await supabase
      .from('afl_execution_reports')
      .select(
        `
        id,
        roster_id,
        afl_run_id,
        report_data,
        created_at,
        roosters!inner(
          id,
          start_date,
          end_date,
          status,
          created_at
        )
      `
      )
      .eq('afl_run_id', afl_run_id)
      .single();

    if (reportError || !reportData) {
      console.error(`[PDF API] Report not found for afl_run_id: ${afl_run_id}`, reportError);
      return NextResponse.json(
        { error: 'Rapport niet gevonden' },
        { status: 404 }
      );
    }

    console.log(`[PDF API] Report found, generating PDF...`);

    // 4. Extract data
    const roosterData = reportData.roosters as any;
    const report_data = reportData.report_data as any;

    // 5. Generate PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set margins
    const marginX = 15;
    const marginY = 15;
    let currentY = marginY;

    // Add title
    doc.setFontSize(20);
    doc.setFont('', 'bold');
    doc.text('ROOSTER-BEWERKING RAPPORT', marginX, currentY);
    currentY += 12;

    // Add date
    doc.setFontSize(10);
    doc.setFont('', 'normal');
    doc.text(`Gegenereerd: ${new Date().toLocaleDateString('nl-NL')}`, marginX, currentY);
    currentY += 8;

    // Add separator
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, currentY, 210 - marginX, currentY);
    currentY += 5;

    // Rooster Period Section
    doc.setFontSize(12);
    doc.setFont('', 'bold');
    doc.text('Rooster Periode', marginX, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('', 'normal');

    const startDate = new Date(roosterData.start_date).toLocaleDateString('nl-NL');
    const endDate = new Date(roosterData.end_date).toLocaleDateString('nl-NL');

    doc.text(`Van: ${startDate}`, marginX, currentY);
    currentY += 5;
    doc.text(`Tot: ${endDate}`, marginX, currentY);
    currentY += 5;
    doc.text(`Status: ${roosterData.status}`, marginX, currentY);
    currentY += 8;

    // Metrics Section
    doc.setFontSize(12);
    doc.setFont('', 'bold');
    doc.text('Resultaten', marginX, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('', 'normal');

    // Create metrics table
    const metricsData = [
      ['Metric', 'Waarde'],
      ['Bezettingsgraad', `${report_data.bezettingsgraad}%`],
      ['Diensten ingepland', `${report_data.diensten_ingepland}/${report_data.diensten_totaal}`],
      ['Uitvoeringsduur', report_data.uitvoeringsduur || 'N/A'],
      ['AFL Run ID', afl_run_id.substring(0, 8) + '...'],
      ['Gegenereerd op', new Date(reportData.created_at).toLocaleString('nl-NL')]
    ];

    autoTable(doc, {
      startY: currentY,
      head: [metricsData[0]],
      body: metricsData.slice(1),
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        textColor: 50,
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 'auto', halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    // 6. Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // 7. Create response with proper headers
    const filename = `rapport-${afl_run_id.substring(0, 8)}-${new Date().getTime()}.pdf`;

    console.log(`[PDF API] PDF generated successfully: ${filename}`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Generated-At': new Date().toISOString(),
        'X-Cache-Bust': Date.now().toString()
      }
    });
  } catch (error) {
    console.error('[PDF API] Fatal error:', error);

    return NextResponse.json(
      { error: 'PDF generatie mislukt', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD(
  request: NextRequest,
  { params }: { params: { afl_run_id: string } }
) {
  return NextResponse.json({ status: 'ok' });
}
