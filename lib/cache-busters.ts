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

// DRAAD179: Backend Storage Layer Denormalization Fix
// Fixes: getRosterPeriodStaffing, updateRosterPeriodStaffing, bulkUpdateRosterPeriodStaffing
// Changes: All functions now use denormalized roster_period_staffing_dagdelen table
// Impact: CRITICAL - Core data retrieval functions
// Generated: 2025-12-14T19:20:28Z
// Change triggers: Roster period staffing data retrieval, updates, and bulk operations
export const DRAAD179_CACHEBUST = '20251214-roster-staffing-denorm-fase1';

// DRAAD166: Layer 1 Exception Handlers
// Fixes: "Fout: Onbekende fout - Application failed to respond" (502 Bad Gateway)
// Changes: Added exception handlers in solver_engine.py + main.py FastAPI
// Method: Try-catch around each constraint method + global exception handler
// Generated: 2025-12-12T16:47:00Z
// Change triggers: Python solver exception handling, FastAPI error responses
export const DRAAD166_CACHEBUST = '20251212-layer1-exception-handlers-draad166';

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
export const MASTER_CACHE_VERSION = '2025-12-14-T192028Z-DRAAD179';

// Version history for debugging
export const CACHE_VERSIONS = {
  'draad-118a': '20250915-143022',  // INFEASIBLE handling
  'draad-121': '20251025-101509',   // Constraint fix prep
  'draad-122': '20251201-180945',   // UPSERT pattern
  'draad-127': DRAAD127_CACHEBUST,  // Duplicate prevention - TypeScript deduplication
  'draad-128': '20251208-upsert-fix-optie-e',  // PostgreSQL RPC UPSERT fix
  'draad-166': DRAAD166_CACHEBUST,  // Layer 1 exception handlers - prevents 502
  'draad-179': DRAAD179_CACHEBUST,  // Backend storage denormalization - FASE1
  'optie-e': OPTIE_E_CACHEBUST      // Full duplicate fix (127 + 128 combined)
};

/**
 * Format: YYYYMMDD-{FEATURE}-{IDENTIFIER}
 * Easy to see when each change was made
 * Example: 20251212-layer1-exception-handlers-draad166 = Dec 12, 2025 exception handlers for DRAAD166
 */
export function getCacheBusterUrl(): string {
  return `/api/roster/solve?v=${DRAAD179_CACHEBUST}&cache-key=${Date.now()}`;
}

/**
 * Railway environment variable format
 * Used: process.env.NEXT_PUBLIC_CACHE_BUSTER
 */
export const RAILWAY_ENV_CACHEBUSTER = DRAAD179_CACHEBUST;
