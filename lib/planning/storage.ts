import { supabase } from '@/lib/supabase';
import {
  getAllRoosters,
  createRooster,
  updateRooster,
  getRosterByDateRange,
  deleteRooster,
} from '@/lib/services/roosters-supabase';

export type Roster = {
  id: string;
  start_date: string; // YYYY-MM-DD (maandag)
  end_date: string; // YYYY-MM-DD (zondag, 34 dagen na start)
  status: 'draft' | 'in_progress' | 'final';
  created_at: string;
  updated_at?: string;
};

const BASE_START = '2025-11-24'; // Eerste rooster start op maandag 24-11-2025

// ========================================
// ASYNC FUNCTIES - SUPABASE OPERATIES
// ========================================

/**
 * Haal alle roosters op uit Supabase
 * @returns Promise met array van roosters
 */
export async function getRosters(): Promise<Roster[]> {
  try {
    return await getAllRoosters();
  } catch (error) {
    console.error('❌ Fout bij laden roosters:', error);
    return [];
  }
}

/**
 * Upsert (update of insert) een rooster in Supabase
 * @param r - Rooster object
 */
export async function upsertRoster(r: Roster): Promise<void> {
  try {
    // Check of rooster met deze datum range al bestaat
    const existing = await getRosterByDateRange(r.start_date, r.end_date);

    if (existing) {
      // Update bestaand rooster
      await updateRooster(existing.id, {
        status: r.status,
      });
      console.log('✅ Rooster ge-updated:', existing.id);
    } else {
      // Maak nieuw rooster aan
      await createRooster({
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status || 'draft',
      });
      console.log('✅ Nieuw rooster aangemaakt');
    }
  } catch (error) {
    console.error('❌ Fout bij opslaan rooster:', error);
    throw error;
  }
}

/**
 * Alias voor getRosters() - backwards compatibility
 */
export async function readRosters(): Promise<Roster[]> {
  return getRosters();
}

/**
 * Bulk update/insert van roosters
 * @param rosters - Array van roosters
 */
export async function writeRosters(rosters: Roster[]): Promise<void> {
  try {
    for (const roster of rosters) {
      await upsertRoster(roster);
    }
    console.log('✅ Bulk roosters opgeslagen');
  } catch (error) {
    console.error('❌ Fout bij bulk opslaan roosters:', error);
    throw error;
  }
}

/**
 * Verwijder een rooster uit Supabase
 * @param rosterId - Rooster ID
 */
export async function deleteRosterById(rosterId: string): Promise<void> {
  try {
    await deleteRooster(rosterId);
    console.log('✅ Rooster verwijderd:', rosterId);
  } catch (error) {
    console.error('❌ Fout bij verwijderen rooster:', error);
    throw error;
  }
}

/**
 * Haal de status op van een periode (async versie)
 * @param startDate - Start datum (YYYY-MM-DD)
 * @param endDate - Eind datum (YYYY-MM-DD)
 * @returns Status of 'free' als niet gevonden
 */
export async function getPeriodStatus(
  startDate: string,
  endDate: string
): Promise<'draft' | 'in_progress' | 'final' | 'free'> {
  try {
    const roster = await getRosterByDateRange(startDate, endDate);
    if (!roster) return 'free';
    return roster.status;
  } catch (error) {
    console.error('❌ Fout bij ophalen periode status:', error);
    return 'free';
  }
}

// ========================================
// SYNC FUNCTIES - GEEN DATABASE CALLS
// Pure utility functies voor datum berekeningen
// ========================================

/**
 * Genereer vaste 5-weken perioden vanaf BASE_START (ma t/m zo)
 * @param limit - Aantal perioden om te genereren (default: 20)
 * @returns Array van {start, end} objecten
 */
export function generateFiveWeekPeriods(
  limit = 20
): { start: string; end: string }[] {
  const res: { start: string; end: string }[] = [];
  let cursor = new Date(`${BASE_START}T00:00:00`); // Maandag 24-11-2025

  for (let i = 0; i < limit; i++) {
    const start = new Date(cursor);
    const end = new Date(start);
    end.setDate(start.getDate() + 34); // eindigt op zondag

    res.push({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });

    cursor.setDate(cursor.getDate() + 35); // volgende maandag
  }

  return res;
}

/**
 * ISO 8601 weeknummer berekening (Nederland standaard)
 * Week 1 = week met eerste donderdag van het jaar (bevat 4 januari)
 * Weken lopen maandag t/m zondag
 */
function getISOWeek(date: Date): number {
  // Maak kopie om originele datum niet te wijzigen
  const dt = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  // Zoek dichtstbijzijnde donderdag: huidige datum + 4 - huidige dagnummer
  // (zondag=0, maandag=1, ..., zaterdag=6)
  const dayNum = dt.getUTCDay() || 7; // zondag=7 voor berekening
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);

  // Eerste dag van het jaar waarin deze donderdag valt
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));

  // Bereken aantal volledige weken tot de donderdag + week 1
  return Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format een datum range als week range (bijv. "Week 48-52, 2025")
 */
export function formatWeekRange(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const sw = getISOWeek(s);
  const ew = getISOWeek(e);

  // Bij jaarovergangen, gebruik het jaar van het begin van de periode
  const year = s.getFullYear();

  // Speciale behandeling bij jaar overgang (bijv. Week 1 van 2026 die in dec 2025 begint)
  if (sw === 1 && s.getFullYear() < e.getFullYear()) {
    return `Week ${sw}-${ew}, ${e.getFullYear()}`; // Gebruik het nieuwe jaar
  }

  return `Week ${sw}-${ew}, ${year}`;
}

/**
 * Format een datum range in Nederlands formaat (bijv. "24 nov - 28 dec 2025")
 */
export function formatDateRangeNl(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const fmt = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short' });
  const fmtY = new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${fmt.format(s)} - ${fmtY.format(e)}`;
}

/**
 * Valideer of een datum een maandag is
 */
export function validateStartMonday(dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.getDay() === 1;
}

/**
 * Bereken default start datum (eerste vrije periode)
 * LET OP: Deze functie moet async worden als je de echte Supabase data wilt gebruiken
 * Voor nu gebruiken we een placeholder die kan worden aangeroepen vanuit async context
 */
export async function computeDefaultStart(): Promise<string> {
  const periods = generateFiveWeekPeriods(100);
  const rosters = await getRosters();

  for (const p of periods) {
    if (!rosters.some((r) => r.start_date === p.start)) {
      return p.start;
    }
  }

  return periods[0].start;
}

/**
 * Bereken eind datum op basis van start datum (5 weken = 35 dagen, eindigt op zondag)
 */
export function computeEnd(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 34);
  return end.toISOString().split('T')[0];
}
