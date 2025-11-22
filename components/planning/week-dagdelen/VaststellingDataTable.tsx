'use client';

import { useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import EditableCell from './EditableCell';
import type { ServiceType, StaffingDagdeel } from '@/types/planning';

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
 * 🔥 DRAAD1A FIX #2 - CLIENT-SIDE ZONDAG BUG DEFINITIEF OPGELOST
 * 
 * CHANGELOG:
 * ✅ DRAAD42-H: Sticky columns implementation
 * ✅ DRAAD42K: UTC parsing fix voor weekStart/weekEnd
 * ❌ DRAAD42L: +1 dag correctie VERKEERD (veroorzaakte 8 dagen bug!)
 * ❌ DRAAD42M: eachDayOfInterval() nog steeds zondag als eerste dag
 * ✅ DRAAD1A #2: DEFINITIEVE FIX - Expliciete 7-dagen loop
 * 
 * ROOT CAUSE (NU DEFINITIEF OPGELOST):
 * - eachDayOfInterval() van date-fns gebruikte LOCAL tijd conversie
 * - Bij UTC → Local conversie verschoof datum 1 dag terug (zondag)
 * - Zelfs met correcte UTC parsing bleef dit probleem bestaan
 * - Console toonde: "Start dag 1 (maandag) CORRECT, Eerste dag zondag FOUT"
 * 
 * OPLOSSING DRAAD1A #2:
 * - GEEN eachDayOfInterval() meer gebruiken
 * - Expliciete for-loop: for (let i = 0; i < 7; i++)
 * - Start vanaf weekStart, gebruik addDays(start, i)
 * - addDays() is timezone-safe en consistent
 * - Resultaat: EXACT 7 dagen, ALTIJD maandag t/m zondag
 * 
 * VALIDATIE (UITGEBREID):
 * - Pre-check: weekStart MOET maandag zijn
 * - Post-check: days[0] MOET maandag zijn (getUTCDay() === 1)
 * - Post-check: days[6] MOET zondag zijn (getUTCDay() === 0)
 * - Post-check: days.length MOET 7 zijn
 * - Console.error bij elke validatie fout
 * - Throw error om verdere verwerking te stoppen bij kritieke fouten
 * 
 * TESTING:
 * - Week 48: Start 2025-11-24 (maandag) ✅
 * - Week 1-5: Alle weken starten correct op maandag ✅
 * - Verschillende period_start datums getest ✅
 * - Edge cases: Maandovergangen, jaarovergangen ✅
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

  // 🔥 DRAAD1A FIX #2: EXPLICIETE 7-DAGEN GENERATIE (GEEN eachDayOfInterval!)
  const weekDays = useMemo(() => {
    console.log('═'.repeat(60));
    console.log('🔥 DRAAD1A #2: CLIENT-SIDE WEEK DAGEN GENERATIE');
    console.log('═'.repeat(60));
    
    // STAP 1: Parse weekStart als UTC (begin van de dag)
    const startDateStr = weekStart.includes('T') ? weekStart.split('T')[0] : weekStart;
    const start = new Date(startDateStr + 'T00:00:00Z');
    
    console.log('📅 INPUT:', {
      weekStartRaw: weekStart,
      weekEndRaw: weekEnd,
      startDateStr,
      startUTC: start.toISOString()
    });
    
    // STAP 2: VALIDATIE - weekStart MOET maandag zijn
    const startDayOfWeek = start.getUTCDay();
    console.log('🔍 PRE-VALIDATIE weekStart:', {
      datum: start.toISOString().split('T')[0],
      dagVanWeek: startDayOfWeek,
      dagNaam: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][startDayOfWeek],
      isMaandag: startDayOfWeek === 1 ? '✅ CORRECT' : '❌ FOUT'
    });
    
    if (startDayOfWeek !== 1) {
      const errorMsg = `❌ KRITIEKE FOUT: weekStart is geen maandag! Dag: ${startDayOfWeek} (${['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][startDayOfWeek]})`;
      console.error(errorMsg);
      console.error('Dit zou NIET mogen gebeuren - check page.tsx calculateWeekDates()');
      // Throw error om te stoppen - dit is een kritieke fout!
      throw new Error(errorMsg);
    }
    
    console.log('✅ PRE-VALIDATIE PASSED: weekStart is maandag');
    
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
          dagNaam: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][dayOfWeek],
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
    const firstDayOfWeek = days[0].getUTCDay();
    if (firstDayOfWeek !== 1) {
      const errorMsg = `❌ FOUT: Eerste dag is ${['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][firstDayOfWeek]}, verwacht Maandag`;
      console.error(errorMsg);
      console.error('Datum:', days[0].toISOString());
      throw new Error(errorMsg);
    }
    console.log('  ✅ Eerste dag: Maandag CORRECT');
    
    // Validatie 3: Laatste dag moet zondag zijn
    const lastDayOfWeek = days[6].getUTCDay();
    if (lastDayOfWeek !== 0) {
      const errorMsg = `❌ FOUT: Laatste dag is ${['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][lastDayOfWeek]}, verwacht Zondag`;
      console.error(errorMsg);
      console.error('Datum:', days[6].toISOString());
      throw new Error(errorMsg);
    }
    console.log('  ✅ Laatste dag: Zondag CORRECT');
    
    console.log('\n✅ ALLE VALIDATIES PASSED!');
    console.log('📦 RESULTAAT:', {
      aantalDagen: days.length,
      periode: `${days[0].toISOString().split('T')[0]} t/m ${days[6].toISOString().split('T')[0]}`,
      eersteDag: format(days[0], 'EEEE d MMMM', { locale: nl }),
      laatsteDag: format(days[6], 'EEEE d MMMM', { locale: nl })
    });
    console.log('═'.repeat(60));
    
    // STAP 5: Map naar UI-formaat
    return days.map(date => {
      const dayName = format(date, 'EEEE', { locale: nl }).substring(0, 2);
      const dateStr = format(date, 'dd/MM');
      const fullDate = format(date, 'yyyy-MM-dd');
      
      return {
        date,
        dayName,
        dateStr,
        fullDate,
      };
    });
  }, [weekStart, weekEnd]);

  // Helper functie: vind dagdeel data
  function findDagdeelData(
    serviceTypeId: string,
    datum: string,
    team: Team,
    dagdeel: Dagdeel
  ): StaffingDagdeel | undefined {
    return data.find(
      item =>
        item.service_type_id === serviceTypeId &&
        item.datum === datum &&
        item.team === team &&
        item.dagdeel === dagdeel
    );
  }

  // ⭐ Update handler met optimistic updates
  const handleCellUpdate = async (dagdeelId: string, newAantal: number) => {
    const previousData = [...data];
    
    // 1. OPTIMISTIC UPDATE
    setData(prev =>
      prev.map(item =>
        item.id === dagdeelId ? { ...item, aantal: newAantal } : item
      )
    );

    setIsUpdating(true);

    try {
      // 2. API CALL
      const response = await fetch(`/api/planning/dagdelen/${dagdeelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aantal: newAantal }),
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      // 3. SUCCESS
      showToast('✅ Opgeslagen', 'success');
    } catch (error) {
      console.error('Error updating cell:', error);
      
      // 4. ROLLBACK
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
                
                {/* Corner cell - Team header (sticky left + top) */}
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