export type Availability = {
  roster_id: string;
  employee_id: string;
  date: string;     // YYYY-MM-DD
  available: boolean;
  reason?: string;
};

const KEY = 'verloskunde_availability';

function readAll(): Availability[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as Availability[];
  } catch {
    return [];
  }
}

function writeAll(list: Availability[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getAvailability(roster_id: string): Availability[] {
  return readAll().filter(a => a.roster_id === roster_id);
}

export function setAvailability(entry: Availability) {
  const list = readAll().filter(a => !(a.roster_id === entry.roster_id && a.employee_id === entry.employee_id && a.date === entry.date));
  list.push(entry);
  writeAll(list);
}

export function toggleAvailability(roster_id: string, employee_id: string, date: string, reason?: string): Availability {
  const list = readAll();
  const idx = list.findIndex(a => a.roster_id === roster_id && a.employee_id === employee_id && a.date === date);
  if (idx >= 0) {
    list[idx] = { ...list[idx], available: !list[idx].available, reason };
  } else {
    list.push({ roster_id, employee_id, date, available: false, reason });
  }
  writeAll(list);
  return list.find(a => a.roster_id === roster_id && a.employee_id === employee_id && a.date === date)!;
}

export function isAvailable(roster_id: string, employee_id: string, date: string): boolean {
  const a = readAll().find(x => x.roster_id === roster_id && x.employee_id === employee_id && x.date === date);
  return a ? a.available : true; // default: beschikbaar
}
