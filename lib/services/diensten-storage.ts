// lib/services/diensten-storage.ts
import { Dienst, validateDienstwaarde } from "../types/dienst";

const STORAGE_KEY = "rooster_diensten";

const SYSTEM_DIENSTEN: Dienst[] = [
  { id: '=', code: '=', naam: 'Vrij', beschrijving: 'Vrij conform roosterplanning', kleur: '#47F906', dienstwaarde: 0, system: true, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'NB', code: 'NB', naam: 'Niet beschikbaar', beschrijving: 'Medewerker niet beschikbaar op deze dag', kleur: '#FFF59D', dienstwaarde: 0, system: true, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const DEFAULT_DIENSTEN: Dienst[] = [
  ...SYSTEM_DIENSTEN,
  { id: 'd24', code: 'D24', naam: '24-uurs dienst', beschrijving: 'Reguliere dienst', kleur: '#BE185D', dienstwaarde: 1, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'd', code: 'D', naam: 'Dagdienst', beschrijving: 'Dagdienst', kleur: '#10B981', dienstwaarde: 1, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'sp', code: 'SP', naam: 'Speciaal', beschrijving: 'Speciale dienst', kleur: '#8B5CF6', dienstwaarde: 1, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'echo', code: 'ECHO', naam: 'Echo', beschrijving: 'Echo onderzoek', kleur: '#F59E0B', dienstwaarde: 1, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'nd', code: 'ND', naam: 'Nachtdienst', beschrijving: 'Nachtdienst', kleur: '#1F2937', dienstwaarde: 1.5, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ss', code: 'SS', naam: 'Weekend', beschrijving: 'Weekend dienst', kleur: '#EF4444', dienstwaarde: 1, system: false, actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Dienst[] {
  if (typeof window === 'undefined') return DEFAULT_DIENSTEN;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DIENSTEN));
    return DEFAULT_DIENSTEN;
  }
  try {
    const list = JSON.parse(raw) as Dienst[];
    const filtered = list.filter(d => !SYSTEM_DIENSTEN.some(s => s.code === d.code));
    const merged = [...SYSTEM_DIENSTEN, ...filtered];
    return merged.map(d => ({
      ...d,
      dienstwaarde: (d as any).dienstwaarde != null ? d.dienstwaarde : 1,
      system: (d as any).system != null ? d.system : false,
    }));
  } catch {
    return DEFAULT_DIENSTEN;
  }
}

function save(list: Dienst[]) {
  if (typeof window === 'undefined') return;
  const filtered = list.filter(d => !SYSTEM_DIENSTEN.some(s => s.code === d.code));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...SYSTEM_DIENSTEN, ...filtered]));
}

export function getAllServices(): Dienst[] { return load(); }

export function createService(data: Omit<Dienst, 'id'|'created_at'|'updated_at'|'system'> & { id?: string; system?: boolean }): Dienst {
  const list = load();
  const now = new Date().toISOString();
  const id = data.id ?? data.code;
  if (!data.code || data.code.length < 1 || data.code.length > 4) throw new Error('Code moet 1-4 tekens zijn');
  if (!data.naam) throw new Error('Naam is verplicht');
  if (!validateDienstwaarde(data.dienstwaarde)) throw new Error('Dienstwaarde moet tussen 0 en 6 liggen in stappen van 0,5');
  if (list.some(d => d.code.toLowerCase() === data.code.toLowerCase())) throw new Error('Code moet uniek zijn');
  const nieuw: Dienst = { id, created_at: now, updated_at: now, system: false, ...data } as Dienst;
  list.push(nieuw); save(list); return nieuw;
}

export function updateService(id: string, patch: Partial<Dienst>): Dienst {
  const list = load();
  const idx = list.findIndex(d => d.id === id);
  if (idx === -1) throw new Error('Dienst niet gevonden');
  const current = list[idx];
  if (current.system) {
    const allowed: Partial<Dienst> = { actief: patch.actief ?? current.actief };
    const updated: Dienst = { ...current, ...allowed, updated_at: new Date().toISOString() };
    list[idx] = updated; save(list); return updated;
  }
  const now = new Date().toISOString();
  const next = { ...current, ...patch, updated_at: now } as Dienst;
  if (next.code && list.some(d => d.id !== id && d.code.toLowerCase() === next.code.toLowerCase())) throw new Error('Code moet uniek zijn');
  if (next.dienstwaarde != null && !validateDienstwaarde(next.dienstwaarde)) throw new Error('Dienstwaarde moet tussen 0 en 6 liggen in stappen van 0,5');
  list[idx] = next; save(list); return next;
}

function isServiceUsedInRoosters(dienstCode: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('roosters') || '[]';
  try {
    const roosters = JSON.parse(raw) as any[];
    return roosters.some(r => JSON.stringify(r).includes(`"${dienstCode}"`));
  } catch { return false; }
}

function isServiceMappedToEmployees(dienstCode: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('medewerker_diensten') || '{}';
  try {
    const map = JSON.parse(raw) as Record<string,string[]>;
    return Object.values(map).some(list => list.includes(dienstCode));
  } catch { return false; }
}

export function canDeleteService(dienstCode: string): { canDelete: boolean; reason?: string } {
  if (SYSTEM_DIENSTEN.some(s => s.code === dienstCode)) return { canDelete: false, reason: 'Vaste systeemdienst' };
  if (isServiceUsedInRoosters(dienstCode)) return { canDelete: false, reason: 'Staat in rooster' };
  if (isServiceMappedToEmployees(dienstCode)) return { canDelete: false, reason: 'Gekoppeld aan medewerker' };
  return { canDelete: true };
}

export function removeService(dienstCode: string): void {
  const check = canDeleteService(dienstCode);
  if (!check.canDelete) throw new Error(`Kan deze dienst niet verwijderen. ${check.reason ?? ''}`.trim());
  const list = load();
  const next = list.filter(d => d.code !== dienstCode);
  save(next);
}
