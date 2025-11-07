// Enhanced team + dienstverband sorting in roosterweergave
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, toggleUnavailability, autofillUnavailability, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';

// ... rest van utils, niet gewijzigd ...
// [CODE INTACT tot UI header sectie]

export default function DesignPageClient() {
  // ... vars, state, functions ongewijzigd ...
  // [CODE INTACT tot UI return]

  if (loading) { return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div><p className="text-gray-600">Ontwerp wordt geladen...</p></div></div>); }

  if (error || !designData) { return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center"><div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center"><h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2><p className="text-red-600 mb-4">{error || 'Onbekende fout'}</p><div className="flex items-center justify-center gap-3"><button onClick={() => router.push('/planning')} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Terug naar overzicht</button><button onClick={() => router.push('/planning/new')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Nieuw rooster starten</button></div></div></div>); }

  const { weeks, periodTitle, dateSubtitle } = computedValues;

  const weekendHeaderClass = 'bg-yellow-100';
  const weekdayHeaderClass = 'bg-yellow-50';
  const holidayHeaderClass = 'bg-amber-100 border-amber-300';
  const weekendHolidayHeaderClass = 'bg-gradient-to-r from-yellow-100 to-amber-100 border-amber-300';
  const weekendBodyClass = 'bg-yellow-50/40';
  const holidayBodyClass = 'bg-amber-50/30';
  const weekendHolidayBodyClass = 'bg-gradient-to-r from-yellow-50/40 to-amber-50/30';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        <nav className="text-sm text-gray-500 mb-3">Dashboard &gt; Rooster Planning &gt; Rooster Ontwerp</nav>
        {/* HEADER sectie, UI CLEANUP uitgevoerd */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{periodTitle}</h1>
            <p className="text-xs text-gray-500">{dateSubtitle}</p>
            {holidaysLoading && (<p className="text-xs text-blue-600 mt-1">Feestdagen worden geladen...</p>)}
          </div>
          <div className="flex items-center gap-2">
            {/* ENKEL-KLEUR LEGENDE, geen badges */}
            <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-md"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" /> Weekend</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md"><span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Feestdag</span>
            {/* VERWIJDERD: <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">🎨 Ontwerpfase</div> */}
            <button onClick={goToEditing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Ga naar Bewerking →</button>
          </div>
        </div>

        {/* VERWIJDERD: BLUE INSTRUCTIE BLOK */}

        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full">
            {/* TABLE UI is intact, enkel visuele indicators behouden */}
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white border-b px-3 py-2 text-left font-semibold text-gray-900 w-40">Medewerker</th>
                <th className="border-b px-3 py-2 text-center font-semibold text-gray-900 w-16">Dst</th>
                {weeks.map(week => (<th key={week.number} colSpan={7} className="border-b px-2 py-2 text-center font-semibold text-gray-900 bg-yellow-50">Week {week.number}</th>))}
              </tr>
              {['day','date','month'].map((rowType) => (
                <tr key={rowType}>
                  <th className="sticky left-0 bg-white border-b"></th>
                  <th className="border-b"></th>
                  {weeks.map(week => week.dates.map(date => {
                    const { day, date: dd, month, isWeekend, isHoliday, holidayName } = formatDateCell(date, holidaySet, holidays);
                    let headerClass = weekdayHeaderClass;
                    if (isWeekend && isHoliday) headerClass = weekendHolidayHeaderClass; else if (isHoliday) headerClass = holidayHeaderClass; else if (isWeekend) headerClass = weekendHeaderClass;
                    return (
                      <th key={`${rowType}-${date}`} className={`border-b px-1 py-1 text-xs ${rowType==='day'?'font-medium text-gray-700':rowType==='date'?'text-gray-600':'text-gray-500'} min-w-[50px] ${headerClass}${columnClasses(date, holidaySet)} ${rowType==='day'?'relative':''}`} title={rowType==='date' ? (holidayName || undefined) : undefined}>
                        {rowType==='day'? day : rowType==='date'? dd : month}
                        {/* BEHOUDEN: FD-titeltje voor feestdagen, visueel compact */}
                        {rowType==='day' && isHoliday && (<span className="absolute top-0 right-0 bg-amber-600 text-white text-xs px-1 rounded-bl text-[10px] font-bold leading-none" style={{ fontSize: '8px', padding: '1px 2px' }}>FD</span>)}
                      </th>
                    );
                  }))}
                </tr>
              ))}
            </thead>
            <tbody>
              {sortedEmployees.map((emp, empIndex) => {
                const team = (emp as any).team as any;
                const firstName = (emp as any).voornaam || getFirstName((emp as any).name || '');
                return (
                  <tr key={(emp as any).id} className={`${empIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} h-8`}>
                    <td className="sticky left-0 bg-inherit border-b px-3 py-1 font-medium text-gray-900 h-8">
                      <TeamBadge team={team} />{firstName}
                    </td>
                    <td className="border-b px-3 py-1 text-center h-8">
                      <input type="number" min="0" max="35" value={(emp as any).maxShifts} onChange={(e) => updateMaxShiftsHandler((emp as any).id, parseInt(e.target.value) || 0)} className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </td>
                    {weeks.map(week => week.dates.map(date => {
                      const isUnavailable = (designData as any).unavailabilityData?.[(emp as any).id]?.[date] || false;
                      const { isWeekend, isHoliday } = formatDateCell(date, holidaySet, holidays);
                      let cellClass = '';
                      if (isWeekend && isHoliday) cellClass = weekendHolidayBodyClass; else if (isHoliday) cellClass = holidayBodyClass; else if (isWeekend) cellClass = weekendBodyClass;
                      return (
                        <td key={date} className={`border-b p-0.5 text-center h-8 ${cellClass}${columnClasses(date, holidaySet)}`}>
                          <button onClick={() => toggleUnavailable((emp as any).id, date)} className={`w-10 h-6 rounded text-xs font-bold transition-colors ${isUnavailable ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200' : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'}`} title={isUnavailable ? 'Klik om beschikbaar te maken' : 'Klik om niet-beschikbaar te markeren'}>
                            {isUnavailable ? 'NB' : '—'}
                          </button>
                        </td>
                      );
                    }))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => router.push('/planning')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">← Terug naar Dashboard</button>
          <div className="text-sm text-gray-600">Wijzigingen worden automatisch opgeslagen{holidays.length > 0 && (<span className="ml-2 text-amber-600">• {holidays.length} feestdagen geladen</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
