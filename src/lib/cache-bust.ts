// CACHE-BUSTING UTILITY - DRAAD48
// Auto-generated timestamp voor force cache refresh
// Deployed: 2025-11-24T15:06:36Z

export const CACHE_VERSION = Date.now();
export const BUILD_ID = '20251124-150636';
export const DEPLOYMENT_TRIGGER = Math.random().toString(36).substring(7);

// Helper om query params toe te voegen voor cache refresh
export function addCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${CACHE_VERSION}&t=${DEPLOYMENT_TRIGGER}`;
}

// Helper voor Railway deployment verification
export function getDeploymentInfo() {
  return {
    cacheVersion: CACHE_VERSION,
    buildId: BUILD_ID,
    trigger: DEPLOYMENT_TRIGGER,
    timestamp: new Date().toISOString()
  };
}
