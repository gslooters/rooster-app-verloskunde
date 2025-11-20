'use client';

import { Suspense } from 'react';
import PageHeader from './PageHeader';
import ActionBar from './ActionBar';
import WeekDagdelenTable from './WeekDagdelenTable';
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
 * 
 * DRAAD39.3: Server-side data fetching with props pattern
 * - Data is fetched in page.tsx (server component)
 * - Passed as props to this client component
 * - WeekDagdelenTable renders the data without additional API calls
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
              <span className="text-xs text-gray-600">Voldoende bezet (≥3)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
              <span className="text-xs text-gray-600">Onderbezet (2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
              <span className="text-xs text-gray-600">Kritiek onderbezet (1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
              <span className="text-xs text-gray-600">MOET status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span className="text-xs text-gray-600">MAG status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
              <span className="text-xs text-gray-600">Leeg</span>
            </div>
          </div>
        </div>

        {/* WeekDagdelenTable - DRAAD 39.3 ✅ COMPLEET */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <Suspense fallback={<TableLoadingSkeleton weekNummer={weekNummer} />}>
            <WeekDagdelenTable weekData={initialWeekData} />
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
