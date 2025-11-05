// lib/types/daytype-staffing.ts

// Team scope types for staffing rules
export type TeamScope = 'total' | 'groen' | 'oranje' | 'both';

export interface DayTypeStaffing {
  id: string;
  dienstId: string; // Foreign key to Dienst
  dagSoort: number; // 0 = Maandag, 1 = Dinsdag, ... 6 = Zondag
  minBezetting: number; // 0-8
  maxBezetting: number; // 0-9 (9 = onbeperkt)
  teamScope: TeamScope; // NEW: Team scope for this staffing rule
  created_at: string;
  updated_at: string;
}

export interface DayTypeStaffingInput {
  dienstId: string;
  dagSoort: number;
  minBezetting: number;
  maxBezetting: number;
  teamScope?: TeamScope; // Optional for backward compatibility
}

// Service-level team scope (per dienst, not per dag)
export interface ServiceTeamScope {
  dienstId: string;
  teamScope: TeamScope;
  updated_at: string;
}

export const DAYS_OF_WEEK = [
  { code: 'ma', name: 'Maandag', index: 0 },
  { code: 'di', name: 'Dinsdag', index: 1 },
  { code: 'wo', name: 'Woensdag', index: 2 },
  { code: 'do', name: 'Donderdag', index: 3 },
  { code: 'vr', name: 'Vrijdag', index: 4 },
  { code: 'za', name: 'Zaterdag', index: 5 },
  { code: 'zo', name: 'Zondag', index: 6 }
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Team scope configuration constants
export const TEAM_SCOPE_CONFIG = {
  total: { 
    code: 'total', 
    label: 'Tot', 
    name: 'Totale praktijk',
    color: 'blue',
    description: 'Alle medewerkers'
  },
  groen: { 
    code: 'groen', 
    label: 'Gro', 
    name: 'Team Groen',
    color: 'green',
    description: 'Alleen Team Groen'
  },
  oranje: { 
    code: 'oranje', 
    label: 'Org', 
    name: 'Team Oranje', 
    color: 'orange',
    description: 'Alleen Team Oranje'
  },
  both: { 
    code: 'both', 
    label: 'G+O', 
    name: 'Beide Teams',
    color: 'purple',
    description: 'Team Groen en Oranje'
  }
} as const;

// Helper functions for team scope
export function getDefaultTeamScope(): TeamScope {
  return 'total';
}

export function isValidTeamScope(scope: string): scope is TeamScope {
  return ['total', 'groen', 'oranje', 'both'].includes(scope);
}

export function getTeamScopeConfig(scope: TeamScope) {
  return TEAM_SCOPE_CONFIG[scope];
}

// Helper to determine if teams are exclusive with total
export function isTeamScopeExclusive(scope: TeamScope): boolean {
  return scope !== 'total';
}

// Helper to get team scope display text
export function getTeamScopeDisplayText(scope: TeamScope): string {
  return TEAM_SCOPE_CONFIG[scope].name;
}