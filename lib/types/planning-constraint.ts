// TypeScript types voor planning constraints
// Fase 2: UI Implementatie rooster-app-verloskunde
// Structuur en Nederlands commentaar -- DRAAD95A
// DRAAD95E: Column name fix rosterid -> roster_id
// DRAAD95F: Add missing isfixed property to RosterPlanningConstraint
// DRAAD96A: Fix property name mismatch - database snake_case vs TypeScript camelCase
// DRAAD103: Stap 1 - Verwijder 5 planregels (availability, teamdagblokrules, fairnessbalance, workloadmax, minserviceperperiod)

export type ConstraintType =
  | 'coverageminimum'
  | 'employeeservices'
  | 'preassignments'
  | 'consecutiverest'
  | 'blocksnextday'
  | 'maxserviceperperiod'
  | 'maxconsecutivework';

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
  can_relax: boolean; // DRAAD96A: Fixed canrelax -> can_relax
  is_fixed: boolean; // DRAAD96A: Fixed isfixed -> is_fixed
  team?: string;
  created_at: string; // DRAAD96A: Fixed createdat -> created_at
  updated_at: string; // DRAAD96A: Fixed updatedat -> updated_at
}

export interface RosterPlanningConstraint {
  id: string; // UUID
  roster_id: string; // DRAAD95E: Fixed rosterid -> roster_id
  base_constraint_id?: string; // DRAAD96A: Fixed baseconstraintid -> base_constraint_id
  naam: string;
  type: ConstraintType;
  beschrijving?: string;
  parameters: Record<string, any>;
  actief: boolean;
  priority: ConstraintPriority;
  can_relax: boolean; // DRAAD96A: Fixed canrelax -> can_relax
  is_fixed: boolean; // DRAAD96A: Fixed isfixed -> is_fixed
  is_override: boolean; // DRAAD96A: Fixed isoverride -> is_override
  team?: string;
  created_at: string; // DRAAD96A: Fixed createdat -> created_at
  updated_at: string; // DRAAD96A: Fixed updatedat -> updated_at
}

export interface CreateConstraintRequest {
  naam: string;
  type: ConstraintType;
  beschrijving?: string;
  parameters: Record<string, any>;
  actief?: boolean;
  priority?: ConstraintPriority;
  can_relax?: boolean; // DRAAD96A: Fixed canrelax -> can_relax
  is_fixed?: boolean; // DRAAD96A: Fixed isfixed -> is_fixed
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
  can_relax?: boolean; // DRAAD96A: Fixed canrelax -> can_relax
  is_fixed?: boolean; // DRAAD96A: Fixed isfixed -> is_fixed
  team?: string;
}

export interface OverrideConstraintRequest {
  id: string;
  parameters?: Record<string, any>;
  actief?: boolean;
  priority?: ConstraintPriority;
  can_relax?: boolean; // DRAAD96A: Fixed canrelax -> can_relax
  is_override?: boolean; // DRAAD96A: Fixed isoverride -> is_override
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
// DRAAD103: Stap 1 - 5 types verwijderd
export const TYPE_LABELS: Record<ConstraintType, string> = {
  coverageminimum: 'Minimale bezetting',
  employeeservices: 'Bevoegdheden',
  preassignments: 'Pre-planning',
  consecutiverest: 'Rustdag na nachtdienst',
  blocksnextday: 'Blokkeert volgdag',
  maxserviceperperiod: 'Max. dienst per periode',
  maxconsecutivework: 'Max. aaneengesloten werk',
};
