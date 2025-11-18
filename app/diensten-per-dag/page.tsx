import { Suspense } from 'react';
import DienstenPerDagRedirectClient from './redirect-client';

/**
 * REDIRECT ROUTE
 * 
 * Deze route is verouderd en redirect naar de nieuwe locatie.
 * Oude route: /diensten-per-dag
 * Nieuwe route: /planning/period-staffing
 * 
 * Reden: Code consolidatie en voorkomen van duplicate routes.
 * Datum: 18 november 2025
 */
export default function DienstenPerDagRedirect() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Doorverwijzen naar Diensten per Dagdeel...</p>
        </div>
      </div>
    }>
      <DienstenPerDagRedirectClient />
    </Suspense>
  );
}
