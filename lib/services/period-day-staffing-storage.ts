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
export async function initializePeriodStaffingForRoster(
  rosterId: string,
  startDate: string,
  holidays: string[] = []
): Promise<PeriodDayStaffing[]> {
  const dates = getDatesForRosterPeriod(startDate, holidays);

  // Haal actieve diensten en dagsoort-regels op
  const diensten = (await getAllServices()).filter(s => s.actief);
  const dagsoortRegels = getAllDayTypeStaffing();

  const periodStaffing: PeriodDayStaffing[] = [];
  const now = new Date().toISOString();

  diensten.forEach(dienst => {
    dates.forEach(dateInfo => {
      const effectieveDagSoort = getEffectiveDayType(dateInfo);
      const regel = dagsoortRegels.find(r => 
        r.dienstId === dienst.id && 
        r.dagSoort === effectieveDagSoort
      );
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

// (Rest blijft ongewijzigd)
