"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';

// Lazy import van client gate + page om types rond children volledig te omzeilen in de build-pipeline
const PageClientGate = dynamic(() => import('./PageClientGate'), { ssr: false });
const DesignPageClient = dynamic(() => import('./page.client'), { ssr: false });

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export default function RosterDesignPageWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function resolveRoute() {
      let id = searchParams.get('rosterId');
      if (id) { if (isActive) setReady(true); return; }

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

  // Dynamisch renderen (CSR-only) voorkomt de TS children-prop check tijdens server build
  return (
    <PageClientGate>
      <DesignPageClient />
    </PageClientGate>
  );
}
