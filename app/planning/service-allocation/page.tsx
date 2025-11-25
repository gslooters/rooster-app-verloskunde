'use client';

import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { ArrowLeft, FileDown, Loader2, AlertCircle } from 'lucide-react';
import { generateServiceAllocationPDFV3, downloadPDF } from '@/lib/pdf/service-allocation-generator-v3';

// ============================================================================
// DRAAD54 - SCHERM: DIENSTEN PER DAGDEEL AANPASSEN V3
// URL: /planning/service-allocation?rosterId={id}
// Functie: PDF export V3 met gekleurde badges en 2-kolom grid layout
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

function getRosterIdFromParams(searchParams: ReturnType<typeof useSearchParams>): string | null {
  if (!searchParams) return null;
  return searchParams.get('rosterId') || searchParams.get('roster_id');
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

function ServiceAllocationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rosterId = getRosterIdFromParams(searchParams);
  
  const [rosterInfo, setRosterInfo] = useState<RosterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

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
        setError(null);
      } catch (err: any) {
        console.error('[SERVICE-ALLOCATION] Error loading roster:', err);
        setError(err.message || 'Fout bij laden rooster');
      } finally {
        setLoading(false);
      }
    }
    
    loadRosterInfo();
  }, [rosterId]);

  // ============================================================================
  // PDF EXPORT HANDLER V3
  // ============================================================================
  
  async function handlePDFExport() {
    if (!rosterId || !rosterInfo) return;

    setPdfGenerating(true);
    setError(null);

    try {
      // Fetch data from API (now includes serviceTypes with kleuren)
      const response = await fetch(`/api/planning/service-allocation-pdf?rosterId=${rosterId}`);
      
      if (!response.ok) {
        throw new Error('Fout bij ophalen PDF data');
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.isEmpty) {
        setError(result.message || 'Geen diensten gevonden voor deze roosterperiode');
        setPdfGenerating(false);
        return;
      }

      // Generate PDF V3 with colored badges
      const pdf = generateServiceAllocationPDFV3(result.roster, result.data, result.serviceTypes);
      
      // Download PDF
      const filename = `Diensten-rooster-V3_Week-${getISOWeekNumber(new Date(rosterInfo.start_date))}-${getISOWeekNumber(new Date(rosterInfo.end_date))}_${new Date().getTime()}.pdf`;
      downloadPDF(pdf, filename);

      setPdfGenerating(false);

    } catch (err: any) {
      console.error('[PDF-EXPORT-V3] Error:', err);
      setError(err.message || 'Fout bij genereren PDF');
      setPdfGenerating(false);
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

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

  const startDate = rosterInfo ? new Date(rosterInfo.start_date) : null;
  const endDate = rosterInfo ? new Date(rosterInfo.end_date) : null;
  const startWeek = startDate ? getISOWeekNumber(startDate) : null;
  const endWeek = endDate ? getISOWeekNumber(endDate) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
      {/* Header met terug knop en PDF export */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push(`/planning/design/dashboard?rosterId=${rosterId}`)}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Terug naar Dashboard
        </button>

        <button
          onClick={handlePDFExport}
          disabled={pdfGenerating}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              PDF V3 wordt gegenereerd...
            </>
          ) : (
            <>
              <FileDown className="h-5 w-5" />
              PDF V3 export (gekleurde badges)
            </>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Diensten Rooster Dashboard V3: Week {startWeek} - Week {endWeek}
        </h1>
        
        {rosterInfo && startDate && endDate && (
          <p className="text-gray-600 mb-8">
            rooster: {formatDateLong(startDate)} - {formatDateLong(endDate)}
          </p>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 rounded-r-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm text-red-900 font-semibold">Fout</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* V3 Features Info Card */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl shadow-xl p-8 border-2 border-teal-100 mb-6">
          <h2 className="text-2xl font-bold text-teal-900 mb-4">✨ Nieuw in V3</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span><strong>Gekleurde dienst-badges:</strong> Diensten worden weergegeven als gekleurde afgeronde rechthoeken met witte tekst (kleuren uit database)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span><strong>2-kolom grid layout:</strong> Diensten per dagdeel getoond in 2 kolommen (dienst1-dienst2 | dienst3-dienst4)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span><strong>Dikke scheiding:</strong> Duidelijke visuele scheiding tussen dagen (3px lijn)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span><strong>Week-op-één-A4:</strong> Elke week past optimaal op één A4 pagina</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-600 font-bold">✓</span>
              <span><strong>Compacte datum:</strong> "Ma 24 nov" op één regel voor betere leesbaarheid</span>
            </li>
          </ul>
        </div>

        {/* Week List */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-100">
          <div className="space-y-4">
            {/* Week 48 */}
            <div className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Week 48: 24/11 - 30/11</span>
                <span className="text-blue-600">→</span>
              </div>
            </div>

            {/* Week 49 */}
            <div className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Week 49: 01/12 - 07/12</span>
                <span className="text-blue-600">→</span>
              </div>
            </div>

            {/* Week 50 */}
            <div className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Week 50: 08/12 - 14/12</span>
                <span className="text-blue-600">→</span>
              </div>
            </div>

            {/* Week 51 */}
            <div className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Week 51: 15/12 - 21/12</span>
                <span className="text-blue-600">→</span>
              </div>
            </div>

            {/* Week 52 */}
            <div className="bg-blue-50 hover:bg-blue-100 rounded-lg p-4 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">Week 52: 22/12 - 28/12</span>
                <span className="text-blue-600">→</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong className="block mb-2">ℹ️ Tip:</strong>
                Klik op de PDF V3 export knop rechtsboven om een volledig overzicht van alle weken te downloaden met gekleurde dienst-badges en verbeterde layout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceAllocationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Pagina wordt geladen...</p>
        </div>
      </div>
    }>
      <ServiceAllocationContent />
    </Suspense>
  );
}
