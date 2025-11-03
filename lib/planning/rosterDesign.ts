// lib/planning/rosterDesign.ts
// Sprint 1.2: Service voor roster ontwerp functionaliteit

import { RosterEmployee, RosterStatus, RosterDesignData, validateMaxShifts, createDefaultRosterEmployee, createDefaultRosterStatus } from '@/lib/types/roster';
import { getActiveEmployees } from './employees';

// LocalStorage keys
const ROSTER_DESIGN_KEY = 'roster_design_data';

/**
 * Creëer employee snapshot bij rooster creatie
 * Sprint 1.2: Snapshot functionaliteit
 */
export function createEmployeeSnapshot(rosterId: string): RosterEmployee[] {
  const activeEmployees = getActiveEmployees();
  
  return activeEmployees.map(emp => {
    // Gebruik createDefaultRosterEmployee helper
    const rosterEmployee = createDefaultRosterEmployee(emp);
    
    // Voor nu lege services - wordt later uitgebreid
    rosterEmployee.availableServices = [];
    
    return rosterEmployee;
  });
}

/**
 * Laad roster ontwerp data
 */
export function loadRosterDesignData(rosterId: string): RosterDesignData | null {
  try {
    const stored = localStorage.getItem(`${ROSTER_DESIGN_KEY}_${rosterId}`);
    if (!stored) return null;
    
    return JSON.parse(stored) as RosterDesignData;
  } catch (error) {
    console.error('Fout bij laden roster ontwerp data:', error);
    return null;
  }
}

/**
 * Sla roster ontwerp data op
 */
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

/**
 * Initialiseer nieuw roster ontwerp
 */
export function initializeRosterDesign(rosterId: string): RosterDesignData {
  const employees = createEmployeeSnapshot(rosterId);
  const status = createDefaultRosterStatus();
  
  const designData: RosterDesignData = {
    rosterId,
    employees,
    status,
    unavailabilityData: {}, // Wordt later gevuld door gebruiker
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  saveRosterDesignData(designData);
  return designData;
}

/**
 * Update max shifts voor een medewerker
 * Sprint 1.2: Validatie 0-35
 */
export function updateEmployeeMaxShifts(rosterId: string, employeeId: string, maxShifts: number): boolean {
  if (!validateMaxShifts(maxShifts)) {
    console.error(`Ongeldig aantal diensten: ${maxShifts}. Moet tussen 0 en 35 zijn.`);
    return false;
  }
  
  const designData = loadRosterDesignData(rosterId);
  if (!designData) {
    console.error('Roster ontwerp data niet gevonden');
    return false;
  }
  
  const employee = designData.employees.find(emp => emp.id === employeeId);
  if (!employee) {
    console.error('Medewerker niet gevonden in roster');
    return false;
  }
  
  employee.maxShifts = maxShifts;
  return saveRosterDesignData(designData);
}

/**
 * Toggle niet-beschikbaarheid voor medewerker op specifieke datum
 * Sprint 1.2: NB functionaliteit
 */
export function toggleUnavailability(rosterId: string, employeeId: string, date: string): boolean {
  const designData = loadRosterDesignData(rosterId);
  if (!designData) return false;
  
  if (!designData.unavailabilityData[employeeId]) {
    designData.unavailabilityData[employeeId] = {};
  }
  
  // Toggle de status
  const current = designData.unavailabilityData[employeeId][date] || false;
  designData.unavailabilityData[employeeId][date] = !current;
  
  return saveRosterDesignData(designData);
}

/**
 * Check of medewerker niet beschikbaar is op datum
 */
export function isEmployeeUnavailable(rosterId: string, employeeId: string, date: string): boolean {
  const designData = loadRosterDesignData(rosterId);
  if (!designData) return false;
  
  return designData.unavailabilityData[employeeId]?.[date] || false;
}

/**
 * Update roster ontwerp status
 */
export function updateRosterDesignStatus(rosterId: string, updates: Partial<RosterStatus>): boolean {
  const designData = loadRosterDesignData(rosterId);
  if (!designData) return false;
  
  designData.status = { ...designData.status, ...updates };
  return saveRosterDesignData(designData);
}

/**
 * Valideer of ontwerp compleet is voor verdere stappen
 */
export function validateDesignComplete(rosterId: string): { isValid: boolean; errors: string[] } {
  const designData = loadRosterDesignData(rosterId);
  if (!designData) {
    return { isValid: false, errors: ['Roster ontwerp data niet gevonden'] };
  }
  
  const errors: string[] = [];
  
  // Check of alle medewerkers maxShifts hebben ingevuld
  const employeesWithoutShifts = designData.employees.filter(emp => emp.maxShifts === 0);
  if (employeesWithoutShifts.length > 0) {
    errors.push(`Volgende medewerkers hebben geen aantal diensten ingevuld: ${employeesWithoutShifts.map(e => e.name).join(', ')}`);
  }
  
  // Check of diensten status vastgesteld is (voor toekomstige AI functionaliteit)
  if (designData.status.servicesStatus !== 'vastgesteld') {
    errors.push('Diensten per dag moeten worden vastgesteld voordat AI kan worden gebruikt');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Export functie voor debugging/development
 */
export function exportRosterDesignData(rosterId: string): string | null {
  const designData = loadRosterDesignData(rosterId);
  if (!designData) return null;
  
  return JSON.stringify(designData, null, 2);
}