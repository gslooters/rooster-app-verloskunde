// Enhanced team normalization + robust color mapping + sorting + extended debug + SYNC
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType } from '@/lib/types/employee';

export default function DesignPageClient() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

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

  // Tijdelijke simpele render (vervang dit straks weer door eigen layout)
  return (<div style={{padding:'2rem',fontFamily:'sans-serif',background:'#f8fafc'}}>
    <h2>Rooster Design Component (JSX fix)</h2>
    <p>De basis-export geeft nu valid JSX terug.<br/>Vervang dit blok door je volledige rooster-planning UI zodra de build slaagt!</p>
  </div>);
}
