// lib/types/week-dagdelen.ts
// ============================================================================
// DRAAD39.1: Week Dagdelen Scherm - TypeScript Types
// Datum: 2025-11-19
// ============================================================================
// Dit bestand bevat alle type definities voor het "Diensten per week aanpassen" scherm
// dat lazy-loaded data toont voor 1 specifieke week

import { 
  Dagdeel, 
  TeamDagdeel, 
  DagdeelStatus,
  RosterPeriodStaffingDagdeel 
} from './roster-period-staffing-dagdeel';

// ============================================================================
// WEEK CONTEXT
// ============================================================================

/**
 * Week identificatie voor het scherm
 */
export interface WeekContext {
  rosterId: string;
  weekNumber: number;      // ISO weeknummer (1-53)
  year: number;            // Jaar voor weeknummer
  startDate: string;       // ISO date string (maandag)
  endDate: string;         // ISO date string (zondag)
}

// ============================================================================
// DAGDEEL DATA STRUCTUREN
// ============================================================================

/**
 * Dagdeel waarde voor een specifiek team op een specifieke dag
 */
export interface DagdeelWaarde {
  dagdeel: Dagdeel;        // '0' | 'M' | 'A'
  status: DagdeelStatus;   // 'MOET' | 'MAG' | 'MAG_NIET' | 'AANGEPAST'
  aantal: number;          // 0-9
  id: string;             // Database ID voor updates
}

/**
 * Alle dagdelen voor een specifieke dag (ochtend, middag, avond)
 */
export interface DagDagdelen {
  datum: string;           // ISO date string
  dagNaam: string;         // 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'
  dagdeelWaarden: {
    ochtend: DagdeelWaarde;
    middag: DagdeelWaarde;
    avond: DagdeelWaarde;
  };
}

/**
 * Team data voor alle dagen van de week
 */
export interface TeamDagdelenWeek {
  team: TeamDagdeel;       // 'GRO' | 'ORA' | 'TOT'
  dagen: DagDagdelen[];    // 7 dagen (ma-zo)
}

/**
 * Dienst data met alle teams voor de week
 */
export interface DienstDagdelenWeek {
  dienstId: string;
  dienstCode: string;
  dienstNaam: string;
  volgorde: number;        // Voor sortering
  teams: {
    groen: TeamDagdelenWeek;
    oranje: TeamDagdelenWeek;
    totaal: TeamDagdelenWeek;
  };
}

/**
 * Complete week data voor het scherm
 */
export interface WeekDagdelenData {
  context: WeekContext;
  diensten: DienstDagdelenWeek[];  // Gesorteerd op volgorde
  totaalRecords: number;            // Voor logging/debugging
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Edit mode voor een specifieke cel
 */
export interface CelEditState {
  id: string;              // DagdeelWaarde.id
  dienstId: string;
  team: TeamDagdeel;
  datum: string;
  dagdeel: Dagdeel;
  huidigeWaarde: number;
  huidigeStatus: DagdeelStatus;
}

/**
 * Loading states voor verschillende delen van het scherm
 */
export interface WeekDagdelenLoadingState {
  initial: boolean;        // Eerste load
  saving: boolean;         // Saving changes
  refreshing: boolean;     // Refresh data
}

/**
 * Error state voor het scherm
 */
export interface WeekDagdelenError {
  type: 'load' | 'save' | 'validation';
  message: string;
  details?: unknown;
}

/**
 * Complete UI state
 */
export interface WeekDagdelenUIState {
  data: WeekDagdelenData | null;
  loading: WeekDagdelenLoadingState;
  error: WeekDagdelenError | null;
  editingCel: CelEditState | null;
  hasUnsavedChanges: boolean;
}

// ============================================================================
// DATA TRANSFORMATIE TYPES
// ============================================================================

/**
 * Raw data uit Supabase roster_period_staffing_dagdelen tabel
 */
export interface RawDagdeelRecord extends RosterPeriodStaffingDagdeel {
  roster_period_staffing: {
    datum: string;
    service: {
      id: string;
      code: string;
      naam: string;
      volgorde: number;
    };
  };
}

/**
 * Grouped data voor transformatie
 */
export interface GroupedDagdelenData {
  [dienstId: string]: {
    [team: string]: {
      [datum: string]: {
        [dagdeel: string]: RawDagdeelRecord;
      };
    };
  };
}

// ============================================================================
// UPDATE TYPES
// ============================================================================

/**
 * Update voor een enkele dagdeel waarde
 */
export interface DagdeelUpdate {
  id: string;
  aantal?: number;
  status?: DagdeelStatus;
}

/**
 * Batch update voor meerdere dagdelen
 */
export interface DagdelenBatchUpdate {
  updates: DagdeelUpdate[];
  context: WeekContext;
}

/**
 * Response na save
 */
export interface DagdelenSaveResponse {
  success: boolean;
  updatedCount: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

// ============================================================================
// FILTER & SORT TYPES
// ============================================================================

/**
 * Filter opties voor het scherm
 */
export interface WeekDagdelenFilters {
  toonAlleDiensten: boolean;
  toonAlleenMoet: boolean;
  toonAlleenAangepast: boolean;
  zoekTerm?: string;
}

/**
 * Sort opties
 */
export type DienstSortField = 'code' | 'naam' | 'volgorde';
export type SortDirection = 'asc' | 'desc';

export interface DienstSortOptions {
  field: DienstSortField;
  direction: SortDirection;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Dag van de week (0 = maandag, 6 = zondag)
 */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Mapping van weekday index naar naam
 */
export const WEEKDAY_NAMES: Record<WeekdayIndex, string> = {
  0: 'ma',
  1: 'di',
  2: 'wo',
  3: 'do',
  4: 'vr',
  5: 'za',
  6: 'zo'
};

/**
 * Mapping van weekday index naar volledige naam
 */
export const WEEKDAY_FULL_NAMES: Record<WeekdayIndex, string> = {
  0: 'Maandag',
  1: 'Dinsdag',
  2: 'Woensdag',
  3: 'Donderdag',
  4: 'Vrijdag',
  5: 'Zaterdag',
  6: 'Zondag'
};

/**
 * Dagdeel volgorde voor rendering
 */
export const DAGDEEL_ORDER: Dagdeel[] = ['0', 'M', 'A'];

/**
 * Team volgorde voor rendering (vaste volgorde: Groen, Oranje, Totaal)
 */
export const TEAM_ORDER: TeamDagdeel[] = ['GRO', 'ORA', 'TOT'];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate week context
 */
export function isValidWeekContext(value: unknown): value is WeekContext {
  if (!value || typeof value !== 'object') return false;
  const ctx = value as WeekContext;
  
  return (
    typeof ctx.rosterId === 'string' &&
    typeof ctx.weekNumber === 'number' &&
    ctx.weekNumber >= 1 &&
    ctx.weekNumber <= 53 &&
    typeof ctx.year === 'number' &&
    ctx.year >= 2020 &&
    ctx.year <= 2100 &&
    typeof ctx.startDate === 'string' &&
    typeof ctx.endDate === 'string'
  );
}

/**
 * Validate dagdeel waarde
 */
export function isValidDagdeelWaarde(value: unknown): value is DagdeelWaarde {
  if (!value || typeof value !== 'object') return false;
  const dw = value as DagdeelWaarde;
  
  return (
    (dw.dagdeel === '0' || dw.dagdeel === 'M' || dw.dagdeel === 'A') &&
    (dw.status === 'MOET' || dw.status === 'MAG' || dw.status === 'MAG_NIET' || dw.status === 'AANGEPAST') &&
    typeof dw.aantal === 'number' &&
    dw.aantal >= 0 &&
    dw.aantal <= 9 &&
    typeof dw.id === 'string'
  );
}

/**
 * Validate weekday index
 */
export function isValidWeekdayIndex(value: unknown): value is WeekdayIndex {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get weekday index from date string
 */
export function getWeekdayIndex(dateString: string): WeekdayIndex {
  const date = new Date(dateString);
  const day = date.getDay();
  // Convert Sunday (0) to 6, and shift Monday-Saturday to 0-5
  return (day === 0 ? 6 : day - 1) as WeekdayIndex;
}

/**
 * Get weekday name from date string
 */
export function getWeekdayName(dateString: string): string {
  const index = getWeekdayIndex(dateString);
  return WEEKDAY_NAMES[index];
}

/**
 * Get full weekday name from date string
 */
export function getFullWeekdayName(dateString: string): string {
  const index = getWeekdayIndex(dateString);
  return WEEKDAY_FULL_NAMES[index];
}

/**
 * Check if a dagdeel requires attention (MOET status met 0 aantal)
 */
export function requiresAttention(dagdeelWaarde: DagdeelWaarde): boolean {
  return dagdeelWaarde.status === 'MOET' && dagdeelWaarde.aantal === 0;
}

/**
 * Check if a dagdeel is manually adjusted
 */
export function isManuallyAdjusted(dagdeelWaarde: DagdeelWaarde): boolean {
  return dagdeelWaarde.status === 'AANGEPAST';
}

/**
 * Get CSS class for dagdeel status
 */
export function getStatusColorClass(status: DagdeelStatus): string {
  const colorMap: Record<DagdeelStatus, string> = {
    MOET: 'bg-red-50 border-red-300',
    MAG: 'bg-green-50 border-green-300',
    MAG_NIET: 'bg-gray-50 border-gray-300',
    AANGEPAST: 'bg-blue-50 border-blue-300'
  };
  return colorMap[status];
}

/**
 * Get display label for aantal (0 = empty, 1-9 = number)
 */
export function getAantalDisplayLabel(aantal: number): string {
  return aantal === 0 ? '-' : aantal.toString();
}

// ============================================================================
// DATA TRANSFORMATION HELPERS
// ============================================================================

/**
 * Create empty DagdeelWaarde (fallback)
 */
export function createEmptyDagdeelWaarde(
  dagdeel: Dagdeel,
  id: string = 'temp-id'
): DagdeelWaarde {
  return {
    dagdeel,
    status: 'MAG_NIET',
    aantal: 0,
    id
  };
}

/**
 * Create empty DagDagdelen structure
 */
export function createEmptyDagDagdelen(datum: string): DagDagdelen {
  const dagNaam = getWeekdayName(datum);
  
  return {
    datum,
    dagNaam,
    dagdeelWaarden: {
      ochtend: createEmptyDagdeelWaarde('0', `${datum}-0`),
      middag: createEmptyDagdeelWaarde('M', `${datum}-M`),
      avond: createEmptyDagdeelWaarde('A', `${datum}-A`)
    }
  };
}

/**
 * Sort diensten by specified field and direction
 */
export function sortDiensten(
  diensten: DienstDagdelenWeek[],
  options: DienstSortOptions
): DienstDagdelenWeek[] {
  const { field, direction } = options;
  const multiplier = direction === 'asc' ? 1 : -1;
  
  return [...diensten].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'code':
        comparison = a.dienstCode.localeCompare(b.dienstCode);
        break;
      case 'naam':
        comparison = a.dienstNaam.localeCompare(b.dienstNaam);
        break;
      case 'volgorde':
        comparison = a.volgorde - b.volgorde;
        break;
    }
    
    return comparison * multiplier;
  });
}

/**
 * Filter diensten based on filters
 */
export function filterDiensten(
  diensten: DienstDagdelenWeek[],
  filters: WeekDagdelenFilters
): DienstDagdelenWeek[] {
  let filtered = [...diensten];
  
  // Zoek filter
  if (filters.zoekTerm && filters.zoekTerm.trim() !== '') {
    const searchTerm = filters.zoekTerm.toLowerCase().trim();
    filtered = filtered.filter(dienst => 
      dienst.dienstCode.toLowerCase().includes(searchTerm) ||
      dienst.dienstNaam.toLowerCase().includes(searchTerm)
    );
  }
  
  // Status filters
  if (filters.toonAlleenMoet) {
    filtered = filtered.filter(dienst => 
      hasDagdeelMetStatus(dienst, 'MOET')
    );
  }
  
  if (filters.toonAlleenAangepast) {
    filtered = filtered.filter(dienst => 
      hasDagdeelMetStatus(dienst, 'AANGEPAST')
    );
  }
  
  return filtered;
}

/**
 * Check if dienst has any dagdeel with specified status
 */
function hasDagdeelMetStatus(
  dienst: DienstDagdelenWeek,
  status: DagdeelStatus
): boolean {
  for (const team of Object.values(dienst.teams)) {
    for (const dag of team.dagen) {
      for (const dagdeelWaarde of Object.values(dag.dagdeelWaarden)) {
        if (dagdeelWaarde.status === status) {
          return true;
        }
      }
    }
  }
  return false;
}

// ============================================================================
// STATISTICS & SUMMARY
// ============================================================================

/**
 * Week statistics
 */
export interface WeekDagdelenStats {
  totaalDiensten: number;
  totaalRecords: number;
  aantalMoet: number;
  aantalMag: number;
  aantalMagNiet: number;
  aantalAangepast: number;
  aantalOnvervuld: number;  // MOET met aantal = 0
}

/**
 * Calculate statistics for week data
 */
export function calculateWeekStats(data: WeekDagdelenData): WeekDagdelenStats {
  const stats: WeekDagdelenStats = {
    totaalDiensten: data.diensten.length,
    totaalRecords: 0,
    aantalMoet: 0,
    aantalMag: 0,
    aantalMagNiet: 0,
    aantalAangepast: 0,
    aantalOnvervuld: 0
  };
  
  for (const dienst of data.diensten) {
    for (const team of Object.values(dienst.teams)) {
      for (const dag of team.dagen) {
        for (const dagdeelWaarde of Object.values(dag.dagdeelWaarden)) {
          stats.totaalRecords++;
          
          switch (dagdeelWaarde.status) {
            case 'MOET':
              stats.aantalMoet++;
              if (dagdeelWaarde.aantal === 0) {
                stats.aantalOnvervuld++;
              }
              break;
            case 'MAG':
              stats.aantalMag++;
              break;
            case 'MAG_NIET':
              stats.aantalMagNiet++;
              break;
            case 'AANGEPAST':
              stats.aantalAangepast++;
              break;
          }
        }
      }
    }
  }
  
  return stats;
}

/**
 * Export all types for easy importing
 */
export type {
  WeekContext,
  DagdeelWaarde,
  DagDagdelen,
  TeamDagdelenWeek,
  DienstDagdelenWeek,
  WeekDagdelenData,
  CelEditState,
  WeekDagdelenLoadingState,
  WeekDagdelenError,
  WeekDagdelenUIState,
  RawDagdeelRecord,
  GroupedDagdelenData,
  DagdeelUpdate,
  DagdelenBatchUpdate,
  DagdelenSaveResponse,
  WeekDagdelenFilters,
  DienstSortField,
  SortDirection,
  DienstSortOptions,
  WeekdayIndex,
  WeekDagdelenStats
};
