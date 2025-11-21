import { Suspense } from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import WeekDagdelenVaststellingTable from '@/components/planning/week-dagdelen/WeekDagdelenVaststellingTable';

/**
 * DRAAD42 FIX - Week Dagdelen Vaststelling Scherm
 * 
 * Route: /planning/design/week-dagdelen/[rosterId]/[weekNummer]?period_start=YYYY-MM-DD
 * 
 * FIX CHANGELOG (21-NOV-2025):
 * ✅ Vervangen 'roster_period' door 'roosters' (correcte tabel)
 * ✅ Toegevoegd period_start uit searchParams lezen
 * ✅ Verwijderd database query voor start_date - gebruik URL parameter
 * ✅ Defensieve validatie voor ontbrekende parameters
 * ✅ Service types filter aangepast: is_active → actief
 * ✅ Verbeterde error messages en logging
 * 
 * Functionaliteit:
 * - Server-side data fetching voor rooster
 * - Validatie van weekNummer (1-5) en period_start
 * - Service types ophalen
 * - Dynamische week navigatie gebaseerd op period_start
 */

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string;
  };
  searchParams: {
    period_start?: string; // 🔥 FIX 1: Toegevoegd
    [key: string]: string | string[] | undefined;
  };
}

export const metadata = {
  title: 'Diensten per Dagdeel Vaststellen',
  description: 'Vaststelling van diensten per dagdeel per week',
};

/**
 * 🔥 FIX 2: Haal rooster data op van CORRECTE tabel: 'roosters'
 * Oude code gebruikte niet-bestaande 'roster_period' tabel
 */
async function getRosterData(rosterId: string) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('roosters') // ✅ FIXED: Was 'roster_period'
    .select('*')
    .eq('id', rosterId)
    .single();
  
  if (error || !data) {
    console.error('❌ DRAAD42: Error fetching roster:', error);
    return null;
  }
  
  console.log('✅ DRAAD42: Roster data opgehaald:', data.id);
  return data;
}

async function getServiceTypes() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('actief', true) // ✅ FIXED: Was 'is_active', schema heeft 'actief'
    .order('code'); // ✅ Sorteer op code
  
  if (error) {
    console.error('❌ DRAAD42: Error fetching service types:', error);
    return [];
  }
  
  console.log(`✅ DRAAD42: ${data?.length || 0} service types opgehaald`);
  return data || [];
}

/**
 * 🔥 FIX 3: Bereken weekdatums vanaf period_start (uit URL)
 * weekIndex = 1-5 (positie binnen roosterperiode)
 */
function calculateWeekDates(periodStart: string, weekIndex: number) {
  // Parse period_start als UTC datum
  const startDate = new Date(periodStart + 'T00:00:00Z');
  
  // Bereken week offset (weekIndex 1 = week 0, weekIndex 2 = week 1, etc.)
  const weekOffset = (weekIndex - 1) * 7;
  
  const weekStart = new Date(startDate);
  weekStart.setUTCDate(startDate.getUTCDate() + weekOffset);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  console.log(`📅 DRAAD42: Week ${weekIndex} berekend: ${weekStart.toISOString().split('T')[0]} tot ${weekEnd.toISOString().split('T')[0]}`);
  
  return { weekStart, weekEnd };
}

/**
 * Bereken ISO-8601 weeknummer
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default async function WeekDagdelenPage({ params, searchParams }: PageProps) {
  const { rosterId, weekNummer } = params;
  const periodStart = searchParams.period_start; // 🔥 FIX 4: Lees uit URL
  
  console.log('🔍 DRAAD42: Page params:', { rosterId, weekNummer, periodStart });
  
  // 🔥 FIX 5: Validatie period_start parameter
  if (!periodStart || typeof periodStart !== 'string') {
    console.error('❌ DRAAD42: Geen period_start gevonden in URL');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Fout bij laden</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Geen roster_id of period_start gevonden in URL
          </p>
          <p className="text-sm text-gray-500 mb-4">
            De gevraagde week bestaat niet of valt buiten de roosterperiode. 
            Controleer het weeknummer en probeer het opnieuw.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Validatie weekNummer (1-5)
  const weekNum = parseInt(weekNummer);
  if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
    console.error('❌ DRAAD42: Ongeldig weeknummer:', weekNummer);
    notFound();
  }
  
  // 🔥 FIX 6: Haal roster op van CORRECTE tabel
  const roster = await getRosterData(rosterId);
  if (!roster) {
    console.error('❌ DRAAD42: Roster niet gevonden:', rosterId);
    notFound();
  }
  
  // 🔥 FIX 7: Bereken week data vanaf period_start (NIET vanaf roster.start_date)
  const { weekStart, weekEnd } = calculateWeekDates(periodStart, weekNum);
  const actualWeekNumber = getWeekNumber(weekStart);
  
  // Haal service types op
  const serviceTypes = await getServiceTypes();
  
  console.log('✅ DRAAD42: Page data voorbereid:', {
    rosterId,
    weekNum,
    actualWeekNumber,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    serviceTypesCount: serviceTypes.length
  });
  
  // Props voor client component
  const pageData = {
    rosterId,
    weekNummer: weekNum,
    actualWeekNumber,
    periodName: `Periode ${roster.start_date} - ${roster.end_date}`,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    serviceTypes,
  };
  
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <p className="text-gray-700 font-semibold text-lg">Week data laden...</p>
            <p className="text-gray-500 text-sm mt-2">Even geduld...</p>
          </div>
        </div>
      }
    >
      <WeekDagdelenVaststellingTable {...pageData} />
    </Suspense>
  );
}
