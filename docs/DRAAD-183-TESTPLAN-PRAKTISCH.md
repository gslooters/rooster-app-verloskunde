# 🧪 **DRAAD 183: PRAKTISCHE TEST PLAN V0.1**

**Status:** 🗣️ EXECUTION READY  
**Date:** 2025-12-15  
**Audience:** Testers + Planners  
**Language:** Nederlands  
**Focus:** Concrete testing in the app

---

## 🎉 **OVERZICHT**

Dit document beschrijft **HOE JE V0.1 GREEDY KUNT TESTEN** in de werkelijke app.

**Doel:** Validate dat alle 6 HARD constraints correct werken voordat we V0.2 starten.

---

## 🕫️ **TESTOMGEVING SETUP**

### **Vereisten**
```
✅ Supabase project actief
✅ Railway deployment live
✅ Test rooster klaargezet (gebruik bestaande data)
✅ API endpoint bereikbaar: /api/roster/solve
```

### **Test Data**
```
Rooster ID: 80e9cfe6-2c92-4aea-9ad0-b64f239e20ed
Period: Week 48-52 (24 nov - 28 dec 2025)
Employees: 14
Requirements: 450 slots
Pre-planned: 120
Available for Greedy: 330
```

---

## 🤝 **TEST CASE 1: Constraint 1 - Bevoegdheid**

### **Doel**
Verificeer dat GREEDY geen dienst inplant als medewerker NIET bevoegd is.

### **Setup**
```sql
-- 1. Check welke medewerker NIET DIO kan doen
SELECT employee_id, COUNT(*) 
FROM roster_employee_services 
WHERE service_id = (SELECT id FROM service_types WHERE code = 'DIO')
  AND roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
  AND actief = true
GROUP BY employee_id;

-- 2. Note: Welke employee NIET in deze lijst staat
-- Example: emp_999 heeft GEEN DIO capability

-- 3. Zorg dat deze employee beschikbaar is
UPDATE roster_assignments
SET status = 0  -- beschikbaar
WHERE employee_id = 'emp_999'
  AND roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
  AND date BETWEEN '2025-12-15' AND '2025-12-20'
  AND service_id = (SELECT id FROM service_types WHERE code = 'DIO');
```

### **Test Execution**
```bash
# 1. Open app: Dashboard > Roosterbewerking starten
# 2. Click "Openen" button
# 3. API calls /api/roster/solve
```

### **Expected Result**
```
✅ emp_999 NIET ingepland voor DIO
✅ Andere medewerkers die WEL DIO kunnen WEL ingepland
✅ Logfile: "[Phase2] Skipped emp_999: not capable of DIO"
✅ Rapport: "emp_999 not capable" NOT in bottlenecks
```

### **Failure Scenario**
```
❌ emp_999 IS ingepland voor DIO
→ BUG: Constraint 1 niet correct geïmplementeerd
→ Action: Check _can_employee_do_service() method
```

---

## 🔍 **TEST CASE 2: Constraint 2 - Status = 0**

### **Doel**
Verificeer dat GREEDY alleen slots met status=0 gebruikt.

### **Setup**
```sql
-- 1. Zorg dat DEZELFDE datum/dagdeel/dienst beide bestaat:
--    a. Een slot met status=0 (beschikbaar)
--    b. Een slot met status=3 (niet beschikbaar)

SELECT date, dagdeel, service_id, employee_id, status
FROM roster_assignments
WHERE roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
  AND date = '2025-12-15'
  AND status IN (0, 3)
LIMIT 5;

-- 2. Noteer: Welke employees hebben status=3 (geblokkeerd)
-- 3. Zorg dat er ook employees met status=0 zijn voor dezelfde slot
```

### **Test Execution**
```
1. Run /api/roster/solve
2. Check het rooster output
```

### **Expected Result**
```
✅ Medewerkers met status=3 NIET ingepland
✅ Medewerkers met status=0 WEL ingepland (indien bevoegd)
✅ Logfile: "[Phase2] Skipped emp_X: status != 0"
```

### **Failure Scenario**
```
❌ Medewerker met status=3 IS ingepland
→ BUG: Status check niet correct
→ Action: Check _is_available() method
```

---

## 📊 **TEST CASE 3: Constraint 3 - Max Shifts**

### **Doel**
Verificeer dat medewerker niet meer diensten krijgt dan target_shifts.

### **Setup**
```sql
-- 1. Find medewerker met LOW target_shifts
SELECT employee_id, target_shifts
FROM period_employee_staffing
WHERE roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
ORDER BY target_shifts ASC
LIMIT 3;

-- Example: emp_001 heeft target_shifts = 10

-- 2. Count hoeveel deze employee AL gepland is
SELECT COUNT(*) as planned
FROM roster_assignments
WHERE employee_id = 'emp_001'
  AND status = 1;
-- Result: 8 al gepland

-- 3. Dus GREEDY mag MAX 2 meer toevoegen (10-8=2)
```

### **Test Execution**
```
1. Noteer: emp_001 has 8 planned, max 10, so 2 slots available
2. Run /api/roster/solve
3. Check output rooster
```

### **Expected Result**
```
✅ emp_001 krijgt EXACT 2 meer (total 10)
✅ emp_001 krijgt NIET 3 of meer (dat zou overschrijding zijn)
✅ Andere employees krijgen wel meer (als hun target niet bereikt)
```

### **Verification Query**
```sql
SELECT employee_id, COUNT(*) as total_assigned
FROM roster_assignments
WHERE roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
  AND employee_id IN ('emp_001', 'emp_002')
GROUP BY employee_id;

-- Vergelijk met period_employee_staffing.target_shifts
-- Total_assigned <= target_shifts?
```

### **Failure Scenario**
```
❌ emp_001 heeft 11 of meer assignments
→ BUG: Max shifts check niet werkend
→ Action: Check _find_eligible_employees() workload logic
```

---

## 💫 **TEST CASE 4: Constraint 4 - Max Per Service Type**

### **Doel**
Verificeer dat medewerker niet meer DIO's mag doen dan aantal in tabel 2.

### **Setup**
```sql
-- 1. Find medewerker met LIMITED capacity voor 1 dienst
SELECT employee_id, service_id, aantal
FROM roster_employee_services
WHERE roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
  AND aantal = 3  -- Only 3 times this service allowed
LIMIT 1;

-- Example: emp_005 mag max 3x DIO doen

-- 2. Check hoe veel al gepland
SELECT COUNT(*) as planned_dio
FROM roster_assignments ra
JOIN service_types st ON ra.service_id = st.id
WHERE ra.employee_id = 'emp_005'
  AND st.code = 'DIO'
  AND status = 1;
-- Result: 1 al gepland

-- 3. Dus GREEDY mag MAX 2 meer DIO's voor emp_005
```

### **Test Execution**
```
1. Note: emp_005 has 1 DIO planned, max allowed 3, so 2 slots
2. Run /api/roster/solve
3. Check DIO assignments for emp_005
```

### **Expected Result**
```
✅ emp_005 krijgt 0-2 EXTRA DIOs (total 1-3)
✅ emp_005 krijgt NIET 4 of meer DIOs
✅ Andere diensten voor emp_005 kunnen wel meer (ander aantal)
```

### **Verification Query**
```sql
SELECT st.code, COUNT(*) as count
FROM roster_assignments ra
JOIN service_types st ON ra.service_id = st.id
WHERE ra.employee_id = 'emp_005'
  AND ra.status = 1
GROUP BY st.code;

-- Vergelijk elk service_type met roster_employee_services.aantal
```

---

## 🗣️ **TEST CASE 5: Constraint 5 - Inplanningsvolgorde**

### **5.1: Datum Bereik**
```
Doel: Verificeer dat planning START op dag 1 en END op dag N

Setup:
- Start date: 2025-11-24
- End date: 2025-12-28
- GREEDY mag NIET plannen buiten deze range

Test:
1. Check output rooster
2. Verify: Alle assignments tussen 2025-11-24 en 2025-12-28
3. Geen assignments voor 2025-11-23 of 2025-12-29

Failure: Assignment buiten range → BUG in date loop
```

### **5.2: Dagdeel Volgorde**
```
Doel: O → M → A per dag gepland

Verification:
SELECT date, dagdeel, COUNT(*) as count
FROM roster_assignments
WHERE roster_id = '80e9cfe6-2c92-4aea-9ad0-b64f239e20ed'
GROUP BY date, dagdeel
ORDER BY date, FIELD(dagdeel, 'O', 'M', 'A');

Expected: Logfile shows:
  [Phase2] Processing 2025-12-15 O
  [Phase2] Processing 2025-12-15 M
  [Phase2] Processing 2025-12-15 A
  [Phase2] Processing 2025-12-16 O
  ...
```

### **5.3: Welke Diensten Nog Open?**
```
Doel: SKIP al volgestopte slots

Setup:
UPDATE roster_period_staffing_dagdelen
SET aantal = 2  -- Need 2 DIOs for 2025-12-15 O
WHERE service_id = (SELECT id FROM service_types WHERE code = 'DIO')
  AND date = '2025-12-15'
  AND dagdeel = 'O';

Manually insert 2 assignments already:
INSERT INTO roster_assignments ...
-- 2x DIO already for 2025-12-15 O

Test:
1. Run /api/roster/solve
2. GREEDY should NOT add more DIOs for 2025-12-15 O
3. Should skip to other slots

Verification:
SELECT COUNT(*) as dio_count
FROM roster_assignments
WHERE service_id = (SELECT id FROM service_types WHERE code = 'DIO')
  AND date = '2025-12-15'
  AND dagdeel = 'O';
-- Result: 2 (not more)
```

### **5.4 & 5.5: Systeemdiensten Priority**
```
Doel: Systeemdiensten EERST, dan GRO, dan ORA, dan OVERIG

Setup:
Check service_types.is_system, .team flags

Verification:
1. Count system services assigned FIRST
2. Then count GRO team services
3. Then count ORA team services
4. Then count OVERIG

Logfile should show:
  [Phase2] Processing system services first
  [Phase2] Processing GRO team services
  [Phase2] Processing ORA team services
  [Phase2] Processing OVERIG services
```

---

## 👠 **TEST CASE 6: Constraint 6 - Team Logic**

### **6.1: GRO/ORA Team Priority**
```
Doel: Dienst van GRO team → FIRST zoek GRO employees

Setup:
UPDATE service_types SET team = 'GRO' WHERE code = 'specific_service';

Test:
1. Ensure GRO team members are available
2. Run /api/roster/solve
3. Check: GRO service should be assigned to GRO team member (if available)

Verification Query:
SELECT ra.employee_id, e.team, st.team as service_team
FROM roster_assignments ra
JOIN employees e ON ra.employee_id = e.id
JOIN service_types st ON ra.service_id = st.id
WHERE st.team = 'GRO'
AND ra.status = 1;

Expected: ALLE e.team = 'GRO' (or fallback to OVERIG if GRO unavailable)
```

### **6.2: TOT Team (All Available)**
```
Doel: TOT service → ANY team member OK

Setup:
UPDATE service_types SET team = 'TOT' WHERE code = 'cross_team_service';

Test:
1. Disable GRO members for this service
2. Run /api/roster/solve
3. Should assign to ORA or OVERIG team

Verification: No hard requirement on team
```

---

## 📄 **TEST EXECUTION CHECKLIST**

```
☐ TEST 1: Constraint 1 (Bevoegdheid)
   ☐ Voorbereiding
   ☐ Uitvoering
   ☐ Verificatie
   ☐ Result: PASS / FAIL

☐ TEST 2: Constraint 2 (Status = 0)
   ☐ Voorbereiding
   ☐ Uitvoering
   ☐ Verificatie
   ☐ Result: PASS / FAIL

☐ TEST 3: Constraint 3 (Max Shifts)
   ☐ Voorbereiding
   ☐ Uitvoering
   ☐ Verificatie
   ☐ Result: PASS / FAIL

☐ TEST 4: Constraint 4 (Max Per Service)
   ☐ Voorbereiding
   ☐ Uitvoering
   ☐ Verificatie
   ☐ Result: PASS / FAIL

☐ TEST 5: Constraint 5 (Volgorde)
   ☐ 5.1 Datum bereik
   ☐ 5.2 Dagdeel volgorde
   ☐ 5.3 Welke diensten open
   ☐ 5.4 Systeem priority
   ☐ 5.5 DIO/DDO coupling
   ☐ Result: PASS / FAIL

☐ TEST 6: Constraint 6 (Team Logic)
   ☐ 6.1 GRO/ORA priority
   ☐ 6.2 TOT team
   ☐ Result: PASS / FAIL

OVERALL RESULT: ALL PASS / SOME FAIL
```

---

## 📁 **DEBUGGING: Logsăăgen**

Wanneer een test FAIL:

### **1. Check Application Logs**
```bash
# Railway Dashboard -> Logs
# Filter: [Phase2] or [Error]
# Look for: Constraint violations, skip reasons
```

### **2. Check Database State BEFORE**
```sql
-- Before running /api/roster/solve:
SELECT COUNT(*) FROM roster_assignments WHERE status = 0;
SELECT COUNT(*) FROM roster_assignments WHERE status = 1;
SELECT MAX(target_shifts) FROM period_employee_staffing;
```

### **3. Check Database State AFTER**
```sql
-- After running /api/roster/solve:
SELECT employee_id, COUNT(*) as total
FROM roster_assignments
WHERE status = 1
GROUP BY employee_id
HAVING COUNT(*) > (SELECT target_shifts FROM period_employee_staffing WHERE employee_id = ?);
```

### **4. Trace Specific Assignment**
```sql
-- If emp_001 has too many shifts:
SELECT date, dagdeel, service_id, source
FROM roster_assignments
WHERE employee_id = 'emp_001'
ORDER BY date, dagdeel;
```

---

## 📀 **PRODUCTION TEST SCENARIO**

### **Real-World Simulation**
```
1. Use actual Week 48-52 data
2. Run /api/roster/solve via Dashboard
3. Verify:
   - Coverage > 95%
   - All 6 constraints respected
   - No hard violations
   - Planner can see bottlenecks

4. Planner checks rapport:
   - Aantal ingepland: 449/450
   - Bottlenecks: 1 (welke?)
   - Suggestion: What to do about it?

5. Status changed to 'in_progress'? YES/NO

6. Planner can manually adjust? YES/NO
```

---

## 🎮 **AANVULLENDE TESTS**

### **Performance Test**
```
Doel: Verify <5 sec solve time

Execution:
1. Open browser DevTools
2. Click "Openen" on Dashboard
3. Note time from click to result
4. Measure: < 5 sec? YES/NO
```

### **Edge Case: All Employees Unavailable**
```
Doel: Graceful handling

Setup:
UPDATE roster_assignments
SET status = 3  -- All unavailable
WHERE date = '2025-12-20'
  AND dagdeel = 'O';

Test:
1. Run /api/roster/solve
2. Should NOT crash
3. Should report bottleneck for 2025-12-20 O
4. Suggestion: "All employees unavailable this slot"
```

### **Edge Case: Zero Requirements**
```
Doel: Handle empty requirement

Setup:
UPDATE roster_period_staffing_dagdelen
SET aantal = 0
WHERE date = '2025-12-21';

Test:
1. Run /api/roster/solve
2. Should skip 2025-12-21 entirely
3. Should NOT report bottleneck
```

---

## 🛠️ **BUG REPORTING TEMPLATE**

Bij FAIL:

```markdown
# BUG REPORT

**Test Case:** 3 - Constraint 3 - Max Shifts
**Severity:** CRITICAL / HIGH / MEDIUM / LOW

**Description:**
Employee emp_001 exceeded max_shifts.

**Expected:**
emp_001 total assignments <= 10

**Actual:**
emp_001 has 12 assignments

**Steps to Reproduce:**
1. Load rooster 80e9cfe6-2c92-4aea-9ad0-b64f239e20ed
2. Run /api/roster/solve
3. Query: SELECT COUNT(*) FROM roster_assignments WHERE employee_id='emp_001' AND status=1
4. Result: 12 (expected 10)

**Screenshots:**
[Add screenshot of dashboard or DB result]

**Logs:**
[Paste relevant log lines]

**Hypothesis:**
The _find_eligible_employees() method doesn't check max_shifts correctly.

**Workaround:**
N/A - Blocker
```

---

## 🌟 **SUCCESS CRITERIA**

```
✅ All 6 constraints working
✅ No hard violations
✅ Coverage >= 95%
✅ Solve time < 5 sec
✅ Status changes to 'in_progress'
✅ Planner gets clear bottleneck report
✅ Planner can see suggestions
✅ All tests PASS
```

---

**Test Plan Status:** 🧪 READY FOR EXECUTION

**Start Date:** TBD (After V0.1 code is deployed)
**Estimated Duration:** 2-3 hours per complete cycle
