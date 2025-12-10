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
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
}

/**
 * GET /api/diensten-aanpassen?rosterId=xxx
 * 
 * Haalt alle data op voor het diensten-toewijzing scherm:
 * - Roster info (periode, weken)
 * - Alle actieve dienst-types met kleuren en dienstwaarde
 * - Alle actieve medewerkers met hun dienst-toewijzingen
 * 
 * DRAAD66G: Inclusief dienstwaarde voor gewogen telling
 * DRAAD73D: Force dynamic rendering (geen static generation)
 * DRAAD162: Cache-Control headers on GET response
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

    // 🔥 DRAAD162-FIX: Use fresh Supabase client per request
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
        }
      }
    });

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

    // Bereken weeknummers uit datums (ISO week berekening)
    const startDate = new Date(roster.start_date);
    const endDate = new Date(roster.end_date);
    
    // Helper functie voor ISO week nummer
    function getISOWeek(date: Date): number {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = new Date(target.getFullYear(), 0, 4);
      const diff = target.getTime() - firstThursday.getTime();
      return 1 + Math.round(diff / 604800000);
    }
    
    const startWeek = getISOWeek(startDate);
    const endWeek = getISOWeek(endDate);

    // 2. Haal alle actieve dienst-types op met dienstwaarde (DRAAD66G)
    const { data: serviceTypes, error: serviceTypesError } = await supabase
      .from('service_types')
      .select('id, code, naam, kleur, dienstwaarde')
      .eq('actief', true)
      .order('code');

    if (serviceTypesError) {
      console.error('❌ Supabase error bij ophalen dienst-types:', serviceTypesError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst-types' },
        { status: 500 }
      );
    }

    // 3. Haal alle actieve medewerkers op (DRAAD66G: gesorteerd op team, voornaam)
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, voornaam, achternaam, team')
      .eq('actief', true)
      .order('team')
      .order('voornaam');

    if (employeesError) {
      console.error('❌ Supabase error bij ophalen medewerkers:', employeesError);
      return NextResponse.json(
        { error: 'Fout bij ophalen medewerkers' },
        { status: 500 }
      );
    }

    // 4. Haal bestaande dienst-toewijzingen op voor dit rooster
    const { data: existingServices, error: existingServicesError } = await supabase
      .from('roster_employee_services')
      .select('employee_id, service_id, aantal, actief')
      .eq('roster_id', rosterId)
      .eq('actief', true);

    if (existingServicesError) {
      console.error('❌ Supabase error bij ophalen dienst-toewijzingen:', existingServicesError);
      return NextResponse.json(
        { error: 'Fout bij ophalen dienst-toewijzingen' },
        { status: 500 }
      );
    }

    // 5. Maak lookup map voor snelle toegang
    const servicesMap = new Map<string, { aantal: number; actief: boolean }>();
    existingServices?.forEach(service => {
      const key = `${service.employee_id}_${service.service_id}`;
      servicesMap.set(key, {
        aantal: service.aantal,
        actief: service.actief
      });
    });

    // 6. Maak dienstwaarde lookup map (DRAAD66G)
    const dienstwaardeMap = new Map<string, number>();
    serviceTypes?.forEach(st => {
      dienstwaardeMap.set(st.id, st.dienstwaarde || 1);
    });

    // 7. Bouw response met alle diensten per medewerker (DRAAD66G: inclusief dienstwaarde)
    const employeesWithServices = employees?.map(employee => {
      const services = serviceTypes?.map(serviceType => {
        const key = `${employee.id}_${serviceType.id}`;
        const existing = servicesMap.get(key);

        return {
          serviceId: serviceType.id,
          code: serviceType.code,
          aantal: existing?.aantal || 0,
          actief: existing?.actief || false,
          dienstwaarde: serviceType.dienstwaarde || 1 // DRAAD66G: dienstwaarde toevoegen
        };
      }) || [];

      return {
        id: employee.id,
        voornaam: employee.voornaam,
        achternaam: employee.achternaam,
        team: employee.team,
        services
      };
    }) || [];

    // 8. Retourneer complete dataset (DRAAD66G: inclusief dienstwaarde)
    // 🔥 DRAAD162-FIX: Add aggressive cache-control headers to GET response
    return NextResponse.json(
      {
        roster: {
          id: roster.id,
          startDate: roster.start_date,
          endDate: roster.end_date,
          startWeek: startWeek,
          endWeek: endWeek,
          status: roster.status
        },
        serviceTypes: serviceTypes?.map(st => ({
          id: st.id,
          code: st.code,
          naam: st.naam,
          kleur: st.kleur,
          dienstwaarde: st.dienstwaarde || 1 // DRAAD66G: dienstwaarde toevoegen
        })) || [],
        employees: employeesWithServices
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
          'Pragma': 'no-cache, no-store',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
          'X-Accel-Expires': '0',
          'X-Cache': 'BYPASS',
          'ETag': `"${Date.now()}"`,
          'X-DRAAD162-FIX': 'Applied - Cache control headers on GET response'
        }
      }
    );

  } catch (error) {
    console.error('Error in GET /api/diensten-aanpassen:', error);
    return NextResponse.json(
      { error: 'Interne serverfout' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/diensten-aanpassen
 * 
 * Update een enkele dienst-toewijzing voor een medewerker.
 * Gebruikt upsert pattern: insert or update.
 * 
 * DRAAD73D: Force dynamic rendering (geen static generation)
 */
export async function PUT(request: NextRequest) {
  try {
    // Controleer environment variabelen
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { rosterId, employeeId, serviceId, aantal, actief } = body;

    // Valideer verplichte velden
    if (!rosterId || !employeeId || !serviceId || typeof aantal !== 'number' || typeof actief !== 'boolean') {
      return NextResponse.json(
        { error: 'Ongeldige request body. Verplicht: rosterId, employeeId, serviceId, aantal (number), actief (boolean)' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert de dienst-toewijzing
    const { data, error } = await supabase
      .from('roster_employee_services')
      .upsert({
        roster_id: rosterId,
        employee_id: employeeId,
        service_id: serviceId,
        aantal,
        actief,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roster_id,employee_id,service_id',
        ignoreDuplicates: false
      })
      .select('aantal, actief, updated_at')
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json(
        { error: 'Fout bij opslaan dienst-toewijzing' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        aantal: data.aantal,
        actief: data.actief,
        updated_at: data.updated_at
      }
    });

  } catch (error) {
    console.error('Error in PUT /api/diensten-aanpassen:', error);
    return NextResponse.json(
      { error: 'Interne serverfout' },
      { status: 500 }
    );
  }
}
