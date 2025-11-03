"use client";

import { Suspense } from 'react';
import DesignPageClient from './page.client';

export default function RosterDesignPageWrapper() {
  return (
    <Suspense>
      <DesignPageClient />
    </Suspense>
  );
}
