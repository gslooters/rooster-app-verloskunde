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
