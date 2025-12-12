# DRAAD167 FASE 1 - Implementation Guide

**Status:** PATCHES COMMITTED, READY FOR IMPLEMENTATION  
**Date:** 2025-12-12  
**Target:** Prevent INFEASIBLE solver collapse + improve diagnostics

## Quick Summary

Two critical fixes to prevent the solver from returning INFEASIBLE when:
- Team has 1-2 missing employees on specific days
- Fixed assignments conflict with exact_staffing team requirements  
- Blocked slots overlap with fixed assignments

## FIXES OVERVIEW

### FIX 1: Constraint 7 Softening (80-110% tolerance)

**Problem:** Constraint 7 uses `==` (hard exact match)
```python
self.model.Add(sum(slot_assignments) == staffing.exact_aantal)  # Fails if off by 1
```

**Solution:** Relax to 80% minimum + soft bonus for exact
```python
min_target = max(1, int(staffing.exact_aantal * 0.8))
self.model.Add(sum(slot_assignments) >= min_target)  # Must be >=80%
# SOFT BONUS for exact match in objective function
```

**Impact:** 
- ✅ Prevents INFEASIBLE when 1-2 slots missing
- ✅ Still incentivizes exact match via objective
- ✅ Fallback: if team empty, use TOT (all employees)

### FIX 2: Pre-Solve Validation (detect conflicts early)

**Problem:** Solver spends time on unsolvable model, no clear error message

**Solution:** Validate BEFORE solver runs
```python
def validate_feasibility_beforehand(self) -> Tuple[bool, List[str]]:
    # Check 1: Fixed vs exact_staffing team conflicts
    # Check 2: Team capacity for exact_staffing
    # Check 3: Fixed vs blocked conflicts
    return is_valid, warnings
```

**In solve() method:**
```python
is_valid, warnings = self.validate_feasibility_beforehand()
if not is_valid:
    return SolveResponse(status=INFEASIBLE, violations=[...])  # Early exit
```

**Impact:**
- ✅ Detects conflicts BEFORE solver (saves compute)
- ✅ Clear error messages (not cryptic INFEASIBLE)
- ✅ Can run standalone for diagnostics

## Implementation Steps

### STEP 1: Understand the patches

Open `solver_patches_draad167.py` - this file contains:
- `VALIDATE_FEASIBILITY_CODE` - Full implementation of validate_feasibility_beforehand()
- `CONSTRAINT_7_SOFTENED_CODE` - Full implementation of _constraint_7_exact_staffing_softened()
- `SOLVE_PRESOLVER_ADDITION` - Code to add to solve() method
- `INTEGRATION_STEPS` - Detailed checklist

### STEP 2: Apply patches to solver_engine.py

**2a. Add validate_feasibility_beforehand() method**

Location: After `__init__` method (around line 90)  
Code: Copy from `solver_patches_draad167.py` → `VALIDATE_FEASIBILITY_CODE`

**2b. Update solve() method**

Location: Beginning of solve() method, after `start_time = time.time()`  
Code: Add from `solver_patches_draad167.py` → `SOLVE_PRESOLVER_ADDITION`

This adds pre-solve validation BEFORE creating variables.

**2c. Replace constraint 7**

Location: In `_apply_constraints()` method, line with `self._constraint_7_exact_staffing()`  
Change:
```python
# OLD:
self._constraint_7_exact_staffing()

# NEW:
self._constraint_7_exact_staffing_softened()
```

**2d. Replace _constraint_7_exact_staffing() with softened version**

Location: Replace entire method (search for `def _constraint_7_exact_staffing`)  
Code: Copy from `solver_patches_draad167.py` → `CONSTRAINT_7_SOFTENED_CODE`

Delete old method starting with `def _constraint_7_exact_staffing(self):` and ending before next `def`.

**2e. Update _define_objective() method**

Location: Near end of _define_objective(), before `self.model.Maximize(sum(objective_terms))`  
Add:
```python
# DRAAD167: Term 5 - Add bonus_vars from constraint 7 softening
if hasattr(self, 'bonus_vars'):
    objective_terms.extend(self.bonus_vars)
```

**2f. Update solver_metadata in solve()**

Location: In return SolveResponse statement, in solver_metadata dict  
Add two lines:
```python
"draad167_fase1": "presolver_validation_active",
"constraint_7_mode": "softened_80_110_percent"
```

### STEP 3: Verify syntax

```bash
python -m py_compile solver/solver_engine.py
# Should complete without errors
```

### STEP 4: Test locally (optional)

```python
from solver.solver_engine import RosterSolver

# Test pre-solver validation
solver = RosterSolver(...)
is_valid, warnings = solver.validate_feasibility_beforehand()
print(f"Valid: {is_valid}, Warnings: {warnings}")

# Test solve with new constraints
response = solver.solve()
print(f"Status: {response.status}")
print(f"DRAAD167 active: {response.solver_metadata.get('draad167_fase1')}")
```

### STEP 5: Commit & Deploy

```bash
git add solver/solver_engine.py
git commit -m "[DRAAD167-FASE1] Apply FIXES 1+2: constraint 7 softening + pre-solve validation"
git push origin main
```

Railway auto-deploys on push (takes ~2-5 minutes).

## Testing Checklist

- [ ] No syntax errors (`python -m py_compile`)
- [ ] Pre-solver validation runs without crashing
- [ ] Constraint 7 accepts 80-110% range  
- [ ] Bonus_vars appear in objective
- [ ] solver_metadata shows DRAAD167 active
- [ ] Cache bust files present
- [ ] Railway deployment succeeds

## Success Criteria

✅ **MUST HAVE:**
1. No Python syntax errors
2. Pre-solve validation runs
3. Constraint 7 is softened (80-110%)
4. solver_metadata contains DRAAD167 flag

✅ **SHOULD HAVE:**
1. Clear logging in solver output
2. Graceful error handling
3. Performance not degraded

## Rollback Plan

If something breaks:

1. GitHub UI → View solver_engine.py commit
2. Click "Revert this commit"
3. Confirm revert
4. Railway auto-deploys reverted version

## Files Involved

| File | Status | Notes |
|------|--------|-------|
| solver/solver_engine.py | ❌ NEEDS UPDATE | Apply FASE1 patches |
| solver/solver_patches_draad167.py | ✅ CREATED | Reference implementation |
| solver/.DRAAD167-FASE1-ACTIVE | ✅ CREATED | Cache bust file |
| solver/.railway-trigger-draad112 | ✅ UPDATED | Railway trigger |
| solver/DRAAD167-FASE1-README.md | ✅ CREATED | This file |

## Next Steps

1. ✅ Cache bust files committed
2. ⏳ **NEXT:** Apply patches to solver_engine.py
3. ⏳ Commit & push to GitHub
4. ⏳ Railway auto-deploys
5. ⏳ Manual test of pre-solver validation

## Questions?

Refer to:
- `solver_patches_draad167.py` - Code snippets
- `DRAAD167-ANALYSIS.md` - Root cause analysis (in chat)
- Previous commits - Implementation history

---

**Ready to proceed with patch application?**
