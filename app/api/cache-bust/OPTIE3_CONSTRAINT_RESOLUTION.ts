/**
 * CACHE-BUST: OPTIE3_CONSTRAINT_RESOLUTION
 * 
 * DRAAD132-OPTIE3-CONSTRAINT-RESOLUTION (ACTIEF)
 * 
 * FIX: "CONSTRAINT RESOLUTION" strategy for duplicate composite keys
 * 
 * PROBLEM:
 * - Solver outputs 1140 assignments
 * - Some (roster|employee|date|dagdeel) keys appear MULTIPLE times
 * - Each occurrence has DIFFERENT service_code
 * - Deduplication currently keeps FIRST occurrence (= old resolver decision)
 * - Result: UPSERT gets duplicate keys → "ON CONFLICT cannot affect row twice"
 * 
 * SOLUTION: "CONSTRAINT RESOLUTION" pattern
 * - Keep LAST occurrence of each key (= most recent solver decision)
 * - Use Map to overwrite with latest value
 * - Sort by original index to preserve solver solve order
 * - This respects solver's final optimization decisions
 * 
 * BENEFITS vs "FIRST WINS":
 * ✅ Solver final decision wins (better quality)
 * ✅ Maintains solve order while removing duplicates
 * ✅ Deterministic (Map iteration order = insertion order)
 * ✅ Single pass O(n) performance
 * 
 * TIMESTAMP: 2025-12-08T22:06:00Z
 * VERSION: 1.0.0-OPTIE3-CONSTRAINT-RESOLUTION
 */

export const CACHE_BUST_OPTIE3_CONSTRAINT_RESOLUTION = {
  version: '1.0.0-OPTIE3-CONSTRAINT-RESOLUTION',
  timestamp: '2025-12-08T22:06:00Z',
  description: 'OPTIE3: Keep LAST occurrence of duplicate keys (solver final decision)',
  strategy: 'CONSTRAINT_RESOLUTION',
  duplicateHandling: 'Last occurrence wins (latest solver decision)',
  buildTime: new Date().toISOString(),
  
  // Random number for force cache bust on each build
  random: Math.floor(Math.random() * 100000),
  
  // Increment for manual cache busting
  increment: 1,
  
  // Strategy enum for tracking
  resolutionStrategy: 'LAST_OCCURRENCE' as const,
  
  // Impact summary
  impact: {
    description: 'Solver respects final optimization decisions - last duplicate occurrence kept',
    benefit: 'Better solution quality - uses solver final state not intermediate',
    fix: 'Eliminates ON CONFLICT duplicate key conflicts'
  }
};
