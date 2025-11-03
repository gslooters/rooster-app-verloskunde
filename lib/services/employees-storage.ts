// lib/services/employees-storage.ts
import { Employee, getFullName } from '../types/employee';

const STORAGE_KEY = 'employees_store';
const STORAGE_VERSION_KEY = 'employees_store_version';
const CURRENT_VERSION = 'v2';

// Migratie van oude data naar nieuwe structuur
function migrateOldData(rawData: any[]): Employee[] {
  return rawData.map((item) => {
    // Als het al het nieuwe formaat heeft
    if (item.voornaam && item.achternaam) {
      return item as Employee;
    }
    // Migreer oud formaat (name -> voornaam + achternaam)
    const parts = (item.name || '').trim().split(' ');
    const voornaam = parts[0] || 'Onbekend';
    const achternaam = parts.slice(1).join(' ') || 'Naam';
    return {
      id: item.id || `emp${Date.now()}`,
      voornaam,
      achternaam,
      email: item.email || undefined,
      telefoon: item.telefoon || item.phone || undefined,
      actief: item.actief !== undefined ? item.actief : (item.active !== undefined ? item.active : true),
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Employee;
  });
}

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp1', voornaam: 'Anna', achternaam: 'van der Berg', email: 'anna@verloskunde-arnhem.nl', telefoon: '+31 6 1234 5678', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp2', voornaam: 'Bram', achternaam: 'de Jong', email: 'bram@verloskunde-arnhem.nl', telefoon: '+31 6 2345 6789', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp3', voornaam: 'Carla', achternaam: 'Bakker', email: 'carla@verloskunde-arnhem.nl', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp4', voornaam: 'Daan', achternaam: 'van Leeuwen', telefoon: '+31 6 4567 8901', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp5', voornaam: 'Eva', achternaam: 'Vermeer', email: 'eva@verloskunde-arnhem.nl', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp6', voornaam: 'Frank', achternaam: 'Jansen', telefoon: '+31 6 5678 9012', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp7', voornaam: 'Greta', achternaam: 'van Dijk', email: 'greta@verloskunde-arnhem.nl', telefoon: '+31 6 6789 0123', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp8', voornaam: 'Hans', achternaam: 'Peters', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Employee[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEY);
  const version = localStorage.getItem(STORAGE_VERSION_KEY);

  // Geen data: initialiseer met defaults + versie
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    return DEFAULT_EMPLOYEES;
  }

  try {
    const parsed = JSON.parse(raw);

    // Forceer migratie wanneer versie mismatch of oude structuur gedetecteerd wordt
    const needsMigration = version !== CURRENT_VERSION || Array.isArray(parsed) && parsed.length > 0 && (!parsed[0].voornaam || !parsed[0].achternaam);

    if (needsMigration) {
      const migrated = migrateOldData(Array.isArray(parsed) ? parsed : []);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
      return migrated;
    }

    return parsed as Employee[];
  } catch {
    // Bij parse-fout: reset naar defaults + versie
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    return DEFAULT_EMPLOYEES;
  }
}

function save(list: Employee[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
}

export function getAllEmployees(): Employee[] { 
  return load(); 
}

export function getActiveEmployees(): Employee[] {
  return load().filter(e => e.actief);
}

export function createEmployee(data: Omit<Employee, 'id'|'created_at'|'updated_at'>): Employee {
  const list = load();
  const now = new Date().toISOString();
  if (!data.voornaam?.trim()) throw new Error('Voornaam is verplicht');
  if (!data.achternaam?.trim()) throw new Error('Achternaam is verplicht');
  const fullName = `${data.voornaam.trim()} ${data.achternaam.trim()}`;
  if (list.some(e => getFullName(e).toLowerCase() === fullName.toLowerCase())) throw new Error('Deze naam bestaat al');
  const id = `emp${Date.now()}`;
  const nieuw: Employee = { id, created_at: now, updated_at: now, voornaam: data.voornaam.trim(), achternaam: data.achternaam.trim(), email: data.email?.trim() || undefined, telefoon: data.telefoon?.trim() || undefined, actief: data.actief };
  list.push(nieuw); save(list); return nieuw;
}

export function updateEmployee(id: string, patch: Partial<Employee>): Employee {
  const list = load();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Medewerker niet gevonden');
  const now = new Date().toISOString();
  const current = list[idx];
  const updated = { ...current, ...patch, updated_at: now } as Employee;
  if (updated.voornaam && !updated.voornaam.trim()) throw new Error('Voornaam is verplicht');
  if (updated.achternaam && !updated.achternaam.trim()) throw new Error('Achternaam is verplicht');
  if (updated.voornaam && updated.achternaam) {
    const fullName = getFullName(updated);
    if (list.some(e => e.id !== id && getFullName(e).toLowerCase() === fullName.toLowerCase())) throw new Error('Deze naam bestaat al');
  }
  if (updated.email !== undefined) updated.email = updated.email?.trim() || undefined;
  if (updated.telefoon !== undefined) updated.telefoon = updated.telefoon?.trim() || undefined;
  list[idx] = updated; save(list); return updated;
}

export function canDeleteEmployee(empId: string): { canDelete: boolean; reason?: string } {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('roosters') || '[]';
    try {
      const roosters = JSON.parse(raw) as any[];
      const inUse = roosters.some(r => JSON.stringify(r).includes(`"${empId}"`) || JSON.stringify(r).includes(`:${empId}`));
      if (inUse) return { canDelete: false, reason: 'Staat in rooster' };
    } catch {}
  }
  return { canDelete: true };
}

export function removeEmployee(empId: string): void {
  const check = canDeleteEmployee(empId);
  if (!check.canDelete) throw new Error(`Kan deze medewerker niet verwijderen. ${check.reason ?? ''}`.trim());
  const list = load();
  const next = list.filter(e => e.id !== empId);
  save(next);
}
