export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=zo..6=za

export type ServiceRule = {
  day_of_week: DayOfWeek;
  service_code: string;
  min_count: number;
  max_count: number;
  required: boolean;
};

export type Ruleset = {
  id: string;
  name: string;
  rules: ServiceRule[];
  created_at: string;
  updated_at: string;
};

const RKEY = 'verloskunde_rules';

function readRules(): Ruleset[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RKEY) || '[]') as Ruleset[];
  } catch {
    return [];
  }
}

function writeRules(list: Ruleset[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RKEY, JSON.stringify(list));
}

export function getRulesets(): Ruleset[] {
  return readRules();
}

export function upsertRuleset(set: Ruleset) {
  const list = readRules().filter(x => x.id !== set.id);
  list.push(set);
  writeRules(list);
}

export function createDefaultRuleset(id: string, name = 'Standaard'): Ruleset {
  const rules: ServiceRule[] = [];

  // Werk met expliciete DayOfWeek waarden om TS te helpen (ma=1..vr=5)
  const weekdays: DayOfWeek[] = [1, 2, 3, 4, 5];

  // Baselines: ma-vr
  for (const d of weekdays) {
    rules.push({ day_of_week: d, service_code: 'd',  min_count: 2, max_count: 3, required: false });
    rules.push({ day_of_week: d, service_code: 'sp', min_count: 1, max_count: 2, required: false });
  }

  // Echo op di(2) en vr(5): max 2
  const echoDays: DayOfWeek[] = [2, 5];
  for (const d of echoDays) {
    rules.push({ day_of_week: d, service_code: 'echo', min_count: 0, max_count: 2, required: false });
  }

  // Weekend: standaard geen dagdiensten; je kunt hier later nd/24u regels zetten
  const weekend: DayOfWeek[] = [0, 6];
  for (const d of weekend) {
    rules.push({ day_of_week: d, service_code: 'd', min_count: 0, max_count: 0, required: false });
  }

  return {
    id,
    name,
    rules,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
