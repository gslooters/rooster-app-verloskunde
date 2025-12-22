'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, X, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AFL Progress Modal Component - DRAAD337: FIX 3
 * 
 * Enhanced progress tracking for AFL (AutoFill) pipeline execution
 * Shows 5 phases: Load → Solve → Chain → Write → Report
 * 
 * FEATURES:
 * - Real-time progress tracking with detailed feedback
 * - Phase-by-phase status indicators
 * - Timeout detection (15 second max)
 * - Error handling with detailed messages
 * - Success state with statistics
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

      // Success!
      clearTimeout(timeoutHandle);
      const elapsedTime = Date.now() - startTime;
      setExecutionTime(elapsedTime);
      setCurrentPhase(PHASES.length);
      setResult(data);
      setState('success');
      setStatusMessage('AFL-pijplijn succesvol voltooid!');

      console.log(`✅ [Modal] AFL execution completed in ${elapsedTime}ms:`, data);

      // DRAAD337: Call callback to parent
      if (onSuccess) {
        onSuccess(data);
      }
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

  // Modal niet weergeven als gesloten
  if (!isOpen) {
    return null;
  }

  const canClose = state !== 'loading';

  return (
    <>
      {/* DRAAD337: Overlay - darker during processing */}
      <div className={`fixed inset-0 z-40 transition-opacity ${
        state === 'loading' ? 'bg-black/60' : 'bg-black/50'
      }`} />

      {/* DRAAD337: Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖 Rooster-bewerking</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1 font-medium">
                {state === 'loading' && '⏳ AFL-pijplijn wordt uitgevoerd...'}
                {state === 'success' && '✅ Voltooid!'}
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

            {/* DRAAD337: SUCCESS STATE */}
            {state === 'success' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="text-5xl">✅</div>
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    Roosterbewerking voltooid
                  </h3>
                  <p className="text-sm text-gray-600">
                    AFL-pijplijn is succesvol uitgevoerd in {(executionTime / 1000).toFixed(2)}s
                  </p>
                </div>

                {/* DRAAD337: Statistics */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-3 border border-green-200">
                  <div className="flex justify-between items-center py-2 border-b border-green-200">
                    <span className="text-sm font-medium text-gray-700">Bezettingsgraad:</span>
                    <span className="text-lg font-bold text-green-700">
                      {result.report?.summary.coverage_percent.toFixed(1) || 'N/A'}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-green-200">
                    <span className="text-sm font-medium text-gray-700">Diensten ingepland:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {result.report?.summary.total_planned || 0} / {result.report?.summary.total_required || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-green-200">
                    <span className="text-sm font-medium text-gray-700">Uitvoeringsduur:</span>
                    <span className="text-sm font-mono font-semibold text-gray-900">
                      {(executionTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-gray-700">AFL Run ID:</span>
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded text-gray-600 border border-gray-200">
                      {(result.afl_run_id || '...').substring(0, 12)}...
                    </span>
                  </div>
                </div>

                {/* Success Message */}
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-sm text-green-800 font-medium">
                  ✓ Alle diensten zijn succesvol verwerkt door de AFL-pijplijn.
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
                      💡 Tip: Controleer de Rails logs op `/app/logs/production.log` voor meer details.
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

          {/* Footer - DRAAD337: Enhanced with state-aware messaging */}
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
            {state !== 'loading' && (
              <Button
                onClick={onClose}
                className={`w-full font-medium ${
                  state === 'success'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {state === 'success' ? '✓ Sluiten en verder' : '✓ Annuleren'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
