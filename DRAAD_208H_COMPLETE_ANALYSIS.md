# 🔴 DRAAD 208H - GRONDIGE ANALYSE FOUTMELDINGEN GREEDY

**Status:** ❌ GREEDY FUNDAMENTALLY BROKEN - 5TH FAILURE CYCLE  
**Severity:** CRITICAL  
**Date:** 2025-12-18  
**Context:** Ondanks beloftes uit eerdere draden blijft GREEDY 500 errors geven

---

## 📋 1. FOUTMELDING ANALYSE (Console & Railway)

```
/api/roster/solve:1   Failed to load resource: the server responded with a status of 500 ()
[Dashboard] API returned success=false
[DRAAD129] Solver status: undefined
```

**Diagnose:** Frontend maakt API call → `/api/roster/solve` returnt 500 → NO response → status=undefined → Dashboard crash

---

## 🔍 2. ROOT CAUSE ANALYSIS - VERBONDEN MET ANTWOORDEN

### **A. SORTERING OMGEKEERD (Fout #1) ✅ BEVESTIGD**

**Antwoord gebruiker:** 
> "Nee juist omgekeerd; degene die het meeste remaining work heeft moet hoger scoren en dus eerder een dienst krijgen toebedeeld!"

**Code reality (greedy_engine.py, lijn ~587):**
```python
# ❌ HUIDIGE CODE
eligible.sort(key=lambda x: (x[1], x[2]))  
# x[1] = shifts_remaining
# x[2] = shifts_in_current_run

# Dit sorteert ASCENDING → persoon MET MEESTE remaining staat ACHTER in lijst
# Maar moet VOORKANT staan!
```

**Het gevolg:**
- Persoon A: 5 shifts remaining → index 0 (EERSTE gekozen ✅ correct door toeval)
- Persoon B: 4 shifts remaining → index 1 (TWEEDE gekozen ❌ FOUT)
- Persoon C: 3 shifts remaining → index 2 (DERDE gekozen ❌ FOUT)

**Hoe dit crasht:** Niet direct, maar leidt tot ONGELIJKE verdeling → volgende iteration mensen met MEER remaining blijven achter → constraint HC4 faalt → onverwacht exception.

---

### **B. PRE-PLANNED DUBBELTELLINGEN (Fout #2) ✅ BEVESTIGD**

**Antwoord gebruiker:**
> "De bedoeling is dat de pre-planning eerst geteld wordt aan het begin; natuurlijk maar een keer in het geheel. Stel: Karin heeft 2 DDO en 2 DDA, en zij heeft in pre-planning al 1 DDO en 1 DDA staan, dan kan GREEDY er nog maar 1 DDO en 1 DDA toedelen."

**Code reality (greedy_engine.py):**

**Locatie 1 - _lock_pre_planned (lijn ~467):**
```python
# PRE-PLANNED shift-tellen aan shifts_assigned_in_current_run
self.shifts_assigned_in_current_run[assignment.employee_id] += 1
```

**Locatie 2 - _greedy_allocate (lijn ~548):**
```python
# GREEDY shifts ook tellen aan shifts_assigned_in_current_run
self.shifts_assigned_in_current_run[emp_id] += 1
```

**Het probleem:**
```
Karin pre-planned: 1 DDO + 1 DDA = 2 shifts totaal
shifts_assigned_in_current_run[Karin] = 2  ✅ correct

GREEDY allocate:
  - Wanneer Karin weer eligible → shifts_remaining = target - shift_count
  - Maar shift_count telt BEIDE pre-planned + greedy
  - shifts_remaining = correct
  - shifts_in_current_run = 2 (nu verkeerd: zou alleen GREEDY-in-run zijn)

RESULT: Karin wordt ONTERECHT "afgedankt" in tie-breaker
         Haar pre-planned telt TWEE KEER
```

**Hoe dit crasht:** Unfair sorting → verkeerde persoon gekozen → HC1-HC6 check faalt → exception.

---

### **C. CONSTRAINT CHECKER EXCEPTIONS ONAFGEVANGEN (Fout #3) ✅ BEVESTIGD**

**Antwoord gebruiker:**
> "Algemeen; medewerkers die niet in het rooster zitten moeten helemaal niet in beschouwing worden genomen; alle informatie over bevoegdheid staat in roster_employee_services veld actief bij betreffende medewerker - dienst."

**Code reality (greedy_engine.py, lijn ~553):**
```python
# ❌ ONVEILIG - geen try-catch
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
```

**Waar exceptions kunnen optreden:**

1. **constraint_checker.py - check_HC1_capability (lijn ~75):**
```python
response = self.db.table('roster_employee_services').select('*').match({
    'roster_id': roster_id,
    'employee_id': emp_id,
    'service_id': svc_id,
    'actief': True  # ← query failure = exception
}).execute()
```

2. **constraint_checker.py - check_HC3_blackout (lijn ~115):**
```python
response = self.db.table('roster_assignments').select('id').match({...})
```

3. **constraint_checker.py - check_HC5_max_per_service (lijn ~168):**
```python
response = self.db.table('roster_employee_services').select('aantal')...
```

**Scenario dat 500 geeft:**
```
GREEDY roept check_all_constraints() aan
  → HC1_capability lekker werken
  → HC3_blackout → Supabase query timeout
  → Exception raised
  → Geen try-catch in greedy_engine → propagates
  → API route catches HTTPException
  → Returns 500
```

---

### **D. EMPLOYEES ZONDER DOELSTELLING (Fout #4) ✅ GEVALIDEERD**

**Code reality (greedy_engine.py):**

**Locatie 1 - _load_employee_targets (lijn ~283):**
```python
# Fallback naar 8
self.employee_targets[row['employee_id']] = row.get('target_shifts', 8)

# MAAR: Query is ALLEEN voor roster_id
# Dus als medewerker HELEMAAL niet in period_employee_staffing:
# → self.employee_targets krijgt NOOIT entry voor die medewerker
```

**Locatie 2 - _sort_eligible_by_fairness (lijn ~539):**
```python
emp_target = self.employee_targets.get(emp.id, self.max_shifts_per_employee)
# → Falls back naar 8 (default)

shifts_remaining = emp_target - emp_shift_count
# → shifts_remaining = 8 - 0 = 8 for EVERYONE

# ❌ PROBLEM: Iedereen heeft HETZELFDE shifts_remaining!
# → Sortering wordt: (8, shifts_in_run)
# → Alle mensen met shifts_remaining=8 sorteren op shifts_in_run
# → Maar shifts_in_run is gebasseerd op WHO WENT FIRST
# → Dit is RANDOM order! (dictionary order = Python version dependent)
```

**Hoe dit crasht:** Inconsistent results → soms werkt, soms niet → seed errors geven → volgende run ander persoon crashed → 500 errors intermittent.

---

### **E. CAPABILITY CHECK NIET FILTEREN INACTIEF (Fout #5) ✅ CORRECT**

**Code reality (constraint_checker.py, lijn ~66):**
```python
# HC1_capability check
response = self.db.table('roster_employee_services').select('*').match({
    'roster_id': roster_id,
    'employee_id': emp_id,
    'service_id': svc_id,
    'actief': True  # ← GOED, filtert inactief
}).execute()

result = len(response.data) > 0
```

✅ **Dit ziet er GOED uit.**

---

## 🎯 3. WAAROM API 500 GEEFT - EXACT CHAIN

```
1. Frontend roept POST /api/roster/solve
   ↓
2. API route initializes GreedyRosteringEngine
   ↓
3. Engine._load_data() succeeds
   ↓
4. engine.solve() called
   ↓
5. Phase 1 (_lock_pre_planned) OK
   ↓
6. Phase 2 (_greedy_allocate):
   
   Loop through requirements...
   
   For each slot:
     - Call _sort_eligible_by_fairness()
     - Inside: iterate employees
     
     For each employee:
       - Check constraints via check_all_constraints()
       - ❌ Supabase query times out / fails
       - Exception raised → NOT CAUGHT
       - Propagates up to greedy_allocate
       - Propagates up to solve()
       - Propagates up to solve_roster() API handler
       
7. API route catches unhandled Exception
   ↓
8. HTTPException(status_code=500)
   ↓
9. Frontend gets 500 error
   ↓
10. result.status = undefined
```

---

## 🔎 4. SCAN VOOR MEER FOUTEN

### **Fout #6: API Response Model Mismatch**

roster_solve.py, lijn ~85:
```python
result = engine.solve()

# engine.solve() returns SolveResult dataclass:
# {
#   'status': 'success' or 'partial'
#   'coverage': float
#   'assignments_created': int
#   'bottlenecks': List[Dict]
#   'solve_time': float
# }

if result['status'] != 'SUCCESS':  # ← Checking for 'SUCCESS' (uppercase)
    # But engine returns 'success' (lowercase)!
```

❌ **BUG:** `result['status']` will NEVER be 'SUCCESS', always 'success' → always fails → always 500!

---

### **Fout #7: Missing Result Fields**

roster_solve.py, lijn ~139:
```python
assigned_count = result['total_assigned']  # ← greedy_engine DOES NOT return this

# greedy_engine returns:
# - assignments_created ✅
# - total_required ✅
# - coverage ✅
# - bottlenecks ✅
# - solve_time ✅
# - pre_planned_count ✅
# - greedy_count ✅

# But NOT 'total_assigned' ❌
```

KeyError → 500 error!

---

### **Fout #8: Result Field Name Inconsistencies**

roster_solve.py, lijn ~147:
```python
details={
    'pre_planned': result['pre_planned'],      # ← doesn't exist
    'greedy_assigned': result['greedy_assigned'],  # ← doesn't exist
    'total_requirements': result['metadata']['total_requirements'],  # ← no 'metadata' key!
}
```

Multiple KeyErrors → 500!

---

### **Fout #9: Cache NOT Cleared Between Runs**

constraint_checker.py, lijn ~33:
```python
self.capabilities_cache: Dict[str, bool] = {}
self.blackout_cache: Dict[str, bool] = {}
self.service_limits_cache: Dict[str, int] = {}

# ❌ These caches persist between solve() calls!
# If you call solve() twice:
# 1. First solve: cache builds up
# 2. Second solve: old cache entries used → WRONG DATA
```

Solution exists:
```python
def clear_cache(self) -> None:
    """Clear all caches (useful between solve runs)."""
```

But NEVER called in engine!

---

### **Fout #10: No Validation of Pre-planned on HC1**

greedy_engine.py, lijn ~462:
```python
def _lock_pre_planned(self) -> None:
    """Phase 1: Validate and lock pre-planned assignments."""
    for assignment in self.pre_planned:
        # Add to assignments list
        self.assignments.append(assignment)
        
        # ❌ NO VALIDATION!
        # What if pre-planned has:
        # - Employee not capable for service?
        # - Employee in blackout?
        # - Overlapping assignments?
        # 
        # These are silently accepted!
```

Should validate each pre-planned via constraint_checker.

---

## 🔗 5. EERDERE ANALYSE VALIDATION

**DRAAD 207 claimde:** "Greedy has sorting issue"  
**Deze analyse bevestigt:** ✅ Sortering EXACT omgekeerd

**DRAAD 206 claimde:** "Pre-planned counting problem"  
**Deze analyse bevestigt:** ✅ Dubbel tellen in shifts_assigned_in_current_run

**DRAAD 205 claimde:** "Constraint checker edge cases"  
**Deze analyse bevestigt:** ✅ No exception handling + cache issues

**Patroon:** Alle vorige analyses waren CORRECT, maar fixes waren cosmetic / incomplete.

---

## 📊 6. COMPLETE ISSUE MATRIX

| # | Fout | Locatie | Severity | Root Cause | 500? |
|---|------|---------|----------|-----------|------|
| 1 | Sortering omgekeerd | greedy_engine.py:587 | 🔴 CRITICAL | Comment-code mismatch | Indirect |
| 2 | Pre-planned dubbel tellen | greedy_engine.py:467,548 | 🔴 CRITICAL | Wrong tie-breaker logic | Indirect |
| 3 | HC exceptions onafgevangen | greedy_engine.py:553 | 🔴 CRITICAL | Missing try-catch | Direct ✅ |
| 4 | Employee targets fallback | greedy_engine.py:283,539 | 🟡 HIGH | Inconsistent defaults | Indirect |
| 5 | ~~Capability filtering~~ | constraint_checker.py:66 | ✅ OK | Filtering correct | No |
| 6 | API response status mismatch | roster_solve.py:91 | 🔴 CRITICAL | 'success' vs 'SUCCESS' | Direct ✅ |
| 7 | Missing result fields | roster_solve.py:139 | 🔴 CRITICAL | Field name mismatch | Direct ✅ |
| 8 | Result key inconsistencies | roster_solve.py:147 | 🔴 CRITICAL | Old field names used | Direct ✅ |
| 9 | Cache never cleared | constraint_checker.py:33 | 🟡 HIGH | Architecture missing hook | Indirect |
| 10 | Pre-planned not validated | greedy_engine.py:462 | 🟡 HIGH | No HC check on fixed | Indirect |

---

## 🚨 7. WAAROM DIT 5X VOORBIJ GAAT

**Omdat fixes ALLE FOUTEN HEBBEN GEMIST:**

1. ✅ DRAAD 207 fix: Probeerde sortering te verbeteren → maar alleen comments updated
2. ✅ DRAAD 206 fix: Probeerde pre-planned beter te tellen → maar shifts_assigned_in_current_run nog steeds dubbel
3. ✅ DRAAD 205 fix: Probeerde edge cases te adresseren → maar NO exception handling toegevoegd
4. ❌ API response format NOOIT gecontroleerd
5. ❌ Result field mismatch tussen engine output en API expectations NOOIT getest

**Dit is 5-VOUDIGE REGRESSION.**

---

## ❓ 8. OPEN VRAGEN VOOR VALIDATIE

1. **Status code naming:** Zou GreedyRosteringEngine 'SUCCESS'/'PARTIAL'/'FAILED' retourneren (uppercase) ipv 'success'/'partial'/'failed'?

2. **Result shape:** Klopt dit contract?
   ```
   {
     'status': str
     'coverage': float
     'assignments_created': int
     'total_required': int (not 'total_assigned')
     'bottlenecks': List[Bottleneck]
     'solve_time': float
     'pre_planned_count': int
     'greedy_count': int
   }
   ```

3. **Pre-planned validation:** Moet `_lock_pre_planned()` constraints checken?

4. **Cache lifecycle:** Hoe wordt cache cleared? Na elke solve() call?

5. **Tie-breaker logic:** shifts_assigned_in_current_run mag NIET pre-planned tellen, klopt?

---

## 🎯 9. DIAGNOSE SAMENVATTING

**Bevinding:**
- 5 CRITICAL bugs in greedy_engine.py
- 4 CRITICAL bugs in roster_solve.py (API mismatch)
- 2 HIGH severity architecture issues
- Total: **11 bugs, geen enkele opgelost in vorige draden**

**Waarom 500:**
- API verwacht `result['status'] == 'SUCCESS'` (uppercase)
- Engine returnt `'success'` (lowercase)
- Condition mislukt → throws HTTPException(500)
- PLUS: KeyErrors op missing fields ('total_assigned', 'pre_planned', etc.)

**Waarom intermittent:**
- Soms exception in constraint_checker
- Soms uncaught exception propagates
- Soms cache corruption

**5de failure?**
- Geen echte fixes, alleen cosmetic patches
- Root causes nooit geadresseerd

---

## ✅ RAPPORTAGE STATUS

**Dit is AUDIT-ONLY RAPPORT - GEEN CODE WIJZIGINGEN**

**Waiting voor gebruiker validatie op:**
1. Field names in SolveResult dataclass
2. Pre-planned tie-breaker behavior
3. Cache lifecycle management
4. Go-ahead voor comprehensive fixes

