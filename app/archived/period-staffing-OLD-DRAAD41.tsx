'use client';

// ============================================================================
// ARCHIVED: DRAAD41 - 21 november 2025
// Origineel scherm: Diensten per Dagdeel periode
// Reden archivering: Technische problemen na meerdere debug-pogingen
// Status: ARCHIVED - Wordt NIET meer gebruikt
// Database tabellen: roster_period_staffing + roster_period_staffing_dagdelen
//                    BLIJVEN BEHOUDEN voor nieuwe implementatie
// ============================================================================

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar, Sun, Sunset, Moon } from 'lucide-react';

// [REST OF OLD CODE - ARCHIVED FOR REFERENCE]
// Dit bestand wordt NIET meer actief gebruikt

export default function ArchivedPeriodStaffingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-lg p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Gearchiveerd Scherm</h1>
        <p className="text-gray-700 mb-2">Dit scherm is op 21 november 2025 gearchiveerd (DRAAD41).</p>
        <p className="text-gray-600 mb-4">Gebruik het nieuwe scherm: <strong>/planning/service-allocation</strong></p>
      </div>
    </div>
  );
}
