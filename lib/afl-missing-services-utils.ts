/**
 * DRAAD 419: AFL Missing Services Utilities - Shared Logic
 * 
 * Doel: Eliminator van dubbele code tussen endpoints:
 * - POST /api/afl/missing-services
 * - GET /api/reports/[afl_run_id]/pdf
 * 
 * Centraliseer alle missing services logica hier.
 * 
 * Datum: 19 januari 2026
 * Cache-bust: Date.now() + Railway random trigger
 * Build ID: DRAAD419-AFL-PDF-UITBREIDING-SHARED-UTILS
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Data structure for a single missing service
 */
export interface MissingService {
  date: string;                 // "2025-12-26"
  dagdeel: string;              // "O" | "M" | "A"
  dagdeel_display: string;      // "Ochtend" | "Middag" | "Avond"
  team: string;                 // "GRO" | "ORA" | "TOT"
  team_display: string;         // "Groen" | "Oranje" | "Praktijk"
  dienst_code: string;          // "MO", "AV", "EV", etc.
  dienst_naam: string;          // "Meteen Ochtendstart", etc.
  benodigd: number;
  ingepland: number;
  ontbrekend_aantal: number;
  status: string;
}

/**
 * Grouped missing services by date
 */
export interface GroupedMissingServices {
  [date: string]: {
    date: string;
    date_formatted: string;    // "Dinsdag 26 november 2025"
    total_missing: number;
    services: MissingService[];
  }
}

/**
 * Format Dutch date (e.g., "Dinsdag 26 november 2025")
 * 
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @returns Formatted date in Dutch locale ("Dag datum maand jaar")
 */
export function formatDutchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  
  const formatted = date.toLocaleDateString('nl-NL', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Map dagdeel code to Dutch display name
 * 
 * @param dagdeel - Code: "O" | "M" | "A"
 * @returns Display name: "Ochtend" | "Middag" | "Avond"
 */
export function getDagdeelDisplay(dagdeel: string): string {
  const mapping: { [key: string]: string } = {
    'O': 'Ochtend',
    'M': 'Middag',
    'A': 'Avond'
  };
  return mapping[dagdeel] || dagdeel;
}

/**
 * Map team code to Dutch display name
 * 
 * @param team - Code: "GRO" | "ORA" | "TOT"
 * @returns Display name: "Groen" | "Oranje" | "Praktijk"
 */
export function getTeamDisplay(team: string): string {
  const mapping: { [key: string]: string } = {
    'GRO': 'Groen',
    'ORA': 'Oranje',
    'TOT': 'Praktijk'
  };
  return mapping[team] || team;
}

/**
 * Query missing services from Supabase
 * 
 * Shared logic used by both:
 * - POST /api/afl/missing-services
 * - GET /api/reports/[afl_run_id]/pdf
 * 
 * Filter criteria:
 * - invulling = 0 (not scheduled)
 * - aantal = 1 (required)
 * - service_id IS NOT NULL
 * 
 * @param supabase - SupabaseClient instance (service role)
 * @param rosterId - UUID of the roster
 * @returns Array of missing services
 * @throws Error if database query fails
 */
export async function queryMissingServices(
  supabase: SupabaseClient,
  rosterId: string
): Promise<MissingService[]> {
  
  try {
    console.log('[AFL-UTILS] 🔍 Starting query for roster:', rosterId.substring(0, 12) + '...');
    
    // Try RPC call first (if available)
    console.log('[AFL-UTILS] 📋 Attempting RPC call: get_missing_services');
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_missing_services',
      { p_roster_id: rosterId }
    );

    if (rpcData && !rpcError) {
      console.log('[AFL-UTILS] ✅ RPC successful - got', rpcData.length, 'records');
      return rpcData;
    }
    
    if (rpcError) {
      console.warn('[AFL-UTILS] ⚠️ RPC error:', rpcError.message);
    }
  } catch (e) {
    console.log('[AFL-UTILS] 📊 RPC not available, using fallback direct query');
  }

  // Fallback: Direct query if RPC doesn't exist or fails
  console.log('[AFL-UTILS] 🔍 Executing direct database query...');
  const { data, error } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select(`
      date,
      dagdeel,
      team,
      aantal,
      invulling,
      service_id,
      status,
      service_types!inner (code, naam)
    `)
    .eq('roster_id', rosterId)
    .eq('invulling', 0)          // ✅ niet ingepland
    .eq('aantal', 1)             // ✅ benodigd
    .not('service_id', 'is', null);

  if (error) {
    console.error('[AFL-UTILS] ❌ Direct query error:', error.message);
    throw new Error(`Database query failed: ${error.message}`);
  }

  if (!data) {
    console.warn('[AFL-UTILS] ⚠️ No data returned');
    return [];
  }

  // Map and calculate
  const mapped = (data || []).map((row: any) => ({
    date: row.date,
    dagdeel: row.dagdeel,
    dagdeel_display: getDagdeelDisplay(row.dagdeel),
    team: row.team,
    team_display: getTeamDisplay(row.team),
    dienst_code: row.service_types?.code || 'ONBEKEND',
    dienst_naam: row.service_types?.naam || 'Onbekend',
    benodigd: row.aantal || 0,
    ingepland: row.invulling || 0,
    ontbrekend_aantal: (row.aantal || 0) - (row.invulling || 0),
    status: row.status || 'MAG'
  }));

  // Filter positive missing count
  const filtered = mapped.filter((m: MissingService) => m.ontbrekend_aantal > 0);
  console.log('[AFL-UTILS] ✅ Query successful - got', filtered.length, 'missing services');
  
  return filtered;
}

/**
 * Group missing services by date with formatted display
 * 
 * @param services - Array of missing services
 * @returns Object with dates as keys, grouped data as values
 */
export function groupMissingServicesByDate(
  services: MissingService[]
): GroupedMissingServices {
  const grouped: GroupedMissingServices = {};

  services.forEach((service) => {
    if (!grouped[service.date]) {
      grouped[service.date] = {
        date: service.date,
        date_formatted: formatDutchDate(service.date),
        total_missing: 0,
        services: []
      };
    }
    grouped[service.date].services.push(service);
    grouped[service.date].total_missing += service.ontbrekend_aantal;
  });

  console.log('[AFL-UTILS] ✅ Grouped into', Object.keys(grouped).length, 'date groups');
  return grouped;
}

/**
 * Generate PDF-ready table data for missing services
 * 
 * Used by jspdf-autotable for rendering a professional table
 * 
 * @param groupedServices - Grouped missing services by date
 * @returns jspdf-autotable compatible data structure
 */
export interface PdfTableData {
  head: string[][];
  body: string[][];
}

export function generateMissingServicesPdfTable(
  groupedServices: GroupedMissingServices
): PdfTableData {
  const head = [['Datum', 'Dagdeel', 'Team', 'Dienstcode', 'Benodigd']];
  const body: string[][] = [];

  // Process each date group
  Object.keys(groupedServices).sort().forEach((dateKey) => {
    const group = groupedServices[dateKey];
    
    // Add date header row
    body.push([
      group.date_formatted,
      '',
      '',
      '',
      String(group.total_missing)
    ]);

    // Add service rows for this date
    group.services.forEach((service) => {
      body.push([
        '',                            // Blank date (inherited from header)
        service.dagdeel_display,       // "Ochtend", "Middag", "Avond"
        service.team_display,          // "Groen", "Oranje", "Praktijk"
        service.dienst_code,           // "MO", "AV", "EV", etc.
        String(service.ontbrekend_aantal)
      ]);
    });
  });

  console.log('[AFL-UTILS] ✅ Generated PDF table with', body.length, 'rows');
  return { head, body };
}

/**
 * Export all utilities
 */
export const AflMissingServicesUtils = {
  formatDutchDate,
  getDagdeelDisplay,
  getTeamDisplay,
  queryMissingServices,
  groupMissingServicesByDate,
  generateMissingServicesPdfTable
};
