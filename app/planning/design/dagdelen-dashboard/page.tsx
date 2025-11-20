import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// ✅ FASE 3: Dynamic Import met SSR Disable
// DagdelenDashboardClient bevat client-side data fetching
// SSR kan niet werken omdat de data pas client-side beschikbaar is
const DagdelenDashboardClient = dynamic(
  () => import('./DagdelenDashboardClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <p className="text-gray-700 font-semibold text-lg">Dashboard laden...</p>
          <p className="text-gray-500 text-sm mt-2">Even geduld, weekdata wordt opgehaald</p>
        </div>
      </div>
    )
  }
);

export const metadata = {
  title: 'Diensten per Dagdeel - Dashboard',
  description: 'Overzicht van 5 weken diensten per dagdeel',
};

/**
 * DRAAD39.3 - SSR Disabled Page
 * 
 * Deze page gebruikt dynamic import met ssr: false omdat:
 * 1. DagdelenDashboardClient doet client-side Supabase queries
 * 2. Data is niet beschikbaar tijdens SSR
 * 3. Voorkomt hydration mismatches tussen server en client
 * 4. Garandeert consistente rendering met complete data
 * 
 * Trade-off: Iets langere initiële laadtijd, maar voorkomt "Geen Data" errors
 */
export default function DagdelenDashboardPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-10 w-64 bg-gray-300 rounded mx-auto mb-4"></div>
              <div className="h-6 w-48 bg-gray-200 rounded mx-auto"></div>
            </div>
            <p className="text-gray-500 mt-4 text-sm">Pagina voorbereiden...</p>
          </div>
        </div>
      }
    >
      <DagdelenDashboardClient />
    </Suspense>
  );
}
