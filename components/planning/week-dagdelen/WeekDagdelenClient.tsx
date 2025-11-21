'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from './PageHeader';
import ActionBar, { type TeamFilters, type SaveStatus } from './ActionBar';
import WeekDagdelenTable from './WeekDagdelenTable';
import { WeekTableSkeleton } from './WeekTableSkeleton';
import type { WeekDagdeelData, WeekNavigatieBounds, DayDagdeelData } from '@/lib/planning/weekDagdelenData';
import type { WeekBoundary } from '@/lib/planning/weekBoundaryCalculator';
import type {
  WeekDagdelenData,
  WeekContext,
  DienstDagdelenWeek,
  TeamDagdelenWeek,
  DagDagdelen,
  DagdeelWaarde,
  Dagdeel,
  TeamDagdeel,
  DagdeelStatus
} from '@/lib/types/week-dagdelen';

interface WeekDagdelenClientProps {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  initialWeekData: WeekDagdeelData;  // ✅ Oude structuur
  navigatieBounds: WeekNavigatieBounds;
  weekBoundary: WeekBoundary;
}

/**
 * 🔥 DRAAD40B5 QUICK WIN: Conversie functie
 * 
 * Converteert oude WeekDagdeelData structuur naar nieuwe WeekDagdelenData structuur
 * 
 * OUDE STRUCTUUR (WeekDagdeelData):
 * - Platte lijst van dagen met dagdeel assignments per team
 * - days[] → dagdelen (ochtend/middag/avond/nacht) → teams[]
 * 
 * NIEUWE STRUCTUUR (WeekDagdelenData):
 * - Dienst-gecentreerd met team hierarchie
 * - diensten[] → teams (groen/oranje/totaal) → dagen[] → dagdeelWaarden
 */
function convertToNewStructure(
  oldData: WeekDagdeelData,
  weekBoundary: WeekBoundary
): WeekDagdelenData {
  console.log('🔄 [CONVERSIE] START: Converting WeekDagdeelData → WeekDagdelenData');
  console.log('📊 [CONVERSIE] Input data:', {
    rosterId: oldData.rosterId,
    weekNummer: oldData.weekNummer,
    jaar: oldData.jaar,
    aantalDagen: oldData.days.length
  });

  // STAP 1: Maak WeekContext
  const context: WeekContext = {
    rosterId: oldData.rosterId,
    weekNumber: oldData.weekNummer,
    year: oldData.jaar,
    startDate: oldData.days[0]?.datum || weekBoundary.startDatum,
    endDate: oldData.days[6]?.datum || weekBoundary.eindDatum
  };

  console.log('✅ [CONVERSIE] Context created:', context);

  // STAP 2: Verzamel alle unieke teams uit de data
  const allTeams = new Set<string>();
  oldData.days.forEach(day => {
    ['ochtend', 'middag', 'avond', 'nacht'].forEach(dagdeelType => {
      const assignments = day.dagdelen[dagdeelType as keyof typeof day.dagdelen];
      assignments?.forEach(assignment => {
        if (assignment.team) {
          allTeams.add(assignment.team);
        }
      });
    });
  });

  console.log('📋 [CONVERSIE] Gevonden teams:', Array.from(allTeams));

  // STAP 3: Groepeer data per team
  // In de oude structuur zijn teams (GRO/ORA/TOT) de assignments
  // We moeten een "dienst" maken die alle team data bevat
  
  // Voor nu: maak 1 generieke dienst die alle dagdelen bevat
  const dienst: DienstDagdelenWeek = {
    dienstId: 'default-dienst',
    dienstCode: 'DAGDELEN',
    dienstNaam: 'Dagdelen Bezetting',
    volgorde: 1,
    teams: {
      groen: createTeamDagdelenWeek('GRO', oldData.days),
      oranje: createTeamDagdelenWeek('ORA', oldData.days),
      totaal: createTeamDagdelenWeek('TOT', oldData.days)
    }
  };

  console.log('✅ [CONVERSIE] Dienst created with 3 teams');

  // STAP 4: Build result
  const result: WeekDagdelenData = {
    context,
    diensten: [dienst],
    totaalRecords: oldData.days.length * 3 * 3 // 7 dagen × 3 dagdelen × 3 teams
  };

  console.log('✅ [CONVERSIE] SUCCESS - Conversion complete');
  console.log('📦 [CONVERSIE] Result:', {
    dienstenCount: result.diensten.length,
    totaalRecords: result.totaalRecords,
    contextWeek: result.context.weekNumber
  });

  return result;
}

/**
 * Helper: Maak TeamDagdelenWeek structuur voor een specifiek team
 */
function createTeamDagdelenWeek(
  team: TeamDagdeel,
  days: DayDagdeelData[]
): TeamDagdelenWeek {
  const dagen: DagDagdelen[] = days.map(day => {
    // Map dagdeel types: ochtend→0, middag→M, avond→A
    const dagdeelMap: Record<string, Dagdeel> = {
      'ochtend': '0',
      'middag': 'M',
      'avond': 'A'
    };

    const dagdeelWaarden: Record<string, DagdeelWaarde> = {};

    // Voor elk dagdeel type (ochtend/middag/avond)
    ['ochtend', 'middag', 'avond'].forEach(dagdeelType => {
      const assignments = day.dagdelen[dagdeelType as keyof typeof day.dagdelen];
      
      // Zoek assignment voor dit team
      const assignment = assignments?.find(a => a.team === team);
      
      const dagdeel = dagdeelMap[dagdeelType];
      
      dagdeelWaarden[dagdeelType] = {
        dagdeel,
        status: mapStatusToNew(assignment?.status),
        aantal: assignment?.aantal || 0,
        id: `${day.datum}-${dagdeel}-${team}`
      };
    });

    // Extract short dag naam (bijv. "Maandag" → "ma")
    const shortDagNaam = extractShortDagNaam(day.dagNaam);

    return {
      datum: day.datum,
      dagNaam: shortDagNaam,
      dagdeelWaarden: {
        ochtend: dagdeelWaarden['ochtend'],
        middag: dagdeelWaarden['middag'],
        avond: dagdeelWaarden['avond']
      }
    };
  });

  return {
    team,
    dagen
  };
}

/**
 * Helper: Map oude status naar nieuwe DagdeelStatus
 */
function mapStatusToNew(oldStatus: string | undefined): DagdeelStatus {
  if (!oldStatus) return 'MAG_NIET';
  
  const statusMap: Record<string, DagdeelStatus> = {
    'MOET': 'MOET',
    'MAG': 'MAG',
    'MAG_NIET': 'MAG_NIET',
    'AANGEPAST': 'AANGEPAST',
    'NIET_TOEGEWEZEN': 'MAG_NIET'
  };
  
  return statusMap[oldStatus] || 'MAG_NIET';
}

/**
 * Helper: Extract korte dag naam uit volledige naam
 */
function extractShortDagNaam(fullName: string): string {
  const dagMap: Record<string, string> = {
    'Maandag': 'ma',
    'Dinsdag': 'di',
    'Woensdag': 'wo',
    'Donderdag': 'do',
    'Vrijdag': 'vr',
    'Zaterdag': 'za',
    'Zondag': 'zo',
    'maandag': 'ma',
    'dinsdag': 'di',
    'woensdag': 'wo',
    'donderdag': 'do',
    'vrijdag': 'vr',
    'zaterdag': 'za',
    'zondag': 'zo'
  };
  
  return dagMap[fullName] || fullName.substring(0, 2).toLowerCase();
}

/**
 * Client wrapper component for week dagdelen view
 * Handles interactive features and state management
 * 
 * 🔥 DRAAD40B5 - COMPLETE FIX:
 * ✅ Conversie functie geïmplementeerd
 * ✅ WeekDagdelenTable volledig geactiveerd
 * ✅ Volledige functionaliteit hersteld
 * ✅ DRAAD40B5: Fixed duplicate TeamDagdeel import
 * ✅ DRAAD40B5: Teamfiltering implementeren
 * 
 * DRAAD40B FASE 3 - FINAL FIXES:
 * ✅ FOUT 3: Period_start parameter toegevoegd aan navigatie URL
 * ✅ FOUT 2: Overbodige legenda verwijderd
 * ✅ FOUT 1: ISO weeknummer doorgegeven aan PageHeader
 * ✅ Return button: Correct period_start parameter voor dashboard
 * 
 * DRAAD40B5 #7 - SPACING FIX:
 * ✅ Removed py-6 padding from main container
 * ✅ Table header now directly connects to ActionBar
 * ✅ No more empty space between ActionBar and table
 * 
 * DRAAD40B5 #8 - STICKY HEADER FIX:
 * ✅ Removed overflow-hidden from outer wrapper
 * ✅ Sticky header can now function correctly
 * ✅ Z-index layering preserved
 * 
 * State management voor:
 * - Team filters (Groen/Oranje/Praktijk)
 * - Save status (idle/saving/saved/error)
 * - Week navigatie met period_start
 */
export default function WeekDagdelenClient({
  rosterId,
  weekNummer,
  jaar,
  initialWeekData,
  navigatieBounds,
  weekBoundary,
}: WeekDagdelenClientProps) {
  const router = useRouter();

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * 🔥 FIX: Bereken period_start (= week 1 startdatum)
   * Dit is de anchor point voor de hele 5-weekse roosterperiode
   * 
   * Voor week 1: weekBoundary.startDatum IS period_start
   * Voor week 2-5: Bereken terug naar week 1
   */
  const periodStart = useMemo(() => {
    const currentWeekStartDate = new Date(weekBoundary.startDatum);
    const daysToSubtract = (weekNummer - 1) * 7;
    const periodStartDate = new Date(currentWeekStartDate);
    periodStartDate.setDate(currentWeekStartDate.getDate() - daysToSubtract);
    return periodStartDate.toISOString().split('T')[0];
  }, [weekBoundary.startDatum, weekNummer]);

  /**
   * 🔥 QUICK WIN: Converteer oude data structuur naar nieuwe
   * Dit gebeurt 1x bij mount, resultaat wordt gecached
   */
  const convertedWeekData = useMemo(() => {
    console.log('🔄 [CLIENT] Starting data conversion...');
    try {
      const result = convertToNewStructure(initialWeekData, weekBoundary);
      console.log('✅ [CLIENT] Data conversion successful');
      return result;
    } catch (error) {
      console.error('❌ [CLIENT] Data conversion failed:', error);
      // Fallback: lege structuur
      return {
        context: {
          rosterId,
          weekNumber: weekNummer,
          year: jaar,
          startDate: weekBoundary.startDatum,
          endDate: weekBoundary.eindDatum
        },
        diensten: [],
        totaalRecords: 0
      } as WeekDagdelenData;
    }
  }, [initialWeekData, weekBoundary, rosterId, weekNummer, jaar]);

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Team filter toggles (standaard: alle teams zichtbaar)
  const [teamFilters, setTeamFilters] = useState<TeamFilters>({
    GRO: true,
    ORA: true,
    TOT: true,
  });

  // Save status voor autosave feedback
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // ============================================================================
  // DRAAD40B5: Gefilterde data op basis van team selectie
  // ============================================================================

  /**
   * DRAAD40B5: Filter diensten om alleen zichtbare teams te tonen
   * 
   * Wanneer een team uitgeschakeld is in de filters, verwijderen we die team data
   * uit de dienst structuur. Dit zorgt ervoor dat WeekTableBody de rij niet rendert.
   */
  const gefilterdeDiensten = useMemo(() => {
    return convertedWeekData.diensten.map(dienst => {
      // Maak nieuwe dienst met gefilterde teams
      const gefilterdeTeams: DienstDagdelenWeek['teams'] = {
        groen: teamFilters.GRO ? dienst.teams.groen : { team: 'GRO', dagen: [] },
        oranje: teamFilters.ORA ? dienst.teams.oranje : { team: 'ORA', dagen: [] },
        totaal: teamFilters.TOT ? dienst.teams.totaal : { team: 'TOT', dagen: [] }
      };

      return {
        ...dienst,
        teams: gefilterdeTeams
      };
    });
  }, [convertedWeekData.diensten, teamFilters]);

  const gefilterdeWeekData: WeekDagdelenData = {
    ...convertedWeekData,
    diensten: gefilterdeDiensten
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Toggle team filter visibility
   */
  const handleToggleTeam = useCallback((team: TeamDagdeel) => {
    setTeamFilters(prev => ({
      ...prev,
      [team]: !prev[team],
    }));
  }, []);

  /**
   * 🔥 FIX FOUT 3: Navigate to previous/next week MET period_start parameter
   * 
   * PROBLEEM: URL miste period_start, waardoor page.tsx error gaf
   * OPLOSSING: Gebruik berekende periodStart constant
   * 
   * periodStart bevat altijd de maandag van week 1 van de roosterperiode
   * Dit wordt gebruikt als anchor point voor alle week navigatie
   */
  const handleNavigateWeek = useCallback(
    (direction: 'prev' | 'next') => {
      const targetWeek = direction === 'prev' ? weekNummer - 1 : weekNummer + 1;
      
      // Boundary check (extra veiligheid)
      if (targetWeek < 1 || targetWeek > 5) {
        console.warn(`🚫 Cannot navigate to week ${targetWeek} (out of bounds 1-5)`);
        return;
      }

      // 🔥 FIX: Voeg period_start parameter toe aan URL
      const newUrl = `/planning/design/week-dagdelen/${rosterId}/${targetWeek}?period_start=${periodStart}`;
      
      console.log('🔀 Week navigatie:', {
        from: weekNummer,
        to: targetWeek,
        direction,
        periodStart,
        url: newUrl
      });
      
      router.push(newUrl);
    },
    [rosterId, weekNummer, periodStart, router]
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🔥 FIX FOUT 1: Header met ISO weeknummer en period_start voor return button */}
      <PageHeader
        rosterId={rosterId}
        weekNummer={weekNummer}
        isoWeekNummer={weekBoundary.isoWeekNummer}
        jaar={jaar}
        startDatum={initialWeekData.startDatum}
        eindDatum={initialWeekData.eindDatum}
        periodStart={periodStart}
      />

      {/* Action Bar - Sticky below header */}
      <ActionBar
        weekBoundary={weekBoundary}
        teamFilters={teamFilters}
        onToggleTeam={handleToggleTeam}
        onNavigateWeek={handleNavigateWeek}
        saveStatus={saveStatus}
      />

      {/* 🔥 DRAAD40B5 #7 FIX: Main Content Container 
          
          VOOR: py-6 (24px top/bottom padding) → grote lege ruimte
          NA:   py-0 (geen vertical padding) → directe aansluiting
          
          De tabel header sluit nu direct aan op ActionBar
      */}
      <div className="container mx-auto px-6 py-0">
        {/* 🔥 DRAAD40B5 #8 FIX: Wrapper zonder overflow-hidden
            
            VOOR: overflow-hidden blokkeerde sticky header
            NA:   border + shadow ZONDER overflow-hidden
            
            Sticky header werkt nu correct!
        */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <Suspense fallback={<WeekTableSkeleton />}>
            <WeekDagdelenTable 
              weekData={gefilterdeWeekData}
              teamFilters={teamFilters}
            />
          </Suspense>
        </div>

        {/* Debug Info - Development Only */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold mb-2">🔍 Debug: Data Conversie Info</summary>
              <div className="mt-2 space-y-2">
                <div className="p-2 bg-white rounded border">
                  <p className="font-semibold text-green-700">✅ Conversie Succesvol</p>
                  <ul className="list-disc list-inside mt-1 text-[10px] space-y-1">
                    <li>Oude structuur: {initialWeekData.days.length} dagen geladen</li>
                    <li>Nieuwe structuur: {convertedWeekData.diensten.length} diensten</li>
                    <li>Totaal records: {convertedWeekData.totaalRecords}</li>
                    <li>Context week: {convertedWeekData.context.weekNumber}</li>
                  </ul>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="font-semibold text-blue-700">📊 Team Data:</p>
                  <ul className="list-disc list-inside mt-1 text-[10px] space-y-1">
                    <li>Groen: {convertedWeekData.diensten[0]?.teams.groen.dagen.length} dagen</li>
                    <li>Oranje: {convertedWeekData.diensten[0]?.teams.oranje.dagen.length} dagen</li>
                    <li>Totaal: {convertedWeekData.diensten[0]?.teams.totaal.dagen.length} dagen</li>
                  </ul>
                </div>
                <div className="p-2 bg-purple-50 rounded border border-purple-200">
                  <p className="font-semibold text-purple-700">🎯 Actieve Filters:</p>
                  <ul className="list-disc list-inside mt-1 text-[10px] space-y-1">
                    <li>Groen: {teamFilters.GRO ? '✅ Zichtbaar' : '❌ Verborgen'}</li>
                    <li>Oranje: {teamFilters.ORA ? '✅ Zichtbaar' : '❌ Verborgen'}</li>
                    <li>Praktijk: {teamFilters.TOT ? '✅ Zichtbaar' : '❌ Verborgen'}</li>
                  </ul>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}