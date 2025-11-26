import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { nl } from 'date-fns/locale';
import { 
  parseUTCDate as parseUTCDateCore,
  formatUTCDate 
} from '@/lib/utils/date-utc';

/**
 * 🌍 DRAAD1F + DRAAD57: TIMEZONE-VEILIGE DATUM UTILITIES
 * 
 * Deze functies forceren UTC timezone voor alle datum formatting,
 * waardoor browser locale timezone genegeerd wordt.
 * 
 * DRAAD57: Migratie naar centrale date-utc.ts utilities
 * Core functies zijn nu gedelegeerd naar @/lib/utils/date-utc
 */

const UTC_TIMEZONE = 'UTC';

/**
 * Parse datum string naar UTC Date object
 * Voorkomt locale timezone conversie
 * 
 * @deprecated Use parseUTCDate from @/lib/utils/date-utc instead
 */
export function parseUTCDate(dateStr: string): Date {
  return parseUTCDateCore(dateStr);
}

/**
 * Format datum in UTC timezone (niet browser locale!)
 * 
 * @param date - Date object
 * @param formatStr - date-fns format string
 * @returns Geformatteerde string in UTC
 */
export function formatUTC(date: Date, formatStr: string): string {
  return formatInTimeZone(date, UTC_TIMEZONE, formatStr, { locale: nl });
}

/**
 * Format datum als weekdag + datum (bijv. "ma 24/11")
 */
export function formatWeekdayDate(date: Date): string {
  return formatUTC(date, 'EEE dd/MM');
}

/**
 * Format datum als volledige weekdag (bijv. "maandag")
 */
export function formatWeekdayFull(date: Date): string {
  return formatUTC(date, 'EEEE');
}

/**
 * Format datum als dd-MM-yyyy (bijv. "24-11-2025")
 */
export function formatDateDMY(date: Date): string {
  return formatUTC(date, 'dd-MM-yyyy');
}

/**
 * Get UTC dag-van-week (0=zondag, 1=maandag, etc.)
 * Gebruikt UTC, niet locale timezone!
 */
export function getUTCDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/**
 * Check of datum een maandag is (in UTC!)
 */
export function isMonday(date: Date): boolean {
  return getUTCDayOfWeek(date) === 1;
}

/**
 * Check of datum een zondag is (in UTC!)
 */
export function isSunday(date: Date): boolean {
  return getUTCDayOfWeek(date) === 0;
}

/**
 * Valideer dat datum een maandag is
 * Throw error als niet (gebruik voor week start validatie)
 */
export function assertMonday(date: Date, label: string = 'Datum'): void {
  if (!isMonday(date)) {
    const weekday = formatWeekdayFull(date);
    throw new Error(
      `🔴 DRAAD1F VALIDATIE FOUT: ${label} moet maandag zijn, maar is ${weekday}!`
    );
  }
}

/**
 * Valideer dat datum een zondag is
 * Throw error als niet (gebruik voor week end validatie)
 */
export function assertSunday(date: Date, label: string = 'Datum'): void {
  if (!isSunday(date)) {
    const weekday = formatWeekdayFull(date);
    throw new Error(
      `🔴 DRAAD1F VALIDATIE FOUT: ${label} moet zondag zijn, maar is ${weekday}!`
    );
  }
}