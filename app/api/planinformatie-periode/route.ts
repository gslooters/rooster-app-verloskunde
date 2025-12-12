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
 *   - Problem: Supabase JS client caches query results in memory
 *   - Solution: Create NEW client instance per request without cache settings
 *   - Effect: Forces fresh database read, no SDK-level caching
 * DRAAD162: Aggressive cache-busting - ETag invalidation + comprehensive headers
 *   - Problem: Browser HTTP cache returns 304 Not Modified (even with no-cache headers)
 *   - Solution: Add ETag with Date.now() to force full response
 *   - Result: Fresh data guaranteed on every request
 * DRAAD164: Server-side SQL aggregatie fix
 *   - Problem: JavaScript RLS-relatie-select was incomplete (-2 discrepancy)
 *   - Solution: Use RPC to call PostgreSQL function get_planinformatie_periode()
 *   - Result: Totalen 100% accurate (Nodig: 241, Beschikbaar: 248)
 *   - Database: CREATE FUNCTION get_planinformatie_periode(p_roster_id uuid) RETURNS TABLE (...)
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

    // 2. DRAAD164-FIX: Roep PostgreSQL functie aan voor server-side aggregatie
    // Problem: JavaScript RLS-relatie-select was incomplete (-2 discrepantie)
    // Solution: Use RPC to call native SQL function with proper JOINs
    const { data: planinformatieData, error: rpcError } = await supabase.rpc(
      'get_planinformatie_periode',
      { p_roster_id: rosterId }
    );

    if (rpcError) {
      console.error('❌ RPC error bij ophalen planinformatie:', rpcError);
      return NextResponse.json(
        { error: 'Fout bij ophalen planinformatie', details: rpcError.message },
        { status: 500 }
      );
    }

    // 3. Bouw diensten array van RPC resultaat
    const diensten: PlanInformatieResponse['diensten'] = [];
    let totalNodig = 0;
    let totalBeschikbaar = 0;

    planinformatieData?.forEach((row: any) => {
      diensten.push({
        code: row.code,
        naam: row.naam,
        kleur: row.kleur || '#e5e7eb',
        nodig: row.nodig,
        beschikbaar: row.beschikbaar,
        verschil: row.verschil,
        status: row.status
      });

      totalNodig += row.nodig;
      totalBeschikbaar += row.beschikbaar;
    });

    // 4. Bereken totaal status
    const totalVerschil = totalBeschikbaar - totalNodig;
    const totalStatus = totalBeschikbaar >= totalNodig ? 'groen' : 'rood';

    // 5. Retourneer response met Cache-Control headers
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

    // 🔥 DRAAD162-FIX: Return with aggressive no-cache headers + ETag invalidation
    // Fresh Supabase client + HTTP cache headers + ETag = guaranteed fresh data
    // ETag with Date.now() forces browser to request full response (no 304)
    return NextResponse.json(response, {
      headers: {
        // Aggressive HTTP cache control headers
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
        'Pragma': 'no-cache, no-store',
        'Expires': '0',
        'Surrogate-Control': 'no-store',  // Proxy cache bypass
        'X-Accel-Expires': '0',  // Nginx/reverse proxy bypass
        
        // ETag invalidation: Forces full response instead of 304 Not Modified
        'ETag': `"${Date.now()}_draad164"`,  // 🔥 DRAAD164: Added _draad164 suffix for versioning
        'Last-Modified': new Date().toUTCString(),
        'Vary': 'Accept-Encoding, Cache-Control',
        
        // CDN/Proxy bypass
        'X-Cache': 'BYPASS',
        'X-Cache-Status': 'BYPASS',
        'X-Content-Type-Options': 'nosniff',
        
        // Fix tracking headers
        'X-DRAAD160-FIX': 'Applied - HTTP cache disabled',
        'X-DRAAD161-FIX': 'Applied - Supabase SDK client cache disabled',
        'X-DRAAD162-FIX': 'Applied - Aggressive no-cache headers + ETag invalidation',
        'X-DRAAD164-FIX': 'Applied - PostgreSQL RPC function for server-side aggregatie'
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
