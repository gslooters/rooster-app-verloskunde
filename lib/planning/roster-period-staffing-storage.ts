// lib/planning/roster-period-staffing-storage.ts
// Opslaglaag: TypeScript functies voor Supabase interactie (Diensten per Dag)
// DRAAD36A: Uitgebreid met dagdelen generatie
// DRAAD63: UTC-safe datum generatie (fix timezone bug)

import { supabase } from '@/lib/supabase';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';
import { bulkCreateDagdeelRegels } from '@/lib/services/roster-period-staffing-dagdelen-storage';
import {
  CreateDagdeelRegel,
  DAGBLOK_NAAR_DAGDEEL,
  TEAM_NAAR_TEAM_DAGDEEL,
  DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS,
  DEFAULT_AANTAL_PER_STATUS
} from '@/lib/types/roster-period-staffing-dagdeel';
import { DagCode, DagblokCode, DagblokStatus, TeamRegels } from '@/lib/types/service';
import { parseUTCDate, toUTCDateString, addUTCDays, getUTCDaysDiff } from '@/lib/utils/date-utc';

export interface RosterPeriodStaffing {
  id: string;
  roster_id: string;
  service_id: string;
  date: string; // "2025-11-24"
  min_staff: number;
  max_staff: number;
  team_tot: boolean | null;
  team_gro: boolean | null;
  team_ora: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Helper functie: Valideer UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Helper functie: Valideer UUID format (strict)
 */
function validateId(id: string, fieldName: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`Ongeldig ${fieldName}: "${id}" (moet een string zijn)`);
  }
  if (!isValidUUID(id)) {
    throw new Error(
      `Ongeldig ${fieldName} format: "${id}". ` +
      `Moet een geldige UUID zijn (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)`
    );
  }
}

/**
 * Helper functie: Valideer ISO8601 date format (YYYY-MM-DD)
 */
function isValidISODate(dateStr: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateStr)) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Helper functie: Convert JavaScript day (0=Sun) naar DagCode (ma/di/wo/do/vr/za/zo)
 */
function getDagCodeFromDate(date: Date): DagCode {
  const day = date.getUTCDay();  // DRAAD63: Use UTC day
  const dagCodes: DagCode[] = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  return dagCodes[day];
}

export async function getRosterPeriodStaffing(rosterId: string): Promise<RosterPeriodStaffing[]> {
  try {
    console.log('[getRosterPeriodStaffing] Fetching data for rosterId:', rosterId);
    validateId(rosterId, 'rosterId');
    console.log('[getRosterPeriodStaffing] ✓ RosterId validated (UUID format)');
    
    const { data, error } = await supabase
      .from('roster_period_staffing')
      .select('*')
      .eq('roster_id', rosterId)
      .order('date', { ascending: true })
      .order('service_id', { ascending: true });
    
    if (error) {
      console.error('[getRosterPeriodStaffing] Supabase error:', error);
      throw new Error(`Database fout: ${error.message}`);
    }
    
    console.log('[getRosterPeriodStaffing] Records opgehaald:', data?.length || 0);
    return data as RosterPeriodStaffing[] || [];
  } catch (err) {
    console.error('[getRosterPeriodStaffing] Unexpected error:', err);
    throw err;
  }
}

export async function updateRosterPeriodStaffingMinMax(id: string, min: number, max: number): Promise<void> {
  try {
    console.log('[updateRosterPeriodStaffingMinMax] Updating id:', id, 'min:', min, 'max:', max);
    validateId(id, 'id');
    
    if (typeof min !== 'number' || min < 0) {
      throw new Error(`Ongeldige min_staff waarde: ${min} (moet een positief getal zijn)`);
    }
    if (typeof max !== 'number' || max < 0) {
      throw new Error(`Ongeldige max_staff waarde: ${max} (moet een positief getal zijn)`);
    }
    if (min > max) {
      throw new Error(`min_staff (${min}) kan niet groter zijn dan max_staff (${max})`);
    }
    
    console.log('[updateRosterPeriodStaffingMinMax] ✓ Parameters validated');
    
    const { error } = await supabase
      .from('roster_period_staffing')
      .update({ 
        min_staff: min, 
        max_staff: max,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) {
      console.error('[updateRosterPeriodStaffingMinMax] Supabase error:', error);
      throw new Error(`Update fout: ${error.message}`);
    }
    
    console.log('[updateRosterPeriodStaffingMinMax] Update succesvol');
  } catch (err) {
    console.error('[updateRosterPeriodStaffingMinMax] Unexpected error:', err);
    throw err;
  }
}

export async function bulkCreateRosterPeriodStaffing(
  records: Omit<RosterPeriodStaffing, 'id' | 'created_at' | 'updated_at'>[]
): Promise<RosterPeriodStaffing[]> {
  if (!records.length) {
    console.log('[bulkCreateRosterPeriodStaffing] Geen records om aan te maken');
    return [];
  }
  
  try {
    console.log('[bulkCreateRosterPeriodStaffing] Aanmaken van', records.length, 'records');
    
    // Valideer alle records
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.roster_id || typeof r.roster_id !== 'string') {
        throw new Error(`Record ${i}: roster_id is verplicht en moet een string zijn`);
      }
      if (!isValidUUID(r.roster_id)) {
        throw new Error(`Record ${i}: roster_id moet een geldige UUID zijn`);
      }
      if (!r.service_id || typeof r.service_id !== 'string') {
        throw new Error(`Record ${i}: service_id is verplicht`);
      }
      if (!r.date || typeof r.date !== 'string') {
        throw new Error(`Record ${i}: date is verplicht`);
      }
      if (typeof r.min_staff !== 'number' || r.min_staff < 0) {
        throw new Error(`Record ${i}: min_staff moet een positief getal zijn`);
      }
      if (typeof r.max_staff !== 'number' || r.max_staff < 0) {
        throw new Error(`Record ${i}: max_staff moet een positief getal zijn`);
      }
    }
    
    console.log('[bulkCreateRosterPeriodStaffing] Alle records gevalideerd ✓');
    
    const now = new Date().toISOString();
    const recordsWithTimestamps = records.map(r => ({
      ...r,
      created_at: now,
      updated_at: now
    }));
    
    const allCreatedRecords: RosterPeriodStaffing[] = [];
    
    // Batch insert in chunks van 50
    const chunkSize = 50;
    for (let i = 0; i < recordsWithTimestamps.length; i += chunkSize) {
      const chunk = recordsWithTimestamps.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(recordsWithTimestamps.length / chunkSize);
      
      console.log(`[bulkCreateRosterPeriodStaffing] Inserting chunk ${chunkNumber}/${totalChunks}...`);
      
      const { data, error } = await supabase
        .from('roster_period_staffing')
        .insert(chunk)
        .select();
      
      if (error) {
        console.error(`[bulkCreateRosterPeriodStaffing] ❌ Supabase error:`, error);
        throw new Error(`Bulk insert fout: ${error.message}`);
      }
      
      if (data) {
        allCreatedRecords.push(...(data as RosterPeriodStaffing[]));
      }
      
      console.log(`[bulkCreateRosterPeriodStaffing] ✓ Chunk ${chunkNumber}/${totalChunks} succesvol`);
    }
    
    console.log('[bulkCreateRosterPeriodStaffing] ✅ Alle records succesvol aangemaakt!');
    return allCreatedRecords;
  } catch (err) {
    console.error('[bulkCreateRosterPeriodStaffing] ❌ Unexpected error:', err);
    throw err;
  }
}

export async function hasRosterPeriodStaffing(rosterId: string): Promise<boolean> {
  try {
    console.log('[hasRosterPeriodStaffing] Checking for rosterId:', rosterId);
    validateId(rosterId, 'rosterId');
    
    const { count, error } = await supabase
      .from('roster_period_staffing')
      .select('*', { count: 'exact', head: true })
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('[hasRosterPeriodStaffing] Supabase error:', error);
      throw new Error(`Check fout: ${error.message}`);
    }
    
    const exists = (count ?? 0) > 0;
    console.log('[hasRosterPeriodStaffing] Records gevonden:', count, 'exists:', exists);
    return exists;
  } catch (err) {
    console.error('[hasRosterPeriodStaffing] Unexpected error:', err);
    throw err;
  }
}

/**
 * DRAAD36A: Genereer dagdeel regels voor een roster_period_staffing record
 * Op basis van team_regels uit service_types
 */
async function generateDagdeelRegelsForRecord(
  rpsRecord: RosterPeriodStaffing,
  teamRegels: {
    groen?: TeamRegels | null;
    oranje?: TeamRegels | null;
    totaal?: TeamRegels | null;
  },
  dagCode: DagCode
): Promise<CreateDagdeelRegel[]> {
  const regels: CreateDagdeelRegel[] = [];
  const dagblokken: DagblokCode[] = ['O', 'M', 'A'];
  
  // Team TOT (totaal)
  if (rpsRecord.team_tot && teamRegels.totaal) {
    for (const dagblok of dagblokken) {
      const dagblokStatus: DagblokStatus = teamRegels.totaal[dagCode][dagblok];
      const status = DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS[dagblokStatus];
      const aantal = DEFAULT_AANTAL_PER_STATUS[dagblokStatus as Exclude<DagblokStatus, 'AANGEPAST'>] || 0;
      
      regels.push({
        roster_period_staffing_id: rpsRecord.id,
        dagdeel: DAGBLOK_NAAR_DAGDEEL[dagblok],
        team: 'TOT',
        status,
        aantal
      });
    }
  }
  
  // Team GRO (groen)
  if (rpsRecord.team_gro && teamRegels.groen) {
    for (const dagblok of dagblokken) {
      const dagblokStatus: DagblokStatus = teamRegels.groen[dagCode][dagblok];
      const status = DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS[dagblokStatus];
      const aantal = DEFAULT_AANTAL_PER_STATUS[dagblokStatus as Exclude<DagblokStatus, 'AANGEPAST'>] || 0;
      
      regels.push({
        roster_period_staffing_id: rpsRecord.id,
        dagdeel: DAGBLOK_NAAR_DAGDEEL[dagblok],
        team: 'GRO',
        status,
        aantal
      });
    }
  }
  
  // Team ORA (oranje)
  if (rpsRecord.team_ora && teamRegels.oranje) {
    for (const dagblok of dagblokken) {
      const dagblokStatus: DagblokStatus = teamRegels.oranje[dagCode][dagblok];
      const status = DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS[dagblokStatus];
      const aantal = DEFAULT_AANTAL_PER_STATUS[dagblokStatus as Exclude<DagblokStatus, 'AANGEPAST'>] || 0;
      
      regels.push({
        roster_period_staffing_id: rpsRecord.id,
        dagdeel: DAGBLOK_NAAR_DAGDEEL[dagblok],
        team: 'ORA',
        status,
        aantal
      });
    }
  }
  
  return regels;
}

/**
 * DRAAD36A: Hoofdfunctie - genereer roster_period_staffing EN dagdelen
 * DRAAD63: UTC-safe datum generatie
 */
export async function generateRosterPeriodStaffing(
  rosterId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] 🚀 START GENERATIE (DRAAD36A + DRAAD63 UTC-SAFE)');
    console.log('[generateRosterPeriodStaffing] RosterId:', rosterId);
    console.log('[generateRosterPeriodStaffing] Periode:', startDate, 'tot', endDate);
    console.log('='.repeat(80) + '\n');
    
    // Validatie
    if (!rosterId || !isValidUUID(rosterId)) {
      throw new Error('Ongeldige rosterId');
    }
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      throw new Error('Ongeldige datums');
    }
    
    // DRAAD63: Parse dates UTC-safe
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);
    
    if (start > end) {
      throw new Error('startDate moet voor endDate liggen');
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ UTC-safe datum parsing (DRAAD63)');
    console.log('[generateRosterPeriodStaffing]   Start:', toUTCDateString(start));
    console.log('[generateRosterPeriodStaffing]   End:', toUTCDateString(end));
    
    // Check of data al bestaat
    const alreadyExists = await hasRosterPeriodStaffing(rosterId);
    if (alreadyExists) {
      console.log('[generateRosterPeriodStaffing] ⚠️  Data bestaat al, skip generatie');
      return;
    }
    
    // STAP 1: Haal diensten op (met team_regels)
    console.log('[generateRosterPeriodStaffing] STAP 1: Ophalen diensten...');
    const services = await getAllServices();
    console.log('[generateRosterPeriodStaffing] ✓ Diensten opgehaald:', services.length);
    
    if (services.length === 0) {
      throw new Error('Geen diensten gevonden');
    }
    
    // STAP 2: Haal feestdagen op
    console.log('[generateRosterPeriodStaffing] STAP 2: Ophalen feestdagen...');
    const holidays = await getFallbackHolidays(startDate, endDate);
    console.log('[generateRosterPeriodStaffing] ✓ Feestdagen:', holidays.length);
    
    // STAP 3: Genereer datums (DRAAD63: UTC-safe)
    console.log('[generateRosterPeriodStaffing] STAP 3: Genereer datums (UTC-SAFE)...');
    const days: string[] = [];
    
    // DRAAD63 FIX: Use UTC-safe date iteration
    // Old buggy code:
    // for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    //   days.push(d.toISOString().split('T')[0]);  // ❌ TIMEZONE BUG
    // }
    
    // New UTC-safe code:
    const totalDays = getUTCDaysDiff(start, end) + 1;  // +1 to include end date
    for (let i = 0; i < totalDays; i++) {
      const currentDate = addUTCDays(start, i);
      days.push(toUTCDateString(currentDate));
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Dagen:', days.length);
    console.log('[generateRosterPeriodStaffing] ✓ Eerste datum:', days[0]);
    console.log('[generateRosterPeriodStaffing] ✓ Laatste datum:', days[days.length - 1]);
    
    // STAP 4: Genereer roster_period_staffing records
    console.log('[generateRosterPeriodStaffing] STAP 4: Genereer RPS records...');
    const rpsRecords: Omit<RosterPeriodStaffing, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    for (const service of services) {
      for (const date of days) {
        rpsRecords.push({
          roster_id: rosterId,
          service_id: service.id,
          date,
          min_staff: 0,
          max_staff: 9,
          team_tot: service.team_totaal_regels ? true : null,
          team_gro: service.team_groen_regels ? true : null,
          team_ora: service.team_oranje_regels ? true : null
        });
      }
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ RPS records voorbereid:', rpsRecords.length);
    
    // STAP 5: Bulk insert RPS records (en krijg IDs terug)
    console.log('[generateRosterPeriodStaffing] STAP 5: Bulk insert RPS...');
    const createdRpsRecords = await bulkCreateRosterPeriodStaffing(rpsRecords);
    console.log('[generateRosterPeriodStaffing] ✅ RPS records aangemaakt:', createdRpsRecords.length);
    
    // STAP 6: Genereer dagdeel regels
    console.log('[generateRosterPeriodStaffing] STAP 6: Genereer dagdeel regels...');
    const allDagdeelRegels: CreateDagdeelRegel[] = [];
    
    for (const rpsRecord of createdRpsRecords) {
      // Vind corresponderende service
      const service = services.find(s => s.id === rpsRecord.service_id);
      if (!service) continue;
      
      // DRAAD63: Parse date UTC-safe
      const dateObj = parseUTCDate(rpsRecord.date);
      let dagCode = getDagCodeFromDate(dateObj);
      
      // Feestdag = zondag behandelen
      if (holidays.includes(rpsRecord.date)) {
        dagCode = 'zo';
      }
      
      // Genereer dagdeel regels voor deze RPS record
      const dagdeelRegels = await generateDagdeelRegelsForRecord(
        rpsRecord,
        {
          groen: service.team_groen_regels,
          oranje: service.team_oranje_regels,
          totaal: service.team_totaal_regels
        },
        dagCode
      );
      
      allDagdeelRegels.push(...dagdeelRegels);
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Dagdeel regels voorbereid:', allDagdeelRegels.length);
    
    // STAP 7: Bulk insert dagdeel regels
    if (allDagdeelRegels.length > 0) {
      console.log('[generateRosterPeriodStaffing] STAP 7: Bulk insert dagdelen...');
      const success = await bulkCreateDagdeelRegels(allDagdeelRegels);
      if (success) {
        console.log('[generateRosterPeriodStaffing] ✅ Dagdeel regels aangemaakt');
      } else {
        console.warn('[generateRosterPeriodStaffing] ⚠️  Dagdeel regels aanmaken gefaald');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] ✅ GENERATIE VOLTOOID (DRAAD63 UTC-SAFE)!');
    console.log('[generateRosterPeriodStaffing] RPS records:', createdRpsRecords.length);
    console.log('[generateRosterPeriodStaffing] Dagdeel regels:', allDagdeelRegels.length);
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('[generateRosterPeriodStaffing] ❌ FOUT OPGETREDEN');
    console.error('[generateRosterPeriodStaffing] Error:', err);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}