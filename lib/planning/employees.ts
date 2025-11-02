export type Employee = {
  id: string;
  name: string;
  active: boolean;
};

const EKEY = 'verloskunde_employees';

// Demo: lees uit localStorage. Koppel later aan echte bron (API/DB).
export function readEmployees(): Employee[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(EKEY) || '[]') as Employee[]; } catch { return []; }
}

export function getActiveEmployees(): Employee[] {
  return readEmployees().filter(e => e.active);
}


