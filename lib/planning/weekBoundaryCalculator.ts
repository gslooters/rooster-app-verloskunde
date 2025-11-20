/**
 * Week Boundary Calculator voor Week Dagdelen Detail Scherm
 * 
 * Bepaalt voor elke week binnen een 5-weekse rooster periode:
 * - Start en einddatum (maandag t/m zondag)
 * - Navigatie mogelijkheden (canGoBack/canGoForward)
 * - Week labeling ("Week X van 5")
 * 
 * FASE 1 van DRAAD40 implementatie
 */

import { createClient } from '@/lib/supabase/server';
import { addDays, parseISO, format } from 'date-fns';

// ============================================================================
// TYPE DEFINITIES
// ============================================================================

export interface WeekBoundary {
  weekNummer: number;           // 1-5
  startDatum: string;           // ISO string maandag
  eindDatum: string;            // ISO string zondag
  canGoBack: boolean;           // false voor week 1
  canGoForward: boolean;        // false voor week 5
  weekLabel: string;            // "Week 1 van 5"
  rosterId: string;
}

export interface RosterPeriodInfo {
  rosterId: string;
  startDatum: string;           // Eerste maandag
  eindDatum: string;            // Laatste zondag
  totaalWeken: 5;
  weken: WeekBoundary[];
}

// ============================================================================
// HOOFDFUNCTIES
// ============================================================================

/**
 * Haalt volledige rooster periode informatie op met alle 5 weken
 */
export async function getRosterPeriodInfo(
  rosterId: string
): Promise<RosterPeriodInfo> {
  // 1. Query roster periode
  const supabase = await createClient();
  
  const { data: roster, error } = await supabase
    .from('roosters')
    .select('id, start_date, end_date')
    .eq('id', rosterId)
    .single();

  if (error || !roster) {
    throw new Error(`Roster niet gevonden: ${rosterId} - ${error?.message || 'Unknown error'}`);
  }

  const startDatum = roster.start_date;
  const eindDatum = roster.end_date;

  // 2. Valideer dat periode een maandag start
  const startDate = parseISO(startDatum);
  if (startDate.getDay() !== 1) {
    throw new Error('Roster periode moet op een maandag beginnen');
  }

  // 3. Bereken alle 5 weken
  const weken: WeekBoundary[] = [];
  
  for (let weekNummer = 1; weekNummer <= 5; weekNummer++) {
    const weekStartDatum = format(
      addDays(startDate, (weekNummer - 1) * 7),
      'yyyy-MM-dd'
    );
    const weekEindDatum = format(
      addDays(startDate, (weekNummer - 1) * 7 + 6),
      'yyyy-MM-dd'
    );

    weken.push({
      weekNummer,
      startDatum: weekStartDatum,
      eindDatum: weekEindDatum,
      canGoBack: weekNummer > 1,
      canGoForward: weekNummer < 5,
      weekLabel: `Week ${weekNummer} van 5`,
      rosterId
    });
  }

  return {
    rosterId,
    startDatum,
    eindDatum,
    totaalWeken: 5,
    weken
  };
}

/**
 * Haalt specifieke week boundary op
 */
export async function getWeekBoundary(
  rosterId: string,
  weekNummer: number
): Promise<WeekBoundary> {
  // 1. Valideer weekNummer
  if (!Number.isInteger(weekNummer) || weekNummer < 1 || weekNummer > 5) {
    throw new Error(
      `Ongeldig weeknummer: ${weekNummer}. Moet tussen 1 en 5 zijn.`
    );
  }

  // 2. Haal volledige periode info op
  const periodInfo = await getRosterPeriodInfo(rosterId);

  // 3. Return specifieke week
  const week = periodInfo.weken.find(w => w.weekNummer === weekNummer);
  
  if (!week) {
    throw new Error(`Week ${weekNummer} niet gevonden in roster periode`);
  }

  return week;
}

// ============================================================================
// HELPER FUNCTIES
// ============================================================================

/**
 * Controleert of een specifiek weeknummer geldig is
 */
export function isValidWeekNummer(weekNummer: number): boolean {
  return Number.isInteger(weekNummer) && weekNummer >= 1 && weekNummer <= 5;
}

/**
 * Geeft het volgende weeknummer (of null als week 5)
 */
export function getNextWeekNummer(currentWeek: number): number | null {
  if (currentWeek >= 5) return null;
  return currentWeek + 1;
}

/**
 * Geeft het vorige weeknummer (of null als week 1)
 */
export function getPreviousWeekNummer(currentWeek: number): number | null {
  if (currentWeek <= 1) return null;
  return currentWeek - 1;
}
