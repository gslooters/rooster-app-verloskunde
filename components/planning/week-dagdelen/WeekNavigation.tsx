'use client';

import Link from 'next/link';

interface WeekNavigationProps {
  currentWeek: number;
  totalWeeks: number;
  rosterId: string;
  periodStart: string; // 🔥 DRAAD42G FIX: NIEUW - YYYY-MM-DD formaat
}

/**
 * DRAAD42G FIX - Week Navigatie Component
 * 
 * PROBLEEM:
 * - Navigatie URLs misten period_start query parameter
 * - Server page.tsx verwacht deze parameter en geeft error zonder
 * 
 * OPLOSSING:
 * - periodStart prop toegevoegd (altijd week 1 startdatum van roosterperiode)
 * - URLs bevatten nu: /planning/design/week-dagdelen/{rosterId}/{weekNummer}?period_start={periodStart}
 * - Server kan nu week data correct berekenen vanaf anchor point
 * 
 * Functionaliteit:
 * - Contextgevoelige navigatie buttons
 * - Week 1: alleen 'Volgende week'
 * - Week 2-4: 'Vorige week' + 'Volgende week'
 * - Week 5: alleen 'Vorige week'
 * - Week indicator toont intern weeknummer (1-5)
 */
export default function WeekNavigation({
  currentWeek,
  totalWeeks,
  rosterId,
  periodStart,
}: WeekNavigationProps) {
  const showPrevious = currentWeek > 1;
  const showNext = currentWeek < totalWeeks;

  /**
   * 🔥 DRAAD42G FIX: Helper functie om URL te bouwen MET period_start
   * 
   * periodStart is altijd de maandag van week 1 van de roosterperiode
   * Dit wordt gebruikt als anchor point voor alle week berekeningen
   */
  const buildWeekUrl = (weekNum: number): string => {
    return `/planning/design/week-dagdelen/${rosterId}/${weekNum}?period_start=${periodStart}`;
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex justify-center items-center gap-4">
          {showPrevious && (
            <Link href={buildWeekUrl(currentWeek - 1)}>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium">
                ← Vorige week
              </button>
            </Link>
          )}

          {/* Week indicator - toont intern weeknummer (1-5) */}
          <div className="px-6 py-2 bg-blue-50 text-blue-700 rounded-md font-semibold">
            Week {currentWeek} van {totalWeeks}
          </div>

          {showNext && (
            <Link href={buildWeekUrl(currentWeek + 1)}>
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium">
                Volgende week →
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
