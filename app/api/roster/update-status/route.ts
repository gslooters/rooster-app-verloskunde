/**
 * API Route: POST /api/roster/update-status
 *
 * DRAAD223: Update roster status to 'in_progress' in Supabase
 *
 * Request:  { roster_id: string, status: string }
 * Response: { success: true, roster_id: string, status: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { roster_id, status } = await request.json();

    if (!roster_id || !status) {
      return NextResponse.json(
        { error: 'roster_id and status are required' },
        { status: 400 }
      );
    }

    // Only allow specific status values
    const allowedStatuses = ['draft', 'in_progress', 'completed', 'archived'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update roster status
    const { data, error } = await supabase
      .from('roosters')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', roster_id)
      .select('id, status')
      .single();

    if (error) {
      console.error('[DRAAD223] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update roster status' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Roster not found' },
        { status: 404 }
      );
    }

    console.log(`[DRAAD223] Roster ${roster_id} status updated to: ${status}`);

    return NextResponse.json(
      {
        success: true,
        roster_id: data.id,
        status: data.status,
        message: `Rooster status updated to '${status}'`
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[DRAAD223] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
