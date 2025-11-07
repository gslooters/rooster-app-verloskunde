// lib/utils/date-helpers.ts
// Datum helper functies voor roosterplanning

import { parseISO } from 'date-fns';

/**
 * Dag codes zoals gebruikt in Employee.roostervrijDagen
 */
export type DagCode = 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';

/**
 * Converteer een Date object naar Nederlandse dag-code
 * 
 * @param date - JavaScript Date object
 * @returns Nederlandse dag-code: 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'
 * 
 * @example
 * const date = new Date('2025-11-11'); // Dinsdag
 * getWeekdayCode(date); // Returns: 'di'
 */
export function getWeekdayCode(date: Date): DagCode {
  const dayIndex = date.getDay(); // 0 = Zondag, 1 = Maandag, ..., 6 = Zaterdag
  
  // Map JavaScript day index naar Nederlandse dag codes
  const dagCodeMap: DagCode[] = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  
  return dagCodeMap[dayIndex];
}

/**
 * Converteer YYYY-MM-DD string naar Nederlandse dag-code
 * 
 * @param dateString - Datum string in YYYY-MM-DD formaat
 * @returns Nederlandse dag-code: 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'
 * 
 * @example
 * getWeekdayCodeFromString('2025-11-11'); // Returns: 'di'
 */
export function getWeekdayCodeFromString(dateString: string): DagCode {
  const date = parseISO(dateString);
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