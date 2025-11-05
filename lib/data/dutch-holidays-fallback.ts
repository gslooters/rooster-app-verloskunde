/**
 * Fallback Nederlandse feestdagen voor wanneer de API niet beschikbaar is
 * Wordt gebruikt als backup bij API-failures of netwerkproblemen
 */

import type { Holiday } from '@/lib/types/holiday';

/**
 * Berekent Pasen voor een gegeven jaar
 * Gebruikt de algorithme van Gauss voor Gregoriaanse kalender
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

/**
 * Genereert fallback feestdagen voor een gegeven jaar
 */
export function getFallbackHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];
  
  // Vaste feestdagen
  holidays.push({
    date: `${year}-01-01`,
    name: 'Nieuwjaarsdag',
    type: 'Public'
  });
  
  // Koningsdag (27 april, of 26 april als 27 april op zondag valt)
  const kingsDay = new Date(year, 3, 27); // 27 april
  if (kingsDay.getDay() === 0) { // Als het zondag is
    kingsDay.setDate(26); // Verplaats naar zaterdag
  }
  holidays.push({
    date: `${year}-${String(kingsDay.getMonth() + 1).padStart(2, '0')}-${String(kingsDay.getDate()).padStart(2, '0')}`,
    name: 'Koningsdag',
    type: 'Public'
  });
  
  // Bevrijdingsdag (5 mei, alleen officiële feestdag in lustrum jaren)
  holidays.push({
    date: `${year}-05-05`,
    name: 'Bevrijdingsdag',
    type: year % 5 === 0 ? 'Public' : 'Bank' // Alleen officieel elke 5 jaar
  });
  
  // Kerstdagen
  holidays.push({
    date: `${year}-12-25`,
    name: 'Eerste Kerstdag',
    type: 'Public'
  });
  
  holidays.push({
    date: `${year}-12-26`,
    name: 'Tweede Kerstdag',
    type: 'Public'
  });
  
  // Berekende feestdagen gebaseerd op Pasen
  const easter = calculateEaster(year);
  
  // Paasmaandag (1 dag na Pasen)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({
    date: `${year}-${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`,
    name: 'Paasmaandag',
    type: 'Public'
  });
  
  // Hemelvaart (39 dagen na Pasen)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  holidays.push({
    date: `${year}-${String(ascension.getMonth() + 1).padStart(2, '0')}-${String(ascension.getDate()).padStart(2, '0')}`,
    name: 'Hemelvaartsdag',
    type: 'Public'
  });
  
  // Pinkstermaandag (50 dagen na Pasen)
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);
  holidays.push({
    date: `${year}-${String(whitMonday.getMonth() + 1).padStart(2, '0')}-${String(whitMonday.getDate()).padStart(2, '0')}`,
    name: 'Pinkstermaandag',
    type: 'Public'
  });
  
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Genereert fallback feestdagen voor meerdere jaren
 */
export function getFallbackHolidaysForYears(years: number[]): Holiday[] {
  const allHolidays: Holiday[] = [];
  
  for (const year of years) {
    allHolidays.push(...getFallbackHolidays(year));
  }
  
  return allHolidays.sort((a, b) => a.date.localeCompare(b.date));
}
