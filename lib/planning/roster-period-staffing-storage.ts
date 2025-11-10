// lib/planning/roster-period-staffing-storage.ts
// Opslaglaag: TypeScript functies voor Supabase interactie (Diensten per Dag)

import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getRosterPeriodStaffing(rosterId: string): Promise<RosterPeriodStaffing[]> {
  try {
    console.log('[getRosterPeriodStaffing] Fetching data for rosterId:', rosterId);
    
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
    
    const now = new Date().toISOString();
    const recordsWithTimestamps = records.map(r => ({
      ...r,
      created_at: now,
      updated_at: now
    }));
    
    // Batch insert in chunks van 100 voor betere performance
    const chunkSize = 100;
    for (let i = 0; i < recordsWithTimestamps.length; i += chunkSize) {
      const chunk = recordsWithTimestamps.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('roster_period_staffing')
        .insert(chunk);
      
      if (error) {
        console.error('[bulkCreateRosterPeriodStaffing] Supabase error bij chunk', i / chunkSize + 1, ':', error);
        throw new Error(`Bulk insert fout: ${error.message}`);
      }
      
      console.log('[bulkCreateRosterPeriodStaffing] Chunk', i / chunkSize + 1, 'succesvol aangemaakt');
    }
    
    console.log('[bulkCreateRosterPeriodStaffing] Alle records succesvol aangemaakt');
  } catch (err) {
    console.error('[bulkCreateRosterPeriodStaffing] Unexpected error:', err);
    throw err;
  }
}

export async function hasRosterPeriodStaffing(rosterId: string): Promise<boolean> {
  try {
    console.log('[hasRosterPeriodStaffing] Checking for rosterId:', rosterId);
    
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
    console.log('[generateRosterPeriodStaffing] Start voor rosterId:', rosterId, 'periode:', startDate, 'tot', endDate);
    
    // Check of data al bestaat
    if (await hasRosterPeriodStaffing(rosterId)) {
      console.log('[generateRosterPeriodStaffing] Data bestaat al, skip generatie');
      return;
    }
    
    // Haal diensten op
    const services = await getAllServicesDayStaffing();
    console.log('[generateRosterPeriodStaffing] Diensten opgehaald:', services.length);
    
    if (services.length === 0) {
      throw new Error('Geen diensten gevonden. Configureer eerst diensten in de instellingen.');
    }
    
    // Haal feestdagen op
    const holidays = await getFallbackHolidays(startDate, endDate);
    console.log('[generateRosterPeriodStaffing] Feestdagen opgehaald:', holidays.length);
    
    // Genereer alle datums
    const begin = new Date(startDate + 'T00:00:00');
    const stop = new Date(endDate + 'T00:00:00');
    const days: string[] = [];
    
    for (let d = new Date(begin); d <= stop; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }
    
    console.log('[generateRosterPeriodStaffing] Dagen gegenereerd:', days.length);
    
    const isHoliday = (date: string) => holidays.includes(date);
    const result: Omit<RosterPeriodStaffing, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    // Genereer records voor elke dienst en elke dag
    for (const service of services) {
      for (const date of days) {
        const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Zo..6=Za
        let base = getStaffingForDay(service, dayOfWeek);
        
        // Gebruik zondag-waarden voor feestdagen
        if (isHoliday(date)) {
          base = getStaffingForDay(service, 0);
        }
        
        result.push({
          roster_id: rosterId,
          service_id: service.service_id,
          date,
          min_staff: base.min,
          max_staff: base.max,
          team_tot: service.tot_enabled ?? null,
          team_gro: service.gro_enabled ?? null,
          team_ora: service.ora_enabled ?? null
        });
      }
    }
    
    console.log('[generateRosterPeriodStaffing] Records voorbereid:', result.length);
    
    // Bulk insert
    await bulkCreateRosterPeriodStaffing(result);
    
    console.log('[generateRosterPeriodStaffing] Generatie voltooid!');
  } catch (err) {
    console.error('[generateRosterPeriodStaffing] Error:', err);
    throw err;
  }
}
