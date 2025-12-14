// lib/services/roster-period-staffing-dagdelen-storage.ts
// ============================================================================
// DRAAD176: Roster Period Staffing Dagdelen Storage (DENORMALISERING)
// Datum: 2025-12-14
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
  isValidAantal,
  isValidUUID,
  isValidISODate
} from '@/lib/types/roster-period-staffing-dagdeel';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Maak één dagdeel regel aan (DRAAD176: Denormalisering)
 */
export async function createDagdeelRegel(
  regel: CreateDagdeelRegel
): Promise<RosterPeriodStaffingDagdeel | null> {
  try {
    console.log('[createDagdeelRegel] Aanmaken regel:', regel);
    
    // Validatie (DRAAD176: Nieuwe velden)
    if (!isValidUUID(regel.roster_id)) {
      throw new Error('roster_id is verplicht en moet geldige UUID zijn');
    }
    if (!isValidUUID(regel.service_id)) {
      throw new Error('service_id is verplicht en moet geldige UUID zijn');
    }
    if (!isValidISODate(regel.date)) {
      throw new Error('date is verplicht (YYYY-MM-DD format)');
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
    
    const insertPayload = {
      roster_id: regel.roster_id,
      service_id: regel.service_id,
      date: regel.date,
      dagdeel: regel.dagdeel,
      team: regel.team,
      status: regel.status,
      aantal: regel.aantal,
      invulling: regel.invulling ?? 0
    };
    
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .insert(insertPayload)
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
 * DRAAD176: Bulk create dagdeel regels (DENORMALISERING)
 * Gebruikt directe inserts (geen parent tabel meer)
 */
export async function bulkCreateDagdeelRegels(
  regels: CreateDagdeelRegel[]
): Promise<boolean> {
  if (!regels.length) {
    console.log('[bulkCreateDagdeelRegels] Geen regels om aan te maken');
    return true;
  }
  
  try {
    console.log('[bulkCreateDagdeelRegels] Aanmaken van', regels.length, 'regels (DRAAD176)');
    
    // Valideer alle regels
    for (let i = 0; i < regels.length; i++) {
      const regel = regels[i];
      if (!isValidUUID(regel.roster_id)) {
        throw new Error(`Regel ${i}: roster_id is verplicht UUID`);
      }
      if (!isValidUUID(regel.service_id)) {
        throw new Error(`Regel ${i}: service_id is verplicht UUID`);
      }
      if (!isValidISODate(regel.date)) {
        throw new Error(`Regel ${i}: date moet YYYY-MM-DD zijn`);
      }
      if (!isValidDagdeel(regel.dagdeel)) {
        throw new Error(`Regel ${i}: Ongeldige dagdeel: ${regel.dagdeel}`);
      }
      if (!isValidTeamDagdeel(regel.team)) {
        throw new Error(`Regel ${i}: Ongeldig team: ${regel.team}`);
      }
      if (!isValidDagdeelStatus(regel.status)) {
        throw new Error(`Regel ${i}: Ongeldige status: ${regel.status}`);
      }
      if (!isValidAantal(regel.aantal)) {
        throw new Error(`Regel ${i}: Ongeldig aantal: ${regel.aantal}`);
      }
    }
    
    // Batch insert in chunks van 100 (Supabase limit)
    const chunkSize = 100;
    const insertPayloads = regels.map(r => ({
      roster_id: r.roster_id,
      service_id: r.service_id,
      date: r.date,
      dagdeel: r.dagdeel,
      team: r.team,
      status: r.status,
      aantal: r.aantal,
      invulling: r.invulling ?? 0
    }));
    
    for (let i = 0; i < insertPayloads.length; i += chunkSize) {
      const chunk = insertPayloads.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('roster_period_staffing_dagdelen')
        .insert(chunk);
      
      if (error) {
        console.error('[bulkCreateDagdeelRegels] ❌ Chunk error:', error);
        throw error;
      }
      
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(insertPayloads.length / chunkSize);
      console.log(`[bulkCreateDagdeelRegels] ✅ Chunk ${chunkNum}/${totalChunks} aangemaakt (${chunk.length} records)`);
    }
    
    console.log('[bulkCreateDagdeelRegels] ✅ Alle', regels.length, 'regels succesvol aangemaakt');
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
 * DRAAD176: Haal alle dagdeel regels op voor een specifieke dag + dienst
 */
export async function getDagdeelRegelsPerDag(
  rosterId: string,
  date: string,
  serviceId: string
): Promise<RosterPeriodStaffingDagdeel[]> {
  try {
    if (!isValidUUID(rosterId) || !isValidUUID(serviceId) || !isValidISODate(date)) {
      throw new Error('Ongeldige parameters');
    }
    
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('roster_id', rosterId)
      .eq('date', date)
      .eq('service_id', serviceId)
      .order('team', { ascending: true })
      .order('dagdeel', { ascending: true });
    
    if (error) {
      console.error('[getDagdeelRegelsPerDag] Supabase error:', error);
      throw error;
    }
    
    return (data || []) as RosterPeriodStaffingDagdeel[];
  } catch (err) {
    console.error('[getDagdeelRegelsPerDag] Fout:', err);
    return [];
  }
}

/**
 * DRAAD176: Haal specifieke dagdeel regel op
 */
export async function getDagdeelRegel(
  rosterId: string,
  date: string,
  serviceId: string,
  dagdeel: Dagdeel,
  team: TeamDagdeel
): Promise<RosterPeriodStaffingDagdeel | null> {
  try {
    if (!isValidUUID(rosterId) || !isValidUUID(serviceId) || !isValidISODate(date)) {
      throw new Error('Ongeldige parameters');
    }
    if (!isValidDagdeel(dagdeel) || !isValidTeamDagdeel(team)) {
      throw new Error('Ongeldige dagdeel of team');
    }
    
    const { data, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('roster_id', rosterId)
      .eq('date', date)
      .eq('service_id', serviceId)
      .eq('dagdeel', dagdeel)
      .eq('team', team)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[getDagdeelRegel] Record niet gevonden');
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
    if (updates.invulling !== undefined && updates.invulling < 0) {
      throw new Error(`Invulling mag niet negatief zijn`);
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
 * DRAAD176: Verwijder alle dagdeel regels voor een rooster
 */
export async function deleteDagdeelRegelsVoorRooster(
  rosterId: string
): Promise<boolean> {
  try {
    if (!isValidUUID(rosterId)) {
      throw new Error('Ongeldige rosterId');
    }
    
    const { error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .delete()
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('[deleteDagdeelRegelsVoorRooster] Supabase error:', error);
      throw error;
    }
    
    console.log('[deleteDagdeelRegelsVoorRooster] ✅ Alle dagdelen voor rooster verwijderd');
    return true;
  } catch (err) {
    console.error('[deleteDagdeelRegelsVoorRooster] ❌ Fout:', err);
    return false;
  }
}

/**
 * DRAAD176: Verwijder alle dagdeel regels voor specifieke dag + dienst
 */
export async function deleteDagdeelRegelsPerDag(
  rosterId: string,
  date: string,
  serviceId: string
): Promise<boolean> {
  try {
    if (!isValidUUID(rosterId) || !isValidUUID(serviceId) || !isValidISODate(date)) {
      throw new Error('Ongeldige parameters');
    }
    
    const { error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .delete()
      .eq('roster_id', rosterId)
      .eq('date', date)
      .eq('service_id', serviceId);
    
    if (error) {
      console.error('[deleteDagdeelRegelsPerDag] Supabase error:', error);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('[deleteDagdeelRegelsPerDag] Fout:', err);
    return false;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * DRAAD176: Haal alle dagdeel regels op voor een volledig rooster
 * DENORMALISERING: Direct uit roster_period_staffing_dagdelen (geen parent tabel meer)
 */
export async function getDagdeelRegelsVoorRooster(
  rosterId: string
): Promise<Map<string, RosterPeriodStaffingDagdeel[]>> {
  try {
    console.log('[getDagdeelRegelsVoorRooster] Ophalen voor rosterId:', rosterId);
    
    if (!isValidUUID(rosterId)) {
      throw new Error('Ongeldige rosterId');
    }
    
    // DRAAD176: Direct uit child tabel (geen parent join meer!)
    const { data: dagdeelData, error: dagdeelError } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*')
      .eq('roster_id', rosterId)
      .order('date', { ascending: true })
      .order('service_id', { ascending: true })
      .order('dagdeel', { ascending: true })
      .order('team', { ascending: true });
    
    if (dagdeelError) {
      console.error('[getDagdeelRegelsVoorRooster] Supabase error:', dagdeelError);
      throw dagdeelError;
    }
    
    if (!dagdeelData || dagdeelData.length === 0) {
      console.log('[getDagdeelRegelsVoorRooster] Geen records gevonden');
      return new Map();
    }
    
    // DRAAD176: Groepeer naar (date|service_id) combinatie (vervang oude parent ID grouping)
    const resultMap = new Map<string, RosterPeriodStaffingDagdeel[]>();
    
    for (const record of dagdeelData) {
      // Key: "date|service_id"
      const key = `${record.date}|${record.service_id}`;
      
      if (!resultMap.has(key)) {
        resultMap.set(key, []);
      }
      resultMap.get(key)!.push(record as RosterPeriodStaffingDagdeel);
    }
    
    console.log('[getDagdeelRegelsVoorRooster] ✅ Fetched', dagdeelData.length, 'records');
    console.log('[getDagdeelRegelsVoorRooster] Grouped into', resultMap.size, 'date|service combinations');
    
    return resultMap;
  } catch (err) {
    console.error('[getDagdeelRegelsVoorRooster] ❌ Fout:', err);
    return new Map();
  }
}

/**
 * DRAAD176: Haal totale dagdeel count op voor rooster
 */
export async function getDagdeelCountVoorRooster(
  rosterId: string
): Promise<number> {
  try {
    if (!isValidUUID(rosterId)) {
      throw new Error('Ongeldige rosterId');
    }
    
    const { count, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*', { count: 'exact', head: true })
      .eq('roster_id', rosterId);
    
    if (error) throw error;
    
    return count ?? 0;
  } catch (err) {
    console.error('[getDagdeelCountVoorRooster] Fout:', err);
    return 0;
  }
}
