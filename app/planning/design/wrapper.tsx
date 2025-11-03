'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';
import DesignPageClient from './page.client';

export default function RosterDesignPageWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let id = searchParams.get('rosterId');

    // 1) Query param
    if (id) { setChecked(true); return; }

    // 2) lastRosterId uit localStorage
    if (typeof window !== 'undefined') {
      const lastId = localStorage.getItem('lastRosterId');
      if (lastId && lastId.length > 0) {
        router.replace(`/planning/design?rosterId=${lastId}`);
        setChecked(true);
        return;
      }
    }

    // 3) readRosters() -> nieuwste
    const rosters = readRosters();
    if (rosters && rosters.length > 0) {
      const latest = [...rosters].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (typeof window !== 'undefined') { localStorage.setItem('lastRosterId', latest.id); }
      router.replace(`/planning/design?rosterId=${latest.id}`);
      setChecked(true);
      return;
    }

    // 4) Geen context -> naar wizard met melding
    router.replace('/planning/new?reason=no-roster');
    setChecked(true);
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
