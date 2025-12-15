# 📊 BASELINE ANALYSIS - VERIFICATIE VAN WERKELIJKE STAAT

**Datum:** 2025-12-15 16:59 CET  
**Status:** ✅ BASELINE VERIFIED  
**Conclusie:** Geen werkende GREEDY implementation, alles moet opnieuw

---

## 🔍 WERKELIJKE CODE ANALYSE

### src/solver/greedy_engine.py (18KB)

**WERKELIJK INHOUD:**
```
Class: GreedyRosteringEngine
- Init param: config dict (NIET roster_id)
- Load in __init__: INEFFICIENT
- Method solve() → Dict (NIET SolveResult)
- Constraint checks: ONLY _can_do(), _is_blocked() - BASAAL
```

**SPEC VEREISTE (DRAAD 184/185):**
```
Class: GreedyPlanner
- Init param: roster_id string
- Phase-based loading: EFFICIENT
- Method solve() → SolveResult dataclass
- Constraint checks: HC1-HC6 (PROPER)
```

**VERDICT:** ❌ PROTOTYPE - NIET SPEC-COMPLIANT

---

## 📁 DIRECTORY STRUCTURE

### Wat BESTAAT:
```
src/solver/
├── greedy_engine.py                    ✅ 18KB (PROTOTYPE)
├── soft_constraints.py                 ✅ 11KB (FRAMEWORK)
├── constraint_relaxation.py            ✅ 10KB (FRAMEWORK)
├── sequential_solver.py                ✅ 5KB (OLD SOLVER)
├── employee_availability.py            ✅ 8KB (HELPER)
├── requirement_queue.py                ✅ 7KB (HELPER)
├── bottleneck_analyzer.py              ✅ 6KB (HELPER)
├── assignment_report.py                ✅ 6KB (HELPER)
├── test_greedy_engine.py               ✅ 17KB (TESTS)
└── __init__.py                         ✅ 1KB
```

### Wat ONTBREEKT:
```
❌ constraint_checker.py               (HC1-HC6 implementation)
❌ Hard constraint validation
❌ Proper SolveResult dataclass
❌ Phase-based architecture
❌ API route handler
```

---

## 🏗️ ARCHITECTURE ANALYSE

### Current Implementation (PROTOTYPE)
```python
GreedyRosteringEngine.__init__(config)
  ├─ Load data in __init__ (BLOCKING)
  ├─ self.employees
  ├─ self.capabilities
  ├─ self.requirements
  └─ self.blocked_slots

solve()
  └─ 4 phases:
     ├─ _lock_pre_planned()
     ├─ _greedy_allocate()
     ├─ _analyze_bottlenecks()
     └─ return dict
```

**Issues:**
- ❌ Data load in init = blocking
- ❌ No concurrent requests
- ❌ Dict return (not typed)
- ❌ Basic constraint checks only

### REQUIRED Implementation (DRAAD 185 SPEC)
```python
ConstraintChecker
  ├─ HC1_capability(emp, svc)
  ├─ HC2_no_overlap(emp, date, dagdeel)
  ├─ HC3_blackout(emp, date)
  ├─ HC4_max_per_employee(emp)
  ├─ HC5_max_per_service(emp, svc)
  └─ HC6_team_logic(emp, svc, team)

GreedyPlanner.__init__(roster_id)
  └─ Lazy init (no data load)

solve() → SolveResult
  ├─ @dataclass with typed fields
  ├─ 4 phases
  ├─ Proper error handling
  └─ Database updates
```

---

## 🗄️ DATABASE VERIFICATION

### Supabase Tables Available (VERIFIED)

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| `employees` | ~14 | ✅ READY | Contains team, actief fields |
| `employee_services` | ~80 | ✅ READY | Capability mapping |
| `roster_employee_services` | ~80 | ✅ READY | Roster-specific capabilities |
| `roster_assignments` | ~450 | ✅ READY | Current assignments (status=1) |
| `roster_period_staffing_dagdelen` | ~228 | ✅ READY | Requirements per dagdeel |
| `period_employee_staffing` | ~14 | ✅ READY | Employee targets per period |
| `service_types` | ~10 | ✅ READY | Service definitions |
| `constraint_violations` | ~0 | ✅ EMPTY | Ready for logging |
| `solver_runs` | ~5 | ✅ READY | Solver execution history |

**Field Verification:**
- ✅ `roster_assignments.status` (0=open, 1=assigned, 2=blocked, 3=unavailable)
- ✅ `roster_assignments.date` (date type)
- ✅ `roster_assignments.dagdeel` (O/M/A)
- ✅ `roster_assignments.service_id` (UUID)
- ✅ `employee_services.actief` (boolean)
- ✅ `employees.team` (text: GRO/ORA/NULL)
- ✅ `service_types.is_system` (boolean)
- ✅ `constraint_violations` schema complete

---

## 🚀 DEPLOYMENT VERIFICATION

### Railway Services Status

**rooster-app-verloskunde** (Next.js Frontend)
- ✅ ACTIVE (online)
- ✅ Latest deployment: DRAAD 184 commit
- ❌ BUT: Running code from DRAAD 182 (cache not cleared)
- ❌ AutoFillButton.tsx exists but no backend

**Solver2** (Python Backend)
- ✅ ONLINE (status says)
- ✅ Service exists in Railway
- ❌ NEVER received GREEDY code
- ❌ NO deployments from solver branch
- ❌ NOT integrated with frontend

**Conclusion:** ❌ NOTHING DEPLOYED - Service1 has old code, Service2 is empty

---

## 📝 CONSTRAINT CHECKER REQUIREMENTS (HC1-HC6)

Van DRAAD 181 V0.2 spec:

### HC1: Bevoegdheid (Capability)
```sql
SELECT * FROM employee_services 
WHERE employee_id = ? AND service_id = ? AND actief = true
```

### HC2: Status = 0 (Available)
```sql
SELECT status FROM roster_assignments 
WHERE roster_id = ? AND employee_id = ? AND date = ? AND dagdeel = ?
```
**Status codes:**
- 0 = Available ✅
- 1 = Already assigned
- 2 = Blocked by previous shift
- 3 = Unavailable (sick/leave)

### HC3: Max Shifts Per Employee
```sql
SELECT target_shifts FROM period_employee_staffing 
WHERE roster_id = ? AND employee_id = ?
```
**Current count:** COUNT(assignments WHERE status = 1)

### HC4: Max Per Service Type
```sql
SELECT aantal FROM employee_services 
WHERE employee_id = ? AND service_id = ?
```
**Current count:** COUNT(assignments WHERE service_id = ?)

### HC5: Planning Order
- By date: start_date → end_date
- By dagdeel: O → M → A
- By priority: system → GRO → ORA → NULL

### HC6: Team Logic
- Service team='GRO': prioritize GRO employees
- Service team='ORA': prioritize ORA employees
- Service team='TOT': any employee
- Service team=NULL: any employee

---

## ✅ CLEANUP CHECKLIST - COMPLETED

- [x] Commits analysed: 30 reviewed
- [x] DRAAD 184 misleidende commits identified (6 commits)
- [x] Code reality verified (greedy_engine.py is PROTOTYPE)
- [x] Database schema verified (all tables ready)
- [x] Deployment status verified (nothing deployed)
- [x] Constraint spec verified (HC1-HC6 requirements clear)
- [x] Baseline reset to DRAAD 182 cache bust commit
- [x] This analysis document created
- [ ] **NEXT STEP:** Start DRAAD 185 PROPER implementation

---

## 🎯 NEXT ACTIONS

### STAP 2: Python Backend Implementation (8-10 hours)
1. Write `constraint_checker.py` (HC1-HC6)
2. Rewrite `greedy_engine.py` (proper architecture)
3. API routes setup
4. Database integration
5. Test locally

### STAP 3: Deployment (2 hours)
1. Push to GitHub
2. Railway auto-deploy
3. Live testing

---

**Status:** ✅ CLEANUP COMPLETE - READY FOR PROPER IMPLEMENTATION  
**Next:** DRAAD 185 PROPER  
**ETA:** 12-14 hours total  
**Priority:** 🔥 URGENT
