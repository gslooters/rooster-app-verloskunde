// lib/types/service.ts
// ============================================================================
// SERVICE TYPES - Dagblok Regels voor Teams
// ============================================================================
// AP42 - Database Herstructurering met UUID en JSONB team regels
// Complete type definitions voor dagblok planning per team
// ============================================================================

/**
 * Status van een dagblok voor een specifiek team
 * MOET = Verplicht aanwezig (minimaal 1 persoon)
 * MAG = Mag ingepland worden (optioneel)
 * MAG_NIET = Niet toegestaan
 */
export enum DagblokStatus {
  MOET = 'MOET',
  MAG = 'MAG',
  MAG_NIET = 'MAG_NIET'
}

/**
 * Dagblok codes
 * O = Ochtend (09:00-13:00)
 * M = Middag (13:00-18:00)
 * A = Avond/Nacht (18:00-09:00)
 */
export type DagblokCode = 'O' | 'M' | 'A';

/**
 * Regels voor de 3 dagblokken (Ochtend, Middag, Avond)
 * Gebruikt voor één dag binnen een team
 */
export interface DagblokRegels {
  O: DagblokStatus;  // Ochtend
  M: DagblokStatus;  // Middag
  A: DagblokStatus;  // Avond
}

/**
 * Dag codes (voor type-safety)
 */
export type DagCode = 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';

/**
 * Team regels voor alle 7 dagen van de week
 * Bevat per dag de status van 3 dagblokken (O/M/A)
 */
export type TeamRegels = Record<DagCode, DagblokRegels>;

/**
 * Team identificaties
 */
export type TeamCode = 'groen' | 'oranje' | 'totaal';

/**
 * ServiceType interface - Volledige definitie voor diensten
 * Komt overeen met service_types tabel in Supabase
 */
export interface ServiceType {
  // Basis identificatie (UUID)
  id: string;
  
  // Code en naam (beide UNIQUE)
  code: string;                       // 2-3 chars, UPPERCASE
  naam: string;
  beschrijving?: string;
  
  // Tijd en duur
  begintijd: string;                  // "HH:MM"
  eindtijd: string;                   // "HH:MM"
  duur: number;                       // Berekend in uren
  
  // Waarde en visualisatie
  dienstwaarde: number;               // 1.0 = normaal, 2.0 = dubbel
  kleur?: string;                     // Hex color
  
  // Planning eigenschappen
  blokkeert_volgdag: boolean;         // Voor wachtdiensten die volgende dag blokkeren
  actief: boolean;                    // Of dienst gebruikt kan worden
  planregels?: string;                // Vrije tekst planning regels
  
  // Team dagblok regels (JSONB in database)
  team_groen_regels?: TeamRegels | null;
  team_oranje_regels?: TeamRegels | null;
  team_totaal_regels?: TeamRegels | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CONSTANTS VOOR UI
// ============================================================================

/**
 * Lijst van alle dagen (alleen codes)
 */
export const ALLE_DAGEN: DagCode[] = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/**
 * Lijst van alle dagblokken (alleen codes)
 */
export const ALLE_DAGBLOKKEN: DagblokCode[] = ['O', 'M', 'A'];

/**
 * Lijst van alle dagen met volledige namen
 */
export const DAGEN_VAN_WEEK: Array<{ code: DagCode; label: string; kort: string }> = [
  { code: 'ma', label: 'Maandag', kort: 'Ma' },
  { code: 'di', label: 'Dinsdag', kort: 'Di' },
  { code: 'wo', label: 'Woensdag', kort: 'Wo' },
  { code: 'do', label: 'Donderdag', kort: 'Do' },
  { code: 'vr', label: 'Vrijdag', kort: 'Vr' },
  { code: 'za', label: 'Zaterdag', kort: 'Za' },
  { code: 'zo', label: 'Zondag', kort: 'Zo' }
];

/**
 * Korte dag labels (voor in tabellen)
 */
export const DAG_KORT: Record<DagCode, string> = {
  ma: 'Ma',
  di: 'Di',
  wo: 'Wo',
  do: 'Do',
  vr: 'Vr',
  za: 'Za',
  zo: 'Zo'
};

/**
 * Lijst van alle dagblokken met tijden
 */
export const DAGBLOKKEN: Array<{ code: DagblokCode; label: string; tijden: string }> = [
  { code: 'O', label: 'Ochtend', tijden: '09:00-13:00' },
  { code: 'M', label: 'Middag', tijden: '13:00-18:00' },
  { code: 'A', label: 'Avond', tijden: '18:00-09:00' }
];

/**
 * Dagblok namen (voor in tabellen)
 */
export const DAGBLOK_NAMEN: Record<DagblokCode, string> = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond'
};

/**
 * Labels voor dagblok status
 */
export const DAGBLOK_STATUS_LABELS: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: 'Verplicht',
  [DagblokStatus.MAG]: 'Optioneel',
  [DagblokStatus.MAG_NIET]: 'Verboden'
};

/**
 * Tailwind kleuren voor dagblok status
 */
export const DAGBLOK_STATUS_COLORS: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: 'bg-red-100 text-red-700 border-red-200',
  [DagblokStatus.MAG]: 'bg-green-100 text-green-700 border-green-200',
  [DagblokStatus.MAG_NIET]: 'bg-gray-100 text-gray-600 border-gray-200'
};

/**
 * Emoji voor dagblok status (voor compacte weergave)
 */
export const DAGBLOK_STATUS_EMOJI: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: '🔴',
  [DagblokStatus.MAG]: '🟢',
  [DagblokStatus.MAG_NIET]: '⚫'
};

/**
 * Hex kleuren voor dagblok status
 */
export const DAGBLOK_STATUS_HEX: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: '#EF4444',
  [DagblokStatus.MAG]: '#10B981',
  [DagblokStatus.MAG_NIET]: '#6B7280'
};

/**
 * STATUS_KLEUREN - alias voor DAGBLOK_STATUS_HEX (voor backwards compatibility)
 */
export const STATUS_KLEUREN = DAGBLOK_STATUS_HEX;

/**
 * STATUS_EMOJI - alias voor DAGBLOK_STATUS_EMOJI (voor backwards compatibility)
 */
export const STATUS_EMOJI = DAGBLOK_STATUS_EMOJI;

/**
 * DEFAULT_DAGBLOK_REGELS - standaard regels voor één dag
 * Alles MAG, behalve avond MAG_NIET
 */
export const DEFAULT_DAGBLOK_REGELS: DagblokRegels = {
  O: DagblokStatus.MAG,
  M: DagblokStatus.MAG,
  A: DagblokStatus.MAG_NIET
};

/**
 * DEFAULT_TEAM_REGELS - standaard team regels voor alle 7 dagen
 * Ma-Vr: ochtend/middag MAG, avond MAG_NIET
 * Za-Zo: alles MAG_NIET
 */
export const DEFAULT_TEAM_REGELS: TeamRegels = {
  ma: { O: DagblokStatus.MAG, M: DagblokStatus.MAG, A: DagblokStatus.MAG_NIET },
  di: { O: DagblokStatus.MAG, M: DagblokStatus.MAG, A: DagblokStatus.MAG_NIET },
  wo: { O: DagblokStatus.MAG, M: DagblokStatus.MAG, A: DagblokStatus.MAG_NIET },
  do: { O: DagblokStatus.MAG, M: DagblokStatus.MAG, A: DagblokStatus.MAG_NIET },
  vr: { O: DagblokStatus.MAG, M: DagblokStatus.MAG, A: DagblokStatus.MAG_NIET },
  za: { O: DagblokStatus.MAG_NIET, M: DagblokStatus.MAG_NIET, A: DagblokStatus.MAG_NIET },
  zo: { O: DagblokStatus.MAG_NIET, M: DagblokStatus.MAG_NIET, A: DagblokStatus.MAG_NIET }
};

// ============================================================================
// HELPER FUNCTIES
// ============================================================================

/**
 * Type voor team scope bepaling
 */
export type TeamScope = 'totaal' | 'per_team' | 'mixed' | 'geen';

/**
 * Bepaal welk type team regels een dienst heeft
 */
export function getTeamScope(service: ServiceType): TeamScope {
  const hasTotaal = !!service.team_totaal_regels;
  const hasGroen = !!service.team_groen_regels;
  const hasOranje = !!service.team_oranje_regels;
  
  if (hasTotaal && !hasGroen && !hasOranje) return 'totaal';
  if (!hasTotaal && (hasGroen || hasOranje)) return 'per_team';
  if (hasTotaal && (hasGroen || hasOranje)) return 'mixed';
  return 'geen';
}

/**
 * Verkrijg een leesbaar label voor team scope
 */
export function getTeamScopeLabel(service: ServiceType): string {
  const scope = getTeamScope(service);
  switch(scope) {
    case 'totaal': return 'Hele praktijk';
    case 'per_team': return 'Per team';
    case 'mixed': return 'Gemixed';
    case 'geen': return 'Geen regels';
  }
}

/**
 * Maak standaard dagblok regels (alles MAG, behalve avond MAG_NIET)
 */
export function createDefaultDagblokRegels(): DagblokRegels {
  return { ...DEFAULT_DAGBLOK_REGELS };
}

/**
 * Maak standaard team regels voor weekdagen
 * Ma-Vr: ochtend/middag MAG, avond MAG_NIET
 * Za-Zo: alles MAG_NIET
 */
export function createDefaultTeamRegels(): TeamRegels {
  return { ...DEFAULT_TEAM_REGELS };
}

/**
 * Verkrijg de dagblok status voor een specifiek team, dag en blok
 * Met fallback logica: team-specifiek -> totaal -> MAG
 */
export function getDagblokStatus(
  service: ServiceType,
  team: 'groen' | 'oranje',
  dag: DagCode,
  blok: DagblokCode
): DagblokStatus {
  // Check team-specifiek eerst
  const teamRegels = team === 'groen' 
    ? service.team_groen_regels 
    : service.team_oranje_regels;
  
  if (teamRegels?.[dag]?.[blok]) {
    return teamRegels[dag][blok];
  }
  
  // Fallback naar totaal
  if (service.team_totaal_regels?.[dag]?.[blok]) {
    return service.team_totaal_regels[dag][blok];
  }
  
  // Default: MAG
  return DagblokStatus.MAG;
}

/**
 * Valideer of een code voldoet aan de eisen (2-3 chars, UPPERCASE)
 */
export function isValidServiceCode(code: string): boolean {
  return code.length >= 2 && code.length <= 3 && code === code.toUpperCase();
}

/**
 * Bereken duur in uren tussen begin en eindtijd
 * Handelt overloop naar volgende dag af (bijv. 18:00 - 09:00 = 15 uur)
 */
export function berekenDuur(begintijd: string, eindtijd: string): number {
  const [beginUur, beginMin] = begintijd.split(':').map(Number);
  const [eindUur, eindMin] = eindtijd.split(':').map(Number);
  
  let beginMinuten = beginUur * 60 + beginMin;
  let eindMinuten = eindUur * 60 + eindMin;
  
  // Als eindtijd eerder is dan begintijd, ga uit van volgende dag
  if (eindMinuten <= beginMinuten) {
    eindMinuten += 24 * 60;
  }
  
  const verschilMinuten = eindMinuten - beginMinuten;
  return Math.round(verschilMinuten / 60 * 10) / 10; // Afgerond op 1 decimaal
}
