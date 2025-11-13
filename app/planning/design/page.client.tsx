// Hersteld Rooster Ontwerp Grid - DRAAD27B fixes (dubbele autofill, assignments laden, correcte rendering)
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';

// ... helpers zoals extractTeamRaw(), normalizeTeam(), ... blijven hetzelfde

// Vervang useEffect --> fetchAndInitializeData door aangepaste versie:
useEffect(() => {
  if (!rosterId) { 
    setError('Geen roster ID gevonden'); 
    setLoading(false); 
    return; 
  }
  async function fetchAndInitializeData() {
    try {
      setLoading(true);
      if (typeof rosterId !== 'string') {
        setError('Geen geldig rooster ID gevonden');
        setLoading(false);
        return;
      }
      const data = await loadRosterDesignData(rosterId);
      if (data) {
        await syncRosterDesignWithEmployeeData(rosterId);
        const startISO = (data as any).start_date;
        if (!startISO) {
          setError('Geen periode data beschikbaar voor dit rooster');
          setLoading(false);
          return;
        }
        // --- FIX 1: NIET meer automatisch autofillUnavailability uitvoeren! ---
        // (deze gebeurt alleen bij aanmaken rooster)

        // --- FIX 2: Laad alle assignments uit rooster_assignments tabel ---
        const { getAssignmentsByRosterId } = await import('@/lib/services/roster-assignments-supabase');
        const assignments = await getAssignmentsByRosterId(rosterId);
        const latest = await loadRosterDesignData(rosterId) || data;
        setDesignData({ ...latest, assignments });
        setEmployees(latest.employees);
        if (startISO) { loadHolidaysForPeriod(startISO); }
      } else { 
        setError('Geen rooster ontwerp data gevonden'); 
      }
    } catch (err) { 
      setError('Fout bij laden van ontwerp data'); 
    } finally {
      setLoading(false);
    }
  }
  fetchAndInitializeData();
}, [rosterId]);

// --- Rendering cell fix (for body row loop): ---
// ...rest van de code identiek ...
{weeks.map(week => week.dates.map(date => {
  // Haal assignment op uit database
  const originalEmpId = (emp as any).originalEmployeeId || (emp as any).id;
  const assignment = (designData as any).assignments?.find(
    (a: any) => a.employee_id === originalEmpId && a.date === date
  );
  const serviceCode = assignment?.service_code || '';
  return (
    <td key={date} className={`border-b p-0.5 text-center h-8 ${columnClasses(date, holidaySet)}`}>
      {serviceCode === 'NB' ? (
        <span 
          className="inline-block w-10 h-6 bg-red-100 text-red-700 border border-red-300 rounded text-xs font-bold leading-6 text-center"
          title="Niet beschikbaar"
        >NB</span>
      ) : serviceCode ? (
        <span 
          className="inline-block w-10 h-6 bg-gray-200 text-gray-900 border border-gray-400 rounded text-xs leading-6 text-center font-medium"
          title={`Dienst: ${serviceCode}`}
        >{serviceCode}</span>
      ) : (
        <button 
          className="w-10 h-6 bg-gray-100 text-gray-400 border border-gray-300 rounded text-xs hover:bg-gray-200"
          disabled
          title="Geen dienst ingepland"
        >—</button>
      )}
    </td>
  );
}))}
// ...rest blijft gelijk ...
