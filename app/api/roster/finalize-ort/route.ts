/**
 * API Route: POST /api/roster/finalize-ort
 * 
 * DRAAD106: Finalize ORT Output
 * 
 * Doel: Converteer ORT voorlopige planning (status 0 + service_id) naar
 * fixed planning (status 1 + service_id).
 * 
 * Workflow:
 * 1. Valideer roster status = 'in_progress'
 * 2. Update: status 0 → 1 waar service_id IS NOT NULL
 * 3. Status 2 (blokkering) blijft staan
 * 4. Roster status blijft 'in_progress' (niet naar 'final')
 * 5. Optioneel: Genereer rapport
 * 
 * Usage:
 * - Na ORT run (solve)
 * - Voor planner handmatige wijzigingen maakt
 * - Planner heeft ORT output geïnspecteerd en goedgekeurd
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/roster/finalize-ort
 * 
 * Body: { roster_id: number }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Parse request
    const { roster_id } = await request.json();
    
    if (!roster_id) {
      return NextResponse.json(
        { error: 'roster_id is verplicht' },
        { status: 400 }
      );
    }
    
    console.log(`[Finalize ORT] Start finalize voor roster ${roster_id}`);
    
    // 2. Initialiseer Supabase client
    const supabase = await createClient();
    
    // 3. Fetch roster
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, status')
      .eq('id', roster_id)
      .single();
    
    if (rosterError || !roster) {
      console.error('[Finalize ORT] Roster not found:', rosterError);
      return NextResponse.json(
        { error: 'Roster niet gevonden' },
        { status: 404 }
      );
    }
    
    // 4. Valideer roster status
    if (roster.status !== 'in_progress') {
      return NextResponse.json(
        { 
          error: `Roster status is '${roster.status}', moet 'in_progress' zijn voor finalize`,
          hint: "ORT moet eerst gedraaid zijn (POST /api/roster/solve)"
        },
        { status: 400 }
      );
    }
    
    console.log(`[Finalize ORT] Roster status verified: ${roster.status}`);
    
    // 5. Finaliseer: status 0 → 1 waar service_id IS NOT NULL
    const { data: finalized, error: finalizeError } = await supabase
      .from('roster_assignments')
      .update({ status: 1 })
      .eq('roster_id', roster_id)
      .eq('status', 0)
      .not('service_id', 'is', null)
      .select();
    
    if (finalizeError) {
      console.error('[Finalize ORT] Fout bij finaliseren:', finalizeError);
      return NextResponse.json(
        { error: 'Fout bij finaliseren ORT output' },
        { status: 500 }
      );
    }
    
    const finalizedCount = finalized?.length || 0;
    console.log(`[Finalize ORT] ${finalizedCount} assignments gefinaliseerd (status 0 → 1)`);
    
    // 6. Optioneel: Tel status 2 (blijft staan)
    const { count: blockedCount } = await supabase
      .from('roster_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('roster_id', roster_id)
      .eq('status', 2);
    
    console.log(`[Finalize ORT] ${blockedCount || 0} status 2 records (blokkering handhaaft)`);
    
    // 7. Roster status blijft 'in_progress' (NIET naar 'final')
    // Planner kan nog handmatige wijzigingen maken
    
    // 8. Optioneel: Genereer rapport (TODO)
    // const report = await generateSolverReport(roster_id);
    
    const totalTime = Date.now() - startTime;
    console.log(`[Finalize ORT] Voltooid in ${totalTime}ms`);
    
    // 9. Return response
    return NextResponse.json({
      success: true,
      roster_id,
      finalized_count: finalizedCount,
      blocked_count: blockedCount || 0,
      roster_status: 'in_progress',
      message: `${finalizedCount} ORT assignments gefinaliseerd. Roster blijft 'in_progress' voor handmatige wijzigingen.`,
      total_time_ms: totalTime
    });
    
  } catch (error: any) {
    console.error('[Finalize ORT] Onverwachte fout:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Onbekende fout',
        type: error.name || 'Error'
      },
      { status: 500 }
    );
  }
}
