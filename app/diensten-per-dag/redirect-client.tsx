'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function DienstenPerDagRedirectClient() {
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

  return null;
}
