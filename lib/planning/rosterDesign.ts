// lib/planning/rosterDesign.ts - HERSTRUCTUREERD
// Complete, correcte implementatie met ALLE exports los, optie A fix, geen cirkel

import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { readRosters } from './storage';
import { getWeekdayCode } from '@/lib/utils/date-helpers';

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
  autofillUnavailability(rosterId, start_date); // Belangrijk: direct na init
  return loadRosterDesignData(rosterId)!;
}
export function updateEmployeeMaxShifts(rosterId: string, employeeId: string, maxShifts: number): boolean {
  if (!validateMaxShifts(maxShifts)) { console.error(`Ongeldig aantal diensten: ${maxShifts}.`); return false; }
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  const employee = designData.employees.find(emp => emp.id === employeeId); if (!employee) return false;
  employee.maxShifts = maxShifts; return saveRosterDesignData(designData);
};
export function toggleUnavailability(rosterId: string, employeeId: string, date: string): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  if (!designData.unavailabilityData[employeeId]) { designData.unavailabilityData[employeeId] = {}; }
  const current = designData.unavailabilityData[employeeId][date] || false;
  designData.unavailabilityData[employeeId][date] = !current; return saveRosterDesignData(designData);
}
export function autofillUnavailability(rosterId: string, start_date: string): boolean {
  // Gebruik snapshot.roostervrijDagen per medewerker
  const designData = loadRosterDesignData(rosterId);
  if (!designData) { return false; }
  const startDate = new Date(start_date + 'T00:00:00');
  for (const emp of designData.employees) {
    const roostervrijDagen: string[] = (emp as any).roostervrijDagen || [];
    if (!roostervrijDagen.length) continue;
    if (!designData.unavailabilityData[emp.id]) { designData.unavailabilityData[emp.id] = {}; }
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dagCode = getWeekdayCode(currentDate);
      const dateISO = currentDate.toISOString().split('T')[0];
      if (roostervrijDagen.includes(dagCode)) {
        if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = true;
        }
      } else {
        if (designData.unavailabilityData[emp.id][dateISO] === undefined) {
          designData.unavailabilityData[emp.id][dateISO] = false;
        }
      }
    }
  }
  return saveRosterDesignData(designData);
}
export function syncRosterDesignWithEmployeeData(rosterId: string): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  const currentEmployees = getAllEmployees();
  const employeeMap = new Map(currentEmployees.map(emp => [emp.id, emp]));
  let updated = false;
  for (const rosterEmp of designData.employees) {
    const currentEmp = employeeMap.get(rosterEmp.id);
    if (currentEmp) {
      if ((rosterEmp as any).team !== currentEmp.team) {
        (rosterEmp as any).team = currentEmp.team; updated = true;
      }
      (rosterEmp as any).dienstverband = currentEmp.dienstverband;
      (rosterEmp as any).voornaam = currentEmp.voornaam;
      (rosterEmp as any).roostervrijDagen = currentEmp.roostervrijDagen;
    }
  }
  return updated ? saveRosterDesignData(designData) : true;
}
export function isEmployeeUnavailable(rosterId: string, employeeId: string, date: string): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  return !!designData.unavailabilityData?.[employeeId]?.[date];
}
export function updateRosterDesignStatus(rosterId: string, updates: Partial<RosterStatus>): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false; designData.status = { ...designData.status, ...updates }; return saveRosterDesignData(designData);
}
export function validateDesignComplete(rosterId: string): { isValid: boolean; errors: string[] } {
  const designData = loadRosterDesignData(rosterId); if (!designData) { return { isValid: false, errors: ['Roster ontwerp data niet gevonden'] }; }
  const errors: string[] = []; const employeesWithoutShifts = designData.employees.filter(emp => emp.maxShifts === 0); if (employeesWithoutShifts.length > 0) { errors.push(`Volgende medewerkers hebben geen aantal diensten ingevuld: ${employeesWithoutShifts.map(e => e.name).join(', ')}`); }
  if (designData.status.servicesStatus !== 'vastgesteld') { errors.push('Diensten per dag moeten worden vastgesteld voordat AI kan worden gebruikt'); }
  return { isValid: errors.length === 0, errors };
}
export function exportRosterDesignData(rosterId: string): string | null { const designData = loadRosterDesignData(rosterId); if (!designData) return null; return JSON.stringify(designData, null, 2); }
