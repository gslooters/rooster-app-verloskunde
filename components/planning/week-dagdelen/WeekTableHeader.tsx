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

const DAGDEEL_EMOJI = {
  O: '🌅',
  M: '☀️',
  A: '🌙'
} as const;

/**
 * WeekTableHeader Component
 * 
 * 🔥 DRAAD40B5 #8 - STICKY HEADER FIX:
 * ✅ Fixed z-index layering:
 *    - thead: z-40 (boven normal content)
 *    - frozen cells: z-45 (hoogste - dual-axis sticky)
 * ✅ Correct sticky positioning
 * ✅ Performance optimizations met will-change
 * ✅ Consistente backgrounds voor frozen columns
 */
export function WeekTableHeader({ weekDagen }: WeekTableHeaderProps) {
  const formatDatum = (datum: string) => {
    const date = new Date(datum);
    return format(date, 'd/M', { locale: nl });
  };

  return (
    <thead 
      className="sticky top-[64px] bg-blue-50"
      style={{
        zIndex: 40,
        willChange: 'transform' // Performance hint for smooth scrolling
      }}
    >
      {/* Row 1: Dienst + Team (rowSpan=2) + Dag namen BOVEN emoji's */}
      <tr>
        <th 
          rowSpan={2}
          className="frozen-left-1 text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[120px] bg-white"
          style={{ 
            position: 'sticky', 
            left: 0, 
            zIndex: 45, // 🔥 FIX: Hoogste z-index voor dual-axis sticky
            willChange: 'transform',
            backgroundColor: 'white' // Explicit background
          }}
        >
          Dienst <span style={{ color: 'red', fontWeight: 'bold', fontSize: '18px' }}>Test02</span>
        </th>
        <th 
          rowSpan={2}
          className="frozen-left-2 text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[100px] bg-white"
          style={{ 
            position: 'sticky', 
            left: '120px', 
            zIndex: 45, // 🔥 FIX: Hoogste z-index voor dual-axis sticky
            willChange: 'transform',
            backgroundColor: 'white' // Explicit background
          }}
        >
          Team
        </th>
        {weekDagen.map((dag) => (
          <th
            key={dag.datum}
            colSpan={3}
            className="text-center border-l-2 border-gray-400 border-t border-r border-gray-300 p-1 bg-blue-100"
          >
            <div className="flex flex-col items-center gap-0">
              <span className="font-bold text-xs text-gray-800 uppercase">
                {dag.dagSoort}
              </span>
              <span className="text-[10px] text-gray-600 font-medium">
                {formatDatum(dag.datum)}
              </span>
            </div>
          </th>
        ))}
      </tr>
      
      {/* Row 2: Emoji's ONDER de dag namen (Dienst/Team hebben rowSpan dus geen cellen hier) */}
      <tr>
        {weekDagen.map((dag) => (
          <React.Fragment key={`dagdelen-${dag.datum}`}>
            <th className="dagdeel-header text-center border border-gray-300 p-0.5 bg-orange-50 min-w-[40px]">
              <span className="text-2xl" role="img" aria-label="Ochtend">
                {DAGDEEL_EMOJI.O}
              </span>
            </th>
            <th className="dagdeel-header text-center border border-gray-300 p-0.5 bg-yellow-50 min-w-[40px]">
              <span className="text-2xl" role="img" aria-label="Middag">
                {DAGDEEL_EMOJI.M}
              </span>
            </th>
            <th className="dagdeel-header text-center border border-gray-300 p-0.5 bg-indigo-50 min-w-[40px]">
              <span className="text-2xl" role="img" aria-label="Avond">
                {DAGDEEL_EMOJI.A}
              </span>
            </th>
          </React.Fragment>
        ))}
      </tr>
    </thead>
  );
}