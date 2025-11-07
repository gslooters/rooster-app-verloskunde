// lib/services/period-day-staffing-storage.ts
// Storage functies voor periode-specifieke dagbezetting (35 dagen)

import { 
  PeriodDayStaffing, 
  PeriodDayStaffingInput,
  generatePeriodStaffingId,
  validatePeriodStaffing 
} from '../types/period-day-staffing';
import { getDatesForRosterPeriod, getEffectiveDayType } from '../utils/roster-date-helpers';
import { getAllServices } from './diensten-storage';
import { getAllDayTypeStaffing, getServiceTeamScope } from './daytype-staffing-storage';
import { TeamScope, getDefaultTeamScope } from '../types/daytype-staffing';

/**
 * LocalStorage key generator voor period staffing
 */
function getStorageKey(rosterId: string): string {
  return `roster_period_staffing_${rosterId}`;
}

/**
 * Initialiseer period staffing voor een nieuw rooster
 * Deze functie wordt automatisch aangeroepen bij rooster creatie
 * Kopieert dagsoort-regels naar alle 35 dagen, met feestdag-ondersteuning
 * 
 * @param rosterId - ID van het rooster
 * @param startDate - Start datum van het rooster (YYYY-MM-DD)
 * @param holidays - Array van feestdagen (YYYY-MM-DD)
 * @returns Array van aangemaakte PeriodDayStaffing objecten
 */
export function initializePeriodStaffingForRoster(
  rosterId: string,
  startDate: string,
  holidays: string[] = []
): PeriodDayStaffing[] {
  // Genereer 35 dagen info
  const dates = getDatesForRosterPeriod(startDate, holidays);
  
  // Haal actieve diensten en dagsoort-regels op
  const diensten = getAllServices().filter(s => s.actief);
  const dagsoortRegels = getAllDayTypeStaffing();
  
  const periodStaffing: PeriodDayStaffing[] = [];
  const now = new Date().toISOString();
  
  // Voor elke dienst × elke dag
  diensten.forEach(dienst => {
    dates.forEach(dateInfo => {
      // Bij feestdag: gebruik zondag-regel (dagSoort = 6)
      const effectieveDagSoort = getEffectiveDayType(dateInfo);
      
      // Zoek de dagsoort-regel voor deze dienst + effectieve dagsoort
      const regel = dagsoortRegels.find(r => 
        r.dienstId === dienst.id && 
        r.dagSoort === effectieveDagSoort
      );
      
      // Team-scope ALTIJD van dienst-niveau, niet van dagsoort
      const teamScope = getServiceTeamScope(dienst.id);
      
      // Maak period staffing record
      const staffing: PeriodDayStaffing = {
        id: generatePeriodStaffingId(),
        rosterId,
        dienstId: dienst.id,
        dagDatum: dateInfo.date,
        dagIndex: dateInfo.dagIndex,
        dagSoort: dateInfo.dagSoort, // Originele dagsoort (niet effectief)
        isFeestdag: dateInfo.isFeestdag,
        minBezetting: regel?.minBezetting || 0,
        maxBezetting: regel?.maxBezetting || 0,
        teamScope: teamScope,
        created_at: now,
        updated_at: now
      };
      
      periodStaffing.push(staffing);
    });
  });
  
  // Opslaan in localStorage
  savePeriodStaffingForRoster(rosterId, periodStaffing);
  
  console.log(`[PeriodStaffing] Initialized ${periodStaffing.length} records for roster ${rosterId}`);
  return periodStaffing;
}

/**
 * Haal alle period staffing op voor een rooster
 * @param rosterId - ID van het rooster
 * @returns Array van PeriodDayStaffing objecten
 */
export function getPeriodStaffingForRoster(rosterId: string): PeriodDayStaffing[] {
  try {
    const key = getStorageKey(rosterId);
    const data = localStorage.getItem(key);
    
    if (!data) {
      console.warn(`[PeriodStaffing] No data found for roster ${rosterId}`);
      return [];
    }
    
    const parsed = JSON.parse(data) as PeriodDayStaffing[];
    return parsed;
  } catch (error) {
    console.error('[PeriodStaffing] Error loading data:', error);
    return [];
  }
}

/**
 * Sla period staffing op voor een rooster
 * @param rosterId - ID van het rooster
 * @param data - Array van PeriodDayStaffing objecten
 */
export function savePeriodStaffingForRoster(
  rosterId: string,
  data: PeriodDayStaffing[]
): void {
  try {
    // Valideer alle records
    const invalidRecords = data.filter(s => !validatePeriodStaffing(s));
    if (invalidRecords.length > 0) {
      console.error('[PeriodStaffing] Invalid records found:', invalidRecords);
      throw new Error(`${invalidRecords.length} invalid records found`);
    }
    
    const key = getStorageKey(rosterId);
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`[PeriodStaffing] Saved ${data.length} records for roster ${rosterId}`);
  } catch (error) {
    console.error('[PeriodStaffing] Error saving data:', error);
    throw error;
  }
}

/**
 * Update een enkele cel (min of max bezetting)
 * @param rosterId - ID van het rooster
 * @param dienstId - ID van de dienst
 * @param dagIndex - Dag index (0-34)
 * @param field - 'minBezetting' of 'maxBezetting'
 * @param value - Nieuwe waarde
 */
export function updateSingleCell(
  rosterId: string,
  dienstId: string,
  dagIndex: number,
  field: 'minBezetting' | 'maxBezetting',
  value: number
): void {
  const allData = getPeriodStaffingForRoster(rosterId);
  
  const updated = allData.map(item => {
    if (item.dienstId === dienstId && item.dagIndex === dagIndex) {
      return {
        ...item,
        [field]: value,
        updated_at: new Date().toISOString()
      };
    }
    return item;
  });
  
  savePeriodStaffingForRoster(rosterId, updated);
}

/**
 * Update team-scope voor alle dagen van een specifieke dienst
 * @param rosterId - ID van het rooster
 * @param dienstId - ID van de dienst
 * @param newScope - Nieuwe team scope
 */
export function updateTeamScopeForService(
  rosterId: string,
  dienstId: string,
  newScope: TeamScope
): void {
  const allData = getPeriodStaffingForRoster(rosterId);
  
  const updated = allData.map(item => {
    if (item.dienstId === dienstId) {
      return {
        ...item,
        teamScope: newScope,
        updated_at: new Date().toISOString()
      };
    }
    return item;
  });
  
  savePeriodStaffingForRoster(rosterId, updated);
}

/**
 * Verwijder alle period staffing voor een rooster
 * Wordt aangeroepen bij rooster verwijdering
 * @param rosterId - ID van het rooster
 */
export function deletePeriodStaffingForRoster(rosterId: string): void {
  try {
    const key = getStorageKey(rosterId);
    localStorage.removeItem(key);
    console.log(`[PeriodStaffing] Deleted data for roster ${rosterId}`);
  } catch (error) {
    console.error('[PeriodStaffing] Error deleting data:', error);
  }
}

/**
 * Check of period staffing bestaat voor een rooster
 * @param rosterId - ID van het rooster
 * @returns True als data bestaat
 */
export function periodStaffingExists(rosterId: string): boolean {
  const key = getStorageKey(rosterId);
  return localStorage.getItem(key) !== null;
}

/**
 * Haal period staffing op voor een specifieke dienst
 * @param rosterId - ID van het rooster
 * @param dienstId - ID van de dienst
 * @returns Array van 35 PeriodDayStaffing objecten voor deze dienst
 */
export function getPeriodStaffingForService(
  rosterId: string,
  dienstId: string
): PeriodDayStaffing[] {
  const allData = getPeriodStaffingForRoster(rosterId);
  return allData
    .filter(s => s.dienstId === dienstId)
    .sort((a, b) => a.dagIndex - b.dagIndex);
}

/**
 * Haal period staffing op voor een specifieke dag
 * @param rosterId - ID van het rooster
 * @param dagIndex - Dag index (0-34)
 * @returns Array van PeriodDayStaffing objecten voor deze dag (alle diensten)
 */
export function getPeriodStaffingForDay(
  rosterId: string,
  dagIndex: number
): PeriodDayStaffing[] {
  const allData = getPeriodStaffingForRoster(rosterId);
  return allData.filter(s => s.dagIndex === dagIndex);
}

/**
 * Tel aantal validatie-errors
 * @param rosterId - ID van het rooster
 * @returns Aantal records met min > max
 */
export function countValidationErrors(rosterId: string): number {
  const allData = getPeriodStaffingForRoster(rosterId);
  return allData.filter(s => s.minBezetting > s.maxBezetting).length;
}
