# 🚀 **EXECUTION ROADMAP: V0.1 GREEDY ENGINE**

**Status:** 🔴 AWAITING YOUR GO-AHEAD  
**Version:** 0.1 (Core 6 HARD Constraints)  
**Timeline:** 2.5 days (Mon 3pm - Wed 6pm)  
**Language:** Nederlands  

---

## 📋 **DOCUMENTATION COMPLETE**

Alle planning docs zijn geúpload naar GitHub:

### **3 Main Documents**

1. **DRAAD-181-V0.2-GREEDY-CORE-RULES.md**
   - 🎯 Alle 6 HARD constraints uitgewerkt
   - 💾 Algoritme pseudocode
   - 📄 Constraint violation tracking
   - 🎉 **LEES DEZE EERST**

2. **DRAAD-182-CONSTRAINTS-FRAMEWORK.md**
   - 🟡 Soft constraints voor toekomst
   - 🔴 Relaxation strategie
   - 🛠️ Database schema expansie (V0.2)
   - 🤝 Upgrade path

3. **DRAAD-183-TESTPLAN-PRAKTISCH.md**
   - 🧪 6 concrete test cases
   - 🕫️ Setup instructies per constraint
   - 📁 Debugging guide
   - 👠 Production scenario

### **Files in GitHub**
```
/docs/
  ├─ DRAAD-181-V0.2-GREEDY-CORE-RULES.md         ✅ NEW
  ├─ DRAAD-182-CONSTRAINTS-FRAMEWORK.md        ✅ NEW
  ├─ DRAAD-183-TESTPLAN-PRAKTISCH.md          ✅ NEW
  └─ EXECUTION-ROADMAP-V0.1.md                 ✅ NEW (THIS FILE)
```

---

## 🛠️ **IMPLEMENTATION TASKS**

### **Jouw Opdracht (voor VOLGENDE FASE)**

```
OPDRACHT 1: Implementatie V0.1 Code

Files om te bouwen:
  ☐ src/solver/greedy_engine_v01.py (500+ lines)
  ☐ src/solver/constraint_validator.py (200+ lines)
  ☐ src/solver/test_greedy_v01.py (300+ lines)
  ☐ src/app/routes/solver.py (UPDATE endpoint)

Werkwijze:
  ✓ Code in GitHub
  ✓ Via GitHub tools ALLEEN (geen local)
  ✓ Push naar main branch
  ✓ Railway auto-deploys

Volgorde:
  1. greedy_engine_v01.py (core logic)
  2. constraint_validator.py (helper methods)
  3. test_greedy_v01.py (unit tests)
  4. Update routes/solver.py (API integration)
```

### **Jouw Opdracht (TESTING)**

```
OPDRACHT 2: Test Execution

Volg DRAAD-183 stap voor stap:
  ☐ Test Case 1: Constraint 1 (Bevoegdheid)
  ☐ Test Case 2: Constraint 2 (Status = 0)
  ☐ Test Case 3: Constraint 3 (Max Shifts)
  ☐ Test Case 4: Constraint 4 (Max per service)
  ☐ Test Case 5: Constraint 5 (Volgorde)
  ☐ Test Case 6: Constraint 6 (Team logic)
  ☐ Performance test (< 5 sec)
  ☐ Edge case tests

Wanneer:
  - Start: Na code deployed
  - Via: Dashboard app
  - Reporting: BUG template (zie DRAAD-183)
```

---

## 📀 **DELIVERY CHECKLIST**

### **Phase 1: Development**
```
☐ Read all 3 DRAAD documents completely
☐ Ask clarification questions (if any)
☐ Approve 6 constraints as defined
☐ START coding greedy_engine_v01.py
```

### **Phase 2: Code Quality**
```
☐ All code has docstrings
☐ Comprehensive logging
☐ Type hints on all functions
☐ Error handling with try/except
☐ No TODO comments
```

### **Phase 3: Testing**
```
☐ Run unit tests locally: pytest -v
☐ All tests PASS
☐ Coverage > 80%
☐ No console warnings
```

### **Phase 4: Deployment**
```
☐ Push to main branch
☐ Railway detects changes
☐ Build successful
☐ Deployment successful
☐ Logs check: No errors
```

### **Phase 5: Integration Testing**
```
☐ Can reach /api/roster/solve endpoint
☐ Can trigger from Dashboard
☐ Returns valid JSON response
☐ Status changes to 'in_progress'
```

### **Phase 6: Constraint Validation**
```
☐ Test Case 1: PASS
☐ Test Case 2: PASS
☐ Test Case 3: PASS
☐ Test Case 4: PASS
☐ Test Case 5: PASS
☐ Test Case 6: PASS
☐ Performance test: PASS
☐ Edge cases: PASS
```

### **Phase 7: Production Ready**
```
☐ Coverage >= 95%
☐ All violations logged
☐ Planner gets clear bottleneck report
☐ README updated
☐ Documentation complete
```

---

## 📃 **TIMELINE DETAILED**

### **Day 1: Monday Dec 15 (3pm-6pm) - 3 hours**
```
15:00-15:30  Lees alle 3 DRAAD docs
15:30-16:00  Approval: 6 constraints OK?
16:00-16:30  Setup: Create branch if needed
16:30-18:00  START: greedy_engine_v01.py
```

### **Day 2: Tuesday Dec 16 (9am-6pm) - 9 hours**
```
09:00-11:00  Continue greedy_engine_v01.py
11:00-13:00  constraint_validator.py
13:00-14:00  LUNCH
14:00-17:00  test_greedy_v01.py
17:00-18:00  Code review + final commit
```

### **Day 3: Wednesday Dec 17 (9am-12pm) - 3 hours**
```
09:00-10:00  Code review feedback + fixes
10:00-11:00  Update routes/solver.py
11:00-12:00  Deploy to Railway + verify
```

### **Day 4-5: Testing (Flexible)**
```
Once deployed:
  - Execute DRAAD-183 test plan
  - Report bugs if any
  - Iterate fixes
  - Aim for 100% PASS
```

**Total Development Time: ~15 hours over 3-5 days**

---

## 🌟 **SUCCESS DEFINITION**

### **V0.1 is DONE when:**

```
✅ All 6 HARD constraints implemented
✅ All unit tests PASS
✅ Code deployed to production
✅ All 6 test cases from DRAAD-183 PASS
✅ No constraint violations (unless testing specific)
✅ Coverage >= 95%
✅ Solve time < 5 seconds
✅ Planner can use via Dashboard
✅ Status changes to 'in_progress' after solve
✅ Bottlenecks reported with suggestions
```

### **If test FAILS:**
```
⚠️ Tidak immediately re-solve
⚠️ Check logs via Railway dashboard
⚠️ Use debug query from DRAAD-183
⚠️ File BUG report (template in DRAAD-183)
⚠️ Fix code + re-deploy
⚠️ Re-test
```

---

## 💪 **JAM SESSION OFFER**

```
Wil je dat ik:

1. LIVE CODE the entire V0.1 implementation?
   - Terwijl jij ziet wat er gebeurt
   - Stop whenever voor vragen
   - Live testing in app
   
2. Of je wilt het zelf doen?
   - Ik geef per stap feedback
   - Review jouw code
   - Help met debugging
   
3. Of hybrid?
   - Ik doe implementation
   - Jij doet testing
   - Together we validate

What's your preference?
```

---

## 🔪 **QUICK REFERENCE: 6 CONSTRAINTS**

**Constraint 1: Bevoegdheid**
```
IF employee NOT in roster_employee_services → SKIP
```

**Constraint 2: Status = 0**
```
IF roster_assignments.status ≠ 0 → SKIP
Status codes: 0=beschikbaar, 1=gepland, 2=geblokkeerd_vorige, 3=onbeschikbaar
```

**Constraint 3: Max Shifts**
```
IF employee_assignments_count >= period_employee_staffing.target_shifts → SKIP
```

**Constraint 4: Max per Dienst**
```
IF employee_service_assignments >= roster_employee_services.aantal → SKIP
```

**Constraint 5: Volgorde**
```
Loop:
  FOR date IN [start..end]
    FOR dagdeel IN ['O', 'M', 'A']
      FOR requirement IN dagdeel_requirements
        Check: 5.1=dates, 5.2=dagdeel, 5.3=open slots, 5.4=priority, 5.5=coupling
```

**Constraint 6: Team Logic**
```
IF service.team = 'GRO'  → Prefer GRO employees, fallback OVERIG
IF service.team = 'ORA'  → Prefer ORA employees, fallback OVERIG
IF service.team = 'TOT'  → Any employee OK (GRO > ORA > OVERIG)
```

---

## 📱 **COMMUNICATION PLAN**

### **During Development**
```
Communication Channel: GitHub Issues (if blockers)
Frequency: As needed
Format: Clear description + code snippet
```

### **After Each Phase**
```
I will report:
  - [✅] Completed tasks
  - [⚠️] Blockers (if any)
  - [❓] Questions needing approval
  - [📈] Metrics (coverage, performance)
```

### **Final Delivery**
```
- Summary email
- All tests PASS screenshot
- GitHub commit log
- Ready for production
```

---

## 🌟 **NEXT STEP: YOUR DECISION**

```
You need to decide:

✅ Option A: I code everything (fastest)
   - I write all 4 files
   - You review code
   - You test in app
   - Time: 2 days
   
🛠️ Option B: Hybrid (collaborative)
   - I guide, you write
   - Code review cycles
   - Learning opportunity
   - Time: 3-4 days
   ❓ Option C: You decide after reviewing docs
   - Read 3 DRAQs first
   - Ask clarifications
   - Then decide A or B
   
What's your choice?
```

---

## 📋 **DOCUMENTATION QUALITY CHECKLIST**

All 3 DRAAD files include:

```
✅ DRAAD-181: Core rules
  ✅ 6 constraints fully detailed
  ✅ Algoritme pseudocode
  ✅ Implementation checklist
  ✅ Success criteria
  ✅ Workflow integration

✅ DRAAD-182: Framework
  ✅ Soft constraints defined
  ✅ Relaxation strategy
  ✅ Upgrade path to V0.2
  ✅ Database schema
  ✅ Testing strategy

✅ DRAAD-183: Tests
  ✅ 6 test cases with setup
  ✅ SQL queries for verification
  ✅ Debugging guide
  ✅ Bug report template
  ✅ Success criteria
```

---

**Status:** 🚀 **READY TO LAUNCH**

**Your Action:** Read docs + give go-ahead

**My Action:** Wait for your feedback

---

**Document Chained:**
1. DRAAD-181-V0.2-GREEDY-CORE-RULES.md
2. DRAAD-182-CONSTRAINTS-FRAMEWORK.md
3. DRAAD-183-TESTPLAN-PRAKTISCH.md
4. EXECUTION-ROADMAP-V0.1.md (THIS)
