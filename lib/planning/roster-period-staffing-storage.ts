// lib/planning/roster-period-staffing-storage.ts
// ============================================================================
// DRAAD176: Roster Period Staffing Storage (DENORMALISERING)
// Datum: 2025-12-14
// NIEUW: Direct dagdelen generation, GEEN parent tabel meer
// ============================================================================

import { supabase } from '@/lib/supabase';
import { getAllServices } from '@/lib/services/diensten-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';
import { bulkCreateDagdeelRegels } from '@/lib/services/roster-period-staffing-dagdelen-storage';
import {
  CreateDagdeelRegel,
  DAGBLOK_NAAR_DAGDEEL,
  DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS,
  DEFAULT_AANTAL_PER_STATUS,
  isValidUUID,
  isValidISODate,
  Dagdeel,
  TeamDagdeel
} from '@/lib/types/roster-period-staffing-dagdeel';
import { DagCode, DagblokCode, DagblokStatus, TeamRegels } from '@/lib/types/service';
import { parseUTCDate, toUTCDateString, addUTCDays, getUTCDaysDiff } from '@/lib/utils/date-utc';

/**
 * DRAAD176: Valideer UUID format
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
 * DRAAD176: Convert JavaScript day (0=Sun) naar DagCode (ma/di/wo/do/vr/za/zo)
 */
function getDagCodeFromDate(date: Date): DagCode {
  const day = date.getUTCDay();
  const dagCodes: DagCode[] = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  return dagCodes[day];
}

/**
 * DRAAD176: Controleer of rooster dagdelen al gegenereerd zijn
 */
export async function hasRosterDagdelen(rosterId: string): Promise<boolean> {
  try {
    console.log('[hasRosterDagdelen] Checking dagdelen for rosterId:', rosterId);
    validateId(rosterId, 'rosterId');
    
    const { count, error } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('*', { count: 'exact', head: true })
      .eq('roster_id', rosterId);
    
    if (error) {
      console.error('[hasRosterDagdelen] Supabase error:', error);
      throw error;
    }
    
    const exists = (count ?? 0) > 0;
    console.log('[hasRosterDagdelen] Records gevonden:', count, 'exists:', exists);
    return exists;
  } catch (err) {
    console.error('[hasRosterDagdelen] Error:', err);
    throw err;
  }
}

/**
 * DRAAD176: Herschreven - DIRECT dagdelen generation (DENORMALISERING)
 * 
 * PROCES:
 * 1. Haal diensten op (met team_regels JSON)
 * 2. Genereer datums (UTC-safe)
 * 3. Voor ELKE (dienst, datum, dagdeel, team) combinatie:
 *    - Bepaal status uit service.team_XXX_regels[dagCode][dagblok]
 *    - Bepaal aantal uit DEFAULT_AANTAL[status]
 *    - Zet invulling = 0 (default)
 *    - INSERT direct in roster_period_staffing_dagdelen
 * 
 * TOTAAL: 9 diensten × 35 dagen × 3 dagdelen × 3 teams = 2835 records
 */
export async function generateRosterPeriodStaffing(
  rosterId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] 🚀 START DENORMALISATIE (DRAAD176)');
    console.log('[generateRosterPeriodStaffing] RosterId:', rosterId);
    console.log('[generateRosterPeriodStaffing] Periode:', startDate, 'tot', endDate);
    console.log('='.repeat(80) + '\n');
    
    // VALIDATIE
    if (!rosterId || !isValidUUID(rosterId)) {
      throw new Error('Ongeldige rosterId');
    }
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      throw new Error('Ongeldige datums');
    }
    
    const start = parseUTCDate(startDate);
    const end = parseUTCDate(endDate);
    
    if (start > end) {
      throw new Error('startDate moet voor endDate liggen');
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Validatie geslaagd');
    
    // Check of data al bestaat
    const alreadyExists = await hasRosterDagdelen(rosterId);
    if (alreadyExists) {
      console.log('[generateRosterPeriodStaffing] ⚠️  Dagdelen bestaan al, skip generatie');
      return;
    }
    
    // STAP 1: Haal diensten op
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
    
    // STAP 3: Genereer datums (UTC-safe)
    console.log('[generateRosterPeriodStaffing] STAP 3: Genereer datums (UTC-SAFE)...');
    const days: string[] = [];
    const totalDays = getUTCDaysDiff(start, end) + 1;
    
    for (let i = 0; i < totalDays; i++) {
      const currentDate = addUTCDays(start, i);
      days.push(toUTCDateString(currentDate));
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Dagen:', days.length);
    console.log('[generateRosterPeriodStaffing] ✓ Eerste:', days[0], 'Laatste:', days[days.length - 1]);
    
    // STAP 4: DENORMALISATIE - Genereer DIRECT dagdeel records
    console.log('[generateRosterPeriodStaffing] STAP 4: Genereer dagdeel records (DIRECT, DENORMALISATIE)...');
    const allDagdeelRegels: CreateDagdeelRegel[] = [];
    
    const dagdelen: DagblokCode[] = ['O', 'M', 'A'];
    const teams: TeamDagdeel[] = ['TOT', 'GRO', 'ORA'];
    
    for (const service of services) {
      for (const date of days) {
        // Bepaal dagCode (ma, di, ..., zo)
        const dateObj = parseUTCDate(date);
        let dagCode = getDagCodeFromDate(dateObj);
        
        // Feestdag = zondag behandelen
        if (holidays.includes(date)) {
          dagCode = 'zo';
        }
        
        // Voor elk dagdeel
        for (const dagblok of dagdelen) {
          // Voor elk team
          for (const team of teams) {
            // Bepaal welke team_regels we gebruiken
            const teamRegels: TeamRegels | null | undefined = 
              team === 'TOT' ? service.team_totaal_regels :
              team === 'GRO' ? service.team_groen_regels :
              service.team_oranje_regels;
            
            // Skip als dit team geen regels heeft voor deze service
            if (!teamRegels) {
              continue;
            }
            
            // Haal dagblok status op
            const dagblokStatus: DagblokStatus | undefined = teamRegels[dagCode]?.[dagblok];
            if (!dagblokStatus) {
              continue;  // Skip als geen status
            }
            
            // Map naar dagdeel status
            const status = DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS[dagblokStatus];
            
            // Bepaal aantal (MOET→1, MAG→1, MAG_NIET→0)
            const aantal = DEFAULT_AANTAL_PER_STATUS[dagblokStatus as Exclude<DagblokStatus, 'AANGEPAST'>] || 0;
            
            // Creëer record (DIRECT, DENORMALISATIE!)
            allDagdeelRegels.push({
              roster_id: rosterId,        // ← NEW (DRAAD176)
              service_id: service.id,     // ← NEW (DRAAD176)
              date,                       // ← NEW (DRAAD176: YYYY-MM-DD)
              dagdeel: DAGBLOK_NAAR_DAGDEEL[dagblok],
              team,
              status,
              aantal,
              invulling: 0                // ← NEW (DRAAD176: default)
            });
          }
        }
      }
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Dagdeel records voorbereid:', allDagdeelRegels.length);
    console.log('[generateRosterPeriodStaffing] ✓ Verwacht: 9 × 35 × 3 × 3 = 2835');
    
    if (allDagdeelRegels.length !== 2835) {
      console.warn(`[generateRosterPeriodStaffing] ⚠️  WAARSCHUWING: Verwacht 2835, gevonden ${allDagdeelRegels.length}`);
    }
    
    // STAP 5: Bulk insert dagdeel records
    if (allDagdeelRegels.length > 0) {
      console.log('[generateRosterPeriodStaffing] STAP 5: Bulk insert dagdelen...');
      const success = await bulkCreateDagdeelRegels(allDagdeelRegels);
      
      if (!success) {
        throw new Error('Bulk insert dagdelen gefaald');
      }
      
      console.log('[generateRosterPeriodStaffing] ✅ Alle dagdeel regels aangemaakt');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] ✅ DENORMALISATIE VOLTOOID!');
    console.log('[generateRosterPeriodStaffing] Totale records:', allDagdeelRegels.length);
    console.log('='.repeat(80) + '\n');
    
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('[generateRosterPeriodStaffing] ❌ FOUT OPGETREDEN');
    console.error('[generateRosterPeriodStaffing] Error:', err);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}
