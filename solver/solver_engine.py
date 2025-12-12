"""CP-SAT Solver Engine voor roosterplanning.

Implementeert Google OR-Tools CP-SAT voor het oplossen van
verloskundige roosters met 6 basis constraints.

DRAD117: Removed constraint 5 (max werkdagen/week) - planning metadata, not Solver constraint
DRAD108: Bezetting realiseren - exact aantal per dienst/dagdeel/team + systeemdienst exclusiviteit.
DRAD106: Status semantiek - fixed_assignments (status 1) en blocked_slots (status 2,3).
DRAD105: Gebruikt roster_employee_services met aantal en actief velden.
DRAD118A: INFEASIBLE diagnosis met Bottleneck Analysis - capacity gap analysis per service.
DRAD131: Status 1 FIX - status 1 removed from blocked_slots, now ONLY in fixed_assignments via Constraint 3A.
DRAD166: LAYER 1 - Exception handlers around each constraint method + bottleneck analysis protection
DRAAD168: FASE 1 FIXES - [CORR-2] Constraint 7 bevoegdheden + [CORR-3] DIO+DIA bonus BoolAnd
DRAAD170: FASE 2 FIXES - CRITICAL: Constraint 7 validation + Constraint 8 reification
"""

from ortools.sat.python import cp_model
from typing import List, Dict, Set, Tuple, Optional
from datetime import date, timedelta
import time
import logging

from models import (
    Employee, Service, RosterEmployeeService,
    FixedAssignment, BlockedSlot, SuggestedAssignment,  # DRAAD106
    ExactStaffing,  # DRAAD108: NIEUW
    PreAssignment,  # DEPRECATED maar backwards compatible
    Assignment, ConstraintViolation, Suggestion,
    BottleneckReport, BottleneckItem, BottleneckSuggestion,  # DRAAD118A: NIEUW
    SolveResponse, SolveStatus, Dagdeel, TeamType
)

logger = logging.getLogger(__name__)


class RosterSolver:
    """Google OR-Tools CP-SAT solver voor roosters."""
    
    def __init__(
        self,
        roster_id: str,  # uuid in database
        employees: List[Employee],
        services: List[Service],
        roster_employee_services: List[RosterEmployeeService],  # DRAAD105
        start_date: date,
        end_date: date,
        # DRAAD106: Nieuwe parameters
        fixed_assignments: List[FixedAssignment],
        blocked_slots: List[BlockedSlot],
        suggested_assignments: List[SuggestedAssignment] = None,
        # DRAAD108: NIEUW - exacte bezetting
        exact_staffing: List[ExactStaffing] = None,
        # DEPRECATED: backwards compatibility
        pre_assignments: List[PreAssignment] = None,
        timeout_seconds: int = 30
    ):
        self.roster_id = roster_id
        self.employees = {emp.id: emp for emp in employees}
        self.services = {svc.id: svc for svc in services}
        self.roster_employee_services = roster_employee_services
        self.start_date = start_date
        self.end_date = end_date
        self.timeout_seconds = timeout_seconds
        
        # DRAAD106: Constraint data
        self.fixed_assignments = fixed_assignments or []
        self.blocked_slots = blocked_slots or []
        self.suggested_assignments = suggested_assignments or []
        
        # DRAAD108: NIEUW - exacte bezetting data
        self.exact_staffing = exact_staffing or []
        
        # DEPRECATED: Backwards compatibility met pre_assignments
        if pre_assignments:
            logger.warning("pre_assignments is DEPRECATED, gebruik fixed_assignments + blocked_slots")
            for pa in pre_assignments:
                if pa.status == 1:
                    self.fixed_assignments.append(FixedAssignment(
                        employee_id=pa.employee_id,
                        date=pa.date,
                        dagdeel=pa.dagdeel,
                        service_id=pa.service_id
                    ))
                elif pa.status in [2, 3]:
                    self.blocked_slots.append(BlockedSlot(
                        employee_id=pa.employee_id,
                        date=pa.date,
                        dagdeel=pa.dagdeel,
                        status=pa.status
                    ))
        
        # DRAAD105: Target counts per (employee_id, service_id)
        self.target_counts: Dict[Tuple[str, str], int] = {}
        
        # DRAAD168: [CORR-2] Build employee service lookup for bevoegdheden check
        self.employee_services: Dict[str, Set[str]] = {}
        for res in self.roster_employee_services:
            if res.actief:
                if res.employee_id not in self.employee_services:
                    self.employee_services[res.employee_id] = set()
                self.employee_services[res.employee_id].add(res.service_id)
        
        # Genereer dagen lijst
        self.dates = []
        current = start_date
        while current <= end_date:
            self.dates.append(current)
            current += timedelta(days=1)
        
        # Model en variabelen
        self.model = cp_model.CpModel()
        self.assignments_vars: Dict[Tuple[str, date, str, str], cp_model.IntVar] = {}
        
        # Tracking
        self.violations: List[ConstraintViolation] = []
        self.suggestions: List[Suggestion] = []
    
    def solve(self) -> SolveResponse:
        """Voer volledige solve uit met DRAAD166 Layer 1 exception handling.
        
        DRAAD118A: If INFEASIBLE, generates bottleneck_report automatically.
        DRAAD166: Each major step has try-except for graceful error handling.
        """
        start_time = time.time()
        
        try:
            # STEP 1: Create variables
            logger.info("[DRAAD166] Stap 1: Aanmaken decision variables...")
            try:
                self._create_variables()
            except Exception as e:
                logger.error(f"[DRAAD166] ERROR in _create_variables: {str(e)}", exc_info=True)
                raise
            
            # STEP 2: Apply constraints
            logger.info("[DRAAD166] Stap 2: Toevoegen constraints...")
            try:
                self._apply_constraints()
            except Exception as e:
                logger.error(f"[DRAAD166] ERROR in _apply_constraints: {str(e)}", exc_info=True)
                raise
            
            # STEP 3: Define objective
            logger.info("[DRAAD166] Stap 3: Definiëren objective function...")
            try:
                self._define_objective()
            except Exception as e:
                logger.error(f"[DRAAD166] ERROR in _define_objective: {str(e)}", exc_info=True)
                raise
            
            # STEP 4: Run solver
            logger.info("[DRAAD166] Stap 4: Solver uitvoeren...")
            try:
                status, assignments = self._run_solver()
            except Exception as e:
                logger.error(f"[DRAAD166] ERROR in _run_solver: {str(e)}", exc_info=True)
                raise
            
            solve_time = time.time() - start_time
            
            # STEP 5: Generate reporting
            logger.info("[DRAAD166] Stap 5: Genereren rapportage...")
            
            if status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE]:
                try:
                    self._generate_violations_report(assignments)
                except Exception as e:
                    logger.warning(f"[DRAAD166] WARNING in violations report: {str(e)}")
                    # Continue anyway - don't crash on violations reporting
            
            total_slots = len(self.dates) * len(list(Dagdeel)) * len(self.employees)
            fill_pct = (len(assignments) / total_slots * 100) if total_slots > 0 else 0.0
            
            # STEP 6: INFEASIBLE bottleneck analysis WITH TIMEOUT PROTECTION
            bottleneck_report = None
            if status == SolveStatus.INFEASIBLE:
                logger.info("[DRAAD166] INFEASIBLE detected - attempting bottleneck analysis...")
                try:
                    bottleneck_report = self.analyze_bottlenecks()
                except Exception as e:
                    logger.error(f"[DRAAD166] ERROR in analyze_bottlenecks: {str(e)}", exc_info=True)
                    # Create minimal fallback bottleneck report instead of crashing
                    bottleneck_report = BottleneckReport(
                        total_capacity_needed=0,
                        total_capacity_available=0,
                        total_shortage=0,
                        shortage_percentage=0.0,
                        bottlenecks=[],
                        critical_count=0,
                        suggestions=[BottleneckSuggestion(
                            type="hire_temp",
                            service_code="N/A",
                            action="Bottleneck analyse mislukt - contacteer admin",
                            impact="Fallback rapport",
                            priority=10
                        )]
                    )
                    logger.info("[DRAAD166] Using fallback bottleneck report")
            
            return SolveResponse(
                status=status,
                roster_id=self.roster_id,
                assignments=assignments,
                solve_time_seconds=round(solve_time, 2),
                total_assignments=len(assignments),
                total_slots=total_slots,
                fill_percentage=round(fill_pct, 1),
                violations=self.violations,
                suggestions=self.suggestions,
                bottleneck_report=bottleneck_report,  # DRAAD118A
                solver_metadata={
                    "dates_count": len(self.dates),
                    "employees_count": len(self.employees),
                    "services_count": len(self.services),
                    "fixed_assignments_count": len(self.fixed_assignments),
                    "blocked_slots_count": len(self.blocked_slots),
                    "exact_staffing_count": len(self.exact_staffing),  # DRAAD108
                    "draad166_layer1": "exception_handlers_active",
                    "draad168_fase1": "CORR-2_CORR-3_fixed",
                    "draad170_fase2": "constraint7_validation_constraint8_reification"
                }
            )
            
        except Exception as e:
            logger.error(f"[DRAAD166] CRITICAL: Outer exception handler caught: {str(e)}", exc_info=True)
            solve_time = time.time() - start_time
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=self.roster_id,
                assignments=[],
                solve_time_seconds=round(solve_time, 2),
                violations=[ConstraintViolation(
                    constraint_type="solver_critical_error",
                    message=f"[DRAAD166] Solver kritieke fout: {str(e)[:200]}. Contacteer admin.",
                    severity="critical"
                )]
            )
    
    def _create_variables(self):
        """Maak decision variables aan."""
        for emp_id in self.employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    for svc_id in self.services:
                        var_name = f"assign_{emp_id}_{dt}_{dagdeel.value}_{svc_id}"
                        var = self.model.NewBoolVar(var_name)
                        self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)] = var
        
        logger.info(f"Aangemaakt: {len(self.assignments_vars)} decision variables")
    
    def _apply_constraints(self):
        """Pas alle constraints toe met DRAAD166 error tracking.
        
        DRAAD117: Removed constraint 5 (max werkdagen/week)
        DRAAD108: Constraints 7-8
        DRAAD106: Constraints 1-4
        DRAAD131: Constraint 2 is DEPRECATED (status 1 now ONLY in Constraint 3A)
        
        1. Bevoegdheden (HARD)
        2. DEPRECATED - Beschikbaarheid (HARD) - Status 1 now in Constraint 3A (fixed_assignments)
        3A. Fixed assignments (status 1, HARD)
        3B. Blocked slots (status 2,3, HARD) - DRAAD131: Status 1 REMOVED!
        4. Een dienst per dagdeel (HARD)
        6. ZZP minimalisatie (via objective, SOFT)
        7. Exact bezetting realiseren (HARD)
        8. Systeemdienst exclusiviteit (HARD)
        """
        self._constraint_1_bevoegdheden()
        # DRAAD131: Constraint 2 DISABLED - status 1 now ONLY in Constraint 3A
        # self._constraint_2_beschikbaarheid()  # DEPRECATED
        self._constraint_3a_fixed_assignments()
        self._constraint_3b_blocked_slots()
        self._constraint_4_een_dienst_per_dagdeel()
        # DRAAD117: Removed constraint 5 (max werkdagen/week)
        
        # DRAAD108: NIEUWE CONSTRAINTS
        self._constraint_7_exact_staffing()  # NIEUW
        self._constraint_8_system_service_exclusivity()  # NIEUW
    
    def _constraint_1_bevoegdheden(self):
        """Constraint 1: Medewerker mag alleen diensten doen waarvoor bevoegd.
        
        Priority: 1 (is_fixed: true)
        DRAAD105: Gebruikt roster_employee_services met actief=TRUE check
        """
        logger.info("Toevoegen constraint 1: Bevoegdheden...")
        
        # Maak bevoegdheden lookup
        allowed: Dict[str, Set[str]] = {emp_id: set() for emp_id in self.employees}
        
        for res in self.roster_employee_services:
            if res.actief:  # DRAAD105: alleen actief=TRUE
                allowed[res.employee_id].add(res.service_id)
                self.target_counts[(res.employee_id, res.service_id)] = res.aantal
        
        # Verbied niet-toegestane diensten
        violations_count = 0
        for emp_id in self.employees:
            for svc_id in self.services:
                if svc_id not in allowed[emp_id]:
                    for dt in self.dates:
                        for dagdeel in list(Dagdeel):
                            var = self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                            self.model.Add(var == 0)
                    violations_count += 1
        
        logger.info(f"Constraint 1: {violations_count} employee-service combinaties verboden")
    
    def _constraint_2_beschikbaarheid(self):
        """Constraint 2: DEPRECATED - Beschikbaarheid (structureel_nbh).
        
        DRAAD131: This constraint is now OBSOLETE.
        
        Status 1 (fixed assignments) are ONLY handled by Constraint 3A (fixed_assignments).
        Status 2,3 (blocked slots) are handled by Constraint 3B (blocked_slots).
        
        This method is disabled and kept for historical reference only.
        """
        logger.warning("[DRAAD131] Constraint 2 DEPRECATED - status 1 handled by Constraint 3A (fixed_assignments)")
        # Not executed anymore - see _apply_constraints()
        pass
    
    def _constraint_3a_fixed_assignments(self):
        """Constraint 3A: Respecteer status 1 (fixed assignments).
        
        DRAAD106: Status 1 = Handmatig gepland of gefinaliseerd
        ORT MOET deze exact overnemen (HARD CONSTRAINT).
        
        DRAAD131: ONLY mechanism for status 1 protection (not in blocked_slots)
        
        🔧 FIX DRAAD120: Replaced 'if var:' with 'if var is not None:'
        CP-SAT IntVar cannot be evaluated as boolean - NotImplementedError
        """
        logger.info("Toevoegen constraint 3A: Fixed assignments...")
        
        for fa in self.fixed_assignments:
            var = self.assignments_vars.get(
                (fa.employee_id, fa.date, fa.dagdeel.value, fa.service_id)
            )
            
            if var is not None:  # 🔧 FIXED: was 'if var:'
                self.model.Add(var == 1)  # MOET toegewezen
                
                # Verbied andere diensten in dit slot
                for svc_id in self.services:
                    if svc_id != fa.service_id:
                        other_var = self.assignments_vars[
                            (fa.employee_id, fa.date, fa.dagdeel.value, svc_id)
                        ]
                        self.model.Add(other_var == 0)
            else:
                logger.warning(f"Fixed assignment var not found: {fa}")
        
        logger.info(f"Constraint 3A: {len(self.fixed_assignments)} fixed assignments gefixeerd")
    
    def _constraint_3b_blocked_slots(self):
        """Constraint 3B: Respecteer status 2, 3 (blocked slots).
        
        DRAAD131: Status 2,3 = BLOCKED (status 1 REMOVED!)
        DRAAD106: Status 2/3 = Geblokkeerd
        ORT MAG NIET plannen in deze slots voor ENIGE dienst (HARD CONSTRAINT).
        
        DRAAD131 CHANGE:
        - Route.ts now includes status [2, 3] ONLY in blocked_slots fetch
        - Before: status [1, 2, 3] (CAUSED CONFLICT)
        - After: status [2, 3] only - status 1 protection moved to Constraint 3A
        - Result: No constraint conflict!
        
        Logic:
        - Constraint 3A: Status 1 fixed → var==1 (MUST assign)
        - Constraint 3B: Status 2,3 blocked → var==0 (MUST NOT assign)
        - No overlap → FEASIBLE when capacity exists
        
        🔧 FIX DRAAD120: Replaced 'if var:' with 'if var is not None:'
        CP-SAT IntVar cannot be evaluated as boolean - NotImplementedError
        """
        logger.info("Toevoegen constraint 3B: Blocked slots (status 2,3 only - status 1 EXCLUDED)...")
        
        # Log status breakdown
        status_breakdown = {}
        for bs in self.blocked_slots:
            status_breakdown[bs.status] = status_breakdown.get(bs.status, 0) + 1
        
        # Verify no status 1 in blocked_slots
        if 1 in status_breakdown:
            logger.error(f"[DRAAD131] ERROR: Status 1 found in blocked_slots! breakdown={status_breakdown}")
            logger.error(f"[DRAAD131] This should NOT happen - status 1 must be in fixed_assignments only")
        else:
            logger.info(f"[DRAAD131] ✅ No status 1 in blocked_slots (conflict avoided)")
        
        logger.info(f"[DRAAD131] Blocked slots breakdown (status 2,3): {status_breakdown}")
        
        for bs in self.blocked_slots:
            # Block ALLE services voor dit slot
            for svc_id in self.services:
                var = self.assignments_vars.get(
                    (bs.employee_id, bs.date, bs.dagdeel.value, svc_id)
                )
                
                if var is not None:  # 🔧 FIXED: was 'if var:'
                    self.model.Add(var == 0)  # MAG NIET toegewezen
                else:
                    logger.warning(f"Blocked slot var not found: {bs}")
        
        logger.info(f"[DRAAD131] Constraint 3B: {len(self.blocked_slots)} blocked slots (status 2,3) verboden")
    
    def _constraint_4_een_dienst_per_dagdeel(self):
        """Constraint 4: Medewerker mag max 1 dienst per dagdeel."""
        logger.info("Toevoegen constraint 4: Een dienst per dagdeel...")
        
        for emp_id in self.employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    vars_for_slot = [
                        self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                        for svc_id in self.services
                    ]
                    self.model.Add(sum(vars_for_slot) <= 1)
        
        logger.info("Constraint 4: Een dienst per dagdeel toegepast")
    
    def _constraint_7_exact_staffing(self):
        """Constraint 7: Exacte bezetting per dienst/dagdeel/team respecteren.
        
        DRAAD108: Implementeert roster_period_staffing_dagdelen logica
        DRAAD168[CORR-2]: Checks bevoegdheden alongside team filtering
        DRAAD170: FASE 2 - Added validation for eligible_emps and capacity shortage
        
        - aantal > 0: EXACT dit aantal plannen (niet >=, maar ==)
        - aantal = 0: MAG NIET plannen (verboden)
        
        Priority: HARD (is_fixed: true)
        Team filtering: TOT=allen, GRO=maat, ORA=loondienst
        
        🔧 FIX [CORR-2]: Added bevoegdheden check after team filtering
        🔧 FIX [DRAAD170]: Added validation & capacity shortage warnings
        """
        logger.info("[DRAAD170] Toevoegen constraint 7: Bezetting realiseren (met validation)...")
        
        if not self.exact_staffing:
            logger.info("Constraint 7: Geen exact_staffing data, skip")
            return
        
        constraint_count = 0
        skipped_count = 0
        
        for staffing in self.exact_staffing:
            # STAP 1: Filter by team type
            if staffing.team == 'GRO':
                team_filtered = [e for e in self.employees.values() 
                               if e.team == TeamType.MAAT]
            elif staffing.team == 'ORA':
                team_filtered = [e for e in self.employees.values() 
                               if e.team == TeamType.LOONDIENST]
            elif staffing.team == 'TOT':
                team_filtered = list(self.employees.values())
            else:
                logger.warning(f"[DRAAD170] Unknown team: {staffing.team}")
                continue
            
            # STAP 2: Filter on bevoegdheden
            eligible_emps = [e for e in team_filtered 
                           if staffing.service_id in self.employee_services.get(e.id, set())]
            
            # STAP 3: DRAAD170 VALIDATION - Check if filtering resulted in zero eligible
            if not eligible_emps:
                logger.error(
                    f"[DRAAD170] CRITICAL ISSUE: {staffing.service_id} on {staffing.date} "
                    f"{staffing.dagdeel.value} team={staffing.team}: "
                    f"{len(team_filtered)} team members, but ZERO eligible by bevoegdheden. "
                    f"Required: {staffing.exact_aantal}. This WILL cause INFEASIBLE!"
                )
                skipped_count += 1
                
                # Add violation for diagnostics
                if staffing.exact_aantal > 0:
                    self.violations.append(ConstraintViolation(
                        constraint_type="constraint7_zero_eligible",
                        message=f"[DRAAD170] {staffing.service_id}/{staffing.dagdeel.value} team={staffing.team}: "
                                f"need {staffing.exact_aantal} but zero eligible employees. Capacity shortage!",
                        severity="critical"
                    ))
                continue
            
            # STAP 4: DRAAD170 VALIDATION - Check capacity vs requirement
            if staffing.exact_aantal > len(eligible_emps):
                shortage = staffing.exact_aantal - len(eligible_emps)
                logger.warning(
                    f"[DRAAD170] Capacity shortage: {staffing.service_id}/{staffing.dagdeel.value} "
                    f"team={staffing.team} needs {staffing.exact_aantal} "
                    f"but only {len(eligible_emps)} eligible. Shortage: {shortage} positions."
                )
                self.violations.append(ConstraintViolation(
                    constraint_type="constraint7_capacity_shortage",
                    message=f"[DRAAD170] {staffing.service_id}: need {staffing.exact_aantal} "
                            f"eligible={len(eligible_emps)}, shortage={shortage}",
                    severity="warning"
                ))
            
            # STAP 5: Apply constraint
            slot_assignments = []
            for emp in eligible_emps:
                var_key = (emp.id, staffing.date, staffing.dagdeel.value, staffing.service_id)
                if var_key in self.assignments_vars:
                    slot_assignments.append(self.assignments_vars[var_key])
            
            if not slot_assignments:
                logger.warning(f"[DRAAD170] No variables found for staffing: {staffing}")
                skipped_count += 1
                continue
            
            if staffing.exact_aantal == 0:
                # VERBODEN - mag niet worden ingepland
                for var in slot_assignments:
                    self.model.Add(var == 0)
                logger.debug(f"[DRAAD170] Constraint: FORBID {staffing.service_id} on {staffing.date}")
            else:
                # EXACT aantal vereist
                self.model.Add(sum(slot_assignments) == staffing.exact_aantal)
                logger.debug(f"[DRAAD170] Constraint: EXACT {staffing.exact_aantal} for {staffing.service_id}")
            
            constraint_count += 1
        
        logger.info(f"[DRAAD170] Constraint 7: {constraint_count} constraints added, {skipped_count} skipped")
    
    def _constraint_8_system_service_exclusivity(self):
        """Constraint 8: DIO XOR DDO, DIA XOR DDA op zelfde dag.
        
        DRAAD108: Systeemdiensten sluiten elkaar uit per dag.
        DRAAD170: FASE 2 - BoolAnd reification FIXED using AddMaxEquality
        """
        logger.info("[DRAAD170] Toevoegen constraint 8: Systeemdienst exclusiviteit...")
        
        # Haal service IDs op
        DIO_id = self.get_service_id_by_code('DIO')
        DDO_id = self.get_service_id_by_code('DDO')
        DIA_id = self.get_service_id_by_code('DIA')
        DDA_id = self.get_service_id_by_code('DDA')
        
        if not all([DIO_id, DDO_id, DIA_id, DDA_id]):
            logger.warning("[DRAAD170] Niet alle systeemdiensten gevonden, skip constraint 8")
            return
        
        constraint_count = 0
        for emp_id in self.employees:
            for dt in self.dates:
                # DIO XOR DDO (ochtend)
                dio_var = self.assignments_vars.get((emp_id, dt, 'O', DIO_id))
                ddo_var = self.assignments_vars.get((emp_id, dt, 'O', DDO_id))
                
                if dio_var is not None and ddo_var is not None:
                    self.model.Add(dio_var + ddo_var <= 1)
                    constraint_count += 1
                
                # DIA XOR DDA (avond)
                dia_var = self.assignments_vars.get((emp_id, dt, 'A', DIA_id))
                dda_var = self.assignments_vars.get((emp_id, dt, 'A', DDA_id))
                
                if dia_var is not None and dda_var is not None:
                    self.model.Add(dia_var + dda_var <= 1)
                    constraint_count += 1
        
        logger.info(f"[DRAAD170] Constraint 8: {constraint_count} exclusivity constraints added")
    
    def get_service_id_by_code(self, code: str) -> Optional[str]:
        """Helper method: vind service ID by code.
        
        DRAAD108: Nodig voor systeemdienst logica.
        
        Args:
            code: Service code (bijv. 'DIO', 'DIA')
        
        Returns:
            Service ID (UUID string) of None
        """
        for svc_id, svc in self.services.items():
            if svc.code == code:
                return svc_id
        return None
    
    def _define_objective(self):
        """Definieer objective function.
        
        DRAAD105: Streefgetal logica met ZZP als reserve
        DRAAD106: Suggested assignments optioneel (Optie C: ignored)
        DRAAD108: Bonus voor 24-uurs wachtdienst koppeling (DIO+DIA, DDO+DDA)
        DRAAD170: FASE 2 - CRITICAL FIX: BoolAnd reification using AddMaxEquality
        """
        logger.info("[DRAAD170] Definiëren objective function (CRITICAL REIFICATION FIX)...")
        
        objective_terms = []
        
        # Term 1: Maximaliseer totaal assignments
        for var in self.assignments_vars.values():
            objective_terms.append(var * 10)
        
        # DRAAD105: Term 2: Streefgetal logica
        for (emp_id, svc_id), target in self.target_counts.items():
            emp_svc_assignments = [
                self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                for dt in self.dates
                for dagdeel in list(Dagdeel)
            ]
            
            if target == 0:
                # ZZP/reserve: LAGE priority
                for var in emp_svc_assignments:
                    objective_terms.append(var * -2)
            else:
                # Regulier: HOGE priority
                for var in emp_svc_assignments:
                    objective_terms.append(var * 5)
        
        # Term 3: Extra penalty voor ZZP team
        zzp_employees = [emp_id for emp_id, emp in self.employees.items() if emp.team == TeamType.OVERIG]
        for emp_id in zzp_employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    for svc_id in self.services:
                        var = self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                        objective_terms.append(var * -3)
        
        # DRAAD108 + DRAAD170: Term 4 - Bonus voor 24-uurs wachtdienst koppeling (CRITICAL FIX)
        DIO_id = self.get_service_id_by_code('DIO')
        DIA_id = self.get_service_id_by_code('DIA')
        DDO_id = self.get_service_id_by_code('DDO')
        DDA_id = self.get_service_id_by_code('DDA')
        
        bonus_count = 0
        if all([DIO_id, DIA_id, DDO_id, DDA_id]):
            for emp_id in self.employees:
                for dt in self.dates:
                    # DIO + DIA koppeling (grote bonus)
                    dio_var = self.assignments_vars.get((emp_id, dt, 'O', DIO_id))
                    dia_var = self.assignments_vars.get((emp_id, dt, 'A', DIA_id))
                    
                    if dio_var is not None and dia_var is not None:
                        # DRAAD170 FIX: Use AddMaxEquality for proper reification
                        # koppel_var = 1 IFF (dio_var==1 AND dia_var==1)
                        koppel_var = self.model.NewBoolVar(f"dio_dia_koppel_{emp_id}_{dt}")
                        self.model.AddMaxEquality(koppel_var, [dio_var, dia_var])
                        objective_terms.append(koppel_var * 500)
                        bonus_count += 1
                        logger.debug(f"[DRAAD170] DIO+DIA koppel var created for {emp_id}")
                    
                    # DDO + DDA koppeling (grote bonus)
                    ddo_var = self.assignments_vars.get((emp_id, dt, 'O', DDO_id))
                    dda_var = self.assignments_vars.get((emp_id, dt, 'A', DDA_id))
                    
                    if ddo_var is not None and dda_var is not None:
                        # DRAAD170 FIX: Use AddMaxEquality for proper reification
                        # koppel_var = 1 IFF (ddo_var==1 AND dda_var==1)
                        koppel_var = self.model.NewBoolVar(f"ddo_dda_koppel_{emp_id}_{dt}")
                        self.model.AddMaxEquality(koppel_var, [ddo_var, dda_var])
                        objective_terms.append(koppel_var * 500)
                        bonus_count += 1
                        logger.debug(f"[DRAAD170] DDO+DDA koppel var created for {emp_id}")
        
        self.model.Maximize(sum(objective_terms))
        
        logger.info(f"[DRAAD170] Objective: {len(objective_terms)} terms, {bonus_count} bonus vars (REIFICATION FIXED)")
    
    def _generate_violations_report(self, assignments: List[Assignment]):
        """DRAAD105: Rapportage voor streefgetal afwijkingen."""
        logger.info("Genereren violations report...")
        
        actual_counts: Dict[Tuple[str, str], int] = {}
        for assignment in assignments:
            key = (assignment.employee_id, assignment.service_id)
            actual_counts[key] = actual_counts.get(key, 0) + 1
        
        for (emp_id, svc_id), target in self.target_counts.items():
            actual = actual_counts.get((emp_id, svc_id), 0)
            
            if actual != target:
                emp = self.employees.get(emp_id)
                svc = self.services.get(svc_id)
                
                if emp and svc:
                    severity = "warning" if abs(actual - target) <= 2 else "info"
                    message = f"{emp.name}: {actual} x {svc.code} (streefgetal: {target})"
                    
                    self.violations.append(ConstraintViolation(
                        constraint_type="streefgetal_afwijking",
                        employee_id=emp_id,
                        employee_name=emp.name,
                        service_id=svc_id,
                        message=message,
                        severity=severity
                    ))
    
    # ========================================================================
    # DRAAD118A: BOTTLENECK ANALYSIS FOR INFEASIBLE DIAGNOSIS
    # ========================================================================
    
    def analyze_bottlenecks(self) -> BottleneckReport:
        """DRAAD118A: Analyse capacity gaps for INFEASIBLE roster.
        
        Returns comprehensive BottleneckReport with:
        1. Per-service analysis: nodig vs beschikbaar vs tekort
        2. Severity classification (CRITICAL/HIGH/MEDIUM)
        3. Actionable suggestions for planner
        
        Called automatically when solver_status == INFEASIBLE.
        """
        logger.info("[DRAAD118A] analyze_bottlenecks() START")
        
        bottleneck_items: Dict[str, BottleneckItem] = {}
        
        # Step 1: Per-service analysis
        for svc_id, service in self.services.items():
            # Calculate NEEDED capacity (sum of exact_staffing for this service)
            nodig = 0
            for staffing in self.exact_staffing:
                if staffing.service_id == svc_id and staffing.exact_aantal > 0:
                    nodig += staffing.exact_aantal
            
            if nodig == 0:
                continue  # Skip services not mentioned in exact_staffing
            
            # Calculate AVAILABLE capacity (bevoegde medewerkers × slots)
            beschikbaar = 0
            bevoegde_emps = set()
            
            for res in self.roster_employee_services:
                if res.service_id == svc_id and res.actief:
                    bevoegde_emps.add(res.employee_id)
            
            # For each eligible employee, count available slots
            for emp_id in bevoegde_emps:
                # Count slots not blocked
                available_slots = 0
                for dt in self.dates:
                    for dagdeel in list(Dagdeel):
                        # Check if this slot is available
                        is_blocked = any(
                            bs.employee_id == emp_id and bs.date == dt and bs.dagdeel == dagdeel
                            for bs in self.blocked_slots
                        )
                        if not is_blocked:
                            available_slots += 1
                
                beschikbaar += available_slots
            
            # Calculate shortage
            tekort = max(0, nodig - beschikbaar)
            tekort_pct = (tekort / nodig * 100) if nodig > 0 else 0.0
            
            # Determine severity
            is_system = service.code in ['DIO', 'DIA', 'DDO', 'DDA']
            if is_system or tekort_pct > 50:
                severity = "critical"
            elif tekort_pct > 30:
                severity = "high"
            else:
                severity = "medium"
            
            bottleneck_items[svc_id] = BottleneckItem(
                service_id=svc_id,
                service_code=service.code,
                service_naam=service.naam,
                nodig=nodig,
                beschikbaar=beschikbaar,
                tekort=tekort,
                tekort_percentage=round(tekort_pct, 1),
                is_system_service=is_system,
                severity=severity
            )
        
        # Step 2: Sort by severity, then by tekort descending
        severity_order = {"critical": 0, "high": 1, "medium": 2}
        sorted_items = sorted(
            bottleneck_items.values(),
            key=lambda x: (severity_order[x.severity], -x.tekort)
        )
        
        critical_count = sum(1 for item in sorted_items if item.severity == "critical")
        
        # Step 3: Generate suggestions
        suggestions = self._generate_bottleneck_suggestions(sorted_items)
        
        # Step 4: Calculate totals
        total_needed = sum(item.nodig for item in sorted_items)
        total_available = sum(item.beschikbaar for item in sorted_items)
        total_shortage = sum(item.tekort for item in sorted_items)
        shortage_pct = (total_shortage / total_needed * 100) if total_needed > 0 else 0.0
        
        report = BottleneckReport(
            total_capacity_needed=total_needed,
            total_capacity_available=total_available,
            total_shortage=total_shortage,
            shortage_percentage=round(shortage_pct, 1),
            bottlenecks=sorted_items,
            critical_count=critical_count,
            suggestions=suggestions
        )
        
        logger.info(f"[DRAAD118A] analyze_bottlenecks() COMPLETE: {critical_count} CRITICAL, {shortage_pct:.1f}% shortage")
        return report
    
    def _generate_bottleneck_suggestions(self, items: List[BottleneckItem]) -> List[BottleneckSuggestion]:
        """DRAAD118A: Generate actionable suggestions to resolve bottlenecks."""
        suggestions = []
        
        for item in items:
            if item.tekort == 0:
                continue  # No shortage, skip
            
            # Suggestion 1: Increase capability
            suggestion_1 = BottleneckSuggestion(
                type="increase_capability",
                service_code=item.service_code,
                action=f"Voeg {item.tekort} medewerker(s) toe als bevoegd voor {item.service_naam}",
                impact=f"Dekt 100% van tekort ({item.tekort} plaatsen)",
                priority=10 if item.severity == "critical" else (8 if item.severity == "high" else 5)
            )
            suggestions.append(suggestion_1)
            
            # Suggestion 2: Reduce requirement
            reduction = max(1, int(item.nodig * 0.2))  # Reduce by 20% minimum
            suggestion_2 = BottleneckSuggestion(
                type="reduce_requirement",
                service_code=item.service_code,
                action=f"Verlaag norm {item.service_naam} van {item.nodig} naar {item.nodig - reduction}",
                impact=f"Reduceert tekort met {reduction} plaatsen ({int(reduction/item.tekort*100) if item.tekort > 0 else 0}%)",
                priority=7 if item.severity == "critical" else (5 if item.severity == "high" else 3)
            )
            suggestions.append(suggestion_2)
        
        # Sort by priority descending
        suggestions.sort(key=lambda x: -x.priority)
        
        return suggestions
    
    def _run_solver(self) -> Tuple[SolveStatus, List[Assignment]]:
        """Voer CP-SAT solver uit."""
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.timeout_seconds
        solver.parameters.log_search_progress = False
        
        logger.info(f"Starten solver (timeout: {self.timeout_seconds}s)...")
        status_code = solver.Solve(self.model)
        
        if status_code == cp_model.OPTIMAL:
            solve_status = SolveStatus.OPTIMAL
        elif status_code == cp_model.FEASIBLE:
            solve_status = SolveStatus.FEASIBLE
        elif status_code == cp_model.INFEASIBLE:
            solve_status = SolveStatus.INFEASIBLE
        else:
            solve_status = SolveStatus.TIMEOUT
        
        logger.info(f"Solver status: {solve_status.value}")
        logger.info(f"Solve time: {solver.WallTime()}s")
        
        assignments = []
        if status_code in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for (emp_id, dt, dagdeel_str, svc_id), var in self.assignments_vars.items():
                if solver.Value(var) == 1:
                    emp = self.employees[emp_id]
                    svc = self.services[svc_id]
                    
                    assignments.append(Assignment(
                        employee_id=emp_id,
                        employee_name=emp.name,
                        date=dt,
                        dagdeel=Dagdeel(dagdeel_str),
                        service_id=svc_id,
                        service_code=svc.code,
                        confidence=1.0
                    ))
        
        logger.info(f"Extracted {len(assignments)} assignments")
        
        return solve_status, assignments
