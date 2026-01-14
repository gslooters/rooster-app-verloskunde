/**
 * AFL Missing Services Detail Endpoint
 * Endpoint: POST /api/afl/missing-services
 * 
 * OPDRACHT: AFL Rapport Uitbreiding - Ontbrekende Diensten Detail
 * Datum: 13 januari 2026
 * Cache-Bust: 2026-01-14T16:13:00Z
 * Build Fix: TypeScript error resolved
 * Deployment: DRAAD415 - Force rebuild with verification
 * 
 * FUNCTIONALITEIT:
 * ✅ Query ontbrekende diensten uit roster_period_staffing_dagdelen
 * ✅ Join met service_types voor dienstcodes
 * ✅ Groupeer per datum met subtotalen
 * ✅ Nederlandse datum formatting
 * ✅ Return gestructureerde JSON response
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
import { createClient } from '@supabase/supabase-js';

// DRAAD415: Runtime verification marker
const DRAAD415_MARKER = `DRAAD415-MISSING-SERVICES-${Date.now()}`;

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [MISSING-SERVICES] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// DRAAD415: Enhanced startup logging
console.log('\n' + '='.repeat(80));
console.log('🚀 [DRAAD415] MISSING SERVICES API ROUTE LOADED');
console.log('📍 [DRAAD415] Route path: /api/afl/missing-services');
console.log('⏰ [DRAAD415] Load timestamp:', new Date().toISOString());
console.log('🔖 [DRAAD415] Marker:', DRAAD415_MARKER);
console.log('🏗️  [DRAAD415] Runtime: nodejs');
console.log('🔄 [DRAAD415] Dynamic: force-dynamic');
console.log('='.repeat(80) + '\n');

console.log('[MISSING-SERVICES] ✅ Missing services route loaded at:', new Date().toISOString());

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
 * Helper: Get dagdeel display name
 */
function getDagdeelDisplay(dagdeel: string): string {
  const mapping: { [key: string]: string } = {
    'M': 'Ochtend',
    'O': 'Avond',
    'N': 'Nacht'
  };
  return mapping[dagdeel] || dagdeel;
}

/**
 * Query missing services from database
 * Tries RPC first, falls back to direct SQL query
 */
async function queryMissingServices(rosterId: string) {
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
        service_types!inner (code, naam)
      `)
      .eq('roster_id', rosterId)
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
        team: row.team,
        dienst_code: row.service_types?.code || 'ONBEKEND',
        ontbrekend_aantal
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
  console.log(`[DRAAD415] 🔖 Route is active and responding`);

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

    // Sort by date, dagdeel, team, dienst_code
    missingServices.sort((a: any, b: any) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      const dagdeelOrder: { [key: string]: number } = { 'M': 1, 'O': 2, 'N': 3 };
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
        dagdeel_display: getDagdeelDisplay(service.dagdeel),
        team: service.team,
        dienst_code: service.dienst_code,
        ontbrekend_aantal: service.ontbrekend_aantal
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

    // Return response
    return NextResponse.json(
      {
        success: true,
        roster_id: rosterId,
        total_missing: totalMissing,
        missing_services: missingServices,
        grouped_by_date: groupedByDate
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
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
        error: `Internal server error: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}

// Handle GET requests
export async function GET(request: NextRequest) {
  const rosterId = request.nextUrl.searchParams.get('roster_id');
  
  if (!rosterId) {
    return NextResponse.json(
      { success: false, error: 'roster_id query parameter required' },
      { status: 400 }
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
