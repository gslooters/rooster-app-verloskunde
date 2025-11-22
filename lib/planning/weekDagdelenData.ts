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
 * 🔥 DRAAD1A FINAL FIX - API Layer Validatie
 * 
 * PROBLEEM: Database query retourneerde soms 8 dagen (zo-zo) i.p.v. 7 (ma-zo)
 * OORZAAK: Zondag vóór de maandag werd meegenomen in het datumbereik
 * 
 * OPLOSSING:
 * 1. Valideer dat weekStartStr (uit weekBoundaryCalculator) een MAANDAG is
 * 2. Filter database resultaten om zondag als eerste dag te verwijderen
 * 3. Forceer exact 7 dagen output (ma-zo)
 * 4. Uitgebreide logging voor debugging
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
  console.log(`🔍 [DRAAD1A] START Week ${weekNummer} - Zondag Start Bug Fix`);
  console.log('═'.repeat(60));
  
  try {
    const supabase = getSupabaseServer();
    
    // 🔥 STAP 1: Haal week boundaries op via weekBoundaryCalculator
    console.log('\n🔄 [DRAAD1A] STAP 1: Fetching week boundary...');
    console.log('Input:', { rosterId, weekNummer, periodStart });
    
    const weekBoundary = await getWeekBoundary(rosterId, weekNummer, periodStart);
    
    console.log('✅ [DRAAD1A] Week boundary opgehaald:', weekBoundary);
    
    const weekStartStr = weekBoundary.startDatum;
    const weekEndStr = weekBoundary.eindDatum;
    
    // 🔥 DRAAD1A VALIDATIE: Week MOET starten op maandag
    const weekStartDate = new Date(weekStartStr + 'T00:00:00Z');
    const weekStartDayOfWeek = weekStartDate.getUTCDay();
    
    console.log('\n🔍 [DRAAD1A] VALIDATIE: Checking week start day...');
    console.log('📅 Week Start:', {
      datum: weekStartStr,
      dagVanWeek: weekStartDayOfWeek,
      isDagVanWeek: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][weekStartDayOfWeek],
      isMaandag: weekStartDayOfWeek === 1 ? '✅' : '❌'
    });
    
    if (weekStartDayOfWeek !== 1) {
      console.error('❌ [DRAAD1A] KRITIEKE FOUT: Week start is GEEN maandag!');
      console.error('⚠️  Dit zou NIET mogen gebeuren met correcte weekBoundaryCalculator');
      console.error('⚠️  Mogelijk probleem in calculateWeekDates() in page.tsx');
      // We gaan NIET stoppen, maar wel loggen voor debugging
    } else {
      console.log('✅ [DRAAD1A] Week start is correct (maandag)');
    }
    
    console.log('📅 [DRAAD1A] Week periode:', {
      weekIndex: weekNummer,
      start: weekStartStr,
      end: weekEndStr,
      label: weekBoundary.weekLabel
    });
    
    // STAP 2: Haal roster op (voor validatie)
    console.log('\n🔄 [DRAAD1A] STAP 2: Fetching roster...');
    
    const { data: roster, error: rosterError } = await supabase
      .from('roosters')
      .select('id, start_date, end_date')
      .eq('id', rosterId)
      .single();
    
    if (rosterError || !roster) {
      console.error('❌ [DRAAD1A] STOP POINT 1: Roster niet gevonden');
      console.error('Error:', rosterError);
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DRAAD1A] Roster gevonden:', {
      id: roster.id,
      start_date: roster.start_date,
      end_date: roster.end_date
    });
    
    // STAP 3: Check datum overlap (STRING COMPARISON - geen timezone issues)
    console.log('\n🔄 [DRAAD1A] STAP 3: Checking datum overlap...');
    
    const rosterStartStr = roster.start_date;
    const rosterEndStr = roster.end_date;
    
    const weekStartsAfterRosterEnds = weekStartStr > rosterEndStr;
    const weekEndsBeforeRosterStarts = weekEndStr < rosterStartStr;
    const hasNoOverlap = weekStartsAfterRosterEnds || weekEndsBeforeRosterStarts;
    
    console.log('📊 [DRAAD1A] Overlap analyse:', {
      weekPeriod: `${weekStartStr} t/m ${weekEndStr}`,
      rosterPeriod: `${rosterStartStr} t/m ${rosterEndStr}`,
      weekStartsAfterRosterEnds,
      weekEndsBeforeRosterStarts,
      hasNoOverlap,
      hasOverlap: !hasNoOverlap
    });
    
    if (hasNoOverlap) {
      console.error('❌ [DRAAD1A] STOP POINT 2: Week valt volledig buiten rooster');
      console.error('⚠️ Dit zou NIET moeten gebeuren met correcte period_start!');
      console.log('═'.repeat(60));
      return null;
    }
    
    console.log('✅ [DRAAD1A] Week heeft overlap met roster - proceeding');
    
    // STAP 4: Haal period data op
    console.log('\n🔄 [DRAAD1A] STAP 4: Fetching period data...');
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
      console.error('❌ [DRAAD1A] STOP POINT 3: Supabase query error');
      console.error('Error:', periodError);
      console.log('═'.repeat(60));
      return null;
    }
    
    const recordCount = periodData?.length || 0;
    console.log(`✅ [DRAAD1A] Query succesvol. Records: ${recordCount}`);
    
    // 🔥 DRAAD1A FIX: Valideer en filter database resultaten
    console.log('\n🔥 [DRAAD1A] STAP 4B: DATABASE RESULT VALIDATION & FILTERING');
    
    if (periodData && periodData.length > 0) {
      // Check eerste datum in database resultaat
      const firstDbDate = periodData[0].date;
      const firstDbDateObj = new Date(firstDbDate + 'T00:00:00Z');
      const firstDbDayOfWeek = firstDbDateObj.getUTCDay();
      
      console.log('📅 [DRAAD1A] Eerste datum in DB resultaat:', {
        datum: firstDbDate,
        dagVanWeek: firstDbDayOfWeek,
        dagNaam: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][firstDbDayOfWeek],
        isMaandag: firstDbDayOfWeek === 1,
        isZondag: firstDbDayOfWeek === 0
      });
      
      // 🔥 FIX: Als eerste dag een ZONDAG is, filter die eruit!
      if (firstDbDayOfWeek === 0) {
        console.warn('⚠️  [DRAAD1A] ZONDAG GEDETECTEERD ALS EERSTE DAG - FILTERING!');
        console.warn(`⚠️  Zondag ${firstDbDate} wordt verwijderd uit resultaat`);
        
        // Filter: verwijder de zondag
        const filteredData = periodData.filter(record => record.date !== firstDbDate);
        
        console.log('✅ [DRAAD1A] Zondag gefilterd:', {
          voorFiltering: periodData.length,
          naFiltering: filteredData.length,
          verwijderd: periodData.length - filteredData.length
        });
        
        // Overschrijf periodData met gefilterde data
        periodData.splice(0, periodData.length, ...filteredData);
      } else if (firstDbDayOfWeek === 1) {
        console.log('✅ [DRAAD1A] Eerste dag is correct (maandag) - geen filtering nodig');
      } else {
        console.warn(`⚠️  [DRAAD1A] ONVERWACHTE EERSTE DAG: ${['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][firstDbDayOfWeek]}`);
        console.warn('⚠️  Dit zou niet mogen gebeuren - mogelijk database inconsistentie');
      }
    }
    
    // 🔥 DRAAD1A FIX: Limiteer tot EXACT 7 dagen
    if (periodData && periodData.length > 7) {
      console.warn(`⚠️  [DRAAD1A] TE VEEL DAGEN: ${periodData.length} records`);
      console.warn('⚠️  Limiet tot eerste 7 dagen');
      periodData.splice(7); // Verwijder alles na index 6
      console.log(`✅ [DRAAD1A] Gelimiteerd tot ${periodData.length} dagen`);
    }
    
    if (recordCount === 0) {
      console.warn('⚠️  [DRAAD1A] Geen period data gevonden (dit is OK voor lege week)');
    }
    
    // STAP 5: Analyseer dagdelen data
    console.log('\n🔄 [DRAAD1A] STAP 5: Analyzing dagdelen...');
    
    const totalDagdelen = periodData?.reduce((sum, p) => 
      sum + (p.roster_period_staffing_dagdelen?.length || 0), 0) || 0;
    
    console.log('📊 [DRAAD1A] Dagdelen summary:', {
      totalParentRecords: periodData?.length || 0,
      totalDagdelenRecords: totalDagdelen,
      avgPerParent: (periodData?.length || 0) > 0 ? (totalDagdelen / (periodData?.length || 1)).toFixed(1) : '0'
    });
    
    // STAP 6: Build days array
    console.log('\n🔄 [DRAAD1A] STAP 6: Building days array...');
    
    const days: DayDagdeelData[] = [];
    const startDate = parseISO(weekStartStr);
    
    console.log('📅 [DRAAD1A] Genereer 7 dagen vanaf:', weekStartStr);
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE', { locale: nl });
      const dayOfWeek = currentDate.getUTCDay();
      
      // Zoek data voor deze dag
      const dayPeriod = periodData?.find(p => p.date === dateStr);
      const dagdelenRecords = dayPeriod?.roster_period_staffing_dagdelen || [];
      
      // Log eerste en laatste dag voor verificatie
      if (i === 0 || i === 6) {
        console.log(`📅 [DRAAD1A] Dag ${i} (${i === 0 ? 'EERSTE' : 'LAATSTE'}) - ${dateStr}:`, {
          dagNaam: dayName,
          dagVanWeek: dayOfWeek,
          dagVanWeekNaam: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'][dayOfWeek],
          verwachtDag: i === 0 ? 'Maandag (1)' : 'Zondag (0)',
          correct: i === 0 ? (dayOfWeek === 1 ? '✅' : '❌') : (dayOfWeek === 0 ? '✅' : '❌'),
          gevondenInDB: !!dayPeriod,
          aantalDagdelen: dagdelenRecords.length
        });
      }
      
      // Groepeer per dagdeel
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
    
    console.log(`✅ [DRAAD1A] Days array gebouwd: ${days.length} dagen`);
    
    // 🔥 DRAAD1A FINAL VALIDATION
    console.log('\n🔍 [DRAAD1A] FINAL VALIDATION - Days Array Check:');
    if (days.length === 7) {
      const firstDayDate = new Date(days[0].datum + 'T00:00:00Z');
      const lastDayDate = new Date(days[6].datum + 'T00:00:00Z');
      const firstDayOfWeek = firstDayDate.getUTCDay();
      const lastDayOfWeek = lastDayDate.getUTCDay();
      
      console.log('✅ [DRAAD1A] Days array structuur:', {
        aantalDagen: days.length,
        eersteDag: {
          datum: days[0].datum,
          dagNaam: days[0].dagNaam,
          dayOfWeek: firstDayOfWeek,
          isMaandag: firstDayOfWeek === 1 ? '✅' : '❌'
        },
        laatsteDag: {
          datum: days[6].datum,
          dagNaam: days[6].dagNaam,
          dayOfWeek: lastDayOfWeek,
          isZondag: lastDayOfWeek === 0 ? '✅' : '❌'
        },
        validatie: (firstDayOfWeek === 1 && lastDayOfWeek === 0) ? '✅ CORRECT (ma-zo)' : '❌ FOUT'
      });
      
      if (firstDayOfWeek !== 1) {
        console.error('❌ [DRAAD1A] KRITIEKE FOUT: Eerste dag is GEEN maandag!');
        console.error('Dit zou niet mogen gebeuren na alle fixes!');
      }
      if (lastDayOfWeek !== 0) {
        console.error('❌ [DRAAD1A] KRITIEKE FOUT: Laatste dag is GEEN zondag!');
        console.error('Dit zou niet mogen gebeuren na alle fixes!');
      }
    } else {
      console.error(`❌ [DRAAD1A] FOUT: Days array heeft ${days.length} dagen (verwacht: 7)`);
    }
    
    // STAP 7: Build result object
    const result = {
      rosterId,
      weekNummer,
      jaar,
      startDatum: format(startDate, 'd MMMM yyyy', { locale: nl }),
      eindDatum: format(addDays(startDate, 6), 'd MMMM yyyy', { locale: nl }),
      days,
    };
    
    console.log('\n✅ [DRAAD1A] SUCCESS - Returning validated data');
    console.log('📦 [DRAAD1A] Result:', {
      rosterId: result.rosterId,
      weekIndex: result.weekNummer,
      period: `${result.startDatum} - ${result.eindDatum}`,
      daysCount: result.days.length
    });
    console.log('═'.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('\n❌ [DRAAD1A] EXCEPTION CAUGHT');
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
  console.log('🧭 [DRAAD1A] getWeekNavigatieBounds - weekIndex systeem');
  console.log('Input:', { rosterId, currentWeekIndex: currentWeek });
  
  try {
    const bounds = {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
    
    console.log('✅ [DRAAD1A] Week navigation bounds:', bounds);
    
    return bounds;
  } catch (error) {
    console.error('❌ [DRAAD1A] Error in getWeekNavigatieBounds:', error);
    return {
      minWeek: 1,
      maxWeek: 5,
      currentWeek,
      hasPrevious: currentWeek > 1,
      hasNext: currentWeek < 5,
    };
  }
}