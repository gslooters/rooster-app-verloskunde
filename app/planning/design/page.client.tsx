// Fase 3: Read-Only badge cell rendering - DRAAD27E
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadRosterDesignData, updateEmployeeMaxShifts, syncRosterDesignWithEmployeeData } from '@/lib/planning/rosterDesign';
import { fetchNetherlandsHolidays, createHolidaySet, findHolidayByDate } from '@/lib/services/holidays-api';
import type { RosterDesignData, RosterEmployee } from '@/lib/types/roster';
import type { Holiday } from '@/lib/types/holiday';
import { TeamType, DienstverbandType } from '@/lib/types/employee';
import { getServiceTypeOrDefault, getContrastColor, darkenColor } from '@/lib/services/service-types-loader';
import findAssignmentForCell from '@/lib/planning/assignment-matcher';

// ... bestaande helpers extractTeamRaw, normalizeTeam, etc. ongewijzigd ...

function ServiceBadgeReadonly({ code, naam, kleur }: { code: string, naam: string, kleur: string }) {
  const textColor = getContrastColor(kleur);
  const borderColor = darkenColor(kleur, 20);
  return (
    <span
      className="inline-block w-10 h-6 rounded text-xs leading-6 text-center font-bold align-middle border"
      style={{ backgroundColor: kleur, color: textColor, border: `2px solid ${borderColor}` }}
      title={`Dienst: ${naam} (${code})`}
    >{code}</span>
  );
}

function EmptyCell() {
  return (
    <span className="inline-block w-10 h-6 rounded text-xs leading-6 text-center text-gray-400 border border-gray-300 bg-gray-50 font-normal">—</span>
  );
}

export default function DesignPageClient() {
  // ... zelfde setup en state
  // ... code up tot week rendering idem ...
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-full mx-auto">
        {/* ... header ... */}
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="min-w-full">
            {/* ... thead ongewijzigd ... */}
            <tbody>
              {sortedEmployees.map((emp, empIndex) => (
                <tr key={(emp as any).id} className={`${empIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} h-8`}>
                  <td className="sticky left-0 bg-inherit border-b px-3 py-1 font-medium text-gray-900 h-8">
                    <TeamBadge team={(emp as any).team} />{(emp as any).voornaam || getFirstName((emp as any).name || '')}
                  </td>
                  <td className="border-b px-3 py-1 text-center h-8">
                    <input 
                      type="number" 
                      min="0" 
                      max="35" 
                      value={(emp as any).maxShifts} 
                      onChange={(e) => updateEmployeeMaxShiftsHandler((emp as any).id, parseInt(e.target.value) || 0)} 
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      aria-label="Max aantal diensten" />
                  </td>
                  {weeks.map(week => week.dates.map(date => {
                    const assignment = findAssignmentForCell((designData as any).assignments || [], emp, date);
                    if (!assignment) return <td key={date} className={`border-b p-0.5 text-center h-8`}><EmptyCell /></td>;
                    // fetch color by code via loader utility
                    const [svc, setSvc] = useState<{ code: string, naam: string, kleur: string }>({ code: assignment.service_code, naam: assignment.service_code, kleur: '#94a3b8' });
                    useEffect(() => {
                      getServiceTypeOrDefault(assignment.service_code).then(st => setSvc({ code: st.code, naam: st.naam, kleur: st.kleur }));
                    }, [assignment.service_code]);
                    return <td key={date} className={`border-b p-0.5 text-center h-8`}><ServiceBadgeReadonly code={svc.code} naam={svc.naam} kleur={svc.kleur} /></td>;
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* ... overige onderdelen ... */}
      </div>
    </div>
  );
}
