/**
 * DRAAD45.3 - getCelDataClient Utility (CLIENT-SIDE)
 * 
 * Client-side variant van getCelData voor gebruik in React components
 * 
 * VERSCHIL met server-side getCelData:
 * - Gebruikt supabase client ipv supabase server
 * - Kan aangeroepen worden vanuit browser/React components
 * - Gebruikt NEXT_PUBLIC env vars
 * 
 * DOEL:
 * Haal unieke data op per cel via roster_period_staffing + dagdelen join
 * 
 * INPUT:
 * - rosterId: UUID van rooster
 * - dienstId: service_id uit service_types (bijv. 'CONS', 'POL', 'ECHO')
 * - datum: ISO date string (YYYY-MM-DD)
 * - dagdeel: 'O' | 'M' | 'A' (Ochtend/Middag/Avond)
 * - team: 'GRO' | 'ORA' | 'TOT'
 * 
 * OUTPUT:
 * - { status: DagdeelStatus, aantal: number }
 * - Bij geen match: { status: 'MAG_NIET', aantal: 0 }
 * 
 * DATAFLOW:
 * 1. Find roster_period_staffing WHERE roster_id + service_id + date
 * 2. Find roster_period_staffing_dagdelen WHERE rps.id + dagdeel + team
 * 3. Return {status, aantal} of fallback
 */

import { supabase } from '@/lib/supabase';
import type { DagdeelStatus } from '@/lib/types/week-dagdelen';

// Dagdeel mapping: UI code → Database waarde
const DAGDEEL_MAP: Record<'O' | 'M' | 'A', string> = {
  'O': 'ochtend',
  'M': 'middag',
  'A': 'avond'
};

/**
 * Interface voor cel data result
 */
export interface CelData {
  status: DagdeelStatus;
  aantal: number;
}

/**
 * Get cel data via database lookup (CLIENT-SIDE)
 * 
 * @param rosterId - UUID van rooster
 * @param dienstId - service_id uit service_types
 * @param datum - ISO date (YYYY-MM-DD)
 * @param dagdeel - 'O' | 'M' | 'A'
 * @param team - 'GRO' | 'ORA' | 'TOT'
 * @returns CelData object met status en aantal
 */
export async function getCelDataClient(
  rosterId: string,
  dienstId: string,
  datum: string,
  dagdeel: 'O' | 'M' | 'A',
  team: 'GRO' | 'ORA' | 'TOT'
): Promise<CelData> {
  
  const dagdeelStr = DAGDEEL_MAP[dagdeel];
  
  console.log('[DRAAD45] getCelDataClient START:', {
    rosterId: rosterId.substring(0, 8) + '...',
    dienstId,
    datum,
    dagdeel,
    dagdeelStr,
    team
  });
  
  try {
    // STAP 1: Find roster_period_staffing record
    // Match op: roster_id + service_id + date
    const { data: rpsData, error: rpsError } = await supabase
      .from('roster_period_staffing')
      .select('id')
      .eq('roster_id', rosterId)
      .eq('service_id', dienstId)
      .eq('date', datum)
      .maybeSingle(); // maybeSingle instead of single (no error when not found)
    
    if (rpsError) {
      console.error('[DRAAD45] roster_period_staffing query error:', rpsError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    if (!rpsData) {
      console.log('[DRAAD45] ⚠️  No roster_period_staffing match:', {
        rosterId: rosterId.substring(0, 8) + '...',
        dienstId,
        datum
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    console.log('[DRAAD45] ✅ roster_period_staffing found:', {
      rpsId: rpsData.id.substring(0, 8) + '...'
    });
    
    // STAP 2: Find roster_period_staffing_dagdelen record
    // Match op: roster_period_staffing_id + dagdeel + team
    const { data: dagdeelData, error: dagdeelError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('status, aantal')
      .eq('roster_period_staffing_id', rpsData.id)
      .eq('dagdeel', dagdeelStr)
      .eq('team', team)
      .maybeSingle();
    
    if (dagdeelError) {
      console.error('[DRAAD45] roster_period_staffing_dagdelen query error:', dagdeelError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    if (!dagdeelData) {
      console.log('[DRAAD45] ℹ️  No dagdelen match (team/dagdeel combination not exists):', {
        rpsId: rpsData.id.substring(0, 8) + '...',
        dagdeel: dagdeelStr,
        team
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    // STAP 3: Return actual data
    const result: CelData = {
      status: dagdeelData.status as DagdeelStatus,
      aantal: dagdeelData.aantal
    };
    
    console.log('[DRAAD45] ✅ SUCCESS - Cel data found:', {
      datum,
      dagdeel,
      team,
      result
    });
    
    return result;
    
  } catch (error) {
    console.error('[DRAAD45] ❌ EXCEPTION in getCelDataClient:', {
      error: error instanceof Error ? error.message : String(error),
      input: { rosterId: rosterId.substring(0, 8) + '...', dienstId, datum, dagdeel, team }
    });
    
    // Fallback bij exception
    return { status: 'MAG_NIET', aantal: 0 };
  }
}
