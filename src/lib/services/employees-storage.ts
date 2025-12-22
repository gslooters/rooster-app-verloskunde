/**
 * Employee CRUD Service
 * Handles read/write operations for employees
 * Currently uses in-memory storage (can be replaced with Supabase calls)
 */

import { Employee } from '@/lib/types/employee';

/**
 * In-memory employee database (for now)
 * In production, this would call Supabase
 */
let EMPLOYEES_DB: Employee[] = [
  {
    id: 'emp001',
    voornaam: 'Anna',
    achternaam: 'Bakker',
    email: 'anna@verloskunde-arnhem.nl',
    telefoon: '+31 6 1234 5678',
    actief: true,
    dienstverband: 'Loondienst',
    team: 'Groen',
    aantalwerkdagen: 24,
    roostervrijdagen: ['za', 'zo'],
    structureel_nbh: undefined,
  },
  {
    id: 'emp002',
    voornaam: 'Bram',
    achternaam: 'de Vries',
    email: 'bram@verloskunde-arnhem.nl',
    telefoon: '+31 6 9876 5432',
    actief: true,
    dienstverband: 'Freelance',
    team: 'Oranje',
    aantalwerkdagen: 16,
    roostervrijdagen: [],
    structureel_nbh: { 'ma': ['nacht'], 'di': ['nacht'] },
  },
];

/**
 * Get all employees (read-only)
 * @returns Array of all employees
 */
export function getAllEmployees(): Employee[] {
  return [...EMPLOYEES_DB]; // Return shallow copy to prevent mutations
}

/**
 * Get a single employee by ID
 * @param id - Employee ID
 * @returns Employee object or undefined
 */
export function getEmployeeById(id: string): Employee | undefined {
  return EMPLOYEES_DB.find((e) => e.id === id);
}

/**
 * Create a new employee
 * @param input - Employee data (without id)
 * @returns Created employee with generated ID
 */
export function createEmployee(input: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Employee {
  const newEmployee: Employee = {
    id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    voornaam: input.voornaam,
    achternaam: input.achternaam,
    email: input.email || null,
    telefoon: input.telefoon || null,
    actief: input.actief,
    dienstverband: input.dienstverband,
    team: input.team,
    aantalwerkdagen: input.aantalwerkdagen,
    roostervrijdagen: input.roostervrijdagen || [],
    structureel_nbh: input.structureel_nbh,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  EMPLOYEES_DB.push(newEmployee);
  console.log(`✅ Medewerker aangemaakt: ${newEmployee.id}`);
  return newEmployee;
}

/**
 * Update an existing employee
 * @param id - Employee ID
 * @param input - Partial employee data to update
 */
export function updateEmployee(
  id: string,
  input: Partial<Omit<Employee, 'id' | 'created_at'>>
): Employee | undefined {
  const index = EMPLOYEES_DB.findIndex((e) => e.id === id);
  if (index === -1) {
    console.error(`❌ Medewerker niet gevonden: ${id}`);
    return undefined;
  }

  const updated: Employee = {
    ...EMPLOYEES_DB[index],
    ...input,
    id: EMPLOYEES_DB[index].id, // Preserve original ID
    created_at: EMPLOYEES_DB[index].created_at, // Preserve creation date
    updated_at: new Date().toISOString(),
  };

  EMPLOYEES_DB[index] = updated;
  console.log(`✅ Medewerker bijgewerkt: ${id}`);
  return updated;
}

/**
 * Check if an employee can be deleted
 * Validates:
 * - Not referenced in active rosters
 * - Not assigned to employee_services
 * - Not in roster_employee_services
 * @param employeeId - Employee ID to check
 * @returns { canDelete, reason, roosters }
 */
export async function canDeleteEmployee(
  employeeId: string
): Promise<{ canDelete: boolean; reason?: string; roosters?: string[] }> {
  // In production, this would check:
  // - roster_assignments for this employee_id
  // - employee_services for this employee_id
  // - roster_employee_services for this employee_id

  const employee = getEmployeeById(employeeId);
  if (!employee) {
    return { canDelete: false, reason: 'Medewerker niet gevonden' };
  }

  // For now, allow deletion if employee exists
  // TODO: Implement actual checks against Supabase tables
  return { canDelete: true };
}

/**
 * Delete an employee (with validation)
 * @param id - Employee ID
 * @returns Success boolean
 */
export async function removeEmployee(id: string): Promise<boolean> {
  const check = await canDeleteEmployee(id);

  if (!check.canDelete) {
    console.error(`❌ Kan medewerker niet verwijderen: ${check.reason}`);
    return false;
  }

  const index = EMPLOYEES_DB.findIndex((e) => e.id === id);
  if (index === -1) {
    console.error(`❌ Medewerker niet gevonden: ${id}`);
    return false;
  }

  const removed = EMPLOYEES_DB.splice(index, 1);
  console.log(`✅ Medewerker verwijderd: ${removed[0].voornaam} ${removed[0].achternaam}`);
  return true;
}

/**
 * Search employees by name (case-insensitive)
 * @param query - Search string
 * @returns Array of matching employees
 */
export function searchEmployees(query: string): Employee[] {
  const lowerQuery = query.toLowerCase();
  return EMPLOYEES_DB.filter(
    (e) =>
      e.voornaam.toLowerCase().includes(lowerQuery) ||
      e.achternaam.toLowerCase().includes(lowerQuery) ||
      e.email?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get count of active employees
 */
export function getActiveEmployeeCount(): number {
  return EMPLOYEES_DB.filter((e) => e.actief).length;
}

/**
 * Get count of employees by team
 */
export function getEmployeeCountByTeam(team: string): number {
  return EMPLOYEES_DB.filter((e) => e.team === team && e.actief).length;
}
