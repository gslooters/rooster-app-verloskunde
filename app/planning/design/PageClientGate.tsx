'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import DesignErrorGate from './DesignErrorGate';

export default function PageClientGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, [searchParams]);

  if (!ready) return null;

  return <DesignErrorGate>{children}</DesignErrorGate>;
}
