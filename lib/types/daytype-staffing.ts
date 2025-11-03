// lib/types/daytype-staffing.ts
export interface DayTypeStaffing {
  id: string;
  dienstId: string; // Foreign key to Dienst
  dagSoort: number; // 0 = Maandag, 1 = Dinsdag, ... 6 = Zondag
  minBezetting: number; // 0-8
  maxBezetting: number; // 0-9 (9 = onbeperkt)
  created_at: string;
  updated_at: string;
}

export interface DayTypeStaffingInput {
  dienstId: string;
  dagSoort: number;
  minBezetting: number;
  maxBezetting: number;
}

export const DAYS_OF_WEEK = [
  { code: 'ma', name: 'Maandag', index: 0 },
  { code: 'di', name: 'Dinsdag', index: 1 },
  { code: 'wo', name: 'Woensdag', index: 2 },
  { code: 'do', name: 'Donderdag', index: 3 },
  { code: 'vr', name: 'Vrijdag', index: 4 },
  { code: 'za', name: 'Zaterdag', index: 5 },
  { code: 'zo', name: 'Zondag', index: 6 }
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];
