// lib/types/dienst.ts
// ============================================================================
// DIENST TYPE DEFINITION
// ============================================================================
// DRAAD30B Update: Nieuwe velden voor dagblok regels per team
// DRAAD99B Update: is_system veld voor systeemdiensten bescherming
// Backward compatible met bestaande implementatie
// ============================================================================

import { TeamRegels } from './service';

export interface Dienst {
  id: string; // UUID primary key (was TEXT, nu UUID)
  code: string; // 2-3 chars, unique
  naam: string;
  beschrijving: string;
  begintijd: string; // Format: "HH:MM"
  eindtijd: string; // Format: "HH:MM"
  duur: number; // Automatisch berekend in uren
  kleur: string; // hex
  dienstwaarde: number; // 0..6 in stappen van 0.5
  actief: boolean;
  created_at: string;
  updated_at: string;
  planregels?: string; // planningsafspraken voor deze dienst
  
  // ========================================================================
  // NIEUWE VELDEN - DRAAD30B Database Herstructurering
  // ========================================================================
  
  /**
   * Blokkeert deze dienst de volgende dag?
   * Bijvoorbeeld: nachtdienst blokkeert volgende dag
   */
  blokkeert_volgdag?: boolean;
  
  /**
   * Dagblok regels voor Team Groen (JSONB)
   * 7 dagen × 3 dagblokken (O/M/A) met status MOET/MAG/MAG_NIET
   */
  team_groen_regels?: TeamRegels;
  
  /**
   * Dagblok regels voor Team Oranje (JSONB)
   * 7 dagen × 3 dagblokken (O/M/A) met status MOET/MAG/MAG_NIET
   */
  team_oranje_regels?: TeamRegels;
  
  /**
   * Dagblok regels voor Team Totaal (JSONB)
   * 7 dagen × 3 dagblokken (O/M/A) met status MOET/MAG/MAG_NIET
   */
  team_totaal_regels?: TeamRegels;
  
  // ========================================================================
  // DRAAD99B: SYSTEEMDIENSTEN BESCHERMING
  // ========================================================================
  
  /**
   * Markering voor systeemdiensten die niet verwijderd of aangepast mogen worden
   * TRUE voor: DIO, DDO, DIA, DDA (automatische blokkering diensten)
   * Deze diensten worden gebruikt door de automatische dagblok blokkering
   */
  is_system?: boolean;
  
  // ========================================================================
  // DEPRECATED VELDEN
  // ========================================================================
  
  /**
   * @deprecated Wordt vervangen door is_system in DRAAD99B
   * Gebruik is_system in plaats daarvan voor nieuwe code
   */
  system?: boolean;
}

// ============================================================================
// VALIDATIE FUNCTIES
// ============================================================================

export function validateDienstwaarde(v: number): boolean {
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (v < 0 || v > 6) return false;
  // veelvoud van 0.5 toestaan (inclusief 0)
  return Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
}

// ============================================================================
// BEREKENING FUNCTIES
// ============================================================================

/**
 * Bereken duur in uren tussen begintijd en eindtijd
 */
export function calculateDuration(begintijd: string, eindtijd: string): number {
  // Speciale gevallen
  if (begintijd === '00:00' && eindtijd === '00:00') return 0; // Geen werk
  
  const [beginHours, beginMinutes] = begintijd.split(':').map(Number);
  const [eindHours, eindMinutes] = eindtijd.split(':').map(Number);
  
  let beginTotalMinutes = beginHours * 60 + beginMinutes;
  let eindTotalMinutes = eindHours * 60 + eindMinutes;
  
  // Als begin- en eindtijd gelijk zijn (maar niet 00:00), dan 24 uur
  if (beginTotalMinutes === eindTotalMinutes && beginTotalMinutes !== 0) {
    return 24;
  }
  
  // Als eindtijd kleiner is dan begintijd, ga er vanuit dat het de volgende dag is
  if (eindTotalMinutes < beginTotalMinutes) {
    eindTotalMinutes += 24 * 60;
  }
  
  return (eindTotalMinutes - beginTotalMinutes) / 60;
}