import { getSupabaseServer } from '@/lib/supabase-server';
import { getISOWeek, startOfWeek, endOfWeek, format } from 'date-fns';
import { nl } from 'date-fns/locale';

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
  const firstDayOfYear = new Date(jaar, 0, 1);
  const firstMonday = startOfWeek(firstDayOfYear, { weekStartsOn: 1 });
  
  const targetWeekStart = new Date(firstMonday);
  targetWeekStart.setDate(firstMonday.getDate() + (weekNummer - 1) * 7);
  
  const startDatum = startOfWeek(targetWeekStart, { weekStartsOn: 1 });
  const eindDatum = endOfWeek(targetWeekStart, { weekStartsOn: 1 });
  
  return { startDatum, eindDatum };
}

/**
 * Get week dagdelen data for a specific roster and week
 * 
 * DIAGNOSE VERSIE met uitgebreide logging en string-based datum vergelijking
 * Fix: Gebruikt string comparison voor datums om timezone issues te voorkomen
 * DRAAD39.6 FIX: Gecorrigeerde kolomnamen naar start_date/end_date (database schema)
 */
export async function getWeekDagdelenData(
  rosterId: string,
  weekNummer: number,
  jaar: number
): Promise<WeekDagdeelData | null> {
  console.log('═'.repeat(60));
  console.log(`🔍 [DIAGNOSE] START Week ${weekNummer}/${jaar}`);
  console.log('═'.repeat(60));
  
  try {
    const supabase = getSupabaseServer();
    
    // STAP 1: Bereken week datums
    const { startDatum, eindDatum } = calculateWeekDates(weekNummer, jaar);
    const weekStartStr = format(startDatum, 'yyyy-MM-dd');
    const weekEndStr = format(eindDatum, 'yyyy-MM-dd');
    
    console.log('📊 [DIAGNOSE] Input parameters:', {
      rosterId,
      weekNummer,
      jaar,
      weekStartStr,
      weekEndStr
    });
    
    // STAP 2: Haal roster op
    console.log('\n🔄 [DIAGNOSE] STAP 2: Fetching roster...');
    
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !roster) {
      console.error('❌ [DIAGNOSE] STOP POINT 1: Roster niet gevonden');
      console.error('Error:', rosterError);
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DIAGNOSE] Roster gevonden:', {
      id: roster.id,
      start_date: roster.start_date,
      end_date: roster.end_date
    });
    
    // STAP 3: Check datum overlap (STRING COMPARISON - geen timezone issues)
    console.log('\n🔄 [DIAGNOSE] STAP 3: Checking datum overlap...');
    
    const rosterStartStr = roster.start_date;
    const rosterEndStr = roster.end_date;
    
    // Check: Week mag niet VOLLEDIG buiten roster vallen
    const weekStartsAfterRosterEnds = weekStartStr > rosterEndStr;
    const weekEndsBeforeRosterStarts = weekEndStr < rosterStartStr;
    const hasNoOverlap = weekStartsAfterRosterEnds || weekEndsBeforeRosterStarts;
    
    console.log('📊 [DIAGNOSE] Overlap analyse:', {
      weekPeriod: `${weekStartStr} t/m ${weekEndStr}`,
      rosterPeriod: `${rosterStartStr} t/m ${rosterEndStr}`,
      weekStartsAfterRosterEnds,
      weekEndsBeforeRosterStarts,
      hasNoOverlap,
      hasOverlap: !hasNoOverlap
    });
    
    if (hasNoOverlap) {
      console.error('❌ [DIAGNOSE] STOP POINT 2: Week valt volledig buiten rooster');
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DIAGNOSE] Week heeft overlap met roster - proceeding');
    
    // STAP 4: Haal period data op
    console.log('\n🔄 [DIAGNOSE] STAP 4: Fetching period data...');
    console.log('Query params:', {
      table: 'roster_period_staffing',
      rosterId,
      dateGte: weekStartStr,
      dateLte: weekEndStr
    });
    
    const { data: periodData, error: periodError } = await supabase
      .from('roster_period_staffing')
      .select(`
        id,
        date,
        roster_period_staffing_dagdelen (
          id,
          dagdeel,
          team,
          status,
          aantal
        )
      `)
      .eq('roster_id', rosterId)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .order('date', { ascending: true });
    
    if (periodError) {
      console.error('❌ [DIAGNOSE] STOP POINT 3: Supabase query error');
      console.error('Error:', periodError);
      console.log('═'.repeat(60));
      return null;
    }
    
    const recordCount = periodData?.length || 0;
    console.log(`✅ [DIAGNOSE] Query succesvol. Records: ${recordCount}`);
    
    if (recordCount === 0) {
      console.warn('⚠️  [DIAGNOSE] STOP POINT 4: Geen period data gevonden');
      console.warn('Query werkte, maar gaf 0 resultaten terug');
      console.log('═'.repeat(60));
      return null;
    }
    
    // STAP 5: Analyseer dagdelen data
    console.log('\n🔄 [DIAGNOSE] STAP 5: Analyzing dagdelen...');
    
    const totalDagdelen = periodData.reduce((sum, p) => 
      sum + (p.roster_period_staffing_dagdelen?.length || 0), 0
    );
    
    console.log('📊 [DIAGNOSE] Dagdelen summary:', {
      totalParentRecords: recordCount,
      totalDagdelenRecords: totalDagdelen,
      avgPerParent: recordCount > 0 ? (totalDagdelen / recordCount).toFixed(1) : '0'
    });
    
    // Log eerste record als sample
    if (periodData[0]) {
      console.log('📋 [DIAGNOSE] Sample record:', {
        date: periodData[0].date,
        dagdelenCount: periodData[0].roster_period_staffing_dagdelen?.length || 0,
        firstDagdeel: periodData[0].roster_period_staffing_dagdelen?.[0]
      });
    }
    
    // STAP 6: Build days array
    console.log('\n🔄 [DIAGNOSE] STAP 6: Building days array...');
    
    const days: DayDagdeelData[] = [];
    const currentDate = new Date(startDatum);
    
    for (let i = 0; i < 7; i++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      
      // Zoek data voor deze dag
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      
      // Log alleen eerste dag voor details
      if (i === 0) {
        console.log(`📅 [DIAGNOSE] Eerste dag (${dateStr}):`, {
          dagNaam: dayName,
          gevondenInDB: !!dayPeriod,
          aantalDagdelen: dagdelenRecords.length
        });
      }
      
      // Groepeer per dagdeel (case-insensitive voor veiligheid)
      const dagdelen = {
        ochtend: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'ochtend')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
          })),
        middag: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'middag')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
          })),
        avond: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'avond')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
          })),
        nacht: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'nacht')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
          })),
      };
      
      days.push({
        datum: dateStr,
        dagNaam: dayName,
        dagdelen,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`✅ [DIAGNOSE] Days array gebouwd: ${days.length} dagen`);
    
    // STAP 7: Build result object
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDatum, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(eindDatum, 'd MMMM yyyy', { locale: nl }),
      days,
    };
    
    console.log('\n✅ [DIAGNOSE] SUCCESS - Returning data');
    console.log('📦 [DIAGNOSE] Result:', {
      rosterId: result.rosterId,
      week: `${result.weekNummer}/${result.jaar}`,
      period: `${result.startDatum} - ${result.eindDatum}`,
      daysCount: result.days.length
    });
    console.log('═'.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('\n❌ [DIAGNOSE] EXCEPTION CAUGHT');
    console.error('Error:', error);
    console.error('Message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Stack:', error instanceof Error ? error.stack : undefined);
    console.log('═'.repeat(60));
    return null;
  }
}

/**
 * Get navigation boundaries for week navigation
 * DRAAD39.6 FIX: Gecorrigeerde kolomnamen naar start_date/end_date (database schema)
 */
export async function getWeekNavigatieBounds(
  rosterId: string,
  currentWeek: number
): Promise<WeekNavigatieBounds> {
  try {
    const supabase = getSupabaseServer();
    
    const { data: roster, error } = await supabase
      .from('roosters')
      .select('start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (error || !roster) {
      console.error('❌ [SERVER] Error fetching roster for navigation:', error);
      return {
        minWeek: 1,
        maxWeek: 52,
        currentWeek,
        hasPrevious: currentWeek > 1,
        hasNext: currentWeek < 52,
      };
    }
    
    const startDate = new Date(roster.start_date);
    const endDate = new Date(roster.end_date);
    
    const minWeek = getISOWeek(startDate);
    const maxWeek = getISOWeek(endDate);
    
    const bounds = {
      minWeek,
      maxWeek,
      currentWeek,
      hasPrevious: currentWeek > minWeek,
      hasNext: currentWeek < maxWeek,
    };
    
    console.log('✅ [SERVER] Week navigation bounds:', bounds);
    
    return bounds;
  } catch (error) {
    console.error('❌ [SERVER] Error in getWeekNavigatieBounds:', error);
    return {
      minWeek: 1,
      maxWeek: 52,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 52,
    };
  }
}