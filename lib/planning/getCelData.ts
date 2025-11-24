/**
 * DRAAD46 - getCelData Utility (FIXED)
 * 
 * Centrale functie voor cel-level database lookup in week dagdelen view
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
 * 
 * DRAAD46 FIX:
 * - DAGDEEL_MAP nu direct 'O'/'M'/'A' (was 'ochtend'/'middag'/'avond')
 * - Database gebruikt nu ook 'O'/'M'/'A' als waarden
 * - Verbeterde debug logging met dagdeel/team info
 */

import { getSupabaseServer } from '@/lib/supabase-server';
import type { DagdeelStatus } from '@/lib/types/week-dagdelen';

// ✅ DRAAD46 FIX: Database gebruikt nu direct 'O', 'M', 'A'
// Dagdeel mapping: UI code → Database waarde (nu 1-op-1)
const DAGDEEL_MAP: Record<'O' | 'M' | 'A', string> = {
  'O': 'O',  // Ochtend
  'M': 'M',  // Middag
  'A': 'A'   // Avond
};

/**
 * Interface voor cel data result
 */
export interface CelData {
  status: DagdeelStatus;
  aantal: number;
}

/**
 * Get cel data via database lookup
 * 
 * @param rosterId - UUID van rooster
 * @param dienstId - service_id uit service_types
 * @param datum - ISO date (YYYY-MM-DD)
 * @param dagdeel - 'O' | 'M' | 'A'
 * @param team - 'GRO' | 'ORA' | 'TOT'
 * @returns CelData object met status en aantal
 */
export async function getCelData(
  rosterId: string,
  dienstId: string,
  datum: string,
  dagdeel: 'O' | 'M' | 'A',
  team: 'GRO' | 'ORA' | 'TOT'
): Promise<CelData> {
  
  const dagdeelStr = DAGDEEL_MAP[dagdeel];
  
  // ✅ DRAAD46: Verbeterde logging met alle parameters
  console.log('[DRAAD46] 🔍 getCelData START:', {
    rosterId: rosterId.substring(0, 8) + '...',
    dienstId: dienstId.substring(0, 8) + '...',
    datum,
    dagdeel_input: dagdeel,
    dagdeel_mapped: dagdeelStr,
    team
  });
  
  try {
    const supabase = getSupabaseServer();
    
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
      console.error('[DRAAD46] ❌ roster_period_staffing query error:', rpsError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    if (!rpsData) {
      console.log('[DRAAD46] ⚠️  No roster_period_staffing match:', {
        rosterId: rosterId.substring(0, 8) + '...',
        dienstId: dienstId.substring(0, 8) + '...',
        datum
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    console.log('[DRAAD46] ✅ roster_period_staffing found:', {
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
      console.error('[DRAAD46] ❌ roster_period_staffing_dagdelen query error:', dagdeelError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    if (!dagdeelData) {
      console.log('[DRAAD46] ⚠️  No dagdelen match:', {
        rpsId: rpsData.id.substring(0, 8) + '...',
        dagdeel_searched: dagdeelStr,
        team_searched: team,
        hint: 'Controleer of deze combinatie bestaat in roster_period_staffing_dagdelen'
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    // STAP 3: Return actual data
    const result: CelData = {
      status: dagdeelData.status as DagdeelStatus,
      aantal: dagdeelData.aantal
    };
    
    console.log('[DRAAD46] ✅ SUCCESS - Cel data found:', {
      datum,
      dagdeel,
      team,
      status: result.status,
      aantal: result.aantal
    });
    
    return result;
    
  } catch (error) {
    console.error('[DRAAD46] ❌ EXCEPTION in getCelData:', {
      error: error instanceof Error ? error.message : String(error),
      input: { 
        rosterId: rosterId.substring(0, 8) + '...', 
        dienstId: dienstId.substring(0, 8) + '...', 
        datum, 
        dagdeel, 
        team 
      }
    });
    
    // Fallback bij exception
    return { status: 'MAG_NIET', aantal: 0 };
  }
}

/**
 * Batch variant voor toekomstige performance optimalisatie (DRAAD46)
 * 
 * TODO: Implement batch query voor alle cellen van een week in 1 call
 * Dit reduceert database round-trips van ~63 naar 1-2 queries
 */
export async function getCelDataBatch(
  rosterId: string,
  diensten: Array<{ dienstId: string; datum: string }>,
  dagdeel: 'O' | 'M' | 'A',
  teams: Array<'GRO' | 'ORA' | 'TOT'>
): Promise<Map<string, CelData>> {
  // TODO: DRAAD46 implementation
  throw new Error('Batch query not yet implemented - use getCelData for now');
}
