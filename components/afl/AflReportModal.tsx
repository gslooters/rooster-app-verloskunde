'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, TrendingDown, Download } from 'lucide-react';

/**
 * AFL Report Modal Component - DRAAD420: Download PDF Fix
 * UPDATED: 20 januari 2026 - DRAAD420 Backend PDF Download
 *
 * DRAAD420 CHANGES:
 * ✅ Verwijderd: window.print() / handlePrint()
 * ✅ Nieuw: handleDownloadBackendPdf() - haalt PDF op van backend
 * ✅ Knop: "Afdrukken / PDF" → "Download PDF"
 * ✅ API: /api/reports/[afl_run_id]/pdf (GET)
 * ✅ Cache-busting: ?cb=Date.now() + headers
 * ✅ Bestandsnaam: afl-rapport-<prefix>-<timestamp>.pdf
 * ✅ Foutafhandeling: duidelijke meldingen
 * ✅ Icon: Download i.p.v. Printer
 *
 * BESTAANDE FEATURES:
 * - Detailoverzicht ontbrekende diensten per dag
 * - Groupering per datum met dagdeel/team/dienstcode
 * - Print-friendly styling met vaste kopregel
 * - Nederlandse datum formatting
 * - Kleurcodering dagdelen (M=geel, O=oranje, N=blauw)
 * - Loading states en error handling
 */

interface AflReportModalProps {
  isOpen: boolean;
  reportData: any; // ExecutionResult type van AflProgressModal
  onClose: () => void;
}

interface MissingService {
  date: string;
  dagdeel: string;
  dagdeel_display: string;
  team: string;
  dienst_code: string;
  ontbrekend_aantal: number;
}

interface DayGroup {
  date: string;
  date_formatted: string;
  total_missing: number;
  services: MissingService[];
}

interface MissingServicesData {
  success: boolean;
  roster_id: string;
  total_missing: number;
  missing_services: any[];
  grouped_by_date: { [key: string]: DayGroup };
}

export function AflReportModal({ isOpen, reportData, onClose }: AflReportModalProps) {
  const [missingServices, setMissingServices] = useState<MissingServicesData | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(true);
  const [errorMissing, setErrorMissing] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Fetch missing services when modal opens
  useEffect(() => {
    if (isOpen && reportData?.rosterId) {
      fetchMissingServices(reportData.rosterId);
    }
  }, [isOpen, reportData?.rosterId]);

  async function fetchMissingServices(rosterId: string | null | undefined) {
    if (!rosterId) {
      console.warn('[AFL-REPORT] Missing rosterId, skipping missing-services fetch');
      setErrorMissing('Rooster ID ontbreekt, detailoverzicht kan niet geladen worden.');
      setLoadingMissing(false);
      return;
    }

    setLoadingMissing(true);
    setErrorMissing(null);

    try {
      const cacheBust = Date.now().toString();
      console.log('[AFL-REPORT] Fetching missing services for roster:', rosterId, 'cb:', cacheBust);

      const response = await fetch('/api/afl/missing-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Cache-busting headers
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          'X-Cache-Bust': cacheBust,
          // Railway random trigger om eventuele edge caching te omzeilen
          'X-Railway-Trigger': `railway-${cacheBust}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({ roster_id: rosterId }),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response structure from missing-services API');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch missing services');
      }

      console.log('[AFL-REPORT] Missing services loaded:', data.total_missing);
      setMissingServices(data as MissingServicesData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AFL-REPORT] Error fetching missing services:', errorMessage);
      setErrorMissing(errorMessage);
    } finally {
      setLoadingMissing(false);
    }
  }

  /**
   * DRAAD420: Download backend-generated PDF
   * Haalt de complete PDF op via /api/reports/[afl_run_id]/pdf
   * inclusief detailoverzicht ontbrekende diensten
   */
  async function handleDownloadBackendPdf() {
    if (!reportData?.afl_run_id) {
      alert('AFL Run ID ontbreekt, PDF kan niet worden gedownload.');
      console.error('[AFL-REPORT] PDF download failed: afl_run_id is missing');
      return;
    }

    setDownloadingPdf(true);

    try {
      const cacheBust = Date.now();
      const url = `/api/reports/${reportData.afl_run_id}/pdf?cb=${cacheBust}`;
      
      console.log('[AFL-REPORT] Downloading PDF from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          'X-Cache-Bust': cacheBust.toString(),
          'X-Railway-Trigger': `railway-${cacheBust}-${Math.random().toString(36).slice(2, 8)}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Verificatie dat we een PDF hebben ontvangen
      if (!blob.type.includes('pdf') && blob.size < 100) {
        throw new Error('Ongeldig PDF-bestand ontvangen van server');
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Bestandsnaam: afl-rapport-<prefix>-<timestamp>.pdf
      const prefix = reportData.afl_run_id.substring(0, 8);
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 14);
      link.download = `afl-rapport-${prefix}-${timestamp}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      console.log('[AFL-REPORT] PDF download completed:', link.download);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AFL-REPORT] PDF download failed:', errorMessage);
      alert(
        `Download van PDF is mislukt: ${errorMessage}\n\nProbeer het opnieuw of neem contact op met de beheerder.`
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  const summary = reportData?.report?.summary || {};
  const coveragePercent = summary.coverage_percent || 0;
  const totalPlanned = summary.total_planned || 0;
  const totalRequired = summary.total_required || 0;
  const totalUnfilled = totalRequired - totalPlanned;

  // Status bepalen op basis van bezettingsgraad
  const getStatusColor = (coverage: number) => {
    if (coverage >= 90) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        badge: 'bg-green-100 text-green-800',
      };
    }
    if (coverage >= 75) {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        badge: 'bg-yellow-100 text-yellow-800',
      };
    }
    return {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      badge: 'bg-red-100 text-red-800',
    };
  };

  const statusColor = getStatusColor(coveragePercent);

  // Waarschuwingen bepalen
  const warnings: { type: string; severity: 'high' | 'medium'; message: string }[] = [];
  if (totalUnfilled > 0 && totalRequired > 0) {
    warnings.push({
      type: 'unfilled',
      severity: totalUnfilled > 10 ? 'high' : 'medium',
      message: `${totalUnfilled} diensten zijn nog niet ingevuld (${(
        (totalUnfilled / totalRequired) * 100
      ).toFixed(1)}%)`,
    });
  }
  if (coveragePercent < 75) {
    warnings.push({
      type: 'lowCoverage',
      severity: 'high',
      message: `Bezettingsgraad lager dan target (${coveragePercent.toFixed(1)}% vs target 90%)`,
    });
  }
  if (coveragePercent < 90) {
    warnings.push({
      type: 'partialCoverage',
      severity: 'medium',
      message: 'Nog niet optimaal bezet - werk aan verhoging naar 90%+',
    });
  }

  // Dagdeel kleuren
  const getDagdeelColor = (dagdeel: string) => {
    if (dagdeel === 'M') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (dagdeel === 'O') return 'bg-orange-100 text-orange-800 border-orange-300';
    if (dagdeel === 'N') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getDagdeelEmoji = (dagdeel: string) => {
    if (dagdeel === 'M') return '🌅';
    if (dagdeel === 'O') return '🌆';
    if (dagdeel === 'N') return '🌙';
    return '⏰';
  };

  return (
    <>
      {/* Print Header - Only visible when printing */}
      <div className="print-header hidden print:block">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              📋 AFL Roostering Rapport
            </h1>
            <p className="text-sm text-gray-700 mt-1">
              Roosterperiode: {reportData?.period_start || 'N/A'} -{' '}
              {reportData?.period_end || 'N/A'}
            </p>
          </div>
          <div className="text-right text-sm text-gray-700">
            <p className="font-semibold">
              Run ID: {reportData?.afl_run_id?.substring(0, 12) || 'N/A'}...
            </p>
            <p>Gegenereerd: {new Date().toLocaleString('nl-NL')}</p>
          </div>
        </div>
      </div>

      {/* Overlay - FIX: z-[9998] in plaats van ongeldig z-55 */}
      <div className="fixed inset-0 z-[9998] bg-black/30 no-print" />

      {/* Report Modal - FIX: z-[9999] in plaats van ongeldig z-60 */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 print:p-0 print:block print:relative">
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none">
          {/* Header - Print-friendly */}
          <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-8 py-6 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 no-print">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📋 AFL Rapport</h1>
              <p className="text-sm text-gray-600 mt-1">
                {reportData?.afl_run_id
                  ? `Run ID: ${reportData.afl_run_id.substring(0, 8)}...`
                  : 'Rapport Details'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content - PDF-vriendelijk */}
          <div className="px-8 py-6 space-y-8 print:pt-32">
            {/* Status Summary Card */}
            <div className={`${statusColor.bg} border-2 ${statusColor.border} rounded-lg p-6`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className={`text-xl font-bold ${statusColor.text} mb-4`}>
                    {coveragePercent >= 90
                      ? '✅ Optimaal bezet'
                      : coveragePercent >= 75
                      ? '⚠️ Deels ingevuld'
                      : '❌ Onvoldoende bezet'}
                  </h2>

                  {/* Main Statistics Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Bezettingsgraad
                      </p>
                      <p className={`text-3xl font-bold ${statusColor.text}`}>
                        {coveragePercent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">van benodigd</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Diensten Ingepland
                      </p>
                      <p className="text-3xl font-bold text-blue-700">{totalPlanned}</p>
                      <p className="text-xs text-gray-600 mt-1">van {totalRequired}</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Nog In Te Vullen
                      </p>
                      <p
                        className={`text-3xl font-bold ${
                          totalUnfilled === 0
                            ? 'text-green-700'
                            : totalUnfilled <= 10
                            ? 'text-yellow-700'
                            : 'text-red-700'
                        }`}
                      >
                        {totalUnfilled}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">diensten</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warnings Section */}
            {warnings.length > 0 && (
              <div className="space-y-3 page-break-avoid">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} className="text-orange-600" />
                  Waarschuwingen &amp; Opmerkingen
                </h3>
                <div className="space-y-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning.type}
                      className={`rounded-lg p-4 border-2 flex items-start gap-3 ${
                        warning.severity === 'high'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                          warning.severity === 'high'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}
                      >
                        {warning.severity === 'high' ? '!' : '⚠'}
                      </div>
                      <div>
                        <p
                          className={`font-medium ${
                            warning.severity === 'high'
                              ? 'text-red-800'
                              : 'text-yellow-800'
                          }`}
                        >
                          {warning.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NIEUW: Detailoverzicht Ontbrekende Diensten */}
            <div className="space-y-3 page-break-avoid">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                📋 Detailoverzicht Ontbrekende Diensten
              </h3>

              {loadingMissing ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto no-print" />
                  <p className="text-gray-600 mt-4">Laden...</p>
                </div>
              ) : errorMissing ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
                  <AlertCircle size={32} className="mx-auto text-red-600 mb-2" />
                  <p className="text-lg font-semibold text-red-800">Fout bij laden</p>
                  <p className="text-sm text-red-700 mt-2">{errorMissing}</p>
                </div>
              ) : missingServices?.total_missing === 0 ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-green-600 mb-2" />
                  <p className="text-lg font-semibold text-green-800">
                    Alle diensten zijn ingevuld!
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Geen nog in te vullen diensten - het rooster is compleet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(missingServices?.grouped_by_date || {}).map(
                    ([date, dayData]) => (
                      <div
                        key={date}
                        className="day-group bg-white border-2 border-gray-300 rounded-lg p-4 page-break-avoid"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-900">
                            📅 {dayData.date_formatted}
                          </h4>
                          <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                            {dayData.total_missing}{' '}
                            {dayData.total_missing === 1 ? 'dienst' : 'diensten'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {dayData.services.map((service: MissingService, idx: number) => (
                            <div
                              key={`${date}-${service.dienst_code}-${idx}`}
                              className="flex items-center gap-3 pl-4 py-2 border-l-4 border-blue-400 bg-gray-50 rounded-r"
                            >
                              <span
                                className={`px-3 py-1 rounded text-sm font-semibold border-2 ${getDagdeelColor(
                                  service.dagdeel,
                                )}`}
                              >
                                {getDagdeelEmoji(service.dagdeel)}{' '}
                                {service.dagdeel_display}
                              </span>
                              <span className="text-gray-700">
                                Team <strong>{service.team}</strong>
                              </span>
                              <span className="px-2 py-1 bg-gray-200 rounded text-xs font-mono font-bold border border-gray-400">
                                {service.dienst_code}
                              </span>
                              <span className="text-red-600 font-semibold ml-auto">
                                {service.ontbrekend_aantal} nodig
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Overzicht Nog In Te Vullen Diensten (Samenvatting) */}
            <div className="space-y-3 page-break-avoid">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingDown size={20} className="text-blue-600" />
                Samenvatting Nog In Te Vullen
              </h3>

              {totalUnfilled === 0 ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
                  <p className="text-lg font-semibold text-green-800 flex items-center justify-center gap-2">
                    <CheckCircle2 size={24} />
                    Alle diensten zijn ingevuld!
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Geen nog in te vullen diensten - het rooster is compleet.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 space-y-3">
                  <p className="text-sm font-medium text-gray-900 mb-4">
                    Er zijn{' '}
                    <span className="font-bold text-lg">{totalUnfilled}</span>{' '}
                    diensten nog in te vullen:
                  </p>

                  {/* Breakdown per status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                        Totaal Benodigd
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {totalRequired}
                      </p>
                    </div>
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                        Al Ingepland
                      </p>
                      <p className="text-2xl font-bold text-green-700">
                        {totalPlanned}
                      </p>
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">
                        VOORTGANG INVULLING
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {totalRequired > 0
                          ? ((totalPlanned / totalRequired) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden border border-gray-300">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                        style={{
                          width:
                            totalRequired > 0
                              ? `${(totalPlanned / totalRequired) * 100}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aanbevelingen */}
            {totalUnfilled > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-3 page-break-avoid">
                <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                  💡 Aanbevelingen
                </h3>
                <ul className="space-y-2 text-sm text-blue-900 list-disc list-inside">
                  <li>
                    Controleer de {totalUnfilled} nog in te vullen diensten in het
                    rooster
                  </li>
                  <li>Vul medewerkers in voor de beschikbare slots</li>
                  <li>Zorg dat alle DIO/DDO-regels worden nageleefd</li>
                  <li>
                    Voer de AFL-pijplijn opnieuw uit nadat diensten zijn ingevuld
                  </li>
                  <li>
                    Stijg naar minimaal 90% bezettingsgraad voor optimale planning
                  </li>
                </ul>
              </div>
            )}

            {/* Meta Info */}
            <div className="border-t-2 border-gray-300 pt-6 text-xs text-gray-600 space-y-1">
              <p>
                🔹 <span className="font-mono">AFL Run ID:</span>{' '}
                <span className="font-mono text-gray-900">
                  {reportData?.afl_run_id || 'N/A'}
                </span>
              </p>
              <p>
                🔹 <span className="font-mono">Rooster ID:</span>{' '}
                <span className="font-mono text-gray-900">
                  {reportData?.rosterId || 'N/A'}
                </span>
              </p>
              <p>
                🔹 <span>Gegenereerd op:</span>{' '}
                <span className="font-mono text-gray-900">
                  {new Date().toLocaleString('nl-NL')}
                </span>
              </p>
            </div>
          </div>

          {/* Footer - Sticky - DRAAD420: Download PDF knop */}
          <div className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-50 px-8 py-4 flex justify-between items-center no-print">
            <p className="text-xs text-gray-600">
              📋 Download het complete rapport inclusief detailoverzicht
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDownloadBackendPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {downloadingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Downloaden...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-md"
              >
                ← Terug
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Verberg niet-print elementen */
          .no-print {
            display: none !important;
          }

          /* Toon print-only elementen */
          .print\\:block {
            display: block !important;
          }

          /* Print header styling */
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: white;
            border-bottom: 2px solid #333;
            padding: 15mm;
            z-index: 10000;
          }

          /* Body aanpassingen */
          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }

          /* Modal aanpassingen voor print */
          .fixed.inset-0.z-\\[9999\\] {
            position: relative !important;
            z-index: auto !important;
            padding: 0 !important;
            display: block !important;
          }

          /* Voorkom page breaks binnen groepen */
          .day-group,
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Pagina marges */
          @page {
            margin: 20mm 15mm;
            size: A4 portrait;
          }

          /* Eerste sectie ruimte voor header */
          .print\\:pt-32 {
            padding-top: 32mm !important;
          }

          /* Verberg animaties */
          .animate-spin {
            display: none !important;
          }

          /* Zorg dat kleuren behouden blijven */
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}
