"""
AUTO-FILL BUTTON COMPONENT

DRAD 183: "🤖 Automatisch Invullen" button for GREEDY solver

Integration Point: RoosterBewerking > Preplanning view
Trigger: POST /api/roster/solve
Behavior:
  1. Show loading spinner
  2. Call solver API
  3. Display results with coverage
  4. Show bottleneck summary
  5. Auto-refresh rooster
"""

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface AutoFillButtonProps {
  rosterId: string;
  onSolveComplete?: (result: SolveResult) => void;
  disabled?: boolean;
}

interface SolveResult {
  status: string;
  coverage: number;
  assignments_created: number;
  bottlenecks: number;
  solve_time: number;
  message: string;
  details?: {
    pre_planned: number;
    greedy_assigned: number;
    bottleneck_details: Array<{
      date: string;
      dagdeel: string;
      service_id: string;
      shortage: number;
      suggestion?: string;
    }>;
  };
}

const AutoFillButton: React.FC<AutoFillButtonProps> = ({
  rosterId,
  onSolveComplete,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleAutoFill = async () => {
    if (!rosterId) {
      setError('Geen rooster geselecteerd');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call solver API
      const response = await fetch('/api/roster/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roster_id: rosterId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Solver failed');
      }

      const solveResult: SolveResult = await response.json();
      setResult(solveResult);

      // Callback to parent
      if (onSolveComplete) {
        onSolveComplete(solveResult);
      }

      // Auto-refresh rooster display
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Solver error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="animate-spin">
          ⚙️
        </div>
        <span className="text-sm font-medium text-blue-700">
          GREEDY draait...
        </span>
      </div>
    );
  }

  // Success state
  if (result && result.status === 'SUCCESS') {
    return (
      <div className="space-y-3">
        {/* Success banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 flex items-center gap-2">
                <span>✅ Rooster voltooid!</span>
              </h3>
              <p className="text-sm text-green-700 mt-1">
                {result.message}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-700">
                {result.coverage}%
              </div>
              <div className="text-xs text-green-600">
                coverage
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-gray-50 rounded-lg p-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-left flex items-center justify-between py-2"
          >
            <span className="text-sm font-medium text-gray-700">
              Details
            </span>
            <span className="text-gray-400">
              {showDetails ? '▼' : '▶'}
            </span>
          </button>

          {showDetails && result.details && (
            <div className="mt-2 space-y-2 text-sm text-gray-600 border-t pt-2">
              <div className="flex justify-between">
                <span>Pre-planned:</span>
                <span className="font-mono">{result.details.pre_planned}</span>
              </div>
              <div className="flex justify-between">
                <span>GREEDY assigned:</span>
                <span className="font-mono">{result.details.greedy_assigned}</span>
              </div>
              <div className="flex justify-between">
                <span>Solve time:</span>
                <span className="font-mono">{result.solve_time}s</span>
              </div>

              {/* Bottlenecks */}
              {result.bottlenecks > 0 && (
                <div className="mt-3 pt-2 border-t">
                  <div className="font-medium text-gray-700 mb-1">
                    ⚠️ Gaps ({result.bottlenecks}):
                  </div>
                  <div className="space-y-1 ml-2">
                    {result.details.bottleneck_details?.slice(0, 3).map((bn, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-gray-600">
                          {bn.date} {bn.dagdeel}: {bn.shortage} × {bn.service_id}
                        </div>
                        {bn.suggestion && (
                          <div className="text-gray-500 italic">
                            → {bn.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-between">
          <button
            onClick={() => {
              setResult(null);
              setShowDetails(false);
            }}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Terug
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            🔄 Vernieuwen
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-xl">❌</div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">Fout bij oplossen</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
        <button
          onClick={handleAutoFill}
          className="mt-3 w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          Opnieuw proberen
        </button>
      </div>
    );
  }

  // Default state - show button
  return (
    <button
      onClick={handleAutoFill}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
    >
      <span className="text-xl">🤖</span>
      <span>Automatisch Invullen (GREEDY)</span>
    </button>
  );
};

export default AutoFillButton;
