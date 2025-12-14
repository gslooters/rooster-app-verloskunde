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
 * DRAAD178 FIX:
 * - Changed query to directly select from roster_period_staffing_dagdelen
 * - Direct filter on roster_id, service_id, date (no rpsData lookup)
 * - Removed intermediate roster_period_staffing lookup
 * - Dagdelen table now has roster_id and service_id columns
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
  
  // ✅ DRAAD178: Improved logging met alle parameters
  console.log('[DRAAD178] 🔍 getCelData START:', {
    rosterId: rosterId.substring(0, 8) + '...',
    dienstId,
    datum,
    dagdeel_input: dagdeel,
    dagdeel_mapped: dagdeelStr,
    team
  });
  
  try {
    const supabase = getSupabaseServer();
    
    // ✅ DRAAD178 FIX: Direct query to roster_period_staffing_dagdelen
    // Changed from: multi-step lookup via roster_period_staffing.id
    // To: Direct filter on roster_id, service_id, date columns
    // 
    // The dagdelen table now has these columns:
    // - roster_id (from parent rooster_period_staffing)
    // - service_id (from parent rooster_period_staffing)  
    // - date (from parent rooster_period_staffing)
    // This allows direct lookup without intermediate join
    
    const { data: dagdeelData, error: dagdeelError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('status, aantal')
      .eq('roster_id', rosterId)
      .eq('service_id', dienstId)
      .eq('date', datum)
      .eq('dagdeel', dagdeelStr)
      .eq('team', team)
      .maybeSingle();
    
    if (dagdeelError) {
      console.error('[DRAAD178] ❌ roster_period_staffing_dagdelen query error:', dagdeelError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    
    if (!dagdeelData) {
      console.log('[DRAAD178] ⚠️  No dagdelen match:', {
        rosterId: rosterId.substring(0, 8) + '...',
        dienstId,
        datum,
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
    
    console.log('[DRAAD178] ✅ SUCCESS - Cel data found:', {
      datum,
      dagdeel,
      team,
      status: result.status,
      aantal: result.aantal
    });
    
    return result;
    
  } catch (error) {
    console.error('[DRAAD178] ❌ EXCEPTION in getCelData:', {
      error: error instanceof Error ? error.message : String(error),
      input: { 
        rosterId: rosterId.substring(0, 8) + '...', 
        dienstId, 
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
