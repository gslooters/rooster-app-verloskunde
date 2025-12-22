/**
 * Employee Type Definitions and Helpers
 * Aligned with Supabase employees table schema
 */

/**
 * Represents a single day block (dagdeel) in a week
 */
export type DagblokType = 'ochtend' | 'middag' | 'nacht';

/**
 * Represents employment type
 */
export enum DienstverbandType {
  LOONDIENST = 'Loondienst',
  FREELANCE = 'Freelance',
  BEROEPSBEVOLKING = 'Beroepsbevolking',
}

/**
 * Represents team assignment
 */
export enum TeamType {
  GROEN = 'Groen',
  ORANJE = 'Oranje',
  OVERIG = 'Overig',
}

/**
 * AP41: Structureel Niet Beschikbaar (NBH)
 * Maps day code (ma, di, wo, etc.) to array of unavailable dagblokken
 * Example: { 'ma': ['ochtend', 'middag'], 'wo': ['nacht'] }
 */
export type StructureelNBH = Record<string, DagblokType[]>;

/**
 * Main Employee interface
 * Mirrors Supabase employees table structure
 */
export interface Employee {
  id: string;                                           // text (primary key)
  voornaam: string;                                    // text
  achternaam: string;                                  // text
  email?: string | null;                              // text (optional)
  telefoon?: string | null;                           // text (optional)
  actief: boolean;                                    // boolean
  dienstverband: DienstverbandType | string;          // text (enum)
  team: TeamType | string;                           // text (enum)
  aantalwerkdagen: number;                           // integer (0-35)
  roostervrijdagen: string[];                        // ARRAY of day codes (legacy: "ma", "di", etc.)
  created_at?: string;                               // timestamp
  updated_at?: string;                               // timestamp
  structureel_nbh?: StructureelNBH | null;          // jsonb (AP41: new field)
}

/**
 * Helper: Get full name from employee
 */
export function getFullName(employee: Employee): string {
  return `${employee.voornaam} ${employee.achternaam}`;
}

/**
 * Helper: Get display name for rooster (voornaam + first letter of achternaam)
 */
export function getRosterDisplayName(employee: Employee): string {
  const first = employee.voornaam.substring(0, 1).toUpperCase();
  const last = employee.achternaam.substring(0, 1).toUpperCase();
  return `${first}${last}`;
}

/**
 * Helper: Convert structureel_nbh to human-readable description
 */
export function getStructureelNBHDescription(nbh?: StructureelNBH | null): string {
  if (!nbh || Object.keys(nbh).length === 0) {
    return 'Geen beperkingen';
  }

  const items = Object.entries(nbh)
    .map(([dag, blokken]) => `${dag.toUpperCase()}: ${blokken.join(', ')}`)
    .join(' | ');

  return items;
}

/**
 * Helper: Convert legacy roostervrijdagen (whole day off) to structureel_nbh
 * (all dagblokken unavailable for that day)
 */
export function convertRoostervrijdagenToNBH(roostervrijdagen: string[]): StructureelNBH | undefined {
  if (!roostervrijdagen || roostervrijdagen.length === 0) {
    return undefined;
  }

  const nbh: StructureelNBH = {};
  const allDagblokken: DagblokType[] = ['ochtend', 'middag', 'nacht'];

  for (const dag of roostervrijdagen) {
    const dagLower = dag.toLowerCase();
    nbh[dagLower] = [...allDagblokken];
  }

  return Object.keys(nbh).length > 0 ? nbh : undefined;
}

/**
 * Constants for UI dropdowns
 */
export const DIENSTVERBAND_OPTIONS = [
  { value: DienstverbandType.LOONDIENST, label: 'Loondienst' },
  { value: DienstverbandType.FREELANCE, label: 'Freelance' },
  { value: DienstverbandType.BEROEPSBEVOLKING, label: 'Beroepsbevolking' },
];

export const TEAM_OPTIONS = [
  { value: TeamType.GROEN, label: 'Groen' },
  { value: TeamType.ORANJE, label: 'Oranje' },
  { value: TeamType.OVERIG, label: 'Overig' },
];

export const DAGEN_VAN_WEEK = [
  { code: 'ma', label: 'Maandag', volledig: 'Monday' },
  { code: 'di', label: 'Dinsdag', volledig: 'Tuesday' },
  { code: 'wo', label: 'Woensdag', volledig: 'Wednesday' },
  { code: 'do', label: 'Donderdag', volledig: 'Thursday' },
  { code: 'vr', label: 'Vrijdag', volledig: 'Friday' },
  { code: 'za', label: 'Zaterdag', volledig: 'Saturday' },
  { code: 'zo', label: 'Zondag', volledig: 'Sunday' },
];

export const DAGBLOKKEN = [
  { code: 'ochtend', label: 'Ochtend', tijden: '08:00-13:00' },
  { code: 'middag', label: 'Middag', tijden: '13:00-18:00' },
  { code: 'nacht', label: 'Nacht', tijden: '18:00-08:00' },
];

/**
 * Validation helpers
 */
export function validateAantalWerkdagen(value: number): boolean {
  return !isNaN(value) && value >= 0 && value <= 35;
}

export function validateRoostervrijDagen(dagen: string[]): boolean {
  const valideCodes = DAGEN_VAN_WEEK.map((d) => d.code);
  return Array.isArray(dagen) && dagen.every((d) => valideCodes.includes(d));
}

export function normalizeRoostervrijDagen(dagen: string[]): string[] {
  return dagen
    .map((d) => d.toLowerCase())
    .filter((d) => DAGEN_VAN_WEEK.map((x) => x.code).includes(d))
    .sort();
}

/**
 * Merge input form data into Employee object
 */
export function createEmployeeFromFormData(input: {
  voornaam: string;
  achternaam: string;
  email?: string;
  telefoon?: string;
  actief: boolean;
  dienstverband: string;
  team: string;
  aantalWerkdagen: number;
  roostervrijDagen?: string[];
  structureel_nbh?: StructureelNBH | null;
}): Omit<Employee, 'id' | 'created_at' | 'updated_at'> {
  return {
    voornaam: input.voornaam,
    achternaam: input.achternaam,
    email: input.email || null,
    telefoon: input.telefoon || null,
    actief: input.actief,
    dienstverband: input.dienstverband,
    team: input.team,
    aantalwerkdagen: input.aantalWerkdagen,
    roostervrijdagen: input.roostervrijDagen || [],
    structureel_nbh: input.structureel_nbh,
  };
}
