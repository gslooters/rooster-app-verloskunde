// lib/types/dienst.ts
export interface Dienst {
  id: string;
  code: string; // 2-3 chars, unique
  naam: string;
  beschrijving: string;
  begintijd: string; // Format: "HH:MM"
  eindtijd: string; // Format: "HH:MM"
  duur: number; // Automatisch berekend in uren
  kleur: string; // hex
  dienstwaarde: number; // 0..6 in stappen van 0.5
  system: boolean; // vaste, niet wijzigbare dienst ("=", "NB")
  actief: boolean;
  created_at: string;
  updated_at: string;
  planregels?: string; // planningsafspraken voor deze dienst
}

export function validateDienstwaarde(v: number): boolean {
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (v < 0 || v > 6) return false;
  // veelvoud van 0.5 toestaan (inclusief 0)
  return Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
}

// Bereken duur in uren tussen begintijd en eindtijd
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