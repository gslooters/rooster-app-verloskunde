/**
 * DRAAD118A Phase 3: planRooster Handler
 * 
 * Called when user clicks 'Roosterbewerking starten' in Dashboard Rooster Ontwerp.
 * Orchestrates the solver call and routes to appropriate screen based on outcome.
 * 
 * LOGIC:
 * 1. Call POST /api/roster/solve
 * 2. Parse response.solver_result.status
 * 3. If FEASIBLE: store summary → route to /rooster/[id]/feasible-summary
 * 4. If INFEASIBLE: store bottleneck_report → route to /rooster/[id]/bottleneck-analysis
 * 5. If ERROR: show error message
 */

import type { SolverApiResponse } from '@/lib/types/solver';

interface PlanRoosterHandlerConfig {
  rosterId: string;
  onLoading?: (loading: boolean) => void;
  onError?: (error: string) => void;
  router: any; // next/navigation router
}

export async function planRooster(config: PlanRoosterHandlerConfig): Promise<void> {
  const { rosterId, onLoading, onError, router } = config;
  
  try {
    console.log(`[DRAAD118A] planRooster: Starting for roster ${rosterId}`);
    onLoading?.(true);
    
    // DRAAD118A: Call solve endpoint
    const solveUrl = `/api/roster/solve`;
    console.log(`[DRAAD118A] planRooster: Calling ${solveUrl}`);
    
    const solveResponse = await fetch(solveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster_id: rosterId })
    });
    
    if (!solveResponse.ok) {
      const errorData = await solveResponse.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Solver fout: HTTP ${solveResponse.status}`
      );
    }
    
    const apiResponse: SolverApiResponse = await solveResponse.json();
    console.log(`[DRAAD118A] planRooster: Solver response status=${apiResponse.solver_result?.status}`);
    
    if (!apiResponse.success) {
      throw new Error(apiResponse.solver_result?.status || 'Onbekende fout');
    }
    
    const solverStatus = apiResponse.solver_result.status;
    
    // DRAAD118A: Route based on solver status
    if (solverStatus === 'feasible' || solverStatus === 'optimal') {
      // ✅ FEASIBLE PATH
      console.log(`[DRAAD118A] planRooster: FEASIBLE outcome - showing summary`);
      
      // Store summary in sessionStorage (transient data)
      if (apiResponse.solver_result.summary) {
        sessionStorage.setItem(
          `feasible-summary-${rosterId}`,
          JSON.stringify(apiResponse.solver_result.summary)
        );
      }
      
      // Route to summary screen
      router.push(`/rooster/${rosterId}/feasible-summary`);
      
    } else if (solverStatus === 'infeasible') {
      // ⛔ INFEASIBLE PATH
      console.log(`[DRAAD118A] planRooster: INFEASIBLE outcome - showing bottleneck analysis`);
      
      // Store bottleneck report in sessionStorage (transient data)
      if (apiResponse.solver_result.bottleneck_report) {
        sessionStorage.setItem(
          `bottleneck-report-${rosterId}`,
          JSON.stringify(apiResponse.solver_result.bottleneck_report)
        );
      }
      
      // Route to bottleneck analysis screen
      router.push(`/rooster/${rosterId}/bottleneck-analysis`);
      
    } else if (solverStatus === 'timeout') {
      throw new Error(
        'Solver timeout: de berekening duurde te lang. Probeer het later opnieuw of vereenvoudig het probleem.'
      );
      
    } else {
      throw new Error(`Onverwachte solver status: ${solverStatus}`);
    }
    
  } catch (error: any) {
    console.error(`[DRAAD118A] planRooster: Error:`, error);
    
    const errorMessage = error.message || 'Een onbekende fout is opgetreden.';
    onError?.(errorMessage);
    
    // Show user-friendly error
    alert(`Fout bij roostering: ${errorMessage}`);
    
  } finally {
    onLoading?.(false);
  }
}

/**
 * DRAAD118A: Alternative handler for UI integration
 * Use this in React components where you need a direct callback
 */
export function createPlanRoosterHandler(
  rosterId: string,
  router: any,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  return async () => {
    await planRooster({
      rosterId,
      onLoading: setLoading,
      onError: (err) => setError(err),
      router
    });
  };
}
