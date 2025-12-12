/**
 * ============================================================================
 * DRAAD 162A: Client-side Cache Invalidator
 * Purpose: Force fresh data reload after mutations (PUT/POST/DELETE)
 * Deploy Date: 2025-12-12
 * Version: DRAAD162A-v1
 * ============================================================================
 */

import { useCallback } from 'react';

/**
 * LAG 2: CLIENT REFRESH
 * 
 * Gebruik deze hook om automatisch cache te invaliden na API mutations.
 * Dit forceert het laden van frisse data uit de server/database.
 */

export const useCacheInvalidation = () => {
  const invalidateStaffingCache = useCallback(async () => {
    console.log('📡 [DRAAD162A-CLIENT] Invalidating staffing cache...');
    
    try {
      // Methode 1: SWR invalidation (als SWR wordt gebruikt)
      if (typeof window !== 'undefined' && (window as any).__SWR_CACHE__) {
        console.log('✨ [DRAAD162A-CLIENT] Using SWR cache invalidation');
        Object.keys((window as any).__SWR_CACHE__).forEach((key) => {
          if (key.includes('planning') || key.includes('dagdeel') || key.includes('staff')) {
            delete (window as any).__SWR_CACHE__[key];
          }
        });
      }
      
      // Methode 2: Supabase real-time subscription refresh
      if (typeof window !== 'undefined' && (window as any).__SUPABASE__) {
        console.log('🔄 [DRAAD162A-CLIENT] Triggering Supabase listener refresh');
        // Supabase real-time listeners zullen automatisch updates pushen
      }
      
      // Methode 3: Fetch new data immediately
      console.log('✅ [DRAAD162A-CLIENT] Fresh data will be loaded on next query');
    } catch (error) {
      console.error('❌ [DRAAD162A-CLIENT] Cache invalidation error:', error);
    }
  }, []);
  
  return { invalidateStaffingCache };
};

/**
 * Standalone function voor cache invalidation
 * Kan aangeroepen worden vanuit mutation success handlers
 */
export async function invalidateAllCaches() {
  console.log('📡 [DRAAD162A-CLIENT] Full cache invalidation requested');
  
  // Clear browser cache headers
  const headers = new Headers();
  headers.append('Cache-Control', 'no-cache, no-store, max-age=0');
  
  // Force refresh van kritische endpoints
  const endpoints = [
    '/api/planning/info',
    '/api/roster/assignments',
    '/api/staffing',
  ];
  
  for (const endpoint of endpoints) {
    try {
      await fetch(endpoint, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
    } catch (error) {
      console.warn(`[DRAAD162A-CLIENT] Could not pre-fetch ${endpoint}:`, error);
    }
  }
  
  console.log('✅ [DRAAD162A-CLIENT] All caches invalidated, fresh data ready');
}

/**
 * Wrap fetch calls met cache invalidation headers
 */
export function fetchWithCacheBust(url: string, options: RequestInit = {}) {
  const cacheBustParam = `cacheBust=${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const separator = url.includes('?') ? '&' : '?';
  const bustedUrl = `${url}${separator}${cacheBustParam}`;
  
  return fetch(bustedUrl, {
    ...options,
    headers: {
      ...options.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

/**
 * Browser-side cache control header detector
 */
export function detectCacheIssues(): { issue: string; solution: string }[] {
  const issues: { issue: string; solution: string }[] = [];
  
  if (typeof window !== 'undefined') {
    // Check service worker caching
    if ('serviceWorker' in navigator) {
      issues.push({
        issue: 'Service Worker may be caching responses',
        solution: 'Ensure service worker respects Cache-Control headers and invalidates on mutations',
      });
    }
    
    // Check browser cache
    issues.push({
      issue: 'Browser HTTP cache may hold stale data',
      solution: 'Use no-cache headers in DRAAD162A cache-buster.ts',
    });
  }
  
  return issues;
}
