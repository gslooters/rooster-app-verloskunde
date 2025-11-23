'use client';

import React from 'react';
import { parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { formatDateDMY, formatUTC } from '@/lib/date-utils';

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
 * 🔥 DRAAD1D - WEEKHEADER FIX:
 * ✅ Gebruik weekDagen[0] (maandag) en weekDagen[6] (zondag) voor periodeweergave
 * ✅ Standaard date-fns formatting: dd-MM-yyyy
 * ✅ Validatie: check dat weekDagen array 7 dagen bevat
 * 
 * 🔥 DRAAD40C - STICKY HEADER FIX:
 * ✅ Thead sticky met expliciete backgroundColor (geen className)
 * ✅ Z-index: thead(40) < frozen-cols(45)
 * ✅ BoxShadow op frozen columns voor visuele scheiding
 * ✅ Background-clip voor smooth scrolling
 * 
 * 🔥 DRAAD1F - TIMEZONE BUG FIX:
 * ✅ Gebruik formatUTC() functies i.p.v. format() voor timezone-veilige formatting
 * ✅ formatDateDMY() voor dd-MM-yyyy periode formatting
 * ✅ formatUTC() met d/M pattern voor individuele dag headers
 * ✅ Resultaat: Correcte datums in ÉLKE timezone (UTC-4, UTC+1, etc.)
 */
export function WeekTableHeader({ weekDagen }: WeekTableHeaderProps) {
  /**
   * Format datum voor individuele dag headers (d/M formaat)
   * 🔥 DRAAD1F: Gebruik formatUTC() voor timezone-veilige formatting
   */
  const formatDatum = (datum: string) => {
    try {
      const date = parseISO(datum);
      return formatUTC(date, 'd/M');
    } catch (error) {
      console.error('❌ WeekTableHeader: Fout bij formatteren datum', datum, error);
      return datum; // Fallback to original string
    }
  };

  /**
   * 🔥 DRAAD1D FIX + DRAAD1F: Genereer periode string direct vanuit weekDagen array
   * Gebruik altijd weekDagen[0] (maandag) en weekDagen[6] (zondag)
   * 🔥 DRAAD1F: Gebruik formatDateDMY() voor timezone-veilige formatting
   */
  const getPeriodeString = () => {
    if (!weekDagen || weekDagen.length !== 7) {
      console.warn('⚠️ WeekTableHeader: weekDagen array bevat niet exact 7 dagen:', weekDagen?.length);
      return 'Periode onbekend';
    }

    try {
      // Gebruik ALTIJD eerste en laatste dag uit weekDagen array
      const maandag = parseISO(weekDagen[0].datum);
      const zondag = parseISO(weekDagen[6].datum);
      
      const maandagStr = formatDateDMY(maandag);
      const zondagStr = formatDateDMY(zondag);
      
      console.log('✅ WeekTableHeader periode (DRAAD1F UTC):', {
        maandag: weekDagen[0].datum,
        zondag: weekDagen[6].datum,
        formatted: `${maandagStr} - ${zondagStr}`
      });
      
      return `${maandagStr} - ${zondagStr}`;
    } catch (error) {
      console.error('❌ WeekTableHeader: Fout bij genereren periode string', error);
      return 'Periode fout';
    }
  };

  const periodeString = getPeriodeString();

  return (
    <thead 
      className="sticky top-[64px]"
      style={{
        zIndex: 40,
        backgroundColor: 'rgb(239 246 255)', // bg-blue-50 explicit
        willChange: 'transform',
        backgroundClip: 'padding-box'
      }}
    >
      {/* 🔥 DRAAD1D: Nieuwe periode header row */}
      <tr>
        <th 
          colSpan={2 + (weekDagen.length * 3)}
          className="text-center font-bold text-gray-800 border border-gray-300 p-2 bg-blue-100"
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 45,
            backgroundClip: 'padding-box'
          }}
        >
          <div className="text-sm">
            Periode: {periodeString}
          </div>
        </th>
      </tr>
      
      <tr>
        <th 
          rowSpan={2}
          className="text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[120px]"
          style={{ 
            position: 'sticky', 
            left: 0, 
            zIndex: 45,
            backgroundColor: 'white',
            willChange: 'transform',
            boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
          }}
        >
          Dienst
        </th>
        <th 
          rowSpan={2}
          className="text-center font-semibold text-gray-700 border border-gray-300 p-2 min-w-[100px]"
          style={{ 
            position: 'sticky', 
            left: '120px', 
            zIndex: 45,
            backgroundColor: 'white',
            willChange: 'transform',
            boxShadow: '2px 0 4px rgba(0,0,0,0.05)'
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
