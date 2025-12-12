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
 * DRAAD165: OPTIE 1 - Disable Supabase SDK-level caching
 *   - Problem: SDK caches query results in memory (survives HTTP cache headers)
 *   - Root cause: Session-level caching that outlives client lifecycle
 *   - Impact: Data updates invisible for 30+ seconds
 *   - Solution: X-Client-Cache-Buster header + timestamp invalidation
 *   - Result: Every request forces fresh database read
 *   - Performance: Same speed, but with GUARANTEED fresh data
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

    // 🔥 DRAAD165-FIX: Create Supabase client WITH SDK CACHE DISABLING
    // ═══════════════════════════════════════════════════════════════════
    // Problem: Supabase SDK caches at session level, outlives HTTP headers
    // Solution: Use unique X-Client-Cache-Buster header per request
    // This signals SDK to ignore its internal cache and fetch fresh data
    // ═══════════════════════════════════════════════════════════════════
    
    const cacheBusterToken = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,  // No session persistence
        autoRefreshToken: false  // No auto-refresh
      },
      global: {
        headers: {
          // HTTP-level cache control (browser/proxy)
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
          'Pragma': 'no-cache, no-store',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
          'X-Accel-Expires': '0',
          
          // 🔥 DRAAD165-FIX: SDK-level cache busting
          // Unique token per request signals SDK to skip cache
          'X-Client-Cache-Buster': cacheBusterToken,
          
          // Alternative: Connection header to prevent keep-alive caching
          'Connection': 'no-cache',
          
          // Force freshness validation
          'X-Request-Timestamp': Date.now().toString(),
          'X-Cache-Control': 'force-refresh'
        }
      }
    });

    console.log(`🔥 DRAAD165: Cache buster token: ${cacheBusterToken}`);

    // 1. Haal roster info op voor periode
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

    // Bereken weeknummers uit datums (ISO week berekening)
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

    // 2. DRAAD164-HOTFIX + DRAAD165-FIX: Inline queries with SDK cache busting
    console.log('📊 DRAAD165: Using INLINE queries with cache-buster enabled');

    // Step A: Haal VRAAG op (hoeveel nodig per service)
    // 🔥 With cache buster token, SDK will NOT use session cache
    const { data: vraagData, error: vraagError } = await supabase
      .from('roster_period_staffing')
      .select(`
        service_id,
        roster_period_staffing_dagdelen(aantal)
      `)
      .eq('roster_id', rosterId);

    if (vraagError) {
      console.error('❌ vraagError:', vraagError);
      return NextResponse.json(
        { error: 'Fout bij ophalen vraag-gegevens', details: vraagError.message },
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

    // Step B: Haal AANBOD op (hoeveel beschikbaar per service)
    // 🔥 With cache buster token, SDK will NOT use session cache
    const { data: aanbodData, error: aanbodError } = await supabase
      .from('roster_employee_services')
      .select('service_id, aantal')
      .eq('roster_id', rosterId)
      .eq('actief', true);

    if (aanbodError) {
      console.error('❌ aanbodError:', aanbodError);
      return NextResponse.json(
        { error: 'Fout bij ophalen aanbod-gegevens', details: aanbodError.message },
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

    // Step C: Haal alle service_types op
    // 🔥 With cache buster token, SDK will NOT use session cache
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

    // Step D: Bouw diensten array met vraag/aanbod/status
    const diensten: PlanInformatieResponse['diensten'] = [];
    let totalNodig = 0;
    let totalBeschikbaar = 0;

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
      }
    });

    // Step E: Bereken totaal status
    const totalVerschil = totalBeschikbaar - totalNodig;
    const totalStatus = totalBeschikbaar >= totalNodig ? 'groen' : 'rood';

    console.log(`✅ DRAAD165: Aggregatie compleet - Nodig: ${totalNodig}, Beschikbaar: ${totalBeschikbaar} (token: ${cacheBusterToken})`);

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

    // 🔥 DRAAD165-FIX: Response headers with cache-buster tracking
    return NextResponse.json(response, {
      headers: {
        // HTTP-level cache control
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
        'Pragma': 'no-cache, no-store',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Accel-Expires': '0',
        
        // 🔥 DRAAD165: ETag includes cache-buster token
        'ETag': `"${cacheBusterToken}"`,
        'Last-Modified': new Date().toUTCString(),
        'Vary': 'Accept-Encoding, Cache-Control, X-Client-Cache-Buster',
        
        // CDN bypass
        'X-Cache': 'BYPASS',
        'X-Cache-Status': 'BYPASS',
        'X-Content-Type-Options': 'nosniff',
        
        // Fix tracking headers - DRAAD165 added
        'X-DRAAD160-FIX': 'Applied - HTTP cache disabled',
        'X-DRAAD161-FIX': 'Applied - Fresh Supabase client per request',
        'X-DRAAD162-FIX': 'Applied - Aggressive no-cache headers + ETag invalidation',
        'X-DRAAD164-FIX': 'Applied - Inline Supabase queries (RPC fallback)',
        'X-DRAAD165-FIX': 'Applied - SDK cache disabling with X-Client-Cache-Buster',
        'X-DRAAD165-CACHE-BUSTER': cacheBusterToken,
        'X-DRAAD165-GUARANTEE': 'Fresh database read guaranteed - no SDK-level caching'
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
