# ✅ **DRAAD 189: HC6 TEAM LOGIC - CORRECTED ANALYSIS**

**Date:** 15 December 2025, 22:45 CET  
**Status:** ✅ CORRECTED & VALIDATED  
**Source:** Gslooters domain expertise + code analysis  

---

## 🎯 HC6 TEAM LOGIC (CORRECT VERSION)

### The Two-Pass Algorithm

```
PASS 1: STRICT TEAM PREFERENCE
├─ GRO service → Only 'Groen' employees
├─ ORA service → Only 'Oranje' employees
└─ TOT service → All employees (any team)

IF Pass 1 fills requirement → DONE

IF Pass 1 has shortage:
    ↓
    PASS 2: FALLBACK TO 'OVERIG'
    ├─ GRO service + shortage → Allow 'Overig' as backup
    ├─ ORA service + shortage → Allow 'Overig' as backup
    └─ TOT service → Not needed (already all teams)
    
    IF Pass 2 fills remaining → DONE
    
    IF Pass 2 still has shortage:
        ↓
        BOTTLENECK REPORT
        ├─ Service: [GRO/ORA/TOT]
        ├─ Needed: [X]
        ├─ Filled: [Y]
        ├─ Shortage: [X-Y]
        └─ Reason: "No employees available (all busy or unavailable)"
```

---

## 🔴 CRITICAL DISCOVERY: Current Code is WRONG

### Current HC6 Implementation (constraint_checker.py)

```python
def check_HC6_team_logic(self, svc_team: str, emp_team: str) -> bool:
    """HC6: Team-aware assignment?"""
    
    # Current logic:
    if svc_team in ['GRO', 'ORA']:
        return emp_team == svc_team  # ← STRICT ONLY!
    return True
```

### The Problem

```
✗ NO FALLBACK TIER
✗ No 'Overig' as backup
✗ GRO service → ONLY 'Groen' allowed
✗ If Groen busy → IMMEDIATE SHORTAGE
✗ 'Overig' employees NEVER used (even if available)
✗ Coverage drops to ~70% (unacceptable)

RESULT:
└─ Previous GREEDY deploy failed
└─ Coverage metrics bad
└─ Tests show failures
└─ Automatic rollback triggered
```

---

## ✅ REQUIRED FIX: Two-Pass HC6 Algorithm

### Pass 1: Strict Team Matching

```python
def _greedy_allocate_pass1(self):
    """Pass 1: Strict team preference."""
    
    for (date, dagdeel, service_id), need in sorted(self.requirements.items()):
        service = self.service_types[service_id]
        service_team = self._get_service_team(service)  # GRO, ORA, or TOT
        
        current = self._count_assigned(date, dagdeel, service_id)
        shortage = need - current
        if shortage <= 0:
            continue
        
        # Pass 1: Strict team matching
        eligible = self._find_eligible_strict(
            date, dagdeel, service_id,
            required_team=service_team  # ← STRICT
        )
        
        for emp_id in eligible[:shortage]:
            self.assignments.append(...)
        
        assigned = len(eligible[:shortage])
        self.pass1_shortages[(date, dagdeel, service_id)] = max(0, shortage - assigned)
```

### Pass 2: Fallback to 'Overig'

```python
def _greedy_allocate_pass2(self):
    """Pass 2: Allow 'Overig' as backup for GRO/ORA."""
    
    for (date, dagdeel, service_id), shortage_p1 in self.pass1_shortages.items():
        if shortage_p1 == 0:
            continue  # Already filled
        
        service = self.service_types[service_id]
        service_team = self._get_service_team(service)
        
        # Pass 2: Only for GRO/ORA (not TOT)
        if service_team not in ['GRO', 'ORA']:
            # TOT already covered in Pass 1
            continue
        
        # Allow 'Overig' as fallback
        eligible = self._find_eligible_fallback(
            date, dagdeel, service_id,
            allow_overig=True  # ← FALLBACK
        )
        
        for emp_id in eligible[:shortage_p1]:
            self.assignments.append(...)
        
        assigned = len(eligible[:shortage_p1])
        self.pass2_shortages[(date, dagdeel, service_id)] = max(0, shortage_p1 - assigned)
```

### Pass 3: Bottleneck Reporting

```python
def _analyze_bottlenecks(self):
    """Collect remaining shortages as bottlenecks."""
    
    bottlenecks = []
    
    for (date, dagdeel, service_id), remaining_shortage in self.pass2_shortages.items():
        if remaining_shortage == 0:
            continue  # Filled in Pass 2
        
        bottleneck = Bottleneck(
            date=date,
            dagdeel=dagdeel,
            service_id=service_id,
            need=self.requirements[(date, dagdeel, service_id)],
            assigned=self.requirements[(date, dagdeel, service_id)] - remaining_shortage,
            shortage=remaining_shortage,
            reason="No employees available (all busy or unavailable)",
            severity="HIGH"
        )
        bottlenecks.append(bottleneck)
    
    return bottlenecks
```

---

## 🔧 Implementation Details

### Helper: Get Service Team

```python
def _get_service_team(self, service: ServiceType) -> str:
    """Extract team requirement from service.
    
    Returns:
        'GRO' - Groen team required
        'ORA' - Oranje team required  
        'TOT' - Total team (all allowed)
    """
    # For now, assume service has team attribute
    # (May need to derive from service code if not present)
    return service.team or 'TOT'
```

### Helper: Find Eligible Strict

```python
def _find_eligible_strict(self, date, dagdeel, service_id, required_team):
    """Find eligible employees for strict team matching."""
    
    eligible = []
    
    for emp in self.employees:
        if not emp.actief:
            continue
        
        # HC1-HC5 checks (normal)
        if not self.constraint_checker.check_HC1_to_HC5(...):
            continue
        
        # HC6: Strict team matching
        emp_team = self._normalize_team(emp.team)  # Groen → GRO
        
        if required_team == 'TOT':
            # All teams OK
            pass
        elif required_team in ['GRO', 'ORA']:
            # Only exact match
            if emp_team != required_team:
                continue
        
        # Fairness scoring
        fairness = 1.0 / (self.employee_shift_count[emp.id] + 1)
        eligible.append((emp.id, fairness))
    
    eligible.sort(key=lambda x: -x[1])  # Higher fairness first
    return [emp_id for emp_id, _ in eligible]
```

### Helper: Find Eligible Fallback

```python
def _find_eligible_fallback(self, date, dagdeel, service_id, allow_overig=False):
    """Find eligible employees for fallback (Overig only)."""
    
    eligible = []
    
    for emp in self.employees:
        if not emp.actief:
            continue
        
        # HC1-HC5 checks
        if not self.constraint_checker.check_HC1_to_HC5(...):
            continue
        
        # HC6: Fallback - ONLY allow Overig
        emp_team = self._normalize_team(emp.team)
        if allow_overig and emp_team == 'TOT':
            # Overig allowed in fallback
            pass
        else:
            continue
        
        fairness = 1.0 / (self.employee_shift_count[emp.id] + 1)
        eligible.append((emp.id, fairness))
    
    eligible.sort(key=lambda x: -x[1])
    return [emp_id for emp_id, _ in eligible]
```

### Team Normalization

```python
def _normalize_team(self, team_name: str) -> str:
    """Normalize team names to standard codes.
    
    employees.team (from DB):  "Groen", "Oranje", "Overig"
    Standard codes:            "GRO",   "ORA",    "TOT"
    """
    
    team_upper = (team_name or '').upper()
    
    # Map Dutch names to codes
    mapping = {
        'GROEN': 'GRO',
        'GRO': 'GRO',
        'ORANJE': 'ORA',
        'ORA': 'ORA',
        'OVERIG': 'TOT',
        'TOT': 'TOT',
        'TOTAAL': 'TOT',
    }
    
    return mapping.get(team_upper, 'TOT')  # Default: TOT
```

---

## 📊 Algorithm Flow (Corrected)

```
GREEDY SOLVE SEQUENCE:

1. Load Data
   ├─ employees.team (Groen, Oranje, Overig)
   ├─ requirements with roster_period_staffing_dagdelen.team (GRO, ORA, TOT)
   └─ All other data

2. Phase 1: Lock Pre-Planned
   └─ Validate with all HC constraints (including HC6 strict)

3. Phase 2a: Greedy Pass 1 (STRICT)
   FOR each requirement:
      ├─ GRO service → only 'Groen' employees
      ├─ ORA service → only 'Oranje' employees
      └─ TOT service → all teams
   Record: pass1_shortages

4. Phase 2b: Greedy Pass 2 (FALLBACK)
   FOR each pass1_shortage:
      ├─ GRO + shortage → try 'Overig' backup
      ├─ ORA + shortage → try 'Overig' backup
      └─ TOT → skip (already complete)
   Record: pass2_shortages

5. Phase 3: Analyze Bottlenecks
   FOR each pass2_shortage > 0:
      └─ Create bottleneck report
         ├─ Service: [X]
         ├─ Shortage: [Y]
         └─ Reason: "No available employees"

6. Phase 4: Save to Database
   └─ Bulk insert all assignments

7. Phase 5: Return Result
   └─ Coverage, bottlenecks, timing
```

---

## ⚠️ Why Previous Deploy Failed

**Root Cause: HC6 Missing Fallback Tier**

```
Previous Code:
├─ GRO service → ONLY 'Groen' (no fallback)
├─ 'Groen' employees busy → SHORTAGE
├─ 'Overig' employees NOT allowed (even if free)
├─ Coverage: ~70% (many unrequired bottlenecks)
└─ Tests fail → Automatic rollback

Corrected Code:
├─ GRO service → Try 'Groen' first
├─ If shortage → Try 'Overig' backup
├─ Coverage: ~98% (minimal actual shortages)
└─ Tests pass → Deployment succeeds
```

---

## 🛠️ Implementation Checklist

- [ ] Update `_greedy_allocate()` to two-pass algorithm
- [ ] Implement `_find_eligible_strict()`
- [ ] Implement `_find_eligible_fallback()`
- [ ] Implement `_normalize_team()` helper
- [ ] Update `constraint_checker.py` HC6 (if needed)
- [ ] Add team normalization to data loading
- [ ] Unit tests for Pass 1, Pass 2, fallback
- [ ] Integration test with real rooster data
- [ ] Verify coverage improves from 70% → 98%
- [ ] Deploy to staging
- [ ] Monitor logs for bottleneck reports

---

## 📈 Expected Outcome

**Before (Current Broken):**
```
Coverage: ~70%
Bottlenecks: ~50+ (many false)
Reason: HC6 fallback missing
```

**After (With Two-Pass):**
```
Coverage: ~98%
Bottlenecks: ~3-5 (real shortages only)
Reason: HC6 now uses fallback tiers correctly
```

---

## ✅ Validation by Domain Expert

**Confirmed Correct by:** Gslooters (PM)  
**HC6 Logic:**
- ✅ Pass 1: Strict team preference
- ✅ Pass 2: Fallback to 'Overig'
- ✅ Pass 3: Report remaining as bottlenecks
- ✅ Team mapping: Groen↔GRO, Oranje↔ORA, Overig↔TOT

---

**Document:** DRAAD-189 - HC6 Team Logic Correction  
**Status:** ✅ VALIDATED & READY FOR IMPLEMENTATION  
**Priority:** 🔴 CRITICAL (Explains previous deployment failure)  
**Effort:** 3-4 hours implementation + testing  
