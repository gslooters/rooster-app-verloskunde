/**
 * ============================================================================
 * DRAAD419: AFL Missing Services Utilities - Shared Logic
 * ============================================================================
 *
 * PURPOSE: Extract common logic used by multiple API routes
 * - POST /api/afl/missing-services
 * - GET /api/reports/{afl_run_id}/pdf
 *
 * BENEFIT: DRY principle - single source of truth for missing services queries
 * and transformations.
 *
 * Cache-Busting: Date.now() + Railway random trigger
 * Timestamp: 20 januari 2026 21:00 CET
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Data structure for a single missing service record
 */
export interface MissingService {
  date: string;                 // "2025-12-26" (ISO date format)
  dagdeel: string;              // "O" | "M" | "A"
  dagdeel_display: string;      // "Ochtend" | "Middag" | "Avond"
  team: string;                 // "GRO" | "ORA" | "TOT"
  team_display: string;         // "Groen" | "Oranje" | "Praktijk"
  dienst_code: string;          // "MO", "AV", "EV", etc.
  dienst_naam: string;          // "Meteen Ochtendstart", etc.
  benodigd: number;             // Total required
  ingepland: number;            // Already scheduled
  ontbrekend_aantal: number;    // = benodigd - ingepland
  status: string;               // "MAG" or other constraint status
}

/**
 * Grouped data structure by date
 */
export interface DayGroupedServices {
  date: string;                 // "2025-12-26"
  date_formatted: string;       // "Dinsdag 26 december 2025"
  total_missing: number;        // Sum of ontbrekend_aantal for this date
  services: MissingService[];
}

/**
 * Format Dutch date to readable format
 * Example: "2025-12-26" -> "Dinsdag 26 december 2025"
 *
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @returns Dutch formatted date with weekday name
 */
export function formatDutchDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };

    const formatted = date.toLocaleDateString('nl-NL', options);
    // Capitalize first letter (weekday always starts lowercase in Dutch)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (error) {
    console.warn(`[AFL-UTILS] Failed to format date ${dateStr}:`, error);
    return dateStr; // Fallback to raw date string
  }
}

/**
 * Map dagdeel code to Dutch display name
 * O → Ochtend (morning)
 * M → Middag (afternoon)
 * A → Avond (evening)
 *
 * @param dagdeel Single character code
 * @returns Dutch display name
 */
export function getDagdeelDisplay(dagdeel: string): string {
  const mapping: { [key: string]: string } = {
    'O': 'Ochtend',    // ✅ Morning
    'M': 'Middag',     // ✅ Afternoon
    'A': 'Avond'       // ✅ Evening
  };
  return mapping[dagdeel] || dagdeel;
}

/**
 * Map team code to Dutch display name
 * GRO → Groen (Green Team)
 * ORA → Oranje (Orange Team)
 * TOT → Praktijk (Practice Team / Total)
 *
 * @param team Team code (usually 3 chars)
 * @returns Dutch display name
 */
export function getTeamDisplay(team: string): string {
  const mapping: { [key: string]: string } = {
    'GRO': 'Groen',     // ✅ Green Team
    'ORA': 'Oranje',    // ✅ Orange Team
    'TOT': 'Praktijk'   // ✅ Practice / Facility Team
  };
  return mapping[team] || team;
}

/**
 * Query missing services from Supabase
 * Shared logic used by both:
 * - POST /api/afl/missing-services
 * - GET /api/reports/{afl_run_id}/pdf
 *
 * ALGORITHM:
 * 1. Attempts RPC call to 'get_missing_services' (if available)
 * 2. Fallback: Direct query from roster_period_staffing_dagdelen table
 * 3. Filter: invulling = 0 (not scheduled) AND aantal = 1 (required)
 * 4. Join: service_types for service code/name
 * 5. Map: Transform to MissingService interface
 * 6. Filter: Only services with ontbrekend_aantal > 0
 *
 * @param supabase Initialized Supabase client
 * @param rosterId UUID of the roster
 * @returns Array of missing services
 * @throws Error if query fails
 */
export async function queryMissingServices(
  supabase: SupabaseClient,
  rosterId: string
): Promise<MissingService[]> {
  console.log(`[AFL-UTILS] 🔍 Starting query for roster: ${rosterId.substring(0, 12)}...`);

  try {
    // ATTEMPT 1: Try RPC call (more efficient if available)
    console.log('[AFL-UTILS] 📋 Attempting RPC call...');
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_missing_services',
      { p_roster_id: rosterId }
    );

    if (rpcData && !rpcError) {
      console.log(`[AFL-UTILS] ✅ RPC successful - got ${rpcData.length} records`);
      return rpcData;
    }

    if (rpcError) {
      console.warn(`[AFL-UTILS] ⚠️ RPC error: ${rpcError.message}`);
    }
  } catch (rpcErr) {
    console.log('[AFL-UTILS] 📊 RPC not available, using fallback direct query');
  }

  // ATTEMPT 2: Fallback to direct query
  console.log('[AFL-UTILS] 🔍 Executing direct database query...');

  try {
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
      .eq('invulling', 0)          // ✅ Not scheduled
      .eq('aantal', 1)             // ✅ Required (aantal = 1 slot needed)
      .not('service_id', 'is', null);

    if (error) {
      console.error(`[AFL-UTILS] ❌ Direct query error: ${error.message}`);
      throw error;
    }

    if (!data) {
      console.warn('[AFL-UTILS] ⚠️ No data returned from direct query');
      return [];
    }

    console.log(`[AFL-UTILS] ✅ Direct query successful - got ${data.length} records`);

    // Transform data
    const mapped = (data || []).map((row: any) => {
      const benodigd = row.aantal || 0;
      const ingepland = row.invulling || 0;
      const ontbrekend_aantal = benodigd - ingepland;

      return {
        date: row.date,
        dagdeel: row.dagdeel,
        dagdeel_display: getDagdeelDisplay(row.dagdeel),
        team: row.team,
        team_display: getTeamDisplay(row.team),
        dienst_code: row.service_types?.code || 'ONBEKEND',
        dienst_naam: row.service_types?.naam || 'Onbekend',
        benodigd,
        ingepland,
        ontbrekend_aantal,
        status: row.status || 'MAG'
      };
    });

    // Filter: only positive missing amounts
    const filtered = mapped.filter((m: MissingService) => m.ontbrekend_aantal > 0);

    console.log(`[AFL-UTILS] 📊 Filtered to ${filtered.length} rows with ontbrekend > 0`);
    return filtered;
  } catch (directErr) {
    const errorMsg = directErr instanceof Error ? directErr.message : String(directErr);
    console.error(`[AFL-UTILS] ❌ Direct query failed: ${errorMsg}`);
    throw new Error(`Database query failed: ${errorMsg}`);
  }
}

/**
 * Group missing services by date
 * Sorts services within each date by dagdeel (O→M→A) and team
 *
 * ALGORITHM:
 * 1. Initialize grouped object
 * 2. For each service:
 *    - Create date key if not exists
 *    - Format date to Dutch format
 *    - Add service to date group
 *    - Accumulate total_missing count
 * 3. Return grouped object ready for iteration
 *
 * @param services Array of missing services
 * @returns Object with dates as keys, DayGroupedServices as values
 */
export function groupMissingServicesByDate(
  services: MissingService[]
): { [date: string]: DayGroupedServices } {
  const grouped: { [date: string]: DayGroupedServices } = {};

  services.forEach((service) => {
    const dateKey = service.date;

    // Initialize date group if not exists
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        date_formatted: formatDutchDate(dateKey),
        total_missing: 0,
        services: []
      };
    }

    // Add service to group
    grouped[dateKey].services.push(service);
    grouped[dateKey].total_missing += service.ontbrekend_aantal;
  });

  // Sort within each date group
  Object.values(grouped).forEach((dayGroup) => {
    dayGroup.services.sort((a, b) => {
      // First by dagdeel: O → M → A
      const dagdeelOrder: { [key: string]: number } = { 'O': 1, 'M': 2, 'A': 3 };
      const aDagdeel = dagdeelOrder[a.dagdeel] || 99;
      const bDagdeel = dagdeelOrder[b.dagdeel] || 99;

      if (aDagdeel !== bDagdeel) return aDagdeel - bDagdeel;

      // Then by team
      if (a.team !== b.team) return a.team.localeCompare(b.team);

      // Then by dienst_code
      return (a.dienst_code || '').localeCompare(b.dienst_code || '');
    });
  });

  console.log(`[AFL-UTILS] ✅ Grouped into ${Object.keys(grouped).length} dates`);
  return grouped;
}

/**
 * Generate PDF table data structure for jsPDF-autotable
 * Used by PDF generation route
 *
 * ALGORITHM:
 * 1. Create table headers
 * 2. For each date group:
 *    - Add date summary row (total count)
 *    - Add individual service rows
 * 3. Apply cell styling (colors per dagdeel)
 * 4. Return jsPDF-autotable compatible structure
 *
 * @param groupedServices Output from groupMissingServicesByDate
 * @returns Object with head and body arrays for autoTable
 */
export function generateMissingServicesPdfTable(
  groupedServices: { [date: string]: DayGroupedServices }
): { head: string[][]; body: (string | number)[][] } {
  const head = [['Datum', 'Dagdeel', 'Team', 'Dienstcode', 'Benodigd']];
  const body: (string | number)[][] = [];

  // Iterate through dates (already sorted by Object.keys = ISO date order)
  Object.entries(groupedServices).forEach(([date, dayData]) => {
    // Day summary row
    body.push([
      dayData.date_formatted,
      '',
      '',
      '',
      dayData.total_missing
    ]);

    // Individual service rows
    dayData.services.forEach((service) => {
      body.push([
        '',
        service.dagdeel_display,
        service.team_display,
        service.dienst_code,
        service.ontbrekend_aantal
      ]);
    });
  });

  return { head, body };
}

/**
 * Validate roster ID format (basic UUID check)
 * @param rosterId String to validate
 * @returns True if valid UUID format
 */
export function isValidRosterId(rosterId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(rosterId);
}
