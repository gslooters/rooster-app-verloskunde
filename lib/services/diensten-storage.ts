// lib/services/diensten-storage.ts
import { Dienst } from "../types/dienst";

const STORAGE_KEY = "rooster_diensten";

const DEFAULT_DIENSTEN: Dienst[] = [
  { id: 's', code: 's', naam: 'Shift', beschrijving: 'Reguliere dienst', kleur: '#3B82F6', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd', code: 'd', naam: 'Dagdienst', beschrijving: 'Dagdienst', kleur: '#10B981', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'sp', code: 'sp', naam: 'Speciaal', beschrijving: 'Speciale dienst', kleur: '#8B5CF6', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'echo', code: 'echo', naam: 'Echo', beschrijving: 'Echo onderzoek', kleur: '#F59E0B', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'nd', code: 'nd', naam: 'Nachtdienst', beschrijving: 'Nachtdienst', kleur: '#1F2937', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ss', code: 'ss', naam: 'Weekend', beschrijving: 'Weekend dienst', kleur: '#EF4444', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Dienst[] {
  if (typeof window === 'undefined') return DEFAULT_DIENSTEN;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DIENSTEN));
    return DEFAULT_DIENSTEN;
  }
  try { return JSON.parse(raw) as Dienst[]; } catch { return DEFAULT_DIENSTEN; }
}

function save(list: Dienst[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllServices(): Dienst[] { return load(); }

export function createService(data: Omit<Dienst, 'id'|'created_at'|'updated_at'> & { id?: string }): Dienst {
  const list = load();
  const now = new Date().toISOString();
  const id = data.id ?? data.code;
  if (!data.code || data.code.length < 1 || data.code.length > 4) throw new Error('Code moet 1-4 tekens zijn');
  if (!data.naam) throw new Error('Naam is verplicht');
  if (list.some(d => d.code.toLowerCase() === data.code.toLowerCase())) throw new Error('Code moet uniek zijn');
  const nieuw: Dienst = { id, created_at: now, updated_at: now, ...data } as Dienst;
  list.push(nieuw); save(list); return nieuw;
}

export function updateService(id: string, patch: Partial<Dienst>): Dienst {
  const list = load();
  const idx = list.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Dienst niet gevonden');
  const now = new Date().toISOString();
  const current = list[idx];
  const updated = { ...current, ...patch, updated_at: now } as Dienst;
  // code uniek houden
  if (updated.code && list.some(d => d.id !== id && d.code.toLowerCase() === updated.code.toLowerCase())) {
    throw new Error('Code moet uniek zijn');
  }
  list[idx] = updated; save(list); return updated;
}

// Mock referentie checks: vervang later met echte lookup in rooster/medewerker stores
function isServiceUsedInRoosters(dienstId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('roosters') || '[]';
  try {
    const roosters = JSON.parse(raw) as any[];
    return roosters.some(r => JSON.stringify(r).includes(`"${dienstId}"`) || JSON.stringify(r).includes(`:${dienstId}`));
  } catch { return false; }
}

function isServiceMappedToEmployees(dienstId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('medewerker_diensten') || '{}';
  try {
    const map = JSON.parse(raw) as Record<string,string[]>;
    return Object.values(map).some(list => list.includes(dienstId));
  } catch { return false; }
}

export function canDeleteService(dienstId: string): { canDelete: boolean; reason?: string } {
  if (isServiceUsedInRoosters(dienstId)) return { canDelete: false, reason: 'Staat in rooster' };
  if (isServiceMappedToEmployees(dienstId)) return { canDelete: false, reason: 'Gekoppeld aan medewerker' };
  return { canDelete: true };
}

export function removeService(dienstId: string): void {
  const check = canDeleteService(dienstId);
  if (!check.canDelete) throw new Error(`Kan deze dienst niet verwijderen. ${check.reason ?? ''}`.trim());
  const list = load();
  const next = list.filter(d => d.id !== dienstId);
  save(next);
}
