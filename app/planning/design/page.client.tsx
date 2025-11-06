// Enhanced team normalization + robust color mapping + sorting + extended debug + SYNC
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType } from '@/lib/types/employee';

// ... rest van het bestand ...
export default function DesignPageClient() {
  // Alle benodigde states!
  const [holidays, setHolidays] = useState<Holiday[]>([]); // <-- Toegevoegd!
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  // ... overige states ...

  // ... rest van je functie ...
  async function loadHolidaysForPeriod(startISO: string) {
    setHolidaysLoading(true);
    try {
      const startDate = new Date(startISO + 'T00:00:00');
      const endDate = new Date(startDate); endDate.setDate(startDate.getDate() + (4 * 7) + 6);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const fetchedHolidays = await fetchNetherlandsHolidays(startStr, endStr);
      setHolidays(fetchedHolidays);
    } catch (error) {
      console.error('Error loading holidays:', error);
    } finally {
      setHolidaysLoading(false);
    }
  }
  // ... overige component code ...
}
// ... einde bestand ...
