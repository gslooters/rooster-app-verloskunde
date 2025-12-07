/**
 * Cache Busters - Force browser + Railway cache invalidation
 * 
 * Used in:
 * - HTML: <script src="/api/solve?v={OPTIE_E_CACHEBUST}">
 * - Railway ENV: CACHE_BUSTER_VERSION
 * 
 * When ORT logic changes → Increment version → Cache invalidates
 * Prevents stale JavaScript + stale API responses
 */

// OPTIE E: Cache buster for service_code → service_id mapping
// Generated: 2025-12-07T22:53:53Z
// Change triggers: service_id mapping, ORT tracking fields, findServiceId() helper
export const OPTIE_E_CACHEBUST = '20251207-225353-optie-e';

// Master cache version (all busters)
// Increment this for any breaking change
export const MASTER_CACHE_VERSION = '2025-12-07-T225353Z';

// Version history for debugging
export const CACHE_VERSIONS = {
  'draad-118a': '20250915-143022',  // INFEASIBLE handling
  'draad-121': '20251025-101509',   // Constraint fix prep
  'draad-122': '20251201-180945',   // UPSERT pattern
  'optie-e': OPTIE_E_CACHEBUST      // Service code mapping
};

/**
 * Format: YYYYMMDD-HHMMSS-identifier
 * Easy to see when each change was made
 */
export function getCacheBusterUrl(): string {
  return `/api/roster/solve?v=${OPTIE_E_CACHEBUST}&cache-key=${Date.now()}`;
}

/**
 * Railway environment variable format
 * Used: process.env.NEXT_PUBLIC_CACHE_BUSTER
 */
export const RAILWAY_ENV_CACHEBUSTER = OPTIE_E_CACHEBUST;
