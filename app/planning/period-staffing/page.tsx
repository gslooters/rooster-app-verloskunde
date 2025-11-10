'use client';
// app/planning/period-staffing/page.tsx
import { useSearchParams } from 'next/navigation';
import { PeriodStaffingGrid } from '@/components/planning/period-staffing/PeriodStaffingGrid';

export default function PeriodStaffingPage() {
  const searchParams = useSearchParams();
  const rosterId = searchParams.get('rosterId') || 'test-roster';
  const startDate = searchParams.get('startDate') || '2025-11-24';
  const endDate = searchParams.get('endDate') || '2025-12-28';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Diensten per Dag</h1>
        <p className="text-sm text-gray-600 mt-1">
          Rooster: {rosterId} | Periode: {startDate} tot {endDate}
        </p>
      </div>

      <PeriodStaffingGrid
        rosterId={rosterId}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
