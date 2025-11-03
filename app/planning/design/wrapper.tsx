"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';

// CSR-only: laadt gate niet meer als component maar inlined render om TS children-prop uit de keten te halen
const DesignPageClient = dynamic(() => import('./page.client'), { ssr: false });

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export default function RosterDesignPageWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasId, setHasId] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function resolveRoute() {
      let id = searchParams.get('rosterId');
      if (id) { if (isActive) { setHasId(true); setReady(true); } return; }

      await sleep(120);

      if (typeof window !== 'undefined') {
        const recent = localStorage.getItem('recentDesignRoute');
        if (recent) { router.replace(recent); if (isActive) setReady(true); return; }
      }

      if (typeof window !== 'undefined') {
        const lastId = localStorage.getItem('lastRosterId');
        if (lastId && lastId.length > 0) { router.replace(`/planning/design?rosterId=${lastId}`); if (isActive) setReady(true); return; }
      }

      const rosters = readRosters();
      if (rosters && rosters.length > 0) {
        const latest = [...rosters].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (typeof window !== 'undefined') { localStorage.setItem('lastRosterId', latest.id); localStorage.setItem('recentDesignRoute', `/planning/design?rosterId=${latest.id}`); }
        router.replace(`/planning/design?rosterId=${latest.id}`);
        if (isActive) setReady(true); return;
      }

      router.replace('/planning/new?reason=no-roster');
      if (isActive) setReady(true);
    }

    resolveRoute();
    return () => { isActive = false; };
  }, [searchParams, router]);

  if (!ready) return null;

  // Inline rendering: geen PageClientGate meer, direct renderen en zelf checken
  if (!hasId) {
    const DesignErrorCard = dynamic(() => import('./DesignErrorCard'), { ssr: false });
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        {/* Fallback kaart met CTA's */}
        {/* @ts-ignore */}
        <DesignErrorCard message="Geen roster ID gevonden" />
      </div>
    );
  }

  return (
    <DesignPageClient />
  );
}
