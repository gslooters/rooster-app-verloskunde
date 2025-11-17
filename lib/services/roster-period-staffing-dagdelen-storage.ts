// lib/services/roster-period-staffing-dagdelen-storage.ts
// ============================================================================
// DRAAD36A: Roster Period Staffing Dagdelen Storage
// Datum: 2025-11-17
// ============================================================================

import { supabase } from '@/lib/supabase';
import {
  RosterPeriodStaffingDagdeel,
  CreateDagdeelRegel,
  UpdateDagdeelRegel,
  Dagdeel,
  TeamDagdeel,
  DagdeelStatus,
  isValidDagdeel,
  isValidTeamDagdeel,
  isValidDagdeelStatus,
  isValidAantal
} from '@/lib/types/roster-period-staffing-dagdeel';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Maak één dagdeel regel aan
 */
export async function createDagdeelRegel(
  regel: CreateDagdeelRegel
): Promise<RosterPeriodStaffingDagdeel | null> {
  try {
    console.log('[createDagdeelRegel] Aanmaken regel:', regel);
    
    // Validatie
    if (!regel.roster_period_staffing_id) {
      throw new Error('roster_period_staffing_id is verplicht');
    }
    if (!isValidDagdeel(regel.dagdeel)) {
      throw new Error(`Ongeldige dagdeel: ${regel.dagdeel}`);
    }
    if (!isValidTeamDagdeel(regel.team)) {
      throw new Error(`Ongeldig team: ${regel.team}`);
    }
    if (!isValidDagdeelStatus(regel.status)) {
      throw new Error(`Ongeldige status: ${regel.status}`);
    }
    if (!isValidAantal(regel.aantal)) {
      throw new Error(`Ongeldig aantal: ${regel.aantal}`);
    }
    
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .insert(regel)
      .select()
      .single();
    
    if (error) {
      console.error('[createDagdeelRegel] Supabase error:', error);
      throw error;
    }
    
    console.log('[createDagdeelRegel] ✅ Regel aangemaakt:', data.id);
    return data as RosterPeriodStaffingDagdeel;
  } catch (err) {
    console.error('[createDagdeelRegel] ❌ Fout:', err);
    return null;
  }
}

/**
 * Bulk create dagdeel regels
 */
export async function bulkCreateDagdeelRegels(
  regels: CreateDagdeelRegel[]
): Promise<boolean> {
  if (!regels.length) {
    console.log('[bulkCreateDagdeelRegels] Geen regels om aan te maken');
    return true;
  }
  
  try {
    console.log('[bulkCreateDagdeelRegels] Aanmaken van', regels.length, 'regels');
    
    // Valideer alle regels
    for (const regel of regels) {
      if (!regel.roster_period_staffing_id) {
        throw new Error('Alle regels moeten roster_period_staffing_id hebben');
      }
      if (!isValidDagdeel(regel.dagdeel)) {
        throw new Error(`Ongeldige dagdeel: ${regel.dagdeel}`);
      }
      if (!isValidTeamDagdeel(regel.team)) {
        throw new Error(`Ongeldig team: ${regel.team}`);
      }
      if (!isValidDagdeelStatus(regel.status)) {
        throw new Error(`Ongeldige status: ${regel.status}`);
      }
      if (!isValidAantal(regel.aantal)) {
        throw new Error(`Ongeldig aantal: ${regel.aantal}`);
      }
    }
    
    // Batch insert in chunks van 100
    const chunkSize = 100;
    for (let i = 0; i < regels.length; i += chunkSize) {
      const chunk = regels.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('roster_period_staffing_dagdelen')
        .insert(chunk);
      
      if (error) {
        console.error('[bulkCreateDagdeelRegels] ❌ Supabase error:', error);
        throw error;
      }
      
      console.log(`[bulkCreateDagdeelRegels] ✅ Chunk ${Math.floor(i / chunkSize) + 1} aangemaakt`);
    }
    
    console.log('[bulkCreateDagdeelRegels] ✅ Alle regels succesvol aangemaakt');
    return true;
  } catch (err) {
    console.error('[bulkCreateDagdeelRegels] ❌ Fout:', err);
    return false;
  }
}

// ============================================================================
// READ
// ============================================================================

/**
 * Haal alle dagdeel regels op voor een roster_period_staffing record
 */
export async function getDagdeelRegels(
  rosterPeriodStaffingId: string
): Promise<RosterPeriodStaffingDagdeel[]> {
  try {
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('roster_period_staffing_id', rosterPeriodStaffingId)
      .order('team', { ascending: true })
      .order('dagdeel', { ascending: true });
    
    if (error) {
      console.error('[getDagdeelRegels] Supabase error:', error);
      throw error;
    }
    
    return (data || []) as RosterPeriodStaffingDagdeel[];
  } catch (err) {
    console.error('[getDagdeelRegels] Fout:', err);
    return [];
  }
}

/**
 * Haal specifieke dagdeel regel op
 */
export async function getDagdeelRegel(
  rosterPeriodStaffingId: string,
  dagdeel: Dagdeel,
  team: TeamDagdeel
): Promise<RosterPeriodStaffingDagdeel | null> {
  try {
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('roster_period_staffing_id', rosterPeriodStaffingId)
      .eq('dagdeel', dagdeel)
      .eq('team', team)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    
    return data as RosterPeriodStaffingDagdeel;
  } catch (err) {
    console.error('[getDagdeelRegel] Fout:', err);
    return null;
  }
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update een dagdeel regel
 */
export async function updateDagdeelRegel(
  id: string,
  updates: UpdateDagdeelRegel
): Promise<boolean> {
  try {
    console.log('[updateDagdeelRegel] Updaten regel:', id, updates);
    
    // Validatie
    if (updates.status && !isValidDagdeelStatus(updates.status)) {
      throw new Error(`Ongeldige status: ${updates.status}`);
    }
    if (updates.aantal !== undefined && !isValidAantal(updates.aantal)) {
      throw new Error(`Ongeldig aantal: ${updates.aantal}`);
    }
    
    const { error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('[updateDagdeelRegel] Supabase error:', error);
      throw error;
    }
    
    console.log('[updateDagdeelRegel] ✅ Regel geüpdatet');
    return true;
  } catch (err) {
    console.error('[updateDagdeelRegel] ❌ Fout:', err);
    return false;
  }
}

/**
 * Update dagdeel regel met status + aantal
 * Zet automatisch status op AANGEPAST als van defaults afgeweken wordt
 */
export async function updateDagdeelRegelSmart(
  id: string,
  nieuweStatus: DagdeelStatus,
  nieuwAantal: number,
  huidigeRegel: RosterPeriodStaffingDagdeel
): Promise<{ success: boolean; waarschuwing?: string }> {
  try {
    console.log('[updateDagdeelRegelSmart] Smart update:', { id, nieuweStatus, nieuwAantal });
    
    // Bepaal of waarschuwing nodig is
    let waarschuwing: string | undefined;
    
    // MOET → 0: waarschuwing
    if (huidigeRegel.status === 'MOET' && nieuwAantal === 0) {
      waarschuwing = 'Let op: verplichte bezetting wordt op 0 gezet!';
    }
    
    // MAG_NIET → >0: waarschuwing
    if (huidigeRegel.status === 'MAG_NIET' && nieuwAantal > 0) {
      waarschuwing = 'Let op: niet-toegestane bezetting krijgt waarde >0!';
    }
    
    // Bepaal finale status
    let finaleStatus = nieuweStatus;
    
    // Als afgeweken van default: zet op AANGEPAST
    const isAfwijking = 
      (huidigeRegel.status === 'MOET' && nieuwAantal !== 1) ||
      (huidigeRegel.status === 'MAG' && nieuwAantal !== 1) ||
      (huidigeRegel.status === 'MAG_NIET' && nieuwAantal !== 0);
    
    if (isAfwijking && nieuweStatus !== 'AANGEPAST') {
      finaleStatus = 'AANGEPAST';
      console.log('[updateDagdeelRegelSmart] Afwijking gedetecteerd, status → AANGEPAST');
    }
    
    const success = await updateDagdeelRegel(id, {
      status: finaleStatus,
      aantal: nieuwAantal
    });
    
    return { success, waarschuwing };
  } catch (err) {
    console.error('[updateDagdeelRegelSmart] ❌ Fout:', err);
    return { success: false };
  }
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Verwijder alle dagdeel regels voor een roster_period_staffing record
 */
export async function deleteDagdeelRegels(
  rosterPeriodStaffingId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .delete()
      .eq('roster_period_staffing_id', rosterPeriodStaffingId);
    
    if (error) {
      console.error('[deleteDagdeelRegels] Supabase error:', error);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('[deleteDagdeelRegels] Fout:', err);
    return false;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Haal alle dagdeel regels op voor een volledig rooster (meerdere datums)
 */
export async function getDagdeelRegelsVoorRooster(
  rosterId: string
): Promise<Map<string, RosterPeriodStaffingDagdeel[]>> {
  try {
    // Eerst alle roster_period_staffing IDs ophalen
    const { data: rpsData, error: rpsError } = await supabase
      .from('roster_period_staffing')
      .select('id, service_id, date')
      .eq('roster_id', rosterId);
    
    if (rpsError) throw rpsError;
    
    if (!rpsData || rpsData.length === 0) {
      return new Map();
    }
    
    const rpsIds = rpsData.map(r => r.id);
    
    // Haal alle dagdeel regels op
    const { data: dagdeelData, error: dagdeelError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .in('roster_period_staffing_id', rpsIds);
    
    if (dagdeelError) throw dagdeelError;
    
    // Groepeer per roster_period_staffing_id
    const resultMap = new Map<string, RosterPeriodStaffingDagdeel[]>();
    
    for (const rps of rpsData) {
      const regelsVoorRps = (dagdeelData || []).filter(
        d => d.roster_period_staffing_id === rps.id
      ) as RosterPeriodStaffingDagdeel[];
      
      resultMap.set(rps.id, regelsVoorRps);
    }
    
    return resultMap;
  } catch (err) {
    console.error('[getDagdeelRegelsVoorRooster] Fout:', err);
    return new Map();
  }
}
