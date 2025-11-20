import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WeekDagdelenClient from '@/components/planning/week-dagdelen/WeekDagdelenClient';
import { getWeekDagdelenData, getWeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';
import { getWeekBoundary } from '@/lib/planning/weekBoundaryCalculator';

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string; // 🔥 OPTIE A: Dit is nu weekIndex (1-5), niet ISO weeknummer!
  };
  searchParams: {
    jaar?: string;
    period_start?: string; // 🔥 FIX 2 - DRAAD40B: Gebruik period_start parameter!
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const weekNummer = parseInt(params.weekNummer);
  
  return {
    title: `Week ${weekNummer} - Diensten per Dagdeel`,
    description: `Bewerk dagdeel bezetting voor week ${weekNummer}`,
  };
}

export default async function WeekDagdelenPage({ params, searchParams }: PageProps) {
  // 🔥 OPTIE A: params.weekNummer is nu weekIndex (1-5), niet ISO weeknummer!
  const weekNummer = parseInt(params.weekNummer);
  
  console.log(`🔍 OPTIE A: Server ontvangt weekNummer (=weekIndex): ${weekNummer}`);
  console.log(`🔍 FIX 2: searchParams.period_start =`, searchParams.period_start);
  
  // 🔥 FIX 2 - DRAAD40B BUGFIX: Valideer period_start parameter
  if (!searchParams.period_start) {
    console.error('❌ FIX 2: Geen period_start parameter gevonden in URL!');
    console.error('❌ URL moet format hebben: /week-dagdelen/[rosterId]/[weekNummer]?period_start=YYYY-MM-DD');
    
    // Return error pagina met duidelijke foutmelding
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Ongeldige URL</h3>
          </div>
          <p className="text-gray-600 mb-4">
            De URL mist de vereiste <code className="bg-gray-100 px-1 rounded">period_start</code> parameter.
          </p>
          <p className="text-gray-500 text-sm mb-4">
            Verwacht formaat: <code className="bg-gray-100 px-1 rounded text-xs">?period_start=YYYY-MM-DD</code>
          </p>
          <a
            href="/planning/design/dashboard"
            className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Terug naar Dashboard
          </a>
        </div>
      </div>
    );
  }
  
  // 🔥 FIX 2: Bepaal jaar uit period_start (betrouwbaarder dan jaar parameter)
  const periodStartDate = new Date(searchParams.period_start + 'T00:00:00Z');
  const jaar = periodStartDate.getUTCFullYear();
  
  console.log('✅ FIX 2: Jaar bepaald uit period_start:', jaar);
  console.log('✅ FIX 2: period_start datum:', periodStartDate.toISOString());

  // ✅ OPTIE A FIX: Validate week INDEX (1-5 voor 5-weekse roosterperiode)
  // Dit is GEEN ISO weeknummer meer, maar de positie binnen de roosterperiode!
  if (isNaN(weekNummer) || weekNummer < 1 || weekNummer > 5) {
    console.error(`❌ OPTIE A: Invalid weekIndex: ${weekNummer} (moet tussen 1-5 zijn)`);
    notFound();
  }

  console.log(`✅ OPTIE A: Validatie geslaagd - weekIndex ${weekNummer} is geldig (1-5)`);

  try {
    console.log(`📊 OPTIE A: Fetching data voor roster ${params.rosterId}, weekIndex ${weekNummer}, jaar ${jaar}`);
    
    // 🔥 FIX 2: Geef period_start door aan getWeekBoundary
    const weekBoundary = await getWeekBoundary(
      params.rosterId,
      weekNummer,
      searchParams.period_start
    );
    
    console.log('✅ FIX 2: weekBoundary opgehaald:', weekBoundary);
    
    // Fetch data on server side for initial render
    const weekData = await getWeekDagdelenData(params.rosterId, weekNummer, jaar);
    const navigatieBounds = await getWeekNavigatieBounds(params.rosterId, weekNummer);

    // Check if week exists in roster
    if (!weekData) {
      console.error(`❌ OPTIE A: Week ${weekNummer} niet gevonden in rooster`);
      notFound();
    }

    console.log(`✅ OPTIE A: Data succesvol opgehaald voor weekIndex ${weekNummer}, rendering client component`);

    return (
      <WeekDagdelenClient
        rosterId={params.rosterId}
        weekNummer={weekNummer}
        jaar={jaar}
        initialWeekData={weekData}
        navigatieBounds={navigatieBounds}
        weekBoundary={weekBoundary}
      />
    );
  } catch (error) {
    console.error(`❌ OPTIE A: Error loading week data voor weekIndex ${weekNummer}:`, error);
    console.error('❌ FIX 2: Error details:', error instanceof Error ? error.message : String(error));
    notFound();
  }
}
