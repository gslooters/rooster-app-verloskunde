# 🚀 **DRAAD 181 V0.2: GREEDY ENGINE MET 6 HARD CONSTRAINTS**

**Status:** 🎯 PRODUCTION-READY V0.1 (Phase 1: Core Rules Only)  
**Date:** 2025-12-15  
**Version:** 0.2 (Corrected & Rule-Based)  
**Owner:** Gslooters (PM) + Assistant (Executor)  
**Language:** Nederlands (primary) + English  

---

## 📋 **SAMENVATTING**

Dit document beschrijft **DRAAD 181 V0.1** = GREEDY Engine die de **6 HARD CONSTRAINTS** toepast die jij hebt gedefinieerd.

**Scope V0.1:**
- ✅ Implementeert de 6 HARD constraints (niet meer, niet minder)
- ✅ Ondersteunt basis flexibiliteit voor toekomstige uitbreidingen
- ✅ Returneerd compleet rooster + constraint violations als bottlenecks
- ✅ Status wijziging naar "in_progress" na succesvolle run

**Wat NIET in V0.1:**
- ❌ Soft constraints / relaxatie
- ❌ Machine learning optimalisering
- ❌ Geavanceerde load balancing
- Focus: **Betrouwbaarheid > Perfectie**

---

## 🎯 **DE 6 HARD CONSTRAINTS (Exact Jouw Beschrijving)**

### **Constraint 1: Bevoegdheid (Tabel 2)**
```
IF medewerker NIET capable van dienst_type THEN
  ❌ NIET INPLANNEN
```
**Bron:** `roster_employee_services.service_id` moet bestaan + `actief=true`

---

### **Constraint 2: Status = 0 (Beschikbaar)**
```
IF roster_assignments.status ≠ 0 THEN
  ❌ NIET INPLANNEN
  
Status codes:
  0 = Beschikbaar voor planning ✅
  1 = Al ingepland/vastgesteld
  2 = Geblokkeerd door vorige dienst
  3 = Niet beschikbaar (ziek/verlof/vrij)
```
**Bron:** `roster_assignments.status`

---

### **Constraint 3: Max Diensten Per Medewerker**
```
IF aantal_gepland + 1 > max_shifts THEN
  ❌ NIET INPLANNEN
```
**Bron:** `period_employee_staffing.target_shifts` (per medewerker per periode)

---

### **Constraint 4: Max Per Dienst-Type Per Medewerker**
```
IF aantal_van_dit_type + 1 > aantal_in_tabel2 THEN
  ❌ NIET INPLANNEN

Voorbeeld:
  Medewerker X mag max 8× DIO plannen in de periode
  Al 7× gepland → nog 1× mogelijk
  Volgende DIO → ❌ NIET INPLANNEN
```
**Bron:** `roster_employee_services.aantal` (capaciteit per dienst)

---

### **Constraint 5: Inplanningsvolgorde**

#### **5.1 Datum Bereik**
```
BEGIN = eerste roosterdag
EINDE = laatste roosterdag
→ Stap voor stap door kalender
```

#### **5.2 Dagdeel Volgorde (Per Dag)**
```
Volgorde: O → M → A
(Ochtend → Middag → Avond)
```

#### **5.3 Welke Diensten Staan Nog Open?**
```
BEFORE plannen:
  - Controleer roster_period_staffing_dagdelen
  - Tabel toont: datum/dagdeel/team/dienst + aantal nodig
  - SKIP diensten die al compleet zijn!
  - SKIP diensten die al ingepland zijn!

LOGIC:
  needs = roster_period_staffing_dagdelen.aantal
  current = COUNT(roster_assignments 
                  WHERE status=1 
                  AND service_id=X 
                  AND date=Y 
                  AND dagdeel=Z)
  shortage = needs - current
  
  IF shortage <= 0 THEN
    → SKIP, al compleet
  ELSE
    → Probeer in te vullen
```

#### **5.4 Planningsvolgorde Per Dagdeel**
```
Prioriteit (van hoog naar laag):
  1. SYSTEEMDIENSTEN (service_types.is_system = true)
  2. TEAM-GRO diensten (service_types.team='GRO')
  3. TEAM-ORANJE diensten (service_types.team='ORA')
  4. OVERIGE diensten (service_types.team IS NULL)
```

#### **5.5 Bijzondere Rule: DIO / DDO + DIA / DDA**
```
SCENARIO: Plannen van DIO (Dag In Ochtend) of DDO (Dag Dag Out?)

BEFORE DIO/DDO inplannen:
  1. Controleer: Heeft dezelfde medewerker AVOND (A) van DEZELFDE DAG?
     IF status ≠ 0 THEN
       ❌ NIET INPLANNEN (avond al bezet)
     ELSE
       → Ga door, avond is vrij
  
  2. DIO/DDO INPLANEN
  
  3. Automatisch COUPLED service inplannen:
     - DIO → koppeling DIA (Dag In Avond)
     - DDO → koppeling DDA (DDO in Avond? - clarify needed)
     
  IF gekoppelde dienst NIET beschikbaar THEN
    ⚠️ WAARSCHUWING maar wel inplannen DIO/DDO
```

**Status:** 🤔 VRAAG: Wat is DDO? Is dit ook een O→A koppeling?

---

### **Constraint 6: Team-Gerelateerde Inplanning**

#### **6.1 Diensten gekoppeld aan GRO of ORA team**
```
IF service_types.team = 'GRO' OR service_types.team = 'ORA' THEN
  
  STAP 1: Zoek medewerkers van DATZELFDE team
  IF beschikbare medewerker gevonden THEN
    → INPLANNEN
  
  STAP 2: Geen medewerkers van team beschikbaar
  IF beschikbare medewerker uit OVERIG team THEN
    → INPLANNEN
  
  STAP 3: Helemaal niemand beschikbaar
    → BOTTLENECK: opnemen in eindrapport
```

#### **6.2 Diensten gekoppeld aan TOT (Totaal)**
```
IF service_types.team = 'TOT' THEN
  
  Zoekorder:
    1. Medewerkers van TEAM GRO
    2. Medewerkers van TEAM ORA
    3. Medewerkers van TEAM OVERIG
  
  FIRST beschikbare medewerker → INPLANNEN
  IF niemand beschikbaar → BOTTLENECK
```

---

## 🏗️ **ALGORITMISCHE VOLGORDE (Pseudocode)**

```python
GREEDY_ENGINE_V0.1(roster_id):
  
  # LOAD PHASE
  ├─ requirements = load_roster_period_staffing_dagdelen(roster_id)
  ├─ employees = load_employees()
  ├─ capabilities = load_roster_employee_services(roster_id)
  ├─ targets = load_period_employee_staffing(roster_id)
  └─ assignments = load_roster_assignments(roster_id)

  # PHASE 1: LOCK PRE-PLANNED
  ├─ FOR each assignment IN assignments WHERE status=1 (already planned)
  │  ├─ VALIDATE: Constraint 1,2,3,4 (still valid?)
  │  └─ IF valid → ADD to roster_locked[]
  └─ RESULT: roster_locked[] (typically 120)

  # PHASE 2: GREEDY ALLOCATE (Main Loop)
  ├─ FOR each date IN [start_date..end_date]
  │  │
  │  ├─ FOR each dagdeel IN ['O', 'M', 'A']
  │  │  │
  │  │  └─ FOR each slot IN requirements[date][dagdeel]
  │  │     │  (slot = {team, service_id, quantity_needed})
  │  │     │
  │  │     ├─ CALCULATE need using CONSTRAINT 5.3
  │  │     │  shortage = need - current
  │  │     │
  │  │     ├─ IF shortage <= 0 → SKIP (already satisfied)
  │  │     │
  │  │     ├─ IF service IS DIO/DDO → CHECK CONSTRAINT 5.5
  │  │     │  ├─ IF avond (A) NOT free → SKIP this service
  │  │     │  └─ ELSE → Continue with A planning after O
  │  │     │
  │  │     ├─ APPLY CONSTRAINT 5.4 (priority order)
  │  │     │
  │  │     └─ FOR count=1..shortage
  │  │        │
  │  │        ├─ CANDIDATE_LIST = find_eligible_employees(
  │  │        │    date, dagdeel, service_id,
  │  │        │    constraints 1,2,3,4,6
  │  │        │  )
  │  │        │
  │  │        ├─ IF CANDIDATE_LIST is EMPTY → BOTTLENECK
  │  │        │
  │  │        ├─ ELSE → SELECT first candidate (lowest workload)
  │  │        │  ├─ PLAN assignment
  │  │        │  ├─ IF DIO/DDO → ALSO plan coupled DIA/DDA
  │  │        │  └─ ADD to roster[]
  │  │        │
  │  │        └─ RECORD in violations[] IF constraints broken
  │  │
  │  └─ END FOR dagdeel
  │
  └─ END FOR date

  # PHASE 3: ANALYZE BOTTLENECKS
  ├─ FOR each bottleneck IN violations[]
  │  ├─ DIAGNOSIS: Why couldn't fill?
  │  │  ├─ No capable employees?
  │  │  ├─ All blocked/sick?
  │  │  └─ Workload exceeded?
  │  └─ SUGGESTION: What can planner do?
  │
  └─ RESULT: bottlenecks[] with reason + action

  # PHASE 4: FORMAT OUTPUT
  ├─ coverage = len(roster) / total_needed * 100%
  ├─ violations_summary = constraint violations
  └─ RETURN {
       status: 'SUCCESS',
       assignments: roster[],
       bottlenecks: bottlenecks[],
       coverage: X%,
       constraints_broken: [],
       timestamp: now,
       ready_for_planner: true
     }

  # PHASE 5: POST-SOLVE
  ├─ UPDATE roosters.status = 'in_progress'
  ├─ INSERT INTO solver_runs (metadata, violations)
  └─ RETURN report to planner
```

---

## 💾 **CONSTRAINT VIOLATIONS TRACKING**

Wanneer een constraint wordt overtreden, **RECORD ALLES**:

```json
{
  "constraint_id": 3,
  "constraint_name": "max_shifts_exceeded",
  "employee_id": "emp_001",
  "date": "2025-12-15",
  "dagdeel": "O",
  "service_id": "svc_dio",
  "current_count": 16,
  "max_allowed": 16,
  "violation_type": "HARD",
  "severity": "CRITICAL",
  "action_required": "true",
  "suggestion": "Remove one other assignment or increase max_shifts"
}
```

**Opgeslagen in:** `constraint_violations` tabel

---

## 🔄 **WORKFLOW INTEGATIE**

```
Dashboard "Roosterbewerking starten"
         ↓
   [User klikt "Open"]
         ↓
API /api/roster/solve
         ↓
GreedyEngine V0.1 starts
         ├─ Load all data
         ├─ Apply 6 HARD constraints
         ├─ Generate roster
         ├─ Track violations
         └─ Return result
         ↓
roosters.status = 'in_progress'
         ↓
Planner ziet rapport met:
  ✅ Rooster (449/450 filled)
  ⚠️ Bottlenecks + Suggestions
  🔴 Constraint Violations (if any)
         ↓
Planner kan aanpassingen doen
```

---

## 📋 **IMPLEMENTATIE CHECKLIST V0.1**

### File 1: `src/solver/greedy_engine_v01.py` (500+ lines)
- ✅ Load phase (5 data sources)
- ✅ Phase 1: Lock pre-planned (validate 4 constraints)
- ✅ Phase 2: Greedy allocate (apply all 6 constraints)
- ✅ Phase 3: Analyze bottlenecks
- ✅ Phase 4: Format output
- ✅ Phase 5: Post-solve + status update
- ✅ Comprehensive logging

### File 2: `src/solver/constraint_validator.py` (200+ lines)
- ✅ Constraint 1: Capability check
- ✅ Constraint 2: Status check
- ✅ Constraint 3: Max shifts
- ✅ Constraint 4: Max per service-type
- ✅ Constraint 5: Ordering logic
- ✅ Constraint 6: Team logic

### File 3: `src/solver/test_greedy_v01.py` (300+ lines)
- ✅ Unit tests per constraint
- ✅ Integration tests
- ✅ Practical test data
- ✅ Edge cases

### File 4: `docs/CONSTRAINT_VIOLATIONS_REPORT.md`
- ✅ How violations are reported
- ✅ Examples per constraint
- ✅ Planner action guide

---

## 🎯 **SUCCESS CRITERIA V0.1**

1. **Correctness:**
   - ✅ All 6 constraints applied
   - ✅ No constraint violations in successful run
   - ✅ Violations tracked when they occur

2. **Performance:**
   - ✅ Solve time < 5 seconds
   - ✅ Coverage ≥ 95% (with 6 constraints)

3. **Usability:**
   - ✅ Can test directly in app
   - ✅ Planner gets clear bottleneck report
   - ✅ Status changes to "in_progress"

4. **Quality:**
   - ✅ Comprehensive logging
   - ✅ Clear error messages
   - ✅ Constraint violation details

---

## 📝 **VOLGENDE STAPPEN**

1. **DRAAD-182:** Flexibele regelbase (soft constraints + priorities)
2. **DRAAD-183:** Praktische test scenario's
3. **Deployment:** GitHub → Railway

**Klaar om te beginnen? Ja/Nee?**

---

**Document Status:** 🟡 READY FOR REVIEW & APPROVAL
