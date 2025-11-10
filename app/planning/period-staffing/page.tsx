'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PeriodStaffingGrid } from '@/components/planning/period-staffing/PeriodStaffingGrid';
import { loadRosterDesignData } from '@/lib/planning/rosterDesign';
import { formatWeekRange, formatDateRangeNl } from '@/lib/planning/storage';
import { useEffect, useState } from 'react';

function PeriodStaffingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rosterId = searchParams.get('rosterId');
  const [periodInfo, setPeriodInfo] = useState<{
    startDate: string;
    endDate: string;
    periodTitle: string;
    dateSubtitle: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rosterId) {
      setError('Geen roster ID gevonden');
      return;
    }

    try {
      // Haal roster design data op
      const designData = loadRosterDesignData(rosterId);
      
      if (!designData) {
        setError('Geen roster ontwerp data gevonden');
        return;
      }

      // Haal start en end date op uit designData
      let startDate = (designData as any).start_date || (designData as any).startDate || (designData as any).roster_start;
      let endDate = (designData as any).end_date || (designData as any).endDate || (designData as any).roster_end;

      // Als niet in designData, probeer uit localStorage rosters lijst
      if (!startDate || !endDate) {
        const rostersRaw = localStorage.getItem('verloskunde_rosters');
        if (rostersRaw) {
          const rosters = JSON.parse(rostersRaw);
          const currentRoster = rosters.find((r: any) => r.id === rosterId);
          if (currentRoster) {
            startDate = startDate || currentRoster.start_date || currentRoster.startDate;
            endDate = endDate || currentRoster.end_date || currentRoster.endDate;
          }
        }
      }

      // Bereken endDate als 35 dagen vanaf startDate indien niet beschikbaar
      if (startDate && !endDate) {
        const start = new Date(startDate);
        start.setDate(start.getDate() + 34); // 35 dagen totaal (0-34)
        endDate = start.toISOString().split('T')[0];
      }

      if (!startDate) {
        setError('Kan periode informatie niet ophalen uit roster data');
        return;
      }

      // Genereer periode informatie
      const periodTitle = formatWeekRange(startDate, endDate);
      const dateSubtitle = formatDateRangeNl(startDate, endDate);

      setPeriodInfo({
        startDate,
        endDate,
        periodTitle,
        dateSubtitle
      });
    } catch (err) {
      console.error('Fout bij ophalen periode informatie:', err);
      setError('Fout bij laden van rooster gegevens');
    }
  }, [rosterId]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Fout</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Terug naar Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!periodInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Periode informatie laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 md:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 mr-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center ring-1 ring-purple-200">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Diensten per Dag</h1>
                <p className="text-gray-600 mt-1">
                  <span className="font-semibold">{periodInfo.periodTitle}</span>
                  <span className="text-sm ml-2">({periodInfo.dateSubtitle})</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2"
            >
              <span>←</span>
              <span>Terug naar Dashboard</span>
            </button>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
            <p className="text-purple-800 text-sm">
              <strong>Instructie:</strong> Stel per dienst en per dag het minimum en maximum aantal benodigde medewerkers in. Klik in de cellen om de waarden aan te passen.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <PeriodStaffingGrid
            rosterId={rosterId!}
            startDate={periodInfo.startDate}
            endDate={periodInfo.endDate}
          />
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2"
          >
            <span>←</span>
            <span>Terug naar Dashboard</span>
          </button>
          <button
            onClick={() => {
              alert('Opslaan en doorgaan naar volgende stap');
              router.push(`/planning/design/dashboard?rosterId=${rosterId}`);
            }}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-bold text-lg shadow-lg"
          >
            Opslaan en Doorgaan →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PeriodStaffingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Pagina laden...</p>
        </div>
      </div>
    }>
      <PeriodStaffingContent />
    </Suspense>
  );
}
