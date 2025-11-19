import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WeekDagdelenClient from '@/components/planning/week-dagdelen/WeekDagdelenClient';
import { getWeekDagdelenData, getWeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string;
  };
  searchParams: {
    jaar?: string;
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
  const jaar = searchParams.jaar ? parseInt(searchParams.jaar) : new Date().getFullYear();

  // Validate week number (1-53)
  if (isNaN(weekNummer) || weekNummer < 1 || weekNummer > 53) {
    notFound();
  }

  try {
    // Fetch data on server side for initial render
    const weekData = await getWeekDagdelenData(params.rosterId, weekNummer, jaar);
    const navigatieBounds = await getWeekNavigatieBounds(params.rosterId, weekNummer);

    // Check if week exists in roster
    if (!weekData) {
      notFound();
    }

    return (
      <WeekDagdelenClient
        rosterId={params.rosterId}
        weekNummer={weekNummer}
        jaar={jaar}
        initialWeekData={weekData}
        navigatieBounds={navigatieBounds}
      />
    );
  } catch (error) {
    console.error('Error loading week data:', error);
    notFound();
  }
}
