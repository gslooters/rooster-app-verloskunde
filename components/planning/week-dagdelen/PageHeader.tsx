'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  startDatum: string;
  eindDatum: string;
}

export default function PageHeader({
  rosterId,
  weekNummer,
  jaar,
  startDatum,
  eindDatum,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        {/* Back Button */}
        <Link
          href={`/planning/design/dagdelen-dashboard?roster_id=${rosterId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar Diensten per Dagdeel Aanpassen</span>
        </Link>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Diensten per Dagdeel periode: Week {weekNummer}
        </h1>

        {/* Subtitle with dates */}
        <p className="text-sm text-gray-600">
          Van {startDatum} t/m {eindDatum}
        </p>
      </div>
    </header>
  );
}
