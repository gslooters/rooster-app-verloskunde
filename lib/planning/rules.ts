export type ServiceCode = 's' | 'd' | 'sp' | 'echo';
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Ma .. 7=Zo

export type PlanRule = {
  day_of_week: DayOfWeek;
  service_code: ServiceCode;
  min_count: number;
  max_count: number;
  required: boolean;
};

export type PlanRules = PlanRule[];

// Default regels: "s" verplicht elke dag min=1, max=1
export function defaultPlanRules(): PlanRules {
  const rules: PlanRules = [];
  const days: DayOfWeek[] = [1,2,3,4,5,6,7];
  for (const d of days) {
    rules.push({ day_of_week: d, service_code: 's', min_count: 1, max_count: 1, required: true });
  }
  // voorbeeld baselines (kun je later via UI wijzigen)
  for (const d of [1,2,3,4,5]) { // ma-vr
    rules.push({ day_of_week: d, service_code: 'd', min_count: 2, max_count: 3, required: false });
    rules.push({ day_of_week: d, service_code: 'sp', min_count: 1, max_count: 2, required: false });
  }
  // echo op di en vr max 2, anders 0
  rules.push({ day_of_week: 2, service_code: 'echo', min_count: 0, max_count: 2, required: false });
  rules.push({ day_of_week: 5, service_code: 'echo', min_count: 0, max_count: 2, required: false });
  for (const d of [1,3,4]) {
    rules.push({ day_of_week: d, service_code: 'echo', min_count: 0, max_count: 1, required: false });
  }
  // za-zo beperkter
  for (const d of [6,7]) {
    rules.push({ day_of_week: d, service_code: 'd', min_count: 1, max_count: 2, required: false });
    rules.push({ day_of_week: d, service_code: 'sp', min_count: 0, max_count: 0, required: false });
    rules.push({ day_of_week: d, service_code: 'echo', min_count: 0, max_count: 0, required: false });
  }
  return rules;
}

// Bepaal weekdagnummer (1=Ma .. 7=Zo) vanuit JS getDay (0=Zo..6=Za)
export function toDayOfWeek(date: Date): DayOfWeek {
  const js = date.getDay(); // 0..6
  return (js === 0 ? 7 : js) as DayOfWeek;
}

// Feestdagen als zondag behandelen
export function effectiveDayOfWeek(d: Date, isHoliday: boolean): DayOfWeek {
  if (isHoliday) return 7;
  return toDayOfWeek(d);
}

// Ophalen van min/max voor een dag + service
export function getRuleFor(rules: PlanRules, day: DayOfWeek, service: ServiceCode): PlanRule | undefined {
  return rules.find(x => x.day_of_week === day && x.service_code === service);
}
