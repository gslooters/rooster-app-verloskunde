/**
 * GREEDY Solver Client
 * 
 * DRAAD 202: Centralized GREEDY API client
 * Provides clean abstraction for:
 * - Request building
 * - API calls with timeout handling
 * - Response validation
 * - Error classification
 * - Logging
 * 
 * Optional utility - can be used in place of inline callGreedyAPI()
 */

import type { SolveRequest } from '@/lib/types/solver';

// ============================================================================
// TYPES
// ============================================================================

export interface GreedyRequest {
  roster_id: string;
  data: SolveRequest;
}

export interface GreedyResponse {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverage: number; // 0-100 percentage
  assignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_code: string;
  }>;
  total_assignments: number;
  solve_time_seconds: number;
  message?: string;
}

export interface GreedySolution {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  coverageRate: number;
  assignments: Array<{
    employee_id: string;
    date: string;
    dagdeel: 'O' | 'M' | 'A';
    service_code: string;
  }>;
  totalAssignments: number;
  solveTimeSeconds: number;
}

export type GreedyErrorType =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR';

export interface GreedyErrorInfo {
  type: GreedyErrorType;
  userMessage: string;
  details: string;
  status?: number;
}

// ============================================================================
// GREEDY CLIENT
// ============================================================================

export class GreedyClient {
  private endpoint: string;
  private timeout: number;

  constructor(
    endpoint: string = process.env.GREEDY_ENDPOINT || 'https://greedy-production.up.railway.app/api/greedy/solve',
    timeout: number = parseInt(process.env.GREEDY_TIMEOUT || '30000', 10)
  ) {
    this.endpoint = endpoint;
    this.timeout = timeout;
    console.log(`[GreedyClient] Initialized with endpoint: ${this.endpoint}, timeout: ${this.timeout}ms`);
  }

  /**
   * Classify error and return user-friendly Dutch message
   */
  private classifyError(error: any): GreedyErrorInfo {
    console.error('[GreedyClient] Error classification:', { error: error?.message, code: error?.code });

    // Timeout errors
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        userMessage: 'GREEDY service reageert niet (timeout). Probeer later opnieuw.',
        details: `Timeout na ${this.timeout}ms`,
        status: 504
      };
    }

    // Network errors
    if (
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ERR_INVALID_URL'
    ) {
      return {
        type: 'NETWORK_ERROR',
        userMessage: 'Netwerkverbinding onderbroken. Controleer uw internet.',
        details: error.message
      };
    }

    // HTTP 5xx errors
    if (error?.status >= 500) {
      return {
        type: 'SERVER_ERROR',
        userMessage: 'GREEDY service error. Probeer over enkele momenten opnieuw.',
        details: `HTTP ${error.status}: ${error.message}`,
        status: error.status
      };
    }

    // HTTP 4xx errors
    if (error?.status >= 400 && error?.status < 500) {
      return {
        type: 'CLIENT_ERROR',
        userMessage: 'Request error. Controleer uw gegevens.',
        details: `HTTP ${error.status}: ${error.message}`,
        status: error.status
      };
    }

    // Parse errors
    if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
      return {
        type: 'PARSE_ERROR',
        userMessage: 'Onbekende fout opgetreden. Details: respons parsing error',
        details: error.message
      };
    }

    // Unknown error
    return {
      type: 'VALIDATION_ERROR',
      userMessage: 'Onbekende fout opgetreden. Details: ' + (error?.message || 'Unknown'),
      details: JSON.stringify(error)
    };
  }

  /**
   * Validate GREEDY response structure
   */
  private validateResponse(data: any): void {
    console.log('[GreedyClient] Validating GREEDY response...');

    // Check required fields
    if (!data.status) {
      throw { type: 'VALIDATION_ERROR', message: 'Missing status field' };
    }

    if (typeof data.coverage !== 'number') {
      throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid coverage field' };
    }

    if (!Array.isArray(data.assignments)) {
      throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid assignments array' };
    }

    if (typeof data.total_assignments !== 'number') {
      throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid total_assignments' };
    }

    if (typeof data.solve_time_seconds !== 'number') {
      throw { type: 'VALIDATION_ERROR', message: 'Missing or invalid solve_time_seconds' };
    }

    // Validate each assignment
    data.assignments.forEach((assignment: any, idx: number) => {
      if (!assignment.employee_id) {
        throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing employee_id` };
      }
      if (!assignment.date) {
        throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing date` };
      }
      if (!['O', 'M', 'A'].includes(assignment.dagdeel)) {
        throw {
          type: 'VALIDATION_ERROR',
          message: `Assignment[${idx}] invalid dagdeel: ${assignment.dagdeel}`
        };
      }
      if (!assignment.service_code) {
        throw { type: 'VALIDATION_ERROR', message: `Assignment[${idx}] missing service_code` };
      }
    });

    console.log('[GreedyClient] ✅ Response validation passed');
  }

  /**
   * Call GREEDY API with timeout handling
   */
  async solve(payload: GreedyRequest): Promise<GreedySolution> {
    console.log('[GreedyClient] === SOLVE START ===');
    console.log(`[GreedyClient] Roster: ${payload.roster_id}`);
    
    const startTime = Date.now();

    try {
      // Setup AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'rooster-app-verloskunde/GreedyClient'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsedMs = Date.now() - startTime;
        console.log(`[GreedyClient] Response received after ${elapsedMs}ms, status: ${response.status}`);

        // Handle HTTP errors
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[GreedyClient] HTTP error ${response.status}: ${errorText}`);

          // Check for INFEASIBLE
          if (errorText.includes('infeasible') || errorText.includes('INFEASIBLE')) {
            console.warn('[GreedyClient] INFEASIBLE solution');
            return {
              status: 'FAILED',
              coverageRate: 0,
              assignments: [],
              totalAssignments: 0,
              solveTimeSeconds: elapsedMs / 1000
            };
          }

          throw {
            status: response.status,
            message: errorText || `HTTP ${response.status}`
          };
        }

        // Parse response
        const data: GreedyResponse = await response.json();
        console.log(`[GreedyClient] Response parsed: ${data.status}, coverage: ${data.coverage}%`);

        // Validate
        this.validateResponse(data);

        // Convert to internal format
        const solution: GreedySolution = {
          status: data.status,
          coverageRate: data.coverage,
          assignments: data.assignments,
          totalAssignments: data.total_assignments,
          solveTimeSeconds: data.solve_time_seconds
        };

        console.log('[GreedyClient] === SOLVE SUCCESS ===');
        return solution;

      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error(`[GreedyClient] TIMEOUT after ${this.timeout}ms`);
          throw {
            name: 'AbortError',
            message: `GREEDY timeout after ${this.timeout}ms`
          };
        }

        throw fetchError;
      }
    } catch (error: any) {
      const errorInfo = this.classifyError(error);
      console.error(`[GreedyClient] Failed: ${errorInfo.type}`, errorInfo);
      console.log('[GreedyClient] === SOLVE FAILED ===');
      throw errorInfo;
    }
  }
}

// Export singleton instance
export const greedyClient = new GreedyClient();