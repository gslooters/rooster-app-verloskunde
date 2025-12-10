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
 * Gebruikt data uit:
 * - Vraag: roster_period_staffing + roster_period_staffing_dagdelen (hoeveel nodig per dag)
 * - Aanbod: roster_employee_services (hoeveel medewerkers beschikbaar per dienst)
 *
 * DRAAD159: Plan Informatie Scherm - Basic implementation
 * DRAAD160: Cache-Control headers (browser cache fix)
 * DRAAD161: Supabase SDK client cache fix - Create FRESH CLIENT per request
 *   - Problem: Supabase JS client caches query results in memory
 *   - Solution: Create NEW client instance per request without cache settings
 *   - Effect: Forces fresh database read, no SDK-level caching
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

    // 🔥 DRAAD161-FIX: Create FRESH Supabase client per request
    // This prevents SDK-level query caching that persists across requests
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,  // Don't persist session to prevent state carry-over
        autoRefreshToken: false  // Disable auto-refresh to keep client stateless
      },
      global: {
        headers: {
          // Double-check: HTTP level cache headers
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    });

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

    // 2. Haal VRAAG op (roster_period_staffing aggregatie)
    const { data: vraagData, error: vraagError } = await supabase
      .from('roster_period_staffing')
      .select('service_id, roster_period_staffing_dagdelen(aantal)')
      .eq('roster_id', rosterId);

    if (vraagError) {
      console.error('❌ Supabase error bij ophalen vraag:', vraagError);
      return NextResponse.json(
        { error: 'Fout bij ophalen vraag-gegevens' },
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

    // 3. Haal AANBOD op (roster_employee_services waar actief=true)
    // 🔥 DRAAD161: This now reads fresh data because client is fresh per request
    const { data: aanbodData, error: aanbodError } = await supabase
      .from('roster_employee_services')
      .select('service_id, aantal')
      .eq('roster_id', rosterId)
      .eq('actief', true);

    if (aanbodError) {
      console.error('❌ Supabase error bij ophalen aanbod:', aanbodError);
      return NextResponse.json(
        { error: 'Fout bij ophalen aanbod-gegevens' },
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

    // 4. Haal alle service_types op met code en kleur
    const { data: serviceTypes, error: serviceTypesError } = await supabase
      .from('service_types')
      .select('id, code, naam, kleur')
      .order('code');

    if (serviceTypesError) {
      console.error('❌ Supabase error bij ophalen service_types:', serviceTypesError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst-types' },
        { status: 500 }
      );
    }

    // 5. Bouw diensten array met vraag/aanbod/status
    const diensten: PlanInformatieResponse['diensten'] = [];
    let totalNodig = 0;
    let totalBeschikbaar = 0;

    serviceTypes?.forEach((st: any) => {
      const nodig = vraagMap.get(st.id) || 0;
      const beschikbaar = aanbodMap.get(st.id) || 0;

      // Filter: Alleen tonen als nodig > 0 OR beschikbaar > 0
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

    // 6. Bereken totaal status
    const totalVerschil = totalBeschikbaar - totalNodig;
    const totalStatus = totalBeschikbaar >= totalNodig ? 'groen' : 'rood';

    // 7. Retourneer response met Cache-Control headers
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

    // 🔥 DRAAD161-FIX: Return with aggressive no-cache headers
    // Fresh Supabase client + HTTP cache headers = guaranteed fresh data
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-DRAAD160-FIX': 'Applied - HTTP cache disabled',
        'X-DRAAD161-FIX': 'Applied - Supabase SDK client cache disabled',
        'X-Content-Type-Options': 'nosniff',
        'X-Cache': 'BYPASS'
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
