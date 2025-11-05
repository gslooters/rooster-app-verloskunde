// lib/planning/rosterDesign.ts
// CRITICAL FIX: Use real employee data instead of mock data for team assignments

import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getAllEmployees } from '@/lib/services/employees-storage';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { readRosters } from './storage';

const ROSTER_DESIGN_KEY = 'roster_design_data';

// Helper: team/dienstverband sortering
function sortEmployeesForRoster(list: any[]) {
  const teamOrder = [TeamType.GROEN, TeamType.ORANJE, TeamType.OVERIG];
  const dienstOrder = [DienstverbandType.MAAT, DienstverbandType.LOONDIENST, DienstverbandType.ZZP];
  return [...list]
    .filter(e => e.actief || e.active) // Support beide formaten
    .sort((a,b) => {
      // GEBRUIK ECHTE EMPLOYEE DATA (niet mock)
      const teamA = a.team || TeamType.OVERIG;
      const teamB = b.team || TeamType.OVERIG;
      const dienstA = a.dienstverband || DienstverbandType.LOONDIENST;
      const dienstB = b.dienstverband || DienstverbandType.LOONDIENST;
      
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
  console.log('🔍 Creating employee snapshot with REAL employee data:', employees.map(e => ({ id: e.id, name: e.voornaam + ' ' + e.achternaam, team: e.team, dienstverband: e.dienstverband })));
  
  return employees.map(emp => {
    const rosterEmployee = createDefaultRosterEmployee({ 
      id: emp.id, 
      name: emp.name || `${emp.voornaam} ${emp.achternaam}`, 
      actief: emp.actief || emp.active || true
    });
    
    // GEBRUIK ECHTE EMPLOYEE DATA (geen mock meer)
    rosterEmployee.maxShifts = emp.dienstverband === DienstverbandType.ZZP ? 15 : 
                               emp.dienstverband === DienstverbandType.LOONDIENST ? 20 : 25;
    rosterEmployee.availableServices = ['dagdienst', 'nachtdienst', 'bereikbaarheidsdienst'];
    (rosterEmployee as any).team = emp.team; // ECHTE team uit employee storage
    (rosterEmployee as any).dienstverband = emp.dienstverband;
    (rosterEmployee as any).voornaam = emp.voornaam || emp.name?.split(' ')[0] || '';
    (rosterEmployee as any).roostervrijDagen = emp.roostervrijDagen || [];
    
    console.log(`👤 ${emp.voornaam}: team=${emp.team}, dienstverband=${emp.dienstverband}`);
    
    return rosterEmployee;
  });
}

/** Laad roster ontwerp data */
export function loadRosterDesignData(rosterId: string): RosterDesignData | null {
  try { 
    const stored = localStorage.getItem(`${ROSTER_DESIGN_KEY}_${rosterId}`); 
    if (!stored) return null; 
    const data = JSON.parse(stored) as RosterDesignData;
    
    // Fix: Synchroniseer startdatum als die ontbreekt maar wel in rooster bron staat
    if (!(data as any).start_date) {
      const roster = readRosters().find(r => r.id === rosterId);
      if (roster?.start_date) {
        (data as any).start_date = roster.start_date;
        saveRosterDesignData(data); // Schrijf terug naar snapshot
      }
    }
    
    return data;
  } catch (error) { 
    console.error('Fout bij laden roster ontwerp data:', error); 
    return null; 
  }
}

/** Sla roster ontwerp data op */
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
    start_date // Expliciet opslaan in design-snapshot
  } as RosterDesignData & { start_date: string };
  
  saveRosterDesignData(designData); 
  return designData;
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

/** Batch auto-fill NB op basis van ECHTE roostervrijDagen en start_date */
export function autofillUnavailability(rosterId: string, start_date: string): boolean {
  console.log('🔍 Starting autofill for rosterId:', rosterId, 'start_date:', start_date);
  
  const designData = loadRosterDesignData(rosterId); 
  if (!designData) { console.error('❌ No design data found'); return false; }
  
  // HAAL ECHTE EMPLOYEE DATA OP
  const realEmployees = getAllEmployees();
  const employeeMap = new Map(realEmployees.map(emp => [emp.id, emp]));
  
  const start = new Date(start_date + 'T00:00:00');
  let totalFilledCells = 0;
  
  for (const emp of designData.employees) {
    // GEBRUIK ECHTE roostervrijDagen uit employee storage
    const realEmployee = employeeMap.get(emp.id);
    const roostervrij: string[] = realEmployee?.roostervrijDagen || [];
    console.log(`👤 ${emp.name}: roostervrijDagen =`, roostervrij);
    
    if (!designData.unavailabilityData[emp.id]) { 
      designData.unavailabilityData[emp.id] = {}; 
    }
    
    let empFilledCells = 0;
    for (let i = 0; i < 35; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const dayCode = ['zo','ma','di','wo','do','vr','za'][d.getDay()];
      const iso = d.toISOString().split('T')[0];
      
      if (roostervrij.includes(dayCode)) {
        designData.unavailabilityData[emp.id][iso] = true; // NB
        empFilledCells++;
      } else if (designData.unavailabilityData[emp.id][iso] === undefined) {
        designData.unavailabilityData[emp.id][iso] = false; // beschikbaar
      }
    }
    
    console.log(`   -> Filled ${empFilledCells} NB cells`);
    totalFilledCells += empFilledCells;
  }
  
  console.log('✅ Autofill completed:', totalFilledCells, 'total NB cells filled');
  return saveRosterDesignData(designData);
}

/** Sync functie: Update roster design data met nieuwste employee gegevens */
export function syncRosterDesignWithEmployeeData(rosterId: string): boolean {
  console.log('🔄 Syncing roster design with current employee data...');
  
  const designData = loadRosterDesignData(rosterId);
  if (!designData) return false;
  
  const currentEmployees = getAllEmployees();
  const employeeMap = new Map(currentEmployees.map(emp => [emp.id, emp]));
  
  // Update bestaande employees met nieuwste team/dienstverband data
  let updated = false;
  for (const rosterEmp of designData.employees) {
    const currentEmp = employeeMap.get(rosterEmp.id);
    if (currentEmp) {
      const oldTeam = (rosterEmp as any).team;
      const newTeam = currentEmp.team;
      
      if (oldTeam !== newTeam) {
        console.log(`🔄 Updating ${currentEmp.voornaam}: ${oldTeam} -> ${newTeam}`);
        (rosterEmp as any).team = newTeam;
        updated = true;
      }
      
      // Update andere velden
      (rosterEmp as any).dienstverband = currentEmp.dienstverband;
      (rosterEmp as any).voornaam = currentEmp.voornaam;
      (rosterEmp as any).roostervrijDagen = currentEmp.roostervrijDagen;
    }
  }
  
  if (updated) {
    console.log('✅ Roster design data updated with current employee data');
    return saveRosterDesignData(designData);
  }
  
  return true;
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