// lib/types/roster.ts
// Sprint 1.2: Uitgebreide data modellen voor rooster ontwerp functionaliteit

export interface RosterEmployee {
  id: string;
  name: string;
  maxShifts: number; // 0-35 range voor aantal diensten in rooster periode
  availableServices: string[]; // Services die deze medewerker kan doen
  isSnapshotActive: boolean; // Was actief op moment van rooster creatie
  originalEmployeeId: string; // Koppeling naar echte employee record
  snapshotDate: string; // Wanneer snapshot gemaakt
}

export interface RosterStatus {
  phase: 'ontwerp' | 'bewerking' | 'afgesloten';
  servicesStatus: 'inbewerking' | 'vastgesteld'; // Voor diensten per dag planning
  designComplete: boolean; // Alle ontwerp stappen voltooid
  lastModified: string;
  modifiedBy?: string;
}

export interface RosterDesignData {
  rosterId: string;
  employees: RosterEmployee[];
  status: RosterStatus;
  unavailabilityData: { [employeeId: string]: { [date: string]: boolean } }; // NB markering
  dailyServiceRequirements?: DailyServiceRequirement[]; // Wordt later toegevoegd
  planningRules?: PlanningRule[]; // Wordt later toegevoegd
  created_at: string;
  updated_at: string;
}

// Voor toekomstige uitbreiding - diensten per dag
export interface DailyServiceRequirement {
  date: string; // YYYY-MM-DD format
  dayType: string; // maandag, dinsdag, etc. of feestdag
  services: {
    [serviceCode: string]: {
      min: number;
      max: number;
    }
  };
  status: 'inbewerking' | 'vastgesteld';
}

// Voor toekomstige uitbreiding - planregels
export interface PlanningRule {
  id: string;
  name: string;
  type: 'constraint' | 'preference' | 'requirement';
  description: string;
  active: boolean;
  parameters: { [key: string]: any };
}

// Validatie functies
export function validateMaxShifts(shifts: number): boolean {
  return shifts >= 0 && shifts <= 35 && Number.isInteger(shifts);
}

export function createDefaultRosterEmployee(originalEmployee: any): RosterEmployee {
  return {
    id: `re_${originalEmployee.id}`,
    name: originalEmployee.name || `${originalEmployee.voornaam} ${originalEmployee.achternaam}`,
    maxShifts: 0, // Default waarde, gebruiker moet invullen
    availableServices: [], // Wordt later ingevuld
    isSnapshotActive: originalEmployee.actief || originalEmployee.active,
    originalEmployeeId: originalEmployee.id,
    snapshotDate: new Date().toISOString()
  };
}

export function createDefaultRosterStatus(): RosterStatus {
  return {
    phase: 'ontwerp',
    servicesStatus: 'inbewerking',
    designComplete: false,
    lastModified: new Date().toISOString()
  };
}