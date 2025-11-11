// lib/planning/roster-period-staffing-storage.ts
// Opslaglaag: TypeScript functies voor Supabase interactie (Diensten per Dag)

import { supabase } from '@/lib/supabase';
import { getAllServicesDayStaffing, ServiceDayStaffing } from '@/lib/services/diensten-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';

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
 * @param uuid String die gevalideerd moet worden
 * @returns true als geldige UUID, anders false
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Helper functie: Valideer UUID of custom ID format (r_...)
 * @param id String die gevalideerd moet worden
 * @param fieldName Naam van het veld voor foutmelding
 * @returns true als geldig, anders throw Error
 */
function validateId(id: string, fieldName: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`Ongeldig ${fieldName}: "${id}" (moet een string zijn)`);
  }
  
  // Accepteer UUID of custom format (r_...)
  if (!id.startsWith('r_') && !isValidUUID(id)) {
    throw new Error(
      `Ongeldig ${fieldName} format: "${id}". ` +
      `Moet een UUID zijn of beginnen met "r_"`
    );
  }
}

/**
 * Helper functie: Valideer ISO8601 date format (YYYY-MM-DD)
 * @param dateStr String die gevalideerd moet worden
 * @returns true als geldige datum, anders false
 */
function isValidISODate(dateStr: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateStr)) return false;
  
  const date = new Date(dateStr + 'T00:00:00');
  return date instanceof Date && !isNaN(date.getTime());
}

export async function getRosterPeriodStaffing(rosterId: string): Promise<RosterPeriodStaffing[]> {
  try {
    console.log('[getRosterPeriodStaffing] Fetching data for rosterId:', rosterId);
    
    // === FIX 4: UUID VALIDATIE ===
    validateId(rosterId, 'rosterId');
    console.log('[getRosterPeriodStaffing] ✓ RosterId validated');
    
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
    
    // === FIX 4: UUID VALIDATIE ===
    validateId(id, 'id');
    
    // Valideer min/max waarden
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
): Promise<void> {
  if (!records.length) {
    console.log('[bulkCreateRosterPeriodStaffing] Geen records om aan te maken');
    return;
  }
  
  try {
    console.log('[bulkCreateRosterPeriodStaffing] Aanmaken van', records.length, 'records');
    console.log('[bulkCreateRosterPeriodStaffing] Eerste record sample:', JSON.stringify(records[0], null, 2));
    
    // Valideer alle records voordat we gaan inserten
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.roster_id || typeof r.roster_id !== 'string') {
        throw new Error(`Record ${i}: roster_id is verplicht en moet een string zijn (waarde: ${r.roster_id})`);
      }
      if (!r.service_id || typeof r.service_id !== 'string') {
        throw new Error(`Record ${i}: service_id is verplicht en moet een string zijn (waarde: ${r.service_id})`);
      }
      if (!r.date || typeof r.date !== 'string') {
        throw new Error(`Record ${i}: date is verplicht en moet een string zijn (waarde: ${r.date})`);
      }
      if (typeof r.min_staff !== 'number' || r.min_staff < 0) {
        throw new Error(`Record ${i}: min_staff moet een positief getal zijn (waarde: ${r.min_staff})`);
      }
      if (typeof r.max_staff !== 'number' || r.max_staff < 0) {
        throw new Error(`Record ${i}: max_staff moet een positief getal zijn (waarde: ${r.max_staff})`);
      }
    }
    
    console.log('[bulkCreateRosterPeriodStaffing] Alle records gevalideerd ✓');
    
    const now = new Date().toISOString();
    const recordsWithTimestamps = records.map(r => ({
      ...r,
      created_at: now,
      updated_at: now
    }));
    
    // Batch insert in chunks van 50 voor betere stabiliteit
    const chunkSize = 50;
    for (let i = 0; i < recordsWithTimestamps.length; i += chunkSize) {
      const chunk = recordsWithTimestamps.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(recordsWithTimestamps.length / chunkSize);
      
      console.log(`[bulkCreateRosterPeriodStaffing] Inserting chunk ${chunkNumber}/${totalChunks} (${chunk.length} records)...`);
      
      const { data, error } = await supabase
        .from('roster_period_staffing')
        .insert(chunk)
        .select('id');
      
      if (error) {
        console.error(`[bulkCreateRosterPeriodStaffing] ❌ Supabase error bij chunk ${chunkNumber}:`, error);
        console.error('[bulkCreateRosterPeriodStaffing] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        console.error('[bulkCreateRosterPeriodStaffing] Eerste record in failed chunk:', JSON.stringify(chunk[0], null, 2));
        throw new Error(`Bulk insert fout bij chunk ${chunkNumber}: ${error.message}`);
      }
      
      console.log(`[bulkCreateRosterPeriodStaffing] ✓ Chunk ${chunkNumber}/${totalChunks} succesvol (${data?.length || 0} records aangemaakt)`);
    }
    
    console.log('[bulkCreateRosterPeriodStaffing] ✅ Alle records succesvol aangemaakt!');
  } catch (err) {
    console.error('[bulkCreateRosterPeriodStaffing] ❌ Unexpected error:', err);
    throw err;
  }
}

export async function hasRosterPeriodStaffing(rosterId: string): Promise<boolean> {
  try {
    console.log('[hasRosterPeriodStaffing] Checking for rosterId:', rosterId);
    
    // === FIX 4: UUID VALIDATIE ===
    validateId(rosterId, 'rosterId');
    console.log('[hasRosterPeriodStaffing] ✓ RosterId validated');
    
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
 * Helper functie: Haal min/max staffing op voor een specifieke dag uit ServiceDayStaffing
 * @param service ServiceDayStaffing object
 * @param dayOfWeek 0=Zondag, 1=Maandag, ..., 6=Zaterdag
 * @returns {min: number, max: number}
 */
function getStaffingForDay(service: ServiceDayStaffing, dayOfWeek: number): { min: number; max: number } {
  switch (dayOfWeek) {
    case 0: // Zondag
      return { min: service.zo_min, max: service.zo_max };
    case 1: // Maandag
      return { min: service.ma_min, max: service.ma_max };
    case 2: // Dinsdag
      return { min: service.di_min, max: service.di_max };
    case 3: // Woensdag
      return { min: service.wo_min, max: service.wo_max };
    case 4: // Donderdag
      return { min: service.do_min, max: service.do_max };
    case 5: // Vrijdag
      return { min: service.vr_min, max: service.vr_max };
    case 6: // Zaterdag
      return { min: service.za_min, max: service.za_max };
    default:
      return { min: 0, max: 0 };
  }
}

// Auto-fill: vul alle dagen met standaardwaarden per dienst en dagsoort
export async function generateRosterPeriodStaffing(
  rosterId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] 🚀 START GENERATIE');
    console.log('[generateRosterPeriodStaffing] RosterId:', rosterId);
    console.log('[generateRosterPeriodStaffing] Periode:', startDate, 'tot', endDate);
    console.log('='.repeat(80) + '\n');
    
    // === VALIDATIE INPUT PARAMETERS ===
    console.log('[generateRosterPeriodStaffing] STAP 0: Valideren input parameters...');
    
    if (!rosterId || typeof rosterId !== 'string') {
      throw new Error(`Ongeldige rosterId: "${rosterId}" (moet een string zijn)`);
    }
    
    // Valideer rosterId format - moet UUID zijn of custom format (r_...)
    if (!rosterId.startsWith('r_') && !isValidUUID(rosterId)) {
      throw new Error(
        `Ongeldige rosterId format: "${rosterId}". ` +
        `Moet een UUID zijn of beginnen met "r_"`
      );
    }
    
    if (!startDate || typeof startDate !== 'string') {
      throw new Error(`Ongeldige startDate: "${startDate}" (moet een string zijn)`);
    }
    
    if (!endDate || typeof endDate !== 'string') {
      throw new Error(`Ongeldige endDate: "${endDate}" (moet een string zijn)`);
    }
    
    if (!isValidISODate(startDate)) {
      throw new Error(
        `Ongeldige startDate format: "${startDate}". ` +
        `Moet ISO8601 datum zijn (YYYY-MM-DD)`
      );
    }
    
    if (!isValidISODate(endDate)) {
      throw new Error(
        `Ongeldige endDate format: "${endDate}". ` +
        `Moet ISO8601 datum zijn (YYYY-MM-DD)`
      );
    }
    
    // Valideer dat startDate voor endDate ligt
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    if (start > end) {
      throw new Error(
        `Ongeldige datumrange: startDate (${startDate}) moet voor endDate (${endDate}) liggen`
      );
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Alle input parameters gevalideerd');
    console.log('[generateRosterPeriodStaffing] ✓ RosterId format: geldig');
    console.log('[generateRosterPeriodStaffing] ✓ Datums: geldig ISO8601 format');
    console.log('[generateRosterPeriodStaffing] ✓ Datumrange: geldig (start <= end)');
    console.log('');
    
    // Check of data al bestaat
    console.log('[generateRosterPeriodStaffing] STAP 1: Check of data al bestaat...');
    const alreadyExists = await hasRosterPeriodStaffing(rosterId);
    if (alreadyExists) {
      console.log('[generateRosterPeriodStaffing] ⚠️  Data bestaat al, skip generatie');
      return;
    }
    console.log('[generateRosterPeriodStaffing] ✓ Geen bestaande data, ga verder\n');
    
    // Haal diensten op
    console.log('[generateRosterPeriodStaffing] STAP 2: Ophalen diensten...');
    const services = await getAllServicesDayStaffing();
    console.log('[generateRosterPeriodStaffing] ✓ Diensten opgehaald:', services.length);
    
    if (services.length === 0) {
      throw new Error('Geen diensten gevonden. Configureer eerst diensten in de instellingen.');
    }
    
    // Log eerste dienst voor debugging
    console.log('[generateRosterPeriodStaffing] Eerste dienst sample:', JSON.stringify(services[0], null, 2));
    console.log('');
    
    // === VALIDATIE DIENSTEN ===
    console.log('[generateRosterPeriodStaffing] STAP 2a: Valideren diensten...');
    
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      
      if (!service.service_id) {
        console.error(`[generateRosterPeriodStaffing] ❌ Dienst ${i} heeft geen service_id:`, service);
        throw new Error(
          `Dienst op positie ${i} mist service_id veld`
        );
      }
      
      if (typeof service.service_id !== 'string') {
        throw new Error(
          `Dienst ${i} heeft ongeldige service_id type: ` +
          `"${typeof service.service_id}" (moet string zijn)`
        );
      }
      
      // Valideer UUID format van service_id
      if (!isValidUUID(service.service_id)) {
        throw new Error(
          `Dienst ${i} heeft ongeldige service_id: ` +
          `"${service.service_id}" (moet geldige UUID zijn)`
        );
      }
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Alle diensten hebben een geldig service_id (UUID format)');
    console.log('');
    
    // Haal feestdagen op
    console.log('[generateRosterPeriodStaffing] STAP 3: Ophalen feestdagen...');
    const holidays = await getFallbackHolidays(startDate, endDate);
    console.log('[generateRosterPeriodStaffing] ✓ Feestdagen opgehaald:', holidays.length);
    if (holidays.length > 0) {
      console.log('[generateRosterPeriodStaffing] Feestdagen:', holidays.join(', '));
    }
    console.log('');
    
    // Genereer alle datums
    console.log('[generateRosterPeriodStaffing] STAP 4: Genereer datums...');
    const days: string[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Dagen gegenereerd:', days.length);
    console.log('[generateRosterPeriodStaffing] Eerste dag:', days[0]);
    console.log('[generateRosterPeriodStaffing] Laatste dag:', days[days.length - 1]);
    console.log('');
    
    const isHoliday = (date: string) => holidays.includes(date);
    const result: Omit<RosterPeriodStaffing, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    // Genereer records voor elke dienst en elke dag
    console.log('[generateRosterPeriodStaffing] STAP 5: Genereer records...');
    let recordCount = 0;
    
    for (const service of services) {
      for (const date of days) {
        const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Zo..6=Za
        let base = getStaffingForDay(service, dayOfWeek);
        
        // Gebruik zondag-waarden voor feestdagen
        if (isHoliday(date)) {
          base = getStaffingForDay(service, 0);
        }
        
        const record = {
          roster_id: rosterId,
          service_id: service.service_id,
          date,
          min_staff: base.min,
          max_staff: base.max,
          team_tot: service.tot_enabled ?? null,
          team_gro: service.gro_enabled ?? null,
          team_ora: service.ora_enabled ?? null
        };
        
        result.push(record);
        recordCount++;
        
        // Log eerste record voor debugging
        if (recordCount === 1) {
          console.log('[generateRosterPeriodStaffing] Eerste record sample:', JSON.stringify(record, null, 2));
        }
      }
    }
    
    console.log('[generateRosterPeriodStaffing] ✓ Records voorbereid:', result.length);
    console.log('[generateRosterPeriodStaffing] Verwacht aantal:', services.length, 'diensten ×', days.length, 'dagen =', services.length * days.length, 'records');
    console.log('');
    
    // Bulk insert
    console.log('[generateRosterPeriodStaffing] STAP 6: Start bulk insert...');
    await bulkCreateRosterPeriodStaffing(result);
    
    console.log('\n' + '='.repeat(80));
    console.log('[generateRosterPeriodStaffing] ✅ GENERATIE VOLTOOID!');
    console.log('[generateRosterPeriodStaffing] Totaal records aangemaakt:', result.length);
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('[generateRosterPeriodStaffing] ❌ FOUT OPGETREDEN');
    console.error('[generateRosterPeriodStaffing] Error type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('[generateRosterPeriodStaffing] Error message:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error('[generateRosterPeriodStaffing] Stack trace:', err.stack);
    }
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}