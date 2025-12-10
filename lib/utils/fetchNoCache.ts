/**
 * DRAAD162-FIX: Aggressive Cache-Busting Fetch Wrapper
 * 
 * This utility ensures NO caching at any level:
 * ✅ cache: 'no-store' option prevents browser caching
 * ✅ Cache-Control headers prevent HTTP-level caching
 * ✅ No 304 Not Modified responses
 * ✅ Always fresh data from server
 * 
 * Usage:
 * ```
 * const response = await fetchNoCache('/api/endpoint?param=value');
 * const data = await response.json();
 * ```
 * 
 * DRAAD160: HTTP cache fix
 * DRAAD161: Supabase SDK client cache fix
 * DRAAD162: Aggressive cache-busting wrapper
 */

export async function fetchNoCache(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...options,
    cache: 'no-store',  // 🔥 Force no browser cache - CRITICAL
    headers: {
      ...(options?.headers || {}),
      // Aggressive HTTP cache headers
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private, no-transform',
      'Pragma': 'no-cache, no-store',
      'Expires': '0',
      'Surrogate-Control': 'no-store',  // Proxy cache bypass
      'X-Accel-Expires': '0',  // Nginx/reverse proxy bypass
      'X-Requested-With': 'XMLHttpRequest',  // Mark as AJAX
    }
  });
}
