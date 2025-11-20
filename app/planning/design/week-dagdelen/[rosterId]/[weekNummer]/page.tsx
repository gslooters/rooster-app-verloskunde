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
    period_start?: string; // 🔥 DRAAD40B: Nieuwe parameter toegevoegd
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
  
  // 🔥 DRAAD40B BUGFIX: Bepaal jaar uit period_start OF gebruik jaar parameter als fallback
  let jaar: number;
  
  if (searchParams.period_start) {
    // Parse jaar uit period_start (format: YYYY-MM-DD)
    const periodStartDate = new Date(searchParams.period_start + 'T00:00:00Z');
    jaar = periodStartDate.getUTCFullYear();
    console.log('✅ OPTIE A: Jaar bepaald uit period_start:', jaar);
  } else if (searchParams.jaar) {
    jaar = parseInt(searchParams.jaar);
    console.log('✅ Jaar bepaald uit jaar parameter:', jaar);
  } else {
    jaar = new Date().getFullYear();
    console.log('⚠️ Geen period_start of jaar parameter, gebruik huidig jaar:', jaar);
  }

  // ✅ OPTIE A FIX: Validate week INDEX (1-5 voor 5-weekse roosterperiode)
  // Dit is GEEN ISO weeknummer meer, maar de positie binnen de roosterperiode!
  if (isNaN(weekNummer) || weekNummer < 1 || weekNummer > 5) {
    console.error(`❌ OPTIE A: Invalid weekIndex: ${weekNummer} (moet tussen 1-5 zijn)`);
    notFound();
  }

  console.log(`✅ OPTIE A: Validatie geslaagd - weekIndex ${weekNummer} is geldig (1-5)`);

  try {
    console.log(`📊 OPTIE A: Fetching data voor roster ${params.rosterId}, weekIndex ${weekNummer}, jaar ${jaar}`);
    
    // Fetch data on server side for initial render
    const weekData = await getWeekDagdelenData(params.rosterId, weekNummer, jaar);
    const navigatieBounds = await getWeekNavigatieBounds(params.rosterId, weekNummer);
    
    // DRAAD40B FASE 2: Fetch week boundary voor navigatie
    const weekBoundary = await getWeekBoundary(params.rosterId, weekNummer);

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
    notFound();
  }
}
