// TypeScript types voor planning constraints
// Fase 2: UI Implementatie rooster-app-verloskunde
// Structuur en Nederlands commentaar -- DRAAD95A
// DRAAD95E: Column name fix rosterid -> roster_id

export type ConstraintType =
  | 'coverageminimum'
  | 'availability'
  | 'employeeservices'
  | 'preassignments'
  | 'teamdagblokrules'
  | 'workloadmax'
  | 'consecutiverest'
  | 'blocksnextday'
  | 'maxserviceperperiod'
  | 'fairnessbalance'
  | 'maxconsecutivework'
  | 'minserviceperperiod';

// Prioriteit 1 = Kritiek, 2 = Hoog, 3 = Normaal, 4 = Laag
export type ConstraintPriority = 1 | 2 | 3 | 4;

export interface PlanningConstraint {
  id: string; // UUID
  naam: string;
  type: ConstraintType;
  beschrijving?: string;
  parameters: Record<string, any>;
  actief: boolean;
  priority: ConstraintPriority;
  canrelax: boolean;
  isfixed: boolean;
  team?: string;
  createdat: string;
  updatedat: string;
}

export interface RosterPlanningConstraint {
  id: string; // UUID
  roster_id: string; // DRAAD95E: Fixed rosterid -> roster_id
  baseconstraintid?: string;
  naam: string;
  type: ConstraintType;
  beschrijving?: string;
  parameters: Record<string, any>;
  actief: boolean;
  priority: ConstraintPriority;
  canrelax: boolean;
  isoverride: boolean;
  team?: string;
  createdat: string;
  updatedat: string;
}

export interface CreateConstraintRequest {
  naam: string;
  type: ConstraintType;
  beschrijving?: string;
  parameters: Record<string, any>;
  actief?: boolean;
  priority?: ConstraintPriority;
  canrelax?: boolean;
  isfixed?: boolean;
  team?: string;
}

export interface UpdateConstraintRequest {
  id: string;
  naam?: string;
  type?: ConstraintType;
  beschrijving?: string;
  parameters?: Record<string, any>;
  actief?: boolean;
  priority?: ConstraintPriority;
  canrelax?: boolean;
  isfixed?: boolean;
  team?: string;
}

export interface OverrideConstraintRequest {
  id: string;
  parameters?: Record<string, any>;
  actief?: boolean;
  priority?: ConstraintPriority;
  canrelax?: boolean;
  isoverride?: boolean;
  team?: string;
}

// Kleuren per prioriteit
export const PRIORITY_COLORS: Record<ConstraintPriority, string> = {
  1: '#E53935', // Kritiek - rood
  2: '#FB8C00', // Hoog - oranje
  3: '#FFD600', // Normaal - geel
  4: '#1E88E5', // Laag - blauw
};

// Labels per type constraint (NL)
export const TYPE_LABELS: Record<ConstraintType, string> = {
  coverageminimum: 'Minimale bezetting',
  availability: 'Beschikbaarheid',
  employeeservices: 'Bevoegdheden',
  preassignments: 'Pre-planning',
  teamdagblokrules: 'Team dagblok regels',
  workloadmax: 'Max. werkdagen',
  consecutiverest: 'Rustdag na nachtdienst',
  blocksnextday: 'Blokkeert volgdag',
  maxserviceperperiod: 'Max. dienst per periode',
  fairnessbalance: 'Eerlijke verdeling',
  maxconsecutivework: 'Max. aaneengesloten werk',
  minserviceperperiod: 'Min. dienst team',
};
