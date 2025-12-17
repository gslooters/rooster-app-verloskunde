# 🚀 DRAAD-205 FASE 4: FRONTEND INTEGRATION – IMPLEMENTATION GUIDE

**Status:** 📋 IMPLEMENTATION GUIDE  
**Versie:** 1.0  
**Datum:** 17 december 2025  
**Doel:** Frontend Integration with Greedy Realtime Monitoring  
**Bestanden:** `lib/frontend/greedy-realtime-monitor.ts` (NEW)  

---

## 📌 QUICK SUMMARY

**Wat FASE 4 toevoegt:**
- ✅ Realtime monitoring van roster_assignments updates
- ✅ Live UI updates als Greedy shifts toewijst
- ✅ Coverage percentage tracking (real-time)
- ✅ Error handling en user notifications
- ✅ Automatic subscription cleanup
- ✅ Dutch language messages

**Core Component:** `useGreedyRealtimeMonitor` hook
**Files Changed:** Only additions, no breaking changes

---

## 🏗️ ARCHITECTURE OVERVIEW

### BEFORE (DRAAD-202)
```
User clicks "Solve"
       ↓
Backend fetches data (800ms)
       ↓
Backend calls Greedy (waits for response)
       ↓
Greedy returns assignments (1000ms-5000ms)
       ↓
Backend updates DB
       ↓
Backend returns response to Frontend
       ↓
Frontend displays assignments
       ↓
Total: 2-7 seconds
```

### AFTER (DRAAD-204 + FASE 4)
```
User clicks "Solve"
       ↓
Backend validates (100ms)
       ↓
Backend sends to Greedy (async, fire-and-forget)
       ↓
Backend returns immediately ← FRONTEND GETS RESPONSE
       ↓                       (< 1 second)
Frontend subscribes to realtime events
       ↓
Greedy runs autonomously in background
       ↓
For each assignment:
  - Greedy writes to DB
  - Realtime event triggers (< 100ms)
  - Frontend receives update
  - UI updates live
       ↓
User sees shifts appearing in real-time
       ↓
Total backend response: < 1 second
Total user experience: Assignments appear live (no wait)
```

---

## 🔧 IMPLEMENTATION STEPS

### Step 1: Import the Hook

```typescript
// app/rooster/[id]/page.tsx (or your roster page)
import { useGreedyRealtimeMonitor, GreedyRealtimeMonitor } 
  from '@/lib/frontend/greedy-realtime-monitor';
```

### Step 2: Initialize Hook in Page Component

```typescript
export default function RosterPage() {
  const rosterId = useParams().id as string;
  
  const {
    isMonitoring,
    assignments,
    coverage,
    assignmentCount,
    errorMessage,
    lastUpdate,
    startMonitoring,
    stopMonitoring
  } = useGreedyRealtimeMonitor(rosterId);

  // ... rest of component
}
```

### Step 3: Update Solve Button Handler

```typescript
const handleSolveClick = async () => {
  console.log('[ROOSTER-PAGE] Starting roostering...');
  
  try {
    const response = await fetch('/api/roster/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster_id: rosterId })
    });

    if (!response.ok) {
      const error = await response.json();
      showNotification({
        type: 'error',
        message: error.userMessage || 'Failed to start roostering'
      });
      return;
    }

    const data = await response.json();

    if (!data.success) {
      showNotification({
        type: 'error',
        message: data.userMessage || 'Roostering failed'
      });
      return;
    }

    // ✅ START REALTIME MONITORING
    startMonitoring(data.frontend_instructions);

    // ✅ SHOW SUCCESS NOTIFICATION
    showNotification({
      type: 'success',
      message: data.message || 'Greedy is aan het werk... Updates volgen live!',
      duration: 5000
    });

    // Optional: Disable solve button while monitoring
    setSolveButtonDisabled(true);

  } catch (error) {
    console.error('[ROOSTER-PAGE] Error:', error);
    showNotification({
      type: 'error',
      message: `Error: ${(error as Error).message}`
    });
  }
};
```

### Step 4: Display Realtime Monitor Component

```typescript
return (
  <div className="roster-page">
    {/* Existing controls */}
    <button 
      onClick={handleSolveClick}
      disabled={isMonitoring || solveButtonDisabled}
    >
      {isMonitoring ? 'Roostering in progress...' : 'Start Roostering'}
    </button>

    {/* ✅ NEW: Realtime Monitor Component */}
    <GreedyRealtimeMonitor 
      rosterId={rosterId}
      onComplete={(stats) => {
        console.log('Roostering complete:', stats);
        showNotification({
          type: 'success',
          message: `Roostering complete! Coverage: ${stats.coverage.toFixed(1)}%`
        });
        setSolveButtonDisabled(false);
        // Optional: Refresh assignments table
        refreshAssignments();
      }}
      pollInterval={5000}
    />

    {/* Display error if any */}
    {errorMessage && (
      <div className="error-banner">
        {errorMessage}
      </div>
    )}

    {/* Existing assignments table - Updates live! */}
    <AssignmentsTable assignments={assignments} />
  </div>
);
```

### Step 5: (Optional) Custom UI for Assignments

```typescript
// If you want to build custom UI instead of using GreedyRealtimeMonitor component:

return (
  <div className="roster-page">
    {isMonitoring && (
      <div className="custom-monitor">
        <h3>Greedy aan het werk...</h3>
        <div className="coverage-display">
          Coverage: <span className="percentage">{coverage.toFixed(1)}%</span>
        </div>
        <div className="assignment-count">
          Assigned: <span>{assignmentCount}</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${coverage}%` }}
          />
        </div>
        {lastUpdate && (
          <div className="timestamp">
            Last update: {lastUpdate.toLocaleTimeString('nl-NL')}
          </div>
        )}
      </div>
    )}
  </div>
);
```

---

## 🧩 API REFERENCE

### `useGreedyRealtimeMonitor(rosterId: string)`

**Input:**
- `rosterId`: UUID of the roster being monitored

**Returns:**
```typescript
{
  // State
  isMonitoring: boolean;           // Currently monitoring?
  assignments: RosterAssignment[]; // All assignments so far
  coverage: number;                // 0-100 percentage
  assignmentCount: number;         // How many assigned (status=1)
  errorMessage: string | null;     // Any error that occurred
  lastUpdate: Date | null;         // When was last update

  // Controls
  startMonitoring(instructions?: FrontendInstructions): void;
  stopMonitoring(): void;

  // Utils
  getAssignmentById(id: string): RosterAssignment | undefined;
  getAssignmentsByEmployee(employeeId: string): RosterAssignment[];
  getAssignmentsByDate(date: string): RosterAssignment[];
  getUnassignedCount(): number;
}
```

**Example Usage:**
```typescript
const { isMonitoring, coverage, getAssignmentsByEmployee } 
  = useGreedyRealtimeMonitor(rosterId);

// Get all assignments for employee 'EMP001'
const empAssignments = getAssignmentsByEmployee('EMP001');
console.log(`Employee EMP001 has ${empAssignments.length} assignments`);
```

### `<GreedyRealtimeMonitor />`

**Props:**
```typescript
{
  rosterId: string;              // Required: roster ID
  onComplete?: (stats) => void;  // Called when complete
  pollInterval?: number;         // Check completion every N ms (default: 5000)
}
```

**Example:**
```typescript
<GreedyRealtimeMonitor 
  rosterId={id}
  onComplete={(stats) => {
    console.log(`Done! Coverage: ${stats.coverage}%`);
  }}
  pollInterval={3000}
/>
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests (Jest/Vitest)

```typescript
describe('useGreedyRealtimeMonitor', () => {
  test('initializes with default state', () => {
    const { result } = renderHook(() => useGreedyRealtimeMonitor('test-id'));
    expect(result.current.isMonitoring).toBe(false);
    expect(result.current.coverage).toBe(0);
    expect(result.current.assignments).toHaveLength(0);
  });

  test('startMonitoring sets isMonitoring to true', () => {
    const { result } = renderHook(() => useGreedyRealtimeMonitor('test-id'));
    act(() => {
      result.current.startMonitoring();
    });
    expect(result.current.isMonitoring).toBe(true);
  });

  test('stopMonitoring sets isMonitoring to false', () => {
    const { result } = renderHook(() => useGreedyRealtimeMonitor('test-id'));
    act(() => {
      result.current.startMonitoring();
      result.current.stopMonitoring();
    });
    expect(result.current.isMonitoring).toBe(false);
  });
});
```

### Integration Tests (Staging Environment)

**Test Scenario 1: Full Workflow**
1. ✅ Load roster page
2. ✅ Create test roster (5 days, 3 services/day = 15 services)
3. ✅ Click "Start Roostering" button
4. ✅ Verify response received in < 1 second
5. ✅ Verify realtime monitor appears
6. ✅ Wait 10-30 seconds
7. ✅ Verify assignments appear live (not all at once)
8. ✅ Verify coverage % increases incrementally
9. ✅ Verify UI updates are smooth (no lag)
10. ✅ Verify all 15 services assigned (coverage ~100%)

**Test Scenario 2: Error Handling**
1. ✅ Stop Greedy service
2. ✅ Click "Start Roostering"
3. ✅ Verify error notification
4. ✅ Verify error message in monitoring component
5. ✅ Verify cleanup (no memory leak)

**Test Scenario 3: Premature Stop**
1. ✅ Start roostering
2. ✅ Wait 5 seconds (while Greedy is running)
3. ✅ Click "Stop Monitoring" button
4. ✅ Verify subscription is removed
5. ✅ Verify no more UI updates after stop

**Test Scenario 4: Page Unmount**
1. ✅ Start roostering
2. ✅ Wait 5 seconds
3. ✅ Navigate away from page
4. ✅ Verify subscription is cleaned up
5. ✅ Verify no console errors

### Manual Testing

```bash
# 1. Start development server
npm run dev

# 2. Open DevTools (F12)
# 3. Go to Console tab
# 4. Navigate to roster page
# 5. Click "Start Roostering"
# 6. Watch console for [DRAAD-205] logs
# 7. Watch realtime monitor update in UI
# 8. Verify coverage % increases
# 9. Refresh page and verify state persists
```

---

## 🐛 TROUBLESHOOTING

### Issue: Realtime updates not appearing

**Possible Causes:**
1. Supabase realtime not enabled on roster_assignments table
2. Supabase subscription not configured correctly
3. Network issue (WebSocket blocked)
4. Greedy not writing to DB

**Solutions:**
```typescript
// 1. Check if subscription is active (in browser console)
supabase
  .channel('test')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'roster_assignments' }, (payload) => {
    console.log('Received:', payload);
  })
  .subscribe();

// 2. Verify Supabase realtime is enabled
// In Supabase Dashboard → SQL Editor → Run:
ALTER PUBLICATION supabase_realtime ADD TABLE roster_assignments;

// 3. Check for WebSocket issues
// In Network tab (DevTools) → WS filter → look for supabase.co connections
```

### Issue: Coverage stuck at 0%

**Possible Causes:**
1. No assignments created yet
2. Greedy failed silently
3. Realtime event not received

**Solutions:**
```typescript
// 1. Check database directly (Supabase Dashboard)
SELECT * FROM roster_assignments 
WHERE roster_id = 'your-roster-id' AND status = 1;

// 2. Check Greedy logs (Railway)
// Go to Railway.com → Greedy service → Logs

// 3. Verify Greedy received request
GET /api/greedy/health
```

### Issue: Memory leak on unmount

**Possible Causes:**
1. Subscription not removed on cleanup
2. Component not unmounting properly

**Solutions:**
```typescript
// Ensure cleanup in useEffect
useEffect(() => {
  return () => {
    stopMonitoring(); // This removes subscription
  };
}, [stopMonitoring]);
```

### Issue: Slow UI updates

**Possible Causes:**
1. Large assignments array causing re-renders
2. Expensive component logic
3. Supabase latency

**Solutions:**
```typescript
// Use useMemo to prevent unnecessary re-renders
const memoizedAssignments = useMemo(() => assignments, [assignments]);

// Or use virtualization for large lists
import { FixedSizeList } from 'react-window';
```

---

## 📋 DEPENDENCIES

**Already installed (no new packages needed):**
- `@supabase/supabase-js` - For realtime subscriptions
- `react` - For hooks
- `next` - For page component

**Optional packages for enhanced UX:**
- `framer-motion` - For smooth animations
- `react-window` - For virtualized lists
- `react-query` - For data fetching (if needed)

---

## ✅ DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Supabase realtime enabled on roster_assignments table
- [ ] Frontend compiled successfully (no TypeScript errors)
- [ ] `useGreedyRealtimeMonitor` hook imported correctly
- [ ] Solve button handler updated to call `startMonitoring()`
- [ ] Error handling in place
- [ ] UI layout adjusted for monitor component
- [ ] Tested on staging environment
- [ ] Tested with real Greedy service running
- [ ] Performance verified (no lag with large rosters)
- [ ] Mobile responsiveness checked
- [ ] Browser compatibility verified (Chrome, Firefox, Safari, Edge)

---

## 🔄 ROLLBACK PLAN

If issues arise:

```bash
# Option 1: Revert commit
git revert <FASE-4-commit>

# Option 2: Disable monitoring temporarily
const isMonitoringEnabled = false; // feature flag

if (isMonitoringEnabled) {
  startMonitoring(data.frontend_instructions);
}

# Option 3: Restore to fallback behavior
// Remove startMonitoring() call
// Fall back to manual refresh after solving
```

---

## 📞 REFERENCES & LINKS

- **DRAAD-203:** Architecture Refactor Plan
- **DRAAD-204:** Backend Greedy Refactor (Fase 3)
- **DRAAD-205:** Frontend Integration (THIS FILE - Fase 4)
- **Supabase Realtime Docs:** https://supabase.com/docs/guides/realtime
- **Supabase JavaScript Client:** https://supabase.com/docs/reference/javascript
- **React Hooks API:** https://react.dev/reference/react/hooks

---

**Status:** ✅ PHASE 4 READY FOR IMPLEMENTATION  
**Next Steps:** Integrate into existing roster page component  
**Support:** Check console logs for [DRAAD-205] debug messages
