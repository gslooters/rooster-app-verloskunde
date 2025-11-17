'use client';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DienstenPerDagClient = dynamic(
  () => import('./DienstenPerDagClient'), 
  { ssr: false }
);

export default function DienstenPerDagPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Diensten per dagdeel wordt geladen...</p>
        </div>
      </div>
    }>
      <DienstenPerDagClient />
    </Suspense>
  );
}