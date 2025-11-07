import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { readRosters } from './storage';
import { getWeekdayCode } from '@/lib/utils/date-helpers';
// <<<<<<<<<<<<<<<<<<<<<<<< NIEUW: import auto-fill NB >>>>>>>>>>>>>>>>>>>>>>>>
import { autofillUnavailability as _autofillUnavailability } from '@/lib/planning/rosterDesign';

const ROSTER_DESIGN_KEY = 'roster_design_data';

function normalizeDienstverband(value: any): DienstverbandType {
  if (!value) return DienstverbandType.LOONDIENST;
  const str = String(value).toLowerCase().trim();
  if (str === 'maat') return DienstverbandType.MAAT;
  if (str === 'loondienst') return DienstverbandType.LOONDIENST;
  if (str === 'zzp') return DienstverbandType.ZZP;
  return DienstverbandType.LOONDIENST;
}
function normalizeTeam(value: any): TeamType {
  if (!value) return TeamType.OVERIG;
  const str = String(value).toLowerCase().trim();
  if (str === 'groen') return TeamType.GROEN;
  if (str === 'oranje') return TeamType.ORANJE;
  return TeamType.OVERIG;
}
function sortEmployeesForRoster(list: any[]) {
  const teamOrder = [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG];
  const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
  return [...list]
    .filter(e => e.actief || e.active)
    .sort((a, b) => {
      const teamA = normalizeTeam(a.team);
      const teamB = normalizeTeam(b.team);
      const dienstA = normalizeDienstverband(a.dienstverband);
      const dienstB = normalizeDienstverband(b.dienstverband);
      const t = teamOrder.indexOf(teamA) - teamOrder.indexOf(teamB);
      if (t !== 0) return t;
      const d = dienstOrder.indexOf(dienstA) - dienstOrder.indexOf(dienstB);
      if (d !== 0) return d;
      const firstName = (a.voornaam || a.name?.split(' ')[0] || '');
      const firstNameB = (b.voornaam || b.name?.split(' ')[0] || '');
      return firstName.localeCompare(firstNameB, 'nl');
    });
}
/** Creëer employee snapshot bij rooster creatie met ECHTE employee data */
export function createEmployeeSnapshot(rosterId: string): RosterEmployee[] {
  const employees = sortEmployeesForRoster(getAllEmployees());
  return employees.map(emp => {
    const rosterEmployee = createDefaultRosterEmployee({
      id: emp.id,
      name: emp.name || `${emp.voornaam} ${emp.achternaam}`,
      actief: emp.actief || emp.active || true
    });
    rosterEmployee.maxShifts = emp.aantalWerkdagen || 24;
    rosterEmployee.availableServices = ['dagdienst', 'nachtdienst', 'bereikbaarheidsdienst'];
    (rosterEmployee as any).team = emp.team;
    (rosterEmployee as any).dienstverband = emp.dienstverband;
    (rosterEmployee as any).voornaam = emp.voornaam || emp.name?.split(' ')[0] || '';
    (rosterEmployee as any).roostervrijDagen = emp.roostervrijDagen || [];
    return rosterEmployee;
  });
}

export function loadRosterDesignData(rosterId: string): RosterDesignData | null {
  try {
    const stored = localStorage.getItem(`${ROSTER_DESIGN_KEY}_${rosterId}`);
    if (!stored) return null;
    const data = JSON.parse(stored) as RosterDesignData;
    if (!(data as any).start_date) {
      const roster = readRosters().find(r => r.id === rosterId);
      if (roster?.start_date) {
        (data as any).start_date = roster.start_date;
        saveRosterDesignData(data);
      }
    }
    return data;
  } catch (error) {
    console.error('Fout bij laden roster ontwerp data:', error);
    return null;
  }
}
export function saveRosterDesignData(data: RosterDesignData): boolean {
  try {
    const key = `${ROSTER_DESIGN_KEY}_${data.rosterId}`;
    data.updated_at = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Fout bij opslaan roster ontwerp data:', error);
    return false;
  }
}
/** Initialiseer nieuw roster ontwerp met VERPLICHTE start_date */
export function initializeRosterDesign(rosterId: string, start_date: string): RosterDesignData {
  const employees = createEmployeeSnapshot(rosterId);
  const status = createDefaultRosterStatus();
  const designData: RosterDesignData = {
    rosterId,
    employees,
    status,
    unavailabilityData: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    start_date
  } as RosterDesignData & { start_date: string };
  saveRosterDesignData(designData);
  // ====================== FIX: roep autofill direct aan =================
  _autofillUnavailability(rosterId, start_date);
  // =============== einde fix ================
  return loadRosterDesignData(rosterId)!;
}
// ... overige code blijft ongewijzigd ...
