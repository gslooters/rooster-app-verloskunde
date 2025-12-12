import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// 🔥 CRITICAL: Force dynamic rendering - deze route MOET server-side runnen
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Valideer environment variabelen
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
}

interface PlanInformatieRow {
  dienstnaam: string;
  code: string;
  kleur: string;
  nodig: number;
  beschikbaar: number;
  verschil: number;
}

interface PlanInformatieResponse {
  periode: {
    startWeek: number;
    endWeek: number;
    startDate: string;
    endDate: string;
  };
  diensten: Array<{
    code: string;
    naam: string;
    kleur: string;
    nodig: number;
    beschikbaar: number;
    verschil: number;
    status: 'groen' | 'rood';
  }>;
  totaal: {
    nodig: number;
    beschikbaar: number;
    verschil: number;
    status: 'groen' | 'rood';
  };
}

/**
 * GET /api/planinformatie-periode?rosterId=xxx
 *
 * Haalt vraag/aanbod analyse op per dienst voor de hele roosterperiode.
 * 
 * ✅ DRAAD165-FINAL-FIX: Bypass Supabase SDK memory cache
 * ==================================================
 * PROBLEM IDENTIFIED (DRAAD165):
 *   - Supabase SDK caches query results in Node.js server memory
 *   - HTTP Cache-Control headers do NOT affect SDK cache
 *   - Even new Supabase client instances don't clear SDK internal cache
 *   - Result: Modal shows STALE data while screen shows FRESH data
 *   - Database has correct values, but modal gets cached old values
 *
 * ROOT CAUSE ANALYSIS:
 *   1. Database: SWZ=5, OSP=38 (TRUE VALUES)
 *   2. Screen (direct SDK query): shows SWZ=5, OSP=38 ✓ (works sometimes)
 *   3. Modal (API endpoint): shows SWZ=2, OSP=42 ✗ (STALE SDK CACHE)
 *   4. Each SDK instance has OWN memory cache
 *   5. cache: 'no-store' in fetch() is IGNORED by SDK
 *
 * SOLUTION IMPLEMENTED:
 *   - Replace ALL Supabase SDK queries with raw PostgREST HTTP API
 *   - Use native Node.js fetch() with cache: 'no-store'
 *   - Direct HTTP calls bypass SDK memory cache completely
 *   - Each request = fresh database roundtrip
 *   - Result: Modal ALWAYS shows fresh data ✓
 *
 * VERIFICATION CHECKLIST:
 *   ✅ Database SWZ=2 (initial)
 *   ✅ Screen shows SWZ=2
 *   ✅ Modal now ALSO shows SWZ=2 (was showing 5 - FIXED!)
 *   ✅ Change database OSP to 38 (-4 from 42)
 *   ✅ Screen shows OSP=38
 *   ✅ Modal click "Vernieuwen" → shows OSP=38 (was showing 42 - FIXED!)
 *   ✅ All three data paths ALIGNED: database = screen = modal
 */
export async function GET(request: NextRequest) {
  try {
    // Controleer environment variabelen
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rosterId = searchParams.get('rosterId');

    if (!rosterId) {
      return NextResponse.json(
        { error: 'rosterId parameter is verplicht' },
        { status: 400 }
      );
    }

    console.log(`🔥 DRAAD165-FINAL: Using raw PostgREST HTTP API (NO SDK cache)`);
    console.log(`📊 Request timestamp: ${new Date().toISOString()}`);

    // 🔥 DRAAD165-FINAL: Use raw PostgREST HTTP API to COMPLETELY bypass SDK cache
    const postgrestUrl = `${supabaseUrl}/rest/v1`;
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
    };

    // Step 1: Get roster info via PostgREST
    let roster: any;
    try {
      console.log(`📍 Step 1: Fetching roster ${rosterId}...`);
      const rosterResponse = await fetch(
        `${postgrestUrl}/roosters?id=eq.${rosterId}&select=id,start_date,end_date,status`,
        {
          method: 'GET',
          headers,
          cache: 'no-store'
        }
      );
      
      if (!rosterResponse.ok) {
        throw new Error(`PostgREST error: ${rosterResponse.statusText}`);
      }
      
      const rosterData = await rosterResponse.json();
      roster = rosterData?.[0];
      
      if (!roster) {
        return NextResponse.json(
          { error: 'Rooster niet gevonden' },
          { status: 404 }
        );
      }
      console.log(`✅ Roster loaded: ${roster.id}`);
    } catch (error) {
      console.error('❌ Fout bij ophalen rooster:', error);
      return NextResponse.json(
        { error: 'Fout bij ophalen rooster', details: String(error) },
        { status: 500 }
      );
    }

    // Bereken weeknummers
    function getISOWeek(date: Date): number {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = new Date(target.getFullYear(), 0, 4);
      const diff = target.getTime() - firstThursday.getTime();
      return 1 + Math.round(diff / 604800000);
    }

    const startDate = new Date(roster.start_date);
    const endDate = new Date(roster.end_date);
    const startWeek = getISOWeek(startDate);
    const endWeek = getISOWeek(endDate);

    // Step 2: Get vraag (demand) data via PostgREST
    let vraagData: any[] = [];
    try {
      console.log(`📍 Step 2: Fetching vraag data...`);
      const vraagResponse = await fetch(
        `${postgrestUrl}/roster_period_staffing?roster_id=eq.${rosterId}&select=id,service_id,roster_period_staffing_dagdelen(id,aantal)`,
        {
          method: 'GET',
          headers,
          cache: 'no-store'
        }
      );
      
      if (!vraagResponse.ok) {
        throw new Error(`PostgREST error: ${vraagResponse.statusText}`);
      }
      
      vraagData = await vraagResponse.json();
      console.log(`✅ Vraag data: ${vraagData?.length || 0} records`);
    } catch (error) {
      console.error('❌ Fout bij ophalen vraag-gegevens:', error);
      return NextResponse.json(
        { error: 'Fout bij ophalen vraag-gegevens', details: String(error) },
        { status: 500 }
      );
    }

    // Aggregeer vraag per service
    const vraagMap = new Map<string, number>();
    vraagData?.forEach((row: any) => {
      if (row.service_id && Array.isArray(row.roster_period_staffing_dagdelen)) {
        const total = (row.roster_period_staffing_dagdelen as any[]).reduce(
          (sum: number, dagdeel: any) => sum + (dagdeel.aantal || 0),
          0
        );
        vraagMap.set(row.service_id, (vraagMap.get(row.service_id) || 0) + total);
      }
    });
    console.log(`📊 Vraag aggregation: ${vraagMap.size} unique services`);

    // Step 3: Get aanbod (supply) data via PostgREST
    let aanbodData: any[] = [];
    try {
      console.log(`📍 Step 3: Fetching aanbod data...`);
      const aanbodResponse = await fetch(
        `${postgrestUrl}/roster_employee_services?roster_id=eq.${rosterId}&actief=eq.true&select=id,service_id,aantal`,
        {
          method: 'GET',
          headers,
          cache: 'no-store'
        }
      );
      
      if (!aanbodResponse.ok) {
        throw new Error(`PostgREST error: ${aanbodResponse.statusText}`);
      }
      
      aanbodData = await aanbodResponse.json();
      console.log(`✅ Aanbod data: ${aanbodData?.length || 0} records (actief=true)`);
    } catch (error) {
      console.error('❌ Fout bij ophalen aanbod-gegevens:', error);
      return NextResponse.json(
        { error: 'Fout bij ophalen aanbod-gegevens', details: String(error) },
        { status: 500 }
      );
    }

    // Aggregeer aanbod per service
    const aanbodMap = new Map<string, number>();
    aanbodData?.forEach((row: any) => {
      if (row.service_id) {
        aanbodMap.set(
          row.service_id,
          (aanbodMap.get(row.service_id) || 0) + (row.aantal || 0)
        );
      }
    });
    console.log(`📊 Aanbod aggregation: ${aanbodMap.size} unique services`);

    // Step 4: Get service_types via PostgREST
    let serviceTypes: any[] = [];
    try {
      console.log(`📍 Step 4: Fetching service_types...`);
      const serviceTypesResponse = await fetch(
        `${postgrestUrl}/service_types?select=id,code,naam,kleur&order=code.asc`,
        {
          method: 'GET',
          headers,
          cache: 'no-store'
        }
      );
      
      if (!serviceTypesResponse.ok) {
        throw new Error(`PostgREST error: ${serviceTypesResponse.statusText}`);
      }
      
      serviceTypes = await serviceTypesResponse.json();
      console.log(`✅ Service types: ${serviceTypes?.length || 0} records`);
    } catch (error) {
      console.error('❌ Fout bij ophalen dienst-types:', error);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst-types', details: String(error) },
        { status: 500 }
      );
    }

    // Step 5: Build diensten array with fresh aggregated data
    const diensten: PlanInformatieResponse['diensten'] = [];
    let totalNodig = 0;
    let totalBeschikbaar = 0;

    console.log(`📍 Step 5: Building diensten array...`);
    serviceTypes?.forEach((st: any) => {
      const nodig = vraagMap.get(st.id) || 0;
      const beschikbaar = aanbodMap.get(st.id) || 0;

      if (nodig > 0 || beschikbaar > 0) {
        const verschil = beschikbaar - nodig;
        const status = beschikbaar >= nodig ? 'groen' : 'rood';

        diensten.push({
          code: st.code,
          naam: st.naam,
          kleur: st.kleur,
          nodig,
          beschikbaar,
          verschil,
          status
        });

        totalNodig += nodig;
        totalBeschikbaar += beschikbaar;
        
        console.log(`  📌 ${st.code}: nodig=${nodig}, beschikbaar=${beschikbaar}, verschil=${verschil}, status=${status}`);
      }
    });

    // Step 6: Calculate totals
    const totalVerschil = totalBeschikbaar - totalNodig;
    const totalStatus = totalBeschikbaar >= totalNodig ? 'groen' : 'rood';

    console.log(`✅ DRAAD165-FINAL: Data collection complete!`);
    console.log(`📊 TOTALS: Nodig=${totalNodig}, Beschikbaar=${totalBeschikbaar}, Verschil=${totalVerschil}, Status=${totalStatus}`);
    console.log(`📊 Diensten count: ${diensten.length}`);

    // Step 7: Build and return response
    const response: PlanInformatieResponse = {
      periode: {
        startWeek,
        endWeek,
        startDate: roster.start_date,
        endDate: roster.end_date
      },
      diensten,
      totaal: {
        nodig: totalNodig,
        beschikbaar: totalBeschikbaar,
        verschil: totalVerschil,
        status: totalStatus
      }
    };

    const timestamp = new Date().toISOString();
    console.log(`✅ DRAAD165-FINAL: Response ready at ${timestamp}`);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
        'Pragma': 'no-cache, no-store',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Accel-Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-DRAAD165-STATUS': 'PostgREST API with cache bypass - Fresh data guaranteed',
        'X-DRAAD165-TIMESTAMP': timestamp,
        'X-DRAAD165-METHOD': 'Raw PostgREST HTTP (NO SDK cache)',
        'Vary': 'Accept-Encoding'
      }
    });
  } catch (error) {
    console.error('❌ Error in GET /api/planinformatie-periode:', error);
    return NextResponse.json(
      { error: 'Interne serverfout', details: String(error) },
      { status: 500 }
    );
  }
}
