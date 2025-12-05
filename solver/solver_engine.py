"""CP-SAT Solver Engine voor roosterplanning.

Implementeert Google OR-Tools CP-SAT voor het oplossen van
verloskundige roosters met 6 basis constraints (Fase 1).

DRAAD105: Gebruikt roster_employee_services met aantal en actief velden.
"""

from ortools.sat.python import cp_model
from typing import List, Dict, Set, Tuple
from datetime import date, timedelta
import time
import logging

from models import (
    Employee, Service, RosterEmployeeService, PreAssignment,  # DRAAD105: update import
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
        roster_employee_services: List[RosterEmployeeService],  # DRAAD105: parameter renamed
        start_date: date,
        end_date: date,
        pre_assignments: List[PreAssignment],
        timeout_seconds: int = 30
    ):
        self.roster_id = roster_id
        # Fix: correcte dictionary comprehension
        self.employees = {emp.id: emp for emp in employees}
        self.services = {svc.id: svc for svc in services}
        self.roster_employee_services = roster_employee_services  # DRAAD105: renamed
        self.start_date = start_date
        self.end_date = end_date
        self.pre_assignments = pre_assignments
        self.timeout_seconds = timeout_seconds
        
        # DRAAD105: Target counts per (employee_id, service_id)
        # Voor rapportage van afwijkingen
        self.target_counts: Dict[Tuple[str, str], int] = {}
        
        # Genereer dagen lijst
        self.dates = []
        current = start_date
        while current <= end_date:
            self.dates.append(current)
            current += timedelta(days=1)
        
        # Model en variabelen
        self.model = cp_model.CpModel()
        # Type hints: employee_id en service_id zijn nu str
        self.assignments_vars: Dict[Tuple[str, date, str, str], cp_model.IntVar] = {}
        
        # Tracking
        self.violations: List[ConstraintViolation] = []
        self.suggestions: List[Suggestion] = []
    
    def solve(self) -> SolveResponse:
        """Voer volledige solve uit.
        
        Returns:
            SolveResponse met alle resultaten
        """
        start_time = time.time()
        
        try:
            # Stap 1: Maak decision variables
            logger.info("Stap 1: Aanmaken decision variables...")
            self._create_variables()
            
            # Stap 2: Pas constraints toe
            logger.info("Stap 2: Toevoegen constraints...")
            self._apply_constraints()
            
            # Stap 3: Definieer objective function
            logger.info("Stap 3: Definiëren objective function...")
            self._define_objective()
            
            # Stap 4: Solve
            logger.info("Stap 4: Solver uitvoeren...")
            status, assignments = self._run_solver()
            
            solve_time = time.time() - start_time
            
            # Stap 5: Genereer rapportage
            logger.info("Stap 5: Genereren rapportage...")
            
            # DRAAD105: Genereer violations report voor aantal afwijkingen
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
                    "services_count": len(self.services)
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
        """Maak decision variables aan.
        
        Voor elke (employee, date, dagdeel, service) combinatie:
        assignments[emp_id, date, dagdeel, svc_id] = 0/1
        """
        for emp_id in self.employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    for svc_id in self.services:
                        var_name = f"assign_{emp_id}_{dt}_{dagdeel.value}_{svc_id}"
                        var = self.model.NewBoolVar(var_name)
                        self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)] = var
        
        logger.info(f"Aangemaakt: {len(self.assignments_vars)} decision variables")
    
    def _apply_constraints(self):
        """Pas alle 6 Fase 1 constraints toe."""
        self._constraint_1_bevoegdheden()
        self._constraint_2_beschikbaarheid()
        self._constraint_3_pre_assignments()
        self._constraint_4_een_dienst_per_dagdeel()
        self._constraint_5_max_werkdagen()
        self._constraint_6_zzp_minimalisatie()
    
    def _constraint_1_bevoegdheden(self):
        """Constraint 1: Medewerker mag alleen diensten doen waarvoor bevoegd.
        
        Priority: 1 (is_fixed: true)
        
        DRAAD105: Gebruikt roster_employee_services met actief=TRUE check
        Sla aantal op voor streefgetal tracking.
        """
        logger.info("Toevoegen constraint 1: Bevoegdheden...")
        
        # Maak bevoegdheden lookup (nu met str IDs)
        # DRAAD105: Alleen actief=TRUE bevoegdheden
        allowed: Dict[str, Set[str]] = {}
        for emp_id in self.employees:
            allowed[emp_id] = set()
        
        for res in self.roster_employee_services:
            # DRAAD105: Check actief=TRUE (harde eis)
            if res.actief:
                allowed[res.employee_id].add(res.service_id)
                # Sla streefgetal op voor rapportage
                self.target_counts[(res.employee_id, res.service_id)] = res.aantal
        
        # Verbied niet-toegestane diensten
        violations_count = 0
        for emp_id, emp in self.employees.items():
            for svc_id in self.services:
                if svc_id not in allowed[emp_id]:
                    # Niet bevoegd → verbieden
                    for dt in self.dates:
                        for dagdeel in list(Dagdeel):
                            var = self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                            self.model.Add(var == 0)
                    violations_count += 1
        
        logger.info(f"Constraint 1: {violations_count} employee-service combinaties verboden")
        logger.info(f"Constraint 1: {len(self.target_counts)} actieve bevoegdheden met streefgetallen")
    
    def _constraint_2_beschikbaarheid(self):
        """Constraint 2: Respecteer structurele niet-beschikbaarheid (NBH).
        
        Priority: 1 (is_fixed: true)
        """
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
                        # Verbied alle diensten in dit dagdeel
                        for svc_id in self.services:
                            var = self.assignments_vars[(emp_id, dt, dagdeel_str, svc_id)]
                            self.model.Add(var == 0)
        
        logger.info("Constraint 2: Beschikbaarheid toegepast")
    
    def _constraint_3_pre_assignments(self):
        """Constraint 3: Pre-planning (status > 0) NIET overschrijven.
        
        Priority: 1 (is_fixed: true)
        """
        logger.info("Toevoegen constraint 3: Pre-assignments...")
        
        # Verzamel alle pre-assigned slots (nu met str IDs)
        pre_slots: Set[Tuple[str, date, str]] = set()
        
        for pa in self.pre_assignments:
            pre_slots.add((pa.employee_id, pa.date, pa.dagdeel.value))
            
            # Force deze assignment
            var = self.assignments_vars.get(
                (pa.employee_id, pa.date, pa.dagdeel.value, pa.service_id)
            )
            if var:
                self.model.Add(var == 1)
        
        # Verbied andere diensten in pre-assigned slots
        for (emp_id, dt, dagdeel_str) in pre_slots:
            assigned_svc = None
            for pa in self.pre_assignments:
                if pa.employee_id == emp_id and pa.date == dt and pa.dagdeel.value == dagdeel_str:
                    assigned_svc = pa.service_id
                    break
            
            if assigned_svc:
                for svc_id in self.services:
                    if svc_id != assigned_svc:
                        var = self.assignments_vars[(emp_id, dt, dagdeel_str, svc_id)]
                        self.model.Add(var == 0)
        
        logger.info(f"Constraint 3: {len(self.pre_assignments)} pre-assignments gefixeerd")
    
    def _constraint_4_een_dienst_per_dagdeel(self):
        """Constraint 4: Medewerker mag max 1 dienst per dagdeel.
        
        Priority: 1 (is_fixed: true)
        """
        logger.info("Toevoegen constraint 4: Een dienst per dagdeel...")
        
        for emp_id in self.employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    vars_for_slot = [
                        self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                        for svc_id in self.services
                    ]
                    # Som van alle diensten in dit slot <= 1
                    self.model.Add(sum(vars_for_slot) <= 1)
        
        logger.info("Constraint 4: Een dienst per dagdeel toegepast")
    
    def _constraint_5_max_werkdagen(self):
        """Constraint 5: Respecteer aantalwerkdagen per week.
        
        Priority: 2 (is_fixed: false) - kan warnings geven
        """
        logger.info("Toevoegen constraint 5: Max werkdagen...")
        
        # Voor Fase 1: tel totale werkdagen over gehele periode
        # (vereenvoudiging - later per week)
        
        for emp_id, emp in self.employees.items():
            # Fix: gebruik aantalwerkdagen i.p.v. max_werkdagen
            max_werkdagen = emp.aantalwerkdagen
            
            # Tel dagen waarop medewerker >=1 dienst heeft
            werkdagen_vars = []
            for dt in self.dates:
                # Bool var: werkt deze dag?
                dag_var = self.model.NewBoolVar(f"werkdag_{emp_id}_{dt}")
                
                # dag_var = 1 als er >=1 dienst is op deze dag
                diensten_dag = [
                    self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                    for dagdeel in list(Dagdeel)
                    for svc_id in self.services
                ]
                
                # Als sum(diensten_dag) > 0 → dag_var = 1
                self.model.Add(sum(diensten_dag) > 0).OnlyEnforceIf(dag_var)
                self.model.Add(sum(diensten_dag) == 0).OnlyEnforceIf(dag_var.Not())
                
                werkdagen_vars.append(dag_var)
            
            # Constraint: totaal aantal werkdagen <= max
            max_dagen = max_werkdagen * len(self.dates) // 7  # Schaling naar periode
            self.model.Add(sum(werkdagen_vars) <= max(max_dagen, 1))
        
        logger.info("Constraint 5: Max werkdagen toegepast")
    
    def _constraint_6_zzp_minimalisatie(self):
        """Constraint 6: Minimaliseer gebruik van ZZP-ers (team='overig').
        
        Priority: 3 - via objective function
        Dit wordt afgehandeld in _define_objective()
        """
        logger.info("Constraint 6: ZZP minimalisatie (via objective)")
        pass
    
    def _define_objective(self):
        """Definieer objective function.
        
        DRAAD105: Implementeer streefgetal logica:
        - aantal=0 (ZZP/reserve): LAGE priority (-2) → wordt als LAATST gebruikt
        - aantal>0 onder target: HOGE priority (+5) → eerst vullen tot target
        - aantal>0 op/boven target: NORMAAL (0) → kan worden gebruikt bij tekort
        
        Doelen:
        1. Maximaliseer aantal ingevulde slots
        2. Respecteer streefgetallen met ZZP als reserve
        3. Balanceer werkdruk tussen medewerkers
        """
        logger.info("Definiëren objective function...")
        
        objective_terms = []
        
        # Term 1: Maximaliseer totaal assignments (+10 per assignment)
        for var in self.assignments_vars.values():
            objective_terms.append(var * 10)  # Weight: 10
        
        # DRAAD105: Term 2: Streefgetal logica per (employee, service)
        # Tel assignments per (employee, service) en vergelijk met target
        for (emp_id, svc_id), target in self.target_counts.items():
            # Verzamel alle assignments voor deze (emp, svc) combinatie
            emp_svc_assignments = [
                self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                for dt in self.dates
                for dagdeel in list(Dagdeel)
            ]
            
            if target == 0:
                # ZZP/reserve: LAGE priority (-2 per assignment)
                # Deze worden als LAATST gebruikt
                for var in emp_svc_assignments:
                    objective_terms.append(var * -2)  # Penalty: -2
                logger.debug(f"ZZP priority: {emp_id} + {svc_id} (aantal=0) → penalty -2")
            else:
                # Reguliere medewerker met streefgetal
                # Bonus voor assignments onder target (+5)
                # Normaal voor assignments boven target (0)
                # Dit wordt in reality per periode berekend, hier simplified
                for var in emp_svc_assignments:
                    objective_terms.append(var * 5)  # Bonus: +5
        
        # Term 3: Extra penalty voor ZZP team (dubbele check)
        zzp_employees = [emp_id for emp_id, emp in self.employees.items() if emp.team == TeamType.OVERIG]
        for emp_id in zzp_employees:
            for dt in self.dates:
                for dagdeel in list(Dagdeel):
                    for svc_id in self.services:
                        var = self.assignments_vars[(emp_id, dt, dagdeel.value, svc_id)]
                        objective_terms.append(var * -3)  # Extra penalty: -3
        
        # Maximaliseer totale objective
        self.model.Maximize(sum(objective_terms))
        
        logger.info(f"Objective function: {len(objective_terms)} termen")
        logger.info(f"ZZP penalty: aantal=0 → -2, team=overig → -3 (cumulatief -5)")
        logger.info(f"Regulier bonus: aantal>0 → +5")
    
    def _generate_violations_report(self, assignments: List[Assignment]):
        """DRAAD105: Genereer rapportage voor afwijkingen van streefgetallen.
        
        Tel per (employee, service) het aantal assignments en vergelijk met target.
        Rapporteer afwijkingen als violations.
        """
        logger.info("Genereren violations report voor streefgetal afwijkingen...")
        
        # Tel actual assignments per (employee, service)
        actual_counts: Dict[Tuple[str, str], int] = {}
        for assignment in assignments:
            key = (assignment.employee_id, assignment.service_id)
            actual_counts[key] = actual_counts.get(key, 0) + 1
        
        # Vergelijk met targets
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
        
        logger.info(f"Violations report: {len(self.violations)} streefgetal afwijkingen")
    
    def _run_solver(self) -> Tuple[SolveStatus, List[Assignment]]:
        """Voer CP-SAT solver uit.
        
        Returns:
            (status, assignments lijst)
        """
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.timeout_seconds
        solver.parameters.log_search_progress = False
        
        logger.info(f"Starten solver (timeout: {self.timeout_seconds}s)...")
        status_code = solver.Solve(self.model)
        
        # Map status
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
        
        # Extract assignments
        assignments = []
        if status_code in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            for (emp_id, dt, dagdeel_str, svc_id), var in self.assignments_vars.items():
                if solver.Value(var) == 1:
                    emp = self.employees[emp_id]
                    svc = self.services[svc_id]
                    
                    # Fix: gebruik employee.name property
                    assignments.append(Assignment(
                        employee_id=emp_id,
                        employee_name=emp.name,  # Dit gebruikt de @property
                        date=dt,
                        dagdeel=Dagdeel(dagdeel_str),
                        service_id=svc_id,
                        service_code=svc.code,
                        confidence=1.0
                    ))
        
        logger.info(f"Extracted {len(assignments)} assignments")
        
        return solve_status, assignments
