# DRAAD167 FASE 2 - Better Diagnostics & Error Messages

**Status:** Documentation Ready, Patches Created  
**Date:** 2025-12-12  
**Target:** Enhanced diagnostics for bottleneck detection + improved error messages

---

## Overview

FASE 2 builds on FASE 1 (constraint 7 softening + pre-solve validation) by adding:

### FIX 3: Bottleneck Detection

**What it does:**
- Analyzes available capacity per dagdeel (ochtend/middag/avond)
- Calculates capacity_ratio = available_slots / required_slots
- Identifies bottlenecks: CRITICAL (<0.6), TIGHT (0.6-0.8), OK (≥0.8)
- Breaks down by team (MAAT vs LOONDIENST)
- Reports blocked and fixed slot impacts

**Why it matters:**
- Early warning before solver runs
- Identifies which dagdelen are problematic
- Helps prioritize constraint relaxation
- Enables proactive roster adjustments

**Implementation:**
```python
diagnostics = solver._diagnose_bottlenecks()
# Returns:
{
    "by_dagdeel": {
        "ochtend": {
            "available_slots": 45,
            "required_slots": 50,
            "capacity_ratio": 0.90,  # 90% capacity
            "status": "OK"
        },
        "middag": {
            "available_slots": 35,
            "required_slots": 50,
            "capacity_ratio": 0.70,  # 70% capacity
            "status": "TIGHT"  # Alert!
        },
        ...
    },
    "by_team": { ... }
}
```

### FIX 4: Better Error Messages

**What it does:**
- Formats constraint violations with context-specific suggestions
- Adds actionable recommendations per violation type
- Logs solver statistics (solve time, assignments, violations)
- Improves debugging and user experience

**Why it matters:**
- Users get clear, actionable error messages
- Developers can troubleshoot faster
- Reduces support questions
- Better logging for monitoring

**Example output:**
```
============================================================
CONSTRAINT VIOLATION: fixed_vs_blocked_conflict
Severity: critical
Message: Employee emp1 on 2025-12-15 ochtend is BOTH fixed AND blocked

→ SUGGESTION: Employee cannot be assigned and blocked simultaneously
→ ACTION: Remove either fixed_assignment or blocked_slot
============================================================
```

---

## Architecture

### Method Additions

#### 1. `_diagnose_bottlenecks()` → Dict[str, Any]

**Purpose:** Analyze capacity bottlenecks before solving

**Returns:**
- `timestamp`: ISO datetime of analysis
- `roster_id`: ID being analyzed
- `total_employees`: Count of employees
- `total_days`: Days in roster period
- `by_dagdeel`: Dictionary with per-dagdeel metrics
  - `available_slots`: Slots available (not blocked)
  - `required_slots`: Slots required (from exact_staffing)
  - `fixed_slots`: Already assigned via fixed_assignments
  - `blocked_slots`: Slots that are blocked
  - `capacity_ratio`: Available / Required
  - `status`: "OK" | "TIGHT" | "CRITICAL"
- `by_team`: Dictionary with team-level breakdown
  - `total_employees`: Team size
  - `available_for_exact`: Team members not blocked

**Complexity:** O(e × d × d) where e=employees, d=days, 3 dagdelen

#### 2. `_format_violation_details(violation)` → str

**Purpose:** Format violations with suggestions

**Input:** ConstraintViolation object

**Returns:** Formatted message with:
- Violation type
- Severity
- Original message
- Context-specific suggestion
- Recommended action

**Violation types:**
- CONFLICT (fixed vs exact_staffing team)
- CAPACITY (not enough employees)
- Fixed AND blocked (impossible constraint)
- Pre-solve check (infeasibility detected)

#### 3. `_log_solver_stats(response)` → None

**Purpose:** Log detailed solver statistics

**Logs:**
- Status (SOLVED, INFEASIBLE, etc.)
- Solve time (seconds)
- Assignment count
- Violation count
- Metadata (diagnostic data, flags)

#### 4. `_iter_dates(start, end)` → Iterator[date]

**Purpose:** Helper to iterate date range

**Usage:**
```python
for day in self._iter_dates(start_date, end_date):
    # Process each day
```

---

## Integration Points

### In `solve()` method:

**Step 0 (existing FASE 1):** Pre-solve validation
```python
is_valid, warnings = self.validate_feasibility_beforehand()
if not is_valid:
    return SolveResponse(status=INFEASIBLE, ...)
```

**Step 1 (new FASE 2):** Bottleneck diagnostics
```python
logger.info("[DRAAD167-FASE2] Stap 1: Running diagnostics...")
try:
    diagnostics = self._diagnose_bottlenecks()
    solver_metadata["diagnostics"] = diagnostics
except Exception as e:
    logger.warning(f"Diagnostics failed: {e}")
```

**Step 2 (existing):** Create variables, apply constraints, solve
```python
self._create_variables()
self._apply_constraints()
response = self._solve_model()
```

**Step 3 (new FASE 2):** Error formatting
```python
if response.violations:
    logger.error("[DRAAD167-FASE2] Formatting violation details...")
    for violation in response.violations:
        detail_msg = self._format_violation_details(violation)
        logger.error(detail_msg)

self._log_solver_stats(response)
return response
```

---

## Data Structures

### SolveResponse (enhanced)

```python
SolveResponse(
    status=SolveStatus.SOLVED,
    assignments=[...],
    violations=[],
    solve_time_seconds=0.42,
    solver_metadata={
        # FASE 1
        "draad167_fase1": "presolver_validation_active",
        "constraint_7_mode": "softened_80_110_percent",
        # FASE 2
        "diagnostics": {
            "by_dagdeel": {...},
            "by_team": {...}
        },
        "draad167_fase2": "diagnostics_active"
    }
)
```

### ConstraintViolation (formatted)

```python
ConstraintViolation(
    constraint_type="fixed_vs_blocked_conflict",
    message="Employee emp1 on 2025-12-15 ochtend is BOTH fixed AND blocked",
    severity="critical"
)
# Formatted output includes suggestions and actions
```

---

## Testing Scenarios

### Scenario 1: Normal Roster (Diagnostics shows OK)

**Input:**
- 10 employees
- 2 weeks
- Loose constraints (50% exact_staffing ratio)

**Expected:**
- `capacity_ratio` > 1.0 for all dagdelen
- Status: "OK"
- No violations
- Solve time < 0.5s

### Scenario 2: Tight Capacity (Diagnostics shows TIGHT)

**Input:**
- 5 employees
- 2 weeks
- Tight constraints (80% exact_staffing ratio)

**Expected:**
- `capacity_ratio` 0.6-0.8 for some dagdelen
- Status: "TIGHT"
- May have soft violations
- Solve time < 2s

### Scenario 3: Impossible Constraints (Pre-solve catches it)

**Input:**
- Conflicting fixed_assignments and exact_staffing
- Too many blocked slots
- Team mismatch

**Expected:**
- Pre-solve validation fails
- Detailed violation message
- INFEASIBLE status
- Solve time < 0.1s (pre-solve catch)

---

## Performance Impact

### Diagnostics Cost

**Time complexity:** O(e × d × dagdelen)
- `e` = number of employees (typically 10-20)
- `d` = days in period (typically 14-28)
- `dagdelen` = always 3

**Typical cost:** 5-20ms for small rosters

**Optimization:** Run only once per solve call, cache results in metadata

### Error Formatting Cost

**Time complexity:** O(v × c) where v=violations, c=constraint_type patterns
- Typically 0-5 violations
- 5-10 pattern matches per violation

**Typical cost:** 2-5ms total

### Impact Summary

- **Added to solve():** 10-30ms (7-15% of typical 100-300ms solve)
- **Logging overhead:** Negligible if log level is DEBUG+
- **Memory overhead:** ~5KB for diagnostics object

**Recommendation:** Enable in production, use diagnostics for monitoring

---

## Logging Strategy

### Log Levels

**INFO level:**
- `[DRAAD167-FASE2] Stap 1: Running diagnostics...`
- `[DRAAD167-FASE2] Bottleneck diagnostics...`
- `[DRAAD167-FASE2] Formatting violation details...`
- `[DRAAD167-FASE2] SOLVER STATISTICS:`

**WARNING level:**
- Pre-solve diagnostics failures
- TIGHT capacity situations (ratio < 0.8)

**ERROR level:**
- CRITICAL capacity situations (ratio < 0.6)
- Violation details with suggestions
- INFEASIBLE status reasons

### Log Monitoring

Filter logs for `[DRAAD167-FASE2]` to track:
- Diagnostics activation
- Bottleneck detection
- Violation handling
- Solver statistics

---

## Deployment Checklist

- [ ] solver/solver_engine.py modified with FIX 3 + FIX 4 methods
- [ ] No Python syntax errors (`python -m py_compile` passes)
- [ ] `.DRAAD167-FASE2-ACTIVE` cache bust file created
- [ ] `.railway-trigger-fase2-*` deployment trigger created
- [ ] Patches and documentation committed
- [ ] Git push to main branch
- [ ] Railway deployment succeeds (2-5 min)
- [ ] [DRAAD167-FASE2] markers appear in production logs
- [ ] Test with sample roster request
- [ ] Diagnostics data visible in response metadata

---

## Files Involved

| File | Type | Status | Notes |
|------|------|--------|-------|
| solver/solver_engine.py | CODE | ❌ TO DO | Add FIX 3 + FIX 4 methods |
| solver/solver_patches_draad167_fase2.py | REFERENCE | ✅ CREATED | Code snippets and integration guide |
| solver/DRAAD167-FASE2-QUICK-START.txt | DOCS | ✅ CREATED | Step-by-step implementation guide |
| solver/.DRAAD167-FASE2-ACTIVE | MARKER | ✅ CREATED | Cache bust file |
| solver/.railway-trigger-fase2-* | TRIGGER | ✅ CREATED | Railway deployment trigger |
| solver/DRAAD167-FASE2-README.md | DOCS | ✅ CREATED | This file |

---

## Success Criteria

### Must Have

✅ MUST:
1. No Python syntax errors
2. `_diagnose_bottlenecks()` runs without exceptions
3. Diagnostics appear in `solver_metadata`
4. Violations are formatted with suggestions
5. `[DRAAD167-FASE2]` markers in Railway logs
6. Railway deployment succeeds

### Should Have

✅ SHOULD:
1. Capacity ratio < 1.0 triggers TIGHT status
2. Team analysis breakdown included
3. Suggestions specific to violation type
4. Solver statistics logged
5. Performance impact < 50ms

### Nice to Have

✅ NICE:
1. Historical diagnostics tracking
2. UI display of capacity status
3. Automated alerts for CRITICAL capacity
4. Trend analysis over time

---

## Rollback Procedure

If deployment encounters issues:

1. GitHub → solver/solver_engine.py commit history
2. Find `[DRAAD167-FASE2] Apply FIX 3+4...` commit
3. Click "Revert this commit"
4. Confirm revert
5. Railway auto-deploys reverted version

**Time to rollback:** 2-5 minutes

---

## Next Steps

### Immediate (This week)
1. Apply FIX 3 + FIX 4 to solver_engine.py
2. Deploy to production
3. Monitor logs for 24-48 hours
4. Collect diagnostic data from real rosters

### Short Term (Next week)
1. Review collected diagnostic data
2. Identify most common bottlenecks
3. Plan FASE 3 optimizations
4. Consider UI integration for diagnostics

### Medium Term (Next sprint)
1. FASE 3: Adaptive constraint relaxation
2. UI: Display capacity status in dashboard
3. Monitoring: Set up alerts for CRITICAL capacity
4. Analytics: Track historical trends

---

## Questions & Support

Refer to:
- **Code reference:** solver/solver_patches_draad167_fase2.py
- **Quick start:** solver/DRAAD167-FASE2-QUICK-START.txt
- **FASE 1 background:** solver/DRAAD167-FASE1-README.md
- **Commit history:** GitHub commits with [DRAAD167] tag
- **Railway logs:** https://railway.app (project dashboard)

---

**FASE 2: Ready for implementation!**
