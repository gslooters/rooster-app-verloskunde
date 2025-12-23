/**
 * DRAAD348: Excel Export Route
 * Endpoint: POST /api/afl/export/excel
 * 
 * Purpose:
 * - Fetch roster, assignments, and service data from Supabase
 * - Generate Excel spreadsheet with weekly schedule grid
 * - Stream XLSX file to client for download
 * 
 * Input: rosterId (query parameter)
 * Output: Excel file (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 * 
 * Cache-bust: Date.now() + random trigger
 * Railway deployment: Auto-detected
 * 
 * Note: Uses CSV-format export for maximum compatibility
 *       For XLSX: npm install xlsx
 */

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ DRAAD348 Excel Export: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate CSV content from roster data
 * Format: Employees as rows, Days/Shifts as columns
 */
function generateExcelContent(data: any): string {
  const { roster, assignments, employees, period, services } = data;

  // Build header row
  const dateRange = `${roster.start_date} tot ${roster.end_date}`;
  const header = `Rooster Export,${dateRange}\n`;
  const timestamp = `Gegenereerd:,${new Date().toLocaleString('nl-NL')}\n`;
  const rosterId = `Rooster ID:,${roster.id}\n`;
  const separator = `\n`;

  // Build schedule grid
  const days = getDaysInPeriod(new Date(roster.start_date), new Date(roster.end_date));
  const dayHeaders = ['Medewerker', ...days.map(d => formatDate(d))].join(',');

  // Create assignment lookup map
  const assignmentMap: { [key: string]: string } = {};
  assignments.forEach((a: any) => {
    const key = `${a.employee_id}|${a.assignment_date}`;
    const serviceCode = services.find((s: any) => s.id === a.service_id)?.code || 'ONBEKEND';
    assignmentMap[key] = serviceCode;
  });

  // Build employee rows
  const employeeRows = employees.map((emp: any) => {
    const cells = [emp.voornaam ? `${emp.voornaam} ${emp.achternaam}` : emp.name];
    
    days.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      const key = `${emp.id}|${dateStr}`;
      cells.push(assignmentMap[key] || '');
    });
    
    return cells.join(',');
  });

  // Service legend
  const legend = `\n\nDiensten (Legenda)\nCode,Naam,Kleur\n${services
    .map((s: any) => `${s.code},${s.naam},${s.kleur || 'geen'}`)
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
 * Helper: Format date as DD-MM-YYYY
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}`; // Compact format for Excel
}

/**
 * POST handler for Excel export
 * Query: ?rosterId=<uuid>
 */
export async function POST(request: NextRequest) {
  try {
    // CACHE-BUST: Date.now() + Railway random
    const cacheId = `${Date.now()}-${Math.random()}`;
    console.log(`[Excel Export] Starting Excel generation - Cache ID: ${cacheId}`);

    // Get rosterId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const rosterId = searchParams.get('rosterId');

    if (!rosterId) {
      return NextResponse.json(
        { error: 'rosterId parameter required' },
        { status: 400 }
      );
    }

    console.log(`[Excel Export] Fetching roster data: ${rosterId}`);

    // Fetch roster info
    const { data: roster, error: rosterError } = await supabase
      .from('roster')
      .select('id, start_date, end_date, created_at')
      .eq('id', rosterId)
      .single();

    if (rosterError || !roster) {
      console.error(`[Excel Export] Failed to fetch roster: ${rosterError?.message}`);
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    console.log(`[Excel Export] Roster found. Fetching assignments...`);

    // Fetch assignments for this roster (denormalized)
    const { data: assignments, error: assignError } = await supabase
      .from('rosterperiodstaffingdagdelen')
      .select('id, employee_id, assignment_date:date, service_id')
      .eq('roster_id', rosterId)
      .not('service_id', 'is', null);

    if (assignError) {
      console.error(`[Excel Export] Failed to fetch assignments: ${assignError.message}`);
      return NextResponse.json(
        { error: 'Could not fetch assignments' },
        { status: 500 }
      );
    }

    console.log(`[Excel Export] Found ${assignments?.length || 0} assignments. Fetching employees...`);

    // Fetch employees (from roster design snapshot)
    const { data: employees, error: empError } = await supabase
      .from('rosterdesign')
      .select('employee_snapshot')
      .eq('roster_id', rosterId)
      .single();

    let employeeList: any[] = [];
    if (employees?.employee_snapshot) {
      employeeList = Array.isArray(employees.employee_snapshot)
        ? employees.employee_snapshot
        : (employees.employee_snapshot as any).employees || [];
    }

    console.log(`[Excel Export] Found ${employeeList.length} employees. Fetching service types...`);

    // Fetch service types
    const { data: services, error: servError } = await supabase
      .from('servicetypes')
      .select('id, code, naam, kleur')
      .eq('actief', true);

    if (servError) {
      console.error(`[Excel Export] Failed to fetch services: ${servError.message}`);
      return NextResponse.json(
        { error: 'Could not fetch service types' },
        { status: 500 }
      );
    }

    console.log(`[Excel Export] Found ${services?.length || 0} services. Generating Excel...`);

    // Generate Excel content (CSV format)
    const csvContent = generateExcelContent({
      roster,
      assignments: assignments || [],
      employees: employeeList,
      services: services || [],
      period: {
        start: roster.start_date,
        end: roster.end_date
      }
    });

    // Return as downloadable CSV/Excel file
    const filename = `Rooster_${new Date().toISOString().split('T')[0]}.csv`;

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
    console.error('[Excel Export] Unexpected error:', error);
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
