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
import {
  queryMissingServices,
  groupMissingServicesByDate,
  type MissingService
} from '@/lib/afl-missing-services-utils';

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

    // Execute shared query
    const missingServices = await queryMissingServices((global as any).supabaseClient || null, rosterId);

    // Sort by date, dagdeel (O→M→A), team, dienst_code
    missingServices.sort((a: MissingService, b: MissingService) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      const dagdeelOrder: { [key: string]: number } = { 'O': 1, 'M': 2, 'A': 3 };
      const aDagdeel = dagdeelOrder[a.dagdeel] || 99;
      const bDagdeel = dagdeelOrder[b.dagdeel] || 99;
      if (aDagdeel !== bDagdeel) return aDagdeel - bDagdeel;
      
      if (a.team !== b.team) return a.team.localeCompare(b.team);
      
      return (a.dienst_code || '').localeCompare(b.dienst_code || '');
    });

    console.log(`[MISSING-SERVICES] ✅ Data sorted - ${missingServices.length} records total`);

    // Group by date
    const groupedByDate = groupMissingServicesByDate(missingServices);

    // Calculate total missing
    const totalMissing = missingServices.reduce(
      (sum: number, s: MissingService) => sum + (s.ontbrekend_aantal || 0),
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

  // For now, simply redirect to POST handler using same logic
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ roster_id: rosterId })
  });

  return POST(mockRequest);
}
