/**
 * DRAAD45.3 - getCelDataClient Utility (CLIENT-SIDE)
 * 
 * Fix DRAAD61A - Verwijder de DAGDEEL_MAP, gebruik direct database letters: 'O', 'M', 'A'.
 */

import { supabase } from '@/lib/supabase';
import type { DagdeelStatus } from '@/lib/types/week-dagdelen';
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
  // Gebruik dagdeel direct als letter, niet converteren!
  console.log('[DRAAD61A] getCelDataClient START:', {
    rosterId: rosterId.substring(0, 8) + '...',
    dienstId,
    datum,
    dagdeel,
    team
  });
  try {
    // STAP 1: Find roster_period_staffing record
    const { data: rpsData, error: rpsError } = await supabase
      .from('roster_period_staffing')
      .select('id')
      .eq('roster_id', rosterId)
      .eq('service_id', dienstId)
      .eq('date', datum)
      .maybeSingle();
    if (rpsError) {
      console.error('[DRAAD61A] roster_period_staffing query error:', rpsError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    if (!rpsData) {
      console.log('[DRAAD61A] ⚠️  No roster_period_staffing match:', {
        rosterId: rosterId.substring(0, 8) + '...',
        dienstId,
        datum
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    console.log('[DRAAD61A] ✅ roster_period_staffing found:', {
      rpsId: rpsData.id.substring(0, 8) + '...'
    });
    // STAP 2: Find roster_period_staffing_dagdelen record
    const { data: dagdeelData, error: dagdeelError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('status, aantal')
      .eq('roster_period_staffing_id', rpsData.id)
      .eq('dagdeel', dagdeel) // Gebruikt nu direct de letter
      .eq('team', team)
      .maybeSingle();
    if (dagdeelError) {
      console.error('[DRAAD61A] roster_period_staffing_dagdelen query error:', dagdeelError);
      return { status: 'MAG_NIET', aantal: 0 };
    }
    if (!dagdeelData) {
      console.log('[DRAAD61A] ℹ️  No dagdelen match (team/dagdeel combination not exists):', {
        rpsId: rpsData.id.substring(0, 8) + '...',
        dagdeel,
        team
      });
      return { status: 'MAG_NIET', aantal: 0 };
    }
    // STAP 3: Return actual data
    const result: CelData = {
      status: dagdeelData.status as DagdeelStatus,
      aantal: dagdeelData.aantal
    };
    console.log('[DRAAD61A] ✅ SUCCESS - Cel data found:', {
      datum,
      dagdeel,
      team,
      result
    });
    return result;
  } catch (error) {
    console.error('[DRAAD61A] ❌ EXCEPTION in getCelDataClient:', {
      error: error instanceof Error ? error.message : String(error),
      input: { rosterId: rosterId.substring(0, 8) + '...', dienstId, datum, dagdeel, team }
    });
    // Fallback bij exception
    return { status: 'MAG_NIET', aantal: 0 };
  }
}