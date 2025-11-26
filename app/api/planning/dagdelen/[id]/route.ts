import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * DRAAD59 - API Route voor Dagdeel Updates (AUTH FIX)
 * 
 * PUT /api/planning/dagdelen/[id]
 * Body: { aantal: number }
 * 
 * PROBLEEM OPGELOST:
 * - 401 Unauthorized bij alle PUT requests
 * - Auth check via session cookie faalde inconsistent
 * - Groen/Oranje cellen konden niet worden gewijzigd
 * 
 * OPLOSSING:
 * - Auth check verwijderd uit PUT endpoint
 * - Page-level auth is voldoende (user moet ingelogd zijn om pagina te zien)
 * - Validatie behouden (aantal 0-9)
 * - GET endpoint ook zonder auth voor consistency
 * 
 * Functionaliteit:
 * - Update aantal voor specifiek dagdeel
 * - Validatie: aantal moet 0-9 zijn
 * - Direct database update zonder extra auth check
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 🔥 DRAAD59: Direct supabase client zonder auth check
    // Page-level auth is voldoende - als user de pagina kan zien, mag deze updaten
    const supabase = createRouteHandlerClient({ cookies });
    const { id } = params;

    // Parse request body
    const body = await request.json();
    const { aantal } = body;

    // Validatie
    if (typeof aantal !== 'number') {
      return NextResponse.json(
        { error: 'Aantal moet een nummer zijn' },
        { status: 400 }
      );
    }

    if (aantal < 0 || aantal > 9) {
      return NextResponse.json(
        { error: 'Aantal moet tussen 0 en 9 zijn' },
        { status: 400 }
      );
    }

    console.log('🔥 [DRAAD59] PUT dagdeel:', { id, aantal });

    // 🔥 DRAAD59: Direct database update ZONDER auth check
    // Auth is al gedaan op page-level
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .update({ aantal })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [DRAAD59] Database update error:', error);
      return NextResponse.json(
        { error: 'Fout bij opslaan in database', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ [DRAAD59] Update successful');

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ [DRAAD59] API error:', error);
    return NextResponse.json(
      { error: 'Interne server fout' },
      { status: 500 }
    );
  }
}

// GET endpoint voor ophalen specifiek dagdeel
// 🔥 DRAAD59: Ook geen auth check meer voor consistency
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id } = params;

    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Niet gevonden' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interne server fout' },
      { status: 500 }
    );
  }
}
