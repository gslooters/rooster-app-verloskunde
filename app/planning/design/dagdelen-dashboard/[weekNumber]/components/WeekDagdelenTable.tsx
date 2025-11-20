'use client';

import React from 'react';
import Link from 'next/link';
import type { WeekDagdeelData } from '@/lib/planning/weekDagdelenData';
import { DagdeelCell } from './DagdeelCell';
import { StatusBadge } from './StatusBadge';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';

interface WeekDagdelenTableProps {
  weekData: WeekDagdeelData;
  rosterId: string;
  periodStart: string;
}

/**
 * WeekDagdelenTable Component
 * 
 * Volledig functionele weekplanning tabel met:
 * - Grid layout: 8 kolommen (dagdeel header + 7 dagen)
 * - 4 rijen per dagdeel type (ochtend, middag, avond, nacht)
 * - Sticky headers voor dagen en dagdelen
 * - Kleurcodering per team en bezettingsstatus
 * - Responsive design met horizontaal scrollen op kleinere schermen
 * 
 * AANGEPAST: Berekent totalen op basis van team aantallen
 */
export function WeekDagdelenTable({ weekData, rosterId, periodStart }: WeekDagdelenTableProps) {
  const dagdelen = [
    { key: 'ochtend' as const, label: 'Ochtend', tijd: '07:00 - 15:00' },
    { key: 'middag' as const, label: 'Middag', tijd: '15:00 - 23:00' },
    { key: 'avond' as const, label: 'Avond', tijd: '23:00 - 07:00' },
    { key: 'nacht' as const, label: 'Nacht', tijd: '07:00 - 19:00' },
  ];

  // Bereken totale bezetting per dag (som van alle aantallen)
  const getDayTotals = (dayIndex: number) => {
    const day = weekData.days[dayIndex];
    if (!day) return 0;
    
    const ochtendTotaal = day.dagdelen.ochtend.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const middagTotaal = day.dagdelen.middag.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const avondTotaal = day.dagdelen.avond.reduce((sum, a) => sum + (a.aantal || 0), 0);
    const nachtTotaal = day.dagdelen.nacht.reduce((sum, a) => sum + (a.aantal || 0), 0);
    
    return ochtendTotaal + middagTotaal + avondTotaal + nachtTotaal;
  };

  return (
    <div className="w-full">
      {/* Info Header */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Diensten per week aanpassen: Week {weekData.weekNummer} - {weekData.jaar}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {weekData.startDatum} t/m {weekData.eindDatum}
            </p>
          </div>
          <div>
            <Link
              href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Terug naar Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive Container met horizontaal scroll */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
        <div className="min-w-[1024px]">
          {/* Table Grid */}
          <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-[2px] bg-gray-300">
            
            {/* HEADER ROW: Sticky header met dagen */}
            <div className="bg-gray-100 p-4 sticky top-0 z-20 border-b-2 border-gray-400">
              <div className="font-bold text-gray-700 text-sm">Dagdeel</div>
            </div>
            
            {weekData.days.map((day, index) => {
              const datum = parseISO(day.datum);
              const totaal = getDayTotals(index);
              
              return (
                <div
                  key={day.datum}
                  className="bg-gray-100 p-4 sticky top-0 z-20 border-b-2 border-gray-400"
                >
                  <div className="text-center">
                    <div className="font-bold text-gray-900 capitalize">
                      {format(datum, 'EEEE', { locale: nl })}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {format(datum, 'd MMM', { locale: nl })}
                    </div>
                    <div className="mt-2">
                      <StatusBadge count={totaal} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* DATA ROWS: Per dagdeel */}
            {dagdelen.map((dagdeel) => (
              <React.Fragment key={dagdeel.key}>
                {/* Sticky linker kolom met dagdeel naam */}
                <div className="bg-gray-50 p-4 sticky left-0 z-10 border-r-2 border-gray-400">
                  <div className="font-bold text-gray-900 text-base mb-1">
                    {dagdeel.label}
                  </div>
                  <div className="text-xs text-gray-600">
                    {dagdeel.tijd}
                  </div>
                </div>

                {/* Cellen voor elke dag */}
                {weekData.days.map((day) => (
                  <div key={`${day.datum}-${dagdeel.key}`} className="bg-white">
                    <DagdeelCell
                      assignments={day.dagdelen[dagdeel.key]}
                      dagdeel={dagdeel.key}
                      datum={day.datum}
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-bold text-gray-900 mb-3">Legenda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Bezettingsstatus</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge count={2} />
                <span className="text-sm text-gray-600">Voldoende (2+ medewerkers)</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge count={1} />
                <span className="text-sm text-gray-600">Onderbezet (1 medewerker)</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge count={0} />
                <span className="text-sm text-gray-600">Kritiek (geen bezetting)</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Team Kleuren</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-blue-100 border-2 border-blue-300 rounded"></div>
                <span className="text-sm text-gray-600">Team A</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-green-100 border-2 border-green-300 rounded"></div>
                <span className="text-sm text-gray-600">Team B</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-6 bg-purple-100 border-2 border-purple-300 rounded"></div>
                <span className="text-sm text-gray-600">Team C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
