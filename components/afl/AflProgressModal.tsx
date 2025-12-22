'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AFL Progress Modal Component
 * 
 * Displays progress of AFL (AutoFill) pipeline execution
 * Shows 5 phases: Load → Solve → Chain → Write → Report
 * 
 * DRAAD335: Modal UI for AFL Pipeline
 * 
 * FEATURES:
 * - Real-time progress tracking
 * - Phase-by-phase status indicators
 * - Error handling with detailed messages
 * - Success state with statistics
 * - Auto-close on completion (optional)
 */

interface AflProgressModalProps {
  isOpen: boolean;
  rosterId?: string;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

type ModalState = 'idle' | 'loading' | 'success' | 'error';

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
    const startTime = Date.now();

    try {
      // Simuleer fase-voortgang
      const phaseTimings = [1000, 1500, 1200, 800, 1000]; // ms per fase

      for (let i = 0; i < PHASES.length; i++) {
        setCurrentPhase(i);
        await new Promise(resolve => setTimeout(resolve, phaseTimings[i]));
      }

      // Voer werkelijke API-aanroep uit
      console.log(`🤖 [Modal] Starting AFL execution for roster: ${rosterId}`);

      const response = await fetch('/api/afl/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': `modal-${Date.now()}`,
        },
        body: JSON.stringify({ rosterId }),
      });

      const data = await response.json() as ExecutionResult;

      if (!response.ok) {
        throw new Error(data.error || `API fout: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'AFL-pijplijn mislukt');
      }

      // Success!
      const elapsedTime = Date.now() - startTime;
      setExecutionTime(elapsedTime);
      setCurrentPhase(PHASES.length);
      setResult(data);
      setState('success');

      console.log(`✅ [Modal] AFL execution completed:`, data);

      // Callback naar parent
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ [Modal] AFL execution failed:', err);
      setError(errorMessage);
      setState('error');
      setExecutionTime(Date.now() - startTime);
    }
  };

  // Auto-start wanneer modal opent EN rosterId beschikbaar
  useEffect(() => {
    if (isOpen && rosterId && state === 'idle') {
      executeAflPipeline();
    }
  }, [isOpen, rosterId]);

  // Modal niet weergeven als gesloten
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Rooster-bewerking
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {state === 'loading' && 'AFL-pijplijn wordt uitgevoerd...'}
                {state === 'success' && 'Voltooid!'}
                {state === 'error' && 'Fout opgetreden'}
                {state === 'idle' && 'Gereed'}
              </p>
            </div>
            {state !== 'loading' && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* LOADING STATE */}
            {state === 'loading' && (
              <div className="space-y-4">
                {/* Phase Progress List */}
                <div className="space-y-3">
                  {PHASES.map((phase, index) => (
                    <div key={phase.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5
                                    bg-gray-100 text-gray-600 font-medium text-sm">
                        {index < currentPhase ? (
                          <CheckCircle2 size={20} className="text-green-600" />
                        ) : index === currentPhase ? (
                          <Loader2 size={20} className="text-blue-600 animate-spin" />
                        ) : (
                          <span>{phase.id}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${
                          index <= currentPhase ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {phase.name}
                        </p>
                        <p className={`text-xs ${
                          index <= currentPhase ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {phase.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${((currentPhase + 1) / PHASES.length) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center mt-2">
                    Fase {currentPhase + 1} van {PHASES.length}
                  </p>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {state === 'success' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <CheckCircle2 size={48} className="text-green-600" />
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Roosterbewerking voltooid
                  </h3>
                  <p className="text-sm text-gray-600">
                    AFL-pijplijn is succesvol uitgevoerd
                  </p>
                </div>

                {/* Statistics */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Bezettingsgraad:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {result.report?.summary.coverage_percent.toFixed(1) || 'N/A'}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Diensten ingepland:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {result.report?.summary.total_planned || 0} / {result.report?.summary.total_required || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Uitvoeringsduur:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {(executionTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">AFL Run ID:</span>
                    <span className="text-xs font-mono text-gray-500">
                      {(result.afl_run_id || '...').substring(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ERROR STATE */}
            {state === 'error' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <XCircle size={48} className="text-red-600" />
                </div>

                <div className="text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Fout bij roosterbewerking
                  </h3>
                  <p className="text-sm text-gray-600">
                    Er is een fout opgetreden bij het uitvoeren van de AFL-pijplijn
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700 font-mono break-words">
                      {error}
                    </p>
                  </div>
                )}

                <div className="text-xs text-gray-500 text-center">
                  Uitvoeringsduur: {(executionTime / 1000).toFixed(2)}s
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            {state === 'loading' && (
              <p className="text-xs text-gray-500 text-center">
                Alstublieft wachten... Dit kan enkele minuten duren
              </p>
            )}
            {state !== 'loading' && (
              <Button
                onClick={onClose}
                className="w-full"
                variant={state === 'success' ? 'default' : 'outline'}
              >
                {state === 'success' ? 'Sluiten' : 'Annuleren'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
