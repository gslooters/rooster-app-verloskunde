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

// Dagblokken voor structurele NBH
export enum DagblokType {
  OCHTEND = 'O',
  MIDDAG = 'M',
  AVOND_NACHT = 'A'
}

// Structurele NBH type: { "ma": ["O", "M"], "wo": ["A"], ... }
export type StructureelNBH = {
  [dagCode: string]: DagblokType[];
};

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
  roostervrijDagen: string[];        // array van 'ma','di','wo','do','vr','za','zo' (LEGACY)
  structureel_nbh?: StructureelNBH;  // NIEUW AP41: per dag per dagblok NBH
  
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

// Valideer structureel NBH
export function validateStructureelNBH(nbh: StructureelNBH | undefined): boolean {
  if (!nbh) return true; // undefined is geldig (geen structurele NBH)
  
  const valideDagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const valideDagblokken = [DagblokType.OCHTEND, DagblokType.MIDDAG, DagblokType.AVOND_NACHT];
  
  for (const dag in nbh) {
    // Check geldige dagcode
    if (!valideDagen.includes(dag)) return false;
    
    // Check array van dagblokken
    const dagblokken = nbh[dag];
    if (!Array.isArray(dagblokken)) return false;
    
    // Check geldige dagblokken
    if (!dagblokken.every(blok => valideDagblokken.includes(blok))) return false;
    
    // Check duplicaten in dagblokken
    const uniqueBlokken = [...new Set(dagblokken)];
    if (uniqueBlokken.length !== dagblokken.length) return false;
  }
  
  return true;
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

// Helper: normaliseer structureel NBH
export function normalizeStructureelNBH(nbh: StructureelNBH | undefined): StructureelNBH | undefined {
  if (!nbh) return undefined;
  
  const normalized: StructureelNBH = {};
  
  for (const dag in nbh) {
    const dagLower = dag.toLowerCase();
    const blokken = nbh[dag];
    
    // Verwijder duplicaten en sorteer
    const uniqueBlokken = [...new Set(blokken)].sort();
    
    // Alleen toevoegen als er daadwerkelijk blokken zijn
    if (uniqueBlokken.length > 0) {
      normalized[dagLower] = uniqueBlokken;
    }
  }
  
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

// Helper: converteer roostervrijdagen naar structureel NBH
export function convertRoostervrijdagenToNBH(roostervrijdagen: string[]): StructureelNBH {
  const nbh: StructureelNBH = {};
  
  roostervrijdagen.forEach(dag => {
    // Hele dag vrij = alle dagblokken
    nbh[dag.toLowerCase()] = [DagblokType.OCHTEND, DagblokType.MIDDAG, DagblokType.AVOND_NACHT];
  });
  
  return nbh;
}

// Helper: genereer leesbare beschrijving van structureel NBH
export function getStructureelNBHDescription(nbh: StructureelNBH | undefined): string {
  if (!nbh || Object.keys(nbh).length === 0) {
    return 'Geen structurele NBH';
  }
  
  const DAGBLOK_LABELS = {
    [DagblokType.OCHTEND]: 'O',
    [DagblokType.MIDDAG]: 'M',
    [DagblokType.AVOND_NACHT]: 'A'
  };
  
  const beschrijvingen: string[] = [];
  
  for (const dag in nbh) {
    const blokken = nbh[dag];
    const blokkenStr = blokken.map(b => DAGBLOK_LABELS[b]).join(',');
    beschrijvingen.push(`${dag.toUpperCase()}: ${blokkenStr}`);
  }
  
  return beschrijvingen.join(' • ');
}

// Helper: check of dag/dagblok beschikbaar is
export function isDagblokBeschikbaar(
  employee: Employee,
  dagCode: string,
  dagblok: DagblokType
): boolean {
  const nbh = employee.structureel_nbh;
  
  if (!nbh) return true; // Geen structurele NBH = altijd beschikbaar
  
  const dagLower = dagCode.toLowerCase();
  const dagblokken = nbh[dagLower];
  
  if (!dagblokken || dagblokken.length === 0) return true; // Geen NBH voor deze dag
  
  return !dagblokken.includes(dagblok); // Beschikbaar als dagblok NIET in NBH lijst staat
}

// Helper: upgrade legacy employee naar nieuwe interface
export function upgradeLegacyEmployee(legacy: LegacyEmployee): Employee {
  return {
    ...legacy,
    dienstverband: DienstverbandType.LOONDIENST, // Default
    team: TeamType.OVERIG,                       // Default
    aantalWerkdagen: 24,                         // Default
    roostervrijDagen: [],                         // Default: geen vrije dagen
    structureel_nbh: undefined                    // Default: geen structurele NBH
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

export const DAGBLOKKEN = [
  { code: DagblokType.OCHTEND, naam: 'Ochtend', label: 'O', tijden: '09:00-13:00' },
  { code: DagblokType.MIDDAG, naam: 'Middag', label: 'M', tijden: '13:00-18:00' },
  { code: DagblokType.AVOND_NACHT, naam: 'Avond/Nacht', label: 'A', tijden: '18:00-09:00' }
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
