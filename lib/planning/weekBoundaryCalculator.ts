/**
 * Week Boundary Calculator voor Week Dagdelen Detail Scherm
 * 
 * Bepaalt voor elke week binnen een 5-weekse rooster periode:
 * - Start en einddatum (maandag t/m zondag)
 * - Navigatie mogelijkheden (canGoBack/canGoForward)
 * - Week labeling ("Week X van 5")
 * 
 * FIX 3 - DRAAD40B: Gebruik period_start parameter i.p.v. roster.start_date
 */

import { getSupabaseServer } from '@/lib/supabase-server';
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
 * 🔥 FIX 3 - DRAAD40B: Haalt volledige rooster periode informatie op met alle 5 weken
 * @param rosterId - UUID van het rooster
 * @param periodStart - OPTIONEEL: Expliciete period_start (YYYY-MM-DD). Indien niet gegeven, wordt roster.start_date gebruikt.
 */
export async function getRosterPeriodInfo(
  rosterId: string,
  periodStart?: string
): Promise<RosterPeriodInfo> {
  let startDatum: string;
  let eindDatum: string;
  
  // 🔥 FIX 3: Gebruik period_start indien beschikbaar, anders fallback naar roster.start_date
  if (periodStart) {
    console.log('✅ FIX 3: Gebruik period_start parameter:', periodStart);
    startDatum = periodStart;
    
    // Bereken einddatum: 5 weken - 1 dag = 34 dagen na startdatum
    const startDate = parseISO(periodStart);
    const endDate = addDays(startDate, 34); // 5 weken = 35 dagen, maar einddatum is laatste dag dus -1
    eindDatum = format(endDate, 'yyyy-MM-dd');
    
    console.log('✅ FIX 3: Berekende einddatum:', eindDatum);
  } else {
    // Fallback: Query roster periode uit database
    console.log('⚠️ FIX 3: Geen period_start parameter, fallback naar roster.start_date');
    
    const supabase = getSupabaseServer();
    
    const { data: roster, error } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();

    if (error || !roster) {
      throw new Error(`Roster niet gevonden: ${rosterId} - ${error?.message || 'Unknown error'}`);
    }

    startDatum = roster.start_date;
    eindDatum = roster.end_date;
    
    console.log('✅ FIX 3: Roster datums uit database - start:', startDatum, 'eind:', eindDatum);
  }

  // Valideer dat periode een maandag start
  const startDate = parseISO(startDatum);
  const dayOfWeek = startDate.getDay();
  
  console.log('🔍 FIX 3: startDate dag van week:', dayOfWeek, '(0=zondag, 1=maandag)');
  
  if (dayOfWeek !== 1) {
    console.error('❌ FIX 3: Rooster periode begint NIET op maandag! Day of week:', dayOfWeek);
    throw new Error(`Roster periode moet op een maandag beginnen. Huidige startdatum (${startDatum}) is een ${getDayName(dayOfWeek)}`);
  }

  // Bereken alle 5 weken
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
    
    console.log(`✅ FIX 3: Week ${weekNummer} boundaries - start: ${weekStartDatum}, eind: ${weekEindDatum}`);

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
 * 🔥 FIX 3 - DRAAD40B: Haalt specifieke week boundary op
 * @param rosterId - UUID van het rooster
 * @param weekNummer - Week index (1-5)
 * @param periodStart - OPTIONEEL: Expliciete period_start (YYYY-MM-DD). Indien niet gegeven, wordt roster.start_date gebruikt.
 */
export async function getWeekBoundary(
  rosterId: string,
  weekNummer: number,
  periodStart?: string
): Promise<WeekBoundary> {
  console.log(`🔍 FIX 3: getWeekBoundary called - rosterId: ${rosterId}, weekNummer: ${weekNummer}, periodStart: ${periodStart}`);
  
  // 1. Valideer weekNummer
  if (!Number.isInteger(weekNummer) || weekNummer < 1 || weekNummer > 5) {
    throw new Error(
      `Ongeldig weeknummer: ${weekNummer}. Moet tussen 1 en 5 zijn.`
    );
  }

  // 2. 🔥 FIX 3: Haal volledige periode info op MET period_start parameter
  const periodInfo = await getRosterPeriodInfo(rosterId, periodStart);
  
  console.log('✅ FIX 3: periodInfo opgehaald:', periodInfo);

  // 3. Return specifieke week
  const week = periodInfo.weken.find(w => w.weekNummer === weekNummer);
  
  if (!week) {
    throw new Error(`Week ${weekNummer} niet gevonden in roster periode`);
  }
  
  console.log(`✅ FIX 3: Week ${weekNummer} boundary geretourneerd:`, week);

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

/**
 * 🔥 FIX 3: Helper om dag van week naam te krijgen (voor error messages)
 */
function getDayName(dayOfWeek: number): string {
  const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  return days[dayOfWeek] || 'onbekend';
}
