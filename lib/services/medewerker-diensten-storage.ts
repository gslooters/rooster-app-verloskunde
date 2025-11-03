// lib/services/medewerker-diensten-storage.ts
import { getAllServices } from './diensten-storage';

const STORAGE_KEY = 'medewerker_diensten';

// Default mapping: medewerker ID -> dienst codes array
const DEFAULT_MAPPING: Record<string, string[]> = {
  'emp1': ['s', 'd', 'echo'], // Anna: shift, dag, echo
  'emp2': ['s', 'sp', 'nd'], // Bram: shift, speciaal, nacht
  'emp3': ['d', 'sp', 'echo'], // Carla: dag, speciaal, echo
  'emp4': ['s', 'd', 'nd'], // Daan: shift, dag, nacht
  'emp5': ['echo', 'sp'], // Eva: echo, speciaal
  'emp6': ['s', 'd', 'ss'], // Frank: shift, dag, weekend
  'emp7': ['d', 'echo', 'sp'], // Greta: dag, echo, speciaal
  'emp8': ['s', 'nd', 'ss'], // Hans: shift, nacht, weekend
};

function load(): Record<string, string[]> {
  if (typeof window === 'undefined') return DEFAULT_MAPPING;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MAPPING));
    return DEFAULT_MAPPING;
  }
  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return DEFAULT_MAPPING;
  }
}

function save(mapping: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
}

export function getServicesForEmployee(employeeId: string): string[] {
  const mapping = load();
  const codes = mapping[employeeId];
  if (!codes || codes.length === 0) {
    // Fallback: all active services if no mapping exists
    return getAllServices().filter(s => s.actief).map(s => s.code);
  }
  // Filter out inactive services
  const allServices = getAllServices();
  return codes.filter(code => {
    const service = allServices.find(s => s.code === code);
    return service && service.actief;
  });
}

export function setServicesForEmployee(employeeId: string, serviceCodes: string[]): void {
  const mapping = load();
  mapping[employeeId] = serviceCodes;
  save(mapping);
}

export function getAllEmployeeServiceMappings(): Record<string, string[]> {
  return load();
}

// Check if any employee is mapped to a service (for delete validation)
export function isServiceMappedToAnyEmployee(serviceCode: string): boolean {
  const mapping = load();
  return Object.values(mapping).some(codes => codes.includes(serviceCode));
}

// Get employees that can perform a specific service
export function getEmployeesForService(serviceCode: string): string[] {
  const mapping = load();
  return Object.keys(mapping).filter(empId => mapping[empId].includes(serviceCode));
}