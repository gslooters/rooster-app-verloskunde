'use client';

import React from 'react';
import { X, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';

/**
 * AFL Report Modal Component - DRAAD406F3: Optie B Implementation
 * 
 * DRAAD406F3 NIEUW COMPONENT:
 * 1. ✅ CREATED: AflReportModal.tsx - Volledig nieuw component
 * 2. ✅ IMPLEMENTED: PDF-vriendelijke rapport weergave
 * 3. ✅ ADDED: Statistieken uit result.report.summary
 * 4. ✅ ADDED: Overzicht nog niet ingevulde diensten
 * 5. ✅ ADDED: Print-vriendelijk styling met kleurcodering
 * 6. ✅ ADDED: Terug knop (enige knop in deze modal)
 * 7. ✅ ADDED: Warnings/alerts voor onderbezetting
 * 8. ✅ TESTED: Syntax errors gecontroleerd
 * 9. ✅ FIXED: Z-index bug - z-55 en z-60 zijn ongeldig in Tailwind CSS
 *    - Changed z-55 → z-[9998] (arbitrary value)
 *    - Changed z-60 → z-[9999] (arbitrary value)
 *    - Zorg dat AflReportModal BOVEN AflProgressModal verschijnt
 * 
 * DESIGN FILOSOFIE:
 * - Modal ziet er uit als printable document (PDF-vriendelijk)
 * - Hoge z-index (z-[9999]) om boven AflProgressModal (z-50) te zitten
 * - Overzichtelijk layout met secties
 * - Kleurcodering voor status indicators
 * - "Terug" knop brengt gebruiker terug naar AflProgressModal
 * 
 * DATA BRON (Vraag 1):
 * - Gebruikt result.report object uit ExecutionResult
 * - Bevat: summary { coverage_percent, total_planned, total_required }
 * 
 * RAPPORT DETAIL LEVEL (Vraag 2):
 * - Bezettingsgraad percentage
 * - Diensten ingepland vs required
 * - Waarschuwingen voor onderbezetting
 * - Overzicht nog niet ingevulde diensten (berekend op basis van data)
 * 
 * STYLING (Vraag 3):
 * - PDF-vriendelijk (geen javascript animaties, printbare kleuren)
 * - Print-optimized layout
 * - Kleurcodering: Groen (OK), Oranje (Waarschuwing), Rood (Kritiek)
 * 
 * FIX DETAILS:
 * Problem: z-55 en z-60 zijn GEEN geldige Tailwind CSS klassen
 * Tailwind standaard z-index waarden:
 *   - z-0, z-10, z-20, z-30, z-40, z-50, z-auto
 *   - z-55, z-60, etc. bestaan NIET
 * Solution: Gebruik arbitrary values: z-[9998] en z-[9999]
 * Result: AflReportModal appear BOVEN AflProgressModal (z-50)
 */

interface AflReportModalProps {
  isOpen: boolean;
  reportData: any; // ExecutionResult type van AflProgressModal
  onClose: () => void;
}

export function AflReportModal({ isOpen, reportData, onClose }: AflReportModalProps) {
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
    if (coverage >= 90) return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800' };
    if (coverage >= 75) return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-800' };
  };

  const statusColor = getStatusColor(coveragePercent);

  // Waarschuwingen bepalen
  const warnings = [];
  if (totalUnfilled > 0) {
    warnings.push({
      type: 'unfilled',
      severity: totalUnfilled > 10 ? 'high' : 'medium',
      message: `${totalUnfilled} diensten zijn nog niet ingevuld (${(totalUnfilled / totalRequired * 100).toFixed(1)}%)`
    });
  }
  if (coveragePercent < 75) {
    warnings.push({
      type: 'lowCoverage',
      severity: 'high',
      message: `Bezettingsgraad lager dan target (${coveragePercent.toFixed(1)}% vs target 90%)`
    });
  }
  if (coveragePercent < 90) {
    warnings.push({
      type: 'partialCoverage',
      severity: 'medium',
      message: `Nog niet optimaal bezet - werk aan verhoging naar 90%+`
    });
  }

  return (
    <>
      {/* Overlay - FIX: z-[9998] in plaats van ongeldig z-55 */}
      <div className="fixed inset-0 z-[9998] bg-black/30" />

      {/* Report Modal - FIX: z-[9999] in plaats van ongeldig z-60 */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header - Print-friendly */}
          <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-8 py-6 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📄 AFL Rapport</h1>
              <p className="text-sm text-gray-600 mt-1">
                {reportData?.afl_run_id ? `Run ID: ${reportData.afl_run_id.substring(0, 8)}...` : 'Rapport Details'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content - PDF-vriendelijk */}
          <div className="px-8 py-6 space-y-8">
            {/* Status Summary Card */}
            <div className={`${statusColor.bg} border-2 ${statusColor.border} rounded-lg p-6`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className={`text-xl font-bold ${statusColor.text} mb-4`}>
                    {coveragePercent >= 90 ? '✅ Optimaal bezet' : 
                     coveragePercent >= 75 ? '⚠️ Deels ingevuld' : 
                     '❌ Onvoldoende bezet'}
                  </h2>
                  
                  {/* Main Statistics Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Bezettingsgraad</p>
                      <p className={`text-3xl font-bold ${statusColor.text}`}>
                        {coveragePercent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600 mt-1">van benodigd</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Diensten Ingepland</p>
                      <p className="text-3xl font-bold text-blue-700">
                        {totalPlanned}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">van {totalRequired}</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Nog In Te Vullen</p>
                      <p className={`text-3xl font-bold ${
                        totalUnfilled === 0 ? 'text-green-700' :
                        totalUnfilled <= 10 ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
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
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} className="text-orange-600" />
                  Waarschuwingen & Opmerkingen
                </h3>
                <div className="space-y-2">
                  {warnings.map((warning, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 border-2 flex items-start gap-3 ${
                        warning.severity === 'high'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                        warning.severity === 'high'
                          ? 'bg-red-200 text-red-800'
                          : 'bg-yellow-200 text-yellow-800'
                      }`}>
                        {warning.severity === 'high' ? '!' : '⚠'}
                      </div>
                      <div>
                        <p className={`font-medium ${
                          warning.severity === 'high'
                            ? 'text-red-800'
                            : 'text-yellow-800'
                        }`}>
                          {warning.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overzicht Nog In Te Vullen Diensten */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TrendingDown size={20} className="text-blue-600" />
                Nog In Te Vullen Diensten
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
                    Er zijn <span className="font-bold text-lg">{totalUnfilled}</span> diensten nog in te vullen:
                  </p>
                  
                  {/* Breakdown per status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Totaal Benodigd</p>
                      <p className="text-2xl font-bold text-gray-900">{totalRequired}</p>
                    </div>
                    <div className="bg-white rounded p-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Al Ingepland</p>
                      <p className="text-2xl font-bold text-green-700">{totalPlanned}</p>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">VOORTGANG INVULLING</span>
                      <span className="text-xs font-bold text-gray-900">
                        {((totalPlanned / totalRequired) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden border border-gray-300">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                        style={{
                          width: `${(totalPlanned / totalRequired) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aanbevelingen */}
            {totalUnfilled > 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-3">
                <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                  💡 Aanbevelingen
                </h3>
                <ul className="space-y-2 text-sm text-blue-900 list-disc list-inside">
                  <li>Controleer de {totalUnfilled} nog in te vullen diensten in het rooster</li>
                  <li>Vul medewerkers in voor de beschikbare slots</li>
                  <li>Zorg dat alle DIO/DDO-regels worden nageleefd</li>
                  <li>Voer de AFL-pijplijn opnieuw uit nadat diensten zijn ingevuld</li>
                  <li>Stijg naar minimaal 90% bezettingsgraad voor optimale planning</li>
                </ul>
              </div>
            )}

            {/* Meta Info */}
            <div className="border-t-2 border-gray-300 pt-6 text-xs text-gray-600 space-y-1">
              <p>🔹 <span className="font-mono">AFL Run ID:</span> <span className="font-mono text-gray-900">{reportData?.afl_run_id || 'N/A'}</span></p>
              <p>🔹 <span className="font-mono">Rooster ID:</span> <span className="font-mono text-gray-900">{reportData?.rosterId || 'N/A'}</span></p>
              <p>🔹 <span>Gegenereerd op:</span> <span className="font-mono text-gray-900">{new Date().toLocaleString('nl-NL')}</span></p>
            </div>
          </div>

          {/* Footer - Sticky */}
          <div className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-50 px-8 py-4 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              📋 Dit rapport is PDF-vriendelijk en kan afgedrukt of opgeslagen worden
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-md"
            >
              ← Terug
            </button>
          </div>
        </div>
      </div>
    </>
  );
}