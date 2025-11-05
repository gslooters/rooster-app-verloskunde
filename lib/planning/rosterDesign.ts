// lib/planning/rosterDesign.ts
// Uitbreiding: auto-fill startdatum, medewerkers-snapshot met sortering + team badge info,
// maxShifts = aantalWerkdagen, en NB auto-fill op basis van roostervrijDagen.

import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';

// LocalStorage keys
const ROSTER_DESIGN_KEY = 'roster_design_data';

// Helper: team/dienstverband sortering
function sortEmployeesForRoster(list: any[]) {
  const teamOrder = [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG];
  const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
  return [...list]
    .filter(e => e.actief)
    .sort((a,b) => {
      const t = teamOrder.indexOf(a.team) - teamOrder.indexOf(b.team);
      if (t !== 0) return t;
      const d = dienstOrder.indexOf(a.dienstverband) - dienstOrder.indexOf(b.dienstverband);
      if (d !== 0) return d;
      return a.voornaam.localeCompare(b.voornaam, 'nl');
    });
}

/**
 * Creëer employee snapshot bij rooster creatie met auto-fill
 */
export function createEmployeeSnapshot(rosterId: string): RosterEmployee[] {
  const activeEmployees = sortEmployeesForRoster(getAllEmployees());
  return activeEmployees.map(emp => {
    const rosterEmployee = createDefaultRosterEmployee({ id: emp.id, name: `${emp.voornaam} ${emp.achternaam}`, actief: emp.actief });
    rosterEmployee.maxShifts = emp.aantalWerkdagen ?? 0; // Max diensten per 5 weken
    rosterEmployee.availableServices = [];
    (rosterEmployee as any).team = emp.team; (rosterEmployee as any).dienstverband = emp.dienstverband; (rosterEmployee as any).voornaam = emp.voornaam; (rosterEmployee as any).roostervrijDagen = emp.roostervrijDagen || [];
    return rosterEmployee;
  });
}

/** Laad roster ontwerp data */
export function loadRosterDesignData(rosterId: string): RosterDesignData | null {
  try { const stored = localStorage.getItem(`${ROSTER_DESIGN_KEY}_${rosterId}`); if (!stored) return null; return JSON.parse(stored) as RosterDesignData; } catch (error) { console.error('Fout bij laden roster ontwerp data:', error); return null; }
}

/** Sla roster ontwerp data op */
export function saveRosterDesignData(data: RosterDesignData): boolean {
  try { const key = `${ROSTER_DESIGN_KEY}_${data.rosterId}`; data.updated_at = new Date().toISOString(); localStorage.setItem(key, JSON.stringify(data)); return true; } catch (error) { console.error('Fout bij opslaan roster ontwerp data:', error); return false; }
}

/** Initialiseer nieuw roster ontwerp met auto-fill */
export function initializeRosterDesign(rosterId: string, start_date?: string): RosterDesignData {
  const employees = createEmployeeSnapshot(rosterId); const status = createDefaultRosterStatus();
  const designData: RosterDesignData = { rosterId, employees, status, unavailabilityData: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(start_date ? ({ start_date } as any) : {}) };
  saveRosterDesignData(designData); return designData;
}

/** Update max shifts voor een medewerker */
export function updateEmployeeMaxShifts(rosterId: string, employeeId: string, maxShifts: number): boolean {
  if (!validateMaxShifts(maxShifts)) { console.error(`Ongeldig aantal diensten: ${maxShifts}.`); return false; }
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  const employee = designData.employees.find(emp => emp.id === employeeId); if (!employee) return false;
  employee.maxShifts = maxShifts; return saveRosterDesignData(designData);
}

/** Toggle niet-beschikbaarheid voor medewerker op specifieke datum */
export function toggleUnavailability(rosterId: string, employeeId: string, date: string): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  if (!designData.unavailabilityData[employeeId]) { designData.unavailabilityData[employeeId] = {}; }
  const current = designData.unavailabilityData[employeeId][date] || false;
  designData.unavailabilityData[employeeId][date] = !current; return saveRosterDesignData(designData);
}

/** Batch auto-fill NB op basis van roostervrijDagen en start_date */
export function autofillUnavailability(rosterId: string, start_date: string): boolean {
  const designData = loadRosterDesignData(rosterId); if (!designData) return false;
  const start = new Date(start_date + 'T00:00:00');
  for (const emp of designData.employees) {
    const roostervrij: string[] = (emp as any).roostervrijDagen || [];
    if (!designData.unavailabilityData[emp.id]) { designData.unavailabilityData[emp.id] = {}; }
    for (let i=0; i<35; i++) { const d = new Date(start); d.setDate(start.getDate()+i); const dayCode = ['zo','ma','di','wo','do','vr','za'][d.getDay()]; const iso = d.toISOString().split('T')[0]; designData.unavailabilityData[emp.id][iso] = roostervrij.includes(dayCode); }
  }
  return saveRosterDesignData(designData);
}

/** Exporteer helper voor andere modules */
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
