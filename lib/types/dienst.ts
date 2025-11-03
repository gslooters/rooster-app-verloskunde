// lib/types/dienst.ts
export interface Dienst {
  id: string;
  code: string; // 2-3 chars, unique
  naam: string;
  beschrijving: string;
  kleur: string; // hex
  actief: boolean;
  created_at: string;
  updated_at: string;
}
