'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  rosterId: string;
  weekNummer: number;        // Week index binnen roosterperiode (1-5)
  isoWeekNummer: number;     // 🔥 FIX 1: ISO weeknummer (48, 49, 50, etc.)
  jaar: number;
  startDatum: string;        // Formatted string (bijv. "1 december 2025")
  eindDatum: string;         // Formatted string (bijv. "7 december 2025")
  periodStart: string;       // 🔥 FIX 2: YYYY-MM-DD format voor return URL
}

/**
 * PageHeader component voor Week Dagdelen Detail scherm
 * 
 * DRAAD40B FIXES:
 * ✅ FIX 1: Toon ISO weeknummer (48, 49, 50) i.p.v. weekIndex (1, 2, 3)
 * ✅ FIX 2: Return button naar correct dashboard met period_start parameter
 * 
 * DRAAD40B5 TEST:
 * ✅ Opvallende TEST indicator voor build verificatie
 * 
 * Display voorbeeld:
 * - Titel: "Diensten per Dagdeel periode: Week 49"
 * - Subtitle: "Van 1 december 2025 t/m 7 december 2025"
 * - Return: Terug naar Dashboard Rooster Ontwerp
 */
export default function PageHeader({
  rosterId,
  weekNummer,
  isoWeekNummer,
  jaar,
  startDatum,
  eindDatum,
  periodStart,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        {/* 🔥 FIX 2: Back Button naar CORRECT dashboard met parameters */}
        <Link
          href={`/planning/design/dashboard?roster_id=${rosterId}&period_start=${periodStart}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar Dashboard Rooster Ontwerp</span>
        </Link>

        {/* 🔥 DRAAD40B5: OPVALLENDE TEST INDICATOR
            Grote rode tekst rechts bovenaan om direct te zien of nieuwe code actief is
        */}
        <div className="flex items-start justify-between mb-1">
          {/* 🔥 FIX 1: Title met ISO weeknummer */}
          <h1 className="text-2xl font-bold text-gray-900">
            Diensten per Dagdeel periode: Week {isoWeekNummer}
          </h1>

          {/* 🔥 DRAAD40B5: ZEER OPVALLENDE TEST INDICATOR */}
          <div className="px-6 py-3 bg-red-600 border-4 border-yellow-400 rounded-lg shadow-2xl animate-pulse">
            <span className="text-3xl font-black text-white tracking-widest">TEST DRAAD40B5</span>
          </div>
        </div>

        {/* Subtitle met datums */}
        <p className="text-sm text-gray-600">
          Van {startDatum} t/m {eindDatum}
        </p>
      </div>
    </header>
  );
}