import { Suspense } from 'react';
import PrePlanningClient from './client';

/**
 * Server Component wrapper voor PrePlanning pagina
 * Wrapper met Suspense boundary voor useSearchParams()
 * 
 * DRAAD 29 - PrePlanning scherm implementatie
 * DRAAD 351 - Laadscherm tekst gewijzigd naar "Rooster laden..."
 */
export default function PrePlanningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rooster laden...</p>
        </div>
      </div>
    }>
      <PrePlanningClient />
    </Suspense>
  );
}
