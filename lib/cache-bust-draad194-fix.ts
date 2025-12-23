// CACHE-BUST TOKEN: DRAAD-194-FIX
// Purpose: Force rebuild after Badge component fix
// Timestamp: 2025-12-23T20:58:01Z
// Reason: Missing Badge component added to components/ui/
// 
// This ensures Railway detects changes and triggers full rebuild

export const DRAAD194_FIX_CACHEBUST = {
  timestamp: Date.now(),
  version: '1.0.0-badge-fix',
  builtAt: new Date().toISOString(),
  reason: 'Badge component creation - fix for missing UI component',
  token: `draad194-fix-${Math.random().toString(36).substr(2, 9)}`,
  metadata: {
    component: 'badge.tsx',
    path: 'components/ui/badge.tsx',
    variants: ['default', 'secondary', 'destructive', 'success'],
    fixes: [
      'Missing @/components/ui/badge import error',
      'Service assignments page build failure',
      'Team label rendering in roster UI'
    ]
  }
} as const;

if (typeof window !== 'undefined') {
  console.log('[CACHE-BUST] DRAAD-194-FIX:', DRAAD194_FIX_CACHEBUST.timestamp);
}
