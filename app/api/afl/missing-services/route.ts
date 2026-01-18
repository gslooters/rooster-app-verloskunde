/**
 * AFL Missing Services Detail Endpoint
 * Endpoint: POST /api/afl/missing-services
 * 
 * OPDRACHT: AFL Rapport Uitbreiding - Ontbrekende Diensten Detail
 * Datum: 13 januari 2026
 * 
 * ============================================================
 * DRAAD418 FIX - 18 januari 2026 21:30 CET
 * Cache-Bust: 1737283800
 * Railway Trigger: FORCE-REBUILD-MISSING-SERVICES-DRAAD418
 * Issue: AFL Query had foutieve filter criteria + verkeerde mappings
 * Fix: Correcte SQL filter (invulling=0 AND aantal=1) + Dutch mappings
 * Implementation: Direct Supabase query met correcte joins en filters
 * ============================================================
 * 
 * FUNCTIONALITEIT:
 * ✅ Build-safe: Credentials validated at runtime only, not at build
 * ✅ Query ontbrekende diensten uit roster_period_staffing_dagdelen
 * ✅ Filter: invulling=0 (niet ingepland) EN aantal=1 (benodigd)
 * ✅ Join met service_types voor dienstcodes en namen
 * ✅ Nederlandse mappings: O=Ochtend, M=Middag, A=Avond
 * ✅ Team mappings: GRO=Groen, ORA=Oranje, TOT=Praktijk
 * ✅ Groupeer per datum met subtotalen
 * ✅ Correcte sortering: datum → dagdeel (O→M→A) → team
 * ✅ Return gestructureerde JSON response met alle details
 * 
 * INPUT:
 *   { "roster_id": "uuid" }
 * 
 * OUTPUT:
 *   {
 *     "success": true,
 *     "roster_id": "uuid",
 *     "total_missing": 8,
 *     "missing_services": [...],
 *     "grouped_by_date": { ... }
 *   }
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse, NextRequest } from 'next/server';

// DRAAD418: Lazy Supabase initialization
let supabaseClient: any = null;
let initError: string | null = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (initError) throw new Error(initError);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured in Railway environment');
    }

    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    console.log('[MISSING-SERVICES] ✅ Supabase client initialized at runtime');
    return supabaseClient;
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error('[MISSING-SERVICES] ❌ Supabase initialization failed:', initError);
    throw error;
  }
}

// DRAAD418: Enhanced startup logging for deployment verification
const DRAAD418_BUILD_ID = 'DRAAD418-AFL-SQL-FIX-1737283800';
const DRAAD418_DEPLOY_TIMESTAMP = '2026-01-18T21:30:00Z';

console.log('\n' + '='.repeat(80));
console.log('🚀 [DRAAD418] MISSING SERVICES API ROUTE LOADED');
console.log('📍 [DRAAD418] Route path: /api/afl/missing-services');
console.log('📂 [DRAAD418] File location: app/api/afl/missing-services/route.ts');
console.log('⏰ [DRAAD418] Load timestamp:', new Date().toISOString());
console.log('🔖 [DRAAD418] Build ID:', DRAAD418_BUILD_ID);
console.log('📅 [DRAAD418] Deploy timestamp:', DRAAD418_DEPLOY_TIMESTAMP);
console.log('🏗️  [DRAAD418] Runtime: nodejs + force-dynamic');
console.log('🔄 [DRAAD418] Supabase: Lazy initialization (build-safe)');
console.log('✅ [DRAAD418] SQL Filter: invulling=0 AND aantal=1 ✅');
console.log('✅ [DRAAD418] Dagdeel mapping: O=Ochtend, M=Middag, A=Avond ✅');
console.log('✅ [DRAAD418] Team mapping: GRO=Groen, ORA=Oranje, TOT=Praktijk ✅');
console.log('✅ [DRAAD418] Route ready for runtime requests!');
console.log('='.repeat(80) + '\n');

/**
 * Helper: Format date to Dutch format (e.g., "Dinsdag 26 november 2025")
 */
function formatDutchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  
  const formatted = date.toLocaleDateString('nl-NL', options);
  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Helper: Get dagdeel display name (CORRECT MAPPING)
 */
function getDagdeelDisplay(dagdeel: string): string {
  const mapping: { [key: string]: string } = {
    'O': 'Ochtend',    // ✅ CORRECT: O = Ochtend
    'M': 'Middag',     // ✅ CORRECT: M = Middag
    'A': 'Avond'       // ✅ CORRECT: A = Avond
  };
  return mapping[dagdeel] || dagdeel;
}

/**
 * Helper: Get team display name
 */
function getTeamDisplay(team: string): string {
  const mapping: { [key: string]: string } = {
    'GRO': 'Groen',     // ✅ Team Groen
    'ORA': 'Oranje',    // ✅ Team Oranje
    'TOT': 'Praktijk'   // ✅ Praktijk (totaal)
  };
  return mapping[team] || team;
}

/**
 * Query missing services from database
 * DRAAD418: Correcte SQL filter: invulling=0 AND aantal=1
 */
async function queryMissingServices(rosterId: string) {
  const supabase = getSupabaseClient();
  
  console.log(`[MISSING-SERVICES] 🔍 Starting query for roster: ${rosterId.substring(0, 12)}...`);
  
  try {
    // Try RPC call first
    console.log('[MISSING-SERVICES] 📋 Attempting RPC call...');
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_missing_services',
      { p_roster_id: rosterId }
    );

    if (rpcError) {
      console.warn(`[MISSING-SERVICES] ⚠️ RPC error: ${rpcError.message}`);
      throw new Error(`RPC failed: ${rpcError.message}`);
    }

    if (rpcData) {
      console.log(`[MISSING-SERVICES] ✅ RPC successful - got ${rpcData.length} records`);
      return rpcData;
    }
  } catch (rpcErr) {
    console.log(`[MISSING-SERVICES] 📊 RPC not available, using fallback direct query`);
  }

  // Fallback: Direct SQL query if RPC doesn't exist
  // DRAAD418 FIX: Correcte filter criteria
  try {
    console.log('[MISSING-SERVICES] 🔍 Executing direct database query...');
    
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
      .eq('invulling', 0)          // ✅ DRAAD418: Niet ingepland
      .eq('aantal', 1)             // ✅ DRAAD418: Benodigd aantal = 1
      .not('service_id', 'is', null);

    if (error) {
      console.error(`[MISSING-SERVICES] ❌ Direct query error: ${error.message}`);
      throw error;
    }

    if (!data) {
      console.warn('[MISSING-SERVICES] ⚠️ No data returned from direct query');
      return [];
    }

    console.log(`[MISSING-SERVICES] ✅ Direct query successful - got ${data.length} records`);

    // Calculate missing and filter
    const filtered = (data || []).map((row: any) => {
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
    }).filter((r: any) => r.ontbrekend_aantal > 0);

    console.log(`[MISSING-SERVICES] 📊 Filtered to ${filtered.length} rows with ontbrekend > 0`);
    return filtered;
  } catch (directErr) {
    const errorMsg = directErr instanceof Error ? directErr.message : String(directErr);
    console.error(`[MISSING-SERVICES] ❌ Direct query failed: ${errorMsg}`);
    throw new Error(`Database query failed: ${errorMsg}`);
  }
}

/**
 * POST handler for missing services query
 */
export async function POST(request: NextRequest) {
  const cacheId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[MISSING-SERVICES] 📋 Missing services request started`);
  console.log(`[MISSING-SERVICES] 🔄 Cache ID: ${cacheId}`);
  console.log(`[MISSING-SERVICES] 🕐 Timestamp: ${new Date().toISOString()}`);
  console.log(`[DRAAD418] 🔖 Build ID: ${DRAAD418_BUILD_ID}`);
  console.log(`[DRAAD418] 🎯 Route is active and responding!`);

  try {
    // Parse request body
    const body = await request.json() as any;
    const rosterId = body.roster_id || body.rosterId;

    if (!rosterId || typeof rosterId !== 'string') {
      console.error('[MISSING-SERVICES] ❌ Missing or invalid roster_id');
      return NextResponse.json(
        { success: false, error: 'roster_id parameter required' },
        { status: 400 }
      );
    }

    console.log(`[MISSING-SERVICES] 📥 Received roster_id: ${rosterId.substring(0, 12)}...`);

    // Execute query with fallback
    const missingServices = await queryMissingServices(rosterId);

    // Sort by date, dagdeel (O→M→A), team, dienst_code
    missingServices.sort((a: any, b: any) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      // ✅ DRAAD418: Correcte dagdeel sortering: O (Ochtend) → M (Middag) → A (Avond)
      const dagdeelOrder: { [key: string]: number } = { 'O': 1, 'M': 2, 'A': 3 };
      const aDagdeel = dagdeelOrder[a.dagdeel] || 99;
      const bDagdeel = dagdeelOrder[b.dagdeel] || 99;
      if (aDagdeel !== bDagdeel) return aDagdeel - bDagdeel;
      
      if (a.team !== b.team) return a.team.localeCompare(b.team);
      
      return (a.dienst_code || '').localeCompare(b.dienst_code || '');
    });

    console.log(`[MISSING-SERVICES] ✅ Data sorted - ${missingServices.length} records total`);

    // Group by date
    const groupedByDate: { [key: string]: any } = {};
    
    missingServices.forEach((service: any) => {
      const dateKey = service.date;
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {
          date: dateKey,
          date_formatted: formatDutchDate(dateKey),
          total_missing: 0,
          services: []
        };
      }
      
      groupedByDate[dateKey].total_missing += service.ontbrekend_aantal;
      groupedByDate[dateKey].services.push({
        dagdeel: service.dagdeel,
        dagdeel_display: service.dagdeel_display,
        team: service.team,
        team_display: service.team_display,
        dienst_code: service.dienst_code,
        dienst_naam: service.dienst_naam,
        benodigd: service.benodigd,
        ingepland: service.ingepland,
        ontbrekend_aantal: service.ontbrekend_aantal,
        status: service.status
      });
    });

    // Calculate total missing
    const totalMissing = missingServices.reduce(
      (sum: number, s: any) => sum + (s.ontbrekend_aantal || 0),
      0
    );

    console.log(`[MISSING-SERVICES] ✅ Grouped into ${Object.keys(groupedByDate).length} dates`);
    console.log(`[MISSING-SERVICES] 📊 Total missing: ${totalMissing}`);
    console.log(`${'='.repeat(80)}\n`);

    // Return response with DRAAD418 marker
    return NextResponse.json(
      {
        success: true,
        roster_id: rosterId,
        total_missing: totalMissing,
        missing_services: missingServices,
        grouped_by_date: groupedByDate,
        _build_info: {
          draad418_fix: true,
          build_id: DRAAD418_BUILD_ID,
          deploy_timestamp: DRAAD418_DEPLOY_TIMESTAMP,
          sql_filter: 'invulling=0 AND aantal=1',
          dagdeel_mapping: { O: 'Ochtend', M: 'Middag', A: 'Avond' },
          team_mapping: { GRO: 'Groen', ORA: 'Oranje', TOT: 'Praktijk' }
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-DRAAD418-Build': DRAAD418_BUILD_ID
        }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MISSING-SERVICES] ❌ UNCAUGHT ERROR:', error);
    console.error(`[MISSING-SERVICES] 📝 Error message: ${errorMessage}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${errorMessage}`,
        _build_info: { draad418_fix: true, build_id: DRAAD418_BUILD_ID }
      },
      { status: 500 }
    );
  }
}

// Handle GET requests
export async function GET(request: NextRequest) {
  const rosterId = request.nextUrl.searchParams.get('roster_id');
  
  // DRAAD418: Health check endpoint (no Supabase needed)
  if (!rosterId) {
    return NextResponse.json(
      { 
        success: true, 
        message: 'Missing services endpoint is active - DRAAD418',
        build_id: DRAAD418_BUILD_ID,
        deploy_timestamp: DRAAD418_DEPLOY_TIMESTAMP,
        file_location: 'app/api/afl/missing-services/route.ts',
        sql_filter: 'invulling=0 AND aantal=1',
        dagdeel_mapping: { O: 'Ochtend', M: 'Middag', A: 'Avond' },
        team_mapping: { GRO: 'Groen', ORA: 'Oranje', TOT: 'Praktijk' },
        usage: 'POST with { roster_id: "uuid" } or GET with ?roster_id=uuid'
      },
      { status: 200 }
    );
  }

  // Create a mock request with body for POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ roster_id: rosterId })
  });

  return POST(mockRequest);
}
