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

// DRAAD127: Duplicate Prevention - TypeScript Deduplication
// Fixes: "ON CONFLICT DO UPDATE command cannot affect row a second time" error
// Changes: Added deduplicateAssignments() function using Set with composite keys
// Method: Filters duplicate (roster_id, employee_id, date, dagdeel) before UPSERT
// Generated: 2025-12-08T01:06:30Z
// Change triggers: Deduplication logic, duplicate filtering
export const DRAAD127_CACHEBUST = '20251208-dedup-prevent-draad127';

// DRAAD128: UPSERT Fix - PostgreSQL RPC function
// Fixes: "ON CONFLICT DO UPDATE command cannot affect row a second time" error
// Changes: route.ts now uses rpc('upsert_ort_assignments') instead of supabase.upsert()
// Generated: 2025-12-08T00:42:00Z
// Change triggers: UPSERT error fix, new RPC function call pattern
export const OPTIE_E_CACHEBUST = '20251208-full-duplicate-fix';

// Master cache version (all busters)
// Increment this for any breaking change
export const MASTER_CACHE_VERSION = '2025-12-08-T010630Z';

// Version history for debugging
export const CACHE_VERSIONS = {
  'draad-118a': '20250915-143022',  // INFEASIBLE handling
  'draad-121': '20251025-101509',   // Constraint fix prep
  'draad-122': '20251201-180945',   // UPSERT pattern
  'draad-127': DRAAD127_CACHEBUST,  // Duplicate prevention - TypeScript deduplication
  'draad-128': '20251208-upsert-fix-optie-e',  // PostgreSQL RPC UPSERT fix
  'optie-e': OPTIE_E_CACHEBUST      // Full duplicate fix (127 + 128 combined)
};

/**
 * Format: YYYYMMDD-{FEATURE}-{IDENTIFIER}
 * Easy to see when each change was made
 * Example: 20251208-dedup-prevent-draad127 = Dec 8, 2025 deduplication for DRAAD127
 */
export function getCacheBusterUrl(): string {
  return `/api/roster/solve?v=${OPTIE_E_CACHEBUST}&cache-key=${Date.now()}`;
}

/**
 * Railway environment variable format
 * Used: process.env.NEXT_PUBLIC_CACHE_BUSTER
 */
export const RAILWAY_ENV_CACHEBUSTER = OPTIE_E_CACHEBUST;
