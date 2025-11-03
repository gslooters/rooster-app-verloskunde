export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=zo..6=za
export type ServiceCode = 's' | 'd' | 'sp' | 'echo' | 'nd' | string;

export type PlanRule = {
  day_of_week: DayOfWeek;
  service_code: ServiceCode;
  min_count: number;
  max_count: number;
  required: boolean;
};

export type PlanRules = PlanRule[];

// Standaard regelset voor planning
export function defaultPlanRules(): PlanRules {
  const rules: PlanRules = [];
  const weekdays: DayOfWeek[] = [1, 2, 3, 4, 5];

  for (const d of weekdays) {
    rules.push({ day_of_week: d, service_code: 'd',  min_count: 2, max_count: 3, required: false });
    rules.push({ day_of_week: d, service_code: 'sp', min_count: 1, max_count: 2, required: false });
  }

  const echoDays: DayOfWeek[] = [2, 5];
  for (const d of echoDays) {
    rules.push({ day_of_week: d, service_code: 'echo', min_count: 0, max_count: 2, required: false });
  }

  const weekend: DayOfWeek[] = [0, 6];
  for (const d of weekend) {
    rules.push({ day_of_week: d, service_code: 'd', min_count: 0, max_count: 0, required: false });
  }

  return rules;
}

// Zoek regel voor specifieke dag+dienst
export function getRuleFor(rules: PlanRules, day: DayOfWeek, code: ServiceCode): PlanRule | undefined {
  return rules.find((r): boolean => r.day_of_week === day && r.service_code === code);
}

// Optioneel: Ruleset storage type (niet gebruikt door RulesPanel maar handig voor latere opslag)
export type Ruleset = {
  id: string;
  name: string;
  rules: PlanRules;
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
  const list = readRules().filter((x): boolean => x.id !== set.id);
  list.push(set);
  writeRules(list);
}

export function createDefaultRuleset(id: string, name = 'Standaard'): Ruleset {
  const rules = defaultPlanRules();
  return {
    id,
    name,
    rules,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
