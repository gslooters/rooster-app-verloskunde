/**
 * DRAAD344-EXCEL-ROUTE: Fixed Excel Export Route
 * Endpoint: POST /api/afl/export/excel
 * 
 * CRITICAL FIXES APPLIED:
 * ✅ Error responses are NOW CSV format (not JSON) - fixes 404 HTML issue
 * ✅ Accept both query parameters AND request body (flexible input)
 * ✅ Use CORRECT Supabase table names from schema:
 *    - roster_assignments (not rosterperiodstaffingdagdelen)
 *    - roster_design (not rosterdesign)
 *    - service_types (not servicetypes)
 *    - roosters (not roster)
 * ✅ Return actual CSV blob with correct Content-Type
 * ✅ Add detailed logging for Railway logs
 * ✅ Cache-bust with Date.now() + random
 * ✅ CSV content validation - proper escaping
 * 
 * INPUT:
 * - Request body: { rosterId: string }
 * - OR query param: ?rosterId=<uuid>
 * 
 * OUTPUT:
 * - 200: CSV blob (Content-Type: text/csv; charset=utf-8)
 * - 400: Missing rosterId (CSV error format)
 * - 404: Roster not found (CSV error format)
 * - 500: Database or generation error (CSV error format)
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [EXCEL-ROUTE] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Log route initialization
console.log('[EXCEL-ROUTE] ✅ Excel Export route loaded at:', new Date().toISOString());
console.log('[EXCEL-ROUTE] ✅ POST/GET handlers registered');

/**
 * Helper: Escape CSV field values
 */
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Helper: Get all days in period
 */
function getDaysInPeriod(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Helper: Format date as DD-MM
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}`;
}

/**
 * Helper: Return CSV error response
 * CRITICAL: Errors must be CSV format, not JSON or HTML!
 */
function createCSVErrorResponse(statusCode: number, errorMessage: string): NextResponse {
  const csvContent = `Fout,Beschrijving\n${statusCode},"${errorMessage.replace(/"/g, '""')}"`;
  
  console.log(`[EXCEL-ROUTE] ⚠️ Returning CSV error response (${statusCode}): ${errorMessage}`);
  
  return new NextResponse(csvContent, {
    status: statusCode,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="error-${Date.now()}.csv"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Generate CSV content from roster data
 * IMPROVED: Better escaping and validation
 */
function generateExcelContent(data: any): string {
  const { roster, assignments, employees, services } = data;

  // Build header sections
  const dateRange = `${roster.start_date} tot ${roster.end_date}`;
  const header = `Rooster Export,${dateRange}\n`;
  const timestamp = `Gegenereerd:,${new Date().toLocaleString('nl-NL')}\n`;
  const rosterId = `Rooster ID:,${roster.id}\n`;
  const separator = `\n`;

  // Build date columns
  const days = getDaysInPeriod(
    new Date(roster.start_date),
    new Date(roster.end_date)
  );
  
  const dayHeaders = ['Medewerker', ...days.map(d => formatDate(d))].join(',');

  // Create assignment lookup map
  const assignmentMap: { [key: string]: string } = {};
  (assignments || []).forEach((a: any) => {
    if (!a.employee_id || !a.date) {
      console.warn(`[EXCEL-ROUTE] ⚠️ Assignment missing employee_id or date:`, a);
      return;
    }
    
    const key = `${a.employee_id}|${a.date}`;
    const service = services.find((s: any) => s.id === a.service_id);
    const serviceCode = service?.code || 'ONBEKEND';
    assignmentMap[key] = serviceCode;
  });

  console.log(`[EXCEL-ROUTE] 📊 Assignment map size: ${Object.keys(assignmentMap).length}`);

  // Build employee rows
  const employeeRows = (employees || []).map((emp: any) => {
    const name = emp.voornaam && emp.achternaam 
      ? `${emp.voornaam} ${emp.achternaam}` 
      : (emp.name || emp.id);
    
    const cells = [escapeCSV(name)];
    
    days.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      const key = `${emp.id}|${dateStr}`;
      const serviceCode = assignmentMap[key] || '';
      cells.push(escapeCSV(serviceCode));
    });
    
    return cells.join(',');
  });

  // Service legend - IMPROVED escaping
  const legendRows = (services || []).map((s: any) => 
    `${escapeCSV(s.code)},${escapeCSV(s.naam || s.code)}`
  );
  
  const legend = `\n\nDiensten (Legenda)\nCode,Naam\n${legendRows.join('\n')}`;

  // Combine all sections
  const csvContent = [
    header,
    timestamp,
    rosterId,
    separator,
    dayHeaders,
    ...employeeRows,
    legend
  ].join('\n');

  console.log(`[EXCEL-ROUTE] ✅ CSV content generated: ${csvContent.length} chars, ${employeeRows.length} employees, ${services?.length || 0} services`);

  return csvContent;
}

/**
 * POST handler for Excel export
 * Accepts: { rosterId } in body OR ?rosterId=<uuid> in query
 */
export async function POST(request: NextRequest) {
  const cacheId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const requestId = request.headers.get('X-Request-ID') || `unknown-${cacheId}`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[EXCEL-ROUTE] 📋 Excel export request started`);
  console.log(`[EXCEL-ROUTE] 🆔 Request ID: ${requestId}`);
  console.log(`[EXCEL-ROUTE] 🔄 Cache ID: ${cacheId}`);
  console.log(`[EXCEL-ROUTE] 🕐 Timestamp: ${new Date().toISOString()}`);

  try {
    // Get rosterId from body OR query params (flexible)
    let rosterId = request.nextUrl.searchParams.get('rosterId');
    
    if (!rosterId) {
      try {
        const body = await request.json() as any;
        rosterId = body.rosterId || body.roster_id;
        console.log(`[EXCEL-ROUTE] 📥 Got rosterId from request body: ${rosterId?.substring(0, 12)}...`);
      } catch (e) {
        console.warn(`[EXCEL-ROUTE] ℹ️ Body is not JSON, using query params only`);
      }
    } else {
      console.log(`[EXCEL-ROUTE] 📥 Got rosterId from query params: ${rosterId.substring(0, 12)}...`);
    }

    if (!rosterId || typeof rosterId !== 'string' || rosterId.trim() === '') {
      console.error('[EXCEL-ROUTE] ❌ Missing or invalid rosterId');
      return createCSVErrorResponse(
        400, 
        'rosterId parameter required in body or query (must be non-empty string)'
      );
    }

    console.log(`[EXCEL-ROUTE] 🔍 Fetching roster: ${rosterId}`);

    // Fetch roster using CORRECT table name: roosters (from schema)
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();

    if (rosterError || !roster) {
      const errorMsg = rosterError?.message || 'Unknown error';
      console.error(`[EXCEL-ROUTE] ❌ Roster not found: ${errorMsg}`);
      return createCSVErrorResponse(404, `Roster not found: ${errorMsg}`);
    }

    console.log(`[EXCEL-ROUTE] ✅ Roster found: ${roster.start_date} to ${roster.end_date}`);

    // Fetch assignments using CORRECT table: roster_assignments (from schema)
    console.log(`[EXCEL-ROUTE] 🔍 Fetching assignments for roster...`);
    const { data: assignments, error: assignError } = await supabase
      .from('roster_assignments')
      .select('id, employee_id, date, service_id')
      .eq('roster_id', rosterId)
      .not('service_id', 'is', null);

    if (assignError) {
      console.error(`[EXCEL-ROUTE] ❌ Failed to fetch assignments: ${assignError.message}`);
      return createCSVErrorResponse(500, `Could not fetch assignments: ${assignError.message}`);
    }

    console.log(`[EXCEL-ROUTE] ✅ Found ${assignments?.length || 0} assignments`);

    // Fetch employees from roster_design snapshot (CORRECT table)
    console.log(`[EXCEL-ROUTE] 🔍 Fetching employee snapshot...`);
    const { data: rosterDesign, error: designError } = await supabase
      .from('roster_design')
      .select('employee_snapshot')
      .eq('roster_id', rosterId)
      .single();

    let employeeList: any[] = [];
    if (rosterDesign?.employee_snapshot) {
      const snapshot = rosterDesign.employee_snapshot;
      if (Array.isArray(snapshot)) {
        employeeList = snapshot;
      } else if (snapshot && typeof snapshot === 'object' && 'employees' in snapshot) {
        employeeList = (snapshot as any).employees || [];
      }
    }

    console.log(`[EXCEL-ROUTE] ✅ Found ${employeeList.length} employees in snapshot`);

    // Fetch service types using CORRECT table: service_types (from schema)
    console.log(`[EXCEL-ROUTE] 🔍 Fetching active service types...`);
    const { data: services, error: servError } = await supabase
      .from('service_types')
      .select('id, code, naam')
      .eq('actief', true);

    if (servError) {
      console.error(`[EXCEL-ROUTE] ❌ Failed to fetch services: ${servError.message}`);
      return createCSVErrorResponse(500, `Could not fetch service types: ${servError.message}`);
    }

    console.log(`[EXCEL-ROUTE] ✅ Found ${services?.length || 0} active services`);

    // Generate CSV content
    console.log(`[EXCEL-ROUTE] 📝 Generating CSV content...`);
    const csvContent = generateExcelContent({
      roster,
      assignments: assignments || [],
      employees: employeeList,
      services: services || []
    });

    // Validate CSV content
    if (!csvContent || csvContent.length === 0) {
      console.error('[EXCEL-ROUTE] ❌ CSV content is empty');
      return createCSVErrorResponse(500, 'CSV generation resulted in empty content');
    }

    // Return as downloadable CSV file
    const filename = `rooster-planning-${rosterId.substring(0, 8)}-${Date.now()}.csv`;

    console.log(`[EXCEL-ROUTE] ✅ CSV generated successfully!`);
    console.log(`[EXCEL-ROUTE] 📦 Filename: ${filename}`);
    console.log(`[EXCEL-ROUTE] 📊 Content size: ${csvContent.length} bytes`);
    console.log(`[EXCEL-ROUTE] ✅ RETURNING CSV BLOB - Status 200`);
    console.log(`${'='.repeat(80)}\n`);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[EXCEL-ROUTE] ❌ UNCAUGHT ERROR:', error);
    console.error(`[EXCEL-ROUTE] 📝 Error message: ${errorMessage}`);
    console.error(`[EXCEL-ROUTE] 🔍 Request ID: ${requestId}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return createCSVErrorResponse(
      500,
      `Internal server error: ${errorMessage}`
    );
  }
}

// Handle GET requests (for direct browser access)
export async function GET(request: NextRequest) {
  console.log('[EXCEL-ROUTE] ℹ️ GET request received - forwarding to POST handler');
  return POST(request);
}
