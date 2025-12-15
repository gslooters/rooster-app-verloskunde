# 🎯 **DRAAD 182: CONSTRAINTS FRAMEWORK (Soft Constraints & Priorities)**

**Status:** 📋 PLANNING (V0.2 Roadmap)  
**Date:** 2025-12-15  
**Scope:** Architecture voor flexibele constraints  
**Owner:** Design document for future iterations  
**Language:** Nederlands + English  

---

## 📚 **OVERVIEW**

DRAGAD-181 V0.1 implementeert 6 **HARD CONSTRAINTS** (absoluut niet verbreekbaar).

DRAGAD-182 beschrijft het framework voor **SOFT CONSTRAINTS** (proberen te respecteren, maar mag omgekeerd worden onder bepaalde voorwaarden).

**Scope V0.2+:**
- 🟢 HARD constraints (V0.1) - strak controleren
- 🟡 SOFT constraints (V0.2) - proberen, maar flexibel
- 🔴 PRIORITY levels - bepalen welke constraint zwaarder weegt
- ⚙️ CONSTRAINT RELAXATION - wanneer mag je buigen?

---

## 🟡 **SOFT CONSTRAINTS (Nog Niet In V0.1)**

### **SC1: Voorkeursdiensten Per Medewerker**
```
Wat: Medewerker prefereert bepaalde diensten
Bron: employees.service_preferences (JSON)
Priority: MEDIUM

Logic:
  - IF medewerker heeft voorkeur EN beschikbaar → TRY inplannen
  - IF voorkeur niet mogelijk → mag anders inplannen
  - Niet HARD constraint
```

### **SC2: Gelijkmatige Verdeling Over Weken**
```
Wat: Diensten niet allemaal in 1e week, maar verspreid
Calculation: target_shifts / weeks_in_period

Logic:
  - TRACK per week per employee
  - IF week overloaded → TRY andere week
  - Niet verplicht, maar PREFERRED
```

### **SC3: Minimale Diensten Per Type**
```
Wat: Medewerker mag niet MINDER dan X keer dienst Y doen
Bron: roster_employee_services.aantal (lower bound)

Logic:
  - IF huidige_aantal < minimum → PREFER inplannen
  - PRIORITY: MET minimums anders planner alert
```

### **SC4: Senioriteitsverschillen**
```
Wat: Senior medewerkers krijgen voorkeur voor bepaalde diensten
Bron: employees.seniority_level + service_types.seniority_required

Logic:
  - IF seniority_level >= required → eligible
  - Junior mag ook, maar LOWER priority
```

### **SC5: Team Samenstelling Balance**
```
Wat: Per team min/max aantal medewerkers per shift
Bron: planning_constraints.parameters.team_composition

Logic:
  - TRY to balance teams
  - NOT hard rule, maar PREFERENCE
```

### **SC6: Geen Dubbele Diensten (Preference)**
```
Wat: Medewerker liever geen 2 dezelfde diensten achter elkaar
Bron: planning_constraints (custom)

Logic:
  - IF possible → alternate diensten
  - SOFT rule
```

---

## 🔴 **CONSTRAINT RELAXATION STRATEGIE**

### **Wanneer Constraints Relaxen?**

```
Scenario: Constraint X kan niet meer respecteerd worden

1. CHECK: Wat is PRIORITY van deze constraint?
   - is_fixed = true  → NOOIT relaxen (HARD)
   - is_fixed = false → mag relaxen (SOFT)
   - can_relax = true → explicitelijk flexibel

2. COMPARE met ander constraints
   - priority = 1 (kritiek) → NOT relaxen
   - priority = 10 (nice-to-have) → OK relaxen

3. CHECK coverage impact
   - IF coverage < 85% → relax constraints om coverage te boost
   - IF coverage > 95% → strenger constraints toepassen

4. TRACK violation
   - Log wat je corresponded
   - Planner ziet "Constraint X slightly relaxed: reason Y"
```

### **Relaxation Priority Stack**
```
(Highest Priority = Most Strict)

1. HARD constraints (NOOIT relaxen)
   └─ Must respect or abort

2. CRITICAL soft constraints (priority 1-3)
   └─ Only relax if coverage < 80%

3. IMPORTANT soft constraints (priority 4-6)
   └─ Relax if coverage < 85%

4. NICE-TO-HAVE constraints (priority 7-10)
   └─ Always OK to relax

(Lowest Priority = Most Flexible)
```

---

## 🛠️ **CONSTRAINT CONFIGURATION SCHEMA**

### **Base: `planning_constraints` tabel**
```json
{
  "id": "uuid",
  "naam": "max_night_shifts_per_week",
  "type": "employee_limit",
  "beschrijving": "Medewerker max 3x nachtdienst per week",
  "parameters": {
    "target_metric": "shifts_per_week",
    "service_type": "night",
    "max_value": 3,
    "period": "week"
  },
  "actief": true,
  "priority": 6,        // 1=critical, 10=optional
  "can_relax": true,    // mag omgekeerd worden?
  "is_fixed": false,    // hard of soft constraint?
  "team": null,         // null=all teams, 'GRO'=specific
  "created_at": "...",
  "updated_at": "..."
}
```

### **Per-Roster: `roster_planning_constraints` tabel**
```json
{
  "id": "uuid",
  "roster_id": "uuid",
  "base_constraint_id": "uuid",
  "naam": "max_night_shifts_per_week",
  "type": "employee_limit",
  "parameters": {
    "target_metric": "shifts_per_week",
    "service_type": "night",
    "max_value": 3,    // OVERRIDE: was 3, now 4 for this roster
    "period": "week"
  },
  "actief": true,
  "priority": 6,
  "can_relax": true,
  "is_override": true,  // This is a custom override
  "created_at": "..."
}
```

---

## 📊 **CONSTRAINT VIOLATIONS TRACKING**

### **Detail Level 1: Violation Record**
```json
{
  "id": "uuid",
  "solver_run_id": "uuid",
  "constraint_id": "uuid",
  "constraint_name": "max_shifts_per_week",
  "constraint_priority": 6,
  "constraint_type": "SOFT",
  "severity": "WARNING",      // CRITICAL | ERROR | WARNING | INFO
  "employee_id": "emp_001",
  "date": "2025-12-15",
  "dagdeel": "O",
  "service_id": "uuid",
  "message": "Employee exceeded max shifts for week 51",
  "current_value": 4,
  "max_allowed": 3,
  "overage": 1,
  "resolution_action": "RELAXED",  // BLOCKED | RELAXED | ACCEPTED
  "resolution_reason": "Coverage priority: 85% target",
  "planner_notification": true,
  "created_at": "..."
}
```

### **Summary: Solver Run Report**
```json
{
  "solver_run_id": "uuid",
  "roster_id": "uuid",
  "status": "SUCCESS",
  "coverage": 95.2,
  "constraint_violations": {
    "HARD": 0,
    "SOFT": 3,
    "CRITICAL": 0,
    "WARNING": 3,
    "by_type": {
      "max_shifts_exceeded": 1,
      "team_imbalance": 2
    }
  },
  "violations_detail": [
    {
      "constraint": "team_preference_not_met",
      "count": 2,
      "severity": "WARNING",
      "action": "LOGGED"
    }
  ],
  "planner_actions_required": [
    "Review 1 employee with exceeded shifts",
    "Consider 2 team rebalancing opportunities"
  ]
}
```

---

## 🎛️ **FLEXIBILITY OPTIONS FOR PLANNER**

### **Option A: Ignore Soft Violations**
```
Planner: "Ik ga akkoord met deze 3 soft constraint violations"

Result:
  - Rooster accepted as-is
  - Violations logged
  - No re-solve needed
```

### **Option B: Adjust Priorities & Re-Solve**
```
Planner: "Team composition is less important this week"

Action:
  - Adjust priority of team_balance from 5 to 8
  - Re-run greedy engine
  - New result with adjusted priorities
```

### **Option C: Manually Override Assignment**
```
Planner: "I want this specific assignment anyway"

Action:
  - Manual assignment in UI
  - Mark as 'locked' (protected)
  - Greedy respects protected assignments
```

### **Option D: Relax Specific Constraint**
```
Planner: "Ignore max_shifts for this roster"

Action:
  - Disable constraint in roster_planning_constraints
  - is_active = false
  - Re-run greedy
  - New result without that constraint
```

---

## 🔄 **UPGRADE PATH: V0.1 → V0.2**

### **V0.1 Status (Current)**
```
✅ HARD Constraints 1-6 implemented
❌ Soft Constraints NOT implemented
❌ Priorities NOT implemented
❌ Relaxation NOT implemented
```

### **V0.2 Roadmap**
```
✅ Keep all HARD constraints

Add:
+ SC1: Voorkeursdiensten
+ SC2: Gelijkmatige verdeling
+ SC3: Minimale diensten
+ SC4: Senioriteitsverschillen
+ SC5: Team balancing
+ SC6: Alternating services

+ Priority system (1-10)
+ Relaxation logic
+ Planner override options
+ Detailed violation tracking
```

### **V0.3 Future**
```
+ Machine learning for pattern recognition
+ Predictive workload balancing
+ Demand forecasting
+ Integration with actual leave calendar
```

---

## 📋 **DATABASE CHANGES FOR V0.2**

NEWE COLUMNS/TABLES:

### **1. Expand `roster_employee_services`**
```sql
ADD COLUMN minimum_per_period INT;    -- Min keer dienst
ADD COLUMN preference_level INT;       -- 1=PREFER, 5=neutral, 10=AVOID
```

### **2. Expand `employees`**
```sql
ADD COLUMN seniority_level INT;        -- 1=junior, 3=senior
ADD COLUMN service_preferences JSONB;  -- {"DIO": 9, "DIA": 7}
```

### **3. Expand `service_types`**
```sql
ADD COLUMN seniority_required INT;     -- Min seniority level
ADD COLUMN max_per_week INT;           -- Global limit per week
```

### **4. New Table: `constraint_violations_detail`**
```sql
CREATE TABLE constraint_violations_detail (
  id UUID PRIMARY KEY,
  solver_run_id UUID,
  constraint_id UUID,
  constraint_priority INT,
  employee_id TEXT,
  date DATE,
  dagdeel TEXT,
  violation_type TEXT,
  severity TEXT,
  resolution_action TEXT,
  details JSONB,
  created_at TIMESTAMP
);
```

---

## 🧪 **TESTING STRATEGY V0.2**

### **Test Categories**
```
1. Constraint Priority Tests
   - High priority overrides low priority? ✓
   - Correct sorting order? ✓

2. Relaxation Tests
   - Soft constraint can be relaxed? ✓
   - Hard constraint cannot? ✓

3. Planner Override Tests
   - Manual override respected? ✓
   - Locked assignments protected? ✓

4. Violation Reporting Tests
   - All violations logged? ✓
   - Correct severity levels? ✓

5. Re-solve Tests
   - Changing priorities re-solves correctly? ✓
   - Disabling constraint works? ✓
```

---

## 📈 **PERFORMANCE TARGETS V0.2**

| Metric | V0.1 Target | V0.2 Target | Notes |
|--------|-------------|-------------|-------|
| Solve Time | < 5 sec | < 10 sec | More logic |
| Coverage | 95%+ | 90%+ | Constraints may prevent perfect |
| Violation Check | Real-time | Real-time | DB lookups OK |
| Constraint Count | 6 HARD | 6 HARD + 6 SOFT | Backward compatible |

---

## 🎯 **NEXT STEPS**

1. **V0.1 Release** (Current Priority)
   - Implement 6 HARD constraints
   - Deploy to production
   - Test with real data

2. **V0.2 Planning** (After V0.1 stable)
   - Design soft constraints in detail
   - Build priority system
   - Implement relaxation logic

3. **V0.2 Release** (Q1 2026)
   - Add all soft constraints
   - Planner flexibility options
   - Enhanced reporting

---

**Document Status:** 📋 FRAMEWORK COMPLETE - READY FOR V0.2 KICKOFF
