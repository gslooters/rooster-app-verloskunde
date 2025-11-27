import { getSupabaseServer } from '@/lib/supabase-server';
import { parseUTCDate, addUTCDays, toUTCDateString, formatUTCDate } from '@/lib/utils/date-utc';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { getWeekBoundary } from './weekBoundaryCalculator';

/**
 * DRAAD62: UTC-SAFE WEEK DAGDELEN DATA
 * 
 * Deze module gebruikt consistent UTC-safe datum utilities voor:
 * - Datum parsing (parseUTCDate)
 * - Datum arithmetic (addUTCDays)
 * - Datum formatting (toUTCDateString, formatUTCDate)
 * 
 * Waarom UTC-safe?
 * - Voorkomt timezone bugs tussen server/client
 * - Geen DST transition issues (maart/oktober klokverandering)
 * - Database DATE type matching altijd consistent
 * - Week boundaries altijd correct (ma-zo)
 * 
 * DRAAD61A/B/C/D context:
 * - Team mapping fixes (GRO/ORA/TOT)
 * - Dagdeel letter matching ('O','M','A','N')
 * - Zondag filtering voor week boundaries
 */

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
    
    // Check roster overlap
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
    
    // Fetch period data from database
    const { data: periodData, error: periodError } = await supabase
      .from('roster_period_staffing')
      .select(`id,date,service_id,roster_period_staffing_dagdelen (id,dagdeel,team,status,aantal)`)
      .eq('roster_id', rosterId)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('date', { ascending: true });
    
    if (periodError) {
      console.error('🔴 [DRAAD62] Database query error:', periodError);
      return null;
    }
    
    // ✅ Zondag filtering (was al UTC-safe, behouden)
    if (periodData && periodData.length > 0) {
      const firstDbDate = periodData[0].date;
      const firstDbDateObj = new Date(firstDbDate + 'T00:00:00Z');
      if (firstDbDateObj.getUTCDay() === 0) {
        const filteredData = periodData.filter(record => record.date !== firstDbDate);
        periodData.splice(0, periodData.length, ...filteredData);
      }
    }
    
    // Max 7 dagen per week
    if (periodData && periodData.length > 7) periodData.splice(7);
    
    // 🔥 DRAAD62 FIX: UTC-safe datum generatie
    const days: DayDagdeelData[] = [];
    const startDate = parseUTCDate(weekStartStr);  // ✅ UTC!
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addUTCDays(startDate, i);  // ✅ UTC arithmetic!
      const dateStr = toUTCDateString(currentDate);  // ✅ UTC YYYY-MM-DD!
      
      // Nederlandse dag naam (date-fns locale formatting is OK, data is UTC)
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      const dayServiceId = dayPeriod?.service_id;
      
      // DRAAD61A: Direct filteren op dagdeel letter ('O','M','A','N')
      // Database heeft uppercase letters, geen toLowerCase nodig
      const dagdelen = {
        ochtend: dagdelenRecords
          .filter(d => d.dagdeel === 'O')
          .map(d => ({ 
            team: d.team || '', 
            aantal: d.aantal || 0, 
            status: d.status || 'NIET_TOEGEWEZEN', 
            serviceId: dayServiceId 
          })),
        middag: dagdelenRecords
          .filter(d => d.dagdeel === 'M')
          .map(d => ({ 
            team: d.team || '', 
            aantal: d.aantal || 0, 
            status: d.status || 'NIET_TOEGEWEZEN', 
            serviceId: dayServiceId 
          })),
        avond: dagdelenRecords
          .filter(d => d.dagdeel === 'A')
          .map(d => ({ 
            team: d.team || '', 
            aantal: d.aantal || 0, 
            status: d.status || 'NIET_TOEGEWEZEN', 
            serviceId: dayServiceId 
          })),
        nacht: dagdelenRecords
          .filter(d => d.dagdeel === 'N')
          .map(d => ({ 
            team: d.team || '', 
            aantal: d.aantal || 0, 
            status: d.status || 'NIET_TOEGEWEZEN', 
            serviceId: dayServiceId 
          })),
      };
      
      days.push({ datum: dateStr, dagNaam: dayName, dagdelen });
    }
    
    // 🔥 DRAAD62 FIX: UTC-safe display datum formatting
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: formatUTCDate(startDate, 'nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      eindDatum: formatUTCDate(addUTCDays(startDate, 6), 'nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      }),
      days,
    };
    
    return result;
  } catch (error) {
    console.error('🔴 [DRAAD62] getWeekDagdelenData error:', error);
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
    console.error('🔴 [DRAAD62] getWeekNavigatieBounds error:', error);
    return {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
  }
}
