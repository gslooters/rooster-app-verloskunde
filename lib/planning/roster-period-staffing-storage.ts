// lib/planning/roster-period-staffing-storage.ts
// Opslaglaag: TypeScript functies voor Supabase interactie (Diensten per Dag)

import { createClient } from '@supabase/supabase-js';
import { getAllServicesDayStaffing } from '@/lib/services/diensten-storage';
import { getFallbackHolidays } from '@/lib/data/dutch-holidays-fallback';

export interface RosterPeriodStaffing {
  id: string;
  rosterid: string;
  serviceid: string;
  date: string; // "2025-11-24"
  minstaff: number;
  maxstaff: number;
  teamtot: boolean | null;
  teamgro: boolean | null;
  teamora: boolean | null;
  createdat: string;
  updatedat: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getRosterPeriodStaffing(rosterId: string): Promise<RosterPeriodStaffing[]> {
  const { data, error } = await supabase
    .from('rosterperiodstaffing')
    .select('*')
    .eq('rosterid', rosterId);
  if (error) throw error;
  return data as RosterPeriodStaffing[];
}

export async function updateRosterPeriodStaffingMinMax(id: string, min: number, max: number): Promise<void> {
  const { error } = await supabase
    .from('rosterperiodstaffing')
    .update({ minstaff: min, maxstaff: max })
    .eq('id', id);
  if (error) throw error;
}

export async function bulkCreateRosterPeriodStaffing(records: Omit<RosterPeriodStaffing, 'id' | 'createdat' | 'updatedat'>[]): Promise<void> {
  if (!records.length) return;
  const now = new Date().toISOString();
  const inRecords = records.map(r => ({ ...r, createdat: now, updatedat: now }));
  const { error } = await supabase
    .from('rosterperiodstaffing')
    .insert(inRecords);
  if (error) throw error;
}

export async function hasRosterPeriodStaffing(rosterId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('rosterperiodstaffing')
    .select('*', { count: 'exact', head: true })
    .eq('rosterid', rosterId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// Auto-fill: vul alle dagen met standaardwaarden per dienst en dagsoort
export async function generateRosterPeriodStaffing(rosterId: string, startDate: string, endDate: string): Promise<void> {
  if (await hasRosterPeriodStaffing(rosterId)) return;
  const services = await getAllServicesDayStaffing();
  const holidays = await getFallbackHolidays(startDate, endDate);
  const begin = new Date(startDate);
  const stop = new Date(endDate);
  const days: string[] = [];
  for (
    let d = new Date(begin);
    d <= stop;
    d.setDate(d.getDate() + 1)
  ) {
    days.push(d.toISOString().split('T')[0]);
  }
  const isHoliday = (date: string) => holidays.includes(date);
  const result: Omit<RosterPeriodStaffing, 'id' | 'createdat' | 'updatedat'>[] = [];
  for (const service of services) {
    for (const date of days) {
      // Dienstcodes per dagsoort en feestdaglogica
      const dayOfWeek = new Date(date).getDay(); // 0=Zo..6=Za
      let base = service.staffingPerDayType[dayOfWeek];
      if (isHoliday(date)) base = service.staffingPerDayType[0]; // Zondagsettings voor feestdag
      result.push({
        rosterid: rosterId,
        serviceid: service.id,
        date,
        minstaff: base.min,
        maxstaff: base.max,
        teamtot: service.teamtot ?? null,
        teamgro: service.teamgro ?? null,
        teamora: service.teamora ?? null
      });
    }
  }
  await bulkCreateRosterPeriodStaffing(result);
}
