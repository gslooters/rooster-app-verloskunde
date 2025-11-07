// lib/types/period-day-staffing.ts
// Types voor periode-specifieke dagbezetting (35 dagen rooster)

import { TeamScope } from './daytype-staffing';

/**
 * Bezettingsregel voor een specifieke dag in een roosterperiode
 * Dit verschilt van DayTypeStaffing doordat het aan een concreet rooster en datum gebonden is
 */
export interface PeriodDayStaffing {
  id: string; // Unieke identifier
  rosterId: string; // Foreign key naar Roster
  dienstId: string; // Foreign key naar Dienst
  dagDatum: string; // YYYY-MM-DD formaat
  dagIndex: number; // 0-34 (positie binnen de 5-weken periode)
  dagSoort: number; // 0-6 (0=maandag, 6=zondag) - originele dagsoort
  isFeestdag: boolean; // True als deze dag een feestdag is
  minBezetting: number; // 0-8
  maxBezetting: number; // 0-9 (9 = onbeperkt)
  teamScope: TeamScope; // 'total' | 'groen' | 'oranje' | 'both'
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

/**
 * Datum-informatie voor één dag in de roosterperiode
 * Hulpstructuur voor weergave en berekeningen
 */
export interface PeriodDateInfo {
  date: string; // YYYY-MM-DD
  dagIndex: number; // 0-34
  dagSoort: number; // 0-6 (0=maandag, 6=zondag)
  weekNumber: number; // ISO week nummer
  year: number; // Jaar (belangrijk bij jaar-overgang)
  isFeestdag: boolean; // True als in holidays array
  dateShort: string; // Kort formaat: "25"
  dayName: string; // Korte naam: "MA", "DI", etc.
}

/**
 * Week-informatie voor groepering in UI
 */
export interface WeekInfo {
  weekNumber: number;
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: PeriodDateInfo[]; // 7 dagen in deze week
}

/**
 * Input voor het aanmaken van period staffing
 */
export interface PeriodDayStaffingInput {
  rosterId: string;
  dienstId: string;
  dagDatum: string;
  dagIndex: number;
  dagSoort: number;
  isFeestdag: boolean;
  minBezetting: number;
  maxBezetting: number;
  teamScope: TeamScope;
}

/**
 * Validatie functies
 */
export function validatePeriodStaffing(staffing: PeriodDayStaffing): boolean {
  return (
    staffing.minBezetting >= 0 &&
    staffing.minBezetting <= 8 &&
    staffing.maxBezetting >= 0 &&
    staffing.maxBezetting <= 9 &&
    staffing.minBezetting <= staffing.maxBezetting &&
    staffing.dagIndex >= 0 &&
    staffing.dagIndex <= 34 &&
    staffing.dagSoort >= 0 &&
    staffing.dagSoort <= 6
  );
}

/**
 * Check of min/max geldig is
 */
export function isValidBezetting(min: number, max: number): boolean {
  return (
    min >= 0 &&
    min <= 8 &&
    max >= 0 &&
    max <= 9 &&
    min <= max
  );
}

/**
 * Genereer uniek ID voor period staffing record
 */
export function generatePeriodStaffingId(): string {
  return `ps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper om cell key te maken voor error tracking
 */
export function makeCellKey(dienstId: string, dagIndex: number): string {
  return `${dienstId}-${dagIndex}`;
}

/**
 * Helper om bezettings-tekst te genereren (zoals in dagsoort-scherm)
 */
export function getBezettingText(min: number, max: number): string {
  if (min === 0 && max === 0) return 'Geen';
  if (min === max) return `Exact ${min}`;
  if (max === 9) return `Min ${min}, onbep`;
  return `${min}-${max}`;
}

/**
 * Helper om bezettings-kleur te bepalen (zoals in dagsoort-scherm)
 */
export function getBezettingColor(min: number, max: number): string {
  if (min === 0 && max === 0) return 'bg-gray-100 text-gray-500';
  if (min === max && min === 1) return 'bg-blue-100 text-blue-800';
  if (min >= 1 && max <= 3) return 'bg-green-100 text-green-800';
  if (max >= 4) return 'bg-yellow-100 text-yellow-800';
  return 'bg-orange-100 text-orange-800';
}
