// lib/types/dienst.ts
export interface Dienst {
  id: string;
  code: string; // 2-3 chars, unique
  naam: string;
  beschrijving: string;
  kleur: string; // hex
  dienstwaarde: number; // 0..6 in stappen van 0.5
  system: boolean; // vaste, niet wijzigbare dienst ("=", "NB")
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
