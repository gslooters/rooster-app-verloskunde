'use client';

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from './PageHeader';
import ActionBar, { type TeamFilters, type SaveStatus, type TeamDagdeel } from './ActionBar';
import WeekDagdelenTable from './WeekDagdelenTable';
import type { WeekDagdeelData, WeekNavigatieBounds } from '@/lib/planning/weekDagdelenData';
import type { WeekBoundary } from '@/lib/planning/weekBoundaryCalculator';

interface WeekDagdelenClientProps {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  initialWeekData: WeekDagdeelData;
  navigatieBounds: WeekNavigatieBounds;
  weekBoundary: WeekBoundary;
}

/**
 * Client wrapper component for week dagdelen view
 * Handles interactive features and state management
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
        {/* 🔥 FIX FOUT 2: Legenda VERWIJDERD volgens PLANDRAAD40.pdf specificatie
            
            REDEN: Legenda sloeg nergens op en bevatte verkeerde statussen
            TODO: Komt later terug in verbeterde vorm
            
            VERWIJDERD BLOK (was regel 115-148):
            - Status Legenda sectie met 6 verschillende statussen
            - "MOET status", "MAG status" waren niet van toepassing
            - Hele sticky div met border en shadow styling
        */}

        {/* WeekDagdelenTable - DRAAD 39.3 ✅ COMPLEET */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <Suspense fallback={<TableLoadingSkeleton weekNummer={weekNummer} />}>
            <WeekDagdelenTable 
              weekData={initialWeekData}
              teamFilters={teamFilters}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton component
 * Shows placeholder while table data loads
 */
function TableLoadingSkeleton({ weekNummer }: { weekNummer: number }) {
  return (
    <div className="p-6">
      <div className="text-center text-gray-500 mb-6">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="h-8 bg-gray-200 rounded mb-4 max-w-md mx-auto"></div>
          
          {/* Grid skeleton - 7 columns (days) x 4 rows (dagdelen) */}
          <div className="grid grid-cols-7 gap-4">
            {[...Array(28)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm">Week {weekNummer} laden...</p>
      </div>
    </div>
  );
}