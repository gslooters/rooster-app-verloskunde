'use client';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const UnavailabilityClient = dynamic(
  () => import('./UnavailabilityClient'), 
  { ssr: false }
);

export default function UnavailabilityPage() {
  return (
    <Suspense fallback={<div>Laden...</div>}>
      <UnavailabilityClient />
    </Suspense>
  );
}
