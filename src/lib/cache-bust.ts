/**
 * Cache-Busting Utility - DRAAD406
 * 
 * Generates unique tokens to bypass browser/CDN caches
 * Ensures fresh data loads after deployments
 * 
 * Usage:
 * - In API calls: Add X-Cache-Bust header
 * - In fetch URLs: Add ?bust={token} query param
 * - In imports: Add ?v={token} for static assets
 */

/**
 * Generate cache-bust token
 * Format: timestamp-random
 * Example: 1704556444123-7382
 */
export function generateCacheBustToken(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Get cache-bust headers for fetch requests
 * Used to bypass Railway caching
 */
export function getCacheBustHeaders(): Record<string, string> {
  return {
    'X-Cache-Bust': generateCacheBustToken(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Add cache-bust query parameter to URL
 * Example: /api/data → /api/data?bust=1704556444123-7382
 */
export function addCacheBustParam(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}bust=${generateCacheBustToken()}`;
}

/**
 * Build Railway-aware fetch options
 * Combines cache-bust headers with fetch options
 */
export function buildCacheBustFetchOptions(
  options: RequestInit = {}
): RequestInit {
  return {
    ...options,
    headers: {
      ...getCacheBustHeaders(),
      ...(options.headers || {}),
    },
  };
}

/**
 * Get timestamp string for logging
 * Helps correlate logs with deployments
 */
export function getTimestampString(): string {
  return new Date().toISOString();
}
