import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * DRAAD42 - API Route voor Dagdeel Updates
 * 
 * PUT /api/planning/dagdelen/[id]
 * Body: { aantal: number }
 * 
 * Functionaliteit:
 * - Update aantal voor specifiek dagdeel
 * - Validatie: aantal moet 0-9 zijn
 * - Auth via Supabase session
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Niet geautoriseerd' },
        { status: 401 }
      );
    }

    // Update database
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .update({ aantal })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { error: 'Fout bij opslaan in database', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Interne server fout' },
      { status: 500 }
    );
  }
}

// GET endpoint voor ophalen specifiek dagdeel (optioneel)
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
