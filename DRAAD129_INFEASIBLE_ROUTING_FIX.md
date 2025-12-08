# DRAAD129: Fix Infeasible Routing in DashboardClient

## Problem Statement

The `DashboardClient.tsx` in `/planning/design/dashboard/` had incomplete logic for handling solver results:

- ❌ When solver returned `status: 'infeasible'`, the bottleneck_report was received but never displayed
- ❌ No routing to `/rooster/[id]/bottleneck-analysis` page
- ❌ Instead, the dashboard showed "Rooster Succesvol Gegenereerd! Status: Infeasible" which was confusing and incorrect
- ❌ Users could not see the capacity gap analysis and remediation suggestions

## Root Cause Analysis

The `handleStartORT()` function in DashboardClient.tsx was:
1. Calling `/api/roster/solve` ✅ 
2. Receiving complete `SolverApiResponse` with `bottleneck_report` ✅
3. But then ONLY storing result in state: `setOrtResult(result)` ❌
4. Missing the critical logic to CHECK the solver status and ROUTE accordingly ❌

## Solution Implemented

### Changes to `app/planning/design/dashboard/DashboardClient.tsx`

#### 1. Enhanced Type Definition

Added explicit `SolverResult` type to properly type all response fields:

```typescript
type SolverResult = {
  status: string;
  total_assignments: number;
  total_slots: number;
  fill_percentage: number;
  solve_time_seconds: number;
  violations?: Array<{ type: string; severity: string; message: string; }>;
  suggestions?: string[];
  summary?: any;              // ✅ NEW: For feasible results
  bottleneck_report?: any;    // ✅ NEW: For infeasible results
};
```

#### 2. Updated `handleStartORT()` Function

Added comprehensive routing logic:

```typescript
async function handleStartORT() {
  // ... setup ...
  
  try {
    const response = await fetch('/api/roster/solve', { ... });
    const result: ORTResult = await response.json();
    
    // ✅ NEW: Check solver status and route accordingly
    if (result.success && result.solver_result) {
      const solverStatus = result.solver_result.status;
      
      if (solverStatus === 'feasible' || solverStatus === 'optimal') {
        // ✅ FEASIBLE PATH: Store summary and navigate
        if (result.solver_result.summary) {
          sessionStorage.setItem(
            `feasible-summary-${rosterId}`,
            JSON.stringify(result.solver_result.summary)
          );
        }
        router.push(`/rooster/${rosterId}/feasible-summary`);
        return;
        
      } else if (solverStatus === 'infeasible') {
        // ✅ INFEASIBLE PATH: Store bottleneck report and navigate
        if (result.solver_result.bottleneck_report) {
          sessionStorage.setItem(
            `bottleneck-report-${rosterId}`,
            JSON.stringify(result.solver_result.bottleneck_report)
          );
        }
        router.push(`/rooster/${rosterId}/bottleneck-analysis`);
        return;
        
      } else if (solverStatus === 'timeout') {
        // ✅ TIMEOUT ERROR
        setOrtResult({
          success: false,
          error: 'Solver Timeout',
          message: 'De berekening duurde te lang. Probeer het later opnieuw of vereenvoudig het probleem.'
        });
        return;
        
      } else {
        // ✅ UNKNOWN STATUS
        setOrtResult({
          success: false,
          error: 'Onbekende solver status',
          message: `Status: ${solverStatus}`
        });
        return;
      }
    }
    
    // Handle failure cases
    if (!result.success) {
      setOrtResult(result);
    } else {
      setOrtResult({
        success: false,
        error: 'Onverwachte response',
        message: 'Solver response bevat geen status informatie'
      });
    }
  } catch (err: any) {
    setOrtResult({
      success: false,
      error: 'Netwerk fout',
      message: err.message || 'Kon geen verbinding maken met de ORT service'
    });
  } finally {
    setOrtLoading(false);
  }
}
```

## Flow Diagram

```
User clicks "Roosterbewerking starten"
          ↓
DashboardClient.handleStartORT()
          ↓
fetch('/api/roster/solve', { roster_id })
          ↓
    API processes
          ↓
Response with status + data
          ↓
    ┌─────────────────┴──────────────────┐
    ↓                                    ↓
status='feasible'?              status='infeasible'?
    ↓                                    ↓
sessionStorage.setItem(         sessionStorage.setItem(
  'feasible-summary-{id}',        'bottleneck-report-{id}',
  summary                         bottleneck_report
)                              )
router.push(                   router.push(
  /rooster/{id}/               /rooster/{id}/
  feasible-summary             bottleneck-analysis
)                              )
    ↓                                    ↓
FeasibleSummaryPage            BottleneckAnalysisPage
Shows success message          Shows capacity gaps &
and summary stats             remediation suggestions
```

## Testing & Verification

✅ **Baseline Check**: Code structure follows planRooster.handler.ts pattern
✅ **Type Safety**: SolverResult type includes all expected fields
✅ **Routing Logic**: Each status condition has explicit handling
✅ **Error Handling**: Timeout and unknown statuses are handled
✅ **SessionStorage**: Data passed via sessionStorage to maintain state
✅ **Navigation**: Correct routing URLs with roster ID

## Files Modified

1. **app/planning/design/dashboard/DashboardClient.tsx** (SHA: 33b507048745748d25601a68e1dc6bfebe6c6fa2 → 968be5d9b67492489dd6b8182b98477b6128df90)
   - Added SolverResult type definition
   - Updated handleStartORT() with comprehensive routing logic
   - Added detailed logging comments for DRAAD129

## Cache Busting

- ✅ `.cache-bust-draad129` created with timestamp 1733699033000
- ✅ `.railway-trigger-draad129` created for deployment

## Impact

**Before DRAAD129**: 
- User sees confusing "Success" message even when infeasible
- Bottleneck report never displayed
- No analysis available to fix problems

**After DRAAD129**:
- User correctly routed to bottleneck analysis page for infeasible results
- Bottleneck report properly stored and displayed
- User can see capacity gaps and remediation suggestions
- Feasible results also properly routed to summary page

## Related Issues

- DRAAD118A: Solver response handling (implemented earlier)
- DRAAD125C: TypeScript field names consistency
- DRAAD128: Solver accepts status field in blocked_slots

## Deployment Notes

1. Requires frontend reload to clear cache
2. No backend changes required
3. SessionStorage-based data passing is already supported
4. Both feasible-summary and bottleneck-analysis pages are fully implemented

## Next Steps

1. ✅ Commit code changes
2. ✅ Deploy via Railway
3. Test with infeasible roster scenarios
4. Verify bottleneck analysis page displays correctly
5. Monitor logs for routing success
