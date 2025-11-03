'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';
import DesignPageClient from './page.client';

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export default function RosterDesignPageWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function resolveRoute() {
      // 0) directe query
      let id = searchParams.get('rosterId');
      if (id) { if (isActive) setChecked(true); return; }

      // micro-retry om storage te laten 'landen'
      await sleep(120);

      // 1) recentDesignRoute (diep-link)
      if (typeof window !== 'undefined') {
        const recent = localStorage.getItem('recentDesignRoute');
        if (recent) { router.replace(recent); if (isActive) setChecked(true); return; }
      }

      // 2) lastRosterId
      if (typeof window !== 'undefined') {
        const lastId = localStorage.getItem('lastRosterId');
        if (lastId && lastId.length > 0) { router.replace(`/planning/design?rosterId=${lastId}`); if (isActive) setChecked(true); return; }
      }

      // 3) readRosters() -> nieuwste
      const rosters = readRosters();
      if (rosters && rosters.length > 0) {
        const latest = [...rosters].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (typeof window !== 'undefined') { localStorage.setItem('lastRosterId', latest.id); localStorage.setItem('recentDesignRoute', `/planning/design?rosterId=${latest.id}`); }
        router.replace(`/planning/design?rosterId=${latest.id}`);
        if (isActive) setChecked(true); return;
      }

      // 4) geen context -> wizard
      router.replace('/planning/new?reason=no-roster');
      if (isActive) setChecked(true);
    }

    resolveRoute();
    return () => { isActive = false; };
  }, [searchParams, router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Voorbereiden...</p>
        </div>
      </div>
    );
  }

  return <DesignPageClient />;
}
