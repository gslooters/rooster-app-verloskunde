'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { use } from 'react';

export default function WeekDetailPage({ params }: { params: Promise<{ weekNumber: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const rosterId = searchParams.get('roster_id');
  const periodStart = searchParams.get('period_start');
  const weekNumber = resolvedParams.weekNumber;

  const handleBack = () => {
    router.push(`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Terug naar Dashboard
          </button>

          <div className="border-4 border-dashed border-blue-300 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Week {weekNumber} - Detail Scherm
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              Dummy Component - Komt in volgende fase
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-sm text-blue-800">
                <strong>Geladen week:</strong> Week {weekNumber}<br />
                <strong>Rooster ID:</strong> {rosterId}<br />
                <strong>Periode start:</strong> {periodStart}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
