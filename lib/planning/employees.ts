// lib/planning/employees.ts
// Sprint 2.2: Employee management met snapshot support

export type Employee = {
  id: string;
  name: string;
  active: boolean;
  voornaam?: string;
  achternaam?: string;
  actief?: boolean; // For compatibility
};

const EKEY = 'verloskunde_employees';

// Sprint 2.2: Mock test data voor development
const MOCK_TEST_EMPLOYEES: Employee[] = [
  { id: 'emp1', name: 'Anna van der Berg', active: true, voornaam: 'Anna', achternaam: 'van der Berg', actief: true },
  { id: 'emp2', name: 'Bram Jansen', active: true, voornaam: 'Bram', achternaam: 'Jansen', actief: true },
  { id: 'emp3', name: 'Carla de Wit', active: true, voornaam: 'Carla', achternaam: 'de Wit', actief: true },
  { id: 'emp4', name: 'Daan Bakker', active: true, voornaam: 'Daan', achternaam: 'Bakker', actief: true },
  { id: 'emp5', name: 'Eva Smit', active: true, voornaam: 'Eva', achternaam: 'Smit', actief: true },
  { id: 'emp6', name: 'Frank de Jong', active: true, voornaam: 'Frank', achternaam: 'de Jong', actief: true },
  { id: 'emp7', name: 'Greta van Dijk', active: true, voornaam: 'Greta', achternaam: 'van Dijk', actief: true },
  { id: 'emp8', name: 'Hans Visser', active: true, voornaam: 'Hans', achternaam: 'Visser', actief: true },
  { id: 'emp9', name: 'Iris Peters', active: true, voornaam: 'Iris', achternaam: 'Peters', actief: true },
  { id: 'emp10', name: 'Jan Mulder', active: false, voornaam: 'Jan', achternaam: 'Mulder', actief: false },
];

// Demo: lees uit localStorage. Koppel later aan echte bron (API/DB).
export function readEmployees(): Employee[] {
  if (typeof window === 'undefined') return [];
  try { 
    const stored = JSON.parse(localStorage.getItem(EKEY) || '[]') as Employee[];
    // Sprint 2.2: Als geen data in localStorage, gebruik test data
    if (stored.length === 0) {
      return MOCK_TEST_EMPLOYEES;
    }
    return stored;
  } catch { 
    return MOCK_TEST_EMPLOYEES; // Fallback naar test data
  }
}

export function getActiveEmployees(): Employee[] {
  return readEmployees().filter(e => e.active);
}

// Sprint 2.2: Helper functies voor employee management
export function getEmployeeById(id: string): Employee | undefined {
  return readEmployees().find(emp => emp.id === id);
}

export function getEmployeeDisplayName(employee: Employee): string {
  if (employee.voornaam && employee.achternaam) {
    return `${employee.voornaam} ${employee.achternaam}`;
  }
  return employee.name;
}

export function getEmployeeFirstName(employee: Employee): string {
  if (employee.voornaam) {
    return employee.voornaam;
  }
  return employee.name.split(' ')[0];
}

export function getEmployeeStats(): { total: number; active: number; inactive: number } {
  const all = readEmployees();
  const total = all.length;
  const active = all.filter(emp => emp.active).length;
  const inactive = total - active;
  
  return { total, active, inactive };
}

// Sprint 2.2: Initialize test data als localStorage leeg is
export function initializeTestData(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const existing = localStorage.getItem(EKEY);
    if (!existing || JSON.parse(existing).length === 0) {
      localStorage.setItem(EKEY, JSON.stringify(MOCK_TEST_EMPLOYEES));
      console.log('Test employee data geïnitialiseerd');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Fout bij initialiseren test data:', error);
    return false;
  }
}