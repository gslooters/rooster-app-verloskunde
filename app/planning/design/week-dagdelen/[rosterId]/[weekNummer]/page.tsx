import { Suspense } from 'react';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import WeekDagdelenVaststellingTable from '@/components/planning/week-dagdelen/WeekDagdelenVaststellingTable';

/**
 * DRAAD42 - Week Dagdelen Vaststelling Scherm
 * 
 * Route: /planning/design/week-dagdelen/[rosterId]/[weekNummer]
 * 
 * Functionaliteit:
 * - Server-side data fetching voor rooster periode
 * - Validatie van weekNummer (1-5)
 * - Service types en staffing data ophalen
 * - Dynamische week navigatie
 */

interface PageProps {
  params: {
    rosterId: string;
    weekNummer: string;
  };
  searchParams: {
    [key: string]: string | string[] | undefined;
  };
}

export const metadata = {
  title: 'Diensten per Dagdeel Vaststellen',
  description: 'Vaststelling van diensten per dagdeel per week',
};

async function getRosterPeriodData(rosterId: string) {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('roster_period')
    .select('*')
    .eq('id', rosterId)
    .single();
  
  if (error || !data) {
    console.error('Error fetching roster period:', error);
    return null;
  }
  
  return data;
}

async function getServiceTypes() {
  const supabase = createServerComponentClient({ cookies });
  
  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  
  if (error) {
    console.error('Error fetching service types:', error);
    return [];
  }
  
  return data || [];
}

function calculateWeekDates(startDate: string, weekIndex: number) {
  const start = new Date(startDate);
  // Week 1 = index 0, Week 2 = index 1, etc.
  const weekOffset = weekIndex * 7;
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + weekOffset);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return { weekStart, weekEnd };
}

function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export default async function WeekDagdelenPage({ params }: PageProps) {
  const { rosterId, weekNummer } = params;
  
  // Validatie weekNummer
  const weekNum = parseInt(weekNummer);
  if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
    notFound();
  }
  
  // Haal roster periode op
  const rosterPeriod = await getRosterPeriodData(rosterId);
  if (!rosterPeriod) {
    notFound();
  }
  
  // Bereken week data
  const { weekStart, weekEnd } = calculateWeekDates(rosterPeriod.start_date, weekNum - 1);
  const actualWeekNumber = getWeekNumber(weekStart);
  
  // Haal service types op
  const serviceTypes = await getServiceTypes();
  
  // Props voor client component
  const pageData = {
    rosterId,
    weekNummer: weekNum,
    actualWeekNumber,
    periodName: rosterPeriod.naam || `Periode Week ${getWeekNumber(new Date(rosterPeriod.start_date))} - Week ${getWeekNumber(new Date(rosterPeriod.end_date))}`,
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
