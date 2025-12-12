/**
 * Cache buster for DRAAD166 - Layer 1 Exception Handlers
 * Generated: 2025-12-12T16:47:00Z
 * Purpose: Force reload of solver service after exception handler deployment
 * 
 * Usage:
 * import { CACHE_BUST_DRAAD166 } from '@/lib/cache-bust-draad166';
 * const solverUrl = `${SOLVER_URL}/api/v1/solve-schedule?cb=${CACHE_BUST_DRAAD166}`;
 */

export const CACHE_BUST_DRAAD166 = 1734024420000;  // Date.now() at deployment
export const DRAAD166_VERSION = '1.1.1';
export const DRAAD166_DESCRIPTION = 'Layer 1 exception handlers - prevents 502 Bad Gateway errors';
