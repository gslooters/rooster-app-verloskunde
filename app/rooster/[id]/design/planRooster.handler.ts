/**
 * DRAAD224: planRooster Handler - PLACEHOLDER VERSION
 * 
 * Called when user clicks 'Roosterbewerking starten' in Dashboard Rooster Ontwerp.
 * 
 * CHANGE: Removed GREEDY/Solver2 completely
 * NEW FLOW:
 * 1. Call POST /api/roster/start-bewerking (sets status to in_progress)
 * 2. Show placeholder screen with message
 * 3. Route to /rooster/[id]/bewerking after OK
 * 
 * Previous GREEDY/Solver logic removed in DRAAD224
 */

interface PlanRoosterHandlerConfig {
  rosterId: string;
  onLoading?: (loading: boolean) => void;
  onError?: (error: string) => void;
  router: any; // next/navigation router
}

export async function planRooster(config: PlanRoosterHandlerConfig): Promise<void> {
  const { rosterId, onLoading, onError, router } = config;
  
  try {
    console.log(`[DRAAD224] planRooster: Starting for roster ${rosterId}`);
    onLoading?.(true);
    
    // DRAAD224: Call new placeholder endpoint (no solver, just status update)
    const startUrl = `/api/roster/start-bewerking`;
    console.log(`[DRAAD224] planRooster: Calling ${startUrl} (placeholder - no solver)`);
    
    const response = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster_id: rosterId })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Fout: HTTP ${response.status}`
      );
    }
    
    const result = await response.json();
    console.log(`[DRAAD224] planRooster: Success - roster set to in_progress`);
    
    // DRAAD224: Route to placeholder screen
    // Placeholder screen will show message and OK button
    // After OK, it will route to /rooster/[id]/bewerking
    router.push(`/rooster/${rosterId}/placeholder-bewerking`);
    
  } catch (error: any) {
    console.error(`[DRAAD224] planRooster: Error:`, error);
    
    const errorMessage = error.message || 'Een onbekende fout is opgetreden.';
    onError?.(errorMessage);
    
    // Show user-friendly error
    alert(`Fout bij starten roosterbewerking: ${errorMessage}`);
    
  } finally {
    onLoading?.(false);
  }
}

/**
 * DRAAD224: Alternative handler for UI integration
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
