// lib/types/roster-period-staffing-dagdeel.ts
// ============================================================================
// DRAAD176: Roster Period Staffing Dagdelen Types (DENORMALISERING)
// Datum: 2025-12-14
// Update: Toegevoegd roster_id, service_id, date, invulling velden
// ============================================================================

/**
 * Dagdeel codes
 * O = Ochtend
 * M = Middag  
 * A = Avond
 */
export type Dagdeel = 'O' | 'M' | 'A';

/**
 * Team codes
 * TOT = Totaal (hele praktijk)
 * GRO = Groen
 * ORA = Oranje
 */
export type TeamDagdeel = 'TOT' | 'GRO' | 'ORA';

/**
 * Status van een dagdeel regel
 * MOET = Verplicht (minimaal aantal personen vereist)
 * MAG = Optioneel (mag ingepland worden)
 * MAG_NIET = Niet toegestaan (0 personen)
 * AANGEPAST = Handmatig aangepast door planner
 */
export type DagdeelStatus = 'MOET' | 'MAG' | 'MAG_NIET' | 'AANGEPAST';

/**
 * DRAAD176: Dagdeel regel voor een specifiek team op een specifieke datum
 * DENORMALISEERD - bevat nu ook roster_id, service_id, date
 * Oude FK naar roster_period_staffing_id VERWIJDERD
 */
export interface RosterPeriodStaffingDagdeel {
  id: string;                    // PK (uuid)
  roster_id: string;             // FK → roosters (NEW - DRAAD176)
  service_id: string;            // FK → service_types (NEW - DRAAD176)
  date: string;                  // YYYY-MM-DD format (NEW - DRAAD176)
  dagdeel: Dagdeel;              // 'O', 'M', 'A'
  team: TeamDagdeel;             // 'TOT', 'GRO', 'ORA'
  status: DagdeelStatus;          // 'MOET', 'MAG', 'MAG_NIET', 'AANGEPAST'
  aantal: number;                // 0-9 (verplicht aantal per dagdeel/team)
  invulling: number;             // 0+ (werkelijke inplanningen) (NEW - DRAAD176)
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}

/**
 * Input voor het aanmaken van een nieuwe dagdeel regel
 * DRAAD176: Inclusief roster_id, service_id, date
 */
export interface CreateDagdeelRegel {
  roster_id: string;             // FK → roosters (REQUIRED - DRAAD176)
  service_id: string;            // FK → service_types (REQUIRED - DRAAD176)
  date: string;                  // YYYY-MM-DD (REQUIRED - DRAAD176)
  dagdeel: Dagdeel;              // REQUIRED
  team: TeamDagdeel;             // REQUIRED
  status: DagdeelStatus;          // REQUIRED
  aantal: number;                // REQUIRED
  invulling?: number;            // OPTIONAL, default 0 (DRAAD176)
}

/**
 * Input voor het updaten van een dagdeel regel
 */
export interface UpdateDagdeelRegel {
  status?: DagdeelStatus;
  aantal?: number;
  invulling?: number;            // NEW - DRAAD176
}

/**
 * Mapping van DagblokCode (uit service.ts) naar Dagdeel
 */
export const DAGBLOK_NAAR_DAGDEEL: Record<'O' | 'M' | 'A', Dagdeel> = {
  O: 'O',
  M: 'M',
  A: 'A'
};

/**
 * Mapping van Dagdeel naar DagblokCode
 */
export const DAGDEEL_NAAR_DAGBLOK: Record<Dagdeel, 'O' | 'M' | 'A'> = {
  'O': 'O',
  'M': 'M',
  'A': 'A'
};

/**
 * Mapping van TeamCode (uit service.ts) naar TeamDagdeel
 */
export const TEAM_NAAR_TEAM_DAGDEEL: Record<'groen' | 'oranje' | 'totaal', TeamDagdeel> = {
  groen: 'GRO',
  oranje: 'ORA',
  totaal: 'TOT'
};

/**
 * Mapping van TeamDagdeel naar TeamCode
 */
export const TEAM_DAGDEEL_NAAR_TEAM: Record<TeamDagdeel, 'groen' | 'oranje' | 'totaal'> = {
  GRO: 'groen',
  ORA: 'oranje',
  TOT: 'totaal'
};

/**
 * Mapping van DagblokStatus naar DagdeelStatus
 */
export const DAGBLOK_STATUS_NAAR_DAGDEEL_STATUS: Record<string, DagdeelStatus> = {
  'MOET': 'MOET',
  'MAG': 'MAG',
  'MAG_NIET': 'MAG_NIET'
};

/**
 * Labels voor UI
 */
export const DAGDEEL_LABELS: Record<Dagdeel, string> = {
  'O': 'Ochtend',
  'M': 'Middag',
  'A': 'Avond'
};

export const TEAM_DAGDEEL_LABELS: Record<TeamDagdeel, string> = {
  TOT: 'Praktijk Totaal',
  GRO: 'Groen',
  ORA: 'Oranje'
};

export const DAGDEEL_STATUS_LABELS: Record<DagdeelStatus, string> = {
  MOET: 'Verplicht',
  MAG: 'Optioneel',
  MAG_NIET: 'Niet toegestaan',
  AANGEPAST: 'Aangepast'
};

/**
 * Kleuren voor status (hex)
 */
export const DAGDEEL_STATUS_COLORS: Record<DagdeelStatus, string> = {
  MOET: '#EF4444',      // Rood
  MAG: '#10B981',       // Groen
  MAG_NIET: '#9CA3AF',  // Grijs
  AANGEPAST: '#3B82F6'  // Blauw
};

/**
 * Tailwind classes voor status
 */
export const DAGDEEL_STATUS_BG_COLORS: Record<DagdeelStatus, string> = {
  MOET: 'bg-red-500',
  MAG: 'bg-green-500',
  MAG_NIET: 'bg-gray-400',
  AANGEPAST: 'bg-blue-500'
};

/**
 * Standaard waarden per status
 */
export const DEFAULT_AANTAL_PER_STATUS: Record<Exclude<DagdeelStatus, 'AANGEPAST'>, number> = {
  MOET: 1,
  MAG: 1,
  MAG_NIET: 0
};

/**
 * Validatie functies
 */
export function isValidDagdeel(value: unknown): value is Dagdeel {
  return value === 'O' || value === 'M' || value === 'A';
}

export function isValidTeamDagdeel(value: unknown): value is TeamDagdeel {
  return value === 'TOT' || value === 'GRO' || value === 'ORA';
}

export function isValidDagdeelStatus(value: unknown): value is DagdeelStatus {
  return value === 'MOET' || value === 'MAG' || value === 'MAG_NIET' || value === 'AANGEPAST';
}

export function isValidAantal(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * DRAAD176: Valideer UUID formaat
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * DRAAD176: Valideer YYYY-MM-DD date format
 */
export function isValidISODate(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  const date = new Date(value);
  return date instanceof Date && !isNaN(date.getTime());
}
