import { Suspense } from 'react';
import DienstenAanpassenClient from './page.client';

/**
 * Server page wrapper voor "Diensten per medewerker aanpassen" scherm
 * DRAAD64
 * 
 * URL: /planning/design/diensten-aanpassen?rosterId=xxx
 */
export default function DienstenAanpassenPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Laden...</div>
      </div>
    }>
      <DienstenAanpassenClient />
    </Suspense>
  );
}
