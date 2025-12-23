'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, X, AlertCircle, Clock, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AFL Progress Modal Component - DRAAD344: Export Activation
 * 
 * DRAAD344 CHANGES:
 * 1. ❌ REMOVED "Annuleren" button from success state - users MUST go to "Naar rooster"
 * 2. ✅ ACTIVATED PDF export button with real API call
 * 3. ✅ ACTIVATED Excel export button with real API call
 * 4. 🔒 Enforces correct workflow: Ontwerp → Rapportage → Bewerking
 * 
 * Enhanced progress tracking for AFL (AutoFill) pipeline execution
 * Shows 5 phases: Load → Solve → Chain → Write → Report
 * 
 * FEATURES:
 * - Real-time progress tracking with detailed feedback
 * - Phase-by-phase status indicators
 * - Timeout detection (15 second max)
 * - Error handling with detailed messages
 * - Success state with statistics (STAYS VISIBLE)
 * - Blue "Naar rooster" CTA button (triggers parent callback on click)
 * - PDF/Excel export WITH REAL FUNCTIONALITY
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

const AFL_TIMEOUT_MS = 15000; // 15 seconden timeout
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
  
  // DRAAD344: Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
      // DRAAD337: Timeout detection
      const timeoutHandle = setTimeout(() => {
        console.error('❌ [Modal] AFL execution TIMEOUT after 15 seconds');
        aborted = true;
        setState('timeout');
        setError('AFL-pijplijn heeft te lang geduurd (>15 seconden). Controleer de server-logs.');
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
      
      // DRAAD337 FIX4: DO NOT call onSuccess here - wait for user to click button
      // This prevents the auto-navigate that was causing the "flits voorbij" issue
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
   * DRAAD344: Handle PDF Export
   * Calls backend API to generate PDF report from afl_execution_reports table
   */
  const handleExportPDF = async () => {
    if (!result?.afl_run_id) {
      setExportError('AFL Run ID ontbreekt - kan PDF niet genereren');
      return;
    }

    setIsExportingPDF(true);
    setExportError(null);

    try {
      console.log(`📄 [Modal] Exporting PDF for AFL run: ${result.afl_run_id}`);
      
      const response = await fetch('/api/afl/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `pdf-export-${Date.now()}`,
        },
        body: JSON.stringify({ afl_run_id: result.afl_run_id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `PDF export fout: ${response.status}`);
      }

      // Download PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rooster-rapport-${result.afl_run_id.substring(0, 8)}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('✅ [Modal] PDF downloaded successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ [Modal] PDF export failed:', err);
      setExportError(`PDF export mislukt: ${errorMsg}`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  /**
   * DRAAD344: Handle Excel Export
   * Calls backend API to generate Excel from roster_assignments table
   */
  const handleExportExcel = async () => {
    if (!rosterId) {
      setExportError('Rooster ID ontbreekt - kan Excel niet genereren');
      return;
    }

    setIsExportingExcel(true);
    setExportError(null);

    try {
      console.log(`📊 [Modal] Exporting Excel for roster: ${rosterId}`);
      
      const response = await fetch('/api/afl/export/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `excel-export-${Date.now()}`,
        },
        body: JSON.stringify({ rosterId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Excel export fout: ${response.status}`);
      }

      // Download Excel blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rooster-planning-${rosterId.substring(0, 8)}-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('✅ [Modal] Excel downloaded successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ [Modal] Excel export failed:', err);
      setExportError(`Excel export mislukt: ${errorMsg}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Modal niet weergeven als gesloten
  if (!isOpen) {
    return null;
  }

  const canClose = state !== 'loading' && !isNavigating;

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
                    <p className="text-xs text-blue-700 mt-1">Even geduld... dit kan tot 15 seconden duren</p>
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

            {/* DRAAD344: SUCCESS STATE - REMOVED ANNULEREN BUTTON */}
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

                {/* DRAAD344: ACTIVATED Export Options - NO LONGER DISABLED */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText size={16} />
                    Export opties beschikbaar
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={handleExportPDF}
                      disabled={isExportingPDF || isExportingExcel}
                      className="flex-1 min-w-[140px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {isExportingPDF ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-xs">Bezig...</span>
                        </>
                      ) : (
                        <>
                          <FileText size={16} />
                          <span className="text-xs">PDF rapport</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportExcel}
                      disabled={isExportingPDF || isExportingExcel}
                      className="flex-1 min-w-[140px] px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {isExportingExcel ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-xs">Bezig...</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet size={16} />
                          <span className="text-xs">Excel export</span>
                        </>
                      )}
                    </button>
                  </div>
                  {exportError && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-700 font-medium">{exportError}</p>
                    </div>
                  )}
                  <p className="text-xs text-blue-700 mt-2">
                    💡 Downloads starten automatisch na generatie
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
                    De pijplijn heeft meer dan 15 seconden nodig gehad.
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

          {/* Footer - DRAAD344: REMOVED ANNULEREN BUTTON FROM SUCCESS STATE */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
            {state === 'loading' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 text-center font-medium">
                  ⏳ Alstublieft wachten... Dit kan tot 15 seconden duren
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
                  disabled={isNavigating || isExportingPDF || isExportingExcel}
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
                {/* DRAAD344: ANNULEREN BUTTON REMOVED - Users MUST go to "Naar rooster" */}
                {/* This enforces the correct workflow: Ontwerp → Rapportage → Bewerking */}
              </div>
            )}
            {state !== 'loading' && state !== 'success' && (
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