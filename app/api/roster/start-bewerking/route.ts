/**
 * API Route: POST /api/roster/start-bewerking
 * 
 * DRAAD224: PLACEHOLDER for auto-fill roosterbewerking
 * Replaces GREEDY/Solver2 - Simply sets roster to 'in_progress'
 * 
 * Flow:
 * 1. Validate roster exists and is in 'draft' status
 * 2. Update roster status to 'in_progress'
 * 3. Return success
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface StartBewerkingRequest {
  roster_id: string;
}

interface StartBewerkingResponse {
  success: boolean;
  roster_id: string;
  message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { roster_id } = (await request.json()) as StartBewerkingRequest;

    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is required' },
        { status: 400 }
      );
    }

    console.log(`[DRAAD224] Starting roosterbewerking for roster ${roster_id}`);

    const supabase = await createClient();

    // Verify roster exists and is in draft status
    console.log(`[DRAAD224] Step 1: Verifying roster ${roster_id}...`);
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('*')
      .eq('id', roster_id)
      .single();

    if (rosterError || !roster) {
      console.error(`[DRAAD224] ✗ Roster not found: ${roster_id}`);
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    if (roster.status !== 'draft') {
      console.error(`[DRAAD224] ✗ Roster status is '${roster.status}', expected 'draft'`);
      return NextResponse.json(
        {
          error: `Roster status is '${roster.status}', must be 'draft'`,
        },
        { status: 400 }
      );
    }
    console.log(`[DRAAD224] ✓ Roster verified and in draft status`);

    // Update roster status to in_progress
    console.log(`[DRAAD224] Step 2: Updating roster status to in_progress...`);
    const { error: updateError } = await supabase
      .from('roosters')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roster_id);

    if (updateError) {
      console.error(`[DRAAD224] ✗ Failed to update roster status: ${updateError.message}`);
      return NextResponse.json(
        { error: `Failed to update roster: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[DRAAD224] ✓ Roster status updated: draft → in_progress`);

    const response: StartBewerkingResponse = {
      success: true,
      roster_id,
      message: 'Rooster succesvol gestart voor bewerking',
    };

    console.log(`[DRAAD224] ✓ Complete`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[DRAAD224] ✗ Error:', error);
    
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
