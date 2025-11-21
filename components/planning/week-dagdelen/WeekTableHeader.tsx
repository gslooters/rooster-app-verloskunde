'use client';

import React from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface WeekDag {
  datum: string;
  dagSoort: 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';
}

interface WeekTableHeaderProps {
  weekDagen: WeekDag[];
}

/**
 * DRAAD40B5: Compacte Header Layout + TEST123 Marker
 * 
 * Wijzigingen:
 * - Alleen emoji's, geen dagdeel teksten (Ochtend/Middag/Avond)
 * - Compactere kolommen voor 100% zoom zichtbaarheid
 * - Emoji's groter (text-3xl) voor betere leesbaarheid
 * - Kleinere padding voor space efficiency
 * - TEST123 marker toegevoegd voor build verificatie
 */

const DAGDEEL_EMOJI = {
  O: '🌅',
  M: '☀️',
  A: '🌙'
} as const;

export function WeekTableHeader({ weekDagen }: WeekTableHeaderProps) {
  const formatDatum = (datum: string) => {
    const date = new Date(datum);
    return format(date, 'd/M', { locale: nl });
  };

  return (
    <thead className="sticky top-[144px] z-30 bg-blue-50">
      {/* Row 1: Datums */}
      <tr>
        <th 
          rowSpan={2} 
          className="frozen-left-1 text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[140px]"
        >
          <div className="flex flex-col items-center">
            <span>Dienst</span>
            <span className="text-xs font-black text-red-600 bg-yellow-300 px-2 py-0.5 rounded mt-1 animate-pulse">
              TEST123
            </span>
          </div>
        </th>
        <th 
          rowSpan={2} 
          className="frozen-left-2 text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[110px]"
        >
          Team
        </th>
        {weekDagen.map((dag) => (
          <th
            key={dag.datum}
            colSpan={3}
            className="text-center border-l-2 border-gray-400 border-t border-r border-gray-300 p-1.5 bg-blue-100"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-bold text-sm text-gray-800 uppercase">
                {dag.dagSoort}
              </span>
              <span className="text-xs text-gray-600 font-medium">
                {formatDatum(dag.datum)}
              </span>
            </div>
          </th>
        ))}
      </tr>
      
      {/* Row 2: Dagdeel emoji's (ALLEEN emoji's, geen tekst) */}
      <tr>
        {weekDagen.map((dag) => (
          <React.Fragment key={`dagdelen-${dag.datum}`}>
            {/* Ochtend - Alleen emoji */}
            <th className="dagdeel-header text-center border border-gray-300 p-1 bg-orange-50 min-w-[50px]">
              <span className="text-3xl" role="img" aria-label="Ochtend">
                {DAGDEEL_EMOJI.O}
              </span>
            </th>
            {/* Middag - Alleen emoji */}
            <th className="dagdeel-header text-center border border-gray-300 p-1 bg-yellow-50 min-w-[50px]">
              <span className="text-3xl" role="img" aria-label="Middag">
                {DAGDEEL_EMOJI.M}
              </span>
            </th>
            {/* Avond - Alleen emoji */}
            <th className="dagdeel-header text-center border border-gray-300 p-1 bg-indigo-50 min-w-[50px]">
              <span className="text-3xl" role="img" aria-label="Avond">
                {DAGDEEL_EMOJI.A}
              </span>
            </th>
          </React.Fragment>
        ))}
      </tr>
    </thead>
  );
}