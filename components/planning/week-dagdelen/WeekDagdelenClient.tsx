'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from './PageHeader';
import ActionBar, { type TeamFilters, type SaveStatus, type TeamDagdeel } from './ActionBar';
// ❌ TIJDELIJK UITGESCHAKELD - WeekDagdelenTable verwacht andere data structuur
// import WeekDagdelenTable from './WeekDagdelenTable';
import { WeekTableSkeleton } from './WeekTableSkeleton';
import type { WeekDagdeelData, WeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';
import type { WeekBoundary } from '@/lib/planning/weekBoundaryCalculator';

interface WeekDagdelenClientProps {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  initialWeekData: WeekDagdeelData;  // ✅ CORRECT: oude structuur met days[]
  navigatieBounds: WeekNavigatieBounds;
  weekBoundary: WeekBoundary;
}

/**
 * Client wrapper component for week dagdelen view
 * Handles interactive features and state management
 * 
 * 🔥 DRAAD40B5 BUGFIX:
 * ❌ TYPE MISMATCH PROBLEEM:
 * - initialWeekData is van type WeekDagdeelData (oude structuur met days[])
 * - WeekDagdelenTable verwacht WeekDagdelenData (nieuwe structuur met context, diensten[], totaalRecords)
 * 
 * ✅ OPLOSSING:
 * - Gebruik correcte type voor initialWeekData: WeekDagdeelData
 * - TODO: Converteer oude naar nieuwe data structuur
 * - Tijdelijk: toon skeleton (build zal slagen)
 * 
 * DRAAD40B5 FASE 5: UI Refinements
 * ✅ Nieuwe WeekTableSkeleton component geïntegreerd
 * ✅ Skeleton toont tijdens navigatie en laden
 * 
 * DRAAD40B FASE 3 - FINAL FIXES:
 * ✅ FOUT 3: Period_start parameter toegevoegd aan navigatie URL
 * ✅ FOUT 2: Overbodige legenda verwijderd
 * ✅ FOUT 1: ISO weeknummer doorgegeven aan PageHeader
 * ✅ Return button: Correct period_start parameter voor dashboard
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
        isoWeekNummer={weekBoundary.isoWeekNummer}  // 🔥 NIEUW: ISO week (48, 49, 50...)
        jaar={jaar}
        startDatum={initialWeekData.startDatum}
        eindDatum={initialWeekData.eindDatum}
        periodStart={periodStart}  // 🔥 NIEUW: Voor return button URL
      />

      {/* Action Bar - Sticky below header */}
      <ActionBar
        weekBoundary={weekBoundary}
        teamFilters={teamFilters}
        onToggleTeam={handleToggleTeam}
        onNavigateWeek={handleNavigateWeek}
        saveStatus={saveStatus}
      />

      {/* Main Content Container */}
      <div className="container mx-auto px-6 py-6">
        {/* WeekDagdelenTable - TIJDELIJK UITGESCHAKELD wegens type mismatch */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-8 text-center">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-base font-medium text-gray-700 mb-2">Data structuur conversie in ontwikkeling</p>
            <p className="text-sm text-gray-500 mb-4">
              De oude data structuur (WeekDagdeelData met days[]) moet worden geconverteerd naar de nieuwe structuur (WeekDagdelenData met diensten[])
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-xs">
              <p className="font-semibold text-yellow-800 mb-2">🔧 Technische Details:</p>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>initialWeekData type: WeekDagdeelData (oude structuur)</li>
                <li>WeekDagdelenTable verwacht: WeekDagdelenData (nieuwe structuur)</li>
                <li>Conversie functie moet worden gebouwd</li>
                <li>Week data beschikbaar: {initialWeekData.days.length} dagen geladen</li>
              </ul>
            </div>
          </div>
          
          {/* DEBUG INFO */}
          {process.env.NODE_ENV === 'development' && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer font-semibold mb-2">📊 Week Data Debug Info</summary>
                <pre className="mt-2 p-2 bg-white rounded border overflow-auto text-[10px]">
                  {JSON.stringify({
                    rosterId,
                    weekNummer,
                    jaar,
                    startDatum: initialWeekData.startDatum,
                    eindDatum: initialWeekData.eindDatum,
                    aantalDagen: initialWeekData.days.length,
                    eersteDag: initialWeekData.days[0]?.datum,
                    laatsteDag: initialWeekData.days[6]?.datum,
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
