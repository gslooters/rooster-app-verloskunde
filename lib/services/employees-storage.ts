// lib/services/employees-storage.ts
import { 
  Employee, 
  LegacyEmployee,
  DienstverbandType,
  TeamType,
  getFullName, 
  validateAantalWerkdagen,
  validateRoostervrijDagen,
  isValidDienstverband,
  isValidTeam,
  normalizeRoostervrijDagen,
  upgradeLegacyEmployee,
  hasNewFields
} from '../types/employee';
import { supabase } from '../supabase';

// ============================================
// CONFIGURATION
// ============================================
const STORAGE_KEY = 'employees_store';
const STORAGE_VERSION_KEY = 'employees_store_version';
const MIGRATION_FLAG_KEY = 'employees_migration_v3_completed';
const CURRENT_VERSION = 'v3';
const DEFAULT_EMPLOYEES: Employee[] = [];

// Check if Supabase is configured
const USE_SUPABASE = !!(
  typeof window !== 'undefined' &&
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
// CORE STORAGE FUNCTIONS
// ============================================
async function load(): Promise<Employee[]> {
  // Try Supabase first
  if (USE_SUPABASE) {
    try {
      console.log('🔄 Loading employees from Supabase...');
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('achternaam', { ascending: true });
      
      if (error) throw error;
      
      const employees = data.map(fromDatabase);
      console.log(`✅ Loaded ${employees.length} employees from Supabase`);
      
      // Sync to localStorage as backup
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
      }
      
      return employees;
    } catch (error) {
      console.error('❌ Supabase load failed, falling back to LocalStorage:', error);
    }
  }
  
  // Fallback to LocalStorage
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_EMPLOYEES;
  
  try {
    const parsed = JSON.parse(raw);
    console.log(`📦 Loaded ${parsed.length} employees from LocalStorage`);
    return parsed as Employee[];
  } catch {
    return DEFAULT_EMPLOYEES;
  }
}

async function save(list: Employee[]): Promise<void> {
  // Try Supabase first
  if (USE_SUPABASE) {
    try {
      console.log(`🔄 Saving ${list.length} employees to Supabase...`);
      const dbRecords = list.map(toDatabase);
      
      // Upsert all records
      const { error } = await supabase
        .from('employees')
        .upsert(dbRecords, { onConflict: 'id' });
      
      if (error) throw error;
      
      console.log('✅ Saved to Supabase successfully');
      
      // Also save to localStorage as backup
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
      }
      
      return;
    } catch (error) {
      console.error('❌ Supabase save failed, falling back to LocalStorage:', error);
    }
  }
  
  // Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    console.log('📦 Saved to LocalStorage');
  }
}

// ============================================
// MIGRATION & VALIDATION (behouden zoals was)
// ============================================
function performIntelligentMigration(employees: Employee[]): Employee[] {
  const sortedEmployees = employees.sort((a, b) => 
    a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase())
  );
  const totalCount = sortedEmployees.length;
  const maatCount = Math.round(totalCount * 0.6);
  
  return sortedEmployees.map((employee, index) => {
    const dienstverband = index < maatCount ? DienstverbandType.MAAT : DienstverbandType.LOONDIENST;
    const team = index === 0 ? TeamType.OVERIG : 
                 index < maatCount ? 
                   (index < Math.floor(maatCount / 2) ? TeamType.GROEN : TeamType.ORANJE) :
                   ((index - maatCount) < Math.floor((totalCount - maatCount) / 2) ? TeamType.GROEN : TeamType.ORANJE);
    
    return { ...employee, dienstverband, team, aantalWerkdagen: 24, roostervrijDagen: [] };
  });
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
      throw new Error('Geldig dienstverband is verplicht (Maat, Loondienst, ZZP)'); 
    } 
  }
  if (!isUpdate || data.team !== undefined) { 
    if (!data.team || !isValidTeam(data.team)) { 
      throw new Error('Geldig team is verplicht (Groen, Oranje, Overig)'); 
    } 
  }
  if (!isUpdate || data.aantalWerkdagen !== undefined) { 
    if (data.aantalWerkdagen === undefined || !validateAantalWerkdagen(data.aantalWerkdagen)) { 
      throw new Error('Aantal werkdagen moet een geheel getal tussen 0 en 35 zijn'); 
    } 
  }
  if (data.roostervrijDagen !== undefined) { 
    if (!Array.isArray(data.roostervrijDagen) || !validateRoostervrijDagen(data.roostervrijDagen)) { 
      throw new Error('Roostervrije dagen moeten geldige dagcodes zijn (ma, di, wo, do, vr, za, zo)'); 
    } 
  }
}

// ============================================
// PUBLIC API (now async!)
// ============================================
export async function getAllEmployees(): Promise<Employee[]> { 
  return await load(); 
}

export async function getActiveEmployees(): Promise<Employee[]> { 
  const all = await load();
  return all.filter(e => e.actief); 
}

export async function createEmployee(
  data: Omit<Employee, 'id'|'created_at'|'updated_at'>
): Promise<Employee> {
  const list = await load();
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
  await save(list); 
  return nieuw;
}

export async function updateEmployee(
  id: string, 
  patch: Partial<Employee>
): Promise<Employee> {
  const list = await load();
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
  
  if (updated.email !== undefined) updated.email = updated.email?.trim() || undefined;
  if (updated.telefoon !== undefined) updated.telefoon = updated.telefoon?.trim() || undefined;
  
  list[idx] = updated; 
  await save(list); 
  return updated;
}

export async function removeEmployee(empId: string): Promise<void> {
  const list = await load();
  const next = list.filter(e => e.id !== empId);
  await save(next);
}

export function canDeleteEmployee(empId: string): { canDelete: boolean; reason?: string } {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('roosters') || '[]';
    try {
      const roosters = JSON.parse(raw) as any[];
      const inUse = roosters.some(r => 
        JSON.stringify(r).includes(`"${empId}"`) || JSON.stringify(r).includes(`:${empId}`)
      );
      if (inUse) return { canDelete: false, reason: 'Staat in rooster' };
    } catch (e) {
      console.error('Error checking roster usage:', e);
    }
  }
  return { canDelete: true };
}

export async function getMigrationStats() {
  const employees = await getAllEmployees();
  const migrationCompleted = typeof window !== 'undefined' && 
    localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  
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

export function resetMigrationFlag(): void { 
  if (typeof window !== 'undefined') { 
    localStorage.removeItem(MIGRATION_FLAG_KEY); 
  } 
}

// ============================================
// DEBUG HELPER
// ============================================
export function getStorageInfo() {
  return {
    useSupabase: USE_SUPABASE,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };
}
