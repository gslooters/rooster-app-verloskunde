import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWeekDagdelenData } from '@/lib/planning/weekDagdelenData';
import { WeekDagdelenTableV2 } from './components/WeekDagdelenTableV2';

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
 * 🔥 DRAAD40C V2 - NUCLEAR OPTION:
 * - Gebruikt WeekDagdelenTableV2 met pure inline CSS
 * - GEEN Tailwind container conflicts
 * - GEEN max-width limitaties
 * - FULLWIDTH GEGARANDEERD
 * 
 * Toont volledige weekplanning met dagdelen per dag.
 * Fetched data server-side en geeft door aan V2 client component.
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
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '32px 16px' }}>
        <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#7f1d1d', marginBottom: '8px' }}>
              Fout
            </h1>
            <p style={{ color: '#991b1b' }}>Ontbrekende parameters voor weekweergave.</p>
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
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '32px 16px' }}>
        <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
          <div style={{
            backgroundColor: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#713f12', marginBottom: '8px' }}>
              Geen Data
            </h1>
            <p style={{ color: '#854d0e' }}>
              Er is geen planning beschikbaar voor week {weekNumber} van {jaar}.
            </p>
            <Link
              href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
              style={{
                marginTop: '16px',
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background-color 0.2s'
              }}
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '32px 16px' }}>
      {/* 🔥 DRAAD40C V2: PURE FULLWIDTH - GEEN CONTAINERS! */}
      <div style={{ width: '100%' }}>
        <Suspense
          fallback={
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '400px' 
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  animation: 'spin 1s linear infinite',
                  borderRadius: '50%',
                  height: '48px',
                  width: '48px',
                  borderTop: '2px solid #2563eb',
                  borderRight: '2px solid transparent',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: '#4b5563' }}>Weekplanning laden...</p>
              </div>
            </div>
          }
        >
          <WeekDagdelenTableV2 
            weekData={weekData}
            rosterId={rosterId}
            periodStart={periodStart}
          />
        </Suspense>
      </div>

      {/* Debug Info (alleen in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '24px',
          backgroundColor: '#1f2937',
          color: '#f3f4f6',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxWidth: '1024px',
          margin: '24px auto 0'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🐛 Debug Info (V2):</div>
          <div>Week: {weekNumber}</div>
          <div>Jaar: {jaar}</div>
          <div>Roster ID: {rosterId}</div>
          <div>Dagen geladen: {weekData.days.length}</div>
          <div>Periode: {weekData.startDatum} - {weekData.eindDatum}</div>
          <div style={{ marginTop: '8px', color: '#10b981' }}>Using: WeekDagdelenTableV2 (pure CSS)</div>
        </div>
      )}
    </div>
  );
}
