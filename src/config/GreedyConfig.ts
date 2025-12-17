/**
 * GREEDY Configuration
 * 
 * DRAAD 201: STAP 4 Environment variables & health check configuration
 * 
 * Endpoints:
 *   - GREEDY_ENDPOINT: https://greedy-production.up.railway.app/api/greedy/solve
 *   - GREEDY_HEALTH: https://greedy-production.up.railway.app/health
 * 
 * Environment Variables:
 *   REACT_APP_GREEDY_ENDPOINT  - POST endpoint for solve requests
 *   REACT_APP_GREEDY_HEALTH    - GET endpoint for health check
 *   REACT_APP_GREEDY_TIMEOUT   - Timeout in ms (default: 30000)
 */

export const GREEDY_CONFIG = {
  // Production endpoints
  endpoint: process.env.REACT_APP_GREEDY_ENDPOINT || 
    'https://greedy-production.up.railway.app/api/greedy/solve',
  
  healthCheckUrl: process.env.REACT_APP_GREEDY_HEALTH || 
    'https://greedy-production.up.railway.app/health',
  
  // Timeouts
  healthCheckTimeout: parseInt(process.env.REACT_APP_GREEDY_HC_TIMEOUT || '3000', 10),
  solveTimeout: parseInt(process.env.REACT_APP_GREEDY_TIMEOUT || '30000', 10),
  
  // Retry configuration
  maxRetries: parseInt(process.env.REACT_APP_GREEDY_MAX_RETRIES || '2', 10),
  retryDelayMs: parseInt(process.env.REACT_APP_GREEDY_RETRY_DELAY || '1000', 10),
  
  // Feature flags
  enableHealthCheck: process.env.REACT_APP_GREEDY_HEALTH_CHECK !== 'false',
  allowOfflineMode: process.env.REACT_APP_GREEDY_OFFLINE_MODE === 'true',
};

export interface HealthCheckResult {
  isHealthy: boolean;
  timestamp: Date;
  error?: string;
}

export interface SolveRequest {
  roster_id: string;
  [key: string]: any;
}

export interface SolveResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number;
  assignments_created: number;
  bottlenecks: number;
  solve_time: number;
  message: string;
  details?: any;
}

/**
 * Perform health check on GREEDY service
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      GREEDY_CONFIG.healthCheckTimeout
    );

    const response = await fetch(GREEDY_CONFIG.healthCheckUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(`✅ GREEDY health check passed (${Date.now() - startTime}ms)`);
      return {
        isHealthy: true,
        timestamp: new Date()
      };
    } else {
      const error = `HTTP ${response.status}`;
      console.warn(`⚠️ GREEDY health check failed: ${error}`);
      return {
        isHealthy: false,
        timestamp: new Date(),
        error
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ GREEDY health check error: ${errorMsg}`);
    return {
      isHealthy: false,
      timestamp: new Date(),
      error: errorMsg
    };
  }
}

/**
 * Call GREEDY solver endpoint
 */
export async function callGreedySolver(
  request: SolveRequest,
  onProgress?: (status: string) => void
): Promise<SolveResponse> {
  const startTime = Date.now();
  onProgress?.('Connecting to GREEDY service...');

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GREEDY_CONFIG.solveTimeout
  );

  try {
    const response = await fetch(GREEDY_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || 
        errorData.message || 
        `HTTP ${response.status}`
      );
    }

    const result: SolveResponse = await response.json();
    const elapsedTime = Date.now() - startTime;
    
    console.log(`✅ GREEDY solve completed in ${elapsedTime}ms`, result);
    
    return {
      ...result,
      solve_time: elapsedTime / 1000 // Convert to seconds
    };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('GREEDY solver timeout');
      }
      throw err;
    }
    
    throw new Error(`GREEDY solver error: ${String(err)}`);
  }
}

/**
 * Format error message for user display
 */
export function formatErrorMessage(error: Error | string): string {
  const msg = typeof error === 'string' ? error : error.message;
  
  if (msg.includes('Failed to fetch')) {
    return 'Netwerkverbinding verbroken. Controleer uw internet.';
  }
  if (msg.includes('timeout')) {
    return 'GREEDY service reageert niet. Probeer later opnieuw.';
  }
  if (msg.includes('HTTP')) {
    return `Server error: ${msg}. Neem contact op met support.`;
  }
  
  return msg;
}
