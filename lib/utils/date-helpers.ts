// lib/utils/date-helpers.ts
// Datum helper functies voor roosterplanning

import { parseUTCDate, getUTCWeekNumber, getUTCMonday } from './date-utc';

/**
 * Dag codes zoals gebruikt in Employee.roostervrijDagen
 */
export type DagCode = 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';

/**
 * Converteer een Date object naar Nederlandse dag-code (UTC-safe)
 * 
 * @param date - JavaScript Date object
 * @returns Nederlandse dag-code: 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'
 * 
 * @example
 * const date = parseUTCDate('2025-11-11'); // Dinsdag
 * getWeekdayCode(date); // Returns: 'di'
 */
export function getWeekdayCode(date: Date): DagCode {
  const dayIndex = date.getUTCDay(); // 0 = Zondag, 1 = Maandag, ..., 6 = Zaterdag
  
  // Map JavaScript day index naar Nederlandse dag codes
  const dagCodeMap: DagCode[] = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  
  return dagCodeMap[dayIndex];
}

/**
 * Converteer YYYY-MM-DD string naar Nederlandse dag-code (UTC-safe)
 * 
 * @param dateString - Datum string in YYYY-MM-DD formaat
 * @returns Nederlandse dag-code: 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'
 * 
 * @example
 * getWeekdayCodeFromString('2025-11-11'); // Returns: 'di'
 */
export function getWeekdayCodeFromString(dateString: string): DagCode {
  const date = parseUTCDate(dateString);
  return getWeekdayCode(date);
}

/**
 * Converteer dag-code naar volledige Nederlandse naam
 * 
 * @param dagCode - Nederlandse dag-code
 * @returns Volledige naam van de dag
 * 
 * @example
 * getDagNaam('ma'); // Returns: 'Maandag'
 */
export function getDagNaam(dagCode: DagCode): string {
  const namenMap: Record<DagCode, string> = {
    'ma': 'Maandag',
    'di': 'Dinsdag',
    'wo': 'Woensdag',
    'do': 'Donderdag',
    'vr': 'Vrijdag',
    'za': 'Zaterdag',
    'zo': 'Zondag'
  };
  
  return namenMap[dagCode];
}

/**
 * Controleer of een datum op een specifieke dag-code valt
 * 
 * @param dateString - Datum string in YYYY-MM-DD formaat
 * @param dagCode - Nederlandse dag-code om te controleren
 * @returns true als de datum op de gegeven dag valt
 * 
 * @example
 * isDateOnWeekday('2025-11-11', 'di'); // Returns: true (11 nov 2025 is dinsdag)
 * isDateOnWeekday('2025-11-11', 'ma'); // Returns: false
 */
export function isDateOnWeekday(dateString: string, dagCode: DagCode): boolean {
  return getWeekdayCodeFromString(dateString) === dagCode;
}

/**
 * Controleer of een datum op een van de gegeven dag-codes valt
 * 
 * @param dateString - Datum string in YYYY-MM-DD formaat  
 * @param dagCodes - Array van Nederlandse dag-codes
 * @returns true als de datum op een van de gegeven dagen valt
 * 
 * @example
 * isDateOnAnyWeekday('2025-11-15', ['za', 'zo']); // Returns: true (15 nov 2025 is zaterdag)
 */
export function isDateOnAnyWeekday(dateString: string, dagCodes: string[]): boolean {
  const dagCode = getWeekdayCodeFromString(dateString);
  return dagCodes.includes(dagCode);
}

/**
 * Bereken ISO weeknummer voor een gegeven datum (UTC-safe)
 * ISO 8601 definitie: Week 1 is de week met de eerste donderdag van het jaar
 * 
 * @param date - JavaScript Date object
 * @returns ISO weeknummer (1-53)
 * 
 * @example
 * getWeekNumber(parseUTCDate('2025-01-01')); // Returns: 1
 * getWeekNumber(parseUTCDate('2025-12-31')); // Returns: 53 of 1 (afhankelijk van jaar)
 */
export function getWeekNumber(date: Date): number {
  const { week } = getUTCWeekNumber(date);
  return week;
}

/**
 * Krijg de maandag van de week waarin een datum valt (UTC-safe)
 * 
 * @param date - JavaScript Date object
 * @returns Date object van de maandag van die week
 * 
 * @example
 * getMondayOfWeek(parseUTCDate('2025-11-23')); // Zondag 23 nov -> Retourneert maandag 17 nov
 * getMondayOfWeek(parseUTCDate('2025-11-24')); // Maandag 24 nov -> Retourneert maandag 24 nov
 * getMondayOfWeek(parseUTCDate('2025-11-26')); // Woensdag 26 nov -> Retourneert maandag 24 nov
 */
export function getMondayOfWeek(date: Date): Date {
  return getUTCMonday(date);
}