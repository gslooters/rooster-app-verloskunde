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
  system: boolean; // vaste, niet wijzigbare dienst ("=", "NB", "VRIJ")
  actief: boolean;
  created_at: string;
  updated_at: string;
}

export function validateDienstwaarde(v: number): boolean {
  if (typeof v !== 'number' || Number.isNaN(v)) return false;
  if (v < 0 || v > 6) return false;
  // veelvoud van 0.5 toestaan (inclusief 0)
  return Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
}

// Bereken duur in uren tussen begintijd en eindtijd
export function calculateDuration(begintijd: string, eindtijd: string): number {
  if (begintijd === '00:00' && eindtijd === '00:00') return 0;
  
  const [beginHours, beginMinutes] = begintijd.split(':').map(Number);
  const [eindHours, eindMinutes] = eindtijd.split(':').map(Number);
  
  let beginTotalMinutes = beginHours * 60 + beginMinutes;
  let eindTotalMinutes = eindHours * 60 + eindMinutes;
  
  // Als eindtijd kleiner is dan begintijd, ga er vanuit dat het de volgende dag is
  if (eindTotalMinutes < beginTotalMinutes) {
    eindTotalMinutes += 24 * 60;
  }
  
  return (eindTotalMinutes - beginTotalMinutes) / 60;
}

// Controleer overlap tussen twee diensten
export function checkOverlap(dienst1: Dienst, dienst2: Dienst): boolean {
  if (dienst1.begintijd === '00:00' && dienst1.eindtijd === '00:00') return false;
  if (dienst2.begintijd === '00:00' && dienst2.eindtijd === '00:00') return false;
  
  const start1 = timeToMinutes(dienst1.begintijd);
  const end1 = timeToMinutes(dienst1.eindtijd);
  const start2 = timeToMinutes(dienst2.begintijd);
  const end2 = timeToMinutes(dienst2.eindtijd);
  
  return (start1 < end2 && end1 > start2);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}