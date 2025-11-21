'use client';

import Link from 'next/link';

interface WeekNavigationProps {
  currentWeek: number;
  totalWeeks: number;
  rosterId: string;
}

/**
 * DRAAD42 - Week Navigatie Component
 * 
 * Functionaliteit:
 * - Contextgevoelige navigatie buttons
 * - Week 1: alleen 'Volgende week'
 * - Week 2-4: 'Vorige week' + 'Volgende week'
 * - Week 5: alleen 'Vorige week'
 */
export default function WeekNavigation({
  currentWeek,
  totalWeeks,
  rosterId,
}: WeekNavigationProps) {
  const showPrevious = currentWeek > 1;
  const showNext = currentWeek < totalWeeks;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex justify-center items-center gap-4">
          {showPrevious && (
            <Link
              href={`/planning/design/week-dagdelen/${rosterId}/${currentWeek - 1}`}
            >
              <button className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium">
                ← Vorige week
              </button>
            </Link>
          )}

          {/* Week indicator */}
          <div className="px-6 py-2 bg-blue-50 text-blue-700 rounded-md font-semibold">
            Week {currentWeek} van {totalWeeks}
          </div>

          {showNext && (
            <Link
              href={`/planning/design/week-dagdelen/${rosterId}/${currentWeek + 1}`}
            >
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
