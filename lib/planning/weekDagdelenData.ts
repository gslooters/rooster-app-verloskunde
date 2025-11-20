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
}

export interface WeekNavigatieBounds {
  minWeek: number;
  maxWeek: number;
  currentWeek: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * 🔥 CRITICAL FIX - DRAAD40B.2: Verwijder ISO-week berekening!
 * Gebruik altijd weekBoundaryCalculator die werkt met period_start + offset
 * 
 * DEPRECATED - Gebruik getWeekBoundary() i.p.v. deze functie!
 */
export function calculateWeekDates(weekNummer: number, jaar: number): { startDatum: Date; eindDatum: Date } {
  console.warn('⚠️ DEPRECATED: calculateWeekDates() moet niet meer gebruikt worden!');
  console.warn('⚠️ Gebruik getWeekBoundary() met period_start parameter!');
  
  // Fallback voor backward compatibility (wordt niet meer aangeroepen na refactor)
  const firstDayOfYear = new Date(jaar, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const firstMonday = new Date(jaar, 0, 1 + daysToMonday);
  
  const targetWeekStart = new Date(firstMonday);
  targetWeekStart.setDate(firstMonday.getDate() + (weekNummer - 1) * 7);
  
  const startDatum = targetWeekStart;
  const eindDatum = new Date(startDatum);
  eindDatum.setDate(startDatum.getDate() + 6);
  
  return { startDatum, eindDatum };
}

/**
 * 🔥 CRITICAL FIX - DRAAD40B.2: Refactored getWeekDagdelenData
 * 
 * NIEUW SYSTEEM:
 * - weekNummer is nu weekIndex (1-5) binnen roosterperiode
 * - Haalt boundaries op via getWeekBoundary() die period_start gebruikt
 * - Geen ISO-week berekening meer!
 * - Geen jaar parameter meer nodig (maar behouden voor backward compatibility)
 * 
 * @param rosterId - UUID van het rooster
 * @param weekNummer - Week index binnen roosterperiode (1-5)
 * @param jaar - DEPRECATED maar behouden voor compatibility
 * @param periodStart - NIEUW: Expliciete period_start (YYYY-MM-DD)
 */
export async function getWeekDagdelenData(
  rosterId: string,
  weekNummer: number,
  jaar: number,
  periodStart?: string
): Promise<WeekDagdeelData | null> {
  console.log('═'.repeat(60));
  console.log(`🔍 [REFACTOR] START Week ${weekNummer} (weekIndex binnen roosterperiode)`);
  console.log('═'.repeat(60));
  
  try {
    const supabase = getSupabaseServer();
    
    // 🔥 STAP 1: Haal week boundaries op via weekBoundaryCalculator
    // Dit gebruikt period_start + offset i.p.v. ISO-week berekening!
    console.log('
🔄 [REFACTOR] STAP 1: Fetching week boundary...');
    console.log('Input:', { rosterId, weekNummer, periodStart });
    
    const weekBoundary = await getWeekBoundary(rosterId, weekNummer, periodStart);
    
    console.log('✅ [REFACTOR] Week boundary opgehaald:', weekBoundary);
    
    const weekStartStr = weekBoundary.startDatum;
    const weekEndStr = weekBoundary.eindDatum;
    
    console.log('📅 [REFACTOR] Week periode:', {
      weekIndex: weekNummer,
      start: weekStartStr,
      end: weekEndStr,
      label: weekBoundary.weekLabel
    });
    
    // STAP 2: Haal roster op (voor validatie)
    console.log('
🔄 [REFACTOR] STAP 2: Fetching roster...');
    
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !roster) {
      console.error('❌ [REFACTOR] STOP POINT 1: Roster niet gevonden');
      console.error('Error:', rosterError);
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [REFACTOR] Roster gevonden:', {
      id: roster.id,
      start_date: roster.start_date,
      end_date: roster.end_date
    });
    
    // STAP 3: Check datum overlap (STRING COMPARISON - geen timezone issues)
    console.log('
🔄 [REFACTOR] STAP 3: Checking datum overlap...');
    
    const rosterStartStr = roster.start_date;
    const rosterEndStr = roster.end_date;
    
    // Check: Week mag niet VOLLEDIG buiten roster vallen
    const weekStartsAfterRosterEnds = weekStartStr > rosterEndStr;
    const weekEndsBeforeRosterStarts = weekEndStr < rosterStartStr;
    const hasNoOverlap = weekStartsAfterRosterEnds || weekEndsBeforeRosterStarts;
    
    console.log('📊 [REFACTOR] Overlap analyse:', {
      weekPeriod: `${weekStartStr} t/m ${weekEndStr}`,
      rosterPeriod: `${rosterStartStr} t/m ${rosterEndStr}`,
      weekStartsAfterRosterEnds,
      weekEndsBeforeRosterStarts,
      hasNoOverlap,
      hasOverlap: !hasNoOverlap
    });
    
    if (hasNoOverlap) {
      console.error('❌ [REFACTOR] STOP POINT 2: Week valt volledig buiten rooster');
      console.error('⚠️ Dit zou NIET moeten gebeuren met correcte period_start!');
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [REFACTOR] Week heeft overlap met roster - proceeding');
    
    // STAP 4: Haal period data op
    console.log('
🔄 [REFACTOR] STAP 4: Fetching period data...');
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
      console.error('❌ [REFACTOR] STOP POINT 3: Supabase query error');
      console.error('Error:', periodError);
      console.log('═'.repeat(60));
      return null;
    }
    
    const recordCount = periodData?.length || 0;
    console.log(`✅ [REFACTOR] Query succesvol. Records: ${recordCount}`);
    
    if (recordCount === 0) {
      console.warn('⚠️  [REFACTOR] Geen period data gevonden (dit is OK voor lege week)');
      console.log('═'.repeat(60));
      // 🔥 NIET null returnen - genereer lege week!
    }
    
    // STAP 5: Analyseer dagdelen data
    console.log('
🔄 [REFACTOR] STAP 5: Analyzing dagdelen...');
    
    const totalDagdelen = periodData?.reduce((sum, p) => 
      sum + (p.roster_period_staffing_dagdelen?.length || 0), 0) || 0;
    
    console.log('📊 [REFACTOR] Dagdelen summary:', {
      totalParentRecords: recordCount,
      totalDagdelenRecords: totalDagdelen,
      avgPerParent: recordCount > 0 ? (totalDagdelen / recordCount).toFixed(1) : '0'
    });
    
    // Log eerste record als sample
    if (periodData && periodData[0]) {
      console.log('📋 [REFACTOR] Sample record:', {
        date: periodData[0].date,
        dagdelenCount: periodData[0].roster_period_staffing_dagdelen?.length || 0,
        firstDagdeel: periodData[0].roster_period_staffing_dagdelen?.[0]
      });
    }
    
    // STAP 6: Build days array
    console.log('
🔄 [REFACTOR] STAP 6: Building days array...');
    
    const days: DayDagdeelData[] = [];
    
    // 🔥 GEBRUIK BOUNDARIES VAN weekBoundary (niet opnieuw berekenen!)
    const startDate = parseISO(weekStartStr);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      
      // Zoek data voor deze dag
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      
      // Log alleen eerste dag voor details
      if (i === 0) {
        console.log(`📅 [REFACTOR] Eerste dag (${dateStr}):`, {
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
    }
    
    console.log(`✅ [REFACTOR] Days array gebouwd: ${days.length} dagen`);
    
    // STAP 7: Build result object
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDate, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(addDays(startDate, 6), 'd MMMM yyyy', { locale: nl }),
      days,
    };
    
    console.log('
✅ [REFACTOR] SUCCESS - Returning data');
    console.log('📦 [REFACTOR] Result:', {
      rosterId: result.rosterId,
      weekIndex: result.weekNummer,
      period: `${result.startDatum} - ${result.eindDatum}`,
      daysCount: result.days.length
    });
    console.log('═'.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('
❌ [REFACTOR] EXCEPTION CAUGHT');
    console.error('Error:', error);
    console.error('Message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Stack:', error instanceof Error ? error.stack : undefined);
    console.log('═'.repeat(60));
    return null;
  }
}

/**
 * 🔥 CRITICAL FIX - DRAAD40B.2: Refactored getWeekNavigatieBounds
 * 
 * NIEUW SYSTEEM:
 * - Gebruikt weekIndex (1-5) i.p.v. ISO-weeknummers
 * - Navigatie binnen 5-weekse roosterperiode
 */
export async function getWeekNavigatieBounds(
  rosterId: string,
  currentWeek: number
): Promise<WeekNavigatieBounds> {
  console.log('🧭 [REFACTOR] getWeekNavigatieBounds - weekIndex systeem');
  console.log('Input:', { rosterId, currentWeekIndex: currentWeek });
  
  try {
    // 🔥 NIEUWE LOGICA: Week index binnen 5-weekse periode
    // Min = 1, Max = 5, altijd!
    const bounds = {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
    
    console.log('✅ [REFACTOR] Week navigation bounds:', bounds);
    
    return bounds;
  } catch (error) {
    console.error('❌ [REFACTOR] Error in getWeekNavigatieBounds:', error);
    // Fallback
    return {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
  }
}
