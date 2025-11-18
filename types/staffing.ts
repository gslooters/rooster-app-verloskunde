/**
 * SHARED STAFFING TYPES
 * 
 * Centrale type definitions voor staffing/dagdeel functionaliteit.
 * Gebruikt door:
 * - /planning/period-staffing
 * - Toekomstige staffing gerelateerde features
 * 
 * Datum: 18 november 2025
 */

// ============================================================================
// ROSTER INFO
// ============================================================================

export interface RosterInfo {
  id: string;
  naam?: string;
  start_date: string;
  end_date: string;
}

// ============================================================================
// SERVICES/DIENSTEN
// ============================================================================

export interface Service {
  id: string;
  naam: string;
  code: string;
  kleur: string;
  actief?: boolean;
}

// ============================================================================
// ROSTER PERIOD STAFFING
// ============================================================================

export interface RosterPeriodStaffing {
  id: string;
  roster_id: string;
  service_id: string;
  date: string;
  min_staff: number;
  max_staff: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// DAGDEEL ASSIGNMENTS
// ============================================================================

export type Dagdeel = 'ochtend' | 'middag' | 'avond';
export type Team = 'GRO' | 'ORA' | 'PRA'; // Groen, Oranje, Praktijk
export type DagdeelStatus = 'MOET' | 'MAG' | 'MAG NIET' | 'AANGEPAST';

export interface DagdeelAssignment {
  id?: string;
  roster_period_staffing_id: string;
  dagdeel: Dagdeel;
  team: Team;
  status: DagdeelStatus;
  aantal: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// UI HELPERS
// ============================================================================

export interface CellData {
  rpsId: string;
  serviceId: string;
  date: string;
  dagdeel: Dagdeel;
  team: Team;
  status: DagdeelStatus;
  aantal: number;
  assignmentId?: string;
}

export interface PeriodInfo {
  startWeek: number;
  endWeek: number;
  startDate: Date;
  endDate: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DAGDELEN: readonly Dagdeel[] = ['ochtend', 'middag', 'avond'] as const;
export const TEAMS: readonly Team[] = ['GRO', 'ORA', 'PRA'] as const;

export const TEAM_LABELS: Record<Team, string> = {
  GRO: 'Groen',
  ORA: 'Oranje',
  PRA: 'Praktijk'
} as const;

export const TEAM_COLORS: Record<Team, string> = {
  GRO: 'bg-green-50',
  ORA: 'bg-orange-50',
  PRA: 'bg-purple-50'
} as const;

export const STATUS_COLORS: Record<DagdeelStatus, string> = {
  'MOET': 'bg-red-500',
  'MAG': 'bg-green-500',
  'MAG NIET': 'bg-gray-400',
  'AANGEPAST': 'bg-blue-500'
} as const;

export const STATUS_DESCRIPTIONS: Record<DagdeelStatus, string> = {
  'MOET': 'Vereist minimum (standaard: 1)',
  'MAG': 'Optioneel (standaard: 1)',
  'MAG NIET': 'Niet toegestaan (standaard: 0)',
  'AANGEPAST': 'Handmatig gewijzigd van de regel'
} as const;