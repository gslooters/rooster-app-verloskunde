export type Roster = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  status: 'draft' | 'final';
  created_at: string;
};

const K_ROSTERS = 'verloskunde_rosters';

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback as T;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getRosters(): Roster[] {
  return safeRead<Roster[]>(K_ROSTERS, []);
}

export function upsertRoster(r: Roster) {
  const list = getRosters().filter(x => x.id !== r.id);
  list.push(r);
  safeWrite(K_ROSTERS, list);
}

// Missing functions that components are trying to import
export function readRosters(): Roster[] {
  return getRosters();
}

export function writeRosters(rosters: Roster[]) {
  safeWrite(K_ROSTERS, rosters);
}

export function computeDefaultStart(): string {
  const rosters = getRosters();
  if (rosters.length === 0) {
    // Default to next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }
  
  // Find latest end date and add 1 day to get next Monday
  const latestEnd = rosters.reduce((latest, roster) => {
    return roster.end_date > latest ? roster.end_date : latest;
  }, rosters[0].end_date);
  
  const nextDay = new Date(latestEnd);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // Ensure it's a Monday
  const dayOfWeek = nextDay.getDay();
  if (dayOfWeek !== 1) {
    const daysUntilMonday = (8 - dayOfWeek) % 7;
    nextDay.setDate(nextDay.getDate() + daysUntilMonday);
  }
  
  return nextDay.toISOString().split('T')[0];
}

export function validateStartMonday(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date.getDay() === 1; // Monday = 1
}

export function computeEnd(startDate: string): string {
  const start = new Date(startDate);
  // 5 weeks = 35 days - 1 (to end on Sunday)
  const end = new Date(start);
  end.setDate(start.getDate() + 34);
  return end.toISOString().split('T')[0];
}