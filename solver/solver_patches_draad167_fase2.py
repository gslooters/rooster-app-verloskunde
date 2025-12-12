#!/usr/bin/env python3
"""
DRAD167 FASE 2 - Better Diagnostics & Error Messages

Implements FIX 3 + FIX 4:
- FIX 3: Enhanced diagnostic logging (bottleneck detection)
- FIX 4: Better error messages + constraint violation details

APPLY AFTER FASE 1 (constraint 7 softening + pre-solve validation)
"""

# ============================================================================
# FIX 3: Enhanced Diagnostic Logging - Bottleneck Detection
# ============================================================================

DIAGNOSTIC_LOGGER_CODE = '''
    def _diagnose_bottlenecks(self) -> Dict[str, Any]:
        """DRAAD167 FIX 3: Analyze solver bottlenecks before solving.
        
        Returns:
            Dict with diagnostic insights:
            - available_slots: Total slots available per dagdeel
            - required_slots: Total slots required (from exact_staffing)
            - capacity_ratio: Available / Required per dagdeel
            - fixed_coverage: How much fixed_assignments cover
            - blocked_impact: How many slots are blocked
        """
        logger.info("[DRAAD167-FASE2] FIX 3: Running bottleneck diagnostics...")
        
        diagnostics = {
            "timestamp": datetime.datetime.now().isoformat(),
            "roster_id": self.roster_id,
            "total_employees": len(self.employees),
            "total_days": (self.end_date - self.start_date).days + 1,
            "by_dagdeel": {}
        }
        
        # Analyze per dagdeel
        from enum import Enum
        dagdelen_list = [Dagdeel.OCHTEND, Dagdeel.MIDDAG, Dagdeel.AVOND]
        
        for dagdeel in dagdelen_list:
            # Count available slots
            available = 0
            for emp in self.employees.values():
                for day in self._iter_dates(self.start_date, self.end_date):
                    is_blocked = any(
                        bs.employee_id == emp.id and bs.date == day 
                        and bs.dagdeel == dagdeel
                        for bs in self.blocked_slots
                    )
                    if not is_blocked:
                        available += 1
            
            # Count required slots
            required = sum(
                s.exact_aantal for s in self.exact_staffing
                if s.dagdeel == dagdeel
            )
            
            # Count fixed slots
            fixed = len([
                fa for fa in self.fixed_assignments
                if fa.dagdeel == dagdeel
            ])
            
            # Count blocked
            blocked = len([
                bs for bs in self.blocked_slots
                if bs.dagdeel == dagdeel
            ])
            
            capacity_ratio = available / max(required, 1)
            
            diagnostics["by_dagdeel"][dagdeel.value] = {
                "available_slots": available,
                "required_slots": required,
                "fixed_slots": fixed,
                "blocked_slots": blocked,
                "capacity_ratio": round(capacity_ratio, 2),
                "status": "OK" if capacity_ratio >= 0.8 else "TIGHT" if capacity_ratio >= 0.6 else "CRITICAL"
            }
        
        # Team analysis
        diagnostics["by_team"] = {}
        for team_type in [TeamType.MAAT, TeamType.LOONDIENST]:
            team_emps = [e for e in self.employees.values() if e.team == team_type]
            diagnostics["by_team"][team_type.value] = {
                "total_employees": len(team_emps),
                "available_for_exact": sum(
                    1 for e in team_emps
                    if not any(bs.employee_id == e.id for bs in self.blocked_slots)
                )
            }
        
        logger.info(f"[DRAAD167-FASE2] Diagnostics: {diagnostics}")
        return diagnostics
    
    def _iter_dates(self, start, end):
        """Helper to iterate dates."""
        current = start
        while current <= end:
            yield current
            current += datetime.timedelta(days=1)
'''

# ============================================================================
# FIX 4: Better Error Messages & Constraint Violation Details
# ============================================================================

BETTER_ERRORS_CODE = '''
    def _format_violation_details(self, violation: ConstraintViolation) -> str:
        """DRAAD167 FIX 4: Format violation with actionable details.
        
        Args:
            violation: ConstraintViolation object
        
        Returns:
            Human-readable violation message with suggestions
        """
        msg = f"\n{'='*60}\n"
        msg += f"CONSTRAINT VIOLATION: {violation.constraint_type}\n"
        msg += f"Severity: {violation.severity}\n"
        msg += f"Message: {violation.message}\n"
        
        # Add context-specific suggestions
        if "CONFLICT" in violation.message:
            msg += "\n→ SUGGESTION: Check fixed_assignments vs exact_staffing team requirements\n"
            msg += "→ ACTION: Verify employee team matches requirement (GRO/ORA/TOT)\n"
        
        elif "CAPACITY" in violation.message:
            msg += "\n→ SUGGESTION: Not enough employees available for exact staffing requirement\n"
            msg += "→ ACTION: Reduce exact_staffing count OR unblock employees\n"
        
        elif "BOTH fixed AND blocked" in violation.message:
            msg += "\n→ SUGGESTION: Employee cannot be assigned and blocked simultaneously\n"
            msg += "→ ACTION: Remove either fixed_assignment or blocked_slot\n"
        
        elif "Pre-solve check" in violation.message:
            msg += "\n→ SUGGESTION: Model has infeasibility pattern detected before solving\n"
            msg += "→ ACTION: Review diagnostics in solver logs for details\n"
        
        msg += f"{'='*60}\n"
        return msg
    
    def _log_solver_stats(self, response: SolveResponse) -> None:
        """DRAAD167 FIX 4: Log detailed solver statistics.
        
        Args:
            response: SolveResponse from solver
        """
        logger.info("[DRAAD167-FASE2] SOLVER STATISTICS:")
        logger.info(f"  Status: {response.status}")
        logger.info(f"  Solve time: {response.solve_time_seconds}s")
        logger.info(f"  Assignments: {len(response.assignments)}")
        logger.info(f"  Violations: {len(response.violations)}")
        
        if response.violations:
            logger.warning("[DRAAD167-FASE2] VIOLATIONS DETECTED:")
            for i, v in enumerate(response.violations[:5], 1):
                logger.warning(f"  [{i}] {v.constraint_type}: {v.message}")
        
        if response.solver_metadata:
            logger.info(f"  Metadata: {response.solver_metadata}")
'''

# ============================================================================
# UPDATE solve() - ADD DIAGNOSTICS CALL
# ============================================================================

SOLVE_DIAGNOSTICS_UPDATE = '''
        # DRAAD167 FIX 3: Run diagnostics
        logger.info("[DRAAD167-FASE2] Stap 1: Running diagnostics...")
        try:
            diagnostics = self._diagnose_bottlenecks()
            solver_metadata["diagnostics"] = diagnostics
        except Exception as e:
            logger.warning(f"[DRAAD167-FASE2] Diagnostics failed: {e}")
        
        # ... rest of solve continues ...
'''

# ============================================================================
# UPDATE SolveResponse - ADD BETTER ERROR FORMATTING
# ============================================================================

SOLVEREQUEST_UPDATE = '''
        # DRAAD167 FIX 4: Format violations with better details
        if response.violations:
            logger.error("[DRAAD167-FASE2] Formatting violation details...")
            for violation in response.violations:
                detail_msg = self._format_violation_details(violation)
                logger.error(detail_msg)
        
        # Log solver statistics
        self._log_solver_stats(response)
        
        return response
'''

# ============================================================================
# INTEGRATION CHECKLIST - FASE 2
# ============================================================================

FASE2_INTEGRATION = """

== FASE 2 INTEGRATION STEPS ==

Prerequisite: FASE 1 (constraint 7 softening + pre-solve validation) must be applied first.

1. Add DIAGNOSTIC METHODS to RosterSolver class:
   - Add: _diagnose_bottlenecks()
   - Add: _iter_dates() helper
   - Location: After validate_feasibility_beforehand() method
   - Source: DIAGNOSTIC_LOGGER_CODE above

2. Add ERROR FORMATTING METHODS:
   - Add: _format_violation_details()
   - Add: _log_solver_stats()
   - Location: End of RosterSolver class
   - Source: BETTER_ERRORS_CODE above

3. Update solve() method:
   - After pre-solve validation (FASE 1)
   - Add diagnostics call: SOLVE_DIAGNOSTICS_UPDATE
   - This runs _diagnose_bottlenecks() and stores in metadata

4. Update final return in solve():
   - Before returning response
   - Add: SOLVEREQUEST_UPDATE
   - Formats violations and logs statistics

5. Cache bust:
   - Update: .DRAAD167-FASE2-ACTIVE (new timestamp)
   - Update: .railway-trigger-fase2 (new random number)
   - Commit both

6. Test:
   - python -m py_compile solver/solver_engine.py
   - Should complete without errors
   - Watch Railway logs for [DRAAD167-FASE2] markers

7. Commit & Deploy:
   - git add solver/solver_engine.py
   - git add .DRAAD167-FASE2-ACTIVE
   - git add .railway-trigger-fase2
   - git commit -m "[DRAAD167-FASE2] Apply FIX 3+4: Better diagnostics & error messages"
   - git push origin main
   - Railway auto-deploys

== SUCCESS CRITERIA ==

✅ MUST HAVE:
1. _diagnose_bottlenecks() runs without errors
2. Diagnostics appear in solver_metadata
3. Violations have detailed formatted messages
4. [DRAAD167-FASE2] markers appear in Railway logs

✅ SHOULD HAVE:
1. Capacity ratios per dagdeel
2. Team analysis (available vs required)
3. Violation suggestions in log output
4. Solver statistics logged

== TESTING CHECKLIST ==

- [ ] No syntax errors
- [ ] Diagnostics function runs
- [ ] Bottleneck detection works
- [ ] Violation details are formatted
- [ ] Solver stats are logged
- [ ] Cache bust files committed
- [ ] Railway deployment succeeds
- [ ] Log output shows [DRAAD167-FASE2] markers

== ROLLBACK ==

If issues occur:
1. GitHub UI → solver/solver_engine.py commit
2. Click "Revert this commit"
3. Railway auto-deploys reverted version

"""

if __name__ == "__main__":
    print("DRAAD167 FASE 2 - Better Diagnostics & Error Messages")
    print(f"FIX 3 (Diagnostics): {len(DIAGNOSTIC_LOGGER_CODE)} chars")
    print(f"FIX 4 (Error formatting): {len(BETTER_ERRORS_CODE)} chars")
    print(f"Solve update: {len(SOLVE_DIAGNOSTICS_UPDATE)} chars")
    print(FASE2_INTEGRATION)
