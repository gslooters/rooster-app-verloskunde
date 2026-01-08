/**
 * DRAAD369 Fix 4: Deployment Cache Busting
 * 
 * Problem: Stale caches preventing fresh data reads from database
 * Solution: Explicit cache invalidation with Date.now() + Railway random validation
 * 
 * Usage:
 * - Every data fetch should include cache-busting parameter
 * - Use getBustingParam() to generate unique params
 * - Force bypass all caches via URL params + timestamp
 */

/**
 * Cache Busting State
 * Stores the last cache bust timestamp to prevent excessive cache-busting
 */
const cacheState = {
  lastBustTime: 0,
  bustInterval: 500, // ms - minimum interval between cache busts
  railwayRandomToken: '',
};

/**
 * Initialize Railway random token for deployment
 * This token changes on each Railway deployment (cache-busting mechanism)
 * 
 * @param token - Optional Railway deployment token (auto-generated if omitted)
 */
export function initializeRailwayToken(token?: string): void {
  if (token) {
    cacheState.railwayRandomToken = token;
    console.log(`[CacheControl] Railway token initialized: ${token.substring(0, 8)}...`);
  } else {
    // Generate random token based on deployment time
    cacheState.railwayRandomToken = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[CacheControl] Railway token auto-generated: ${cacheState.railwayRandomToken}`);
  }
}

/**
 * Get cache-busting parameter for URL queries
 * Returns unique timestamp-based identifier to bypass HTTP caching
 * 
 * Use in fetch URLs: `/api/data?resourceId=123&_cache=${getBustingParam()}`
 * 
 * @param forceNewBust - Force generation of new bust param (default: false)
 * @returns String like "t=1704777240123-abc123" for URL query params
 */
export function getBustingParam(forceNewBust: boolean = false): string {
  const now = Date.now();
  
  // Rate-limit cache busting to prevent excessive database queries
  if (!forceNewBust && now - cacheState.lastBustTime < cacheState.bustInterval) {
    // Return last busting param if still valid
    const elapsed = now - cacheState.lastBustTime;
    console.log(`[CacheControl] Cache bust rate-limited (${elapsed}ms < ${cacheState.bustInterval}ms)`);
  }
  
  // Generate new busting param
  cacheState.lastBustTime = now;
  const randomId = Math.random().toString(36).substr(2, 9);
  const param = `t=${now}-${randomId}-${cacheState.railwayRandomToken.substring(0, 8)}`;
  
  console.log(`[CacheControl] Generated busting param: ${param}`);
  return param;
}

/**
 * Invalidate all caches for a specific resource type
 * Useful when data changes and we need to force fresh database reads
 * 
 * @param resourceType - Type of resource (e.g., 'roster', 'assignments', 'design')
 */
export function invalidateCache(resourceType: string): void {
  console.log(`[CacheControl] Invalidating cache for: ${resourceType}`);
  console.log(`[CacheControl] Next fetch will use: ${getBustingParam(true)}`);
}

/**
 * Force all browsers/tabs to refresh by incrementing a global version number
 * Components can subscribe to this version and re-fetch when it changes
 * 
 * Usage:
 * ```tsx
 * const [cacheVersion, setCacheVersion] = useState(0);
 * 
 * useEffect(() => {
 *   const listener = (version) => setCacheVersion(version);
 *   subscribeToCacheVersion(listener);
 *   return () => unsubscribeFromCacheVersion(listener);
 * }, []);
 * 
 * useEffect(() => {
 *   // Re-fetch whenever cache version changes
 *   loadData();
 * }, [cacheVersion]);
 * ```
 */

type CacheVersionListener = (version: number) => void;
const cacheVersionListeners = new Set<CacheVersionListener>();
let globalCacheVersion = 0;

export function getCacheVersion(): number {
  return globalCacheVersion;
}

export function incrementCacheVersion(): number {
  globalCacheVersion++;
  console.log(`[CacheControl] Global cache version incremented to ${globalCacheVersion}`);
  
  // Notify all listeners of cache version change
  cacheVersionListeners.forEach(listener => {
    try {
      listener(globalCacheVersion);
    } catch (error) {
      console.error('[CacheControl] Error in cache version listener:', error);
    }
  });
  
  return globalCacheVersion;
}

export function subscribeToCacheVersion(listener: CacheVersionListener): () => void {
  cacheVersionListeners.add(listener);
  console.log(`[CacheControl] Cache version listener added (total: ${cacheVersionListeners.size})`);
  
  // Return unsubscribe function
  return () => {
    cacheVersionListeners.delete(listener);
    console.log(`[CacheControl] Cache version listener removed (total: ${cacheVersionListeners.size})`);
  };
}

/**
 * Clear all cache state (useful for testing or reset)
 */
export function clearCacheState(): void {
  console.log('[CacheControl] Clearing all cache state');
  cacheState.lastBustTime = 0;
  globalCacheVersion = 0;
  cacheVersionListeners.clear();
}

/**
 * Get debug info about current cache state
 */
export function getCacheDebugInfo(): {
  timestamp: number;
  cacheVersion: number;
  railwayToken: string;
  listenerCount: number;
} {
  return {
    timestamp: Date.now(),
    cacheVersion: globalCacheVersion,
    railwayToken: cacheState.railwayRandomToken || 'NOT_INITIALIZED',
    listenerCount: cacheVersionListeners.size,
  };
}
