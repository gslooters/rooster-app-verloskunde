// lib/services/employees-storage.ts
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
const CURRENT_VERSION = 'v3';
const DEFAULT_EMPLOYEES: Employee[] = [];

// Check if we're in browser AND have Supabase configured
const USE_SUPABASE = typeof window !== 'undefined' && !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================
// DATABASE HELPERS
// ============================================
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
    aantal_werkdagen: emp.aantalWerkdagen,
    roostervrij_dagen: emp.roostervrijDagen,
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
    aantalWerkdagen: row.aantal_werkdagen,
    roostervrijDagen: row.roostervrij_dagen || [],
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ============================================
// SYNC STORAGE (LocalStorage only)
// ============================================
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

// ============================================
// MAIN LOAD FUNCTION (TRIES SUPABASE FIRST!)
// ============================================
let employeesCache: Employee[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

export function getAllEmployees(): Employee[] {
  // If we have recent cache, use it
  const now = Date.now();
  if (employeesCache && (now - lastFetchTime) < CACHE_DURATION) {
    return employeesCache;
  }

  // Try to load from Supabase (async in background)
  if (USE_SUPABASE) {
    console.log('🔄 Initiating Supabase load...');
    
    // Start async load (don't wait)
    loadFromSupabaseAsync().then(data => {
      if (data && data.length > 0) {
        employeesCache = data;
        lastFetchTime = Date.now();
        saveToLocalStorage(data); // Sync to localStorage
        
        // Trigger re-render if data changed
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('employees-updated'));
        }
      }
    }).catch(err => {
      console.error('❌ Supabase load failed:', err);
    });
  }

  // Return LocalStorage immediately (will be updated by async call)
  const localData = loadFromLocalStorage();
  
  // If LocalStorage is empty and Supabase is enabled, try ONE sync load
  if (localData.length === 0 && USE_SUPABASE) {
    console.log('⚠️ LocalStorage empty, trying sync Supabase load...');
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

// Sync Supabase load (blocks until data arrives)
function loadFromSupabaseSync(): Employee[] {
  // This is a HACK - using fetch synchronously
  // Only used on first load when LocalStorage is empty
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/employees?select=*&order=achternaam.asc`;
    const headers = {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    };
    
    // Use XMLHttpRequest for synchronous request (only for initial load)
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // false = synchronous
    xhr.setRequestHeader('apikey', headers.apikey);
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.send();
    
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      console.log(`✅ Sync loaded ${data.length} employees from Supabase`);
      return data.map(fromDatabase);
    }
  } catch (error) {
    console.error('❌ Sync Supabase load failed:', error);
  }
  
  return [];
}

// Async Supabase load (non-blocking)
async function loadFromSupabaseAsync(): Promise<Employee[]> {
  try {
    console.log('🔄 Loading employees from Supabase (async)...');
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('achternaam', { ascending: true });
    
    if (error) throw error;
    
    const employees = data.map(fromDatabase);
    console.log(`✅ Loaded ${employees.length} employees from Supabase`);
    return employees;
  } catch (error) {
    console.error('❌ Async Supabase load failed:', error);
    return [];
  }
}

// ============================================
// SAVE FUNCTION (Supabase + LocalStorage)
// ============================================
async function saveToSupabase(list: Employee[]): Promise<void> {
  if (!USE_SUPABASE) return;
  
  try {
    console.log(`🔄 Saving ${list.length} employees to Supabase...`);
    const dbRecords = list.map(toDatabase);
    
    const { error } = await supabase
      .from('employees')
      .upsert(dbRecords, { onConflict: 'id' });
    
    if (error) throw error;
    
    console.log('✅ Saved to Supabase successfully');
  } catch (error) {
    console.error('❌ Supabase save failed:', error);
    throw error;
  }
}

// ============================================
// VALIDATION
// ============================================
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

// ============================================
// PUBLIC API
// ============================================
export function getActiveEmployees(): Employee[] { 
  return getAllEmployees().filter(e => e.actief); 
}

export function createEmployee(
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
  
  // Save to LocalStorage immediately
  saveToLocalStorage(list);
  employeesCache = list;
  
  // Save to Supabase async (don't block UI)
  if (USE_SUPABASE) {
    saveToSupabase(list).catch(err => 
      console.error('Background Supabase save failed:', err)
    );
  }
  
  return nieuw;
}

export function updateEmployee(id: string, patch: Partial<Employee>): Employee {
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

export function removeEmployee(empId: string): void {
  const list = getAllEmployees();
  const next = list.filter(e => e.id !== empId);
  
  saveToLocalStorage(next);
  employeesCache = next;
  
  if (USE_SUPABASE) {
    saveToSupabase(next).catch(err => 
      console.error('Background Supabase save failed:', err)
    );
  }
}

export function canDeleteEmployee(empId: string): { canDelete: boolean; reason?: string } {
  return { canDelete: true };
}

// Force refresh from Supabase
export async function refreshFromSupabase(): Promise<void> {
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
