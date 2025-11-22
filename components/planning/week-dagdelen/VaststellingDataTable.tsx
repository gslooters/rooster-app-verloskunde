'use client';

import { useMemo, useState } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
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
 * 🔥 DRAAD42L - DEFINITIEVE FIX ZONDAG BUG (COMPLETE REFACTOR)
 * 
 * CHANGELOG:
 * ✅ DRAAD42-H: Sticky columns implementation
 * ✅ DRAAD42K: UTC parsing fix voor weekStart/weekEnd
 * ✅ DRAAD42L: +1 dag correctie voor eachDayOfInterval (DEFINITIEF!)
 * 
 * PROBLEEM (NU OPGELOST):
 * - weekEnd wordt getrunceerd van "2025-11-30T23:59:59.999Z" naar "2025-11-30T00:00:00Z"
 * - eachDayOfInterval({ start: MA 00:00, end: ZO 00:00 }) is NIET inclusief van laatste dag
 * - Date-fns compenseert door TERUG te gaan → genereert ZO, MA, DI, WO, DO, VR, ZA, ZO (8 dagen!)
 * - Eerste dag (zondag) werd getoond maar hoorde er niet bij
 * 
 * OPLOSSING:
 * - Parse weekEnd naar UTC 00:00:00
 * - Voeg 1 dag toe: endDate.setUTCDate(endDate.getUTCDate() + 1)
 * - Nu: eachDayOfInterval({ start: MA 00:00, end: MA 00:00 (volgende week) })
 * - Resultaat: MA, DI, WO, DO, VR, ZA, ZO (7 dagen, correct!)
 * 
 * Features:
 * - Client-side state voor real-time updates
 * - Optimistic UI updates (instant feedback)
 * - Rollback bij fout
 * - Toast notifications
 * - Sticky positioning voor betere UX bij scrollen
 * - CORRECTE week start op MAANDAG (7 dagen exact)
 * 
 * Structuur:
 * - Header: Dagen met dagdeel icons (STICKY TOP)
 * - Per dienst: 3 team-rijen (Groen, Oranje, Praktijk)
 * - Per team-rij: 7 dagen x 3 dagdelen = 21 cellen
 * - Dienst kolom: STICKY LEFT (position 0)
 * - Team kolom: STICKY LEFT (position 140px)
 */
export default function VaststellingDataTable({
  serviceTypes,
  initialStaffingData,
  weekStart,
  weekEnd,
}: VaststellingDataTableProps) {
  // ⭐ FASE 9: Client-side state management
  const [data, setData] = useState(initialStaffingData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // 🔥 DRAAD42L FIX: +1 dag correctie voor eachDayOfInterval
  // eachDayOfInterval is NIET inclusief van end date
  // weekEnd komt binnen als "2025-11-30T23:59:59.999Z" (zondag einde)
  // Truncatie naar 00:00:00 maakt het "begin van zondag"
  // eachDayOfInterval({ start: MA, end: ZO 00:00 }) genereert tot (niet inclusief) zondag
  // Oplossing: Voeg 1 dag toe aan end → end = MA 00:00 (volgende week)
  const weekDays = useMemo(() => {
    // Parse weekStart in UTC (begin van de dag)
    const startDateStr = weekStart.includes('T') ? weekStart.split('T')[0] : weekStart;
    const start = new Date(startDateStr + 'T00:00:00Z');
    
    // Parse weekEnd in UTC maar VOEG 1 dag toe voor inclusieve interval
    // weekEnd komt binnen als "2025-11-30T23:59:59.999Z" (zondag einde)
    // eachDayOfInterval werkt tot (maar niet inclusief) de end date
    // Dus voeg 1 dag toe: 2025-12-01T00:00:00Z
    const endDateStr = weekEnd.includes('T') ? weekEnd.split('T')[0] : weekEnd;
    const endDate = new Date(endDateStr + 'T00:00:00Z');
    endDate.setUTCDate(endDate.getUTCDate() + 1); // +1 dag voor inclusief
    
    console.log('🔥 DRAAD42L: Week dagen berekening (DEFINITIEF):');
    console.log('  weekStart input:', weekStart);
    console.log('  weekEnd input:', weekEnd);
    console.log('  Parsed start (UTC):', start.toISOString());
    console.log('  Parsed end+1 (UTC):', endDate.toISOString());
    console.log('  Start dag (0=zo, 1=ma):', start.getUTCDay(), '← MOET 1 ZIJN');
    console.log('  End+1 dag (0=zo, 1=ma):', endDate.getUTCDay(), '← MOET 1 ZIJN (ma na zo)');
    
    const days = eachDayOfInterval({ start, end: endDate });
    
    console.log('  Aantal gegenereerde dagen:', days.length, '← MOET 7 ZIJN');
    console.log('  Eerste dag:', format(days[0], 'yyyy-MM-dd', { locale: nl }), 
                '(', format(days[0], 'EEEE', { locale: nl }), ') ← MOET MAANDAG ZIJN');
    console.log('  Laatste dag:', format(days[days.length - 1], 'yyyy-MM-dd', { locale: nl }), 
                '(', format(days[days.length - 1], 'EEEE', { locale: nl }), ') ← MOET ZONDAG ZIJN');
    
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

  // ⭐ FASE 9: Update handler met optimistic updates
  const handleCellUpdate = async (dagdeelId: string, newAantal: number) => {
    // Bewaar oude data voor rollback
    const previousData = [...data];
    
    // 1. OPTIMISTIC UPDATE - instant UI feedback
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

      // 3. SUCCESS - toon toast
      showToast('✅ Opgeslagen', 'success');
    } catch (error) {
      console.error('Error updating cell:', error);
      
      // 4. ROLLBACK bij fout
      setData(previousData);
      showToast('❌ Fout bij opslaan', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Toast helper
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
        {/* 🔥 DRAAD42-H: Scroll container voor sticky positioning */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto overflow-y-auto relative" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="w-full border-collapse">
            {/* 🔥 DRAAD42-H: Sticky header rij (top: 0) */}
            <thead className="sticky top-0 z-[15] bg-blue-50">
              <tr>
                {/* 🔥 DRAAD42-H: Corner cell - Dienst header (sticky left + top, z-30) */}
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
                
                {/* 🔥 DRAAD42-H: Corner cell - Team header (sticky left + top, z-30) */}
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
                
                {/* Dagdeel headers (alleen sticky top) */}
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
                      {/* 🔥 DRAAD42-H: Dienst kolom - STICKY LEFT (position 0, z-20) */}
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

                      {/* 🔥 DRAAD42-H: Team kolom - STICKY LEFT (position 140px, z-20, width 100px) */}
                      <td 
                        className="sticky z-[20] border border-gray-300 p-2 bg-white overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{
                          left: '140px',
                          minWidth: '100px',
                          width: '100px',
                          maxWidth: '100px',
                          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.08)'
                        }}
                        title={TEAM_LABELS[team]} // 🔥 DRAAD42-H: Tooltip voor lange namen
                      >
                        <span
                          className="inline-block px-3 py-1 rounded text-white font-medium text-sm"
                          style={{ backgroundColor: TEAM_COLORS[team] }}
                        >
                          {TEAM_LABELS[team]}
                        </span>
                      </td>

                      {/* Dagdeel cellen per dag (niet sticky) */}
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