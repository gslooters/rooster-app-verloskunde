import { Suspense } from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import WeekDagdelenVaststellingTable from '@/components/planning/week-dagdelen/WeekDagdelenVaststellingTable';
import { parseUTCDate, assertMonday } from '@/lib/date-utils';

/**
 * DRAAD42K FIX + DRAAD1F - Week Dagdelen Vaststelling Scherm
 * 
 * Route: /planning/design/week-dagdelen/[rosterId]/[weekNummer]?period_start=YYYY-MM-DD
 * 
 * FIX CHANGELOG:
 * ✅ DRAAD42D: Vervangen 'roster_period' door 'roosters'
 * ✅ DRAAD42D: Toegevoegd period_start uit searchParams lezen
 * ✅ DRAAD42D: Service types filter: is_active → actief
 * ✅ DRAAD42F: Database queries gebruik nu roster_id i.p.v. roster_period_id
 * ✅ DRAAD42G: periodStart doorgegeven aan WeekDagdelenVaststellingTable (ROUTING FIX)
 * ✅ DRAAD42K: FIX ZONDAG START BUG - Week start altijd op maandag (niet zondag)
 * ✅ DRAAD1F: UTC PARSING - Gebruik parseUTCDate() en assertMonday() voor validatie
 * 
 * Functionaliteit:
 * - Server-side data fetching voor rooster
 * - Validatie van weekNummer (1-5) en period_start
 * - Service types ophalen
 * - Dynamische week navigatie gebaseerd op period_start
 * - Terug-navigatie naar dashboard MET period_start parameter
 * - CRITICAL: Week berekening corrigeert automatisch naar maandag
 * - DRAAD1F: UTC-veilige datum parsing voorkomt timezone bugs
 */

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string;
  };
  searchParams: {
    period_start?: string;
    [key: string]: string | string[] | undefined;
  };
}

export const metadata = {
  title: 'Diensten per Dagdeel Vaststellen',
  description: 'Vaststelling van diensten per dagdeel per week',
};

/**
 * Haal rooster data op van CORRECTE tabel: 'roosters'
 */
async function getRosterData(rosterId: string) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('roosters')
    .select('*')
    .eq('id', rosterId)
    .single();
  
  if (error || !data) {
    console.error('❌ DRAAD42K: Error fetching roster:', error);
    return null;
  }
  
  console.log('✅ DRAAD42K: Roster data opgehaald:', data.id);
  return data;
}

async function getServiceTypes() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('actief', true)
    .order('code');
  
  if (error) {
    console.error('❌ DRAAD42K: Error fetching service types:', error);
    return [];
  }
  
  console.log(`✅ DRAAD42K: ${data?.length || 0} service types opgehaald`);
  return data || [];
}

/**
 * 🔥 DRAAD42K FIX + DRAAD1F - Bereken weekdatums vanaf period_start MET MAANDAG CORRECTIE
 * 
 * Deze functie zorgt ervoor dat elke week ALTIJD start op een MAANDAG,
 * ongeacht wat de input datum is.
 * 
 * DRAAD1F UPDATE:
 * - Gebruik parseUTCDate() i.p.v. new Date() voor timezone-veilige parsing
 * - Gebruik assertMonday() voor expliciete validatie
 * - Voorkomt timezone conversie bugs
 * 
 * Logica (gebaseerd op DRAAD26R fix):
 * - Als berekende datum = zondag (0) → +1 dag naar maandag
 * - Als berekende datum = maandag (1) → geen wijziging
 * - Als berekende datum = dinsdag-zaterdag (2-6) → terug naar vorige maandag
 * 
 * @param periodStart - Start datum van roosterperiode (YYYY-MM-DD)
 * @param weekIndex - Week nummer binnen periode (1-5)
 * @returns Object met weekStart en weekEnd (beide Date objecten)
 */
function calculateWeekDates(periodStart: string, weekIndex: number) {
  // 🔥 DRAAD1F: Gebruik parseUTCDate() voor timezone-veilige parsing
  const startDate = parseUTCDate(periodStart);
  const weekOffset = (weekIndex - 1) * 7;
  
  // Bereken ruwe startdatum (zonder maandag correctie)
  const rawWeekStart = new Date(startDate);
  rawWeekStart.setUTCDate(startDate.getUTCDate() + weekOffset);
  
  // 🔥 DRAAD42K: CORRECTIE NAAR MAANDAG
  // getUTCDay() geeft: 0=zondag, 1=maandag, 2=dinsdag, ..., 6=zaterdag
  const dayOfWeek = rawWeekStart.getUTCDay();
  let daysToAdd = 0;
  
  if (dayOfWeek === 0) {
    // Zondag → ga 1 dag vooruit naar maandag
    daysToAdd = 1;
    console.log(`🔧 DRAAD42K: Zondag gedetecteerd, corrigeer +1 dag naar maandag`);
  } else if (dayOfWeek > 1) {
    // Dinsdag t/m zaterdag → ga terug naar vorige maandag
    daysToAdd = 1 - dayOfWeek; // negatief getal
    console.log(`🔧 DRAAD42K: Dag ${dayOfWeek} gedetecteerd, corrigeer ${daysToAdd} dagen naar maandag`);
  } else {
    // Maandag → geen correctie nodig
    console.log(`✅ DRAAD42K: Maandag gedetecteerd, geen correctie nodig`);
  }
  
  // Pas correctie toe
  const weekStart = new Date(rawWeekStart);
  weekStart.setUTCDate(rawWeekStart.getUTCDate() + daysToAdd);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  // 🔥 DRAAD1F: Valideer dat weekStart nu echt een maandag is
  try {
    assertMonday(weekStart, 'Server week start');
    console.log('✅ DRAAD1F: Server-side maandag validatie PASSED');
  } catch (error) {
    console.error('❌ DRAAD1F: KRITIEKE FOUT -', error);
    // Throw door naar client voor error handling
    throw error;
  }
  
  // Bereken weekEnd (6 dagen na weekStart = zondag)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  
  // Logging voor debugging
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const weekStartDay = weekStart.getUTCDay();
  const weekEndDay = weekEnd.getUTCDay();
  
  console.log(`📅 DRAAD1F: Week ${weekIndex} berekend:`);
  console.log(`   Start: ${weekStartStr} (dag ${weekStartDay}, moet 1=maandag zijn)`);
  console.log(`   End:   ${weekEndStr} (dag ${weekEndDay}, moet 0=zondag zijn)`);
  
  // Validatie: weekEnd MOET zondag zijn
  if (weekEndDay !== 0) {
    console.error(`❌ DRAAD42K: WAARSCHUWING - weekEnd is geen zondag! (dag ${weekEndDay})`);
  }
  
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
  const periodStart = searchParams.period_start;
  
  console.log('🔍 DRAAD1F: Page params:', { rosterId, weekNummer, periodStart });
  
  // Validatie period_start parameter
  if (!periodStart || typeof periodStart !== 'string') {
    console.error('❌ DRAAD42K: Geen period_start gevonden in URL');
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
    console.error('❌ DRAAD42K: Ongeldig weeknummer:', weekNummer);
    notFound();
  }
  
  // Haal roster op
  const roster = await getRosterData(rosterId);
  if (!roster) {
    console.error('❌ DRAAD42K: Roster niet gevonden:', rosterId);
    notFound();
  }
  
  // 🔥 DRAAD1F: Bereken week data met UTC PARSING + MAANDAG CORRECTIE + VALIDATIE
  const { weekStart, weekEnd } = calculateWeekDates(periodStart, weekNum);
  const actualWeekNumber = getWeekNumber(weekStart);
  
  // Haal service types op
  const serviceTypes = await getServiceTypes();
  
  console.log('✅ DRAAD1F: Page data voorbereid:', {
    rosterId,
    weekNum,
    actualWeekNumber,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    serviceTypesCount: serviceTypes.length
  });
  
  const pageData = {
    rosterId,
    weekNummer: weekNum,
    actualWeekNumber,
    periodName: `Periode ${roster.start_date} - ${roster.end_date}`,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    serviceTypes,
    periodStart: periodStart,
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
