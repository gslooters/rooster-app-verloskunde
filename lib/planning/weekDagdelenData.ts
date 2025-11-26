import { getSupabaseServer } from '@/lib/supabase-server';
import { addDays, parseISO, format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { getWeekBoundary } from './weekBoundaryCalculator';

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
  team: string;
  aantal: number;
  status: string;
  serviceId?: string;
}

export interface WeekNavigatieBounds {
  minWeek: number;
  maxWeek: number;
  currentWeek: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export async function getWeekDagdelenData(
  rosterId: string,
  weekNummer: number,
  jaar: number,
  periodStart?: string
): Promise<WeekDagdeelData | null> {
  try {
    const supabase = getSupabaseServer();
    const weekBoundary = await getWeekBoundary(rosterId, weekNummer, periodStart);
    const weekStartStr = weekBoundary.startDatum;
    const weekEndStr = weekBoundary.eindDatum;
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();
    if (rosterError || !roster) return null;
    const rosterStartStr = roster.start_date;
    const rosterEndStr = roster.end_date;
    const weekStartsAfterRosterEnds = weekStartStr > rosterEndStr;
    const weekEndsBeforeRosterStarts = weekEndStr < rosterStartStr;
    const hasNoOverlap = weekStartsAfterRosterEnds || weekEndsBeforeRosterStarts;
    if (hasNoOverlap) return null;
    const { data: periodData, error: periodError } = await supabase
      .from('roster_period_staffing')
      .select(`id,date,service_id,roster_period_staffing_dagdelen (id,dagdeel,team,status,aantal)`)
      .eq('roster_id', rosterId)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('date', { ascending: true });
    if (periodError) return null;
    if (periodData && periodData.length > 0) {
      const firstDbDate = periodData[0].date;
      const firstDbDateObj = new Date(firstDbDate + 'T00:00:00Z');
      if (firstDbDateObj.getUTCDay() === 0) {
        const filteredData = periodData.filter(record => record.date !== firstDbDate);
        periodData.splice(0, periodData.length, ...filteredData);
      }
    }
    if (periodData && periodData.length > 7) periodData.splice(7);
    const days: DayDagdeelData[] = [];
    const startDate = parseISO(weekStartStr);
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      const dayServiceId = dayPeriod?.service_id;
      // FIX: Direct filteren op dagdeel letter: 'O', 'M', 'A', 'N' zonder toLowerCase, want database heeft letter
      const dagdelen = {
        ochtend: dagdelenRecords
          .filter(d => d.dagdeel === 'O')
          .map(d => ({ team: d.team || '', aantal: d.aantal || 0, status: d.status || 'NIET_TOEGEWEZEN', serviceId: dayServiceId })),
        middag: dagdelenRecords
          .filter(d => d.dagdeel === 'M')
          .map(d => ({ team: d.team || '', aantal: d.aantal || 0, status: d.status || 'NIET_TOEGEWEZEN', serviceId: dayServiceId })),
        avond: dagdelenRecords
          .filter(d => d.dagdeel === 'A')
          .map(d => ({ team: d.team || '', aantal: d.aantal || 0, status: d.status || 'NIET_TOEGEWEZEN', serviceId: dayServiceId })),
        nacht: dagdelenRecords
          .filter(d => d.dagdeel === 'N')
          .map(d => ({ team: d.team || '', aantal: d.aantal || 0, status: d.status || 'NIET_TOEGEWEZEN', serviceId: dayServiceId })),
      };
      days.push({ datum: dateStr, dagNaam: dayName, dagdelen });
    }
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDate, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(addDays(startDate, 6), 'd MMMM yyyy', { locale: nl }),
      days,
    };
    return result;
  } catch (error) {
    return null;
  }
}

export async function getWeekNavigatieBounds(
  rosterId: string,
  currentWeek: number
): Promise<WeekNavigatieBounds> {
  try {
    const bounds = {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
    return bounds;
  } catch (error) {
    return {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
  }
}
