import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWeekDagdelenData } from '@/lib/planning/weekDagdelenData';
import { WeekDagdelenTable } from './components/WeekDagdelenTable';

interface PageProps {
  params: Promise<{ weekNumber: string }>;
  searchParams: Promise<{
    roster_id?: string;
    period_start?: string;
  }>;
}

/**
 * Week Detail Page - Server Component
 * 
 * Toont volledige weekplanning met dagdelen per dag.
 * Fetched data server-side en geeft door aan client component.
 */
export default async function WeekDetailPage({ params, searchParams }: PageProps) {
  // Resolve async params en searchParams
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const weekNumber = parseInt(resolvedParams.weekNumber, 10);
  const rosterId = resolvedSearchParams.roster_id;
  const periodStart = resolvedSearchParams.period_start;

  // Validatie
  if (!rosterId || !periodStart) {
    console.error('❌ Ontbrekende parameters: roster_id of period_start');
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-900 mb-2">Fout</h1>
            <p className="text-red-700">Ontbrekende parameters voor weekweergave.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    console.error('❌ Ongeldig weeknummer:', resolvedParams.weekNumber);
    notFound();
  }

  // Haal jaar uit period_start
  const jaar = new Date(periodStart).getFullYear();

  // Fetch week data server-side
  console.log(`🔍 Fetching week data: Week ${weekNumber}, Jaar ${jaar}, Roster ${rosterId}`);
  const weekData = await getWeekDagdelenData(rosterId, weekNumber, jaar);

  if (!weekData) {
    console.error('❌ Geen week data gevonden');
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-2">Geen Data</h1>
            <p className="text-yellow-700">
              Er is geen planning beschikbaar voor week {weekNumber} van {jaar}.
            </p>
            <Link
              href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Terug naar Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  console.log(`✅ Week data geladen: ${weekData.days.length} dagen`);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-[1400px] mx-auto">
        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Weekplanning laden...</p>
                </div>
              </div>
            }
          >
            <WeekDagdelenTable 
              weekData={weekData}
              rosterId={rosterId}
              periodStart={periodStart}
            />
          </Suspense>
        </div>

        {/* Debug Info (alleen in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 bg-gray-800 text-gray-100 rounded-lg p-4 text-xs font-mono">
            <div className="font-bold mb-2">🐛 Debug Info:</div>
            <div>Week: {weekNumber}</div>
            <div>Jaar: {jaar}</div>
            <div>Roster ID: {rosterId}</div>
            <div>Dagen geladen: {weekData.days.length}</div>
            <div>Periode: {weekData.startDatum} - {weekData.eindDatum}</div>
          </div>
        )}
      </div>
    </div>
  );
}
