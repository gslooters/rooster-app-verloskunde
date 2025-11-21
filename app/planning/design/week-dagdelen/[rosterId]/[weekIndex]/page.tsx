'use client';

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ArrowLeft, Construction, Calendar, AlertCircle } from 'lucide-react';

// ============================================================================
// DRAAD41 - NIEUW SCHERM: VASTSTELLING DIENSTEN PER WEEK
// URL: /planning/design/week-dagdelen/[rosterId]/[weekIndex]?period_start=[date]
// Status: PLACEHOLDER - In ontwikkeling
// Functie: Dienst per team per datum per dagdeel vaststellen
// Database: roster_period_staffing + roster_period_staffing_dagdelen (BEHOUDEN)
// 
// VERVANGER VAN: /planning/period-staffing (gearchiveerd)
// ============================================================================

interface RosterInfo {
  id: string;
  start_date: string;
  end_date: string;
  naam?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getRosterIdFromParams(rosterId: string | string[]): string {
  return Array.isArray(rosterId) ? rosterId[0] : rosterId;
}

function getWeekIndexFromParams(weekIndex: string | string[]): number {
  const idx = Array.isArray(weekIndex) ? weekIndex[0] : weekIndex;
  return parseInt(idx, 10);
}

function getISOWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function formatDateLong(date: Date): string {
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface WeekDagdelenContentProps {
  rosterId: string;
  weekIndex: number;
}

function WeekDagdelenContent({ rosterId, weekIndex }: WeekDagdelenContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodStart = searchParams.get('period_start');
  
  const [rosterInfo, setRosterInfo] = useState<RosterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date | null>(null);
  const [weekEndDate, setWeekEndDate] = useState<Date | null>(null);

  useEffect(() => {
    async function loadRosterInfo() {
      if (!rosterId) {
        setError('Geen rooster ID gevonden in URL');
        setLoading(false);
        return;
      }

      try {
        const { data, error: dbError } = await supabase
          .from('roosters')
          .select('id, start_date, end_date, naam')
          .eq('id', rosterId)
          .maybeSingle();

        if (dbError) throw dbError;
        if (!data) throw new Error('Rooster niet gevonden');
        
        setRosterInfo(data);
        
        // Bereken week start/end dates op basis van weekIndex
        if (periodStart) {
          const startDate = new Date(periodStart + 'T00:00:00Z');
          const weekStart = new Date(startDate);
          weekStart.setUTCDate(startDate.getUTCDate() + ((weekIndex - 1) * 7));
          
          const weekEnd = new Date(weekStart);
          weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
          
          setWeekStartDate(weekStart);
          setWeekEndDate(weekEnd);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('[WEEK-DAGDELEN] Error loading roster:', err);
        setError(err.message || 'Fout bij laden rooster');
      } finally {
        setLoading(false);
      }
    }
    
    loadRosterInfo();
  }, [rosterId, weekIndex, periodStart]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Rooster informatie wordt geladen...</p>
        </div>
      </div>
    );
  }

  const weekNumber = weekStartDate ? getISOWeekNumber(weekStartDate) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
      {/* Header met terug knop */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/planning/design/dagdelen-dashboard?roster_id=${rosterId}&period_start=${periodStart}`)}
          className="mb-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Terug naar Dashboard Dagdelen
        </button>
      </div>

      {/* Main Content Card */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-100">
          {/* Construction Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-100 rounded-full p-6">
              <Construction className="h-16 w-16 text-yellow-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Vaststelling Diensten per Week
          </h1>
          
          <div className="text-center mb-8">
            <span className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-semibold">
              🚧 In Ontwikkeling
            </span>
          </div>

          {/* Rooster & Week Info */}
          {rosterInfo && weekStartDate && weekEndDate && (
            <div className="bg-blue-50 rounded-lg p-6 mb-8">
              <div className="flex items-start gap-3 mb-4">
                <Calendar className="h-6 w-6 text-blue-600 mt-1" />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {rosterInfo.naam || 'Rooster'}
                  </h2>
                  <div className="space-y-2 text-gray-700">
                    <p>
                      <span className="font-semibold">Rooster periode:</span>{' '}
                      {formatDateLong(new Date(rosterInfo.start_date))} t/m {formatDateLong(new Date(rosterInfo.end_date))}
                    </p>
                    <p>
                      <span className="font-semibold">Deze week:</span>{' '}
                      Week {weekNumber} ({formatDateLong(weekStartDate)} - {formatDateLong(weekEndDate)})
                    </p>
                    <p className="text-sm text-gray-500">
                      Week index: {weekIndex} van 5
                    </p>
                    <p className="text-sm text-gray-500">
                      Rooster ID: {rosterId}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              📋 Functionaliteit:
            </h3>
            <p className="text-gray-700 mb-4 leading-relaxed">
              Dit scherm wordt opnieuw gebouwd met een <strong>frisse aanpak</strong>. 
              Hier kun je straks per dienst, per team, per datum en per dagdeel het aantal
              benodigde medewerkers vaststellen.
            </p>
            <div className="bg-white/70 rounded p-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Doel:</strong> Dienst → Team → Datum → Dagdeel (Ochtend/Middag/Avond)
              </p>
              <p className="text-sm text-gray-600">
                <strong>Database:</strong> roster_period_staffing + roster_period_staffing_dagdelen
              </p>
            </div>
          </div>

          {/* Info Alert */}
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-semibold mb-1">
                  Status: Placeholder
                </p>
                <p className="text-sm text-amber-800">
                  Het oude scherm (DRAAD41) is gearchiveerd vanwege technische problemen.
                  Dit nieuwe scherm wordt later volledig uitgewerkt.
                </p>
              </div>
            </div>
          </div>

          {/* Technical Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer font-semibold hover:text-gray-700">
                Technische Details
              </summary>
              <div className="mt-3 space-y-1 pl-4">
                <p>• Vervanger van: <code className="bg-gray-100 px-2 py-1 rounded">/planning/period-staffing</code></p>
                <p>• Nieuwe route: <code className="bg-gray-100 px-2 py-1 rounded">/planning/design/week-dagdelen/[rosterId]/[weekIndex]</code></p>
                <p>• Database structuur: BEHOUDEN (geen wijzigingen)</p>
                <p>• Parameters: rosterId, weekIndex (1-5), period_start</p>
                <p>• Implementatie datum: TBD</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper met params extraction
interface PageProps {
  params: {
    rosterId: string | string[];
    weekIndex: string | string[];
  };
}

export default function WeekDagdelenPage({ params }: PageProps) {
  const rosterId = getRosterIdFromParams(params.rosterId);
  const weekIndex = getWeekIndexFromParams(params.weekIndex);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Pagina wordt geladen...</p>
        </div>
      </div>
    }>
      <WeekDagdelenContent rosterId={rosterId} weekIndex={weekIndex} />
    </Suspense>
  );
}
