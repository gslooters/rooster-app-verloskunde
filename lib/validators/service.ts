// lib/validators/service.ts
// ============================================================================
// SERVICE VALIDATORS - Validatie voor Dagblok Regels
// ============================================================================
// DRAAD30B - Database Herstructurering
// Validatie en helper functies voor service dagblok regels
// ============================================================================

import {
  DagblokStatus,
  DagblokCode,
  DagCode,
  DagblokRegels,
  TeamRegels,
  TeamCode,
  DEFAULT_DAGBLOK_REGELS,
  DEFAULT_TEAM_REGELS,
  ALLE_DAGEN,
  ALLE_DAGBLOKKEN
} from '../types/service';

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check of een waarde een geldige DagblokStatus is
 */
export function isDagblokStatus(value: unknown): value is DagblokStatus {
  return (
    value === DagblokStatus.MOET ||
    value === DagblokStatus.MAG ||
    value === DagblokStatus.MAG_NIET
  );
}

/**
 * Check of een waarde een geldige DagblokCode is
 */
export function isDagblokCode(value: unknown): value is DagblokCode {
  return value === 'O' || value === 'M' || value === 'A';
}

/**
 * Check of een waarde een geldige DagCode is
 */
export function isDagCode(value: unknown): value is DagCode {
  return ALLE_DAGEN.includes(value as DagCode);
}

/**
 * Check of een waarde een geldige TeamCode is
 */
export function isTeamCode(value: unknown): value is TeamCode {
  return value === 'groen' || value === 'oranje' || value === 'totaal';
}

// ============================================================================
// VALIDATIE FUNCTIES
// ============================================================================

/**
 * Valideer DagblokRegels object
 */
export function validateDagblokRegels(regels: unknown): regels is DagblokRegels {
  if (!regels || typeof regels !== 'object') return false;
  
  const r = regels as any;
  
  return (
    isDagblokStatus(r.O) &&
    isDagblokStatus(r.M) &&
    isDagblokStatus(r.A)
  );
}

/**
 * Valideer TeamRegels object
 */
export function validateTeamRegels(regels: unknown): regels is TeamRegels {
  if (!regels || typeof regels !== 'object') return false;
  
  const r = regels as any;
  
  return ALLE_DAGEN.every(dag => validateDagblokRegels(r[dag]));
}

/**
 * Normaliseer DagblokRegels - vul missende waarden aan met defaults
 */
export function normalizeDagblokRegels(regels?: Partial<DagblokRegels>): DagblokRegels {
  if (!regels) return { ...DEFAULT_DAGBLOK_REGELS };
  
  return {
    O: isDagblokStatus(regels.O) ? regels.O : DagblokStatus.MAG,
    M: isDagblokStatus(regels.M) ? regels.M : DagblokStatus.MAG,
    A: isDagblokStatus(regels.A) ? regels.A : DagblokStatus.MAG
  };
}

/**
 * Normaliseer TeamRegels - vul missende dagen/dagblokken aan met defaults
 */
export function normalizeTeamRegels(regels?: Partial<TeamRegels>): TeamRegels {
  if (!regels) return { ...DEFAULT_TEAM_REGELS };
  
  const normalized: any = {};
  
  ALLE_DAGEN.forEach(dag => {
    normalized[dag] = normalizeDagblokRegels((regels as any)[dag]);
  });
  
  return normalized as TeamRegels;
}

// ============================================================================
// JSONB SERIALISATIE/DESERIALISATIE
// ============================================================================

/**
 * Converteer TeamRegels naar JSONB-compatible object voor database
 */
export function teamRegelsToJSON(regels: TeamRegels): object {
  // Direct returnen - TeamRegels is al JSON-compatible
  return regels;
}

/**
 * Parse JSONB data uit database naar TeamRegels
 */
export function teamRegelsFromJSON(json: unknown): TeamRegels {
  if (!json) return { ...DEFAULT_TEAM_REGELS };
  
  // Valideer en normaliseer
  if (validateTeamRegels(json)) {
    return json;
  }
  
  // Als validatie faalt, normaliseer partial data
  return normalizeTeamRegels(json as Partial<TeamRegels>);
}

// ============================================================================
// BUSINESS LOGIC VALIDATORS
// ============================================================================

/**
 * Check of een dienst op een specifieke dag/dagblok verplicht is voor een team
 */
export function isDienstVerplicht(
  teamRegels: TeamRegels | undefined,
  dag: DagCode,
  dagblok: DagblokCode
): boolean {
  if (!teamRegels) return false;
  return teamRegels[dag][dagblok] === DagblokStatus.MOET;
}

/**
 * Check of een dienst op een specifieke dag/dagblok toegestaan is voor een team
 */
export function isDienstToegstaan(
  teamRegels: TeamRegels | undefined,
  dag: DagCode,
  dagblok: DagblokCode
): boolean {
  if (!teamRegels) return true; // Geen regels = alles mag
  return teamRegels[dag][dagblok] !== DagblokStatus.MAG_NIET;
}

/**
 * Tel hoeveel dagblokken MOET status hebben voor een team
 */
export function telVerplichteDagblokken(teamRegels: TeamRegels | undefined): number {
  if (!teamRegels) return 0;
  
  let count = 0;
  ALLE_DAGEN.forEach(dag => {
    ALLE_DAGBLOKKEN.forEach(dagblok => {
      if (teamRegels[dag][dagblok] === DagblokStatus.MOET) {
        count++;
      }
    });
  });
  
  return count;
}

/**
 * Genereer een menselijk leesbare beschrijving van team regels
 */
export function beschrijfTeamRegels(teamRegels: TeamRegels | undefined): string {
  if (!teamRegels) return 'Geen specifieke regels';
  
  const verplicht = telVerplichteDagblokken(teamRegels);
  
  if (verplicht === 0) {
    return 'Flexibel inzetbaar';
  }
  
  const details: string[] = [];
  
  ALLE_DAGEN.forEach(dag => {
    const dagMoet = ALLE_DAGBLOKKEN.filter(
      blok => teamRegels[dag][blok] === DagblokStatus.MOET
    );
    
    if (dagMoet.length > 0) {
      details.push(`${dag.toUpperCase()}: ${dagMoet.join('/')}`);
    }
  });
  
  if (details.length === 0) return 'Flexibel inzetbaar';
  if (details.length > 3) return `${verplicht} verplichte dagblokken`;
  
  return details.join(', ');
}

/**
 * Check of er conflicterende regels zijn tussen teams
 * (momenteel alleen informatief, geen harde blokkade)
 */
export function detecteerTeamConflicten(
  groen?: TeamRegels,
  oranje?: TeamRegels,
  totaal?: TeamRegels
): string[] {
  const conflicten: string[] = [];
  
  // Als totaal regels heeft, mogen groen/oranje geen MOET hebben
  if (totaal) {
    const totaalVerplicht = telVerplichteDagblokken(totaal);
    
    if (totaalVerplicht > 0) {
      const groenVerplicht = telVerplichteDagblokken(groen);
      const oranjeVerplicht = telVerplichteDagblokken(oranje);
      
      if (groenVerplicht > 0) {
        conflicten.push('Team Groen heeft verplichte dagblokken terwijl Totaal ook actief is');
      }
      
      if (oranjeVerplicht > 0) {
        conflicten.push('Team Oranje heeft verplichte dagblokken terwijl Totaal ook actief is');
      }
    }
  }
  
  return conflicten;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export {
  DEFAULT_DAGBLOK_REGELS,
  DEFAULT_TEAM_REGELS,
  ALLE_DAGEN,
  ALLE_DAGBLOKKEN
};
