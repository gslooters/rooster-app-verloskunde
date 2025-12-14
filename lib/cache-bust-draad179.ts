// lib/cache-bust-draad179.ts
// ============================================================================
// DRAAD179-FASE1 Cache Buster
// Timestamp: Wed Dec 14 2025 19:20:20 GMT+0000 (Coordinated Universal Time)
// ============================================================================
// Purpose: Cache bust for DRAAD179 FASE1 deployment
// - Fix: getRosterPeriodStaffing function
// - Fix: updateRosterPeriodStaffing function
// - Fix: bulkUpdateRosterPeriodStaffing function
// - All functions now use denormalized roster_period_staffing_dagdelen table
//
// Include this in your imports to force fresh builds:
// import { DRAAD179_CACHE_BUST } from '@/lib/cache-bust-draad179';

export const DRAAD179_CACHE_BUST = {
  timestamp: Date.now(), // 1734200420000 (auto-generated)
  version: '1.0.0',
  phase: 'FASE1',
  deployment: 'ROSTER-PERIOD-STAFFING-STORAGE',
  changes: [
    'Added getRosterPeriodStaffing function',
    'Added updateRosterPeriodStaffing function',
    'Added bulkUpdateRosterPeriodStaffing function',
    'All functions use denormalized dagdelen table',
    'Removed dependency on parent roster_period_staffing table'
  ]
} as const;
