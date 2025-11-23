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

/**
 * 🔥 DRAAD45.6 FIX: DagdeelAssignment uitgebreid met serviceId
 * 
 * VOOR: Alleen team, aantal, status
 * NA:   Ook serviceId voor database matching
 */
export interface DagdeelAssignment {
  team: string;
  aantal: number;
  status: string;
  serviceId?: string;  // 🔥 NIEUW: CONS, POL, ECHO, etc.
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
 * 🔥 DRAAD45.6 COMPLETE FIX - Service ID Pipeline
 * 
 * WIJZIGINGEN:
 * 1. SELECT query: service_id toegevoegd aan roster_period_staffing
 * 2. DagdeelAssignment mapping: serviceId veld toegevoegd
 * 3. Logging: service_id info toegevoegd voor debugging
 * 
 * DATABASE STRUCTUUR:
 * roster_period_staffing:
 *   - id (PK)
 *   - roster_id (FK)
 *   - service_id (FK) ← NU OPGEHAALD!
 *   - date
 * 
 * roster_period_staffing_dagdelen:
 *   - id (PK)
 *   - roster_period_staffing_id (FK)
 *   - dagdeel (ochtend/middag/avond/nacht)
 *   - team (GRO/ORA/TOT)
 *   - status (MOET/MAG/MAG_NIET)
 *   - aantal (0-9)
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
  console.log(`🔍 [DRAAD45.6] START Week ${weekNummer} - Service ID Pipeline Fix`);
  console.log('═'.repeat(60));
  
  try {
    const supabase = getSupabaseServer();
    
    // STAP 1: Haal week boundaries op
    console.log('\n🔄 [DRAAD45.6] STAP 1: Fetching week boundary...');
    console.log('Input:', { rosterId, weekNummer, periodStart });
    
    const weekBoundary = await getWeekBoundary(rosterId, weekNummer, periodStart);
    
    console.log('✅ [DRAAD45.6] Week boundary opgehaald:', weekBoundary);
    
    const weekStartStr = weekBoundary.startDatum;
    const weekEndStr = weekBoundary.eindDatum;
    
    // Week validatie
    const weekStartDate = new Date(weekStartStr + 'T00:00:00Z');
    const weekStartDayOfWeek = weekStartDate.getUTCDay();
    
    console.log('\n🔍 [DRAAD45.6] VALIDATIE: Checking week start day...');
    console.log('📅 Week Start:', {
      datum: weekStartStr,
      dagVanWeek: weekStartDayOfWeek,
      isDagVanWeek: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][weekStartDayOfWeek],
      isMaandag: weekStartDayOfWeek === 1 ? '✅' : '❌'
    });
    
    if (weekStartDayOfWeek !== 1) {
      console.error('❌ [DRAAD45.6] KRITIEKE FOUT: Week start is GEEN maandag!');
    } else {
      console.log('✅ [DRAAD45.6] Week start is correct (maandag)');
    }
    
    // STAP 2: Haal roster op
    console.log('\n🔄 [DRAAD45.6] STAP 2: Fetching roster...');
    
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !roster) {
      console.error('❌ [DRAAD45.6] Roster niet gevonden:', rosterError);
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DRAAD45.6] Roster gevonden:', {
      id: roster.id,
      start_date: roster.start_date,
      end_date: roster.end_date
    });
    
    // STAP 3: Check datum overlap
    const rosterStartStr = roster.start_date;
    const rosterEndStr = roster.end_date;
    
    const weekStartsAfterRosterEnds = weekStartStr > rosterEndStr;
    const weekEndsBeforeRosterStarts = weekEndStr < rosterStartStr;
    const hasNoOverlap = weekStartsAfterRosterEnds || weekEndsBeforeRosterStarts;
    
    if (hasNoOverlap) {
      console.error('❌ [DRAAD45.6] Week valt buiten rooster periode');
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DRAAD45.6] Week heeft overlap met roster');
    
    // 🔥 STAP 4: DATABASE QUERY MET SERVICE_ID!
    console.log('\n🔥 [DRAAD45.6] STAP 4: Fetching period data WITH service_id...');
    console.log('Query params:', {
      table: 'roster_period_staffing',
      rosterId,
      dateGte: weekStartStr,
      dateLte: weekEndStr,
      NEW_FIELD: 'service_id ← TOEGEVOEGD!'
    });
    
    const { data: periodData, error: periodError } = await supabase
      .from('roster_period_staffing')
      .select(`
        id,
        date,
        service_id,
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
      console.error('❌ [DRAAD45.6] Supabase query error:', periodError);
      console.log('═'.repeat(60));
      return null;
    }
    
    const recordCount = periodData?.length || 0;
    console.log(`✅ [DRAAD45.6] Query succesvol. Records: ${recordCount}`);
    
    // 🔥 Log service_id distribution
    if (periodData && periodData.length > 0) {
      const serviceIdCounts: Record<string, number> = {};
      periodData.forEach(record => {
        const sid = record.service_id || 'NULL';
        serviceIdCounts[sid] = (serviceIdCounts[sid] || 0) + 1;
      });
      
      console.log('📊 [DRAAD45.6] Service ID distributie:', serviceIdCounts);
    }
    
    // Filter zondag als eerste dag
    if (periodData && periodData.length > 0) {
      const firstDbDate = periodData[0].date;
      const firstDbDateObj = new Date(firstDbDate + 'T00:00:00Z');
      const firstDbDayOfWeek = firstDbDateObj.getUTCDay();
      
      if (firstDbDayOfWeek === 0) {
        console.warn('⚠️  [DRAAD45.6] ZONDAG FILTERING...');
        const filteredData = periodData.filter(record => record.date !== firstDbDate);
        periodData.splice(0, periodData.length, ...filteredData);
        console.log(`✅ [DRAAD45.6] Zondag verwijderd: ${filteredData.length} records blijven`);
      }
    }
    
    // Limiteer tot 7 dagen
    if (periodData && periodData.length > 7) {
      console.warn(`⚠️  [DRAAD45.6] Limiet tot 7 dagen (was: ${periodData.length})`);
      periodData.splice(7);
    }
    
    const totalDagdelen = periodData?.reduce((sum, p) => 
      sum + (p.roster_period_staffing_dagdelen?.length || 0), 0) || 0;
    
    console.log('📊 [DRAAD45.6] Dagdelen summary:', {
      totalParentRecords: periodData?.length || 0,
      totalDagdelenRecords: totalDagdelen
    });
    
    // 🔥 STAP 5: BUILD DAYS ARRAY MET SERVICE_ID
    console.log('\n🔥 [DRAAD45.6] STAP 5: Building days array WITH serviceId mapping...');
    
    const days: DayDagdeelData[] = [];
    const startDate = parseISO(weekStartStr);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      
      // Zoek data voor deze dag
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      const dayServiceId = dayPeriod?.service_id;  // 🔥 NIEUW!
      
      // Log voor eerste dag
      if (i === 0) {
        console.log(`📅 [DRAAD45.6] Eerste dag - ${dateStr}:`, {
          dagNaam: dayName,
          gevondenInDB: !!dayPeriod,
          serviceId: dayServiceId || 'NULL',  // 🔥 LOG service_id
          aantalDagdelen: dagdelenRecords.length
        });
      }
      
      // 🔥 Groepeer per dagdeel MET serviceId
      const dagdelen = {
        ochtend: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'ochtend')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
            serviceId: dayServiceId  // 🔥 NIEUW: Voeg service_id toe!
          })),
        middag: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'middag')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
            serviceId: dayServiceId  // 🔥 NIEUW
          })),
        avond: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'avond')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
            serviceId: dayServiceId  // 🔥 NIEUW
          })),
        nacht: dagdelenRecords
          .filter(d => d.dagdeel?.toLowerCase() === 'nacht')
          .map(d => ({
            team: d.team || '',
            aantal: d.aantal || 0,
            status: d.status || 'NIET_TOEGEWEZEN',
            serviceId: dayServiceId  // 🔥 NIEUW
          })),
      };
      
      days.push({
        datum: dateStr,
        dagNaam: dayName,
        dagdelen,
      });
    }
    
    console.log(`✅ [DRAAD45.6] Days array gebouwd: ${days.length} dagen MET serviceId`);
    
    // FINAL VALIDATION
    if (days.length === 7) {
      const firstDayDate = new Date(days[0].datum + 'T00:00:00Z');
      const lastDayDate = new Date(days[6].datum + 'T00:00:00Z');
      const firstDayOfWeek = firstDayDate.getUTCDay();
      const lastDayOfWeek = lastDayDate.getUTCDay();
      
      // 🔥 Check serviceId presence
      const firstDayFirstAssignment = days[0].dagdelen.ochtend[0];
      const hasServiceId = firstDayFirstAssignment?.serviceId !== undefined;
      
      console.log('\n🔍 [DRAAD45.6] FINAL VALIDATION:', {
        aantalDagen: days.length,
        eersteDag: {
          datum: days[0].datum,
          isMaandag: firstDayOfWeek === 1 ? '✅' : '❌'
        },
        laatsteDag: {
          datum: days[6].datum,
          isZondag: lastDayOfWeek === 0 ? '✅' : '❌'
        },
        serviceIdPresent: hasServiceId ? '✅ JA' : '❌ NEE',
        sampleServiceId: firstDayFirstAssignment?.serviceId || 'NULL'
      });
    }
    
    // Build result
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDate, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(addDays(startDate, 6), 'd MMMM yyyy', { locale: nl }),
      days,
    };
    
    console.log('\n✅ [DRAAD45.6] SUCCESS - serviceId pipeline complete');
    console.log('📦 [DRAAD45.6] Result:', {
      rosterId: result.rosterId,
      weekIndex: result.weekNummer,
      daysCount: result.days.length,
      hasServiceIds: result.days[0]?.dagdelen.ochtend[0]?.serviceId ? '✅' : '❌'
    });
    console.log('═'.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('\n❌ [DRAAD45.6] EXCEPTION CAUGHT');
    console.error('Error:', error);
    console.error('Message:', error instanceof Error ? error.message : 'Unknown');
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
  console.log('🧭 [DRAAD45.6] getWeekNavigatieBounds - weekIndex systeem');
  console.log('Input:', { rosterId, currentWeekIndex: currentWeek });
  
  try {
    const bounds = {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
    
    console.log('✅ [DRAAD45.6] Week navigation bounds:', bounds);
    
    return bounds;
  } catch (error) {
    console.error('❌ [DRAAD45.6] Error in getWeekNavigatieBounds:', error);
    return {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
  }
}