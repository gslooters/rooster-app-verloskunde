# DRAAD 348 - DEPLOYMENT VERIFICATION CHECKLIST

**Deployment Date:** 23 December 2025  
**Commit:** `2ddc0dd2782f8801698caf2029c9b35145ab46cb`  
**File:** `src/lib/afl/afl-engine.ts`

---

## 🚀 DEPLOYMENT TRACKING

### GitHub Status
- [✅] Code committed to main branch
- [✅] Push successful
- [✅] No merge conflicts
- [✅] CI/CD pipeline triggered (if available)

### Railway Build Status
**Check Railway logs at:** https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

#### Build Markers to Look For
```
[AFL-ENGINE] 🚀 DRAAD348 CACHE-BUST NONCE: 2025-12-23T22:00:00Z-DRAAD-348-PREPLANNING-FIX-<timestamp>
[AFL-ENGINE] ✅ DRAAD337 FIX: Client-side sorting
[AFL-ENGINE] ✅ DRAAD338 FIX: Service-code population
[AFL-ENGINE] ✅ DRAAD339 FIX: Enhanced debug logging
[AFL-ENGINE] ✅ DRAAD342 FIX: Team field in buildCapaciteit
[AFL-ENGINE] ✅ DRAAD348 FIX: Pre-planning invulling deduction in aantal_nog
```

**Build Steps:**
- [ ] Build started (check timestamp)
- [ ] Dependencies installed
- [ ] TypeScript compilation successful (no errors)
- [ ] Application started
- [ ] Health check passed

---

## 💫 FUNCTIONAL VERIFICATION

### Test 1: Run AFL Pipeline on Test Roster

**Steps:**
1. Open rooster app
2. Select Week 48-52 roster (or any recent roster)
3. Click "AFL Uitvoeren" button
4. Monitor Railway logs in parallel

**Expected Logs:**
```
[AFL-ENGINE] Phase 1.1: Fetching tasks...
  ✅ Tasks: 228 rows loaded

[AFL-ENGINE] Phase 1.2: Fetching planning slots...
  ✅ Planning: 1470 rows loaded

[AFL-ENGINE] Phase 1.3: Fetching capacity data...
  ✅ Capacity: 280 rows loaded

[AFL-ENGINE] Phase 1.4: Fetching service metadata...
  ✅ Services: 9 rows loaded

[AFL-ENGINE] Phase 1.5: Fetching rooster period...
  ✅ Rooster: Period 2025-11-24 to 2025-12-28

[AFL-ENGINE] Phase 1.6: Building workbenches...

[AFL-ENGINE] Phase 1.7a: Validating pre-planning match...
  ✅ All 6 protected assignments matched to tasks  <<<< CRITICAL

[AFL-ENGINE] Phase 1.7b: Adjusting capacity for pre-planning...
  ✅ Pre-planning adjustment: 6 capacity entries decremented

[AFL-ENGINE] Phase 1.7c: Verifying aantal_nog deductions...
  ✅ aantal_nog deductions verified:
     - Tasks with aantal_nog=0 (pre-planned): 6
     - Tasks with aantal_nog>0 (still open): 222
     - Total aantal_nog remaining: 228

[AFL-ENGINE] Phase 1.8: Data validation & statistics...
  ✅ All validation checks passed

[AFL-ENGINE] 📊 Workbestand_Opdracht stats:
  - Total tasks: 228
  - Total required diensten: 234
  - Total aantal_nog (remaining): 228  <<<< SHOULD = 234 - 6
  - System services: 96
  - Regular services: 138
  - Teams: { 'GRO': 84, 'ORA': 84, 'TOT': 24 }
```

**Verification Points:**
- [ ] All 6 protected assignments matched (no unmatched warnings)
- [ ] aantal_nog deductions verified (shows 6 with aantal_nog=0)
- [ ] Total aantal_nog = 228 (228 = 234 - 6 pre-planned) ✅
- [ ] No "Pre-planning adjustment NOT matched" warnings

### Test 2: Verify AFLstatus Count

**Query in Supabase:**
```sql
SELECT 
  status,
  COUNT(*) as count
FROM afl_execution_reports
WHERE roster_id = '<rooster-id>'
GROUP BY status;
```

**Expected Result:**
```
status | count
-------|-------
  0    | 823
  1    | 240   <<<< MUST BE 240 (not 242)
  2    | 176
  3    | 229
-------|-------
TOTAL  | 1468
```

**Verification Points:**
- [ ] Status 1 count = 240 (not 242, not 234)
- [ ] Status 0 count = available slots
- [ ] Status 2 count = blocked slots
- [ ] Status 3 count = unavailable
- [ ] Total count = 1468 (fixed rooster size)

### Test 3: Verify No Duplicate Assignments

**Query in Supabase:**
```sql
SELECT 
  employee_id,
  service_id,
  DATE(date),
  dagdeel,
  COUNT(*) as count
FROM afl_execution_reports
WHERE status = 1
GROUP BY employee_id, service_id, DATE(date), dagdeel
HAVING COUNT(*) > 1;
```

**Expected Result:**
```
(no rows)
```

If any rows appear:
- [ ] ERROR: Duplication still exists
- [ ] Rollback code immediately
- [ ] Debug which assignments are duplicated

### Test 4: Verify Karin's Assignments

**Query in Supabase:**
```sql
SELECT 
  employee_id,
  service_id,
  service_types.code,
  DATE(date),
  dagdeel,
  is_protected,
  status
FROM afl_execution_reports
JOIN service_types ON afl_execution_reports.service_id = service_types.id
WHERE employee_id = '<karin_id>'
ORDER BY DATE(date), dagdeel;
```

**Expected Result (Example):**
```
employee_id | code | date       | dagdeel | is_protected | status
------------|------|------------|---------|--------------|--------
karin_id    | DDO  | 2025-12-24 | O       | TRUE         | 1
karin_id    | DDA  | 2025-12-25 | A       | TRUE         | 1
karin_id    | RO   | 2025-12-26 | M       | FALSE        | 1
karin_id    | GRB  | 2025-12-27 | O       | FALSE        | 1
```

**Verification Points:**
- [ ] DDO appears ONCE (not twice) with is_protected=TRUE
- [ ] DDA appears ONCE (not twice) with is_protected=TRUE
- [ ] Other assignments have is_protected=FALSE
- [ ] All have status=1 (assigned)
- [ ] Total Karin assignments = capacity (reasonable)

### Test 5: Regression - Other Services Still Work

**Check:**
- [ ] DIO assignments created correctly
- [ ] Team fairness maintained
- [ ] No unexpected blocked slots
- [ ] Capacity respected across all employees

**Sample Query:**
```sql
SELECT 
  service_types.code,
  COUNT(*) as assigned_count
FROM afl_execution_reports
JOIN service_types ON afl_execution_reports.service_id = service_types.id
WHERE status = 1
GROUP BY service_types.code
ORDER BY service_types.code;
```

**Should show:**
- DIO: 46
- DIA: 46
- DDO: 38
- DDA: 38
- etc. (all should sum to 240)

---

## 🔍 DETAILED VERIFICATION RESULTS

### Phase 1 Load Logs
**Status:** [ ] PENDING

Copy-paste full Phase 1 log output here:
```
[paste logs]
```

**Review:**
- [ ] All "Phase 1.X" steps show ✅
- [ ] No error messages
- [ ] Timestamps reasonable (should be <1 second)
- [ ] Data counts match expectation

### AFLstatus Results
**Status:** [ ] PENDING

Copy-paste query result:
```
status | count
-------|-------
[paste results]
```

**Verification:**
- [ ] Status 1 = 240
- [ ] No duplication detected
- [ ] Totals match

### Karin Assignment Query
**Status:** [ ] PENDING

Copy-paste query results:
```
[paste results]
```

**Verification:**
- [ ] DDO protected=TRUE, count=1
- [ ] DDA protected=TRUE, count=1
- [ ] No duplicates

---

## ⚠️ ISSUES DETECTED (If Any)

**Issue 1:** [describe]  
**Severity:** [CRITICAL/HIGH/MEDIUM/LOW]  
**Status:** [ ] OPEN [ ] RESOLVED  
**Resolution:** [describe fix]

---

## ✅ FINAL APPROVAL

### Code Quality
- [ ] No syntax errors
- [ ] Types correct
- [ ] Logic verified
- [ ] Edge cases handled

### Functional Tests
- [ ] Phase 1 load works
- [ ] AFLstatus count correct (240)
- [ ] No duplicates
- [ ] Karin assignments correct
- [ ] Regression tests pass

### Deployment
- [ ] Railway build successful
- [ ] All DRAAD markers in logs
- [ ] Application serving requests
- [ ] No error traces

### Sign-Off
**Verified By:** [name]  
**Date:** [date]  
**Status:** [ ] APPROVED [ ] REJECTED  
**Comments:** [any notes]

---

## 📄 ROLLBACK CHECKLIST (If Needed)

If verification fails:

1. [ ] Check exact error in Railway logs
2. [ ] Document the failure
3. [ ] Stop AFL execution
4. [ ] Revert code:
   ```bash
   git revert 2ddc0dd
   ```
5. [ ] Wait for Railway rebuild
6. [ ] Verify application recovered
7. [ ] Create incident report

---

## 🌟 SUCCESS CRITERIA

**Fix is SUCCESSFUL if:**
- ✅ AFLstatus shows status=1 count = 240 (not 242)
- ✅ No duplicate assignments for any employee
- ✅ Karin DDO/DDA marked protected, appear once each
- ✅ All Phase 1 logs show validation passes
- ✅ Other services still work correctly
- ✅ Capacity calculations respect pre-planning

**Fix is FAILED if:**
- ❌ AFLstatus shows status=1 count = 242 (duplication persists)
- ❌ Any employee has duplicate assignments
- ❌ Phase 1 validation shows unmatched protected assignments
- ❌ Regression: other services broken
- ❌ Application errors or crashes

---

**Next Step After Verification:** ✅ Mark as RESOLVED when all checks pass

**Document Version:** 1.0  
**Created:** 2025-12-23T22:00:00Z  
**Status:** Ready for verification
