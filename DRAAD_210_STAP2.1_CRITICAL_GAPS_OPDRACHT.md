# 📋 DRAAD 210 STAP 2.1 - CRITICAL GAP FIXES OPDRACHT

**Datum:** 18 December 2025, 19:56 CET  
**Status:** 🎯 **READY FOR EXECUTION**  
**Vorige Draad:** DRAAD 210 STAP 2 (STAP 2 Fixes DONE)  
**Deze Draad:** DRAAD 210 STAP 2.1 (Critical Gaps)  
**Volgende:** DRAAD 210 STAP 3 (Baseline Testing)

---

## 🎯 MISSION STATEMENT

**Doel:** Implementeer alle **CRITICAL (P0+P1) gaps** uit GREEDY-Werking.txt zodat de GREEDY algoritme 100% conform specifications werkt.

**Scope:** 5 kritieke werkzaamheden
**Geschatte duur:** 2-3 uur  
**Blocking:** STAP 3 testing kan NIET beginnen zonder deze fixes

---

## 🔴 KRITIEKE GAPS (5 FIXES VEREIST)

### FIX 1: Planregel 3.1 - Status > 0 Slot Exclusion
**Priority:** P0 (CRITICAL - prevents roster corruption)  
**Time:** 15 minutes  
**Impact:** BLOCKING - Must fix first

**Requirement:**
```
Greedy moet alle datums/dagdelen met status > 0 uitsluiten.
Bron: roster_assignments tabel
Status=1: ACTIVE (can assign)
Status=2: LOCKED (auto-filled, do NOT overwrite)
Status=3: UNAVAILABLE (blackout)
Status>0 (except 1): EXCLUDED from GREEDY
```

**Current Problem:**
- ❌ Only loads status=3 blocked_slots
- ❌ Does NOT exclude status=2 slots
- ❌ GREEDY can overwrite pre-filled slots
- ❌ Causes roster corruption

**Implementation Location:**
- File: `src/solver/greedy_engine.py`
- Method: `_greedy_allocate()` (lines ~355-380)

**What to Change:**

```python
# BEFORE (BROKEN):
for (date, dagdeel, service_id), need in sorted(self.requirements.items()):
    current = self._count_assigned(date, dagdeel, service_id)
    # ... assigns without checking status

# AFTER (FIXED):
for (date, dagdeel, service_id), need in sorted(self.requirements.items()):
    # Check if slot is blocked by status
    slot_key = (date, dagdeel)  # NEW: Check date/dagdeel, not per-service
    
    # NEW: Load all assignments for this slot
    slot_assignments = [
        a for a in self.assignments 
        if a.date == date and a.dagdeel == dagdeel
    ]
    
    # NEW: Check if ANY have status != 1 (locked or unavailable)
    has_locked_slot = any(a.status != 1 for a in slot_assignments)
    if has_locked_slot:
        logger.info(f"SKIP: {date} {dagdeel} - slot has locked assignments (status≠1)")
        continue  # Skip this date/dagdeel entirely
    
    current = self._count_assigned(date, dagdeel, service_id)
    # ... rest of allocation logic
```

**Testing:**
1. Load roster with status=2 assignments (auto-filled slots)
2. Run GREEDY solve
3. Verify: status=2 slots NOT overwritten
4. Check logs: "SKIP: date dagdeel - slot has locked assignments"

**Success Criteria:**
- ✅ status=2 slots never get new assignments
- ✅ Logs show slot skip messages
- ✅ Rooster integrity maintained

---

### FIX 2: Planregel 3.7.1 & 3.7.2 - Service Pairing (DIO↔DIA, DDO↔DDA)
**Priority:** P0 (CRITICAL - prevents invalid service pairs)  
**Time:** 45 minutes  
**Impact:** BLOCKING - Services must have correct pairs

**Requirement:**
```
3.7.1: Bij inplannen DIO → auto-plan DIA (zelfde dag, A dagdeel)
       Indien dagdeel geblokkeerd → plan DIO ook NIET
3.7.2: Bij inplannen DDO → auto-plan DDA (zelfde dag, A dagdeel)  
       Indien dagdeel geblokkeerd → plan DDO ook NIET
```

**Business Logic:**
- DIO = morning delivery service
- DIA = morning care service (MUST follow DIO)
- DDO = evening delivery service
- DDA = evening care service (MUST follow DDO)

**When assigning DIO:**
1. Find employee for DIO
2. Check if employee available for DIA (date, A dagdeel)
3. If available → assign DIA to same employee
4. If NOT available → reject DIO (try next employee)
5. No pairing = NO assignment

**Implementation Location:**
- File: `src/solver/greedy_engine.py`
- Method: `_greedy_allocate()` (after service assignment, lines ~375-400)

**What to Add:**

```python
# NEW: Service pair definitions
SERVICE_PAIRS = {
    'DIO': {'pair_service': 'DIA', 'pair_dagdeel': 'A'},  # DIO → DIA
    'DDO': {'pair_service': 'DDA', 'pair_dagdeel': 'A'},  # DDO → DDA
}

# In _greedy_allocate(), after assigning an employee:
for emp_id in eligible:
    if assigned_this_slot >= shortage:
        break
    
    # Get service code
    service_code = service_type.code  # e.g., 'DIO'
    
    # NEW: Check if this service requires a pair
    if service_code in SERVICE_PAIRS:
        pair_info = SERVICE_PAIRS[service_code]
        pair_service_code = pair_info['pair_service']  # e.g., 'DIA'
        pair_dagdeel = pair_info['pair_dagdeel']  # 'A'
        
        # Find pair service ID
        pair_service_id = None
        for svc_id, svc_type in self.service_types.items():
            if svc_type.code == pair_service_code:
                pair_service_id = svc_id
                break
        
        if pair_service_id:
            # Check if pair slot is available
            pair_slot_key = (date, pair_dagdeel, pair_service_id)
            pair_need = self.requirements.get(pair_slot_key, 0)
            pair_current = self._count_assigned(date, pair_dagdeel, pair_service_id)
            pair_shortage = pair_need - pair_current
            
            # Check if employee can do pair service
            pair_capable = (emp_id, pair_service_id) in self.capabilities
            
            if not pair_capable or pair_shortage <= 0:
                logger.info(f"SKIP pair: {emp_id} cannot pair {pair_service_code} on {date}")
                continue  # Skip this employee - no valid pair
            
            # Pair is valid - assign main service
            assignment = RosterAssignment(
                id=str(uuid.uuid4()),
                roster_id=self.roster_id,
                employee_id=emp_id,
                date=date,
                dagdeel=dagdeel,
                service_id=service_id,
                source='greedy',
                status=1
            )
            self.assignments.append(assignment)
            assigned_this_slot += 1
            
            # NEW: Also auto-assign the pair service
            pair_assignment = RosterAssignment(
                id=str(uuid.uuid4()),
                roster_id=self.roster_id,
                employee_id=emp_id,
                date=date,
                dagdeel=pair_dagdeel,
                service_id=pair_service_id,
                source='greedy',
                status=1
            )
            self.assignments.append(pair_assignment)
            
            logger.info(f"PAIRED: {emp_id} → {service_code} + {pair_service_code} ({date})")
            
            # Update counters for both services
            self.employee_shift_count[emp_id] += 2  # Both services
            self.employee_service_count[(emp_id, service_id)] += 1
            self.employee_service_count[(emp_id, pair_service_id)] += 1
        else:
            # No pair service found - continue with normal assignment
            assignment = RosterAssignment(...)
            # ... normal assignment
    else:
        # Non-paired service - normal assignment
        assignment = RosterAssignment(...)
        # ... normal assignment
```

**Testing:**
1. Create roster with DIO requirement
2. Assign employee capable of both DIO + DIA
3. Run GREEDY
4. Verify: Both DIO and DIA assigned to same employee
5. Verify: Logs show "PAIRED: emp_id → DIO + DIA"
6. Test case 2: Employee capable of DIO but NOT DIA
7. Verify: Employee skipped, try next employee

**Success Criteria:**
- ✅ DIO always paired with DIA
- ✅ DDO always paired with DDA
- ✅ Employees capable of both before assignment
- ✅ Logs show pairing details

---

### FIX 3: Planregel 3.3.2 - Team Fallback Logic (Team → Overige → OPEN)
**Priority:** P1 (HIGH - wrong team assignment)  
**Time:** 30 minutes  
**Impact:** HIGH - Teams not respected

**Requirement:**
```
3.3.1: Kijk eerst voor employees van het service-team
3.3.2: Geen beschikbare → probeer team="Overige"
3.3.3: Nog niets → laat dienst OPEN
```

**Implementation Location:**
- File: `src/solver/greedy_engine.py`
- Method: `_sort_eligible_by_fairness()` (lines ~385-450)

**What to Change:**

Update `_sort_eligible_by_fairness()` to filter by team:

```python
def _sort_eligible_by_fairness(self, date: str, dagdeel: str, service_id: str) -> List[str]:
    """FIXED: Team-aware employee filtering with fallback"""
    service_type = self.service_types.get(service_id)
    svc_team = service_type.team if service_type else ''
    
    # STRATEGY 1: Try employees from service team first
    eligible = []
    for emp in self.employees:
        if not emp.actief:
            continue
        if emp.team != svc_team:  # NEW: Filter by team
            continue
        
        # ... all constraint checks ...
        if passed:
            eligible.append((emp.id, shifts_remaining, shifts_in_run_for_service))
    
    # If found eligible from service team → return
    if eligible:
        eligible.sort(key=lambda x: (x[1], -x[2]), reverse=True)
        sorted_list = [emp_id for emp_id, _, _ in eligible]
        logger.info(f"TEAM {svc_team}: Found {len(sorted_list)} eligible employees")
        return sorted_list
    
    # STRATEGY 2: No employees from team → try "Overige" team
    logger.info(f"TEAM {svc_team}: No eligible → trying Overige team")
    eligible = []
    for emp in self.employees:
        if not emp.actief:
            continue
        if emp.team != 'Overige':  # NEW: Try Overige team
            continue
        
        # ... all constraint checks ...
        if passed:
            eligible.append((emp.id, shifts_remaining, shifts_in_run_for_service))
    
    if eligible:
        eligible.sort(key=lambda x: (x[1], -x[2]), reverse=True)
        sorted_list = [emp_id for emp_id, _, _ in eligible]
        logger.info(f"OVERIGE: Found {len(sorted_list)} eligible employees")
        return sorted_list
    
    # STRATEGY 3: No one available → leave OPEN (bottleneck)
    logger.warning(f"OPEN: {date} {dagdeel} {svc_team} - no eligible employees")
    return []  # Empty list = OPEN bottleneck
```

**Testing:**
1. Create roster with service for team="Maat"
2. Maat employees available → verify assignment to Maat
3. Create scenario where NO Maat available
4. Overige employees available → verify assignment to Overige
5. Create scenario where NO one available
6. Verify: Logs show fallback attempt, bottleneck marked OPEN

**Success Criteria:**
- ✅ Service team employees prioritized
- ✅ Fallback to Overige when team empty
- ✅ Bottleneck when no one available
- ✅ Logs show strategy changes

---

### FIX 4: Planregel 3.4 - TOT Team Special Logic
**Priority:** P1 (HIGH - TOT services wrong distribution)  
**Time:** 30 minutes  
**Impact:** HIGH - TOT services critical

**Requirement:**
```
3.4: For team="TOT":
   1. No team restriction (all employees eligible)
   2. Prefer: Maat + Loondienst (dienstverband)
   3. Only if exhausted: ZZP employees
   4. If none: Leave OPEN
```

**Implementation Location:**
- File: `src/solver/greedy_engine.py`
- Method: `_sort_eligible_by_fairness()` (special case at start)

**What to Change:**

Add special TOT handling BEFORE normal team filtering:

```python
def _sort_eligible_by_fairness(self, date: str, dagdeel: str, service_id: str) -> List[str]:
    """FIXED: TOT team gets special treatment"""
    service_type = self.service_types.get(service_id)
    svc_team = service_type.team if service_type else ''
    
    # NEW: Special TOT team handling
    if svc_team == 'TOT':
        logger.info(f"TOT SERVICE: Special handling enabled")
        
        # Step 1: Prefer Maat + Loondienst employees
        eligible_permanent = []
        for emp in self.employees:
            if not emp.actief:
                continue
            # Include Maat and Loondienst
            if emp.dienstverband not in ['Maat', 'Loondienst']:
                continue
            
            # ... all constraint checks ...
            if passed:
                eligible_permanent.append((emp.id, shifts_remaining, shifts_in_run_for_service))
        
        if eligible_permanent:
            eligible_permanent.sort(key=lambda x: (x[1], -x[2]), reverse=True)
            sorted_list = [emp_id for emp_id, _, _ in eligible_permanent]
            logger.info(f"TOT/Permanent: {len(sorted_list)} employees")
            return sorted_list
        
        # Step 2: If no permanent staff → try ZZP
        logger.info(f"TOT/Permanent: Exhausted → trying ZZP")
        eligible_zzp = []
        for emp in self.employees:
            if not emp.actief:
                continue
            if emp.dienstverband != 'ZZP':
                continue
            
            # ... all constraint checks ...
            if passed:
                eligible_zzp.append((emp.id, shifts_remaining, shifts_in_run_for_service))
        
        if eligible_zzp:
            eligible_zzp.sort(key=lambda x: (x[1], -x[2]), reverse=True)
            sorted_list = [emp_id for emp_id, _, _ in eligible_zzp]
            logger.info(f"TOT/ZZP: {len(sorted_list)} employees")
            return sorted_list
        
        # Step 3: No one available
        logger.warning(f"TOT: No eligible employees (OPEN)")
        return []
    
    # NON-TOT SERVICES: Use team fallback logic from FIX 3
    # ... rest of normal logic ...
```

**Testing:**
1. Create TOT service
2. Test with Maat/Loondienst available → assign them
3. Test with ZZP only → assign ZZP
4. Test with no one available → mark OPEN
5. Verify logs show strategy transitions

**Success Criteria:**
- ✅ TOT services respect dienstverband priority
- ✅ Permanent staff (Maat/Loondienst) used first
- ✅ ZZP used only when permanent exhausted
- ✅ Fallback properly logged

---

### FIX 5: Planregel 4.3.1 - Service Priority Ordering
**Priority:** P1 (HIGH - services processed in wrong order)  
**Time:** 20 minutes  
**Impact:** HIGH - Non-critical services get priority

**Requirement:**
```
4.3.1: Process services in priority:
   1. System services (is_system=true)
   2. TOT team services
   3. All other services
```

**Implementation Location:**
- File: `src/solver/greedy_engine.py`
- Method: `_greedy_allocate()` (lines ~345-360, requirement iteration)

**What to Change:**

Replace the simple requirement iteration with priority-based processing:

```python
def _greedy_allocate(self) -> List[Bottleneck]:
    """Phase 2: Greedy allocation with service priority ordering"""
    bottlenecks = []
    
    # NEW: Separate requirements by service priority
    system_services = {}
    tot_services = {}
    other_services = {}
    
    for (date, dagdeel, service_id), need in self.requirements.items():
        if need == 0:
            continue
        
        service_type = self.service_types.get(service_id)
        if not service_type:
            continue
        
        key = (date, dagdeel, service_id)
        
        # Categorize by priority
        if service_type.is_system:  # NEW: Check is_system flag
            system_services[key] = need
            logger.debug(f"SYSTEM: {service_type.code} ({date} {dagdeel})")
        elif service_type.team == 'TOT':
            tot_services[key] = need
            logger.debug(f"TOT: {service_type.code} ({date} {dagdeel})")
        else:
            other_services[key] = need
            logger.debug(f"OTHER: {service_type.code} ({date} {dagdeel})")
    
    # NEW: Process in priority order
    all_services_priority = [
        ("SYSTEM", sorted(system_services.items())),
        ("TOT", sorted(tot_services.items())),
        ("OTHER", sorted(other_services.items()))
    ]
    
    for priority_name, priority_services in all_services_priority:
        logger.info(f"\n📊 Processing {priority_name} services ({len(priority_services)} total)")
        
        for (date, dagdeel, service_id), need in priority_services:
            # ... rest of allocation logic from FIX 1, 2, 3, 4 ...
            pass
    
    return bottlenecks
```

**Testing:**
1. Create roster with system, TOT, and other services
2. Run GREEDY
3. Verify logs show order: SYSTEM → TOT → OTHER
4. Verify system services filled first
5. Check bottlenecks: system services should have minimal shortages

**Success Criteria:**
- ✅ Services processed in correct priority
- ✅ System services filled first
- ✅ Logs show priority ordering

---

## 📋 IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Read this entire document carefully
- [ ] Understand all 5 fixes and their interactions
- [ ] Review GREEDY-Werking.txt section 3 & 4
- [ ] Understand service codes (DIO, DIA, DDO, DDA)
- [ ] Understand employee fields (dienstverband, team)

### Implementation
- [ ] **FIX 1** (15 min): Status > 0 filtering
  - [ ] Add status check in _greedy_allocate()
  - [ ] Skip blocked slots
  - [ ] Test: status=2 slots not overwritten
  - [ ] Commit to GitHub

- [ ] **FIX 2** (45 min): Service pairing
  - [ ] Add SERVICE_PAIRS dict
  - [ ] Add pairing logic after assignment
  - [ ] Check pair availability before commit
  - [ ] Test: DIO always paired with DIA
  - [ ] Commit to GitHub

- [ ] **FIX 3** (30 min): Team fallback
  - [ ] Update _sort_eligible_by_fairness()
  - [ ] Add team filtering
  - [ ] Add Overige fallback
  - [ ] Test: Team preference respected
  - [ ] Commit to GitHub

- [ ] **FIX 4** (30 min): TOT team logic
  - [ ] Add TOT special case
  - [ ] Add dienstverband prioritization
  - [ ] Test: Permanent → ZZP prioritization
  - [ ] Commit to GitHub

- [ ] **FIX 5** (20 min): Service priority
  - [ ] Categorize requirements by priority
  - [ ] Process system → TOT → other
  - [ ] Test: Logs show correct ordering
  - [ ] Commit to GitHub

### Testing
- [ ] All 5 fixes committed to GitHub
- [ ] Railway redeploy complete
- [ ] No startup errors
- [ ] No syntax errors
- [ ] Logs show all fixes working

### Post-Implementation
- [ ] Update DRAAD_210_COMPLIANCE_ANALYSIS.md status
- [ ] Create DRAAD_210_STAP2.1_COMPLETION_REPORT.md
- [ ] Mark STAP 2.1 COMPLETE
- [ ] Ready for STAP 3 testing

---

## 🔧 TECHNICAL DETAILS

### Database Schema References

**service_types table:**
```
id (uuid)
code (text) - "DIO", "DIA", "DDO", "DDA", etc.
team (text) - "Maat", "TOT", "Overige", etc.
is_system (boolean) - true for system services
```

**employees table:**
```
id (uuid)
team (text) - employee's team assignment
dienstverband (text) - "Maat", "Loondienst", "ZZP"
```

**roster_assignments table:**
```
status (integer):
  1 = ACTIVE (can be used)
  2 = LOCKED (auto-filled, don't touch)
  3 = UNAVAILABLE (blackout)
```

### Code Locations

**File:** `src/solver/greedy_engine.py`

| Fix | Method | Lines | Description |
|-----|--------|-------|-------------|
| 1 | _greedy_allocate | 355-380 | Status filtering |
| 2 | _greedy_allocate | 375-400 | Service pairing |
| 3 | _sort_eligible_by_fairness | 385-450 | Team fallback |
| 4 | _sort_eligible_by_fairness | TOP | TOT special logic |
| 5 | _greedy_allocate | 345-360 | Priority ordering |

---

## 🧪 COMPREHENSIVE TESTING PLAN

### Test Scenario 1: Status Filtering
```bash
Setup: Roster with status=2 (locked) slots
Action: Run GREEDY solve
Expected:
  - status=2 slots NOT modified
  - Logs show "SKIP: date dagdeel - slot has locked"
  - New assignments only to status=1 slots
Verify: Supabase - roster_assignments unchanged for status=2
```

### Test Scenario 2: Service Pairing
```bash
Setup: Roster with DIO requirements, employee capable of DIO+DIA
Action: Run GREEDY solve
Expected:
  - DIO assigned
  - DIA auto-assigned to same employee
  - Logs show "PAIRED: emp_id → DIO + DIA"
Verify: Both services in roster_assignments
```

### Test Scenario 3: Team Fallback
```bash
Setup: Service for team="Maat", no Maat available, Overige available
Action: Run GREEDY solve
Expected:
  - No Maat employees tried
  - Fallback to Overige
  - Service assigned to Overige employee
  - Logs show fallback
Verify: Correct team assignment
```

### Test Scenario 4: TOT Team Logic
```bash
Setup: TOT team service, Maat+Loondienst available, ZZP available
Action: Run GREEDY solve
Expected:
  - Permanent staff used first
  - ZZP NOT used
  - Logs show "TOT/Permanent: X employees"
Verify: Only permanent staff assigned
```

### Test Scenario 5: Service Priority
```bash
Setup: Mix of system, TOT, and other services
Action: Run GREEDY solve
Expected:
  - Logs show priority order
  - System services processed first
  - System services have best coverage
Verify: Correct processing order in logs
```

---

## 📊 SUCCESS CRITERIA

### Code Quality
- ✅ No syntax errors
- ✅ All imports valid
- ✅ All methods called correctly
- ✅ No infinite loops
- ✅ Proper error handling

### Functional Requirements
- ✅ FIX 1: Status > 0 slots excluded
- ✅ FIX 2: DIO↔DIA and DDO↔DDA paired
- ✅ FIX 3: Team fallback working (Team → Overige)
- ✅ FIX 4: TOT logic correct (Permanent → ZZP)
- ✅ FIX 5: Services in correct priority

### Testing
- ✅ All test scenarios pass
- ✅ Logs show expected messages
- ✅ Database updates correct
- ✅ No data corruption

### Documentation
- ✅ Code comments updated
- ✅ Compliance report updated
- ✅ All changes documented
- ✅ Ready for STAP 3

---

## 🚀 DEPLOYMENT & VALIDATION

### Before Deploying
1. All 5 fixes committed to GitHub
2. Code reviewed for syntax errors
3. Proper logging at each fix point
4. No breaking changes to existing code

### Deployment Steps
1. Push all fixes to GitHub main branch
2. Monitor Railway: Solver2 service redeploy
3. Wait for green checkmark (deployment complete)
4. Check logs for startup errors
5. Ready for STAP 3 testing

### Validation Checklist
- [ ] GitHub commits show all 5 fixes
- [ ] Railway deployment successful
- [ ] No startup errors in logs
- [ ] Service responds to health check
- [ ] Ready for test scenarios

---

## 📞 ESCALATION & SUPPORT

### If Issues Occur

**Syntax Error?**
- Check line numbers in error message
- Verify indentation (4 spaces)
- Check function signatures

**Logic Error?**
- Review test scenario expectations
- Check logs for actual vs expected
- Verify database state before/after

**Need Help?**
- Reference GREEDY-Werking.txt for requirements
- Review supabase.txt for schema
- Check existing constraint_checker.py for examples

---

## 📋 SUMMARY

**5 Critical Fixes:**
1. Status > 0 Filtering (15 min)
2. Service Pairing (45 min)
3. Team Fallback (30 min)
4. TOT Team Logic (30 min)
5. Service Priority (20 min)

**Total Time:** ~2-3 hours  
**Goal:** 100% GREEDY Werking compliance  
**Outcome:** STAP 3 baseline testing can proceed

---

**Opdracht:** DRAAD 210 STAP 2.1 - Critical Gap Fixes  
**Status:** 🎯 READY FOR EXECUTION  
**Created:** 18 December 2025, 19:56 CET  
**Next:** Execute all 5 fixes in new DRAAD 210 STAP 2.1 session
