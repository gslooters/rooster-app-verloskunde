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
    aantalwerkdagen: emp.aantalWerkdagen, // GEEN underscore!
    roostervrijdagen: emp.roostervrijDagen, // GEEN underscore!
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

// (rest van volledige file blijft gelijk, alleen deze twee functies zijn aangepast naar kolomnamen zonder underscores)

// -- File is anders gelijk aan vorige werkende versie --
