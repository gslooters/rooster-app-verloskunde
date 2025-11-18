'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Bewaar alle query parameters
    const params = new URLSearchParams();
    searchParams?.forEach((value, key) => {
      params.set(key, value);
    });

    // Redirect naar de nieuwe route met alle parameters
    const newUrl = `/planning/period-staffing${params.toString() ? '?' + params.toString() : ''}`;
    router.replace(newUrl);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Doorverwijzen naar Diensten per Dagdeel...</p>
      </div>
    </div>
  );
}