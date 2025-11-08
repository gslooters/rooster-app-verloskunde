// lib/services/employees-storage.ts
// HYBRID VERSION: Supabase + LocalStorage backward compatibility
import { supabase } from '../supabase';
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

// ============================================
// CONFIGURATION
// ============================================
const USE_SUPABASE = typeof window !== 'undefined' && 
                     process.env.NEXT_PUBLIC_SUPABASE_URL && 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const STORAGE_KEY = 'employees_store';
const STORAGE_VERSION_KEY = 'employees_store_version';
const MIGRATION_FLAG_KEY = 'employees_migration_v3_completed';
const CURRENT_VERSION = 'v3';

// ============================================
// SUPABASE OPERATIONS (NEW - ASYNC)
// ============================================

export async function getAllEmployeesAsync(): Promise<Employee[]> {
  if (!USE_SUPABASE) {
    console.warn('Supabase not configured, using LocalStorage fallback');
    return getAllEmployees();
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('achternaam', { ascending: true });
    
    if (error) {
      console.error('Supabase error, falling back to LocalStorage:', error);
      return getAllEmployees();
    }
    
    return data || [];
  } catch (err) {
    console.error('Supabase exception, falling back to LocalStorage:', err);
    return getAllEmployees();
  }
}

export async function getActiveEmployeesAsync(): Promise<Employee[]> {
  if (!USE_SUPABASE) {
    return getActiveEmployees();
  }

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('actief', true)
      .order('achternaam', { ascending: true });
    
    if (error) {
      console.error('Supabase error:', error);
      return getActiveEmployees();
    }
    
    return data || [];
  } catch (err) {
    console.error('Supabase exception:', err);
    return getActiveEmployees();
  }
}

export async function createEmployeeAsync(data: Omit<Employee, 'id'|'created_at'|'updated_at'>): Promise<Employee> {
  validateEmployeeData(data);
  
  if (!USE_SUPABASE) {
    return createEmployee(data);
  }

  try {
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .ilike('voornaam', data.voornaam.trim())
      .ilike('achternaam', data.achternaam.trim())
      .limit(1);
    
    if (existing && existing.length > 0) {
      throw new Error('Deze naam bestaat al');
    }
    
    const id = `emp${Date.now()}`;
    const nieuw: any = {
      id,
      voornaam: data.voornaam.trim(),
      achternaam: data.achternaam.trim(),
      email: data.email?.trim() || null,
      telefoon: data.telefoon?.trim() || null,
      actief: data.actief,
      dienstverband: data.dienstverband,
      team: data.team,
      aantalWerkdagen: data.aantalWerkdagen,
      roostervrijDagen: normalizeRoostervrijDagen(data.roostervrijDagen),
    };
    
    const { data: inserted, error } = await supabase
      .from('employees')
      .insert([nieuw])
      .select()
      .single();
    
    if (error) throw new Error(`Supabase error: ${error.message}`);
    
    return inserted!;
  } catch (err: any) {
    console.error('Supabase create failed, using LocalStorage:', err);
    return createEmployee(data);
  }
}

export async function updateEmployeeAsync(id: string, patch: Partial<Employee>): Promise<Employee> {
  if (!USE_SUPABASE) {
    return updateEmployee(id, patch);
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !current) {
      throw new Error('Medewerker niet gevonden');
    }
    
    if (patch.roostervrijDagen !== undefined) {
      patch.roostervrijDagen = normalizeRoostervrijDagen(patch.roostervrijDagen);
    }
    
    const updated = { ...current, ...patch };
    validateEmployeeData(updated, true);
    
    if (patch.voornaam || patch.achternaam) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .neq('id', id)
        .ilike('voornaam', updated.voornaam)
        .ilike('achternaam', updated.achternaam)
        .limit(1);
      
      if (existing && existing.length > 0) {
        throw new Error('Deze naam bestaat al');
      }
    }
    
    if (updated.email !== undefined) updated.email = updated.email?.trim() || null;
    if (updated.telefoon !== undefined) updated.telefoon = updated.telefoon?.trim() || null;
    
    const { data: result, error } = await supabase
      .from('employees')
      .update(updated)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Supabase error: ${error.message}`);
    
    return result!;
  } catch (err: any) {
    console.error('Supabase update failed, using LocalStorage:', err);
    return updateEmployee(id, patch);
  }
}

export async function removeEmployeeAsync(empId: string): Promise<void> {
  if (!USE_SUPABASE) {
    return removeEmployee(empId);
  }

  try {
    const check = await canDeleteEmployeeAsync(empId);
    if (!check.canDelete) {
      throw new Error(`Kan deze medewerker niet verwijderen. ${check.reason ?? ''}`.trim());
    }
    
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', empId);
    
    if (error) throw new Error(`Supabase error: ${error.message}`);
  } catch (err: any) {
    console.error('Supabase delete failed, using LocalStorage:', err);
    return removeEmployee(empId);
  }
}

export async function canDeleteEmployeeAsync(empId: string): Promise<{ canDelete: boolean; reason?: string }> {
  if (!USE_SUPABASE) {
    return canDeleteEmployee(empId);
  }

  try {
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('id')
      .eq('employee_id', empId)
      .limit(1);
    
    if (error) {
      console.error('Error checking employee usage:', error);
      return { canDelete: false, reason: 'Kan gebruik niet controleren' };
    }
    
    if (schedules && schedules.length > 0) {
      return { canDelete: false, reason: 'Staat in rooster' };
    }
    
    return { canDelete: true };
  } catch (err) {
    console.error('Supabase check failed:', err);
    return canDeleteEmployee(empId);
  }
}

// ============================================
// LOCALSTORAGE OPERATIONS (LEGACY - SYNC)
// ============================================

function performIntelligentMigration(employees: Employee[]): Employee[] {
  const sortedEmployees = employees.sort((a, b) => a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase()));
  const totalCount = sortedEmployees.length;
  const maatCount = Math.round(totalCount * 0.6);
  const overigIndex = 0;
  const maatEmployees = sortedEmployees.slice(0, maatCount);
  const loondienstEmployees = sortedEmployees.slice(maatCount);
  const maatGroenCount = Math.floor(maatEmployees.length / 2);
  const loondienstGroenCount = Math.floor(loondienstEmployees.length / 2);
  
  return sortedEmployees.map((employee, index) => {
    const dienstverband = index < maatCount ? DienstverbandType.MAAT : DienstverbandType.LOONDIENST;
    let team: TeamType;
    if (index === overigIndex) team = TeamType.OVERIG;
    else if (index < maatCount) team = index < maatGroenCount ? TeamType.GROEN : TeamType.ORANJE;
    else { const li = index - maatCount; team = li < loondienstGroenCount ? TeamType.GROEN : TeamType.ORANJE; }
    return { ...employee, dienstverband, team, aantalWerkdagen: 24, roostervrijDagen: [] };
  });
}

function migrateOldData(rawData: any[]): Employee[] {
  const employees = rawData.map((item) => {
    if (hasNewFields(item)) return item as Employee;
    if (item.voornaam && item.achternaam) return upgradeLegacyEmployee(item as LegacyEmployee);
    const parts = (item.name || '').trim().split(' ');
    const voornaam = parts[0] || 'Onbekend';
    const achternaam = parts.slice(1).join(' ') || 'Naam';
    const legacyEmployee: LegacyEmployee = { 
      id: item.id || `emp${Date.now()}`, voornaam, achternaam, 
      email: item.email || undefined, telefoon: item.telefoon || item.phone || undefined, 
      actief: item.actief !== undefined ? item.actief : (item.active !== undefined ? item.active : true), 
      created_at: item.created_at || new Date().toISOString(), updated_at: new Date().toISOString() 
    };
    return upgradeLegacyEmployee(legacyEmployee);
  });
  
  const migrationCompleted = typeof window !== 'undefined' && localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  if (!migrationCompleted && employees.length > 0) {
    const needsIntelligentMigration = employees.some(emp => 
      emp.dienstverband === DienstverbandType.LOONDIENST && 
      emp.team === TeamType.OVERIG && 
      emp.aantalWerkdagen === 24
    );
    if (needsIntelligentMigration) {
      const migrated = performIntelligentMigration(employees);
      if (typeof window !== 'undefined') localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return migrated;
    }
  }
  return employees;
}

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp1', voornaam: 'Anna', achternaam: 'van der Berg', email: 'anna@verloskunde-arnhem.nl', telefoon: '+31 6 1234 5678', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: ['zo'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp2', voornaam: 'Bram', achternaam: 'de Jong', email: 'bram@verloskunde-arnhem.nl', telefoon: '+31 6 2345 6789', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: ['ma', 'za'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Employee[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEY);
  const version = localStorage.getItem(STORAGE_VERSION_KEY);
  if (!raw) { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES)); 
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION); 
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true'); 
    return DEFAULT_EMPLOYEES; 
  }
  try {
    const parsed = JSON.parse(raw);
    const needsMigration = version !== CURRENT_VERSION || (Array.isArray(parsed) && parsed.length > 0 && !hasNewFields(parsed[0]));
    if (needsMigration) { 
      const migrated = migrateOldData(Array.isArray(parsed) ? parsed : []); 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); 
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION); 
      return migrated; 
    }
    return parsed as Employee[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES)); 
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION); 
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true'); 
    return DEFAULT_EMPLOYEES;
  }
}

function save(list: Employee[]) { 
  if (typeof window === 'undefined') return; 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); 
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION); 
}

function validateEmployeeData(data: Partial<Employee>, isUpdate = false): void {
  if (!isUpdate || data.voornaam !== undefined) { if (!data.voornaam?.trim()) throw new Error('Voornaam is verplicht'); }
  if (!isUpdate || data.achternaam !== undefined) { if (!data.achternaam?.trim()) throw new Error('Achternaam is verplicht'); }
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
// BACKWARD COMPATIBLE API (SYNC)
// ============================================

export function getAllEmployees(): Employee[] { 
  if (USE_SUPABASE) {
    console.warn('⚠️  Using legacy sync API - consider migrating to getAllEmployeesAsync()');
  }
  return load(); 
}

export function getActiveEmployees(): Employee[] { 
  if (USE_SUPABASE) {
    console.warn('⚠️  Using legacy sync API - consider migrating to getActiveEmployeesAsync()');
  }
  return load().filter(e => e.actief); 
}

export function createEmployee(data: Omit<Employee, 'id'|'created_at'|'updated_at'>): Employee {
  const list = load();
  const now = new Date().toISOString();
  validateEmployeeData(data);
  const fullName = `${data.voornaam.trim()} ${data.achternaam.trim()}`;
  if (list.some(e => getFullName(e).toLowerCase() === fullName.toLowerCase())) { 
    throw new Error('Deze naam bestaat al'); 
  }
  const id = `emp${Date.now()}`;
  const nieuw: Employee = { 
    id, created_at: now, updated_at: now, 
    voornaam: data.voornaam.trim(), achternaam: data.achternaam.trim(), 
    email: data.email?.trim() || undefined, telefoon: data.telefoon?.trim() || undefined, 
    actief: data.actief, dienstverband: data.dienstverband, team: data.team, 
    aantalWerkdagen: data.aantalWerkdagen, 
    roostervrijDagen: normalizeRoostervrijDagen(data.roostervrijDagen) 
  };
  list.push(nieuw); save(list); return nieuw;
}

export function updateEmployee(id: string, patch: Partial<Employee>): Employee {
  const list = load();
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
  if (updated.email !== undefined) { updated.email = updated.email?.trim() || undefined; }
  if (updated.telefoon !== undefined) { updated.telefoon = updated.telefoon?.trim() || undefined; }
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
  if (!check.canDelete) { 
    throw new Error(`Kan deze medewerker niet verwijderen. ${check.reason ?? ''}`.trim()); 
  }
  const list = load();
  const next = list.filter(e => e.id !== empId);
  save(next);
}

export function getMigrationStats(): { 
  total: number; maat: number; loondienst: number; zzp: number; 
  groen: number; oranje: number; overig: number; migrationCompleted: boolean; 
} {
  const employees = getAllEmployees();
  const migrationCompleted = typeof window !== 'undefined' && localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  return { 
    total: employees.length, 
    maat: employees.filter(e => e.dienstverband === DienstverbandType.MAAT).length, 
    loondienst: employees.filter(e => e.dienstverband === DienstverbandType.LOONDIENST).length, 
    zzp: employees.filter(e => e.dienstverband === DienstverbandType.ZZP).length, 
    groen
