// lib/types/employee.ts

// Nieuwe enums voor dropdown velden
export enum DienstverbandType {
  MAAT = 'Maat',
  LOONDIENST = 'Loondienst', 
  ZZP = 'ZZP'
}

export enum TeamType {
  GROEN = 'Groen',
  ORANJE = 'Oranje',
  OVERIG = 'Overig'
}

// Uitgebreide Employee interface
export interface Employee {
  id: string;
  voornaam: string;    // verplicht - voor rooster
  achternaam: string;  // verplicht - voor export
  email?: string;      // optioneel
  telefoon?: string;   // optioneel
  actief: boolean;     // verplicht
  
  // NIEUWE VELDEN voor roosterplanning:
  dienstverband: DienstverbandType;  // verplicht
  team: TeamType;                    // verplicht  
  aantalWerkdagen: number;           // verplicht, 0-35
  roostervrijDagen: string[];        // array van 'ma','di','wo','do','vr','za','zo'
  
  created_at: string;
  updated_at: string;
}

// Legacy interface voor backward compatibility tijdens migratie
export interface LegacyEmployee {
  id: string;
  voornaam: string;
  achternaam: string;
  email?: string;
  telefoon?: string;
  actief: boolean;
  created_at: string;
  updated_at: string;
}

// Helper functie voor volledige naam
export function getFullName(employee: Employee | LegacyEmployee): string {
  return `${employee.voornaam} ${employee.achternaam}`.trim();
}

// Helper functie voor rooster weergave (alleen voornaam)
export function getRosterDisplayName(employee: Employee | LegacyEmployee): string {
  return employee.voornaam;
}

// VALIDATIE FUNCTIES

// Valideer aantal werkdagen (0-35)
export function validateAantalWerkdagen(dagen: number): boolean {
  return Number.isInteger(dagen) && dagen >= 0 && dagen <= 35;
}

// Valideer roostervrije dagen array
export function validateRoostervrijDagen(dagen: string[]): boolean {
  const valideDagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  
  // Check duplicaten
  const uniekeDagen = [...new Set(dagen)];
  if (uniekeDagen.length !== dagen.length) return false;
  
  // Check geldige dagcodes
  return dagen.every(dag => valideDagen.includes(dag.toLowerCase()));
}

// Valideer dienstverband
export function isValidDienstverband(type: string): type is DienstverbandType {
  return Object.values(DienstverbandType).includes(type as DienstverbandType);
}

// Valideer team
export function isValidTeam(team: string): team is TeamType {
  return Object.values(TeamType).includes(team as TeamType);
}

// Helper: normaliseer roostervrije dagen input
export function normalizeRoostervrijDagen(dagen: string[]): string[] {
  return [...new Set(dagen.map(dag => dag.toLowerCase()))];
}

// Helper: upgrade legacy employee naar nieuwe interface
export function upgradeLegacyEmployee(legacy: LegacyEmployee): Employee {
  return {
    ...legacy,
    dienstverband: DienstverbandType.LOONDIENST, // Default
    team: TeamType.OVERIG,                       // Default
    aantalWerkdagen: 24,                         // Default
    roostervrijDagen: []                         // Default: geen vrije dagen
  };
}

// Helper: check of employee nieuwe velden heeft
export function hasNewFields(employee: any): employee is Employee {
  return 'dienstverband' in employee && 
         'team' in employee && 
         'aantalWerkdagen' in employee && 
         'roostervrijDagen' in employee;
}

// Constanten voor UI
export const DAGEN_VAN_WEEK = [
  { code: 'ma', naam: 'Maandag' },
  { code: 'di', naam: 'Dinsdag' },
  { code: 'wo', naam: 'Woensdag' },
  { code: 'do', naam: 'Donderdag' },
  { code: 'vr', naam: 'Vrijdag' },
  { code: 'za', naam: 'Zaterdag' },
  { code: 'zo', naam: 'Zondag' }
] as const;

export const DIENSTVERBAND_OPTIONS = [
  { value: DienstverbandType.MAAT, label: 'Maat' },
  { value: DienstverbandType.LOONDIENST, label: 'Loondienst' },
  { value: DienstverbandType.ZZP, label: 'ZZP' }
] as const;

export const TEAM_OPTIONS = [
  { value: TeamType.GROEN, label: 'Groen' },
  { value: TeamType.ORANJE, label: 'Oranje' },
  { value: TeamType.OVERIG, label: 'Overig' }
] as const;