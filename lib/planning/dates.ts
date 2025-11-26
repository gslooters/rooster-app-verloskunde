import { parseUTCDate, toUTCDateString, addUTCDays, formatUTCDate } from '@/lib/utils/date-utc';

export function ensureMondayYYYYMMDD(input: string) {
  const d = parseUTCDate(input);
  if (d.getUTCDay() !== 1) throw new Error('Startdatum moet een maandag zijn.');
  return input;
}

export function addDaysYYYYMMDD(input: string, days: number) {
  const date = parseUTCDate(input);
  const result = addUTCDays(date, days);
  return toUTCDateString(result);
}

export function displayDate(input: string) {
  const date = parseUTCDate(input);
  return formatUTCDate(date, 'nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\s/g, '-'); // Format: dd-MM-yyyy
}