// lib/utils/roster-date-helpers.ts
// Datum-utilities voor roosterperiodes van 35 dagen (5 weken)

import { PeriodDateInfo, WeekInfo } from '../types/period-day-staffing';

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
  const start = new Date(startDate + 'T00:00:00'); // Voorkom timezone issues
  
  for (let i = 0; i < 35; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    
    const dateString = formatDateToYYYYMMDD(currentDate);
    const dayOfWeek = currentDate.getDay(); // 0=zondag, 1=maandag, ..., 6=zaterdag
    const dagSoort = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Converteer naar 0=ma, 6=zo
    const isFeestdag = holidays.includes(dateString);
    
    const { weekNumber, year } = getWeekInfo(dateString);
    
    dates.push({
      date: dateString,
      dagIndex: i,
      dagSoort,
      weekNumber,
      year,
      isFeestdag,
      dateShort: currentDate.getDate().toString(),
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
  const date = new Date(dateString + 'T00:00:00');
  
  // ISO week date berekening
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Maandag = 0
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format datum naar kort formaat (alleen dag-nummer)
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns Dag-nummer als string ("1", "25", etc.)
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.getDate().toString();
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
 * Parse YYYY-MM-DD string naar Date object (zonder timezone issues)
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns Date object
 */
export function parseDateString(dateString: string): Date {
  return new Date(dateString + 'T00:00:00');
}

/**
 * Check of een datum geldig is
 * @param dateString - Datum in YYYY-MM-DD formaat
 * @returns True als geldig
 */
export function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = parseDateString(dateString);
  return !isNaN(date.getTime());
}

/**
 * Bereken het aantal dagen tussen twee datums
 * @param date1 - Eerste datum (YYYY-MM-DD)
 * @param date2 - Tweede datum (YYYY-MM-DD)
 * @returns Aantal dagen verschil (absoluut)
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = parseDateString(date1);
  const d2 = parseDateString(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
