import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WeekDagdelenClient from '@/components/planning/week-dagdelen/WeekDagdelenClient';
import { getWeekDagdelenData, getWeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';
import { getWeekBoundary } from '@/lib/planning/weekBoundaryCalculator';

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string;
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
  const weekNummer = parseInt(params.weekNummer);
  
  // 🔥 DRAAD40B BUGFIX: Bepaal jaar uit period_start OF gebruik jaar parameter als fallback
  let jaar: number;
  
  if (searchParams.period_start) {
    // Parse jaar uit period_start (format: YYYY-MM-DD)
    const periodStartDate = new Date(searchParams.period_start + 'T00:00:00Z');
    jaar = periodStartDate.getUTCFullYear();
    console.log('✅ DRAAD40B: Jaar bepaald uit period_start:', jaar);
  } else if (searchParams.jaar) {
    jaar = parseInt(searchParams.jaar);
    console.log('✅ Jaar bepaald uit jaar parameter:', jaar);
  } else {
    jaar = new Date().getFullYear();
    console.log('⚠️ Geen period_start of jaar parameter, gebruik huidig jaar:', jaar);
  }

  // Validate week number (1-5 voor 5-weekse roosterperiode)
  if (isNaN(weekNummer) || weekNummer < 1 || weekNummer > 5) {
    console.error('❌ Invalid weekNummer:', weekNummer);
    notFound();
  }

  try {
    console.log(`📊 DRAAD40B: Fetching data voor roster ${params.rosterId}, week ${weekNummer}, jaar ${jaar}`);
    
    // Fetch data on server side for initial render
    const weekData = await getWeekDagdelenData(params.rosterId, weekNummer, jaar);
    const navigatieBounds = await getWeekNavigatieBounds(params.rosterId, weekNummer);
    
    // DRAAD40B FASE 2: Fetch week boundary voor navigatie
    const weekBoundary = await getWeekBoundary(params.rosterId, weekNummer);

    // Check if week exists in roster
    if (!weekData) {
      console.error('❌ Week niet gevonden in rooster');
      notFound();
    }

    console.log('✅ DRAAD40B: Data succesvol opgehaald, rendering client component');

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
    console.error('❌ DRAAD40B: Error loading week data:', error);
    notFound();
  }
}
