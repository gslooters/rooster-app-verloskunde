'use client';

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import EditableCell from './EditableCell';
import type { ServiceType, StaffingDagdeel } from '@/types/planning';
import { 
  formatWeekdayDate, 
  formatWeekdayFull,
  formatDateDMY,
  assertMonday,
  assertSunday,
  parseUTCDate
} from '@/lib/date-utils';

interface VaststellingDataTableProps {
  serviceTypes: ServiceType[];
  initialStaffingData: StaffingDagdeel[];
  weekStart: string;
  weekEnd: string;
}

type Team = 'Groen' | 'Oranje' | 'TOT';
type Dagdeel = 'O' | 'M' | 'A';

const TEAMS: Team[] = ['Groen', 'Oranje', 'TOT'];
const DAGDELEN: Dagdeel[] = ['O', 'M', 'A'];

const TEAM_COLORS = {
  Groen: '#22c55e',
  Oranje: '#f97316',
  TOT: '#3b82f6',
};

const TEAM_LABELS = {
  Groen: 'Groen',
  Oranje: 'Oranje',
  TOT: 'Praktijk',
};

const DAGDEEL_ICONS = {
  O: '🌅', // Ochtend
  M: '☀️',   // Middag
  A: '🌙', // Avond
};

/**
 * 🔥 DRAAD45.8: TYPESCRIPT TYPE FIX
 * 
 * ROOT CAUSE:
 * - TypeScript type check faalt: team === 'Tot' (mixed case)
 * - Type definitie: Team = 'Groen' | 'Oranje' | 'TOT' (uppercase TOT)
 * - Result: "types have no overlap" compile error
 * 
 * FIX:
 * - Verwijder onnodige team mapping (team is al correct type)
 * - Mapping dagdeel blijft: 'O' (letter) → '0' (cijfer)
 * - Gebruik service_id voor lookup (was service_type_id)
 * 
 * VERIFICATIE:
 * - TypeScript compile succesvol
 * - Correcte data matching in UI
 */
export default function VaststellingDataTable({
  serviceTypes,
  initialStaffingData,
  weekStart,
  weekEnd,
}: VaststellingDataTableProps) {
  // ⭐ Client-side state management
  const [data, setData] = useState(initialStaffingData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Debug: Log initial data structure
  useMemo(() => {
    console.log('🔍 [DRAAD45.8] Initial staffing data sample:', {
      totalRecords: initialStaffingData.length,
      sample: initialStaffingData[0],
      hasDateProperty: initialStaffingData[0]?.hasOwnProperty('date'),
      dateValue: initialStaffingData[0]?.['date' as keyof StaffingDagdeel],
    });
  }, [initialStaffingData]);

  // 🔥 DRAAD1F: EXPLICIETE 7-DAGEN GENERATIE MET UTC FORMATTING
  const weekDays = useMemo(() => {
    console.log('═'.repeat(60));
    console.log('🔥 DRAAD1F: CLIENT-SIDE WEEK DAGEN GENERATIE (UTC FORMATTING)');
    console.log('═'.repeat(60));
    
    // STAP 1: Parse weekStart als UTC (begin van de dag)
    const start = parseUTCDate(weekStart);
    
    console.log('📅 INPUT:', {
      weekStartRaw: weekStart,
      weekEndRaw: weekEnd,
      startUTC: start.toISOString()
    });
    
    // STAP 2: VALIDATIE - weekStart MOET maandag zijn
    try {
      assertMonday(start, 'Week start');
      console.log('✅ PRE-VALIDATIE PASSED: weekStart is maandag');
    } catch (error) {
      console.error('❌ KRITIEKE FOUT:', error);
      throw error;
    }
    
    // STAP 3: GENEREER EXACT 7 DAGEN (EXPLICIETE LOOP)
    console.log('\n🔄 GENEREER 7 DAGEN (EXPLICIETE LOOP):');
    const days: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(start, i);
      days.push(dayDate);
      
      // Log eerste en laatste dag voor verificatie
      if (i === 0 || i === 6) {
        const dayOfWeek = dayDate.getUTCDay();
        const verwachtDag = i === 0 ? 1 : 0; // maandag=1, zondag=0
        console.log(`  Dag ${i} (${i === 0 ? 'EERSTE' : 'LAATSTE'}):`, {
          datum: dayDate.toISOString().split('T')[0],
          dagVanWeek: dayOfWeek,
          dagNaam: formatWeekdayFull(dayDate),
          verwacht: verwachtDag,
          correct: dayOfWeek === verwachtDag ? '✅' : '❌'
        });
      }
    }
    
    console.log(`\n📊 TOTAAL GEGENEREERD: ${days.length} dagen`);
    
    // STAP 4: POST-VALIDATIE - Controleer resultaat
    console.log('\n🔍 POST-VALIDATIE:');
    
    // Validatie 1: Lengte moet 7 zijn
    if (days.length !== 7) {
      const errorMsg = `❌ FOUT: Aantal dagen is ${days.length}, verwacht 7`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    console.log('  ✅ Lengte: 7 dagen CORRECT');
    
    // Validatie 2: Eerste dag moet maandag zijn
    try {
      assertMonday(days[0], 'Eerste dag');
      console.log('  ✅ Eerste dag: Maandag CORRECT');
    } catch (error) {
      console.error('❌ FOUT:', error);
      throw error;
    }
    
    // Validatie 3: Laatste dag moet zondag zijn
    try {
      assertSunday(days[6], 'Laatste dag');
      console.log('  ✅ Laatste dag: Zondag CORRECT');
    } catch (error) {
      console.error('❌ FOUT:', error);
      throw error;
    }
    
    console.log('\n✅ DRAAD1F: Timezone validaties PASSED');
    console.log('📦 RESULTAAT:', {
      aantalDagen: days.length,
      periode: `${formatDateDMY(days[0])} t/m ${formatDateDMY(days[6])}`,
      eersteDag: formatWeekdayFull(days[0]),
      laatsteDag: formatWeekdayFull(days[6])
    });
    console.log('═'.repeat(60));
    
    // STAP 5: Map naar UI-formaat (MET UTC FORMATTING!)
    return days.map(date => {
      const dayName = formatWeekdayFull(date).substring(0, 2);
      const dateStr = formatWeekdayDate(date).split(' ')[1]; // Extract dd/MM deel
      const fullDate = date.toISOString().split('T')[0]; // yyyy-MM-dd
      
      return {
        date,
        dayName,
        dateStr,
        fullDate,
      };
    });
  }, [weekStart, weekEnd]);

  // 🔥 DRAAD45.8 FIX: Correcte dagdeel mapping zonder TypeScript errors
  function findDagdeelData(
    serviceTypeId: string,
    datum: string,
    team: Team,
    dagdeel: Dagdeel
  ): StaffingDagdeel | undefined {
    // Mapping dagdeel: verander 'O' (letter) → '0' (cijfer) voor ochtend
    const dagdeelMatch = dagdeel === 'O' ? '0' : dagdeel;
    
    // Team mapping niet nodig: type is al correct (Team = 'Groen' | 'Oranje' | 'TOT')
    // Database verwacht ook exact deze waarden
    
    return data.find(
      item =>
        item.service_id === serviceTypeId &&
        item.date === datum &&
        item.team === team &&
        item.dagdeel === dagdeelMatch
    );
  }

  // ⭐ Update handler met optimistic updates
  const handleCellUpdate = async (dagdeelId: string, newAantal: number) => {
    const previousData = [...data];
    setData(prev =>
      prev.map(item =>
        item.id === dagdeelId ? { ...item, aantal: newAantal } : item
      )
    );
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/planning/dagdelen/${dagdeelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aantal: newAantal }),
      });
      if (!response.ok) {
        throw new Error('Update failed');
      }
      showToast('✅ Opgeslagen', 'success');
    } catch (error) {
      console.error('Error updating cell:', error);
      setData(previousData);
      showToast('❌ Fout bij opslaan', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div
            className={`px-6 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      <div className="px-6 py-4">
        {/* Scroll container voor sticky positioning */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto overflow-y-auto relative" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="w-full border-collapse">
            {/* Sticky header */}
            <thead className="sticky top-0 z-[15] bg-blue-50">
              <tr>
                {/* Corner cell - Dienst header (sticky left + top) */}
                <th 
                  className="sticky left-0 top-0 z-[30] border border-gray-300 p-3 bg-blue-100 font-semibold text-gray-800" 
                  style={{ 
                    minWidth: '140px',
                    width: '140px',
                    boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  Dienst
                </th>
                <th 
                  className="sticky top-0 z-[30] border border-gray-300 p-3 bg-blue-100 font-semibold text-gray-800"
                  style={{ 
                    left: '140px',
                    minWidth: '100px',
                    width: '100px',
                    maxWidth: '100px',
                    boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.08)'
                  }}
                  title="Team kolom"
                >
                  Team
                </th>
                {/* Dagdeel headers */}
                {weekDays.map(day => (
                  <th
                    key={day.fullDate}
                    className="border border-gray-300 p-2 bg-blue-100"
                    colSpan={3}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-gray-800 text-sm">
                        {day.dayName} {day.dateStr}
                      </div>
                      <div className="flex justify-around mt-1 text-base">
                        <span title="Ochtend">{DAGDEEL_ICONS.O}</span>
                        <span title="Middag">{DAGDEEL_ICONS.M}</span>
                        <span title="Avond">{DAGDEEL_ICONS.A}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {serviceTypes.map(service => (
                <React.Fragment key={service.id}>
                  {TEAMS.map((team, teamIndex) => (
                    <tr key={`${service.id}-${team}`} className="hover:bg-gray-50">
                      {/* Dienst kolom - STICKY LEFT */}
                      {teamIndex === 0 && (
                        <td
                          rowSpan={3}
                          className="sticky left-0 z-[20] border border-gray-300 p-3 font-medium align-top bg-white"
                          style={{
                            minWidth: '140px',
                            width: '140px',
                            boxShadow: '2px 0 4px rgba(0, 0, 0, 0.08)'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block px-3 py-1 rounded text-white font-semibold text-sm"
                              style={{ backgroundColor: service.kleur }}
                            >
                              {service.code}
                            </span>
                            <span className="text-gray-800 text-sm">{service.naam}</span>
                          </div>
                        </td>
                      )}
                      {/* Team kolom - STICKY LEFT */}
                      <td 
                        className="sticky z-[20] border border-gray-300 p-2 bg-white overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{
                          left: '140px',
                          minWidth: '100px',
                          width: '100px',
                          maxWidth: '100px',
                          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.08)'
                        }}
                        title={TEAM_LABELS[team]}
                      >
                        <span
                          className="inline-block px-3 py-1 rounded text-white font-medium text-sm"
                          style={{ backgroundColor: TEAM_COLORS[team] }}
                        >
                          {TEAM_LABELS[team]}
                        </span>
                      </td>
                      {/* Dagdeel cellen */}
                      {weekDays.map(day =>
                        DAGDELEN.map(dagdeel => {
                          const dagdeelData = findDagdeelData(
                            service.id,
                            day.fullDate,
                            team,
                            dagdeel
                          );
                          return (
                            <EditableCell
                              key={`${service.id}-${team}-${day.fullDate}-${dagdeel}`}
                              dagdeelId={dagdeelData?.id}
                              status={dagdeelData?.status || 'MAG'}
                              aantal={dagdeelData?.aantal || 0}
                              onUpdate={handleCellUpdate}
                            />
                          );
                        })
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* Legenda */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Legenda:</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
              <span>🔴 MOET (verplicht)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
              <span>🟢 MAG (optioneel)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#9ca3af]"></div>
              <span>⚪ MAG-NIET (niet toegestaan)</span>
            </div>
          </div>
        </div>
        {/* Update indicator */}
        {isUpdating && (
          <div className="fixed bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Opslaan...</span>
          </div>
        )}
      </div>
    </>
  );
}
// React import voor Fragment
import React from 'react';
