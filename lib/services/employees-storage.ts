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

const STORAGE_KEY = 'employees_store';
const STORAGE_VERSION_KEY = 'employees_store_version';
const MIGRATION_FLAG_KEY = 'employees_migration_v3_completed';
const CURRENT_VERSION = 'v3'; // Verhoogd voor nieuwe velden

// Intelligente migratie algoritme voor nieuwe velden
function performIntelligentMigration(employees: Employee[]): Employee[] {
  // Sorteer alfabetisch op achternaam (case-insensitive)
  const sortedEmployees = employees.sort((a, b) => 
    a.achternaam.toLowerCase().localeCompare(b.achternaam.toLowerCase())
  );
  
  const totalCount = sortedEmployees.length;
  
  // Bereken verdeling voor dienstverband (60% Maat, 40% Loondienst)
  const maatCount = Math.round(totalCount * 0.6);
  
  // Bereken team verdeling
  const overigIndex = 0; // Eerste medewerker krijgt Overig
  const maatEmployees = sortedEmployees.slice(0, maatCount);
  const loondienstEmployees = sortedEmployees.slice(maatCount);
  
  // Verdeel Maat employees over Groen/Oranje (50/50)
  const maatGroenCount = Math.floor(maatEmployees.length / 2);
  
  // Verdeel Loondienst employees over Groen/Oranje (50/50)
  const loondienstGroenCount = Math.floor(loondienstEmployees.length / 2);
  
  const result = sortedEmployees.map((employee, index) => {
    // Dienstverband toewijzing
    const dienstverband = index < maatCount ? DienstverbandType.MAAT : DienstverbandType.LOONDIENST;
    
    // Team toewijzing
    let team: TeamType;
    if (index === overigIndex) {
      team = TeamType.OVERIG;
    } else if (index < maatCount) {
      // Maat employee - verdeel over Groen/Oranje
      const maatIndex = index;
      team = maatIndex < maatGroenCount ? TeamType.GROEN : TeamType.ORANJE;
    } else {
      // Loondienst employee - verdeel over Groen/Oranje
      const loondienstIndex = index - maatCount;
      team = loondienstIndex < loondienstGroenCount ? TeamType.GROEN : TeamType.ORANJE;
    }
    
    return {
      ...employee,
      dienstverband,
      team,
      aantalWerkdagen: 24,
      roostervrijDagen: []
    };
  });
  
  console.log('Migration completed:', {
    total: totalCount,
    maat: result.filter(e => e.dienstverband === DienstverbandType.MAAT).length,
    loondienst: result.filter(e => e.dienstverband === DienstverbandType.LOONDIENST).length,
    groen: result.filter(e => e.team === TeamType.GROEN).length,
    oranje: result.filter(e => e.team === TeamType.ORANJE).length,
    overig: result.filter(e => e.team === TeamType.OVERIG).length
  });
  
  return result;
}

// Migratie van oude data naar nieuwe structuur
function migrateOldData(rawData: any[]): Employee[] {
  const employees = rawData.map((item) => {
    // Als het al het nieuwe formaat heeft (v3)
    if (hasNewFields(item)) {
      return item as Employee;
    }
    
    // Als het v2 formaat heeft (voornaam/achternaam maar geen nieuwe velden)
    if (item.voornaam && item.achternaam) {
      return upgradeLegacyEmployee(item as LegacyEmployee);
    }
    
    // Migreer v1 formaat (name -> voornaam + achternaam)
    const parts = (item.name || '').trim().split(' ');
    const voornaam = parts[0] || 'Onbekend';
    const achternaam = parts.slice(1).join(' ') || 'Naam';
    
    const legacyEmployee: LegacyEmployee = {
      id: item.id || `emp${Date.now()}`,
      voornaam,
      achternaam,
      email: item.email || undefined,
      telefoon: item.telefoon || item.phone || undefined,
      actief: item.actief !== undefined ? item.actief : (item.active !== undefined ? item.active : true),
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return upgradeLegacyEmployee(legacyEmployee);
  });
  
  // Check of intelligente migratie al is uitgevoerd
  const migrationCompleted = typeof window !== 'undefined' && 
    localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  
  if (!migrationCompleted && employees.length > 0) {
    // Voer intelligente migratie uit alleen als er nog geen nieuwe velden zijn
    const needsIntelligentMigration = employees.some(emp => 
      emp.dienstverband === DienstverbandType.LOONDIENST && 
      emp.team === TeamType.OVERIG &&
      emp.aantalWerkdagen === 24
    );
    
    if (needsIntelligentMigration) {
      const migratedEmployees = performIntelligentMigration(employees);
      if (typeof window !== 'undefined') {
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      }
      return migratedEmployees;
    }
  }
  
  return employees;
}

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp1', voornaam: 'Anna', achternaam: 'van der Berg', email: 'anna@verloskunde-arnhem.nl', telefoon: '+31 6 1234 5678', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.OVERIG, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp2', voornaam: 'Bram', achternaam: 'de Jong', email: 'bram@verloskunde-arnhem.nl', telefoon: '+31 6 2345 6789', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp3', voornaam: 'Carla', achternaam: 'Bakker', email: 'carla@verloskunde-arnhem.nl', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.ORANJE, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp4', voornaam: 'Daan', achternaam: 'van Leeuwen', telefoon: '+31 6 4567 8901', actief: true, dienstverband: DienstverbandType.LOONDIENST, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp5', voornaam: 'Eva', achternaam: 'Vermeer', email: 'eva@verloskunde-arnhem.nl', actief: true, dienstverband: DienstverbandType.LOONDIENST, team: TeamType.ORANJE, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp6', voornaam: 'Frank', achternaam: 'Jansen', telefoon: '+31 6 5678 9012', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: ['za', 'zo'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp7', voornaam: 'Greta', achternaam: 'van Dijk', email: 'greta@verloskunde-arnhem.nl', telefoon: '+31 6 6789 0123', actief: true, dienstverband: DienstverbandType.LOONDIENST, team: TeamType.ORANJE, aantalWerkdagen: 24, roostervrijDagen: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'emp8', voornaam: 'Hans', achternaam: 'Peters', actief: true, dienstverband: DienstverbandType.MAAT, team: TeamType.GROEN, aantalWerkdagen: 24, roostervrijDagen: ['wo'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function load(): Employee[] {
  if (typeof window === 'undefined') return DEFAULT_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEY);
  const version = localStorage.getItem(STORAGE_VERSION_KEY);

  // Geen data: initialiseer met defaults + versie
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true'); // Default data is al gemigreerd
    return DEFAULT_EMPLOYEES;
  }

  try {
    const parsed = JSON.parse(raw);

    // Forceer migratie wanneer versie mismatch of nieuwe velden ontbreken
    const needsMigration = version !== CURRENT_VERSION || 
      (Array.isArray(parsed) && parsed.length > 0 && !hasNewFields(parsed[0]));

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
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return DEFAULT_EMPLOYEES;
  }
}

function save(list: Employee[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
}

// CRUD FUNCTIES

export function getAllEmployees(): Employee[] { 
  return load(); 
}

export function getActiveEmployees(): Employee[] {
  return load().filter(e => e.actief);
}

// Uitgebreide validatie voor nieuwe velden
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

export function createEmployee(data: Omit<Employee, 'id'|'created_at'|'updated_at'>): Employee {
  const list = load();
  const now = new Date().toISOString();
  
  // Valideer nieuwe verplichte velden
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
  save(list); 
  return nieuw;
}

export function updateEmployee(id: string, patch: Partial<Employee>): Employee {
  const list = load();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Medewerker niet gevonden');
  
  const now = new Date().toISOString();
  const current = list[idx];
  
  // Normaliseer roostervrije dagen indien aanwezig
  if (patch.roostervrijDagen !== undefined) {
    patch.roostervrijDagen = normalizeRoostervrijDagen(patch.roostervrijDagen);
  }
  
  const updated = { ...current, ...patch, updated_at: now } as Employee;
  
  // Valideer de geüpdatete data
  validateEmployeeData(updated, true);
  
  // Check naam uniciteit als naam gewijzigd
  if ((patch.voornaam || patch.achternaam)) {
    const fullName = getFullName(updated);
    if (list.some(e => e.id !== id && getFullName(e).toLowerCase() === fullName.toLowerCase())) {
      throw new Error('Deze naam bestaat al');
    }
  }
  
  // Sanitize optionele velden
  if (updated.email !== undefined) {
    updated.email = updated.email?.trim() || undefined;
  }
  if (updated.telefoon !== undefined) {
    updated.telefoon = updated.telefoon?.trim() || undefined;
  }
  
  list[idx] = updated; 
  save(list); 
  return updated;
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

// UTILITY FUNCTIES

// Haal migratie statistieken op voor verificatie
export function getMigrationStats(): { 
  total: number;
  maat: number;
  loondienst: number;
  zzp: number;
  groen: number;
  oranje: number;
  overig: number;
  migrationCompleted: boolean;
} {
  const employees = getAllEmployees();
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
    migrationCompleted
  };
}

// Reset migratie flag (voor testing)
export function resetMigrationFlag(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  }
}