// lib/types/roster.ts
// Sprint 1.2: Uitgebreide data modellen voor rooster ontwerp functionaliteit
// DRAAD68: Dagdeel-ondersteuning (O/M/A) toegevoegd
// DRAAD74: Team/voornaam/achternaam/dienstverband toegevoegd aan RosterEmployee

// DRAAD68: Dagdeel beschikbaarheid structuur
export type DagdeelAvailability = {
  O?: boolean; // Ochtend (09:00-13:00) - true = Niet Beschikbaar
  M?: boolean; // Middag (13:00-18:00) - true = Niet Beschikbaar
  A?: boolean; // Avond/Nacht (18:00-09:00) - true = Niet Beschikbaar
};

export interface RosterEmployee {
  id: string;
  name: string;
  voornaam: string; // DRAAD74: Toegevoegd voor UI display
  achternaam: string; // DRAAD74: Toegevoegd voor completeness
  team: string; // DRAAD74: Toegevoegd voor team kleuren
  dienstverband: string; // DRAAD74: Toegevoegd voor sortering
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
  // DRAAD68: unavailabilityData now supports dagdeel granularity
  unavailabilityData: {
    [employeeId: string]: {
      [date: string]: DagdeelAvailability | boolean; // boolean voor backward compat
    }
  };
  assignments?: any[]; // DRAAD27C: Loaded assignments from rooster_assignments table
  shiftCounts?: { [employeeId: string]: { [shiftType: string]: number } }; // Nieuw veld toegevoegd
  dailyServiceRequirements?: DailyServiceRequirement[];
  planningRules?: PlanningRule[];
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
}

// Voor toekomstige uitbreiding - diensten per dag
export interface DailyServiceRequirement {
  date: string; // YYYY-MM-DD format
  dayType: string;
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

// DRAAD68: Helper functions voor dagdeel checks

/**
 * Check of hele dag NB is (alle dagdelen O, M, A zijn true)
 */
export function isFullDayUnavailable(dagdeelData: DagdeelAvailability | boolean): boolean {
  if (typeof dagdeelData === 'boolean') return dagdeelData;
  return dagdeelData.O === true && dagdeelData.M === true && dagdeelData.A === true;
}

/**
 * Check of specifiek dagdeel NB is
 */
export function isDagdeelUnavailable(
  dagdeelData: DagdeelAvailability | boolean | undefined,
  dagdeel: 'O' | 'M' | 'A'
): boolean {
  if (!dagdeelData) return false;
  if (typeof dagdeelData === 'boolean') return dagdeelData; // Legacy: hele dag
  return dagdeelData[dagdeel] === true;
}

/**
 * Converteer boolean naar DagdeelAvailability (voor legacy data)
 */
export function convertLegacyUnavailability(isUnavailable: boolean): DagdeelAvailability {
  if (!isUnavailable) return {};
  return { O: true, M: true, A: true };
}

/**
 * Converteer structureel_nbh naar unavailability format
 * structureelNBH bevat array van dagdelen waar medewerker NB is
 * Bijvoorbeeld: ["O", "M"] betekent NB in ochtend en middag
 */
export function convertStructureelNBHToUnavailability(
  structureelNBH: { [dagCode: string]: string[] }
): DagdeelAvailability {
  const result: DagdeelAvailability = {};
  // structureelNBH bevat per dagcode (ma, di, wo, etc.) een array van dagdelen
  const dagdelen = Object.values(structureelNBH).flat();
  if (dagdelen.includes('O')) result.O = true;
  if (dagdelen.includes('M')) result.M = true;
  if (dagdelen.includes('A')) result.A = true;
  return result;
}

export function validateMaxShifts(shifts: number): boolean {
  return shifts >= 0 && shifts <= 35 && Number.isInteger(shifts);
}

export function createDefaultRosterEmployee(originalEmployee: any): RosterEmployee {
  return {
    id: `re_${originalEmployee.id}`,
    name: originalEmployee.name || `${originalEmployee.voornaam} ${originalEmployee.achternaam}`,
    voornaam: originalEmployee.voornaam || '', // DRAAD74
    achternaam: originalEmployee.achternaam || '', // DRAAD74
    team: originalEmployee.team || 'Overig', // DRAAD74
    dienstverband: originalEmployee.dienstverband || 'Loondienst', // DRAAD74
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