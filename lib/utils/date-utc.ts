/**
 * UTC-safe date utilities voor rooster-app-verloskunde
 * Alle date parsing en manipulatie moet via deze functies
 * om timezone-bugs te voorkomen.
 * 
 * @module date-utc
 */

/**
 * Parse date string als UTC midnight
 * Input: 'YYYY-MM-DD' of 'YYYY-MM-DDTHH:mm:ss'
 * Output: Date object representing UTC midnight van die dag
 * 
 * @example parseUTCDate('2025-11-24') → 2025-11-24T00:00:00.000Z
 */
export function parseUTCDate(dateString: string): Date {
  if (!dateString) throw new Error('dateString is required');
  
  // Strip time component if present, take only date part
  const datePart = dateString.split('T')[0];
  
  // Always append Z to force UTC interpretation
  return new Date(`${datePart}T00:00:00.000Z`);
}

/**
 * Convert Date to YYYY-MM-DD string in UTC
 * 
 * @example toUTCDateString(new Date('2025-11-24T23:00:00Z')) → '2025-11-24'
 */
export function toUTCDateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object');
  }
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Add days to date in UTC (no DST issues)
 * 
 * @example addUTCDays(parseUTCDate('2025-11-24'), 7) → 2025-12-01T00:00:00.000Z
 */
export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Get Monday of the week containing this date (UTC)
 * ISO 8601: Monday = day 1
 * 
 * @example getUTCMonday(parseUTCDate('2025-11-26')) → 2025-11-24T00:00:00.000Z
 */
export function getUTCMonday(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, need to go back 6 days
  return addUTCDays(date, daysToMonday);
}

/**
 * Get ISO week number (UTC)
 * ISO 8601: Week 1 is first week with Thursday
 * 
 * @example getUTCWeekNumber(parseUTCDate('2025-11-24')) → { year: 2025, week: 48 }
 */
export function getUTCWeekNumber(date: Date): { year: number; week: number } {
  // Copy date to avoid mutation
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  
  // ISO week date weeks start on Monday, so correct the day number
  const dayNum = (date.getUTCDay() + 6) % 7;
  
  // Set to nearest Thursday: current date + 4 - current day number
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  
  // Get first day of year
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  
  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    year: target.getUTCFullYear(),
    week: weekNum
  };
}

/**
 * Get Sunday of the week containing this date (UTC)
 * 
 * @example getUTCSunday(parseUTCDate('2025-11-24')) → 2025-11-30T00:00:00.000Z
 */
export function getUTCSunday(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return addUTCDays(date, daysToSunday);
}

/**
 * Format date for display (locale-aware but UTC-based)
 * 
 * @example formatUTCDate(parseUTCDate('2025-11-24'), 'nl-NL') → '24 november 2025'
 */
export function formatUTCDate(date: Date, locale: string = 'nl-NL', options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
}

/**
 * Check if two dates are the same day (UTC)
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Get start of month (UTC)
 */
export function getUTCStartOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Get end of month (UTC)
 */
export function getUTCEndOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/**
 * Diff between two dates in days (UTC)
 */
export function getUTCDaysDiff(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
  const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((utc2 - utc1) / msPerDay);
}