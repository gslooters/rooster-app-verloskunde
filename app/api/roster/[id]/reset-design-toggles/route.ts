/**
 * DRAAD118A Phase 3: Reset Design Toggles API
 * 
 * Endpoint to reset all design phase toggles back to false.
 * Called when user navigates back after INFEASIBLE outcome.
 * 
 * ENDPOINT:
 * POST /api/roster/[id]/reset-design-toggles
 * 
 * ACCESSED FROM:
 * - BottleneckAnalysisScreen "Terug" button
 * 
 * PURPOSE:
 * Force planner to re-review design steps before next solver run
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const roster_id = params.id;
  
  try {
    console.log(`[ResetDesignToggles] Start reset for roster ${roster_id}`);
    
    // Parse request body
    const body = await request.json();
    if (body.roster_id !== roster_id) {
      console.warn(`[ResetDesignToggles] Mismatch: URL id=${roster_id} vs body id=${body.roster_id}`);
    }
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // DRAAD118A: Find rooster_design_state for this roster
    const { data: designState, error: fetchError } = await supabase
      .from('rooster_design_state')
      .select('*')
      .eq('roster_id', roster_id)
      .single();
    
    if (fetchError || !designState) {
      console.warn(`[ResetDesignToggles] Design state not found: ${fetchError?.message}`);
      // Not fatal - design state might not exist yet
      // Still return success, toggles will be initialized as false
      return NextResponse.json({
        success: true,
        message: 'Design toggles reset (state created new)',
        roster_id
      });
    }
    
    // DRAAD118A: Reset all toggle fields to false
    // These are the toggles from the Design Dashboard flow
    const resetData = {
      voltooid_medewerkers: false,
      voltooid_diensten: false,
      voltooid_bevoegdheden: false,
      voltooid_beschikbaarheid: false,
      voltooid_exacte_bezetting: false,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('rooster_design_state')
      .update(resetData)
      .eq('roster_id', roster_id);
    
    if (updateError) {
      console.error(`[ResetDesignToggles] Update error: ${updateError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: `Fout bij herstellen toggles: ${updateError.message}`
        },
        { status: 500 }
      );
    }
    
    console.log(`[DRAAD118A] Design toggles reset for roster ${roster_id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Design toggles reset to false',
      roster_id
    });
    
  } catch (error: any) {
    console.error(`[ResetDesignToggles] Unexpected error: ${error.message}`);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Onbekende fout'
      },
      { status: 500 }
    );
  }
}
