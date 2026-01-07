/**
 * DRAAD 408: PDF RAPPORT FIELD NAME FIX - LOWERCASE SCHEMA MATCH
 * 
 * ROOT CAUSE: Database uses lowercase field names, API expected camelCase
 * FIX: Updated all field access to match actual database schema
 * 
 * Endpoint: GET /api/reports/{afl_run_id}/pdf
 * 
 * FUNCTIONALITEIT:
 * 1. Valideer afl_run_id (UUID format)
 * 2. Query Supabase: afl_execution_reports + roosters join
 * 3. Extract data uit JSONB report_data (CORRECT LOWERCASE veldnamen!)
 * 4. Genereer PDF met jsPDF + autotable
 * 5. Return PDF met proper headers + cache-busting
 * 
 * DATA STRUCTUUR (VERIFIED from database):
 * - summary.totalplanned: aantal geplande diensten (LOWERCASE!)
 * - summary.totalrequired: totaal benodigde diensten (LOWERCASE!)
 * - summary.coveragepercent: bezettingsgraad % (LOWERCASE!)
 * - summary.totalopen: open slots (LOWERCASE!)
 * - audit.durationseconds: uitvoeringsduur (LOWERCASE!)
 * - audit.aflrunid: AFL run identificatie (LOWERCASE!)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Validate UUID format (RFC 4122) */
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/** Initialize Supabase client with service role (backend-only) */
const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[PDF API] ❌ Missing Supabase credentials');
    console.error('[PDF API]    - NEXT_PUBLIC_SUPABASE_URL:', url ? '✅ Set' : '❌ Missing');
    console.error('[PDF API]    - SUPABASE_SERVICE_ROLE_KEY:', key ? '✅ Set' : '❌ Missing');
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key);
};

/** Safe data extraction with fallback */
function safeGet(obj: any, path: string, fallback: any = 'N/A'): any {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? fallback;
  } catch {
    return fallback;
  }
}

// ============================================================================
// MAIN API ROUTE HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { afl_run_id: string } }
) {
  const startTime = Date.now();
  
  try {
    const { afl_run_id } = params;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[PDF API] 🚀 START: PDF Generation Request');
    console.log('[PDF API] afl_run_id:', afl_run_id);
    console.log('[PDF API] Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // STEP 1: Validate UUID format
    if (!isValidUUID(afl_run_id)) {
      console.error('[PDF API] ❌ VALIDATION FAILED: Invalid UUID format');
      console.error('[PDF API]    Input:', afl_run_id);
      return NextResponse.json(
        { error: 'Invalid afl_run_id format', provided: afl_run_id },
        { status: 400 }
      );
    }
    console.log('[PDF API] ✅ UUID validation passed');

    // STEP 2: Initialize Supabase client
    console.log('[PDF API] 🔄 Initializing Supabase client...');
    const supabase = getSupabaseClient();
    console.log('[PDF API] ✅ Supabase client initialized');

    // STEP 3: Query database with detailed logging
    console.log('[PDF API] 🔄 Querying database...');
    console.log('[PDF API]    Table: afl_execution_reports');
    console.log('[PDF API]    Join: roosters (inner)');
    console.log('[PDF API]    Filter: afl_run_id =', afl_run_id);

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

    // Enhanced error logging
    if (reportError) {
      console.error('[PDF API] ❌ DATABASE ERROR:', reportError);
      console.error('[PDF API]    Code:', reportError.code);
      console.error('[PDF API]    Message:', reportError.message);
      console.error('[PDF API]    Details:', reportError.details);
      console.error('[PDF API]    Hint:', reportError.hint);
      
      return NextResponse.json(
        { 
          error: 'Database query failed', 
          details: reportError.message,
          afl_run_id 
        },
        { status: 404 }
      );
    }

    if (!reportData) {
      console.error('[PDF API] ❌ NO DATA: Report not found');
      console.error('[PDF API]    afl_run_id:', afl_run_id);
      console.error('[PDF API]    Possible causes:');
      console.error('[PDF API]      - Record does not exist');
      console.error('[PDF API]      - Foreign key join failed (roosters)');
      console.error('[PDF API]      - RLS policy blocking read');
      
      return NextResponse.json(
        { error: 'Rapport niet gevonden', afl_run_id },
        { status: 404 }
      );
    }

    console.log('[PDF API] ✅ Report found in database');
    console.log('[PDF API]    Report ID:', reportData.id);
    console.log('[PDF API]    Roster ID:', reportData.roster_id);
    console.log('[PDF API]    Created at:', reportData.created_at);

    // STEP 4: Extract and validate data structure
    const roosterData = reportData.roosters as any;
    const report_data = reportData.report_data as any;

    console.log('[PDF API] 🔍 Analyzing report_data structure...');
    console.log('[PDF API]    Keys present:', Object.keys(report_data || {}));
    
    // Log critical data availability
    const hasSummary = report_data?.summary !== undefined;
    const hasAudit = report_data?.audit !== undefined;
    console.log('[PDF API]    - summary:', hasSummary ? '✅ Present' : '❌ Missing');
    console.log('[PDF API]    - audit:', hasAudit ? '✅ Present' : '❌ Missing');

    if (hasSummary) {
      console.log('[PDF API]    Summary data (LOWERCASE schema):');
      console.log('[PDF API]      - totalplanned:', report_data.summary.totalplanned);
      console.log('[PDF API]      - totalrequired:', report_data.summary.totalrequired);
      console.log('[PDF API]      - coveragepercent:', report_data.summary.coveragepercent);
      console.log('[PDF API]      - totalopen:', report_data.summary.totalopen);
    }

    // STEP 5: Generate PDF with CORRECT LOWERCASE field names
    console.log('[PDF API] 🔄 Generating PDF document...');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Layout configuration
    const marginX = 15;
    const marginY = 15;
    let currentY = marginY;

    // TITLE
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AFL ROOSTER-BEWERKING RAPPORT', marginX, currentY);
    currentY += 12;

    // Subtitle with date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gegenereerd: ${new Date().toLocaleDateString('nl-NL', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, marginX, currentY);
    currentY += 8;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, currentY, 210 - marginX, currentY);
    currentY += 8;

    // SECTION 1: Rooster Periode
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('📅 Rooster Periode', marginX, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const startDate = new Date(roosterData.start_date).toLocaleDateString('nl-NL');
    const endDate = new Date(roosterData.end_date).toLocaleDateString('nl-NL');

    doc.text(`Van: ${startDate}`, marginX, currentY);
    currentY += 5;
    doc.text(`Tot: ${endDate}`, marginX, currentY);
    currentY += 5;
    doc.text(`Status: ${roosterData.status}`, marginX, currentY);
    currentY += 10;

    // SECTION 2: Samenvatting (using CORRECT LOWERCASE field names)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 Samenvatting', marginX, currentY);
    currentY += 7;

    // ✅ DRAAD408 FIX: Use LOWERCASE field names matching database schema
    const totalPlanned = safeGet(report_data, 'summary.totalplanned', 0);
    const totalRequired = safeGet(report_data, 'summary.totalrequired', 0);
    const coveragePercent = safeGet(report_data, 'summary.coveragepercent', 0);
    const totalOpen = safeGet(report_data, 'summary.totalopen', 0);
    const durationSeconds = safeGet(report_data, 'audit.durationseconds', 'N/A');
    const aflRunIdShort = afl_run_id.substring(0, 8);

    console.log('[PDF API] 📊 Extracted values (FIXED):');
    console.log('[PDF API]    - totalPlanned:', totalPlanned);
    console.log('[PDF API]    - totalRequired:', totalRequired);
    console.log('[PDF API]    - coveragePercent:', coveragePercent);
    console.log('[PDF API]    - totalOpen:', totalOpen);

    const metricsData = [
      ['Metric', 'Waarde'],
      ['Bezettingsgraad', `${coveragePercent}%`],
      ['Diensten ingepland', `${totalPlanned}/${totalRequired}`],
      ['Open slots', `${totalOpen}`],
      ['Uitvoeringsduur', typeof durationSeconds === 'number' ? `${durationSeconds.toFixed(2)}s` : durationSeconds],
      ['AFL Run ID', `${aflRunIdShort}...`],
      ['Rapport aangemaakt', new Date(reportData.created_at).toLocaleString('nl-NL')]
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
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        textColor: 50,
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: 'auto', halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    // Update currentY after table
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // SECTION 3: Details (if space available)
    if (currentY < 250) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ℹ️ Details', marginX, currentY);
      currentY += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dit rapport is automatisch gegenereerd door het AFL-algoritme.`, marginX, currentY);
      currentY += 5;
      doc.text(`Voor meer details, bekijk het volledige rapport in de applicatie.`, marginX, currentY);
    }

    // STEP 6: Generate PDF buffer
    console.log('[PDF API] ✅ PDF document generated');
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('[PDF API]    PDF size:', pdfBuffer.length, 'bytes');

    // STEP 7: Create response with headers + cache-busting
    const filename = `afl-rapport-${aflRunIdShort}-${Date.now()}.pdf`;
    const executionTime = Date.now() - startTime;

    console.log('[PDF API] ✅ SUCCESS: PDF ready for download');
    console.log('[PDF API]    Filename:', filename);
    console.log('[PDF API]    Execution time:', executionTime, 'ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Generated-At': new Date().toISOString(),
        'X-Cache-Bust': Date.now().toString(),
        'X-Execution-Time-Ms': executionTime.toString(),
        'X-Report-Id': reportData.id,
        'X-AFL-Run-Id': afl_run_id
      }
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[PDF API] ❌ FATAL ERROR');
    console.error('[PDF API] Type:', error instanceof Error ? error.name : typeof error);
    console.error('[PDF API] Message:', error instanceof Error ? error.message : String(error));
    console.error('[PDF API] Stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[PDF API] Execution time:', executionTime, 'ms');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json(
      { 
        error: 'PDF generatie mislukt', 
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 * Allows testing if route is accessible
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: { afl_run_id: string } }
) {
  console.log('[PDF API] HEAD request received for:', params.afl_run_id);
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Route-Status': 'OK',
      'X-API-Version': '1.0.0',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
