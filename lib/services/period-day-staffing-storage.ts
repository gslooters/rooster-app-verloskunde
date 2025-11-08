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

function getStorageKey(rosterId: string): string {
  return `roster_period_staffing_${rosterId}`;
}

export async function initializePeriodStaffingForRoster(
  rosterId: string,
  startDate: string,
  holidays: string[] = []
): Promise<PeriodDayStaffing[]> {
  const dates = getDatesForRosterPeriod(startDate, holidays);
  const diensten = (await getAllServices()).filter(s => s.actief);
  const dagsoortRegels = getAllDayTypeStaffing();

  const periodStaffing: PeriodDayStaffing[] = [];
  const now = new Date().toISOString();

  diensten.forEach(dienst => {
    dates.forEach(dateInfo => {
      const effectieveDagSoort = getEffectiveDayType(dateInfo);
      const regel = dagsoortRegels.find(r => r.dienstId === dienst.id && r.dagSoort === effectieveDagSoort);
      const teamScope = getServiceTeamScope(dienst.id);
      const staffing: PeriodDayStaffing = {
        id: generatePeriodStaffingId(),
        rosterId,
        dienstId: dienst.id,
        dagDatum: dateInfo.date,
        dagIndex: dateInfo.dagIndex,
        dagSoort: dateInfo.dagSoort,
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
  savePeriodStaffingForRoster(rosterId, periodStaffing);
  console.log(`[PeriodStaffing] Initialized ${periodStaffing.length} records for roster ${rosterId}`);
  return periodStaffing;
}

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

export function savePeriodStaffingForRoster(rosterId: string, data: PeriodDayStaffing[]): void {
  try {
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

export function periodStaffingExists(rosterId: string): boolean {
  const key = getStorageKey(rosterId);
  return localStorage.getItem(key) !== null;
}
