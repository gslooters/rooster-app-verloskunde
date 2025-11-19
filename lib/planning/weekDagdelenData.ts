import { createClient } from '@supabase/supabase-js';
import { getISOWeek, getYear, startOfWeek, endOfWeek, format } from 'date-fns';
import { nl } from 'date-fns/locale';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface WeekDagdeelData {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  startDatum: string;
  eindDatum: string;
  days: DayDagdeelData[];
}

export interface DayDagdeelData {
  datum: string;
  dagNaam: string;
  dagdelen: {
    ochtend: DagdeelAssignment[];
    middag: DagdeelAssignment[];
    avond: DagdeelAssignment[];
    nacht: DagdeelAssignment[];
  };
}

export interface DagdeelAssignment {
  employeeId: string;
  employeeName: string;
  team: string;
  status: 'assigned' | 'tentative' | 'unavailable';
}

export interface WeekNavigatieBounds {
  minWeek: number;
  maxWeek: number;
  currentWeek: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * Calculate start and end dates for a given ISO week number
 */
export function calculateWeekDates(weekNummer: number, jaar: number): { startDatum: Date; eindDatum: Date } {
  // Create date for first day of year
  const firstDayOfYear = new Date(jaar, 0, 1);
  
  // Calculate the date of the Monday of the first ISO week
  const firstMonday = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });
  
  // Add weeks to get to target week
  const targetWeekStart = new Date(firstMonday);
  targetWeekStart.setDate(firstMonday.getDate() + (weekNummer - 1) * 7);
  
  const startDatum = startOfWeek(targetWeekStart, { weekStartsOn: 1 });
  const eindDatum = endOfWeek(targetWeekStart, { weekStartsOn: 1 });
  
  return { startDatum, eindDatum };
}

/**
 * Get week dagdelen data for a specific roster and week
 */
export async function getWeekDagdelenData(
  rosterId: string,
  weekNummer: number,
  jaar: number
): Promise<WeekDagdeelData | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Calculate week dates
    const { startDatum, eindDatum } = calculateWeekDates(weekNummer, jaar);
    
    // Fetch roster to verify it exists
    const { data: roster, error: rosterError } = await supabase
      .from('rosters')
      .select('id, start_datum, eind_datum')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !roster) {
      console.error('Roster not found:', rosterError);
      return null;
    }
    
    // Check if week is within roster period
    const rosterStart = new Date(roster.start_datum);
    const rosterEnd = new Date(roster.eind_datum);
    
    if (startDatum < rosterStart || eindDatum > rosterEnd) {
      console.error('Week outside roster period');
      return null;
    }
    
    // Fetch dagdelen assignments for this week
    const { data: assignments, error: assignmentsError } = await supabase
      .from('roster_dagdelen_assignments')
      .select(`
        datum,
        dagdeel,
        employee_id,
        employees:employee_id (
          id,
          naam,
          team
        )
      `)
      .eq('roster_id', rosterId)
      .gte('datum', format(startDatum, 'yyyy-MM-dd'))
      .lte('datum', format(eindDatum, 'yyyy-MM-dd'))
      .order('datum', { ascending: true });
    
    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return null;
    }
    
    // Build days array
    const days: DayDagdeelData[] = [];
    const currentDate = new Date(startDatum);
    
    for (let i = 0; i < 7; i++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      
      // Filter assignments for this day
      const dayAssignments = assignments?.filter(a => a.datum === dateStr) || [];
      
      // Group by dagdeel
      const dagdelen = {
        ochtend: dayAssignments
          .filter(a => a.dagdeel === 'ochtend')
          .map(a => ({
            employeeId: a.employee_id,
            employeeName: a.employees?.naam || 'Onbekend',
            team: a.employees?.team || '',
            status: 'assigned' as const,
          })),
        middag: dayAssignments
          .filter(a => a.dagdeel === 'middag')
          .map(a => ({
            employeeId: a.employee_id,
            employeeName: a.employees?.naam || 'Onbekend',
            team: a.employees?.team || '',
            status: 'assigned' as const,
          })),
        avond: dayAssignments
          .filter(a => a.dagdeel === 'avond')
          .map(a => ({
            employeeId: a.employee_id,
            employeeName: a.employees?.naam || 'Onbekend',
            team: a.employees?.team || '',
            status: 'assigned' as const,
          })),
        nacht: dayAssignments
          .filter(a => a.dagdeel === 'nacht')
          .map(a => ({
            employeeId: a.employee_id,
            employeeName: a.employees?.naam || 'Onbekend',
            team: a.employees?.team || '',
            status: 'assigned' as const,
          })),
      };
      
      days.push({
        datum: dateStr,
        dagNaam: dayName,
        dagdelen,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDatum, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(eindDatum, 'd MMMM yyyy', { locale: nl }),
      days,
    };
  } catch (error) {
    console.error('Error in getWeekDagdelenData:', error);
    return null;
  }
}

/**
 * Get navigation boundaries for week navigation
 */
export async function getWeekNavigatieBounds(
  rosterId: string,
  currentWeek: number
): Promise<WeekNavigatieBounds> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch roster period
    const { data: roster, error } = await supabase
      .from('rosters')
      .select('start_datum, eind_datum')
      .eq('id', rosterId)
      .single();
    
    if (error || !roster) {
      return {
        minWeek: 1,
        maxWeek: 52,
        currentWeek,
        hasPrevious: currentWeek > 1,
        hasNext: currentWeek < 52,
      };
    }
    
    // Calculate week numbers for roster period
    const startDate = new Date(roster.start_datum);
    const endDate = new Date(roster.eind_datum);
    
    const minWeek = getISOWeek(startDate);
    const maxWeek = getISOWeek(endDate);
    
    return {
      minWeek,
      maxWeek,
      currentWeek,
      hasPrevious: currentWeek > minWeek,
      hasNext: currentWeek < maxWeek,
    };
  } catch (error) {
    console.error('Error in getWeekNavigatieBounds:', error);
    return {
      minWeek: 1,
      maxWeek: 52,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 52,
    };
  }
}
