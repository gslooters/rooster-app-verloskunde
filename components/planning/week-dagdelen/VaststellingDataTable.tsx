'use client';

import { useMemo } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { nl } from 'date-fns/locale';
import EditableCell from './EditableCell';
import type { ServiceType, StaffingDagdeel } from '@/types/planning';

interface VaststellingDataTableProps {
  serviceTypes: ServiceType[];
  staffingData: StaffingDagdeel[];
  weekStart: string;
  weekEnd: string;
  onCellUpdate: (dagdeelId: string, newAantal: number) => Promise<void>;
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
 * DRAAD42 - Data Tabel Component
 * 
 * Structuur:
 * - Header: Dagen met dagdeel icons
 * - Per dienst: 3 team-rijen (Groen, Oranje, Praktijk)
 * - Per team-rij: 7 dagen x 3 dagdelen = 21 cellen
 */
export default function VaststellingDataTable({
  serviceTypes,
  staffingData,
  weekStart,
  weekEnd,
  onCellUpdate,
}: VaststellingDataTableProps) {
  // Bereken alle dagen van de week
  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    return eachDayOfInterval({ start, end }).map(date => ({
      date,
      dayName: format(date, 'EEEE', { locale: nl }).substring(0, 2),
      dateStr: format(date, 'dd/MM'),
      fullDate: format(date, 'yyyy-MM-dd'),
    }));
  }, [weekStart, weekEnd]);

  // Helper functie: vind dagdeel data
  function findDagdeelData(
    serviceTypeId: string,
    datum: string,
    team: Team,
    dagdeel: Dagdeel
  ): StaffingDagdeel | undefined {
    return staffingData.find(
      item =>
        item.service_type_id === serviceTypeId &&
        item.datum === datum &&
        item.team === team &&
        item.dagdeel === dagdeel
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-blue-50 z-10">
            <tr>
              <th className="border border-gray-300 p-3 bg-blue-100 font-semibold text-gray-800 min-w-[200px]">
                Dienst
              </th>
              <th className="border border-gray-300 p-3 bg-blue-100 font-semibold text-gray-800 min-w-[120px]">
                Team
              </th>
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
                    {/* Dienst kolom (rowspan voor 3 teams) */}
                    {teamIndex === 0 && (
                      <td
                        rowSpan={3}
                        className="border border-gray-300 p-3 font-medium align-top"
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

                    {/* Team kolom */}
                    <td className="border border-gray-300 p-2">
                      <span
                        className="inline-block px-3 py-1 rounded text-white font-medium text-sm"
                        style={{ backgroundColor: TEAM_COLORS[team] }}
                      >
                        {TEAM_LABELS[team]}
                      </span>
                    </td>

                    {/* Dagdeel cellen per dag */}
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
                            onUpdate={onCellUpdate}
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
    </div>
  );
}

// React import voor Fragment
import React from 'react';
