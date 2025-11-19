'use client';

import { Suspense } from 'react';
import PageHeader from './PageHeader';
import ActionBar from './ActionBar';
import type { WeekDagdeelData, WeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';

interface WeekDagdelenClientProps {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  initialWeekData: WeekDagdeelData;
  navigatieBounds: WeekNavigatieBounds;
}

/**
 * Client wrapper component for week dagdelen view
 * Handles interactive features and state management
 */
export default function WeekDagdelenClient({
  rosterId,
  weekNummer,
  jaar,
  initialWeekData,
  navigatieBounds,
}: WeekDagdelenClientProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Sticky top */}
      <PageHeader
        rosterId={rosterId}
        weekNummer={weekNummer}
        jaar={jaar}
        startDatum={initialWeekData.startDatum}
        eindDatum={initialWeekData.eindDatum}
      />

      {/* Action Bar - Sticky below header */}
      <ActionBar />

      {/* Main Content Container */}
      <div className="container mx-auto px-6 py-6">
        {/* Status Legenda - Sticky binnen container */}
        <div className="sticky top-[144px] z-10 bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Legenda</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span className="text-xs text-gray-600">Voldoende bezet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
              <span className="text-xs text-gray-600">Onderbezet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
              <span className="text-xs text-gray-600">Kritiek onderbezet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
              <span className="text-xs text-gray-600">Toegewezen</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
              <span className="text-xs text-gray-600">Leeg</span>
            </div>
          </div>
        </div>

        {/* WeekDagdelenTable - DRAAD 39.3-39.6 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <Suspense fallback={<TableLoadingSkeleton weekNummer={weekNummer} />}>
            <div className="p-8 text-center text-gray-500">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-700 mb-2">
                  Week {weekNummer} Tabel
                </h2>
                <p className="text-sm">
                  {initialWeekData.startDatum} t/m {initialWeekData.eindDatum}
                </p>
              </div>
              
              {/* Preview van data */}
              <div className="mt-6 text-left max-w-2xl mx-auto">
                <p className="text-xs text-gray-500 mb-2">Data geladen:</p>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 text-xs">
                  <p>Roster ID: {rosterId}</p>
                  <p>Week: {weekNummer} ({jaar})</p>
                  <p>Dagen: {initialWeekData.days.length}</p>
                  <p>Navigatie: Week {navigatieBounds.minWeek} - {navigatieBounds.maxWeek}</p>
                </div>
              </div>
              
              <p className="text-xs mt-6 text-gray-400">
                (WeekDagdelenTable implementatie volgt in DRAAD 39.3-39.6)
              </p>
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton component
 * Shows placeholder while table data loads
 */
function TableLoadingSkeleton({ weekNummer }: { weekNummer: number }) {
  return (
    <div className="p-6">
      <div className="text-center text-gray-500 mb-6">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="h-8 bg-gray-200 rounded mb-4 max-w-md mx-auto"></div>
          
          {/* Grid skeleton - 7 columns (days) x 4 rows (dagdelen) */}
          <div className="grid grid-cols-7 gap-4">
            {[...Array(28)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm">Week {weekNummer} laden...</p>
      </div>
    </div>
  );
}
