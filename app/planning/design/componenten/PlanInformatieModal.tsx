'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchNoCache } from '@/lib/utils/fetchNoCache'; // 🔥 DRAAD162-FIX

interface DiensteRow {
  code: string;
  naam: string;
  kleur: string;
  nodig: number;
  beschikbaar: number;
  verschil: number;
  status: 'groen' | 'rood';
}

interface PlanInformatieModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosterId: string;
}

function formatNumber(value: number): string {
  // Als value heeft decimalen, toon met 1 decimaal, anders zonder
  if (value % 1 !== 0) {
    return value.toFixed(1);
  }
  return value.toString();
}

/**
 * DRAAD159 - Planinformatie Modal Component
 * FIX: PDF naming - nu "Planinformatie_YYYYMMDD_HHMM.pdf"
 * 
 * DRAAD160-FIX: Added timestamp parameter to bypass browser cache
 * and ensure fresh data from PostgREST on every modal open
 * 
 * DRAAD162-FIX: Use fetchNoCache utility + explicit cache-control headers
 * - fetchNoCache ensures: cache: 'no-store' + aggressive HTTP headers
 * - No 304 Not Modified responses
 * - Fresh data guaranteed on every modal open
 *
 * DRAAD165-FIX: Manual refresh button instead of auto-refresh
 * - REMOVED: setInterval(fetchData, 3000) from DRAAD164 (caused screen jumping)
 * - ADDED: "🔄 Vernieuwen" button in footer for manual refresh
 * - Keep: fetchData useCallback for reusability (initial load + manual refresh)
 * - Result: Clean UX, no screen jumping, user-controlled updates
 */
export function PlanInformatieModal({ isOpen, onClose, rosterId }: PlanInformatieModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DRAAD165-FIX: Use useCallback for fetchData (reusable for initial + manual refresh)
  const fetchData = useCallback(async () => {
    if (!rosterId) return;

    try {
      setLoading(true);
      setError(null);
      
      // 🔥 DRAAD162-FIX: Use fetchNoCache utility for aggressive cache-busting
      // This ensures:
      // - cache: 'no-store' prevents browser caching
      // - HTTP headers prevent 304 Not Modified responses
      // - Fresh data from server on every fetch
      const timestamp = Date.now();
      const response = await fetchNoCache(
        `/api/planinformatie-periode?rosterId=${rosterId}&ts=${timestamp}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Fout bij ophalen gegevens');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      console.error('PlanInformatieModal error:', err);
    } finally {
      setLoading(false);
    }
  }, [rosterId]);

  // DRAAD165: Initial fetch when modal opens (NO auto-refresh interval)
  useEffect(() => {
    if (!isOpen || !rosterId) return;

    // Fetch immediately when modal opens
    fetchData();
    
    // NO setInterval here - user will click "Vernieuwen" button when needed
  }, [isOpen, rosterId, fetchData]);

  // DRAAD159-FIX: PDF export met betere naamgeving
  const handlePdfExport = useCallback(() => {
    if (!data) return;

    // Genereer bestandsnaam: Planinformatie_20251210_1609.pdf
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`; // HHMM
    const filename = `Planinformatie_${dateStr}_${timeStr}.pdf`;

    // Dynamische HTML voor PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="nl">
      <head>
        <meta charset="UTF-8">
        <title>${filename}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #1a1a1a;
          }
          .meta {
            font-size: 12px;
            color: #666;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ddd;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          thead {
            background-color: #f3f4f6;
          }
          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            border: 1px solid #d1d5db;
          }
          td {
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            font-size: 13px;
          }
          tr.data-row:nth-child(even) {
            background-color: #fafafa;
          }
          tr.total-row {
            background-color: #f3f4f6;
            font-weight: 600;
          }
          .status-groen { color: #059669; font-weight: 600; }
          .status-rood { color: #dc2626; font-weight: 600; }
          .kleur-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            color: #000;
          }
          .right-align {
            text-align: right;
          }
          .footer {
            font-size: 11px;
            color: #999;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <h1>Planinformatie: Periode Week ${data.periode.startWeek} t/m Week ${data.periode.endWeek}</h1>
        <div class="meta">
          Periode: ${new Date(data.periode.startDate).toLocaleDateString('nl-NL')} t/m ${new Date(data.periode.endDate).toLocaleDateString('nl-NL')}<br>
          Gegenereerd: ${new Date().toLocaleString('nl-NL')}
        </div>

        <table>
          <thead>
            <tr>
              <th>Dienst</th>
              <th>Code</th>
              <th class="right-align">Nodig</th>
              <th class="right-align">Beschikbaar</th>
              <th class="right-align">Verschil</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.diensten
              .map(
                (dienst: DiensteRow) => `
              <tr class="data-row">
                <td>${dienst.naam}</td>
                <td>
                  <span class="kleur-badge" style="background-color: ${dienst.kleur || '#e5e7eb'};">${dienst.code}</span>
                </td>
                <td class="right-align">${formatNumber(dienst.nodig)}</td>
                <td class="right-align">${formatNumber(dienst.beschikbaar)}</td>
                <td class="right-align">${formatNumber(dienst.verschil)}</td>
                <td class="status-${dienst.status}">${dienst.status === 'groen' ? '✓ Voldoende' : '⚠ Tekort'}</td>
              </tr>
            `
              )
              .join('')}
            <tr class="total-row">
              <td colspan="2">TOTAAL</td>
              <td class="right-align">${formatNumber(data.totaal.nodig)}</td>
              <td class="right-align">${formatNumber(data.totaal.beschikbaar)}</td>
              <td class="right-align">${formatNumber(data.totaal.verschil)}</td>
              <td class="status-${data.totaal.status}">${data.totaal.status === 'groen' ? '✓ Voldoende' : '⚠ Tekort'}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <strong>Toelichting:</strong>
          <ul style="margin-left: 20px; margin-top: 8px;">
            <li><strong>Nodig:</strong> Totaal aantal medewerkers benodigd voor deze dienst in de periode</li>
            <li><strong>Beschikbaar:</strong> Totaal aantal actieve medewerkers die deze dienst kunnen doen</li>
            <li><strong>Verschil:</strong> Aanbod minus vraag (negatief = tekort, positief = overschot)</li>
            <li><strong>Status:</strong> Groen: aanbod ≥ vraag | Rood: aanbod &lt; vraag</li>
          </ul>
        </div>
      </body>
      </html>
    `;

    // Maak blob en download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Print naar PDF
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    }, 500);
  }, [data]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 sm:pt-6">
        <div
          className="bg-white rounded-lg shadow-2xl w-full mx-4 max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              {data ? (
                <h2 className="text-xl font-bold text-gray-900">
                  Planinformatie: Periode Week {data.periode.startWeek} t/m Week {data.periode.endWeek}
                </h2>
              ) : (
                <h2 className="text-xl font-bold text-gray-500">Laden...</h2>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">Gegevens aan het laden...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Fout: {error}</p>
              </div>
            )}

            {data && !loading && (
              <div className="space-y-6">
                {/* Meta informatie */}
                <div className="text-sm text-gray-600 pb-4 border-b border-gray-200">
                  <p>
                    <strong>Periode:</strong> {new Date(data.periode.startDate).toLocaleDateString('nl-NL')} t/m{' '}
                    {new Date(data.periode.endDate).toLocaleDateString('nl-NL')}
                  </p>
                </div>

                {/* Tabel */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Dienst</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Code</th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Nodig</th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Beschikbaar</th>
                        <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Verschil</th>
                        <th className="border border-gray-300 px-4 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.diensten.map((dienst: DiensteRow, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">{dienst.naam}</td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span
                              className="inline-block px-3 py-1 rounded text-sm font-semibold text-black"
                              style={{ backgroundColor: dienst.kleur || '#e5e7eb' }}
                            >
                              {dienst.code}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            {formatNumber(dienst.nodig)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            {formatNumber(dienst.beschikbaar)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            {formatNumber(dienst.verschil)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <span
                              className={`inline-block px-3 py-1 rounded font-semibold text-sm ${
                                dienst.status === 'groen'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {dienst.status === 'groen' ? '✓ Voldoende' : '⚠ Tekort'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {/* Totaal rij */}
                      <tr className="bg-gray-100 font-semibold text-gray-900">
                        <td colSpan={2} className="border border-gray-300 px-4 py-3">
                          TOTAAL
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right">
                          {formatNumber(data.totaal.nodig)}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right">
                          {formatNumber(data.totaal.beschikbaar)}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right">
                          {formatNumber(data.totaal.verschil)}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded font-semibold text-sm ${
                              data.totaal.status === 'groen'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {data.totaal.status === 'groen' ? '✓ Voldoende' : '⚠ Tekort'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Toelichting */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Toelichting:</strong> De tabel toont het aanbod versus de vraag per dienst.
                    <strong> Groen</strong> betekent dat er voldoende medewerkers beschikbaar zijn, <strong>Rood</strong> geeft aan dat er een tekort is.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer - DRAAD165: Add manual Vernieuwen button */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">100% zoom aanbevolen voor optimale weergave</p>
            <div className="flex gap-3">
              {/* DRAAD165: Manual refresh button (user-controlled, no auto-refresh) */}
              {data && !error && (
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  title="Gegevens vernieuwen (F5 equivalent)"
                >
                  {loading ? '⟳ Laden...' : '🔄 Vernieuwen'}
                </button>
              )}
              {data && !loading && !error && (
                <button
                  onClick={handlePdfExport}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  📄 PDF Export
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-medium transition-colors"
              >
                Terug
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
