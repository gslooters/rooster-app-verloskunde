import { 
  Employee, 
  DienstverbandType,
  TeamType,
  getFullName, 
  validateAantalWerkdagen,
  validateRoostervrijDagen,
  isValidDienstverband,
  isValidTeam,
  normalizeRoostervrijDagen,
} from '../types/employee';
import { supabase } from '../supabase';

const STORAGE_KEY = 'employees_store';
const STORAGE_VERSION_KEY = 'employees_store_version';
const MIGRATION_FLAG_KEY = 'employees_migration_v3_completed';
const CURRENT_VERSION = 'v3';
const DEFAULT_EMPLOYEES: Employee[] = [];

const USE_SUPABASE = typeof window !== 'undefined' && !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function toDatabase(emp: Employee) {
  return {
    id: emp.id,
    voornaam: emp.voornaam,
    achternaam: emp.achternaam,
    email: emp.email || null,
    telefoon: emp.telefoon || null,
    actief: emp.actief,
    dienstverband: emp.dienstverband,
    team: emp.team,
    aantalwerkdagen: emp.aantalWerkdagen,
    roostervrijdagen: emp.roostervrijDagen,
    created_at: emp.created_at,
    updated_at: emp.updated_at
  };
}

function fromDatabase(row: any): Employee {
  return {
    id: row.id,
    voornaam: row.voornaam,
    achternaam: row.achternaam,
    email: row.email || undefined,
    telefoon: row.telefoon || undefined,
    actief: row.actief,
    dienstverband: row.dienstverband,
    team: row.team,
    aantalWerkdagen: row.aantalwerkdagen,
    roostervrijDagen: row.roostervrijdagen || [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function loadFromLocalStorage(): Employee[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_EMPLOYEES;
  try {
    return JSON.parse(raw) as Employee[];
  } catch {
    return DEFAULT_EMPLOYEES;
  }
}

function saveToLocalStorage(list: Employee[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
}

let employeesCache: Employee[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000;

function getAllEmployees(): Employee[] {
  const now = Date.now();
  if (employeesCache && (now - lastFetchTime) < CACHE_DURATION) {
    return employeesCache;
  }
  if (USE_SUPABASE) {
    loadFromSupabaseAsync().then(data => {
      if (data && data.length > 0) {
        employeesCache = data;
        lastFetchTime = Date.now();
        saveToLocalStorage(data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('employees-updated'));
        }
      }
    }).catch(err => {
      console.error('❌ Supabase load failed:', err);
    });
  }
  const localData = loadFromLocalStorage();
  if (localData.length === 0 && USE_SUPABASE) {
    const syncData = loadFromSupabaseSync();
    if (syncData.length > 0) {
      employeesCache = syncData;
      saveToLocalStorage(syncData);
      return syncData;
    }
  }
  employeesCache = localData;
  return localData;
}

function loadFromSupabaseSync(): Employee[] {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/employees?select=*&order=achternaam.asc`;
    const headers = {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    };
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.setRequestHeader('apikey', headers.apikey);
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.send();
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      return data.map(fromDatabase);
    }
  } catch (error) {
    console.error('❌ Sync Supabase load failed:', error);
  }
  return [];
}

async function loadFromSupabaseAsync(): Promise<Employee[]> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('achternaam', { ascending: true });
    if (error) throw error;
    return data.map(fromDatabase);
  } catch (error) {
    console.error('❌ Async Supabase load failed:', error);
    return [];
  }
}

async function saveToSupabase(list: Employee[]): Promise<void> {
  if (!USE_SUPABASE) return;
  try {
    const dbRecords = list.map(toDatabase);
    const { error } = await supabase
      .from('employees')
      .upsert(dbRecords, { onConflict: 'id' });
    if (error) throw error;
  } catch (error) {
    console.error('❌ Supabase save failed:', error);
    throw error;
  }
}

/**
 * NIEUWE FUNCTIE: Expliciete DELETE operatie in Supabase
 * Fix voor het probleem dat UPSERT geen records verwijdert
 */
async function deleteFromSupabase(empId: string): Promise<void> {
  if (!USE_SUPABASE) return;
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', empId);
    
    if (error) throw error;
    console.log(`✅ Medewerker ${empId} succesvol verwijderd uit Supabase`);
  } catch (error) {
    console.error('❌ Supabase delete failed:', error);
    throw error;
  }
}

function validateEmployeeData(data: Partial<Employee>, isUpdate = false): void {
  if (!isUpdate || data.voornaam !== undefined) {
    if (!data.voornaam?.trim()) throw new Error('Voornaam is verplicht');
  }
  if (!isUpdate || data.achternaam !== undefined) {
    if (!data.achternaam?.trim()) throw new Error('Achternaam is verplicht');
  }
  if (!isUpdate || data.dienstverband !== undefined) {
    if (!data.dienstverband || !isValidDienstverband(data.dienstverband)) {
      throw new Error('Geldig dienstverband is verplicht');
    }
  }
  if (!isUpdate || data.team !== undefined) {
    if (!data.team || !isValidTeam(data.team)) {
      throw new Error('Geldig team is verplicht');
    }
  }
  if (!isUpdate || data.aantalWerkdagen !== undefined) {
    if (data.aantalWerkdagen === undefined || !validateAantalWerkdagen(data.aantalWerkdagen)) {
      throw new Error('Aantal werkdagen moet tussen 0 en 35 zijn');
    }
  }
  if (data.roostervrijDagen !== undefined) {
    if (!Array.isArray(data.roostervrijDagen) || !validateRoostervrijDagen(data.roostervrijDagen)) {
      throw new Error('Roostervrije dagen moeten geldig zijn');
    }
  }
}

function getActiveEmployees(): Employee[] { return getAllEmployees().filter(e => e.actief); }

function createEmployee(
  data: Omit<Employee, 'id'|'created_at'|'updated_at'>
): Employee {
  const list = getAllEmployees();
  const now = new Date().toISOString();
  validateEmployeeData(data);
  const fullName = `${data.voornaam.trim()} ${data.achternaam.trim()}`;
  if (list.some(e => getFullName(e).toLowerCase() === fullName.toLowerCase())) {
    throw new Error('Deze naam bestaat al');
  }
  const id = `emp${Date.now()}`;
  const nieuw: Employee = {
    id,
    created_at: now,
    updated_at: now,
    voornaam: data.voornaam.trim(),
    achternaam: data.achternaam.trim(),
    email: data.email?.trim() || undefined,
    telefoon: data.telefoon?.trim() || undefined,
    actief: data.actief,
    dienstverband: data.dienstverband,
    team: data.team,
    aantalWerkdagen: data.aantalWerkdagen,
    roostervrijDagen: normalizeRoostervrijDagen(data.roostervrijDagen)
  };
  list.push(nieuw);
  saveToLocalStorage(list);
  employeesCache = list;
  if (USE_SUPABASE) {
    saveToSupabase(list).catch(err =>
      console.error('Background Supabase save failed:', err)
    );
  }
  return nieuw;
}

function updateEmployee(id: string, patch: Partial<Employee>): Employee {
  const list = getAllEmployees();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Medewerker niet gevonden');
  const now = new Date().toISOString();
  const current = list[idx];
  if (patch.roostervrijDagen !== undefined) {
    patch.roostervrijDagen = normalizeRoostervrijDagen(patch.roostervrijDagen);
  }
  const updated = { ...current, ...patch, updated_at: now } as Employee;
  validateEmployeeData(updated, true);
  if ((patch.voornaam || patch.achternaam)) {
    const fullName = getFullName(updated);
    if (list.some(e => e.id !== id && getFullName(e).toLowerCase() === fullName.toLowerCase())) {
      throw new Error('Deze naam bestaat al');
    }
  }
  list[idx] = updated;
  saveToLocalStorage(list);
  employeesCache = list;
  if (USE_SUPABASE) {
    saveToSupabase(list).catch(err =>
      console.error('Background Supabase save failed:', err)
    );
  }
  return updated;
}

/**
 * AANGEPASTE FUNCTIE: Nu met expliciete DELETE in Supabase
 * 
 * Workflow:
 * 1. Verwijder eerst uit Supabase (indien actief)
 * 2. Update lokale cache
 * 3. Update localStorage
 * 
 * Dit voorkomt dat verwijderde medewerkers terugkomen bij refresh
 */
function removeEmployee(empId: string): void {
  const list = getAllEmployees();
  const employee = list.find(e => e.id === empId);
  
  if (!employee) {
    console.warn(`⚠️ Medewerker ${empId} niet gevonden in cache`);
    return;
  }
  
  // Filter de medewerker uit de lijst
  const next = list.filter(e => e.id !== empId);
  
  // Update lokale storage en cache
  saveToLocalStorage(next);
  employeesCache = next;
  
  // Verwijder uit Supabase database
  if (USE_SUPABASE) {
    deleteFromSupabase(empId)
      .then(() => {
        console.log(`✅ Medewerker ${getFullName(employee)} succesvol verwijderd`);
        // Trigger een refresh event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('employees-updated'));
        }
      })
      .catch(err => {
        console.error('❌ Supabase delete failed:', err);
        // Bij falen: probeer alsnog de lijst te synchroniseren
        saveToSupabase(next).catch(syncErr => 
          console.error('❌ Fallback sync failed:', syncErr)
        );
      });
  }
}

function canDeleteEmployee(empId: string): { canDelete: boolean; reason?: string } {
  return { canDelete: true };
}

async function refreshFromSupabase(): Promise<void> {
  if (!USE_SUPABASE) return;
  const data = await loadFromSupabaseAsync();
  if (data.length > 0) {
    employeesCache = data;
    lastFetchTime = Date.now();
    saveToLocalStorage(data);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('employees-updated'));
    }
  }
}

function getMigrationStats() {
  const employees = getAllEmployees();
  const migrationCompleted = typeof window !== 'undefined' && localStorage.getItem('employees_migration_v3_completed') === 'true';
  return {
    total: employees.length,
    maat: employees.filter(e => e.dienstverband === DienstverbandType.MAAT).length,
    loondienst: employees.filter(e => e.dienstverband === DienstverbandType.LOONDIENST).length,
    zzp: employees.filter(e => e.dienstverband === DienstverbandType.ZZP).length,
    groen: employees.filter(e => e.team === TeamType.GROEN).length,
    oranje: employees.filter(e => e.team === TeamType.ORANJE).length,
    overig: employees.filter(e => e.team === TeamType.OVERIG).length,
    migrationCompleted,
    usingSupabase: USE_SUPABASE
  };
}

function resetMigrationFlag() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('employees_migration_v3_completed');
  }
}

function getStorageInfo() {
  return {
    useSupabase: USE_SUPABASE,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}

export {
  getAllEmployees,
  getActiveEmployees,
  createEmployee,
  updateEmployee,
  canDeleteEmployee,
  removeEmployee,
  refreshFromSupabase,
  getMigrationStats,
  resetMigrationFlag,
  getStorageInfo
};
