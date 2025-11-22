'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface VaststellingHeaderProps {
  weekNummer: number;
  weekStart: string;
  weekEnd: string;
  periodName: string;
  rosterId: string;
  periodStart: string; // 🔥 DRAAD42G: NIEUW - voor correcte routing terug
}

/**
 * DRAAD42G - Header Component (ROUTING FIX)
 * 
 * FIX: Terug knop miste period_start parameter in URL
 * Nu: /planning/design/dagdelen-dashboard?roster_id=XXX&period_start=YYYY-MM-DD
 * 
 * Layout:
 * - Linksboven: Grote titel met weeknummer
 * - Daaronder: Datumbereik
 * - Rechtsboven: Terug naar dashboard button (MET period_start!)
 */
export default function VaststellingHeader({
  weekNummer,
  weekStart,
  weekEnd,
  periodName,
  rosterId,
  periodStart, // 🔥 DRAAD42G: NIEUW
}: VaststellingHeaderProps) {
  const formatDatum = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: nl });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-6">
        <div className="flex justify-between items-start">
          {/* Links: Titel en datumbereik */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Diensten per Dagdeel Aanpassen: Week {weekNummer}
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Van {formatDatum(weekStart)} tot en met {formatDatum(weekEnd)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {periodName}
            </p>
          </div>

          {/* Rechts: Terug button */}
          {/* 🔥 DRAAD42G FIX: Toegevoegd &period_start=${periodStart} */}
          <Link
            href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
            className="flex-shrink-0"
          >
            <button className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm">
              ← Terug naar Dashboard Dagdelen
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}