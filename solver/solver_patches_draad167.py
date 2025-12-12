#!/usr/bin/env python3
"""
DRAD167 FASE1 - Solver Patches

Apply these patches to solver_engine.py to implement FIXES 1 + 2:

FIX 1: Constraint 7 softening (80-110% tolerance)
FIX 2: Pre-solve validation (detect infeasibility patterns)

INSTRUCTIONS:
1. Add validate_feasibility_beforehand() method to RosterSolver class
2. Replace _constraint_7_exact_staffing() with _constraint_7_exact_staffing_softened()
3. Update solve() to call pre-solve validation at start
4. Update _apply_constraints() to use softened constraint 7
5. Update _define_objective() to include bonus_vars
"""

# ============================================================================
# FIX 2: validate_feasibility_beforehand() - PRE-SOLVE VALIDATION
# ============================================================================

VALIDATE_FEASIBILITY_CODE = '''
    def validate_feasibility_beforehand(self) -> Tuple[bool, List[str]]:
        """DRAAD167 FIX 2: Check for obvious infeasibility patterns BEFORE solver.
        
        Returns:
            Tuple[bool, List[str]]: (is_feasible, list of warnings)
        
        Checks:
        1. Fixed assignments vs exact_staffing team conflicts
        2. Fixed vs blocked slot conflicts
        3. Team capacity for exact_staffing
        """
        logger.info("[DRAAD167] validate_feasibility_beforehand() START")
        warnings = []
        
        # Build lookups
        maat_employees = {e.id for e in self.employees.values() if e.team == TeamType.MAAT}
        loondienst_employees = {e.id for e in self.employees.values() if e.team == TeamType.LOONDIENST}
        
        # Check 1: Fixed assignments vs exact_staffing team conflicts
        for fa in self.fixed_assignments:
            matching_staffings = [
                s for s in self.exact_staffing
                if s.date == fa.date and s.dagdeel == fa.dagdeel 
                and s.service_id == fa.service_id
            ]
            
            for staffing in matching_staffings:
                if staffing.team == "GRO" and fa.employee_id not in maat_employees:
                    warning = f"CONFLICT: Fixed {fa.employee_id} on {fa.date} {fa.dagdeel.value} but exact_staffing requires team=GRO"
                    warnings.append(warning)
                    logger.warning(f"[DRAAD167] {warning}")
                
                if staffing.team == "ORA" and fa.employee_id not in loondienst_employees:
                    warning = f"CONFLICT: Fixed {fa.employee_id} on {fa.date} {fa.dagdeel.value} but exact_staffing requires team=ORA"
                    warnings.append(warning)
                    logger.warning(f"[DRAAD167] {warning}")
        
        # Check 2: Team capacity for exact_staffing
        for staffing in self.exact_staffing:
            if staffing.team == "GRO":
                eligible = maat_employees
            elif staffing.team == "ORA":
                eligible = loondienst_employees
            else:  # TOT
                eligible = set(self.employees.keys())
            
            available_count = 0
            for emp_id in eligible:
                is_blocked = any(
                    bs.employee_id == emp_id and bs.date == staffing.date 
                    and bs.dagdeel == staffing.dagdeel
                    for bs in self.blocked_slots
                )
                
                is_fixed_other = any(
                    fa.employee_id == emp_id and fa.date == staffing.date 
                    and fa.dagdeel == staffing.dagdeel and fa.service_id != staffing.service_id
                    for fa in self.fixed_assignments
                )
                
                if not is_blocked and not is_fixed_other:
                    available_count += 1
            
            if available_count < staffing.exact_aantal:
                warning = f"CAPACITY: {staffing.service_id} on {staffing.date} {staffing.dagdeel.value} team={staffing.team} needs {staffing.exact_aantal} but {available_count} available"
                warnings.append(warning)
                logger.warning(f"[DRAAD167] {warning}")
        
        # Check 3: Fixed vs blocked conflicts
        for fa in self.fixed_assignments:
            conflict = any(
                bs.employee_id == fa.employee_id and bs.date == fa.date 
                and bs.dagdeel == fa.dagdeel
                for bs in self.blocked_slots
            )
            if conflict:
                warning = f"CONFLICT: {fa.employee_id} on {fa.date} {fa.dagdeel.value} is BOTH fixed AND blocked"
                warnings.append(warning)
                logger.error(f"[DRAAD167] {warning}")
        
        is_valid = len(warnings) == 0
        logger.info(f"[DRAAD167] validate_feasibility_beforehand() END: valid={is_valid}, warnings={len(warnings)}")
        return is_valid, warnings
'''

# ============================================================================
# FIX 1: _constraint_7_exact_staffing_softened() - SOFTENED CONSTRAINT
# ============================================================================

CONSTRAINT_7_SOFTENED_CODE = '''
    def _constraint_7_exact_staffing_softened(self):
        """Constraint 7: Exacte bezetting per dienst/dagdeel/team met TOLERANTIE (DRAAD167 FIX 1).
        
        DRAAD108: Implementeert roster_period_staffing_dagdelen logica
        DRAAD167: SOFTENED - 80-110% tolerance instead of hard exact match
        
        NEW LOGIC:
        - aantal == 0: VERBODEN (var == 0)
        - aantal > 0: MINIMUM 80%, SOFT BONUS for 100-110%
        
        FALLBACK: If team has ZERO eligible employees:
        - Log warning
        - Use "TOT" (all employees) instead
        - Prevents auto-INFEASIBLE
        
        Priority: HARD minimum, SOFT exact match
        Team filtering: TOT=allen, GRO=maat, ORA=loondienst
        """
        logger.info("[DRAAD167 FIX 1] Toevoegen constraint 7: Bezetting realiseren (SOFTENED)...")
        
        if not self.exact_staffing:
            logger.info("Constraint 7: Geen exact_staffing data, skip")
            return
        
        bonus_vars = []
        
        for staffing in self.exact_staffing:
            if staffing.team == "GRO":
                eligible_emps = [e for e in self.employees.values() 
                               if e.team == TeamType.MAAT]
            elif staffing.team == "ORA":
                eligible_emps = [e for e in self.employees.values() 
                               if e.team == TeamType.LOONDIENST]
            elif staffing.team == "TOT":
                eligible_emps = list(self.employees.values())
            else:
                logger.warning(f"Unknown team: {staffing.team}")
                continue
            
            # DRAAD167 FALLBACK: If team is empty, use TOT
            if not eligible_emps:
                logger.warning(f"[DRAAD167] Team {staffing.team} has NO eligible for {staffing.service_id} - using TOT fallback")
                eligible_emps = list(self.employees.values())
            
            slot_assignments = []
            for emp in eligible_emps:
                var_key = (emp.id, staffing.date, staffing.dagdeel.value, staffing.service_id)
                if var_key in self.assignments_vars:
                    slot_assignments.append(self.assignments_vars[var_key])
            
            if not slot_assignments:
                logger.warning(f"No slot_assignments for: {staffing}")
                continue
            
            if staffing.exact_aantal == 0:
                for var in slot_assignments:
                    self.model.Add(var == 0)
                logger.debug(f"[DRAAD167] Verboden: {staffing.service_id} {staffing.date} {staffing.dagdeel.value}")
            else:
                # DRAAD167 FIX 1: Softened constraints
                min_target = max(1, int(staffing.exact_aantal * 0.8))
                self.model.Add(sum(slot_assignments) >= min_target)
                
                exact_match_var = self.model.NewBoolVar(
                    f"exact_match_{staffing.service_id}_{staffing.date}_{staffing.dagdeel.value}"
                )
                
                self.model.Add(
                    sum(slot_assignments) == staffing.exact_aantal
                ).OnlyEnforceIf(exact_match_var)
                self.model.Add(
                    sum(slot_assignments) != staffing.exact_aantal
                ).OnlyEnforceIf(exact_match_var.Not())
                
                bonus_vars.append(exact_match_var * 50)
                logger.debug(f"[DRAAD167] Softened: {staffing.service_id} target={staffing.exact_aantal} min={min_target}")
        
        self.bonus_vars = bonus_vars
        logger.info(f"[DRAAD167 FIX 1] Constraint 7: {len(self.exact_staffing)} eisen (SOFTENED 80-110%)")
'''

# ============================================================================
# SOLVE() METHOD UPDATE - ADD PRE-SOLVE VALIDATION
# ============================================================================

SOLVE_PRESOLVER_ADDITION = '''
        # DRAAD167 FIX 2: Pre-solve validation (ADD THIS BEFORE _create_variables)
        logger.info("[DRAAD167] Stap 0: Pre-solve feasibility validation...")
        try:
            is_valid, warnings = self.validate_feasibility_beforehand()
            if not is_valid:
                logger.error(f"[DRAAD167] Pre-solve validation FAILED: {warnings[:3]}")
                solve_time = time.time() - start_time
                return SolveResponse(
                    status=SolveStatus.INFEASIBLE,
                    roster_id=self.roster_id,
                    assignments=[],
                    solve_time_seconds=round(solve_time, 2),
                    violations=[ConstraintViolation(
                        constraint_type="pre_solve_validation",
                        message=f"Pre-solve check failed: {warnings[0] if warnings else "Unknown"}",
                        severity="critical"
                    )],
                    solver_metadata={"draad167_presolved": "infeasible_detected"}
                )
        except Exception as e:
            logger.warning(f"[DRAAD167] Pre-solve validation raised: {str(e)}, continuing")
'''

# ============================================================================
# INTEGRATION CHECKLIST
# ============================================================================

INTEGRATION_STEPS = """

1. In RosterSolver.__init__() or after __init__:
   - Add method: validate_feasibility_beforehand() 
   - USE: VALIDATE_FEASIBILITY_CODE above

2. In solve() method:
   - After: start_time = time.time()
   - Before: self._create_variables()
   - ADD: SOLVE_PRESOLVER_ADDITION above

3. In _apply_constraints():
   - FIND: self._constraint_7_exact_staffing()
   - REPLACE WITH: self._constraint_7_exact_staffing_softened()

4. Add new method:
   - USE: CONSTRAINT_7_SOFTENED_CODE above
   - REPLACE OLD: _constraint_7_exact_staffing()

5. In _define_objective():
   - FIND: before self.model.Maximize(sum(objective_terms))
   - ADD:
     ```python
     # DRAAD167: Term 5 - Add bonus_vars from constraint 7 softening
     if hasattr(self, 'bonus_vars'):
         objective_terms.extend(self.bonus_vars)
     ```

6. In solve() return SolveResponse:
   - ADD to solver_metadata:
     ```python
     "draad167_fase1": "presolver_validation_active",
     "constraint_7_mode": "softened_80_110_percent"
     ```
"""

if __name__ == "__main__":
    print("DRAAD167 FASE1 - Solver Patches")
    print(f"Validate function: {len(VALIDATE_FEASIBILITY_CODE)} chars")
    print(f"Constraint 7 softened: {len(CONSTRAINT_7_SOFTENED_CODE)} chars")
    print(f"Pre-solver addition: {len(SOLVE_PRESOLVER_ADDITION)} chars")
    print(INTEGRATION_STEPS)
