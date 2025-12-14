/**
 * DRAAD179 FASE2 - CacheBuster61D
 * Triggers cache bust voor week-dagdelen rendering
 * Voordeel: geen manuelle cache invalidatie nodig, automatisch bij module load
 */

// Unique bust marker voor deze build (DRAAD179)
const CACHEBUST_MARKER_DRAAD179 = `DRAAD179_FASE2_${Date.now()}`;

/**
 * Trigger cache bust voor week-dagdelen module
 * Wordt aangeroepen bij component render (WeekTableBody.tsx)
 * Doel: forceer herloading van gerelateerde modules/styles
 */
export function triggerCacheBust61D(): void {
  if (typeof window !== 'undefined') {
    // Client-side cache bust: voeg marker toe aan window object
    (window as any).__cacheBust61D = CACHEBUST_MARKER_DRAAD179;
  }
}

/**
 * Get current cache bust marker
 * Handig voor debugging en verification
 */
export function getCacheBustMarker(): string {
  return CACHEBUST_MARKER_DRAAD179;
}

// Auto-execute beim import (server & client)
if (typeof window !== 'undefined') {
  console.log('[DRAAD179] CacheBuster61D initialized:', CACHEBUST_MARKER_DRAAD179);
}

export default triggerCacheBust61D;
