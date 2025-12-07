// NIEUWE /app/archived/page.tsx - Archief Raadplegen
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readRosters, type Roster, formatWeekRange, formatDateRangeNl } from '@/lib/planning/storage';

function ArchivedRosterCard({ roster }: { roster: Roster }) {
  const router = useRouter();
  const weekRange = formatWeekRange(roster.start_date, roster.end_date);
  const dateRange = formatDateRangeNl(roster.start_date, roster.end_date);
  const handleOpenRoster = () => { router.push(`/planning/design/preplanning?id=${roster.id}`); };

  return (
    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 hover:shadow-md hover:bg-gray-100 transition-shadow cursor-pointer" onClick={handleOpenRoster}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className="text-xl mr-2">✅</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">AFGESLOTEN</span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">{weekRange}</h3>
          <p className="text-gray-600 text-sm">{dateRange}</p>
          <p className="text-gray-500 text-xs mt-2">Aangemaakt: {new Date(roster.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center text-green-700"><span className="text-sm font-medium mr-2">Details</span><span className="text-lg">→</span></div>
      </div>
    </div>
  );
}

export default function ArchivedPage() {
  const [archivedRosters, setArchivedRosters] = useState<Roster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchRosters() {
      try {
        const allRosters = await readRosters();
        const archived = allRosters.filter(roster => roster.status === 'final').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setArchivedRosters(archived);
      } catch (err) {
        setArchivedRosters([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRosters();
  }, []);

  if (isLoading) {
    return (
      <main className="p-6"><div className="animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/4 mb-4"></div><div className="h-8 bg-gray-100 rounded w-1/2 mb-4"></div><div className="h-4 bg-gray-100 rounded w-3/4 mb-6"></div></div></main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <nav className="text-sm text-gray-500 mb-4"><Link href="/dashboard" className="hover:text-green-700 transition-colors">Dashboard</Link><span className="mx-2">›</span><span>Archief Raadplegen</span></nav>
      <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900 mb-2">Archief Raadplegen</h1><p className="text-gray-600">Afgesloten roosters voor raadpleging en export</p></div>
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6"><div><h2 className="text-xl font-semibold text-gray-900">Afgesloten roosters</h2>{archivedRosters.length > 0 && (<p className="text-sm text-gray-600 mt-1">{archivedRosters.length} {archivedRosters.length === 1 ? 'rooster' : 'roosters'} gevonden</p>)}</div></div>
        {archivedRosters.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-green-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-green-100 flex items-center justify-center"><span className="text-3xl">✅</span></div><h3 className="text-lg font-semibold text-gray-900 mb-2">Er zijn nog geen afgesloten roosters</h3><p className="text-gray-600 text-sm max-w-md mx-auto">Hier verschijnen roosters die definitief zijn afgesloten ter naslag en export.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{archivedRosters.map(roster => (<ArchivedRosterCard key={roster.id} roster={roster} />))}</div>
        )}
      </section>
      <section className="mb-8"><div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-row gap-4 justify-start"><Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-green-500 transition-colors">← Terug naar dashboard</Link></div></section>
    </main>
  );
}