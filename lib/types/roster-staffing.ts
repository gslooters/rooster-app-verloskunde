// lib/types/roster-staffing.ts

/**
 * Rooster-specifieke bezettingsregels
 * Deze regels overschrijven de algemene DayType staffing regels voor specifieke roosters
 */
export interface RosterStaffingRule {
  id: string;
  rosterId: string;
  date: string; // YYYY-MM-DD
  dienstId: string;
  minBezetting: number; // 0-8
  maxBezetting: number; // 0-9 (9 = onbeperkt)
  locked: boolean; // Of deze regel vastgesteld is
  created_at: string;
  updated_at: string;
}

/**
 * Input interface voor het aanmaken/wijzigen van rooster bezettingsregels
 */
export interface RosterStaffingRuleInput {
  rosterId: string;
  date: string;
  dienstId: string;
  minBezetting: number;
  maxBezetting: number;
}

/**
 * Status van bezettingsbeheer voor een rooster
 */
export interface RosterStaffingStatus {
  rosterId: string;
  isLocked: boolean; // Of bezetting vastgesteld is
  lockedAt?: string; // Wanneer vastgesteld
  lockedBy?: string; // Door wie vastgesteld (voor toekomstige user management)
}

/**
 * Gecombineerde view van een bezettingsregel met dienst informatie
 */
export interface RosterStaffingRuleWithService {
  rule: RosterStaffingRule;
  dienstCode: string;
  dienstNaam: string;
  dienstKleur: string;
}

/**
 * Overzicht van bezetting per datum
 */
export interface DateStaffingOverview {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday: boolean;
  rules: RosterStaffingRuleWithService[];
}

/**
 * Validatie result voor bezettingsregels
 */
export interface StaffingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Helper functies
 */
export function validateRosterStaffingRule(rule: RosterStaffingRuleInput): StaffingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validatie minimum bezetting
  if (rule.minBezetting < 0 || rule.minBezetting > 8) {
    errors.push('Minimum bezetting moet tussen 0 en 8 zijn');
  }

  // Validatie maximum bezetting
  if (rule.maxBezetting < 0 || rule.maxBezetting > 9) {
    errors.push('Maximum bezetting moet tussen 0 en 9 zijn');
  }

  // Validatie logische consistentie
  if (rule.minBezetting > rule.maxBezetting) {
    errors.push('Minimum bezetting kan niet hoger zijn dan maximum bezetting');
  }

  // Validatie datum format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(rule.date)) {
    errors.push('Ongeldige datum format (verwacht: YYYY-MM-DD)');
  }

  // Warning voor hoge bezetting
  if (rule.maxBezetting > 6) {
    warnings.push('Hoge maximum bezetting gedetecteerd');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper om bezettingstekst te genereren
 */
export function getStaffingDisplayText(min: number, max: number): string {
  if (min === 0 && max === 0) return 'Geen';
  if (min === max) return `Exact ${min}`;
  if (max === 9) return `Min ${min}, onbep`;
  return `${min}-${max}`;
}

/**
 * Helper om dag van de week te krijgen
 */
export function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay(); // 0 = zondag, 1 = maandag, etc.
}

/**
 * Helper om dag naam te krijgen
 */
export function getDayName(dateStr: string): string {
  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  return dayNames[getDayOfWeek(dateStr)];
}

/**
 * Helper om korte dag naam te krijgen
 */
export function getDayShort(dateStr: string): string {
  const dayShorts = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA'];
  return dayShorts[getDayOfWeek(dateStr)];
}