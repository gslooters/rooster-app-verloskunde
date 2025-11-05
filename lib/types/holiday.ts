/**
 * TypeScript interfaces for Dutch holidays integration
 */

export interface Holiday {
  /** Date in ISO format YYYY-MM-DD */
  date: string;
  /** Nederlandse naam van de feestdag */
  name: string;
  /** Type feestdag */
  type: 'Public' | 'Bank' | 'School';
}

export interface HolidayCache {
  /** Array van feestdagen */
  data: Holiday[];
  /** Timestamp wanneer gecached */
  cachedAt: number;
  /** Jaar van de cached data */
  year: number;
}

export interface OpenHolidayApiResponse {
  /** ISO datum string */
  startDate: string;
  /** ISO datum string */
  endDate: string;
  /** Nederlandse naam */
  name: Array<{
    language: string;
    text: string;
  }>;
  /** Type feestdag */
  type: string;
}
