import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🔥 CRITICAL: Force dynamic rendering - deze route MOET server-side runnen
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// DRAAD54 - API ENDPOINT: SERVICE ALLOCATION PDF DATA V3
// URL: /api/planning/service-allocation-pdf?rosterId={id}
// Purpose: Fetch all service allocation data for PDF generation + kleuren
// Update: Added service_types.kleur for V3 colored badges
// DRAAD60A: Added date filtering on rooster.start_date and end_date
// DRAAD73D: Force dynamic rendering (geen static generation)
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

interface ServiceType {
  code: string;
  kleur: string;
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

    // ========================================================================
    // STEP 1: Fetch roster info
    // ========================================================================
    const { data: rosterInfo, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date, status')
      .eq('id', rosterId)
      .single();

    if (rosterError) {
      console.error('[PDF-API] Roster fetch error:', rosterError);
      return NextResponse.json(
        { error: 'Rooster niet gevonden: ' + rosterError.message },
        { status: 404 }
      );
    }

    if (!rosterInfo) {
      return NextResponse.json(
        { error: 'Rooster niet gevonden' },
        { status: 404 }
      );
    }

    // ========================================================================
    // STEP 2A: Fetch roster_period_staffing (base records)
    // DRAAD60A: Added date filtering to exclude records outside roster period
    // ========================================================================
    const { data: staffingRecords, error: staffingError } = await supabase
      .from('roster_period_staffing')
      .select('id, roster_id, service_id, date')
      .eq('roster_id', rosterId)
      .gte('date', rosterInfo.start_date)
      .lte('date', rosterInfo.end_date)
      .order('date', { ascending: true });

    if (staffingError) {
      console.error('[PDF-API] Staffing fetch error:', staffingError);
      return NextResponse.json(
        { error: 'Fout bij ophalen staffing data: ' + staffingError.message },
        { status: 500 }
      );
    }

    if (!staffingRecords || staffingRecords.length === 0) {
      return NextResponse.json({
        roster: rosterInfo,
        data: {},
        serviceTypes: [],
        isEmpty: true,
        message: 'Geen staffing records gevonden voor deze roosterperiode'
      });
    }

    // ========================================================================
    // STEP 2B: Fetch roster_period_staffing_dagdelen (details with aantal > 0)
    // ========================================================================
    const staffingIds = staffingRecords.map(r => r.id);
    
    const { data: dagdelenRecords, error: dagdelenError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('id, roster_period_staffing_id, dagdeel, team, status, aantal')
      .in('roster_period_staffing_id', staffingIds)
      .gt('aantal', 0)
      .order('dagdeel', { ascending: true });

    if (dagdelenError) {
      console.error('[PDF-API] Dagdelen fetch error:', dagdelenError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dagdelen data: ' + dagdelenError.message },
        { status: 500 }
      );
    }

    if (!dagdelenRecords || dagdelenRecords.length === 0) {
      return NextResponse.json({
        roster: rosterInfo,
        data: {},
        serviceTypes: [],
        isEmpty: true,
        message: 'Geen diensten gevonden voor deze roosterperiode'
      });
    }

    // ========================================================================
    // STEP 2C: Fetch service_types (for codes + KLEUREN V3)
    // ========================================================================
    const serviceIds = [...new Set(staffingRecords.map(r => r.service_id))];
    
    const { data: serviceTypes, error: serviceError } = await supabase
      .from('service_types')
      .select('id, code, naam, kleur')
      .in('id', serviceIds);

    if (serviceError) {
      console.error('[PDF-API] Service types fetch error:', serviceError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst types: ' + serviceError.message },
        { status: 500 }
      );
    }

    // ========================================================================
    // STEP 3: Create lookup Maps for efficiency
    // ========================================================================
    const serviceMap = new Map<string, { code: string; naam: string }>();
    (serviceTypes || []).forEach(st => {
      serviceMap.set(st.id, { code: st.code, naam: st.naam });
    });

    const staffingMap = new Map<string, { date: string; serviceId: string }>();
    staffingRecords.forEach(sr => {
      staffingMap.set(sr.id, { 
        date: sr.date, 
        serviceId: sr.service_id 
      });
    });

    // ========================================================================
    // STEP 4: Transform & group data in memory
    // ========================================================================
    const grouped: GroupedData = {};

    dagdelenRecords.forEach(dagdeel => {
      const staffing = staffingMap.get(dagdeel.roster_period_staffing_id);
      
      if (!staffing) {
        console.warn('[PDF-API] Orphaned dagdeel record:', dagdeel.id);
        return;
      }

      const service = serviceMap.get(staffing.serviceId);
      const code = service?.code || 'N/A';
      const date = staffing.date;
      const team = dagdeel.team;
      const dagdeelName = dagdeel.dagdeel;
      const status = dagdeel.status;
      const aantal = dagdeel.aantal;

      // Initialize nested structure
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][team]) grouped[date][team] = {};
      if (!grouped[date][team][dagdeelName]) grouped[date][team][dagdeelName] = [];

      grouped[date][team][dagdeelName].push({
        code,
        status,
        aantal
      });
    });

    // ========================================================================
    // STEP 5: Prepare service types array with kleuren for V3
    // ========================================================================
    const serviceTypesArray: ServiceType[] = (serviceTypes || []).map(st => ({
      code: st.code,
      kleur: st.kleur || '#808080' // Fallback grijs als kleur ontbreekt
    }));

    // ========================================================================
    // STEP 6: Return structured data with serviceTypes
    // ========================================================================
    return NextResponse.json({
      roster: rosterInfo,
      data: grouped,
      serviceTypes: serviceTypesArray,
      isEmpty: Object.keys(grouped).length === 0,
      stats: {
        totalDates: Object.keys(grouped).length,
        totalRecords: dagdelenRecords.length,
        serviceTypes: serviceMap.size
      }
    });

  } catch (error: any) {
    console.error('[PDF-API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Onverwachte fout: ' + error.message },
      { status: 500 }
    );
  }
}
