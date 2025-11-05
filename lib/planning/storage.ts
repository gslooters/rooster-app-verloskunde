export type Roster = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  // Uitgebreide status: draft (in ontwerp), in_progress (in bewerking), final (afgesloten)
  status: 'draft' | 'in_progress' | 'final';
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

export function getRosters(): Roster[] { return safeRead<Roster[]>(K_ROSTERS, []); }
export function upsertRoster(r: Roster) { const list = getRosters().filter(x => x.id !== r.id); list.push(r); safeWrite(K_ROSTERS, list); }
export function readRosters(): Roster[] { return getRosters(); }
export function writeRosters(rosters: Roster[]) { safeWrite(K_ROSTERS, rosters); }

// Nieuwe helpers voor periode generatie en formatting
const BASE_START = '2025-11-24'; // Eerste maandag

export function generateFiveWeekPeriods(limit = 20) {
  const res: { start: string; end: string }[] = [];
  const [y,m,d] = BASE_START.split('-').map(n=>parseInt(n));
  let cursor = new Date(y, m-1, d);
  for (let i=0;i<limit;i++) {
    const start = new Date(cursor);
    const end = new Date(start); end.setDate(start.getDate()+34); // 5 weken - 1 dag
    res.push({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0]});
    // naar volgende periode
    cursor.setDate(cursor.getDate()+35);
  }
  return res;
}

export function formatWeekRange(startDate: string, endDate: string): string {
  const s = new Date(startDate); const e = new Date(endDate);
  const sw = (s as any).getWeek ? (s as any).getWeek() : getISOWeek(s);
  const ew = (e as any).getWeek ? (e as any).getWeek() : getISOWeek(e);
  return `Week ${sw}-${ew}, ${s.getFullYear()}`;
}

export function formatDateRangeNl(startDate: string, endDate: string): string {
  const s = new Date(startDate); const e = new Date(endDate);
  const fmt = new Intl.DateTimeFormat('nl-NL', { day:'2-digit', month:'short' });
  const fmtY = new Intl.DateTimeFormat('nl-NL', { day:'2-digit', month:'short', year:'numeric' });
  return `${fmt.format(s)} - ${fmtY.format(e)}`;
}

function getISOWeek(date: Date): number {
  // Copy date so don't modify original
  const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  const dayNum = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  // Calculate full weeks to the date
  return Math.ceil((((dt as any) - (yearStart as any)) / 86400000 + 1)/7);
}

export function validateStartMonday(dateStr: string): boolean {
  const parts = dateStr.split('-'); if (parts.length !== 3) return false;
  const y = parseInt(parts[0]); const m = parseInt(parts[1]) - 1; const d = parseInt(parts[2]);
  const date = new Date(y,m,d); return date.getDay() === 1;
}

export function computeDefaultStart(): string {
  // Voor compatibiliteit: pak eerstvolgende vrije periode vanaf BASE_START
  const periods = generateFiveWeekPeriods(100);
  const rosters = getRosters();
  for (const p of periods) {
    const exists = rosters.some(r => r.start_date === p.start);
    if (!exists) return p.start;
  }
  return periods[0].start;
}

export function computeEnd(startDate: string): string {
  const [y,m,d] = startDate.split('-').map(n=>parseInt(n));
  const start = new Date(y,m-1,d); const end = new Date(start); end.setDate(start.getDate()+34);
  return end.toISOString().split('T')[0];
}

export function getPeriodStatus(startDate: string, endDate: string): 'draft'|'in_progress'|'final'|'free' {
  const roster = getRosters().find(r => r.start_date === startDate && r.end_date === endDate);
  if (!roster) return 'free';
  return roster.status;
}
