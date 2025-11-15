// lib/types/service.ts
// ============================================================================
// SERVICE TYPES - Dagblok Regels voor Teams
// ============================================================================
// DRAAD30B - Database Herstructurering
// Nieuwe type definitions voor dagblok planning per team
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
 * O = Ochtend
 * M = Middag
 * A = Avond
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
 * Team regels voor alle 7 dagen van de week
 * Bevat per dag de status van 3 dagblokken (O/M/A)
 */
export interface TeamRegels {
  ma: DagblokRegels;  // Maandag
  di: DagblokRegels;  // Dinsdag
  wo: DagblokRegels;  // Woensdag
  do: DagblokRegels;  // Donderdag
  vr: DagblokRegels;  // Vrijdag
  za: DagblokRegels;  // Zaterdag
  zo: DagblokRegels;  // Zondag
}

/**
 * Team identificaties
 */
export type TeamCode = 'groen' | 'oranje' | 'totaal';

/**
 * Dag codes (voor type-safety)
 */
export type DagCode = 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';

/**
 * Helper: Standaard lege dagblok regels (alles MAG)
 */
export const DEFAULT_DAGBLOK_REGELS: DagblokRegels = {
  O: DagblokStatus.MAG,
  M: DagblokStatus.MAG,
  A: DagblokStatus.MAG
};

/**
 * Helper: Standaard lege team regels (alle dagen MAG alles)
 */
export const DEFAULT_TEAM_REGELS: TeamRegels = {
  ma: { ...DEFAULT_DAGBLOK_REGELS },
  di: { ...DEFAULT_DAGBLOK_REGELS },
  wo: { ...DEFAULT_DAGBLOK_REGELS },
  do: { ...DEFAULT_DAGBLOK_REGELS },
  vr: { ...DEFAULT_DAGBLOK_REGELS },
  za: { ...DEFAULT_DAGBLOK_REGELS },
  zo: { ...DEFAULT_DAGBLOK_REGELS }
};

/**
 * Helper: Lijst van alle dag codes
 */
export const ALLE_DAGEN: DagCode[] = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/**
 * Helper: Lijst van alle dagblok codes
 */
export const ALLE_DAGBLOKKEN: DagblokCode[] = ['O', 'M', 'A'];

/**
 * Helper: Nederlandse namen voor dagblokken
 */
export const DAGBLOK_NAMEN: Record<DagblokCode, string> = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond'
};

/**
 * Helper: Nederlandse namen voor dagen
 */
export const DAG_NAMEN: Record<DagCode, string> = {
  ma: 'Maandag',
  di: 'Dinsdag',
  wo: 'Woensdag',
  do: 'Donderdag',
  vr: 'Vrijdag',
  za: 'Zaterdag',
  zo: 'Zondag'
};

/**
 * Helper: Korte Nederlandse namen voor dagen
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
 * Helper: Kleur codes voor dagblok status (voor UI)
 */
export const STATUS_KLEUREN: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: '#EF4444',      // Rood
  [DagblokStatus.MAG]: '#10B981',        // Groen
  [DagblokStatus.MAG_NIET]: '#6B7280'    // Grijs
};

/**
 * Helper: Emoji voor dagblok status
 */
export const STATUS_EMOJI: Record<DagblokStatus, string> = {
  [DagblokStatus.MOET]: '✓',
  [DagblokStatus.MAG]: '○',
  [DagblokStatus.MAG_NIET]: '✗'
};
