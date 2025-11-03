// lib/services/employees-storage.ts
import { Employee } from '../types/employee';

const STORAGE_KEY = 'employees_store';

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp1', name: 'Anna', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp2', name: 'Bram', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp3', name: 'Carla', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp4', name: 'Daan', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp5', name: 'Eva', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp6', name: 'Frank', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp7', name: 'Greta', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp8', name: 'Hans', actief: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Employee[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
    return DEFAULT_EMPLOYEES;
  }
  try { return JSON.parse(raw) as Employee[]; } catch { return DEFAULT_EMPLOYEES; }
}

function save(list: Employee[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllEmployees(): Employee[] { return load(); }

export function getActiveEmployees(): Employee[] {
  return load().filter(e => e.actief);
}

export function createEmployee(data: Omit<Employee, 'id'|'created_at'|'updated_at'>): Employee {
  const list = load();
  const now = new Date().toISOString();
  if (!data.name?.trim()) throw new Error('Naam is verplicht');
  if (list.some(e => e.name.toLowerCase() === data.name.toLowerCase())) throw new Error('Naam moet uniek zijn');
  const id = `emp${Date.now()}`;
  const nieuw: Employee = { id, created_at: now, updated_at: now, ...data };
  list.push(nieuw); save(list); return nieuw;
}

export function updateEmployee(id: string, patch: Partial<Employee>): Employee {
  const list = load();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Medewerker niet gevonden');
  const now = new Date().toISOString();
  const current = list[idx];
  const updated = { ...current, ...patch, updated_at: now } as Employee;
  if (updated.name && list.some(e => e.id !== id && e.name.toLowerCase() === updated.name.toLowerCase())) {
    throw new Error('Naam moet uniek zijn');
  }
  list[idx] = updated; save(list); return updated;
}

export function canDeleteEmployee(empId: string): { canDelete: boolean; reason?: string } {
  // Check if employee is used in any roosters (mock check)
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
