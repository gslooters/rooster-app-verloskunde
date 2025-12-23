/**
 * DRAAD344-EXCEL-ROUTE: Fixed Excel Export Route
 * Endpoint: POST /api/afl/export/excel
 * 
 * FIXES APPLIED:
 * ✅ Accept both query parameters AND request body (flexible input)
 * ✅ Use CORRECT Supabase table names from schema:
 *    - roster_assignments (not rosterperiodstaffingdagdelen)
 *    - roster_design (not rosterdesign)
 *    - service_types (not servicetypes)
 *    - roosters (not roster)
 * ✅ Return actual CSV blob with correct Content-Type
 * ✅ Add detailed logging for Railway logs
 * ✅ Cache-bust with Date.now() + random
 * 
 * INPUT:
 * - Request body: { rosterId: string }
 * - OR query param: ?rosterId=<uuid>
 * 
 * OUTPUT:
 * - 200: CSV blob (Content-Type: text/csv)
 * - 400: Missing rosterId
 * - 404: Roster not found
 * - 500: Database or generation error
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [DRAAD344-EXCEL-ROUTE] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Log route initialization
console.log('[DRAAD344-EXCEL-ROUTE] ✅ Excel Export route loaded at:', new Date().toISOString());
console.log('[DRAAD344-EXCEL-ROUTE] ✅ POST handler registered');

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
 * Generate CSV content from roster data
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
  assignments.forEach((a: any) => {
    const key = `${a.employee_id}|${a.date}`;
    const serviceCode = services.find((s: any) => s.id === a.service_id)?.code || 'ONBEKEND';
    assignmentMap[key] = serviceCode;
  });

  // Build employee rows
  const employeeRows = employees.map((emp: any) => {
    const name = emp.voornaam && emp.achternaam 
      ? `${emp.voornaam} ${emp.achternaam}` 
      : (emp.name || emp.id);
    
    const cells = [name];
    
    days.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      const key = `${emp.id}|${dateStr}`;
      cells.push(assignmentMap[key] || '');
    });
    
    return cells.join(',');
  });

  // Service legend
  const legend = `\n\nDiensten (Legenda)\nCode,Naam\n${services
    .map((s: any) => `"${s.code}","${s.naam || s.code}"`)
    .join('\n')}`;

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

  return csvContent;
}

/**
 * POST handler for Excel export
 * Accepts: { rosterId } in body OR ?rosterId=<uuid> in query
 */
export async function POST(request: NextRequest) {
  const cacheId = `${Date.now()}-${Math.random()}`;
  console.log(`[DRAAD344-EXCEL-ROUTE] 📋 Starting Excel generation - Cache ID: ${cacheId}`);

  try {
    // Get rosterId from body OR query params (flexible)
    let rosterId = request.nextUrl.searchParams.get('rosterId');
    
    if (!rosterId) {
      try {
        const body = await request.json() as any;
        rosterId = body.rosterId || body.roster_id;
      } catch (e) {
        // Body is not JSON, that's OK
      }
    }

    if (!rosterId) {
      console.error('[DRAAD344-EXCEL-ROUTE] ❌ Missing rosterId in body or query');
      return NextResponse.json(
        { error: 'rosterId parameter required in body or query' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD344-EXCEL-ROUTE] 🔍 Fetching roster: ${rosterId}`);

    // Fetch roster using CORRECT table name: roosters (from schema)
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();

    if (rosterError || !roster) {
      console.error(`[DRAAD344-EXCEL-ROUTE] ❌ Roster not found: ${rosterError?.message}`);
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    console.log(`[DRAAD344-EXCEL-ROUTE] ✅ Roster found. Fetching assignments...`);

    // Fetch assignments using CORRECT table: roster_assignments (from schema)
    const { data: assignments, error: assignError } = await supabase
      .from('roster_assignments')
      .select('id, employee_id, date, service_id')
      .eq('roster_id', rosterId)
      .not('service_id', 'is', null);

    if (assignError) {
      console.error(`[DRAAD344-EXCEL-ROUTE] ❌ Failed to fetch assignments: ${assignError.message}`);
      return NextResponse.json(
        { error: 'Could not fetch assignments' },
        { status: 500 }
      );
    }

    console.log(`[DRAAD344-EXCEL-ROUTE] ✅ Found ${assignments?.length || 0} assignments. Fetching employees...`);

    // Fetch employees from roster_design snapshot (CORRECT table)
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

    console.log(`[DRAAD344-EXCEL-ROUTE] ✅ Found ${employeeList.length} employees. Fetching service types...`);

    // Fetch service types using CORRECT table: service_types (from schema)
    const { data: services, error: servError } = await supabase
      .from('service_types')
      .select('id, code, naam')
      .eq('actief', true);

    if (servError) {
      console.error(`[DRAAD344-EXCEL-ROUTE] ❌ Failed to fetch services: ${servError.message}`);
      return NextResponse.json(
        { error: 'Could not fetch service types' },
        { status: 500 }
      );
    }

    console.log(`[DRAAD344-EXCEL-ROUTE] ✅ Found ${services?.length || 0} services. Generating CSV...`);

    // Generate CSV content
    const csvContent = generateExcelContent({
      roster,
      assignments: assignments || [],
      employees: employeeList,
      services: services || []
    });

    // Return as downloadable CSV file
    const filename = `rooster-planning-${rosterId.substring(0, 8)}-${Date.now()}.csv`;

    console.log(`[DRAAD344-EXCEL-ROUTE] ✅ CSV generated successfully. Returning blob.`);

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
    console.error('[DRAAD344-EXCEL-ROUTE] ❌ Unexpected error:', error);
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
