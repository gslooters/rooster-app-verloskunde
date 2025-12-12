/**
 * ============================================================================
 * DRAAD 162A: Cache Buster Configuration
 * Purpose: Central cache invalidation for staffing data
 * Deploy Date: 2025-12-12
 * Version: DRAAD162A-v1
 * ============================================================================
 */

export const CACHE_BUSTER = {
  timestamp: Date.now(),
  deployId: process.env.RANDOM_CACHE_BUSTER || `deploy-${Date.now()}`,
  version: 'DRAAD162A-v1',
  
  TAGS: {
    STAFFING_DATA: 'staffing-data',
    PLANINFORMATIE: 'planinformatie',
    ROSTER_PERIOD: 'roster-period',
    DAGDEEL: 'dagdeel',
  },
  
  HEADERS: {
    SHORT: 'public, max-age=30, s-maxage=30',
    MEDIUM: 'public, max-age=300, s-maxage=300',
    NOCACHE: 'no-cache, no-store, must-revalidate',
  },
  
  getQueryParam(): string {
    const random = Math.random().toString(36).substr(2, 9);
    return `cacheBust=${this.deployId}-${random}`;
  },
  
  getValue(): string {
    return this.deployId;
  },
  
  getHeaders() {
    return {
      'Cache-Control': this.HEADERS.NOCACHE,
      'X-Cache-Buster': `dagdeel-${Date.now()}`,
      'X-Invalidate-On-Client': 'true',
      'X-Deploy-Version': this.version,
      'Pragma': 'no-cache',
      'Expires': '0',
    };
  },
};

export function logCacheBuster() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 [DRAAD162A] Cache Buster initialized:', {
      timestamp: new Date(CACHE_BUSTER.timestamp).toISOString(),
      deployId: CACHE_BUSTER.deployId,
      version: CACHE_BUSTER.version,
    });
  }
}

/**
 * Hook dit aan in middleware of API routes om cache invalidation te forceren
 * Voorbeeld:
 *   const headers = CACHE_BUSTER.getHeaders();
 *   return Response.json(data, { headers });
 */
