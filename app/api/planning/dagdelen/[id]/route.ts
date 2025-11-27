import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * DRAAD65A - API Route voor Dagdeel Updates met STATUS AANGEPAST
 * 
 * PUT /api/planning/dagdelen/[id]
 * Body: { aantal: number }
 * 
 * NIEUW IN DRAAD65A:
 * - Bij elke wijziging van 'aantal' wordt status automatisch 'AANGEPAST'
 * - Status blijft 'AANGEPAST' ook na meerdere wijzigingen (keep it simple)
 * 
 * Eerdere functionaliteit (DRAAD59):
 * - Auth check verwijderd (page-level auth voldoende)
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

    console.log('🔥 [DRAAD65A] PUT dagdeel:', { id, aantal });

    // 🔥 DRAAD65A: Update aantal EN status naar 'AANGEPAST'
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .update({ 
        aantal,
        status: 'AANGEPAST'  // ⭐ NIEUW: Status automatisch aanpassen
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [DRAAD65A] Database update error:', error);
      return NextResponse.json(
        { error: 'Fout bij opslaan in database', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ [DRAAD65A] Update successful - status set to AANGEPAST');

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ [DRAAD65A] API error:', error);
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
