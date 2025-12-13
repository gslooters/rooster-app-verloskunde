/**
 * Cache Buster for DRAAD176 Sequential Solver JOIN Fix
 * Generated: 2025-12-13 14:47:15 UTC
 * 
 * This forces Railway to rebuild the solver service and clear any cached
 * requirements that were loaded from the old (broken) query.
 * 
 * Force rebuild by including this unique token in environment:
 */

export const CACHE_BUST_DRAAD176 = {
  timestamp: 1734089235000,  // Date.now() when fix was deployed
  builtAt: new Date('2025-12-13T14:47:15Z').toISOString(),
  version: 'draad176-sequential-solver-join-fix',
  changes: [
    'sequential_solver_v2.py: RequirementQueue.load_from_db() - Changed from roster_period_staffing_dagdelen to roster_period_staffing + JOIN',
    'sequential_solver_v2.py: _parse_date() - Added defensive None checks',
    'Cache invalidation: All cached requirements must be reloaded from database'
  ],
  randomToken: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  deploymentId: `draad176-${Date.now()}`,
};

// Export for use in Railway deployment triggers
export const SOLVER_REBUILD_TOKEN = `DRAAD176_${CACHE_BUST_DRAAD176.deploymentId}`;

/**
 * Usage in Railway:
 * 
 * 1. Set environment variable:
 *    SOLVER_CACHE_BUST=${SOLVER_REBUILD_TOKEN}
 * 
 * 2. Restart service to pick up new token
 * 
 * 3. Sequential solver will now use the corrected load_from_db() method
 *    that queries the parent table with proper date fields.
 */
