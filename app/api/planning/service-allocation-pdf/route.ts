import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// DRAAD48 - API ENDPOINT: SERVICE ALLOCATION PDF DATA
// URL: /api/planning/service-allocation-pdf?rosterId={id}
// Purpose: Fetch all service allocation data for PDF generation
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ServiceAllocationRow {
  datum: string;
  team: string;
  dagdeel: string;
  dienstcode: string;
  status: string;
  aantal: number;
}

interface GroupedData {
  [date: string]: {
    [team: string]: {
      [dagdeel: string]: Array<{
        code: string;
        status: string;
        aantal: number;
      }>;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rosterId = searchParams.get('rosterId');

    if (!rosterId) {
      return NextResponse.json(
        { error: 'Roster ID is verplicht' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch roster info
    const { data: rosterInfo, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, naam')
      .eq('id', rosterId)
      .single();

    if (rosterError || !rosterInfo) {
      return NextResponse.json(
        { error: 'Rooster niet gevonden' },
        { status: 404 }
      );
    }

    // Fetch service allocation data with proper SQL
    // Note: Supabase client doesn't support complex JOINs directly,
    // so we'll use RPC or construct the query carefully
    const { data: rawData, error: dataError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select(`
        *,
        roster_period_staffing!inner(
          date,
          roster_id,
          service_types(code)
        )
      `)
      .eq('roster_period_staffing.roster_id', rosterId)
      .gt('aantal', 0)
      .order('roster_period_staffing(date)', { ascending: true });

    if (dataError) {
      console.error('[PDF-API] Data fetch error:', dataError);
      return NextResponse.json(
        { error: 'Fout bij ophalen data: ' + dataError.message },
        { status: 500 }
      );
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({
        roster: rosterInfo,
        data: {},
        isEmpty: true,
        message: 'Geen diensten gevonden voor deze roosterperiode'
      });
    }

    // Transform and group data
    const grouped: GroupedData = {};

    rawData.forEach((row: any) => {
      const date = row.roster_period_staffing.date;
      const team = row.team;
      const dagdeel = row.dagdeel;
      const code = row.roster_period_staffing.service_types?.code || 'N/A';
      const status = row.status;
      const aantal = row.aantal;

      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][team]) grouped[date][team] = {};
      if (!grouped[date][team][dagdeel]) grouped[date][team][dagdeel] = [];

      grouped[date][team][dagdeel].push({
        code,
        status,
        aantal
      });
    });

    return NextResponse.json({
      roster: rosterInfo,
      data: grouped,
      isEmpty: false
    });

  } catch (error: any) {
    console.error('[PDF-API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Onverwachte fout: ' + error.message },
      { status: 500 }
    );
  }
}
