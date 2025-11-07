import { Suspense } from 'react';
import PeriodStaffingClient from './client';

/**
 * Server Component wrapper voor Period Staffing pagina
 * Wrapper met Suspense boundary voor useSearchParams()
 */
export default function PeriodStaffingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten per dag laden...</p>
        </div>
      </div>
    }>
      <PeriodStaffingClient />
    </Suspense>
  );
}
