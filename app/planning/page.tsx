'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readRosters, type Roster, formatWeekRange, formatDateRangeNl } from '@/lib/planning/storage';
import Wizard from './_components/Wizard';

function DraftRosterCard({ roster }: { roster: Roster }) {
  const router = useRouter();
  const weekRange = formatWeekRange(roster.start_date, roster.end_date);
  const dateRange = formatDateRangeNl(roster.start_date, roster.end_date);

  // Navigate to Dashboard Rooster Ontwerp instead of directly to the grid
  const handleOpenRoster = () => { router.push(`/planning/design/dashboard?rosterId=${roster.id}`); };

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={handleOpenRoster}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className="text-xl mr-2">📋</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">ONTWERP</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">{weekRange}</h3>
          <p className="text-gray-600 text-sm">{dateRange}</p>
          <p className="text-gray-500 text-xs mt-2">Aangemaakt: {new Date(roster.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center text-blue-600"><span className="text-sm font-medium mr-2">Bewerken</span><span className="text-lg">→</span></div>
      </div>
    </div>
  );
}

export default function PlanningPage() {
  const [draftRosters, setDraftRosters] = useState<Roster[]>([]);
  const [showNewRosterWizard, setShowNewRosterWizard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchRosters() {
      try {
        const allRosters = await readRosters();
        const drafts = allRosters.filter(roster => roster.status === 'draft').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setDraftRosters(drafts);
      } catch (err) {
        setDraftRosters([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRosters();
  }, []);

  // Sluit modal bij route changes naar buiten de planning pagina
  useEffect(() => {
    const handlePopState = () => setShowNewRosterWizard(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isLoading) {
    return (
      <main className="p-6">
        <div className="animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div><div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div><div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div></div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <nav className="text-sm text-gray-500 mb-4"><Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link><span className="mx-2">›</span><span>Rooster Ontwerpen</span></nav>
      <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900 mb-2">Rooster Ontwerpen</h1><p className="text-gray-600">Bekijk bestaande ontwerp-roosters of start een nieuwe planning voor 5-weken periodes.</p></div>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6"><div><h2 className="text-xl font-semibold text-gray-900">Roosters in ontwerp</h2>{draftRosters.length > 0 && (<p className="text-sm text-gray-600 mt-1">{draftRosters.length} {draftRosters.length === 1 ? 'rooster' : 'roosters'} gevonden</p>)}</div></div>
        {draftRosters.length === 0 ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl p-8 text-center"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center"><span className="text-3xl">📋</span></div><h3 className="text-lg font-semibold text-gray-900 mb-2">Er zijn geen roosters in ontwerp</h3><p className="text-gray-600 text-sm max-w-md mx-auto">Start een nieuw rooster om te beginnen met plannen. Alle ontwerp-roosters verschijnen hier zodat je verder kunt werken waar je gebleven was.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{draftRosters.map(roster => (<DraftRosterCard key={roster.id} roster={roster} />))}</div>
        )}
      </section>
      <section className="mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div><h3 className="font-semibold text-gray-900 mb-1">Nieuwe planning starten</h3><p className="text-sm text-gray-600">Maak een geheel nieuw rooster voor een 5-weken periode</p></div>
            <div className="flex gap-3">
              <Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" onClick={()=>setShowNewRosterWizard(false)}>← Terug naar dashboard</Link>
              <button onClick={() => setShowNewRosterWizard(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Nieuw rooster starten</button>
            </div>
          </div>
        </div>
      </section>
      {showNewRosterWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e)=>{ if (e.target === e.currentTarget) setShowNewRosterWizard(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">Nieuw rooster aanmaken</h2><button onClick={() => setShowNewRosterWizard(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button></div><Wizard onClose={() => setShowNewRosterWizard(false)} /></div>
          </div>
        </div>
      )}
    </main>
  );
}
