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
 * DRAAD40B5 FASE 5: UI Refinements - Emoji Symbolen in Header
 * 
 * Wijzigingen:
 * - Emoji's groter gemaakt (text-2xl)
 * - Toegevoegd: volledige dagdeel namen onder emoji's
 * - Consistente spacing en styling
 */

const DAGDEEL_EMOJI = {
  O: '🌅',
  M: '☀️',
  A: '🌙'
} as const;

const DAGDEEL_LABELS = {
  O: 'Ochtend',
  M: 'Middag',
  A: 'Avond'
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
          className="frozen-left-1 text-center font-semibold text-gray-700 border border-gray-300 p-3"
        >
          Dienst
        </th>
        <th 
          rowSpan={2} 
          className="frozen-left-2 text-center font-semibold text-gray-700 border border-gray-300 p-3"
        >
          Team
        </th>
        {weekDagen.map((dag) => (
          <th
            key={dag.datum}
            colSpan={3}
            className="text-center border-l-2 border-gray-400 border-t border-r border-gray-300 p-2 bg-blue-100"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="font-bold text-base text-gray-800 uppercase">
                {dag.dagSoort}
              </span>
              <span className="text-sm text-gray-600 font-medium">
                {formatDatum(dag.datum)}
              </span>
            </div>
          </th>
        ))}
      </tr>
      
      {/* Row 2: Dagdeel symbolen en labels */}
      <tr>
        {weekDagen.map((dag) => (
          <React.Fragment key={`dagdelen-${dag.datum}`}>
            {/* Ochtend */}
            <th className="dagdeel-header text-center border border-gray-300 p-2 bg-orange-50">
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl" role="img" aria-label="Ochtend">
                  {DAGDEEL_EMOJI.O}
                </span>
                <span className="text-xs font-medium text-gray-700 block">
                  {DAGDEEL_LABELS.O}
                </span>
              </div>
            </th>
            {/* Middag */}
            <th className="dagdeel-header text-center border border-gray-300 p-2 bg-yellow-50">
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl" role="img" aria-label="Middag">
                  {DAGDEEL_EMOJI.M}
                </span>
                <span className="text-xs font-medium text-gray-700 block">
                  {DAGDEEL_LABELS.M}
                </span>
              </div>
            </th>
            {/* Avond */}
            <th className="dagdeel-header text-center border border-gray-300 p-2 bg-indigo-50">
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl" role="img" aria-label="Avond">
                  {DAGDEEL_EMOJI.A}
                </span>
                <span className="text-xs font-medium text-gray-700 block">
                  {DAGDEEL_LABELS.A}
                </span>
              </div>
            </th>
          </React.Fragment>
        ))}
      </tr>
    </thead>
  );
}