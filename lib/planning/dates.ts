import { addDays, format, isMonday, parseISO } from 'date-fns';

export function ensureMondayYYYYMMDD(input: string) {
  const d = parseISO(input);
  if (!isMonday(d)) throw new Error('Startdatum moet een maandag zijn.');
  return input;
}

export function addDaysYYYYMMDD(input: string, days: number) {
  return format(addDays(parseISO(input), days), 'yyyy-MM-dd');
}

export function displayDate(input: string) {
  return format(parseISO(input), 'dd-MM-yyyy');
}
