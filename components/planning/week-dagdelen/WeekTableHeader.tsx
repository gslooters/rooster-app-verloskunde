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

export function WeekTableHeader({ weekDagen }: WeekTableHeaderProps) {
  const formatDatum = (datum: string) => {
    const date = new Date(datum);
    return format(date, 'd/M', { locale: nl });
  };

  return (
    <thead className="sticky top-[144px] z-30 bg-blue-50">
      {/* Datum Row */}
      <tr>
        <th rowSpan={2} className="frozen-left-1 text-center font-semibold text-gray-700 border border-gray-300 p-3">
          Dienst
        </th>
        <th rowSpan={2} className="frozen-left-2 text-center font-semibold text-gray-700 border border-gray-300 p-3">
          Team
        </th>
        {weekDagen.map((dag) => (
          <th
            key={dag.datum}
            colSpan={3}
            className="text-center border border-gray-300 p-2"
          >
            <div className="flex flex-col items-center">
              <span className="font-bold text-sm text-gray-800">{dag.dagSoort}</span>
              <span className="text-xs text-gray-600">{formatDatum(dag.datum)}</span>
            </div>
          </th>
        ))}
      </tr>
      {/* Dagdeel Row */}
      <tr>
        {weekDagen.map((dag) => (
          <React.Fragment key={`dagdelen-${dag.datum}`}>
            <th className="dagdeel-header text-center border border-gray-300 p-2">
              <div className="flex flex-col items-center">
                <span className="text-sm">🌅</span>
                <span className="text-xs font-medium">O</span>
              </div>
            </th>
            <th className="dagdeel-header text-center border border-gray-300 p-2">
              <div className="flex flex-col items-center">
                <span className="text-sm">☀️</span>
                <span className="text-xs font-medium">M</span>
              </div>
            </th>
            <th className="dagdeel-header text-center border border-gray-300 p-2">
              <div className="flex flex-col items-center">
                <span className="text-sm">🌙</span>
                <span className="text-xs font-medium">A</span>
              </div>
            </th>
          </React.Fragment>
        ))}
      </tr>
    </thead>
  );
}