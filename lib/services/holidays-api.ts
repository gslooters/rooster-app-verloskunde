/**
 * OpenHolidays API service voor Nederlandse feestdagen
 * Met caching en fallback ondersteuning
 */

import type { Holiday, HolidayCache, OpenHolidayApiResponse } from '@/lib/types/holiday';
import { getFallbackHolidaysForYears } from '@/lib/data/dutch-holidays-fallback';

// Cache configuratie
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dagen in milliseconden
const CACHE_KEY_PREFIX = 'netherlands_holidays_';

/**
 * Haalt Nederlandse feestdagen op uit localStorage cache
 */
function getCachedHolidays(year: number): Holiday[] | null {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${year}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const cacheData: HolidayCache = JSON.parse(cached);
    const now = Date.now();
    
    // Check of cache nog geldig is
    if (now - cacheData.cachedAt > CACHE_TTL) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return cacheData.data;
  } catch (error) {
    console.warn('Error reading holidays cache:', error);
    return null;
  }
}

/**
 * Slaat Nederlandse feestdagen op in localStorage cache
 */
function setCachedHolidays(year: number, holidays: Holiday[]): void {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${year}`;
    const cacheData: HolidayCache = {
      data: holidays,
      cachedAt: Date.now(),
      year: year
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error saving holidays cache:', error);
  }
}

/**
 * Haalt Nederlandse feestdagen op voor een specifiek jaar
 * Gebruikt eerst cache, dan API, dan fallback
 */
export async function fetchNetherlandsHolidays(startDate: string, endDate: string): Promise<Holiday[]> {
  // Bepaal welke jaren we nodig hebben
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  const years = [];
  
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  
  const allHolidays: Holiday[] = [];
  const yearsToFetch: number[] = [];
  
  // Check cache voor elk jaar
  for (const year of years) {
    const cached = getCachedHolidays(year);
    if (cached) {
      allHolidays.push(...cached);
    } else {
      yearsToFetch.push(year);
    }
  }
  
  // Als we geen jaren hoeven op te halen, return cached data
  if (yearsToFetch.length === 0) {
    return filterHolidaysByDateRange(allHolidays, startDate, endDate);
  }
  
  // Probeer API voor ontbrekende jaren
  for (const year of yearsToFetch) {
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      
      const url = `https://openholidaysapi.org/PublicHolidays?countryIsoCode=NL&languageIsoCode=nl&validFrom=${yearStart}&validTo=${yearEnd}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RoosterApp/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status}`);
      }
      
      const apiData: OpenHolidayApiResponse[] = await response.json();
      const yearHolidays = apiData.map(transformApiResponse);
      
      // Cache de resultaten
      setCachedHolidays(year, yearHolidays);
      allHolidays.push(...yearHolidays);
      
      console.log(`Fetched ${yearHolidays.length} holidays for year ${year} from API`);
      
    } catch (error) {
      console.warn(`Failed to fetch holidays for year ${year} from API, using fallback:`, error);
      
      // Gebruik fallback voor dit jaar
      const fallbackHolidays = getFallbackHolidaysForYears([year]);
      
      // Cache de fallback data (korter TTL)
      setCachedHolidays(year, fallbackHolidays);
      allHolidays.push(...fallbackHolidays);
      
      console.log(`Using ${fallbackHolidays.length} fallback holidays for year ${year}`);
    }
  }
  
  return filterHolidaysByDateRange(allHolidays, startDate, endDate);
}

/**
 * Transformeert OpenHoliday API response naar ons Holiday interface
 */
function transformApiResponse(apiResponse: OpenHolidayApiResponse): Holiday {
  // Zoek Nederlandse naam
  const dutchName = apiResponse.name.find(n => n.language === 'nl');
  const name = dutchName ? dutchName.text : apiResponse.name[0]?.text || 'Onbekende feestdag';
  
  return {
    date: apiResponse.startDate,
    name: name,
    type: apiResponse.type as Holiday['type']
  };
}

/**
 * Filtert feestdagen binnen een datum range
 */
function filterHolidaysByDateRange(holidays: Holiday[], startDate: string, endDate: string): Holiday[] {
  return holidays.filter(holiday => {
    return holiday.date >= startDate && holiday.date <= endDate;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Haalt alle jaren op uit een datum range
 */
function getYearsFromDateRange(startDate: string, endDate: string): number[] {
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  const years = [];
  
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  
  return years;
}

/**
 * Maakt een Set van feestdag datums voor snelle lookup
 */
export function createHolidaySet(holidays: Holiday[]): Set<string> {
  return new Set(holidays.map(h => h.date));
}

/**
 * Vindt een feestdag op een specifieke datum
 */
export function findHolidayByDate(holidays: Holiday[], date: string): Holiday | undefined {
  return holidays.find(h => h.date === date);
}
