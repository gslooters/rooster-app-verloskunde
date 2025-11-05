export type Roster = {
  id: string;
  start_date: string; // YYYY-MM-DD (maandag)
  end_date: string;   // YYYY-MM-DD (zondag, 34 dagen na start)
  status: 'draft' | 'in_progress' | 'final';
  created_at: string;
};

const K_ROSTERS = 'verloskunde_rosters';
const BASE_START = '2025-11-24'; // Eerste rooster start op maandag 24-11-2025

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback as T;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

function safeWrite<T>(key: string, value: T) { if (typeof window === 'undefined') return; localStorage.setItem(key, JSON.stringify(value)); }

export function getRosters(): Roster[] { return safeRead<Roster[]>(K_ROSTERS, []); }
export function upsertRoster(r: Roster) { const list = getRosters().filter(x => x.id !== r.id); list.push(r); safeWrite(K_ROSTERS, list); }
export function readRosters(): Roster[] { return getRosters(); }
export function writeRosters(rosters: Roster[]) { safeWrite(K_ROSTERS, rosters); }

// Genereer vaste 5-weken perioden vanaf BASE_START (ma t/m zo)
export function generateFiveWeekPeriods(limit = 20) {
  const res: { start: string; end: string }[] = [];
  let cursor = new Date(`${BASE_START}T00:00:00`); // Maandag 24-11-2025
  for (let i = 0; i < limit; i++) {
    const start = new Date(cursor);
    const end = new Date(start); end.setDate(start.getDate() + 34); // eindigt op zondag
    res.push({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    cursor.setDate(cursor.getDate() + 35); // volgende maandag
  }
  return res;
}

// ISO 8601 weeknummer berekening (Nederland standaard)
// Week 1 = week met eerste donderdag van het jaar (bevat 4 januari)
// Weken lopen maandag t/m zondag
function getISOWeek(date: Date): number {
  // Maak kopie om originele datum niet te wijzigen
  const dt = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  // Zoek dichtstbijzijnde donderdag: huidige datum + 4 - huidige dagnummer
  // (zondag=0, maandag=1, ..., zaterdag=6)
  const dayNum = dt.getUTCDay() || 7; // zondag=7 voor berekening
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  
  // Eerste dag van het jaar waarin deze donderdag valt
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  
  // Bereken aantal volledige weken tot de donderdag + week 1
  return Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function formatWeekRange(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const sw = getISOWeek(s);
  const ew = getISOWeek(e);
  
  // Bij jaarovergangen, gebruik het jaar van het begin van de periode
  const year = s.getFullYear();
  
  // Speciale behandeling bij jaar overgang (bijv. Week 1 van 2026 die in dec 2025 begint)
  if (sw === 1 && s.getFullYear() < e.getFullYear()) {
    return `Week ${sw}-${ew}, ${e.getFullYear()}`; // Gebruik het nieuwe jaar
  }
  
  return `Week ${sw}-${ew}, ${year}`;
}

export function formatDateRangeNl(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const fmt = new Intl.DateTimeFormat('nl-NL', { day:'2-digit', month:'short' });
  const fmtY = new Intl.DateTimeFormat('nl-NL', { day:'2-digit', month:'short', year:'numeric' });
  return `${fmt.format(s)} - ${fmtY.format(e)}`;
}

export function validateStartMonday(dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`); return date.getDay() === 1;
}

export function computeDefaultStart(): string {
  const periods = generateFiveWeekPeriods(100);
  const rosters = getRosters();
  for (const p of periods) { if (!rosters.some(r => r.start_date === p.start)) return p.start; }
  return periods[0].start;
}

export function computeEnd(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`); const end = new Date(start); end.setDate(start.getDate() + 34); return end.toISOString().split('T')[0];
}

export function getPeriodStatus(startDate: string, endDate: string): 'draft'|'in_progress'|'final'|'free' {
  const roster = getRosters().find(r => r.start_date === startDate && r.end_date === endDate);
  if (!roster) return 'free';
  return roster.status;
}
