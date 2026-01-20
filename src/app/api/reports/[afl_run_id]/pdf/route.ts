/**
 * DRAAD422: PDF Route Fix - Next.js Route Segment Config
 * 
 * ROOT CAUSE (DRAAD422): Route excluded from Next.js build due to missing dynamic config
 * - Next.js 14.2.35 standalone build requires explicit 'export const dynamic' for [param] routes
 * - Without this, dynamic routes are pre-rendered at build time (impossible) → excluded from build
 * - Result: HTTP 404 at runtime even though code exists
 * 
 * SOLUTION (DRAAD422): Add Route Segment Config BEFORE any function exports
 * 
 * HISTORICAL CONTEXT:
 * - DRAAD419: AFL Rapport PDF met Ontbrekende Diensten Detail
 * - DRAAD408: PDF Rapport Field Name Fix (lowercase database fields)
 * 
 * FULL FEATURE SET:
 * 1. Valideer afl_run_id (UUID format)
 * 2. Query Supabase: afl_execution_reports + roosters join
 * 3. Extract data uit JSONB report_data (CORRECT LOWERCASE veldnamen!)
 * 4. Query missing services from roster_period_staffing_dagdelen
 * 5. Group services by date
 * 6. Generate table data for PDF
 * 7. Genereer PDF met jsPDF + autotable (samenvatting + detail)
 * 8. Return PDF met proper headers + cache-busting
 * 
 * Endpoint: GET /api/reports/{afl_run_id}/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  queryMissingServices,
  groupMissingServicesByDate,
  generateMissingServicesPdfTable,
  type MissingService
} from '@/lib/afl-missing-services-utils';

// ============================================================================
// NEXT.JS ROUTE SEGMENT CONFIGURATION
// ============================================================================
/**
 * CRITICAL: These exports MUST be present for dynamic [afl_run_id] routes
 * Without these, Next.js standalone build will EXCLUDE this route completely
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 */

/**
 * Force dynamic rendering - required for [afl_run_id] parameter
 * Without this, Next.js tries to pre-render at build time → route excluded from build
 */
export const dynamic = 'force-dynamic';

/**
 * Use full Node.js runtime - required for:
 * - jsPDF library (canvas operations)
 * - Buffer operations for PDF binary data
 * - Supabase server-side operations
 */
export const runtime = 'nodejs';

/**
 * Maximum execution time: 60 seconds
 * PDF generation with database queries can take 10-30 seconds
 * Matches API maxDuration config in next.config.js
 */
export const maxDuration = 60;

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

    console.log('━'.repeat(80));
    console.log('[PDF API] 🚀 START: PDF Generation Request (DRAAD422)');
    console.log('[PDF API] afl_run_id:', afl_run_id);
    console.log('[PDF API] Timestamp:', new Date().toISOString());
    console.log('[PDF API] 📋 Features: Samenvatting + Ontbrekende Diensten Detail');
    console.log('[PDF API] ✅ Route Segment Config: dynamic=force-dynamic, runtime=nodejs');
    console.log('━'.repeat(80));

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
    console.log('[PDF API] 🔄 Querying database for report data...');
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
      
      return NextResponse.json(
        { error: 'Rapport niet gevonden', afl_run_id },
        { status: 404 }
      );
    }

    console.log('[PDF API] ✅ Report found in database');
    console.log('[PDF API]    Report ID:', reportData.id);
    console.log('[PDF API]    Roster ID:', reportData.roster_id);

    // STEP 4: Extract data structures
    const roosterData = reportData.roosters as any;
    const report_data = reportData.report_data as any;

    console.log('[PDF API] 🔍 Analyzing report_data structure...');
    const hasSummary = report_data?.summary !== undefined;
    console.log('[PDF API]    - summary:', hasSummary ? '✅ Present' : '❌ Missing');

    // STEP 5: [DRAAD419] Query missing services
    console.log('[PDF API] 🔄 [DRAAD419] Querying missing services...');
    let missingServices: MissingService[] = [];
    let groupedMissing: any = {};
    let missingTableData: any = { head: [], body: [] };

    try {
      missingServices = await queryMissingServices(supabase, reportData.roster_id);
      console.log(`[PDF API] ✅ Found ${missingServices.length} missing services`);
      
      if (missingServices.length > 0) {
        groupedMissing = groupMissingServicesByDate(missingServices);
        missingTableData = generateMissingServicesPdfTable(groupedMissing);
        console.log(`[PDF API] ✅ Generated table data with ${Object.keys(groupedMissing).length} dates`);
      }
    } catch (missingErr) {
      const errMsg = missingErr instanceof Error ? missingErr.message : String(missingErr);
      console.warn(`[PDF API] ⚠️ Warning: Could not load missing services: ${errMsg}`);
      // Continue anyway - missing services is enhancement, not blocker
    }

    // STEP 6: Generate PDF
    console.log('[PDF API] 🔄 Generating PDF document...');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

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

    // SECTION 2: Samenvatting
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 Samenvatting', marginX, currentY);
    currentY += 7;

    const totalPlanned = safeGet(report_data, 'summary.totalplanned', 0);
    const totalRequired = safeGet(report_data, 'summary.totalrequired', 0);
    const coveragePercent = safeGet(report_data, 'summary.coveragepercent', 0);
    const totalOpen = safeGet(report_data, 'summary.totalopen', 0);
    const durationSeconds = safeGet(report_data, 'audit.durationseconds', 'N/A');
    const aflRunIdShort = afl_run_id.substring(0, 8);

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

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // SECTION 3: [DRAAD419] Detailoverzicht Ontbrekende Diensten
    console.log('[PDF API] 🔄 Adding missing services section...');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('📋 Detailoverzicht Ontbrekende Diensten', marginX, currentY);
    currentY += 7;

    if (missingServices.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('✅ Geen ontbrekende diensten - rooster is compleet!', marginX, currentY);
      currentY += 8;
    } else {
      // Generate and add table
      if (missingTableData.head.length > 0 && missingTableData.body.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: missingTableData.head,
          body: missingTableData.body,
          margin: { left: marginX, right: marginX },
          theme: 'grid',
          headStyles: {
            fillColor: [220, 53, 69],  // Red for missing services
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            textColor: 50,
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 40 },  // Date
            1: { cellWidth: 30 },  // Dagdeel
            2: { cellWidth: 35 },  // Team
            3: { cellWidth: 25 },  // Code
            4: { cellWidth: 20, halign: 'center' }  // Count
          },
          alternateRowStyles: {
            fillColor: [255, 250, 250]
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    // SECTION 4: Details
    if (currentY < 250) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ℹ️ Details', marginX, currentY);
      currentY += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Dit rapport is automatisch gegenereerd door het AFL-algoritme.', marginX, currentY);
      currentY += 5;
      doc.text('Voor meer details, bekijk het volledige rapport in de applicatie.', marginX, currentY);
    }

    // STEP 7: Generate PDF buffer
    console.log('[PDF API] ✅ PDF document generated');
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    console.log('[PDF API]    PDF size:', pdfBuffer.length, 'bytes');

    // STEP 8: Create response with cache-busting
    const filename = `afl-rapport-${aflRunIdShort}-${Date.now()}.pdf`;
    const executionTime = Date.now() - startTime;

    console.log('[PDF API] ✅ SUCCESS: PDF ready for download');
    console.log('[PDF API]    Filename:', filename);
    console.log('[PDF API]    Missing Services Count:', missingServices.length);
    console.log('[PDF API]    Execution time:', executionTime, 'ms');
    console.log('━'.repeat(80));

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
        'X-AFL-Run-Id': afl_run_id,
        'X-Missing-Services': missingServices.length.toString(),
        'X-Draad': 'DRAAD422'
      }
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error('━'.repeat(80));
    console.error('[PDF API] ❌ FATAL ERROR');
    console.error('[PDF API] Type:', error instanceof Error ? error.name : typeof error);
    console.error('[PDF API] Message:', error instanceof Error ? error.message : String(error));
    console.error('[PDF API] Execution time:', executionTime, 'ms');
    console.error('━'.repeat(80));

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
      'X-API-Version': '3.0.0-DRAAD422',
      'X-Timestamp': new Date().toISOString(),
      'X-Features': 'Samenvatting + Ontbrekende Diensten Detail',
      'X-Route-Config': 'dynamic=force-dynamic, runtime=nodejs, maxDuration=60'
    }
  });
}
