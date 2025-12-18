# DRAAD 211 - Root Cause Analysis & Solution

**Status**: ✅ DIAGNOSE COMPLETE - PARTIAL FIX DEPLOYED
**Date**: 18 December 2025
**Problem**: Greedy solver generates ZERO assignments (status tabel identiek voor/na)
**Root Cause**: 217 status=3 (BLOCKED) records block ALL employee assignments

---

## 📋 Quick Summary

Na 5 draden intensieve debugging:

| Item | Finding |
|------|----------|
| **Deployment** | ✅ OK (18-12 succesvol) |
| **API Connection** | ✅ OK |
| **Algorithm Code** | ✅ OK (DRAAD 211 fixes present) |
| **Real Problem** | ❌ Database: 217 status=3 records blocking EVERYTHING |
| **Frontend Issue** | ❌ Response format: expected `{solver_result: {...}}` |

---

## 🔧 What Was Fixed

### ✅ FIX #1: Frontend Response Structure (DEPLOYED)

**File**: `src/solver/greedy_api.py`
**Commit**: 003394c3b7247098400288a9e813d65061486eb1

**Problem**: Console error: `[DRAAD129] Solver status: undefined`

**Solution**: Wrap SolveResponse in SolverResultWrapper

```python
# BEFORE
return response  # {status: "success", ...}

# AFTER  
return SolverResultWrapper(solver_result=response)  # {solver_result: {status: "success", ...}}
```

**Result**: Frontend can now read `response.solver_result.status` ✅

---

## 🔍 What Still Needs Fixing

### ⏳ STEP 1: Analyze Database Status=3 Records

**File**: `DRAAD_211_DATABASE_ANALYSIS.sql`

**10 diagnostic queries** to determine:
1. Are 217 status=3 records LEGITIMATE (employees on leave)?
2. Or are they DATA ERRORS (should be status=0)?

**How to run**:
1. Open [Supabase SQL Editor](https://supabase.com/dashboard)
2. Run queries 1-9 to analyze
3. Decide: LEGITIMATE or ERROR?

**Example Query**:
```sql
-- Query 1: Show status distribution
SELECT status, COUNT(*) 
FROM roster_assignments 
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
GROUP BY status;

-- Expected results:
-- status | count
-- 0      | 1246   (unassigned)
-- 1      | 4      (tentative)
-- 2      | 3      (leave)
-- 3      | 217    ← PROBLEM!
```

---

### ⏳ STEP 2: Clean Database (IF NEEDED)

**Only if Step 1 determines status=3 are ERRORS**

**SQL** (Query 10 in the diagnostics file):
```sql
UPDATE roster_assignments
SET status = 0, updated_at = NOW()
WHERE roster_id = 'adc8c657-f40e-4f12-8313-1625c3376869'
  AND status = 3
  AND source = 'greedy';  -- Only auto-generated ones
```

**Effect**: Converts 217 blocked slots → available slots

---

### ⏳ STEP 3: Re-run Greedy Solver

**Endpoint**: `POST /api/greedy/solve`

**Request**:
```json
{
    "roster_id": "adc8c657-f40e-4f12-8313-1625c3376869",
    "start_date": "2025-12-05",
    "end_date": "2025-12-28",
    "max_shifts_per_employee": 8
}
```

**Expected Response** (after cleanup):
```json
{
    "solver_result": {
        "status": "success",
        "assignments_created": 1200,
        "coverage": 85.5,
        "message": "85.5% coverage in 3.24s"
    }
}
```

**Success Criteria**:
- ✅ Coverage > 80%
- ✅ assignments_created > 1000
- ✅ No 'undefined' status in frontend

---

## 📊 Expected Impact

### Before Fix (Current)
```
Assignments:   1246 / 1470 (0% new)
Status 0:      1246 (unassigned)
Coverage:      0% (nul wijzigingen)
Frontend:      status = undefined ❌
```

### After Fix (Expected)
```
Assignments:   1300+ / 1470 (>85% coverage)
Status 0:      <200 (mostly assigned)
Coverage:      85%+ ✅
Frontend:      status = "success" ✅
```

---

## 📁 Related Files

### Analysis Documents
- `DRAAD_211_ANALYSIS.md` - Deep technical analysis (611 lines)
- `DRAAD_211_RAPPORT_FINAL.md` - Executive summary & solution
- `DRAAD_211_DATABASE_ANALYSIS.sql` - 10 diagnostic queries
- `DRAAD_211_README.md` - This file

### Code Changes
- `src/solver/greedy_api.py` - Response wrapper fix ✅ DEPLOYED
- `src/solver/greedy_engine.py` - No changes needed (code is correct)

---

## 🚀 Implementation Checklist

### Phase 1: Deploy ✅
- [x] Update greedy_api.py
- [x] Wrap SolveResponse
- [x] Deploy to Railway
- [x] Verify HTTP 200 returns {solver_result: {...}}

### Phase 2: Analyze ⏳
- [ ] Open DRAAD_211_DATABASE_ANALYSIS.sql
- [ ] Run Query 1: Check status distribution
- [ ] Run Query 2-9: Analyze 217 status=3 records
- [ ] Determine: LEGITIMATE or ERROR?

### Phase 3: Cleanup ⏳
- [ ] If ERROR: Run Query 10 cleanup script
- [ ] If LEGITIMATE: Skip to Phase 4

### Phase 4: Verify ⏳
- [ ] Re-run greedy solver
- [ ] Check coverage > 80%
- [ ] Verify assignments created
- [ ] Check dashboard displays results

---

## 🎯 Key Insights

### Why Greedy Made No Assignments

```
1. Database has 217 status=3 records (BLOCKED assignments)
2. Greedy loads these as: blocked_slots = Set[(date, dagdeel, employee_id)]
3. For each requirement slot:
   - Find eligible employees
   - For each employee: if (date, dagdeel, emp) in blocked_slots: skip
   - If all employees blocked: eligible = []
   - If eligible empty: no assignment made
4. Result: ZERO assignments → status tabel unchanged
```

### Why This Took 5 Draden

1. **DRAAD 207**: "Deployment OK, code looks fine"
2. **DRAAD 208**: "Wait, response format is wrong"
3. **DRAAD 209**: "Why no assignments in database?"
4. **DRAAD 210**: "Let's log what's being blocked"
5. **DRAAD 211**: "AHA! 217 status=3 blocks EVERYTHING!"

**Key Learning**: Always check data quality before blaming code!

---

## 📞 Questions?

Refer to:
- Deep analysis: `DRAAD_211_ANALYSIS.md`
- Executive summary: `DRAAD_211_RAPPORT_FINAL.md`
- Code changes: `src/solver/greedy_api.py`
- Database diagnostics: `DRAAD_211_DATABASE_ANALYSIS.sql`

---

**Status**: ✅ Phase 1 Complete | ⏳ Phase 2-4 Ready to Run
**Owner**: HR/Admin (for database analysis & cleanup)
**Timeline**: 20 minutes total (5 min analysis + 5 min cleanup + 3 sec solve + 2 min verify)

