"""CP-SAT Solver Engine voor roosterplanning.

Implementeert Google OR-Tools CP-SAT voor het oplossen van
verloskundige roosters met 6 basis constraints.

DRAD117: Removed constraint 5 (max werkdagen/week) - planning metadata, not Solver constraint
DRAD108: Bezetting realiseren - exact aantal per dienst/dagdeel/team + systeemdienst exclusiviteit.
DRAD106: Status semantiek - fixed_assignments (status 1) en blocked_slots (status 2,3).
DRAD105: Gebruikt roster_employee_services met aantal en actief velden.
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
        """Voer volledige solve uit."""
        start_time = time.time()
        
        try:
            logger.info("Stap 1: Aanmaken decision variables...")
            self._create_variables()
            
            logger.info("Stap 2: Toevoegen constraints...")
            self._apply_constraints()
            
            logger.info("Stap 3: Definiëren objective function...")
            self._define_objective()
            
            logger.info("Stap 4: Solver uitvoeren...")
            status, assignments = self._run_solver()
            
            solve_time = time.time() - start_time
            
            logger.info("Stap 5: Genereren rapportage...")
            
            if status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE]:
                self._generate_violations_report(assignments)
            
            total_slots = len(self.dates) * len(list(Dagdeel)) * len(self.employees)
            fill_pct = (len(assignments) / total_slots * 100) if total_slots > 0 else 0.0
            
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
                solver_metadata={
                    "dates_count": len(self.dates),
                    "employees_count": len(self.employees),
                    "services_count": len(self.services),
                    "fixed_assignments_count": len(self.fixed_assignments),
                    "blocked_slots_count": len(self.blocked_slots),
                    "exact_staffing_count": len(self.exact_staffing)  # DRAAD108
                }
            )
            
        except Exception as e:
            logger.error(f"Solver error: {e}", exc_info=True)
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=self.roster_id,
                assignments=[],
                solve_time_seconds=time.time() - start_time,
                violations=[ConstraintViolation(
                    constraint_type="solver_error",
                    message=f"Solver fout: {str(e)}",
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
        """Pas alle constraints toe.
        
        DRAAD117: Removed constraint 5 (max werkdagen/week)
        DRAAD108: Constraints 7-8
        DRAAD106: Constraints 1-4
        
        1. Bevoegdheden (HARD)
        2. Beschikbaarheid (HARD)
        3A. Fixed assignments (status 1, HARD)
        3B. Blocked slots (status 2, 3, HARD)
        4. Een dienst per dagdeel (HARD)
        6. ZZP minimalisatie (via objective, SOFT)
        7. Exact bezetting realiseren (HARD)
        8. Systeemdienst exclusiviteit (HARD)
        """
        self._constraint_1_bevoegdheden()
        self._constraint_2_beschikbaarheid()
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
        """Constraint 2: Respecteer structurele niet-beschikbaarheid (NBH)."""
        logger.info("Toevoegen constraint 2: Beschikbaarheid...")
        
        dag_codes = ["ma", "di", "wo", "do", "vr", "za", "zo"]
        
        for emp_id, emp in self.employees.items():
            if not emp.structureel_nbh:
                continue
            
            for dt in self.dates:
                dag_code = dag_codes[dt.weekday()]
                
                if dag_code in emp.structureel_nbh:
                    nb_dagdelen = emp.structureel_nbh[dag_code]
                    
                    for dagdeel_str in nb_dagdelen:
                        for svc_id in self.services:
                            var = self.assignments_vars[(emp_id, dt, dagdeel_str, svc_id)]
                            self.model.Add(var == 0)
        
        logger.info("Constraint 2: Beschikbaarheid toegepast")
    
    def _constraint_3a_fixed_assignments(self):
        """Constraint 3A: Respecteer status 1 (fixed assignments).
        
        DRAAD106: Status 1 = Handmatig gepland of gefinaliseerd
        ORT MOET deze exact overnemen (HARD CONSTRAINT).
        """
        logger.info("Toevoegen constraint 3A: Fixed assignments...")
        
        for fa in self.fixed_assignments:
            var = self.assignments_vars.get(
                (fa.employee_id, fa.date, fa.dagdeel.value, fa.service_id)
            )
            
            if var:
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
        
        DRAAD106: Status 2/3 = Geblokkeerd
        ORT MAG NIET plannen in deze slots voor ENIGE dienst (HARD CONSTRAINT).
        """
        logger.info("Toevoegen constraint 3B: Blocked slots...")
        
        for bs in self.blocked_slots:
            # Block ALLE services voor dit slot
            for svc_id in self.services:
                var = self.assignments_vars.get(
                    (bs.employee_id, bs.date, bs.dagdeel.value, svc_id)
                )
                
                if var:
                    self.model.Add(var == 0)  # MAG NIET toegewezen
                else:
                    logger.warning(f"Blocked slot var not found: {bs}")
        
        logger.info(f"Constraint 3B: {len(self.blocked_slots)} blocked slots verboden")
    
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
        
        - aantal > 0: EXACT dit aantal plannen (niet >=, maar ==)
        - aantal = 0: MAG NIET plannen (verboden)
        
        Priority: HARD (is_fixed: true)
        Team filtering: TOT=allen, GRO=maat, ORA=loondienst
        """
        logger.info("Toevoegen constraint 7: Bezetting realiseren...")
        
        if not self.exact_staffing:
            logger.info("Constraint 7: Geen exact_staffing data, skip")
            return
        
        for staffing in self.exact_staffing:
            # Bepaal eligible medewerkers voor dit team
            if staffing.team == 'GRO':
                eligible_emps = [e for e in self.employees.values() 
                               if e.team == TeamType.MAAT]
            elif staffing.team == 'ORA':
                eligible_emps = [e for e in self.employees.values() 
                               if e.team == TeamType.LOONDIENST]
            elif staffing.team == 'TOT':
                eligible_emps = list(self.employees.values())
            else:
                logger.warning(f"Unknown team: {staffing.team}")
                continue
            
            # Verzamel assignments voor dit specifieke slot
            slot_assignments = []
            for emp in eligible_emps:
                var_key = (emp.id, staffing.date, staffing.dagdeel.value, staffing.service_id)
                if var_key in self.assignments_vars:
                    slot_assignments.append(self.assignments_vars[var_key])
            
            if not slot_assignments:
                logger.warning(f"No eligible employees for exact staffing: {staffing}")
                continue
            
            if staffing.exact_aantal == 0:
                # VERBODEN - mag niet worden ingepland
                for var in slot_assignments:
                    self.model.Add(var == 0)
                logger.debug(f"Verboden: {staffing.service_id} op {staffing.date} {staffing.dagdeel.value} team {staffing.team}")
            else:
                # EXACT aantal vereist (min=max tegelijk)
                self.model.Add(sum(slot_assignments) == staffing.exact_aantal)
                logger.debug(f"Exact {staffing.exact_aantal}: {staffing.service_id} op {staffing.date} {staffing.dagdeel.value} team {staffing.team}")
        
        logger.info(f"Constraint 7: {len(self.exact_staffing)} exacte bezetting eisen toegevoegd")
    
    def _constraint_8_system_service_exclusivity(self):
        """Constraint 8: DIO XOR DDO, DIA XOR DDA op zelfde dag.
        
        DRAAD108: Systeemdiensten sluiten elkaar uit per dag.
        """
        logger.info("Toevoegen constraint 8: Systeemdienst exclusiviteit...")
        
        # Haal service IDs op
        DIO_id = self.get_service_id_by_code('DIO')
        DDO_id = self.get_service_id_by_code('DDO')
        DIA_id = self.get_service_id_by_code('DIA')
        DDA_id = self.get_service_id_by_code('DDA')
        
        if not all([DIO_id, DDO_id, DIA_id, DDA_id]):
            logger.warning("Niet alle systeemdiensten gevonden, skip constraint 8")
            return
        
        constraint_count = 0
        for emp_id in self.employees:
            for dt in self.dates:
                # DIO XOR DDO (ochtend)
                dio_var = self.assignments_vars.get((emp_id, dt, 'O', DIO_id))
                ddo_var = self.assignments_vars.get((emp_id, dt, 'O', DDO_id))
                
                if dio_var and ddo_var:
                    self.model.Add(dio_var + ddo_var <= 1)
                    constraint_count += 1
                
                # DIA XOR DDA (avond)
                dia_var = self.assignments_vars.get((emp_id, dt, 'A', DIA_id))
                dda_var = self.assignments_vars.get((emp_id, dt, 'A', DDA_id))
                
                if dia_var and dda_var:
                    self.model.Add(dia_var + dda_var <= 1)
                    constraint_count += 1
        
        logger.info(f"Constraint 8: {constraint_count} systeemdienst exclusiviteit constraints toegevoegd")
    
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
        """
        logger.info("Definiëren objective function...")
        
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
        
        # DRAAD108: Term 4 - Bonus voor 24-uurs wachtdienst koppeling (SOFT)
        DIO_id = self.get_service_id_by_code('DIO')
        DIA_id = self.get_service_id_by_code('DIA')
        DDO_id = self.get_service_id_by_code('DDO')
        DDA_id = self.get_service_id_by_code('DDA')
        
        if all([DIO_id, DIA_id, DDO_id, DDA_id]):
            for emp_id in self.employees:
                for dt in self.dates:
                    # DIO + DIA koppeling (grote bonus)
                    dio_var = self.assignments_vars.get((emp_id, dt, 'O', DIO_id))
                    dia_var = self.assignments_vars.get((emp_id, dt, 'A', DIA_id))
                    
                    if dio_var and dia_var:
                        koppel_var = self.model.NewBoolVar(f"dio_dia_koppel_{emp_id}_{dt}")
                        self.model.Add(dio_var + dia_var == 2).OnlyEnforceIf(koppel_var)
                        self.model.Add(dio_var + dia_var < 2).OnlyEnforceIf(koppel_var.Not())
                        objective_terms.append(koppel_var * 500)  # Hoge bonus
                    
                    # DDO + DDA koppeling (grote bonus)
                    ddo_var = self.assignments_vars.get((emp_id, dt, 'O', DDO_id))
                    dda_var = self.assignments_vars.get((emp_id, dt, 'A', DDA_id))
                    
                    if ddo_var and dda_var:
                        koppel_var = self.model.NewBoolVar(f"ddo_dda_koppel_{emp_id}_{dt}")
                        self.model.Add(ddo_var + dda_var == 2).OnlyEnforceIf(koppel_var)
                        self.model.Add(ddo_var + dda_var < 2).OnlyEnforceIf(koppel_var.Not())
                        objective_terms.append(koppel_var * 500)
        
        self.model.Maximize(sum(objective_terms))
        
        logger.info(f"Objective function: {len(objective_terms)} termen")
    
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
