'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import DesignErrorCard from './DesignErrorCard';

export default function DesignErrorGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const hasId = !!searchParams.get('rosterId');
    setShowError(!hasId);
  }, [searchParams]);

  if (showError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <DesignErrorCard message="Geen roster ID gevonden" />
      </div>
    );
  }

  return <>{children}</>;
}
