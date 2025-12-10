'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useState } from 'react';
import { PlanInformatieModal } from '@/app/planning/design/componenten/PlanInformatieModal';

interface VaststellingHeaderProps {
  weekNummer: number;
  weekStart: string;
  weekEnd: string;
  periodName: string;
  rosterId: string;
  periodStart: string; // 🔥 DRAAD42G: NIEUW - voor correcte routing terug
}

/**
 * DRAAD42G + DRAAD159 - Header Component (ROUTING FIX + PLANINFORMATIE BUTTON)
 * 
 * FIX #1 (DRAAD42G): Terug knop miste period_start parameter in URL
 * Nu: /planning/design/dagdelen-dashboard?roster_id=XXX&period_start=YYYY-MM-DD
 * 
 * FIX #2 (DRAAD159): Added Planinformatie button (rechts boven, links van terug knop)
 * - Opens PlanInformatieModal met vraag/aanbod overzicht
 * - Dezelfde knop als in "Diensten Toewijzing AANPASSEN" scherm
 * 
 * Layout:
 * - Linksboven: Grote titel met weeknummer
 * - Daaronder: Datumbereik
 * - Rechtsboven: Planinformatie button + Terug naar dashboard button
 */
export default function VaststellingHeader({
  weekNummer,
  weekStart,
  weekEnd,
  periodName,
  rosterId,
  periodStart, // 🔥 DRAAD42G: NIEUW
}: VaststellingHeaderProps) {
  const [isPlanInformatieOpen, setIsPlanInformatieOpen] = useState(false);

  const formatDatum = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: nl });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* DRAAD159: Modal component */}
      <PlanInformatieModal 
        isOpen={isPlanInformatieOpen} 
        onClose={() => setIsPlanInformatieOpen(false)}
        rosterId={rosterId}
      />

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

            {/* Rechts: Knoppengroep */}
            <div className="flex gap-2 flex-shrink-0">
              {/* DRAAD159: Planinformatie button */}
              <button
                onClick={() => setIsPlanInformatieOpen(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                📊 Planinformatie
              </button>
              
              {/* DRAAD42G FIX: Terug button met period_start parameter */}
              <Link
                href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
              >
                <button className="px-5 py-2.5 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 transition-colors font-medium shadow-sm">
                  ← Terug naar Dashboard Dagdelen
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
