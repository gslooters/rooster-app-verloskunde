// lib/utils/roster-date-helpers.ts
// Datum-utilities voor roosterperiodes van 35 dagen (5 weken)

import { PeriodDateInfo, WeekInfo } from '../types/period-day-staffing';
import { parseUTCDate, toUTCDateString, addUTCDays, getUTCWeekNumber } from './date-utc';

/**
 * Dag-namen (kort) voor weergave
 */
const DAY_NAMES_SHORT = ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO'];

/**
 * Genereer 35 dagen info vanaf een startdatum
 * @param startDate - Start datum in YYYY-MM-DD formaat
 * @param holidays - Array van feestdagen in YYYY-MM-DD formaat
 * @returns Array van 35 PeriodDateInfo objecten
 */
export function getDatesForRosterPeriod(
  startDate: string,
  holidays: string[] = []
): PeriodDateInfo[] {
  const dates: PeriodDateInfo[] = [];
  const start = parseUTCDate(startDate);
  
  for (let i = 0; i < 35; i++) {
    const currentDate = addUTCDays(start, i);
    
    const dateString = toUTCDateString(currentDate);
    const dayOfWeek = currentDate.getUTCDay(); // 0=zondag, 1=maandag, ..., 6=zaterdag
    const dagSoort = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Converteer naar 0=ma, 6=zo
    const isFeestdag = holidays.includes(dateString);
    
    const { week: weekNumber, year } = getUTCWeekNumber(currentDate);
    
    dates.push({
      date: dateString,
      dagIndex: i,
      dagSoort,
      weekNumber,
      year,
      isFeestdag,
      dateShort: currentDate.getUTCDate().toString(),
      dayName: DAY_NAMES_SHORT[dagSoort]
    });
  }
  
  return dates;
}

/**
 * Groepeer 35 dagen in weken voor UI weergave
 * @param dates - Array van PeriodDateInfo objecten
 * @returns Array van WeekInfo objecten (5 weken)
 */
export function groupDatesByWeek(dates: PeriodDateInfo[]): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  
  for (let weekIndex = 0; weekIndex < 5; weekIndex++) {
    const startIndex = weekIndex * 7;
    const weekDays = dates.slice(startIndex, startIndex + 7);
    
    if (weekDays.length > 0) {
      weeks.push({
        weekNumber: weekDays[0].weekNumber,
        year: weekDays[0].year,
        startDate: weekDays[0].date,
        endDate: weekDays[weekDays.length - 1].date,
        days: weekDays
      });
    }
  }
  
  return weeks;
}

/**
 * Haal ISO week-nummer en jaar op voor een datum
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns Object met weekNumber en year
 */
export function getWeekInfo(dateString: string): { weekNumber: number; year: number } {
  const date = parseUTCDate(dateString);
  const { week: weekNumber, year } = getUTCWeekNumber(date);
  return { weekNumber, year };
}

/**
 * Bepaal de effectieve dagsoort voor een datum
 * Bij feestdagen wordt dagsoort 6 (zondag) gebruikt
 * @param dateInfo - PeriodDateInfo object
 * @returns Effectieve dagsoort (0-6)
 */
export function getEffectiveDayType(dateInfo: PeriodDateInfo): number {
  return dateInfo.isFeestdag ? 6 : dateInfo.dagSoort;
}

/**
 * Format Date object naar YYYY-MM-DD
 * @param date - JavaScript Date object
 * @returns Datum string in YYYY-MM-DD formaat
 */
export function formatDateToYYYYMMDD(date: Date): string {
  return toUTCDateString(date);
}

/**
 * Format datum naar kort formaat (alleen dag-nummer)
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns Dag-nummer als string ("1", "25", etc.)
 */
export function formatDateShort(dateString: string): string {
  const date = parseUTCDate(dateString);
  return date.getUTCDate().toString();
}

/**
 * Haal korte dag-naam op (MA, DI, etc.)
 * @param dagSoort - Dagsoort nummer (0-6)
 * @returns Korte dag-naam
 */
export function getDayNameShort(dagSoort: number): string {
  if (dagSoort < 0 || dagSoort > 6) return '??';
  return DAY_NAMES_SHORT[dagSoort];
}

/**
 * Parse YYYY-MM-DD string naar Date object (UTC-safe)
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns Date object
 */
export function parseDateString(dateString: string): Date {
  return parseUTCDate(dateString);
}

/**
 * Check of een datum geldig is
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns True als geldig
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  try {
    const date = parseUTCDate(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Bereken het aantal dagen tussen twee datums
 * @param date1 - Eerste datum (YYYY-MM-DD)
 * @param date2 - Tweede datum (YYYY-MM-DD)
 * @returns Aantal dagen verschil (absoluut)
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = parseUTCDate(date1);
  const d2 = parseUTCDate(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}