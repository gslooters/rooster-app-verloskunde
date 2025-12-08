/**
 * DRAAD130: Cache Buster - Status 1 Blocked Slots Fix
 * 
 * Critical fix for ORT data fetch:
 * - blocked_slots query now includes status 1 (planner scheduled)
 * - Constraint 2 disabled in solver (redundant)
 * - ORT now respects existing planner assignments
 * 
 * Force: Railway rebuild + Next.js cache clear
 * Timestamp: Date.now() ensures unique import each deploy
 */

export default {
  DRAAD130_DEPLOYED: new Date().toISOString(),
  DRAAD130_TIMESTAMP: Date.now(),
  DRAAD130_RANDOM: Math.floor(Math.random() * 10000),
  version: '1.0.0',
  fix: 'Status 1 now included in blocked_slots fetch (route.ts)',
  impact: 'ORT respects existing planner assignments and does not overwrite them',
  constraint_change: 'Constraint 2 disabled - now redundant with constraint 3B',
  deployed_at: new Date().toISOString(),
  solver_change: 'solver_engine.py: blocked_slots now processes status 1,2,3',
  files_modified: [
    'app/api/roster/solve/route.ts (line ~658: .in(status, [1,2,3]))',
    'solver/solver_engine.py (constraint 2 disabled, constraint 3B enhanced)'
  ]
} as const;
