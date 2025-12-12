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
 * DRAAD159: Plan Informatie Scherm - Basic implementation
 * DRAAD160: Cache-Control headers (browser cache fix)
 * DRAAD161: Supabase SDK client cache fix - Create FRESH CLIENT per request
 * DRAAD162: Aggressive cache-busting - ETag invalidation + comprehensive headers
 * DRAAD164: Server-side SQL aggregatie fix (FALLBACK - inline queries)
 * DRAAD165: SDK cache disabling (CORRECTED) - Fresh client + HTTP headers
 * DRAAD166: FIX aggregation per item - Debug SWZ mismatch
 *   - Problem: TOTAL correct (240/248), but SWZ item wrong (2 instead of 5)
 *   - Root cause: Individual item aggregation broken
 *   - Solution: Debug vraagMap & aanbodMap for each service
 *   - Status: Logging enabled for SWZ service ID
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

    // 🔥 DRAAD165-FIX (CORRECTED): Create Supabase client WITHOUT custom headers
    const cacheBustTimestamp = Date.now();
    const cacheBustRandom = Math.random().toString(36).substr(2, 9);
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
          'Pragma': 'no-cache, no-store',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
          'X-Accel-Expires': '0'
        }
      }
    });

    console.log(`🔥 DRAAD166: Cache bust - ts: ${cacheBustTimestamp}, rand: ${cacheBustRandom}`);

    // 1. Haal roster info op
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status')
      .eq('id', rosterId)
      .single();

    if (rosterError) {
      console.error('❌ Supabase error bij ophalen rooster:', rosterError);
      return NextResponse.json(
        { error: 'Fout bij ophalen rooster', details: rosterError.message },
        { status: 500 }
      );
    }

    if (!roster) {
      return NextResponse.json(
        { error: 'Rooster niet gevonden' },
        { status: 404 }
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

    console.log('📊 DRAAD166: Using INLINE queries with detailed aggregation debugging');

    // 🔥 DRAAD166: Step A - Haal VRAAG op met detailed logging
    const { data: vraagData, error: vraagError } = await supabase
      .from('roster_period_staffing')
      .select(`
        id,
        service_id,
        roster_period_staffing_dagdelen(id, aantal)
      `)
      .eq('roster_id', rosterId);

    if (vraagError) {
      console.error('❌ vraagError:', vraagError);
      return NextResponse.json(
        { error: 'Fout bij ophalen vraag-gegevens', details: vraagError.message },
        { status: 500 }
      );
    }

    console.log(`📊 DRAAD166: vraagData - ${vraagData?.length || 0} parent records`);

    // Aggregeer vraag per service
    const vraagMap = new Map<string, number>();
    vraagData?.forEach((row: any) => {
      if (row.service_id && Array.isArray(row.roster_period_staffing_dagdelen)) {
        const dagdelenCount = row.roster_period_staffing_dagdelen.length;
        const total = (row.roster_period_staffing_dagdelen as any[]).reduce(
          (sum: number, dagdeel: any) => sum + (dagdeel.aantal || 0),
          0
        );
        vraagMap.set(row.service_id, (vraagMap.get(row.service_id) || 0) + total);
        
        // 🔥 DRAAD166: Log SWZ specifically
        if (row.service_id === '6eea2bf8-e2b8-468a-918f-ae96883f7ebd') { // SWZ UUID
          console.log(`🔍 DRAAD166: SWZ parent=${row.id}, dagdelen=${dagdelenCount}, total=${total}, vraagMap now=${vraagMap.get(row.service_id)}`);
        }
      }
    });

    console.log(`📊 DRAAD166: vraagMap size=${vraagMap.size}, SWZ value=${vraagMap.get('6eea2bf8-e2b8-468a-918f-ae96883f7ebd')}`);

    // 🔥 DRAAD166: Step B - Haal AANBOD op
    const { data: aanbodData, error: aanbodError } = await supabase
      .from('roster_employee_services')
      .select('id, service_id, aantal, actief')
      .eq('roster_id', rosterId)
      .eq('actief', true);

    if (aanbodError) {
      console.error('❌ aanbodError:', aanbodError);
      return NextResponse.json(
        { error: 'Fout bij ophalen aanbod-gegevens', details: aanbodError.message },
        { status: 500 }
      );
    }

    console.log(`📊 DRAAD166: aanbodData - ${aanbodData?.length || 0} records (actief=true)`);

    // Aggregeer aanbod per service
    const aanbodMap = new Map<string, number>();
    aanbodData?.forEach((row: any) => {
      if (row.service_id) {
        aanbodMap.set(
          row.service_id,
          (aanbodMap.get(row.service_id) || 0) + (row.aantal || 0)
        );
        
        // 🔥 DRAAD166: Log SWZ specifically
        if (row.service_id === '6eea2bf8-e2b8-468a-918f-ae96883f7ebd') { // SWZ UUID
          console.log(`🔍 DRAAD166: SWZ aanbod record - aantal=${row.aantal}, aanbodMap now=${aanbodMap.get(row.service_id)}`);
        }
      }
    });

    console.log(`📊 DRAAD166: aanbodMap size=${aanbodMap.size}, SWZ value=${aanbodMap.get('6eea2bf8-e2b8-468a-918f-ae96883f7ebd')}`);

    // 🔥 DRAAD166: Step C - Haal service_types op
    const { data: serviceTypes, error: serviceTypesError } = await supabase
      .from('service_types')
      .select('id, code, naam, kleur')
      .order('code');

    if (serviceTypesError) {
      console.error('❌ serviceTypesError:', serviceTypesError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst-types', details: serviceTypesError.message },
        { status: 500 }
      );
    }

    // 🔥 DRAAD166: Find SWZ service type
    const swzServiceType = serviceTypes?.find((st: any) => st.code === 'SWZ');
    console.log(`🔍 DRAAD166: SWZ service_type found: id=${swzServiceType?.id}, code=${swzServiceType?.code}`);

    // 🔥 DRAAD166: Step D - Build diensten array with debugging
    const diensten: PlanInformatieResponse['diensten'] = [];
    let totalNodig = 0;
    let totalBeschikbaar = 0;

    serviceTypes?.forEach((st: any) => {
      const nodig = vraagMap.get(st.id) || 0;
      const beschikbaar = aanbodMap.get(st.id) || 0;

      // 🔥 DRAAD166: Debug SWZ
      if (st.code === 'SWZ') {
        console.log(`🔍 DRAAD166: SWZ final values - nodig=${nodig}, beschikbaar=${beschikbaar}`);
        console.log(`🔍 DRAAD166: SWZ vraagMap.get(${st.id})=${vraagMap.get(st.id)}`);
        console.log(`🔍 DRAAD166: SWZ aanbodMap.get(${st.id})=${aanbodMap.get(st.id)}`);
      }

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
      }
    });

    // Step E: Bereken totaal status
    const totalVerschil = totalBeschikbaar - totalNodig;
    const totalStatus = totalBeschikbaar >= totalNodig ? 'groen' : 'rood';

    console.log(`✅ DRAAD166: Aggregatie compleet - Nodig: ${totalNodig}, Beschikbaar: ${totalBeschikbaar}`);
    console.log(`📊 DRAAD166: Diensten count: ${diensten.length}`);
    diensten.forEach(d => {
      if (d.code === 'SWZ') {
        console.log(`🔍 DRAAD166: Final SWZ in response - ${d.nodig}/${d.beschikbaar}`);
      }
    });

    // Step F: Retourneer response
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

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
        'Pragma': 'no-cache, no-store',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Accel-Expires': '0',
        'ETag': `"${cacheBustTimestamp}_${cacheBustRandom}"`,
        'Last-Modified': new Date().toUTCString(),
        'Vary': 'Accept-Encoding, Cache-Control',
        'X-Cache': 'BYPASS',
        'X-Cache-Status': 'BYPASS',
        'X-Content-Type-Options': 'nosniff',
        'X-DRAAD166-DEBUG': 'SWZ aggregation logging enabled',
        'X-DRAAD166-GUARANTEE': 'Detailed logging for SWZ service mismatch'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/planinformatie-periode:', error);
    return NextResponse.json(
      { error: 'Interne serverfout' },
      { status: 500 }
    );
  }
}
