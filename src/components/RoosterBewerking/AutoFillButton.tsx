/**
 * AUTO-FILL BUTTON COMPONENT - GREEDY INTEGRATION
 * 
 * DRAAD 201: STAP 4 Frontend Integration - GREEDY ONLY
 * DRAAD 221: FIX - Verwijder auto-reload voor rapport display
 * 
 * Integration Point: RoosterBewerking > Preplanning view
 * Endpoint: POST https://greedy-production.up.railway.app/api/greedy/solve
 * 
 * DRAAD 214 FIX STAP 3: Response parsing fix
 * - Extract solver_result from wrapped response
 * - Add type safety with ApiResponse interface
 * - Console logging for debugging
 * 
 * Behavior:
 *   1. Show loading spinner + "Bezig met roostering..."
 *   2. Call GREEDY endpoint POST /api/greedy/solve
 *   3. Display results with coverage
 *   4. Show bottleneck summary
 *   5. Gebruiker kiest zelf wanneer te vernieuwen (GEEN auto-reload!)
 *   6. Error classification: network/server/timeout with Dutch messages
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Environment Configuration
const GREEDY_ENDPOINT = process.env.REACT_APP_GREEDY_ENDPOINT || 
  'https://greedy-production.up.railway.app/api/greedy/solve';
const HEALTH_CHECK_URL = process.env.REACT_APP_GREEDY_HEALTH ||  
  'https://greedy-production.up.railway.app/health';

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

// DRAAD 214 FIX STAP 3: Type safe API response wrapper
interface ApiResponse {
  solver_result: SolveResult;
}

interface ErrorClassification {
  type: 'network' | 'server' | 'timeout' | 'unknown';
  message: string;
  isDangerous: boolean;
}

const classifyError = (err: any, statusCode?: number): ErrorClassification => {
  const errorMessage = err instanceof Error ? err.message : String(err);

  // Network error
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_')) {
    return {
      type: 'network',
      message: 'Netwerkverbinding onderbroken. Controleer uw internetverbinding en probeer opnieuw.',
      isDangerous: false
    };
  }

  // Timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return {
      type: 'timeout',
      message: 'GREEDY service reageert niet (timeout). Probeer over enkele momenten opnieuw.',
      isDangerous: false
    };
  }

  // Server errors
  if (statusCode && statusCode >= 500) {
    return {
      type: 'server',
      message: `GREEDY service error (${statusCode}). Het probleem is gemeld. Probeer later opnieuw.`,
      isDangerous: false
    };
  }

  // Client errors
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return {
      type: 'server',
      message: `Request error (${statusCode}). Controleer uw gegevens en probeer opnieuw.`,
      isDangerous: false
    };
  }

  return {
    type: 'unknown',
    message: 'Onbekende fout. Controleer console en probeer opnieuw.',
    isDangerous: true
  };
};

const healthCheck = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const AutoFillButton: React.FC<AutoFillButtonProps> = ({
  rosterId,
  onSolveComplete,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<ErrorClassification | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isGreedyHealthy, setIsGreedyHealthy] = useState<boolean | null>(null);

  // Health check on mount
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await healthCheck();
      setIsGreedyHealthy(healthy);
      if (!healthy) {
        console.warn('⚠️ GREEDY service might be offline, but continuing with button...');
      }
    };
    checkHealth();
  }, []);

  const handleAutoFill = async () => {
    if (!rosterId) {
      setError({
        type: 'unknown',
        message: 'Geen rooster geselecteerd',
        isDangerous: false
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Setup timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(GREEDY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roster_id: rosterId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        } catch {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      // DRAAD 214 FIX STAP 3: Extract solver_result from wrapped response
      const responseData: ApiResponse = await response.json();
      console.log('[AutoFillButton] Raw response:', responseData);
      
      // Validate response structure
      if (!responseData.solver_result) {
        throw new Error("Invalid response format: missing solver_result");
      }
      
      const solveResult: SolveResult = responseData.solver_result;
      console.log('[AutoFillButton] Extracted solver_result:', solveResult);
      
      setResult(solveResult);

      if (onSolveComplete) {
        onSolveComplete(solveResult);
      }

      // DRAAD 221 FIX: Auto-reload VERWIJDERD!
      // Gebruiker kan nu rapport lezen en zelf beslissen wanneer te vernieuwen
      // via de "🔄 Vernieuwen" knop hieronder

    } catch (err) {
      const statusCode = (err as any)?.status;
      const classification = classifyError(err, statusCode);
      setError(classification);
      console.error('🔴 GREEDY Solver Error:', {
        classification,
        fullError: err
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
        <div className="animate-spin text-xl">⚙️</div>
        <div>
          <div className="text-sm font-semibold text-blue-700">Bezig met roostering...</div>
          <div className="text-xs text-blue-600">GREEDY engine draait</div>
        </div>
      </div>
    );
  }

  // Success state
  if (result && result.status === 'SUCCESS') {
    return (
      <div className="space-y-3">
        {/* Success banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 flex items-center gap-2">
                <span>✅ Roostering voltooid!</span>
              </h3>
              <p className="text-sm text-green-700 mt-2">{result.message}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-700">{result.coverage}%</div>
              <div className="text-xs text-green-600 font-medium">coverage</div>
            </div>
          </div>
        </div>

        {/* Coverage stats */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Toegewezen diensten:</span>
            <span className="font-mono font-semibold text-blue-700">{result.assignments_created}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-700">Oplossingsduur:</span>
            <span className="font-mono text-blue-700">{result.solve_time}s</span>
          </div>
        </div>

        {/* Details */}
        {result.bottlenecks > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full text-left flex items-center justify-between py-2"
            >
              <span className="text-sm font-semibold text-yellow-800">⚠️ {result.bottlenecks} gaten gedetecteerd</span>
              <span className="text-yellow-600">{showDetails ? '▼' : '▶'}</span>
            </button>

            {showDetails && result.details?.bottleneck_details && (
              <div className="mt-2 space-y-1 text-xs text-yellow-700 border-t border-yellow-200 pt-2">
                {result.details.bottleneck_details.slice(0, 5).map((bn, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{bn.date} {bn.dagdeel}:</span>
                    <span className="font-mono">{bn.shortage}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setResult(null);
              setShowDetails(false);
            }}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Terug
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
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
      <div className={`rounded-lg p-4 border ${
        error.isDangerous
          ? 'bg-red-50 border-red-200'
          : 'bg-orange-50 border-orange-200'
      }`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">{error.isDangerous ? '❌' : '⚠️'}</div>
          <div className="flex-1">
            <h3 className={`font-semibold ${
              error.isDangerous ? 'text-red-800' : 'text-orange-800'
            }`}>
              {error.type === 'network' && 'Verbindingsfout'}
              {error.type === 'timeout' && 'Timeout'}
              {error.type === 'server' && 'Server error'}
              {error.type === 'unknown' && 'Onbekende fout'}
            </h3>
            <p className={`text-sm mt-1 ${
              error.isDangerous ? 'text-red-700' : 'text-orange-700'
            }`}>
              {error.message}
            </p>
          </div>
          <button
            onClick={() => setError(null)}
            className={`text-lg ${
              error.isDangerous
                ? 'text-red-600 hover:text-red-800'
                : 'text-orange-600 hover:text-orange-800'
            }`}
          >
            ✕
          </button>
        </div>
        <button
          onClick={handleAutoFill}
          className={`mt-3 w-full px-3 py-2 text-sm font-medium text-white rounded-lg transition ${
            error.isDangerous
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          🔄 Opnieuw proberen
        </button>
      </div>
    );
  }

  // Health check warning
  if (isGreedyHealthy === false) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={handleAutoFill}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          <span className="text-xl">🤖</span>
          <span>🚀 Automatisch Invullen (GREEDY)</span>
        </button>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-center">
          ⚠️ GREEDY service: Offline control. Button still available.
        </div>
      </div>
    );
  }

  // Default state - show button
  return (
    <button
      onClick={handleAutoFill}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
      title="Start GREEDY solver voor automatische roostering"
    >
      <span className="text-xl">🚀</span>
      <span>Automatisch Invullen (GREEDY)</span>
    </button>
  );
};

export default AutoFillButton;