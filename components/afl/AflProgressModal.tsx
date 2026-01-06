'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, X, AlertCircle, Clock, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePDFDownload } from '@/src/components/RoosterBewerking/PDFDownloadHandler';

/**
 * AFL Progress Modal Component - DRAAD406: PDF Export Activation + Hook Fix
 * 
 * DRAAD406 FIX (Huidige draad):
 * 1. ✅ FIXED: React Error #321 - Hook verplaatst naar hoogste niveau
 * 2. ✅ MOVED: usePDFDownload hook aanroep (was in event handler → nu op component level)
 * 3. ✅ REFACTORED: pdfHookError synchroniseert met exportError state
 * 4. ✅ VERIFIED: React Rules of Hooks gerespecteerd
 * 5. ✅ TESTED: Cache-bust headers werkend voor Railway
 * 
 * DRAAD406 CHANGES (vorige implementatie):
 * 1. ✅ ADDED: import { usePDFDownload } hook
 * 2. ✅ FIXED: Removed hardcoded disabled={true} from PDF button
 * 3. ✅ IMPLEMENTED: Real PDF export handler with API call
 * 4. ✅ ADDED: Loading state, error handling, success feedback
 * 5. ✅ ACTIVATED: PDF export button with full functionality
 * 
 * DRAAD404 CHANGES:
 * 1. ✅ INCREASED client-side timeout from 15s to 60s
 * 2. ✅ Updated phase feedback messages to reflect 60s max
 * 3. ✅ Matches API route timeout (maxDuration = 60)
 * 4. 🔒 Prevents modal timeout while API is still processing
 * 
 * Previous DRAAD346 CHANGES:
 * 1. ✅ FIXED close button (X) - only visible on ERROR/TIMEOUT, not on SUCCESS
 * 2. ✅ Excel export still disabled (grayed out) - awaiting backend implementation
 * 3. 🔒 Enforces correct workflow: Ontwerp → Rapportage → Bewerking
 * 4. 💡 Users MUST click "Naar rooster" button to proceed from success state
 * 
 * Enhanced progress tracking for AFL (AutoFill) pipeline execution
 * Shows 5 phases: Load → Solve → Chain → Write → Report
 * 
 * FEATURES:
 * - Real-time progress tracking with detailed feedback
 * - Phase-by-phase status indicators
 * - Timeout detection (60 second max)
 * - Error handling with detailed messages
 * - Success state with statistics (STAYS VISIBLE)
 * - Blue "Naar rooster" CTA button (triggers parent callback on click)
 * - PDF export FULLY FUNCTIONAL with download (FIXED - Hook now at correct level)
 * - Excel export still disabled (pending backend)
 * - Loading indicators and error feedback
 * - Prevents accidental closure during processing
 * - Cache-busting headers (Date.now() + random)
 * - Modal stays visible until user confirms
 */

interface AflProgressModalProps {
  isOpen: boolean;
  rosterId?: string;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

type ModalState = 'idle' | 'loading' | 'success' | 'error' | 'timeout';

interface ExecutionResult {
  success: boolean;
  afl_run_id?: string;
  rosterId?: string;
  execution_time_ms?: number;
  report?: {
    summary: {
      coverage_percent: number;
      total_planned: number;
      total_required: number;
    };
  };
  error?: string;
  message?: string;
}

const PHASES = [
  { id: 1, name: 'Data laden', description: 'Rooster, medewerkers, diensten' },
  { id: 2, name: 'Plannen', description: 'Diensten toewijzen aan slots' },
  { id: 3, name: 'Validatie', description: 'DIO/DDO-controles uitvoeren' },
  { id: 4, name: 'Database', description: 'Resultaten opslaan' },
  { id: 5, name: 'Rapport', description: 'Rapporten genereren' }
];

// ✅ DRAAD404: INCREASED from 15000ms to 60000ms (60 seconds)
// API route now has maxDuration = 60, so client should wait max 60s
const AFL_TIMEOUT_MS = 60000; // 60 seconden timeout
const PHASE_TIMEOUT_MS = 5000; // Max 5 sec per phase

export function AflProgressModal({
  isOpen,
  rosterId,
  onClose,
  onSuccess
}: AflProgressModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [currentPhase, setCurrentPhase] = useState<number>(0);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // DRAAD406: Export states - PDF now active, Excel still disabled
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ✅ DRAAD406 FIX: Hook op HOOGSTE NIVEAU van component
  // Hook wordt aangroepen op component render, NIET in event handler
  // Dit voldoet aan React Rules of Hooks
  const {
    downloadPDF,
    isLoading: isPDFHookLoading,
    error: pdfHookError
  } = usePDFDownload(result?.afl_run_id || '');

  // ✅ DRAAD406: Synchroniseer hook error naar component state
  // useEffect zorgt ervoor dat pdfHookError automatisch in exportError terecht komt
  useEffect(() => {
    if (pdfHookError) {
      setExportError(pdfHookError);
      console.warn('[Modal] PDF hook error detected:', pdfHookError);
    }
  }, [pdfHookError]);

  // Functie om AFL pipeline uit te voeren
  const executeAflPipeline = async () => {
    if (!rosterId) {
      setError('Rooster-ID is vereist');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);
    setCurrentPhase(0);
    setExecutionTime(0);
    setStatusMessage('AFL-pijplijn wordt gestart...');
    setAttemptCount(0);
    const startTime = Date.now();
    let aborted = false;

    try {
      // ✅ DRAAD404: Timeout detection - 60 seconds
      const timeoutHandle = setTimeout(() => {
        console.error('❌ [Modal] AFL execution TIMEOUT after 60 seconds');
        aborted = true;
        setState('timeout');
        setError('AFL-pijplijn heeft te lang geduurd (>60 seconden). Controleer de server-logs op Railway.');
        setExecutionTime(Date.now() - startTime);
      }, AFL_TIMEOUT_MS);

      // DRAAD337: Simulate phase progression with detailed messages
      const phaseMessages = [
        'Rooster gegevens laden uit database...',
        'Optimalisatie-algoritme starten...',
        'DIO/DDO-blokkeringsregels controleren...',
        'Resultaten naar database schrijven...',
        'Rapport genereren en opslaan...'
      ];

      const phaseTimings = [1000, 1500, 1200, 800, 1000]; // ms per fase (UI feedback)

      for (let i = 0; i < PHASES.length && !aborted; i++) {
        setCurrentPhase(i);
        setStatusMessage(phaseMessages[i]);
        console.log(`[Modal] Phase ${i + 1}/${PHASES.length}: ${phaseMessages[i]}`);
        await new Promise(resolve => setTimeout(resolve, phaseTimings[i]));
      }

      if (aborted) {
        clearTimeout(timeoutHandle);
        return;
      }

      // DRAAD337: Call actual API with cache-busting headers
      console.log(`🤖 [Modal] Calling AFL API for roster: ${rosterId}`);
      setStatusMessage('AFL-API wordt aangeroepen...');

      const cacheBustToken = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const response = await fetch('/api/afl/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `modal-${Date.now()}`,
          'X-Cache-Bust': cacheBustToken,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
        body: JSON.stringify({ rosterId }),
      });

      if (aborted) {
        clearTimeout(timeoutHandle);
        return;
      }

      const data = await response.json() as ExecutionResult;

      if (!response.ok) {
        clearTimeout(timeoutHandle);
        const errorMsg = data.error || `API fout: ${response.status} ${response.statusText}`;
        console.error('❌ [Modal] API returned error:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!data.success) {
        clearTimeout(timeoutHandle);
        const errorMsg = data.error || 'AFL-pijplijn mislukt (success=false)';
        console.error('❌ [Modal] Pipeline returned success=false:', errorMsg);
        throw new Error(errorMsg);
      }

      // Success! Set state and STAY OPEN for user to read report
      clearTimeout(timeoutHandle);
      const elapsedTime = Date.now() - startTime;
      setExecutionTime(elapsedTime);
      setCurrentPhase(PHASES.length);
      setResult(data);
      setState('success');
      setStatusMessage('AFL-pijplijn succesvol voltooid!');

      console.log(`✅ [Modal] AFL execution completed in ${elapsedTime}ms - WAITING FOR USER ACTION`);
      console.log(`✅ [Modal] User must click 'Naar rooster' button to proceed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ [Modal] AFL execution failed:', err);
      setError(errorMessage);
      setState('error');
      setStatusMessage('Fout opgetreden - controleer details hieronder');
      setExecutionTime(Date.now() - startTime);
    }
  };

  // DRAAD337: Auto-start when modal opens
  useEffect(() => {
    if (isOpen && rosterId && state === 'idle') {
      console.log('[Modal] Modal opened, starting AFL execution...');
      executeAflPipeline();
    }
  }, [isOpen, rosterId]);

  /**
   * DRAAD337 FIX4: Handle "Naar rooster" button click
   * Only triggers parent callback when user explicitly clicks button
   */
  const handleNavigateToRoster = () => {
    if (state !== 'success' || !result) return;
    
    console.log('[Modal] User clicked "Naar rooster" button');
    setIsNavigating(true);
    
    // Call parent callback to navigate
    if (onSuccess) {
      onSuccess(result);
    }
  };

  /**
   * DRAAD406 FIX: PDF export handler - OPTIE A IMPLEMENTATIE
   * Hook (usePDFDownload) zit nu op hoogste niveau van component
   * Event handler roept alleen de downloadPDF() functie aan
   * Dit voldoet aan React Rules of Hooks
   */
  const handleExportPDF = async () => {
    if (!result?.afl_run_id) {
      setExportError('AFL Run ID niet beschikbaar voor PDF export');
      console.error('❌ [Modal] AFL Run ID missing:', result);
      return;
    }

    console.log(`📥 [Modal] Starting PDF download for afl_run_id: ${result.afl_run_id}`);
    setExportError(null);
    setIsExportingPDF(true);

    try {
      // ✅ FIXED: downloadPDF is nu beschikbaar omdat hook op hoogste niveau is
      // Event handler roept alleen de functie aan, geen hook-aanroep hier
      await downloadPDF();
      console.log('✅ [Modal] PDF download completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'PDF download mislukt';
      console.error('❌ [Modal] PDF download failed:', err);
      setExportError(errorMsg);
    } finally {
      setIsExportingPDF(false);
    }
  };

  /**
   * DRAAD406: Excel export still disabled
   * Placeholder for future implementation
   */
  const handleExportExcel = () => {
    console.log('⚠️ [Modal] Excel export temporarily disabled');
    setExportError('Excel export wordt later geactiveerd');
  };

  // Modal niet weergeven als gesloten
  if (!isOpen) {
    return null;
  }

  // DRAAD346: Close button only visible on ERROR/TIMEOUT, not on SUCCESS
  const canClose = (state === 'error' || state === 'timeout') && !isNavigating;

  return (
    <>
      {/* DRAAD337: Overlay - darker during processing */}
      <div className={`fixed inset-0 z-40 transition-opacity ${
        state === 'loading' ? 'bg-black/60' : 'bg-black/50'
      }`} />

      {/* DRAAD337: Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖 Rooster-bewerking</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1 font-medium">
                {state === 'loading' && '⏳ AFL-pijplijn wordt uitgevoerd...'}
                {state === 'success' && '✅ Voltooid! Rapport gegenereerd'}
                {state === 'error' && '❌ Fout opgetreden'}
                {state === 'timeout' && '⏱️ Timeout'}
                {state === 'idle' && '⏷️ Gereed'}
              </p>
            </div>
            {/* DRAAD346: Close button only on ERROR/TIMEOUT */}
            {canClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            )}
            {state === 'loading' && (
              <div className="w-8 h-8 rounded-full border-3 border-blue-200 border-t-blue-600 animate-spin" />
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* DRAAD337: LOADING STATE - Enhanced with timeout info */}
            {state === 'loading' && (
              <div className="space-y-4">
                {/* Status Message */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{statusMessage}</p>
                    <p className="text-xs text-blue-700 mt-1">Even geduld... dit kan tot 60 seconden duren</p>
                  </div>
                </div>

                {/* Phase Progress List */}
                <div className="space-y-3">
                  {PHASES.map((phase, index) => {
                    const isDone = index < currentPhase;
                    const isActive = index === currentPhase;
                    const isPending = index > currentPhase;

                    return (
                      <div key={phase.id} className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 font-medium text-sm transition-all ${
                          isDone ? 'bg-green-100 text-green-700' :
                          isActive ? 'bg-blue-600 text-white animate-pulse' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {isDone ? (
                            <CheckCircle2 size={20} />
                          ) : isActive ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <span>{phase.id}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium text-sm transition-colors ${
                            isDone || isActive ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {phase.name}
                          </p>
                          <p className={`text-xs transition-colors ${
                            isDone || isActive ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {phase.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">VOORTGANG</span>
                    <span className="text-xs font-mono text-blue-600">
                      {((currentPhase + 1) / PHASES.length * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-300 shadow-sm"
                      style={{
                        width: `${((currentPhase + 1) / PHASES.length) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                    Fase {currentPhase + 1} van {PHASES.length}
                  </p>
                </div>
              </div>
            )}

            {/* DRAAD406: SUCCESS STATE - PDF Export ACTIVATED */}
            {state === 'success' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="text-5xl animate-bounce">✅</div>
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    Roosterbewerking voltooid!
                  </h3>
                  <p className="text-sm text-gray-600">
                    AFL-pijplijn is succesvol uitgevoerd in {(executionTime / 1000).toFixed(2)}s
                  </p>
                </div>

                {/* DRAAD337 FIX4: Expanded Statistics Section */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3 border border-green-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded p-3 border border-green-100">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Bezettingsgraad</p>
                      <p className="text-2xl font-bold text-green-700">
                        {result.report?.summary.coverage_percent.toFixed(1) || 'N/A'}%
                      </p>
                    </div>
                    <div className="bg-white rounded p-3 border border-green-100">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Uitvoeringsduur</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {(executionTime / 1000).toFixed(2)}s
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-green-200 pt-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-700">Diensten ingepland:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {result.report?.summary.total_planned || 0} / {result.report?.summary.total_required || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-700">AFL Run ID:</span>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-300">
                        {(result.afl_run_id || '...').substring(0, 12)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Success Message */}
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-sm text-green-800 font-medium">
                  ✓ Alle diensten zijn succesvol verwerkt door de AFL-pijplijn. 
                  Klik "Naar rooster" hieronder om de resultaten te bekijken.
                </div>

                {/* DRAAD406: Export buttons - PDF ACTIVATED, Excel disabled */}
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-gray-500" />
                    Export opties
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={handleExportPDF}
                      disabled={isExportingPDF || isPDFHookLoading}
                      className={`flex-1 min-w-[140px] px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                        isExportingPDF || isPDFHookLoading
                          ? 'bg-blue-400 cursor-wait text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                      title="Download PDF rapport"
                    >
                      {isExportingPDF || isPDFHookLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-xs">Bezig...</span>
                        </>
                      ) : (
                        <>
                          <FileText size={16} />
                          <span className="text-xs">📥 PDF rapport</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportExcel}
                      disabled={true}
                      className="flex-1 min-w-[140px] px-4 py-2 bg-gray-300 cursor-not-allowed text-gray-500 rounded-lg font-medium flex items-center justify-center gap-2"
                      title="Excel export - wordt later geactiveerd"
                    >
                      <FileSpreadsheet size={16} />
                      <span className="text-xs">Excel (uit)</span>
                    </button>
                  </div>
                  {exportError && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                      <p className="text-xs text-yellow-800 font-medium">⚠️ {exportError}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    ✅ PDF export is actief | Excel export wordt later geactiveerd
                  </p>
                </div>
              </div>
            )}

            {/* DRAAD337: ERROR STATE */}
            {state === 'error' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <XCircle size={48} className="text-red-600" />
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    Fout bij roosterbewerking
                  </h3>
                  <p className="text-sm text-gray-600">
                    Er is een fout opgetreden bij het uitvoeren van de AFL-pijplijn
                  </p>
                </div>

                {/* DRAAD337: Error Message with details */}
                {error && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-700 font-mono break-words">
                        {error}
                      </div>
                    </div>
                    <p className="text-xs text-red-600 pl-6">
                      💡 Tip: Controleer de server logs op Railway voor meer details.
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center bg-gray-50 rounded p-2">
                  ⏱️ Uitvoeringsduur: {(executionTime / 1000).toFixed(2)}s (Fase {currentPhase + 1}/{PHASES.length})
                </div>
              </div>
            )}

            {/* DRAAD337: TIMEOUT STATE */}
            {state === 'timeout' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Clock size={48} className="text-orange-600" />
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    ⏱️ Timeout - AFL-pijplijn te lang aan het uitvoeren
                  </h3>
                  <p className="text-sm text-gray-600">
                    De pijplijn heeft meer dan 60 seconden nodig gehad.
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                  <p className="text-sm text-orange-800 font-medium mb-2">Mogelijke oorzaken:</p>
                  <ul className="text-xs text-orange-700 space-y-1 list-disc list-inside">
                    <li>Database-verbinding is traag</li>
                    <li>Server heeft veel load</li>
                    <li>Roster bevat te veel gegevens</li>
                  </ul>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-700 font-mono">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - DRAAD346: No close button on SUCCESS */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
            {state === 'loading' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 text-center font-medium">
                  ⏳ Alstublieft wachten... Dit kan tot 60 seconden duren
                </p>
                <p className="text-xs text-gray-500 text-center">
                  Sluit dit venster niet - dit onderbreekt de pijplijn
                </p>
              </div>
            )}
            {state === 'success' && (
              <div className="space-y-2">
                <button
                  onClick={handleNavigateToRoster}
                  disabled={isNavigating}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-colors shadow-md"
                >
                  {isNavigating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Bezig met laden...
                    </span>
                  ) : (
                    '→ Naar rooster'
                  )}
                </button>
                {/* DRAAD346: No "Annuleren" button - users MUST proceed to Bewerking */}
              </div>
            )}
            {(state === 'error' || state === 'timeout') && (
              <button
                onClick={onClose}
                className="w-full font-medium px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                ✓ Sluiten
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}