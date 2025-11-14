"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { readRosters } from '@/lib/planning/storage';

// CSR-only: direct lazy import van DesignPageClient, zonder extra wrappers of children props
// FIX: Explicitly return module.default to satisfy TypeScript
const DesignPageClient = dynamic(() => import('./page.client').then(mod => mod.default), { ssr: false });
const DesignErrorCard = dynamic(() => import('./DesignErrorCard').then(mod => mod.default), { ssr: false });

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export default function RosterDesignPageWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function resolveRoute() {
      // 1. Check URL parameter
      let id = searchParams.get('rosterId');
      if (id) { 
        if (isActive) { 
          setResolved(true); 
          setReady(true); 
        } 
        return; 
      }

      await sleep(120);

      // 2. Check localStorage recent route
      if (typeof window !== 'undefined') {
        const recent = localStorage.getItem('recentDesignRoute');
        if (recent) { 
          router.replace(recent); 
          if (isActive) { 
            setResolved(true); 
            setReady(true); 
          } 
          return; 
        }
      }

      // 3. Check localStorage lastRosterId
      if (typeof window !== 'undefined') {
        const lastId = localStorage.getItem('lastRosterId');
        if (lastId && lastId.length > 0) { 
          router.replace(`/planning/design?rosterId=${lastId}`); 
          if (isActive) { 
            setResolved(true); 
            setReady(true); 
          } 
          return; 
        }
      }

      // 4. ✅ FIX: Haal roosters op met await
      try {
        const rosters = await readRosters();
        
        if (rosters && rosters.length > 0) {
          const latest = [...rosters].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          
          if (typeof window !== 'undefined') { 
            localStorage.setItem('lastRosterId', latest.id); 
            localStorage.setItem('recentDesignRoute', `/planning/design?rosterId=${latest.id}`); 
          }
          
          router.replace(`/planning/design?rosterId=${latest.id}`);
          
          if (isActive) { 
            setResolved(true); 
            setReady(true); 
          } 
          return;
        }
      } catch (error) {
        console.error('❌ Fout bij laden roosters in wrapper:', error);
        // Fall through naar error state
      }

      // 5. Geen context gevonden: blijf op deze pagina met foutkaart
      if (isActive) { 
        setResolved(false); 
        setReady(true); 
      }
    }

    resolveRoute();
    return () => { isActive = false; };
  }, [searchParams, router]);

  if (!ready) return null;

  if (!resolved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <DesignErrorCard message="Geen roster ID gevonden" />
      </div>
    );
  }

  return <DesignPageClient />;
}