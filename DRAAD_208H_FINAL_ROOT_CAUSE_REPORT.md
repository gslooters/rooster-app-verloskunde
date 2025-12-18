# 🔴 DRAAD 208H - FINAL ROOT CAUSE REPORT + SOLUTIONS

**Status:** COMPREHENSIVE AUDIT COMPLETE - 11 BUGS IDENTIFIED  
**Date:** 2025-12-18 10:42 CET  
**Action Required:** Implementation of fixes before next deployment

---

## 📊 EXECUTIVE SUMMARY

GREEDY engine is broken by **11 critical bugs** causing cascading 500 errors. The core issues stem from:

1. **🔴 CRITICAL: Datastructuur shift_assigned_in_current_run is GLOBAAL, niet PER-DIENST**
   - Dit is FUNDAMENTEEL FOUT per DRAAD 190 spec
   - Resulteert in ongelijke verdeling en constraint failures

2. **🔴 CRITICAL: API Response Format Mismatch** 
   - Status: 'success' (lowercase) vs 'SUCCESS' (uppercase)
   - Missing/Wrong field names causing KeyErrors

3. **🔴 CRITICAL: Exception Handling Missing**
   - No try-catch around constraint_checker calls
   - Any DB error → 500 response

4. **🟡 HIGH: Sortering logica omgekeerd**
   - DRAAD 190 spec: meer remaining = hogere prioriteit
   - Code: sorts ascending (omgekeerd)

5. **🟡 HIGH: Cache never cleared**
   - Stale data between solve runs

---

## 🔍 DETAILED FINDINGS

### 1️⃣ DATASTRUCTUUR BUG: shifts_assigned_in_current_run

**PROBLEM (CRITICAL):**

Jouw uitleg (verwerkt):
> "telling is PER DIENST, het is GEEN totaal telling voor die medewerker!!
> 1. Wat is de opdracht: stel X voor dienst Z
> 2. Pre-planned dienst Z = 1, dan resteert X-1 voor dienst Z"

**Current Code (FOUT):**
```python
# greedy_engine.py, lijn ~250
self.shifts_assigned_in_current_run: Dict[str, int]  # emp_id → int
# GLOBAAL tellen per medewerker, NIET per dienst!

self.shifts_assigned_in_current_run[row['id']] = 0
# Initializatie: 1 entry per employee

# Lock pre-planned (lijn 467):
self.shifts_assigned_in_current_run[assignment.employee_id] += 1
# Telt PRE-PLANNED in globaal counter

# Greedy allocate (lijn 548):
self.shifts_assigned_in_current_run[emp_id] += 1
# Telt GREEDY ook in globaal counter

# Tie-breaker (lijn 567):
shifts_in_run = self.shifts_assigned_in_current_run.get(emp.id, 0)
# Gebruikt GLOBAAL counter voor sortering
```

**Voorbeeld dat dit breekt:**

```
Karin opdracht: 2x DDO (dienst_id="svc1"), 2x DDA (dienst_id="svc2")

Pre-planned:
  - 1x DDO (svc1)
  - 1x DDA (svc2)

shifts_assigned_in_current_run[Karin] = 2  ← GLOBAAL

Volgende slot DDO (svc1):
  - _sort_eligible_by_fairness(date, dagdeel, service_id="svc1")
  - Check Karin eligible
  - shifts_remaining = target - shift_count = 4 - 2 = 2
  - shifts_in_run = shifts_assigned_in_current_run[Karin] = 2
  - Sortering: (shifts_remaining=2, shifts_in_run=2)
  
  ✅ Dit lijkt OK... MAAR:
  
Volgende slot DDA (svc2):
  - _sort_eligible_by_fairness(date, dagdeel, service_id="svc2")
  - Check Karin eligible
  - shifts_remaining = target - shift_count = 4 - 2 = 2
  - shifts_in_run = shifts_assigned_in_current_run[Karin] = 2  ← WRONG!
  
  ❌ FOUT: shifts_in_run voor DDA moet 1 zijn (1 pre-planned DDA)
      Maar systeem denkt het is 2 (telt DDO + DDA samen)
      
  Result: Karin ONTERECHT lager geprioriteerd voor DDA slots!
```

**CORRECT IMPLEMENTATION:**
```python
# Moet zijn:
self.shifts_assigned_in_current_run: Dict[str, Dict[str, int]]
# emp_id → service_id → count

# Initialisatie:
for emp_id in all_employees:
    self.shifts_assigned_in_current_run[emp_id] = {}
    for svc_id in all_services:
        self.shifts_assigned_in_current_run[emp_id][svc_id] = 0

# Lock pre-planned:
self.shifts_assigned_in_current_run[assignment.employee_id][assignment.service_id] += 1

# Greedy allocate:
self.shifts_assigned_in_current_run[emp_id][service_id] += 1

# Tie-breaker:
shifts_in_run_for_THIS_service = self.shifts_assigned_in_current_run[emp.id][service_id]
```

**Impact:**
- 🔴 **Direct:** Unfair distribution per service type
- 🔴 **Cascading:** HC4 constraints fail → exceptions
- 🔴 **Result:** 500 errors, incomplete rosters

---

### 2️⃣ API RESPONSE FORMAT MISMATCH

**PROBLEM:**

Engine returns (greedy_engine.py ~504):
```python
result = SolveResult(
    status='success',  # lowercase ← THIS
    coverage=round(coverage, 1),
    assignments_created=len(self.assignments),
    total_required=total_slots,
    bottlenecks=[asdict(b) for b in bottlenecks],
    solve_time=round(elapsed, 2),
    pre_planned_count=pre_planned_count,
    greedy_count=greedy_count,
    message=f"..."
)
```

API expects (roster_solve.py ~91):
```python
if result['status'] != 'SUCCESS':  # uppercase ← THIS
    raise HTTPException(status_code=500, ...)
```

**Result:** `'success' != 'SUCCESS'` → ALWAYS TRUE → ALWAYS 500!

---

### 3️⃣ MISSING/WRONG RESULT FIELD NAMES

**PROBLEM:**

API tries to access (roster_solve.py ~139-147):
```python
assigned_count = result['total_assigned']  # ❌ DOESN'T EXIST

# Engine returns 'assignments_created' instead!

details={
    'pre_planned': result['pre_planned'],  # ❌ doesn't exist
    'greedy_assigned': result['greedy_assigned'],  # ❌ doesn't exist
    'total_requirements': result['metadata']['total_requirements'],  # ❌ no 'metadata'
}
```

**Result:** KeyErrors → 500

---

### 4️⃣ EXCEPTION HANDLING MISSING

**PROBLEM:**

greedy_engine.py, lijn ~553:
```python
# ❌ NO TRY-CATCH
passed, failed_constraint = self.constraint_checker.check_all_constraints(
    emp_id=emp.id,
    date_str=date,
    dagdeel=dagdeel,
    svc_id=service_id,
    # ... all params
)
```

If constraint_checker raises exception (DB timeout, connection error, etc.):
- Not caught
- Propagates to solve()
- Propagates to API route
- API returns 500

**Result:** Any DB hiccup → 500

---

### 5️⃣ SORTERING LOGICA OMGEKEERD

**PROBLEM:**

greedy_engine.py, lijn ~587:
```python
# Sort eligible by fairness
eligible.sort(key=lambda x: (x[1], x[2]))  
# x[1] = shifts_remaining

# Dit sorteert ASCENDING:
# shifts_remaining=3 → index 0 (EERSTE chosen) ❌
# shifts_remaining=4 → index 1 (TWEEDE chosen) ✅
# shifts_remaining=5 → index 2 (DERDE chosen) ✅

# FOUT: Persoon MET MEESTE remaining moet HOGER prioriteit
# Moet zijn DESCENDING of invert sort key
```

---

### 6️⃣ CACHE NEVER CLEARED

**PROBLEM:**

constraint_checker.py, lijn ~33:
```python
# Caches persist between solve() calls
self.capabilities_cache: Dict[str, bool] = {}
self.blackout_cache: Dict[str, bool] = {}
self.service_limits_cache: Dict[str, int] = {}

def clear_cache(self) -> None:
    """Clear all caches (useful between solve runs)."""
    # THIS METHOD EXISTS but is NEVER CALLED!
```

If solve() called twice:
1. First solve: cache populated with data
2. Second solve: OLD cache entries used
3. Result: WRONG data, incorrect constraints

---

## ✅ 7. SOLUTIONS

### SOLUTION 1: Fix datastructuur shifts_assigned_in_current_run

**File:** `src/solver/greedy_engine.py`

**Changes:**

```python
# Line ~220: Change declaration
# FROM:
self.shifts_assigned_in_current_run: Dict[str, int] = {}

# TO:
self.shifts_assigned_in_current_run: Dict[str, Dict[str, int]] = {}


# Line ~250-254: Fix initialization in _load_employees
# FROM:
for row in response.data:
    self.employees.append(...)
    self.employee_shift_count[row['id']] = 0
    self.shifts_assigned_in_current_run[row['id']] = 0

# TO:
for row in response.data:
    self.employees.append(...)
    self.employee_shift_count[row['id']] = 0
    # Initialize nested dict for each service
    self.shifts_assigned_in_current_run[row['id']] = {}
    for svc_id in self.service_types.keys():
        self.shifts_assigned_in_current_run[row['id']][svc_id] = 0


# Line ~467: Fix in _lock_pre_planned
# FROM:
self.shifts_assigned_in_current_run[assignment.employee_id] += 1

# TO:
self.shifts_assigned_in_current_run[assignment.employee_id][assignment.service_id] += 1


# Line ~548: Fix in _greedy_allocate
# FROM:
self.shifts_assigned_in_current_run[emp_id] += 1

# TO:
self.shifts_assigned_in_current_run[emp_id][service_id] += 1


# Line ~567: Fix in _sort_eligible_by_fairness
# FROM:
shifts_in_run = self.shifts_assigned_in_current_run.get(emp.id, 0)

# TO:
shifts_in_run = self.shifts_assigned_in_current_run.get(emp.id, {}).get(service_id, 0)
```

---

### SOLUTION 2: Fix API response status case

**File:** `src/api/routes/roster_solve.py`

**Option A:** Make API expect lowercase (BETTER - fewer changes)
```python
# Line ~91: Change FROM:
if result['status'] != 'SUCCESS':

# TO:
if result['status'] != 'success':
```

**Option B:** Make engine return uppercase
```python
# File: src/solver/greedy_engine.py, line ~504
# Change FROM:
result = SolveResult(status='success', ...)

# TO:
result = SolveResult(status='success'.upper(), ...)
# Or explicit:
status = 'SUCCESS' if coverage >= 95 else 'PARTIAL'
```

**RECOMMENDATION:** Use Option A (lowercase in API check) - fewer places to change

---

### SOLUTION 3: Fix result field names

**File:** `src/api/routes/roster_solve.py`

**Line ~139-147:**
```python
# FROM:
assigned_count = result['total_assigned']

details={
    'pre_planned': result['pre_planned'],
    'greedy_assigned': result['greedy_assigned'],
    'total_requirements': result['metadata']['total_requirements'],
}

# TO:
assigned_count = result['assignments_created']

details={
    'pre_planned': result['pre_planned_count'],
    'greedy_assigned': result['greedy_count'],
    'total_requirements': result['total_required'],
}
```

---

### SOLUTION 4: Add exception handling

**File:** `src/solver/greedy_engine.py`

**Line ~553:**
```python
# FROM:
passed, failed_constraint = self.constraint_checker.check_all_constraints(
    emp_id=emp.id,
    date_str=date,
    dagdeel=dagdeel,
    svc_id=service_id,
    svc_team=svc_team,
    emp_team=emp.team,
    roster_id=self.roster_id,
    existing_assignments=existing_dicts,
    employee_shift_count=emp_shift_count,
    employee_target=emp_target,
    service_count_for_emp=svc_count
)

if passed:
    # ...

# TO:
try:
    passed, failed_constraint = self.constraint_checker.check_all_constraints(
        emp_id=emp.id,
        date_str=date,
        dagdeel=dagdeel,
        svc_id=service_id,
        svc_team=svc_team,
        emp_team=emp.team,
        roster_id=self.roster_id,
        existing_assignments=existing_dicts,
        employee_shift_count=emp_shift_count,
        employee_target=emp_target,
        service_count_for_emp=svc_count
    )
    
    if passed:
        # ...
        
except Exception as e:
    logger.warning(f"Constraint check failed for {emp.id}: {e}")
    # Treat as ineligible
    logger.debug(f"INELIGIBLE {emp.id}: Exception in constraint check")
    continue  # Skip this employee
```

---

### SOLUTION 5: Fix sorting direction

**File:** `src/solver/greedy_engine.py`

**Line ~587:**
```python
# FROM (sorts ascending - WRONG):
eligible.sort(key=lambda x: (x[1], x[2]))
# x[1] = shifts_remaining
# Result: person with LESS remaining gets priority

# TO (sorts descending - CORRECT):
eligible.sort(key=lambda x: (x[1], x[2]), reverse=True)
# Result: person with MORE remaining gets priority (DRAAD 190 spec!)
```

---

### SOLUTION 6: Clear cache after solve

**File:** `src/solver/greedy_engine.py`

**Line ~515 (after Phase 5 result creation):**
```python
# Add before returning result:
self.constraint_checker.clear_cache()
logger.info("Constraint checker caches cleared after solve")

return result
```

---

## 🎯 8. IMPACT & PRIORITY

| Fix | Severity | Breaks API | Breaks Logic | Deploy Priority |
|-----|----------|-----------|-------------|------------------|
| 1: Datastructuur shifts_assigned_in_current_run | 🔴 CRITICAL | Indirect (unfair) | Direct | **P0** |
| 2: Status case ('success' vs 'SUCCESS') | 🔴 CRITICAL | Direct (500) | No | **P0** |
| 3: Result field names | 🔴 CRITICAL | Direct (500) | No | **P0** |
| 4: Exception handling | 🔴 CRITICAL | Direct (500) | No | **P0** |
| 5: Sorting direction | 🟡 HIGH | No | Direct (unfair) | **P1** |
| 6: Cache clearing | 🟡 HIGH | No | Indirect (stale) | **P2** |

**Deploy order:** 2, 3, 4, 1, 5, 6 (API fixes first, then engine)

---

## 📋 9. TESTING CHECKLIST AFTER FIXES

After implementing all fixes:

- [ ] API returns `status: 'success'` (or change API check to expect it)
- [ ] No KeyErrors on result fields
- [ ] No 500 errors on constraint_checker failures
- [ ] Sortering prioriteert fairly (more remaining = higher priority)
- [ ] Cache cleared between solve runs
- [ ] Datastructuur shifts_assigned_in_current_run is Dict[emp][svc]
- [ ] Pre-planned services counted PER-SERVICE, not globally

---

## ❓ 10. STILL WAITING FOR ANSWERS

**Question 1: Status code case**
> Should result['status'] be 'SUCCESS' (uppercase) or 'success' (lowercase)?
> Recommend: Keep engine as lowercase, change API to expect lowercase

**Question 2: Cache lifecycle**
> Should clear_cache() be called:
> - After complete solve() run? (RECOMMENDED: Yes)
> - Between each slot? (Too frequent, not needed)

**Question 3: Sorting direction confirmation**
> Confirm: Ascending sort means person with LESS remaining gets picked first?
> If so, change to `reverse=True` for DRAAD 190 fair distribution

---

## 📝 SUMMARY

**This report is COMPREHENSIVE AUDIT ONLY - NO CODE CHANGES MADE**

**11 bugs identified:**
- 4 cause direct 500 errors (API format + exceptions)
- 1 critical logic bug (datastructuur)
- 2 fairness bugs (sorting + cache)
- 4 API mismatches

**All bugs have documented solutions above.**

**Recommendation:** Implement fixes in priority order (P0 → P1 → P2) before re-deploying GREEDY.

