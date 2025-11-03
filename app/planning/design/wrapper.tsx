"use client";

import { useEffect, useState, ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';
import PageClientGate from './PageClientGate';
import DesignPageClient from './page.client';

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// Los de type-eis op door PageClientGate lazy te importeren waarbij children expliciet wordt meegegeven.

export default function RosterDesignPageWrapper(): JSX.Element {
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

  if (!ready) return <></>;

  const child: ReactNode = <DesignPageClient />;
  // Forceer herkenning van de children prop via expliciete JSX met children attribuut
  return (<PageClientGate children={child} />);
}
