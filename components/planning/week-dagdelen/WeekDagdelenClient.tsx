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
  initialWeekData: WeekDagdeelData;
  navigatieBounds: WeekNavigatieBounds;
  weekBoundary: WeekBoundary;
}

/**
 * 🔥 DRAAD63A FIX: Hertel serviceId filter - assignments per dienst
 * 
 * PROBLEEM OPGELOST:
 * - DRAAD61A verwijderde serviceId filter te rigoureus
 * - createTeamDagdelenWeek() MOET filteren op serviceId én team
 * - Zonder filter krijgt elke dienst ALLE assignments (verkeerd)
 * 
 * OPLOSSING:
 * - convertToNewStructure() maakt diensten per UNIEKE serviceId
 * - Elk dienst krijgt eigen createTeamDagdelenWeek() call MET serviceIdFilter
 * - Filter: assignment.team === team EN assignment.serviceId === dienstId
 * 
 * RESULTAAT:
 * - Frontend stuurt ECHTE service_ids naar getCelDataClient()
 * - Groen/Oranje tonen correcte waardes (1 ipv 0)
 * - Database queries matchen: WHERE service_id='OSP' → SUCCESS
 */
function convertToNewStructure(
  oldData: WeekDagdeelData,
  weekBoundary: WeekBoundary
): WeekDagdelenData {
  console.log('🔥 [DRAAD63A] START conversie - diensten per serviceId');

  const context: WeekContext = {
    rosterId: oldData.rosterId,
    weekNumber: oldData.weekNummer,
    year: oldData.jaar,
    startDate: oldData.days[0]?.datum || weekBoundary.startDatum,
    endDate: oldData.days[6]?.datum || weekBoundary.eindDatum
  };

  // 🔥 STAP 1: EXTRAHEER ALLE UNIEKE SERVICE_IDs
  const uniqueServiceIds = new Set<string>();
  const serviceIdDetails = new Map<string, { code: string; naam: string }>();
  let totalChecked = 0;
  let withServiceId = 0;
  
  oldData.days.forEach(day => {
    ['ochtend', 'middag', 'avond', 'nacht'].forEach(dagdeelType => {
      const assignments = day.dagdelen[dagdeelType as keyof typeof day.dagdelen];
      assignments?.forEach(assignment => {
        totalChecked++;
        if (assignment.serviceId) {
          uniqueServiceIds.add(assignment.serviceId);
          withServiceId++;
          
          // Bewaar dienst details voor later gebruik
          if (!serviceIdDetails.has(assignment.serviceId)) {
            serviceIdDetails.set(assignment.serviceId, {
              code: assignment.dienstCode || assignment.serviceId,
              naam: assignment.dienstNaam || getDienstNaam(assignment.serviceId)
            });
          }
        }
      });
    });
  });

  console.log('📊 [DRAAD63A] Service IDs found:', {
    unique: Array.from(uniqueServiceIds).sort(),
    count: uniqueServiceIds.size,
    coverage: `${withServiceId}/${totalChecked}`
  });

  // 🔥 STAP 2: MAAK ECHTE DIENSTEN PER SERVICE_ID
  const diensten: DienstDagdelenWeek[] = [];
  
  if (uniqueServiceIds.size === 0) {
    console.error('❌ [DRAAD63A] NO SERVICE_IDs - using fallback');
    diensten.push({
      dienstId: 'FALLBACK',
      dienstCode: 'GEEN_ID',
      dienstNaam: 'Fallback',
      volgorde: 1,
      teams: {
        groen: createTeamDagdelenWeek('GRO', oldData.days, undefined),
        oranje: createTeamDagdelenWeek('ORA', oldData.days, undefined),
        totaal: createTeamDagdelenWeek('TOT', oldData.days, undefined)
      }
    });
  } else {
    // Sorteer serviceIds alfabetisch voor consistente weergave
    const sortedServiceIds = Array.from(uniqueServiceIds).sort();
    
    sortedServiceIds.forEach((serviceId, index) => {
      const details = serviceIdDetails.get(serviceId) || {
        code: serviceId,
        naam: getDienstNaam(serviceId)
      };
      
      // ✅ DRAAD63A FIX: Geef serviceId door aan createTeamDagdelenWeek
      diensten.push({
        dienstId: serviceId,
        dienstCode: details.code,
        dienstNaam: details.naam,
        volgorde: index + 1,
        teams: {
          groen: createTeamDagdelenWeek('GRO', oldData.days, serviceId),
          oranje: createTeamDagdelenWeek('ORA', oldData.days, serviceId),
          totaal: createTeamDagdelenWeek('TOT', oldData.days, serviceId)
        }
      });
      
      console.log(`  ✓ Dienst ${index + 1}/${sortedServiceIds.length}: ${serviceId} (${details.code})`);
    });
  }

  console.log(`✅ [DRAAD63A] ${diensten.length} dienst(en) aangemaakt:`, diensten.map(d => d.dienstId).join(', '));

  return {
    context,
    diensten,
    totaalRecords: oldData.days.length * diensten.length * 3
  };
}

function getDienstNaam(serviceId: string): string {
  const map: Record<string, string> = {
    'CONS': 'Consultaties',
    'POL': 'Polikliniek',
    'ECHO': 'Echo',
    'ECH': 'Echo',
    'ZH': 'Ziekenhuis',
    'OK': 'OK',
    'SPOED': 'Spoed',
    'OSP': 'Onco Spoed',
    'DIO': 'Dienst Ochtend',
    'DIA': 'Dienst Avond'
  };
  return map[serviceId] || serviceId;
}

/**
 * 🔥 DRAAD63A FIX: Toegevoegd serviceIdFilter parameter
 * Filter assignments op ZOWEL team ALS serviceId
 * 
 * @param team - Team filter (GRO/ORA/TOT)
 * @param days - Alle dagen met dagdeel data
 * @param serviceIdFilter - NIEUWE PARAMETER: filter op specifieke dienst
 */
function createTeamDagdelenWeek(
  team: TeamDagdeel,
  days: DayDagdeelData[],
  serviceIdFilter?: string  // ✅ DRAAD63A: Optioneel voor backwards compatibility
): TeamDagdelenWeek {
  const dagen: DagDagdelen[] = days.map(day => {
    const dagdeelMap: Record<string, Dagdeel> = {
      'ochtend': 'O',
      'middag': 'M',
      'avond': 'A'
    };

    const dagdeelWaarden: Record<string, DagdeelWaarde> = {};

    ['ochtend', 'middag', 'avond'].forEach(dagdeelType => {
      const assignments = day.dagdelen[dagdeelType as keyof typeof day.dagdelen];
      
      // ✅ DRAAD63A FIX: Filter op team EN serviceId (indien opgegeven)
      const assignment = assignments?.find(a => {
        const teamMatch = a.team === team;
        const serviceIdMatch = serviceIdFilter ? a.serviceId === serviceIdFilter : true;
        return teamMatch && serviceIdMatch;
      });
      
      const dagdeel = dagdeelMap[dagdeelType];
      
      // Logging voor debugging (alleen eerste dag)
      if (day === days[0] && dagdeelType === 'ochtend') {
        console.log(`  🔍 [${serviceIdFilter || 'ALL'}] ${team} ${dagdeelType}:`, {
          found: !!assignment,
          status: assignment?.status,
          aantal: assignment?.aantal,
          serviceId: assignment?.serviceId
        });
      }
      
      dagdeelWaarden[dagdeelType] = {
        dagdeel,
        status: mapStatusToNew(assignment?.status),
        aantal: assignment?.aantal || 0,
        id: `${day.datum}-${dagdeel}-${team}`
      };
    });

    return {
      datum: day.datum,
      dagNaam: extractShortDagNaam(day.dagNaam),
      dagdeelWaarden: {
        ochtend: dagdeelWaarden['ochtend'],
        middag: dagdeelWaarden['middag'],
        avond: dagdeelWaarden['avond']
      }
    };
  });

  return { team, dagen };
}

function mapStatusToNew(oldStatus: string | undefined): DagdeelStatus {
  if (!oldStatus) return 'MAG_NIET';
  const map: Record<string, DagdeelStatus> = {
    'MOET': 'MOET',
    'MAG': 'MAG',
    'MAG_NIET': 'MAG_NIET',
    'AANGEPAST': 'AANGEPAST',
    'NIET_TOEGEWEZEN': 'MAG_NIET'
  };
  return map[oldStatus] || 'MAG_NIET';
}

function extractShortDagNaam(fullName: string): string {
  const map: Record<string, string> = {
    'Maandag': 'ma', 'Dinsdag': 'di', 'Woensdag': 'wo',
    'Donderdag': 'do', 'Vrijdag': 'vr', 'Zaterdag': 'za', 'Zondag': 'zo',
    'maandag': 'ma', 'dinsdag': 'di', 'woensdag': 'wo',
    'donderdag': 'do', 'vrijdag': 'vr', 'zaterdag': 'za', 'zondag': 'zo'
  };
  return map[fullName] || fullName.substring(0, 2).toLowerCase();
}

/**
 * 🔥 DRAAD592 FIX: Helper om leeg TeamDagdelenWeek te maken met correcte types
 */
function createEmptyTeamDagdelenWeek(
  team: TeamDagdeel,
  days: DayDagdeelData[]
): TeamDagdelenWeek {
  const dagen: DagDagdelen[] = days.map(day => {
    const dagdeelWaarden: { ochtend: DagdeelWaarde; middag: DagdeelWaarde; avond: DagdeelWaarde } = {
      ochtend: {
        dagdeel: 'O',
        status: 'MAG_NIET',
        aantal: 0,
        id: `${day.datum}-O-${team}-empty`
      },
      middag: {
        dagdeel: 'M',
        status: 'MAG_NIET',
        aantal: 0,
        id: `${day.datum}-M-${team}-empty`
      },
      avond: {
        dagdeel: 'A',
        status: 'MAG_NIET',
        aantal: 0,
        id: `${day.datum}-A-${team}-empty`
      }
    };

    return {
      datum: day.datum,
      dagNaam: extractShortDagNaam(day.dagNaam),
      dagdeelWaarden
    };
  });

  return { team, dagen };
}

export default function WeekDagdelenClient({
  rosterId,
  weekNummer,
  jaar,
  initialWeekData,
  navigatieBounds,
  weekBoundary,
}: WeekDagdelenClientProps) {
  const router = useRouter();

  const periodStart = useMemo(() => {
    const currentWeekStartDate = new Date(weekBoundary.startDatum);
    const daysToSubtract = (weekNummer - 1) * 7;
    const periodStartDate = new Date(currentWeekStartDate);
    periodStartDate.setDate(currentWeekStartDate.getDate() - daysToSubtract);
    return periodStartDate.toISOString().split('T')[0];
  }, [weekBoundary.startDatum, weekNummer]);

  const convertedWeekData = useMemo(() => {
    try {
      return convertToNewStructure(initialWeekData, weekBoundary);
    } catch (error) {
      console.error('❌ [DRAAD63A] Conversion failed:', error);
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

  const [teamFilters, setTeamFilters] = useState<TeamFilters>({
    GRO: true,
    ORA: true,
    TOT: true,
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const gefilterdeDiensten = useMemo(() => {
    return convertedWeekData.diensten.map(dienst => ({
      ...dienst,
      teams: {
        groen: teamFilters.GRO ? dienst.teams.groen : createEmptyTeamDagdelenWeek('GRO', initialWeekData.days),
        oranje: teamFilters.ORA ? dienst.teams.oranje : createEmptyTeamDagdelenWeek('ORA', initialWeekData.days),
        totaal: teamFilters.TOT ? dienst.teams.totaal : createEmptyTeamDagdelenWeek('TOT', initialWeekData.days)
      }
    }));
  }, [convertedWeekData.diensten, teamFilters, initialWeekData.days]);

  const gefilterdeWeekData: WeekDagdelenData = {
    ...convertedWeekData,
    diensten: gefilterdeDiensten
  };

  const handleToggleTeam = useCallback((team: TeamDagdeel) => {
    setTeamFilters(prev => ({ ...prev, [team]: !prev[team] }));
  }, []);

  const handleNavigateWeek = useCallback((direction: 'prev' | 'next') => {
    const targetWeek = direction === 'prev' ? weekNummer - 1 : weekNummer + 1;
    if (targetWeek < 1 || targetWeek > 5) return;
    router.push(`/planning/design/week-dagdelen/${rosterId}/${targetWeek}?period_start=${periodStart}`);
  }, [rosterId, weekNummer, periodStart, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        rosterId={rosterId}
        weekNummer={weekNummer}
        isoWeekNummer={weekBoundary.isoWeekNummer}
        jaar={jaar}
        startDatum={initialWeekData.startDatum}
        eindDatum={initialWeekData.eindDatum}
        periodStart={periodStart}
      />

      <ActionBar
        weekBoundary={weekBoundary}
        teamFilters={teamFilters}
        onToggleTeam={handleToggleTeam}
        onNavigateWeek={handleNavigateWeek}
        saveStatus={saveStatus}
      />

      <div className="container mx-auto px-6 py-0">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <Suspense fallback={<WeekTableSkeleton />}>
            <WeekDagdelenTable weekData={gefilterdeWeekData} teamFilters={teamFilters} />
          </Suspense>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold">🔥 DRAAD63A Debug</summary>
              <div className="mt-2 space-y-2">
                <div className="p-2 bg-white rounded">
                  <p className="font-semibold text-green-700">Diensten: {convertedWeekData.diensten.length}</p>
                  <p className="text-[10px]">IDs: {convertedWeekData.diensten.map(d => `${d.dienstId} (${d.dienstCode})`).join(', ')}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="font-semibold text-blue-700">ServiceId Check:</p>
                  <p className="text-[10px]">Sample: {initialWeekData.days[0]?.dagdelen.ochtend[0]?.serviceId || 'NULL'}</p>
                  <p className="text-[10px]">All: {Array.from(new Set(initialWeekData.days.flatMap(d => 
                    [...(d.dagdelen.ochtend || []), ...(d.dagdelen.middag || []), ...(d.dagdelen.avond || [])]
                      .map(a => a.serviceId)
                      .filter(Boolean)
                  ))).join(', ')}</p>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}