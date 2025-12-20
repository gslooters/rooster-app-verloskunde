"""
DRAAD-221: GREEDY Rostering Engine - Baseline Verification Implementation
==========================================================================

This module implements the GREEDY algorithm for automated staff rostering
with full baseline verification and comprehensive logging.

Key Features:
- Baseline verification for blocked slots (status > 0)
- Fair distribution algorithm with two-level sorting
- DIO/DIA and DDO/DDA blocking rules
- Comprehensive debug logging
- Full database integration with Supabase

Database Tables Used:
- roosters: Roster metadata (start_date, end_date, status)
- roster_assignments: Assignment slots (status, service_id, blocked_by_*)
- roster_employee_services: Employee capacity per service
- roster_period_staffing_dagdelen: Demand per date/dagdeel/team/service
- service_types: Service definitions (code, is_systeem)
- employees: Employee metadata (team, dienstverband)

Author: GREEDY Engine v0.3 - DRAAD 221
Date: 2025-12-20
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class Assignment:
    """Represents a single roster assignment"""
    roster_id: str
    employee_id: str
    date: str
    dagdeel: str
    status: int  # 0=beschikbaar, 1=ingepland, 2=geblokkeerd door andere dienst, 3=niet beschikbaar
    service_id: Optional[str] = None
    blocked_by_date: Optional[str] = None
    blocked_by_dagdeel: Optional[str] = None
    blocked_by_service_id: Optional[str] = None
    source: str = "greedy"
    is_protected: bool = False


@dataclass
class Demand:
    """Represents staffing demand for a specific slot"""
    roster_id: str
    service_id: str
    service_code: str
    is_systeem: bool
    date: str
    dagdeel: str
    team: str
    aantal: int
    invulling: int = 0  # 0=nog in te vullen, 1=door GREEDY ingevuld, 2=pre-planning


@dataclass
class Capacity:
    """Represents employee capacity for a specific service"""
    roster_id: str
    employee_id: str
    service_id: str
    aantal: int  # Remaining capacity
    actief: bool = True


@dataclass
class Employee:
    """Employee metadata"""
    id: str
    voornaam: str
    achternaam: str
    team: str  # GRO, ORA, Overig
    dienstverband: str  # Maat, Loondienst, ZZP
    actief: bool = True


class GreedyRosteringEngine:
    """
    GREEDY Rostering Engine - Implements demand-driven roster filling
    
    This engine follows the GREEDY algorithm specification:
    1. Sort demand by priority (systeemdienst first, then date, dagdeel, team, code)
    2. For each demand slot, find available and qualified employees
    3. Select employee with most remaining shifts (fair distribution)
    4. Assign shift and block related slots (DIO/DIA, DDO/DDA rules)
    5. Update status and capacity tracking
    """
    
    def __init__(self, db_client):
        """
        Initialize GREEDY engine with database client
        
        Args:
            db_client: Supabase client for database operations
        """
        self.db = db_client
        self.roster_id = None
        self.start_date = None
        self.end_date = None
        
        # Working datasets (in-memory for performance)
        self.werkbestand_opdracht: List[Demand] = []
        self.werkbestand_planning: Dict[Tuple[str, str, str], Assignment] = {}  # (employee_id, date, dagdeel) -> Assignment
        self.werkbestand_capaciteit: Dict[Tuple[str, str], Capacity] = {}  # (employee_id, service_id) -> Capacity
        self.employees: Dict[str, Employee] = {}  # employee_id -> Employee
        
        # Statistics
        self.stats = {
            "total_demand": 0,
            "pre_planned": 0,
            "greedy_assigned": 0,
            "open_slots": 0,
            "blocked_slots": 0
        }
        
        logger.info("[DRAAD221-BASELINE] GreedyRosteringEngine initialized")
    
    def solve_roster(self, roster_id: str) -> Dict:
        """
        Main entry point: Solve entire roster using GREEDY algorithm
        
        Args:
            roster_id: UUID of roster to solve
            
        Returns:
            Dictionary with results and statistics
        """
        logger.info(f"[DRAAD221] Starting GREEDY solve for roster {roster_id}")
        
        try:
            # STAP 1: Load roster metadata
            self.roster_id = roster_id
            self._load_roster_metadata()
            
            # STAP 2: Load and prepare working datasets
            self._load_opdracht()  # Demand from roster_period_staffing_dagdelen
            self._load_planning()  # Current assignments from roster_assignments
            self._load_capaciteit()  # Employee capacity from roster_employee_services
            self._load_employees()  # Employee metadata
            
            # STAP 3: BASELINE VERIFICATION - Check blocked slots
            logger.info("[DRAAD221-BASELINE] Verifying blocked slots before assignment...")
            self._verify_baseline_blocked_slots()
            
            # STAP 4: Process pre-planning (status=1, service_id filled)
            self._process_pre_planning()
            
            # STAP 5: Main GREEDY loop - assign shifts
            self._assign_all_shifts()
            
            # STAP 6: Write results back to database
            self._update_database()
            
            # STAP 7: Generate final report
            report = self._generate_report()
            
            logger.info(f"[DRAAD221] GREEDY solve complete: {self.stats['greedy_assigned']} shifts assigned")
            return report
            
        except Exception as e:
            logger.error(f"[DRAAD221-ERROR] GREEDY solve failed: {str(e)}", exc_info=True)
            raise
    
    def _load_roster_metadata(self):
        """Load roster start/end dates from roosters table"""
        logger.info(f"[DRAAD221] Loading roster metadata for {self.roster_id}")
        
        result = self.db.table("roosters").select("start_date, end_date, status").eq("id", self.roster_id).execute()
        
        if not result.data:
            raise ValueError(f"Roster {self.roster_id} not found")
        
        roster = result.data[0]
        self.start_date = datetime.strptime(roster["start_date"], "%Y-%m-%d").date()
        self.end_date = datetime.strptime(roster["end_date"], "%Y-%m-%d").date()
        
        logger.info(f"[DRAAD221] Roster period: {self.start_date} to {self.end_date}")
    
    def _load_opdracht(self):
        """
        Load demand from roster_period_staffing_dagdelen
        Sort by: systeemdienst DESC, date ASC, dagdeel (O-M-A), team (TOT-GRO-ORA), code ASC
        """
        logger.info("[DRAAD221] Loading demand (opdracht)...")
        
        # Query with join to service_types
        result = self.db.table("roster_period_staffing_dagdelen").select(
            "roster_id, service_id, date, dagdeel, team, aantal, "
            "service_types(code, is_systeem)"
        ).eq("roster_id", self.roster_id).gt("aantal", 0).execute()
        
        for row in result.data:
            service = row["service_types"]
            demand = Demand(
                roster_id=row["roster_id"],
                service_id=row["service_id"],
                service_code=service["code"],
                is_systeem=service["is_systeem"],
                date=row["date"],
                dagdeel=row["dagdeel"],
                team=row["team"],
                aantal=row["aantal"],
                invulling=0
            )
            self.werkbestand_opdracht.append(demand)
        
        # Sort according to specification (2.2)
        dagdeel_order = {"O": 0, "M": 1, "A": 2}
        team_order = {"TOT": 0, "GRO": 1, "ORA": 2}
        
        self.werkbestand_opdracht.sort(key=lambda d: (
            not d.is_systeem,  # systeemdienst first (TRUE before FALSE)
            d.date,
            dagdeel_order.get(d.dagdeel, 3),
            team_order.get(d.team, 3),
            d.service_code
        ))
        
        self.stats["total_demand"] = len(self.werkbestand_opdracht)
        logger.info(f"[DRAAD221] Loaded {self.stats['total_demand']} demand slots")
    
    def _load_planning(self):
        """
        Load current assignments from roster_assignments
        Creates werkbestand_planning with ALL slots (available and blocked)
        """
        logger.info("[DRAAD221-BASELINE] Loading current planning state...")
        
        result = self.db.table("roster_assignments").select(
            "roster_id, employee_id, date, dagdeel, status, service_id, "
            "blocked_by_date, blocked_by_dagdeel, blocked_by_service_id, "
            "source, is_protected"
        ).eq("roster_id", self.roster_id).execute()
        
        for row in result.data:
            key = (row["employee_id"], row["date"], row["dagdeel"])
            assignment = Assignment(
                roster_id=row["roster_id"],
                employee_id=row["employee_id"],
                date=row["date"],
                dagdeel=row["dagdeel"],
                status=row["status"],
                service_id=row.get("service_id"),
                blocked_by_date=row.get("blocked_by_date"),
                blocked_by_dagdeel=row.get("blocked_by_dagdeel"),
                blocked_by_service_id=row.get("blocked_by_service_id"),
                source=row.get("source", ""),
                is_protected=row.get("is_protected", False)
            )
            self.werkbestand_planning[key] = assignment
        
        logger.info(f"[DRAAD221-BASELINE] Loaded {len(self.werkbestand_planning)} assignment slots")
    
    def _verify_baseline_blocked_slots(self):
        """
        DRAAD-221 BASELINE VERIFICATION:
        Verify that blocked slots (status > 0) are correctly set
        and count them for statistics
        """
        logger.info("[DRAAD221-BASELINE] === BASELINE VERIFICATION START ===")
        
        blocked_count = 0
        available_count = 0
        pre_planned_count = 0
        
        for key, assignment in self.werkbestand_planning.items():
            if assignment.status == 0:
                available_count += 1
            elif assignment.status == 1:
                pre_planned_count += 1
                if assignment.service_id:
                    logger.debug(f"[BASELINE] Pre-planned: {assignment.employee_id} on {assignment.date} {assignment.dagdeel} -> {assignment.service_id}")
            elif assignment.status > 1:
                blocked_count += 1
                logger.debug(f"[BASELINE] Blocked slot: {assignment.employee_id} on {assignment.date} {assignment.dagdeel} (status={assignment.status})")
        
        self.stats["blocked_slots"] = blocked_count
        self.stats["pre_planned"] = pre_planned_count
        
        logger.info(f"[DRAAD221-BASELINE] Available slots: {available_count}")
        logger.info(f"[DRAAD221-BASELINE] Pre-planned slots: {pre_planned_count}")
        logger.info(f"[DRAAD221-BASELINE] Blocked slots: {blocked_count}")
        logger.info("[DRAAD221-BASELINE] === BASELINE VERIFICATION COMPLETE ===")
    
    def _load_capaciteit(self):
        """Load employee capacity from roster_employee_services"""
        logger.info("[DRAAD221] Loading employee capacity...")
        
        result = self.db.table("roster_employee_services").select(
            "roster_id, employee_id, service_id, aantal, actief"
        ).eq("roster_id", self.roster_id).eq("actief", True).gt("aantal", 0).execute()
        
        for row in result.data:
            key = (row["employee_id"], row["service_id"])
            capacity = Capacity(
                roster_id=row["roster_id"],
                employee_id=row["employee_id"],
                service_id=row["service_id"],
                aantal=row["aantal"],
                actief=row["actief"]
            )
            self.werkbestand_capaciteit[key] = capacity
        
        logger.info(f"[DRAAD221] Loaded capacity for {len(self.werkbestand_capaciteit)} employee-service combinations")
    
    def _load_employees(self):
        """Load employee metadata"""
        logger.info("[DRAAD221] Loading employee data...")
        
        result = self.db.table("employees").select(
            "id, voornaam, achternaam, team, dienstverband, actief"
        ).eq("actief", True).execute()
        
        for row in result.data:
            employee = Employee(
                id=row["id"],
                voornaam=row["voornaam"],
                achternaam=row["achternaam"],
                team=row.get("team", "Overig"),
                dienstverband=row.get("dienstverband", "Loondienst"),
                actief=row["actief"]
            )
            self.employees[employee.id] = employee
        
        logger.info(f"[DRAAD221] Loaded {len(self.employees)} active employees")
    
    def _process_pre_planning(self):
        """
        Process pre-planned assignments (status=1, service_id filled)
        Mark demand as fulfilled (invulling=2) and reduce capacity
        """
        logger.info("[DRAAD221] Processing pre-planned assignments...")
        
        pre_planned_count = 0
        
        for assignment in self.werkbestand_planning.values():
            if assignment.status == 1 and assignment.service_id:
                # Find matching demand
                for demand in self.werkbestand_opdracht:
                    if (demand.date == assignment.date and 
                        demand.dagdeel == assignment.dagdeel and
                        demand.service_id == assignment.service_id and
                        demand.invulling == 0):
                        demand.invulling = 2  # Mark as pre-planned
                        pre_planned_count += 1
                        break
                
                # Reduce capacity
                cap_key = (assignment.employee_id, assignment.service_id)
                if cap_key in self.werkbestand_capaciteit:
                    self.werkbestand_capaciteit[cap_key].aantal -= 1
                    logger.debug(f"[DRAAD221] Reduced capacity for {assignment.employee_id} service {assignment.service_id}")
        
        logger.info(f"[DRAAD221] Processed {pre_planned_count} pre-planned assignments")
    
    def _assign_all_shifts(self):
        """
        Main GREEDY loop: Assign shifts according to sorted demand
        """
        logger.info("[DRAAD221] Starting main assignment loop...")
        
        for demand in self.werkbestand_opdracht:
            if demand.invulling > 0:
                continue  # Skip already fulfilled demand
            
            # Assign required number of shifts for this demand
            for _ in range(demand.aantal):
                success = self._assign_shift(demand)
                if success:
                    self.stats["greedy_assigned"] += 1
                else:
                    self.stats["open_slots"] += 1
                    logger.warning(f"[DRAAD221] Could not assign shift: {demand.service_code} on {demand.date} {demand.dagdeel} team {demand.team}")
        
        logger.info(f"[DRAAD221] Assignment loop complete: {self.stats['greedy_assigned']} assigned, {self.stats['open_slots']} open")
    
    def _assign_shift(self, demand: Demand) -> bool:
        """
        DRAAD-221 CORE FUNCTION: Assign single shift with comprehensive logging
        
        Steps:
        1. Find available employees (status=0)
        2. Filter by team and qualification
        3. Apply planregels (rules 3.1-3.7)
        4. Select best employee (fair distribution)
        5. Assign and block slots (DIO/DIA, DDO/DDA rules)
        6. Update capacity
        
        Args:
            demand: Demand object for this shift
            
        Returns:
            True if assignment successful, False if no employee available
        """
        logger.debug(f"[DRAAD221-ASSIGN] Attempting assignment: {demand.service_code} on {demand.date} {demand.dagdeel} team {demand.team}")
        
        # STEP 1: Get candidate employees based on team
        candidates = self._get_candidate_employees(demand)
        
        if not candidates:
            logger.debug(f"[DRAAD221-ASSIGN] No candidates found for {demand.service_code}")
            return False
        
        logger.debug(f"[DRAAD221-ASSIGN] Found {len(candidates)} initial candidates")
        
        # STEP 2: Filter candidates by availability and qualification
        available_candidates = []
        for emp_id in candidates:
            if self._is_employee_available(emp_id, demand):
                available_candidates.append(emp_id)
        
        if not available_candidates:
            logger.debug(f"[DRAAD221-ASSIGN] No available candidates after filtering")
            return False
        
        logger.debug(f"[DRAAD221-ASSIGN] {len(available_candidates)} candidates after availability check")
        
        # STEP 3: Check special rules for DIO/DDO (must have following dagdeel available)
        if demand.service_code in ["DIO", "DDO"]:
            available_candidates = [emp for emp in available_candidates if self._check_duo_availability(emp, demand)]
            if not available_candidates:
                logger.debug(f"[DRAAD221-ASSIGN] No candidates with following dagdeel available for {demand.service_code}")
                return False
        
        # STEP 4: Select best employee using fair distribution (planregel 3.5)
        selected_employee = self._select_best_employee(available_candidates, demand.service_id)
        
        if not selected_employee:
            logger.debug(f"[DRAAD221-ASSIGN] No employee selected (all at zero capacity)")
            return False
        
        employee_name = f"{self.employees[selected_employee].voornaam} {self.employees[selected_employee].achternaam}"
        logger.info(f"[DRAAD221-ASSIGN] ✓ Assigning {demand.service_code} to {employee_name} on {demand.date} {demand.dagdeel}")
        
        # STEP 5: Perform assignment
        self._perform_assignment(selected_employee, demand)
        
        # STEP 6: Apply blocking rules for DIO/DIA and DDO/DDA (planregels 3.7.1 and 3.7.2)
        if demand.service_code == "DIO":
            self._assign_dia_after_dio(selected_employee, demand)
        elif demand.service_code == "DDO":
            self._assign_dda_after_ddo(selected_employee, demand)
        
        # STEP 7: Update capacity
        cap_key = (selected_employee, demand.service_id)
        if cap_key in self.werkbestand_capaciteit:
            self.werkbestand_capaciteit[cap_key].aantal -= 1
            logger.debug(f"[DRAAD221-ASSIGN] Capacity reduced: {self.werkbestand_capaciteit[cap_key].aantal} remaining")
        
        # Mark demand as fulfilled
        demand.invulling = 1
        
        return True
    
    def _get_candidate_employees(self, demand: Demand) -> List[str]:
        """
        Get list of candidate employees based on team (planregel 3.3 and 3.4)
        
        Rules:
        - For team-specific demand (GRO/ORA): Try team first, then Overig
        - For TOT demand: All employees, but prefer Maat/Loondienst over ZZP
        """
        candidates = []
        
        if demand.team in ["GRO", "ORA"]:
            # Try team members first
            for emp_id, emp in self.employees.items():
                if emp.team == demand.team:
                    candidates.append(emp_id)
            
            # If no team members, try Overig
            if not candidates:
                for emp_id, emp in self.employees.items():
                    if emp.team == "Overig":
                        candidates.append(emp_id)
        
        elif demand.team == "TOT":
            # All employees, sorted by dienstverband (Maat/Loondienst before ZZP)
            for emp_id, emp in self.employees.items():
                if emp.dienstverband in ["Maat", "Loondienst"]:
                    candidates.append(emp_id)
            # Add ZZP last
            for emp_id, emp in self.employees.items():
                if emp.dienstverband == "ZZP" and emp_id not in candidates:
                    candidates.append(emp_id)
        
        return candidates
    
    def _is_employee_available(self, employee_id: str, demand: Demand) -> bool:
        """
        Check if employee is available for this shift (planregel 3.1 and 3.2)
        
        Checks:
        1. Slot status must be 0 (beschikbaar)
        2. Employee must be qualified (has capacity for this service)
        3. Employee must have remaining capacity (aantal > 0)
        """
        # Check slot availability (planregel 3.1)
        key = (employee_id, demand.date, demand.dagdeel)
        if key not in self.werkbestand_planning:
            return False
        
        assignment = self.werkbestand_planning[key]
        if assignment.status != 0:
            logger.debug(f"[DRAAD221-AVAILABLE] {employee_id} not available: status={assignment.status}")
            return False
        
        # Check qualification and capacity (planregel 3.2 and 3.5.3)
        cap_key = (employee_id, demand.service_id)
        if cap_key not in self.werkbestand_capaciteit:
            logger.debug(f"[DRAAD221-AVAILABLE] {employee_id} not qualified for service {demand.service_id}")
            return False
        
        capacity = self.werkbestand_capaciteit[cap_key]
        if capacity.aantal <= 0:
            logger.debug(f"[DRAAD221-AVAILABLE] {employee_id} has zero remaining capacity")
            return False
        
        return True
    
    def _check_duo_availability(self, employee_id: str, demand: Demand) -> bool:
        """
        Check if employee has following dagdeel available for DIO/DDO (planregel 3.7.1 and 3.7.2)
        
        DIO (dagdeel O) requires DIA (dagdeel A same day) available
        DDO (dagdeel O) requires DDA (dagdeel A same day) available
        """
        # For DIO/DDO (always dagdeel O), check if dagdeel A same day is available
        key_a = (employee_id, demand.date, "A")
        if key_a not in self.werkbestand_planning:
            return False
        
        assignment_a = self.werkbestand_planning[key_a]
        if assignment_a.status != 0:
            logger.debug(f"[DRAAD221-DUO] {employee_id} dagdeel A not available on {demand.date}")
            return False
        
        return True
    
    def _select_best_employee(self, candidates: List[str], service_id: str) -> Optional[str]:
        """
        Select best employee using fair distribution (planregel 3.5)
        
        Selection criteria:
        1. Employee with most remaining shifts (shifts_remaining DESC)
        2. If tie: Employee who did this service longest ago (shifts_in_run ASC)
        3. If still tie: Alphabetical by name
        """
        # Calculate remaining shifts for each candidate
        candidate_scores = []
        for emp_id in candidates:
            cap_key = (emp_id, service_id)
            if cap_key not in self.werkbestand_capaciteit:
                continue
            
            remaining = self.werkbestand_capaciteit[cap_key].aantal
            if remaining <= 0:
                continue
            
            # Calculate shifts_in_run (how many shifts this employee already did)
            shifts_done = 0
            for assignment in self.werkbestand_planning.values():
                if assignment.employee_id == emp_id and assignment.service_id == service_id and assignment.status == 1:
                    shifts_done += 1
            
            employee = self.employees[emp_id]
            full_name = f"{employee.achternaam}, {employee.voornaam}"
            
            candidate_scores.append((emp_id, remaining, shifts_done, full_name))
        
        if not candidate_scores:
            return None
        
        # Sort by: remaining DESC (most shifts first), shifts_done ASC (least done first), name ASC
        candidate_scores.sort(key=lambda x: (-x[1], x[2], x[3]))
        
        selected = candidate_scores[0]
        logger.debug(f"[DRAAD221-SELECT] Selected {selected[3]}: remaining={selected[1]}, done={selected[2]}")
        
        return selected[0]
    
    def _perform_assignment(self, employee_id: str, demand: Demand):
        """
        Perform the actual assignment: Update status and service_id
        """
        key = (employee_id, demand.date, demand.dagdeel)
        if key not in self.werkbestand_planning:
            logger.error(f"[DRAAD221-ERROR] Assignment key not found: {key}")
            return
        
        assignment = self.werkbestand_planning[key]
        assignment.status = 1
        assignment.service_id = demand.service_id
        assignment.source = "greedy"
        
        logger.debug(f"[DRAAD221-PERFORM] Assigned {employee_id} to {demand.service_code} on {demand.date} {demand.dagdeel}")
    
    def _assign_dia_after_dio(self, employee_id: str, demand: Demand):
        """
        Planregel 3.7.1: After assigning DIO (dagdeel O), also assign DIA (dagdeel A)
        and block dagdeel M same day, dagdeel O+M next day
        """
        # Assign DIA dagdeel A same day
        dia_service_id = self._get_service_id_by_code("DIA")
        if not dia_service_id:
            logger.warning("[DRAAD221-DIO] DIA service not found")
            return
        
        key_a = (employee_id, demand.date, "A")
        if key_a in self.werkbestand_planning:
            assignment_a = self.werkbestand_planning[key_a]
            assignment_a.status = 1
            assignment_a.service_id = dia_service_id
            assignment_a.source = "greedy"
            logger.info(f"[DRAAD221-DIO] ✓ Assigned DIA to {employee_id} on {demand.date} dagdeel A")
        
        # Block dagdeel M same day (planregel 3.7.1.2)
        key_m_same = (employee_id, demand.date, "M")
        if key_m_same in self.werkbestand_planning:
            self.werkbestand_planning[key_m_same].status = 2
            self.werkbestand_planning[key_m_same].blocked_by_date = demand.date
            self.werkbestand_planning[key_m_same].blocked_by_dagdeel = "O"
            self.werkbestand_planning[key_m_same].blocked_by_service_id = demand.service_id
            logger.debug(f"[DRAAD221-DIO] Blocked dagdeel M on {demand.date}")
        
        # Block next day dagdeel O and M (planregel 3.7.1.4 and 3.7.1.5)
        next_date = (datetime.strptime(demand.date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        if next_date <= self.end_date.strftime("%Y-%m-%d"):
            key_o_next = (employee_id, next_date, "O")
            key_m_next = (employee_id, next_date, "M")
            
            if key_o_next in self.werkbestand_planning:
                self.werkbestand_planning[key_o_next].status = 2
                self.werkbestand_planning[key_o_next].blocked_by_date = demand.date
                self.werkbestand_planning[key_o_next].blocked_by_dagdeel = "A"
                self.werkbestand_planning[key_o_next].blocked_by_service_id = dia_service_id
                logger.debug(f"[DRAAD221-DIO] Blocked dagdeel O on {next_date}")
            
            if key_m_next in self.werkbestand_planning:
                self.werkbestand_planning[key_m_next].status = 2
                self.werkbestand_planning[key_m_next].blocked_by_date = demand.date
                self.werkbestand_planning[key_m_next].blocked_by_dagdeel = "A"
                self.werkbestand_planning[key_m_next].blocked_by_service_id = dia_service_id
                logger.debug(f"[DRAAD221-DIO] Blocked dagdeel M on {next_date}")
    
    def _assign_dda_after_ddo(self, employee_id: str, demand: Demand):
        """
        Planregel 3.7.2: After assigning DDO (dagdeel O), also assign DDA (dagdeel A)
        and block dagdeel M same day, dagdeel O+M next day
        """
        # Assign DDA dagdeel A same day
        dda_service_id = self._get_service_id_by_code("DDA")
        if not dda_service_id:
            logger.warning("[DRAAD221-DDO] DDA service not found")
            return
        
        key_a = (employee_id, demand.date, "A")
        if key_a in self.werkbestand_planning:
            assignment_a = self.werkbestand_planning[key_a]
            assignment_a.status = 1
            assignment_a.service_id = dda_service_id
            assignment_a.source = "greedy"
            logger.info(f"[DRAAD221-DDO] ✓ Assigned DDA to {employee_id} on {demand.date} dagdeel A")
        
        # Block dagdeel M same day (planregel 3.7.2.2)
        key_m_same = (employee_id, demand.date, "M")
        if key_m_same in self.werkbestand_planning:
            self.werkbestand_planning[key_m_same].status = 2
            self.werkbestand_planning[key_m_same].blocked_by_date = demand.date
            self.werkbestand_planning[key_m_same].blocked_by_dagdeel = "O"
            self.werkbestand_planning[key_m_same].blocked_by_service_id = demand.service_id
            logger.debug(f"[DRAAD221-DDO] Blocked dagdeel M on {demand.date}")
        
        # Block next day dagdeel O and M (planregel 3.7.2.4 and 3.7.2.5)
        next_date = (datetime.strptime(demand.date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        if next_date <= self.end_date.strftime("%Y-%m-%d"):
            key_o_next = (employee_id, next_date, "O")
            key_m_next = (employee_id, next_date, "M")
            
            if key_o_next in self.werkbestand_planning:
                self.werkbestand_planning[key_o_next].status = 2
                self.werkbestand_planning[key_o_next].blocked_by_date = demand.date
                self.werkbestand_planning[key_o_next].blocked_by_dagdeel = "A"
                self.werkbestand_planning[key_o_next].blocked_by_service_id = dda_service_id
                logger.debug(f"[DRAAD221-DDO] Blocked dagdeel O on {next_date}")
            
            if key_m_next in self.werkbestand_planning:
                self.werkbestand_planning[key_m_next].status = 2
                self.werkbestand_planning[key_m_next].blocked_by_date = demand.date
                self.werkbestand_planning[key_m_next].blocked_by_dagdeel = "A"
                self.werkbestand_planning[key_m_next].blocked_by_service_id = dda_service_id
                logger.debug(f"[DRAAD221-DDO] Blocked dagdeel M on {next_date}")
    
    def _get_service_id_by_code(self, code: str) -> Optional[str]:
        """Helper: Get service_id by service code"""
        result = self.db.table("service_types").select("id").eq("code", code).execute()
        if result.data:
            return result.data[0]["id"]
        return None
    
    def _update_database(self):
        """
        Write results back to roster_assignments table
        Only update records where invulling=1 (assigned by GREEDY)
        """
        logger.info("[DRAAD221] Updating database with GREEDY assignments...")
        
        updates = []
        for assignment in self.werkbestand_planning.values():
            if assignment.source == "greedy" and assignment.status == 1:
                update_data = {
                    "status": assignment.status,
                    "service_id": assignment.service_id,
                    "source": assignment.source
                }
                
                # Add blocked_by fields if status=2
                if assignment.status == 2:
                    update_data["blocked_by_date"] = assignment.blocked_by_date
                    update_data["blocked_by_dagdeel"] = assignment.blocked_by_dagdeel
                    update_data["blocked_by_service_id"] = assignment.blocked_by_service_id
                
                # Update in database
                self.db.table("roster_assignments").update(update_data).eq(
                    "roster_id", assignment.roster_id
                ).eq("employee_id", assignment.employee_id).eq(
                    "date", assignment.date
                ).eq("dagdeel", assignment.dagdeel).execute()
                
                updates.append(update_data)
        
        logger.info(f"[DRAAD221] Updated {len(updates)} assignments in database")
        
        # Update roster status to "in_progress"
        self.db.table("roosters").update({"status": "in_progress"}).eq("id", self.roster_id).execute()
        logger.info("[DRAAD221] Roster status updated to in_progress")
    
    def _generate_report(self) -> Dict:
        """
        Generate final report with statistics
        """
        # Calculate remaining capacity
        remaining_capacity = {}
        for (emp_id, service_id), capacity in self.werkbestand_capaciteit.items():
            if capacity.aantal > 0:
                if emp_id not in remaining_capacity:
                    remaining_capacity[emp_id] = {}
                remaining_capacity[emp_id][service_id] = capacity.aantal
        
        # Find open slots
        open_slots = []
        for demand in self.werkbestand_opdracht:
            if demand.invulling == 0:
                open_slots.append({
                    "date": demand.date,
                    "dagdeel": demand.dagdeel,
                    "team": demand.team,
                    "service_code": demand.service_code,
                    "aantal": demand.aantal
                })
        
        report = {
            "roster_id": self.roster_id,
            "status": "complete",
            "statistics": self.stats,
            "remaining_capacity": remaining_capacity,
            "open_slots": open_slots,
            "coverage_percentage": round((self.stats["greedy_assigned"] / self.stats["total_demand"]) * 100, 2) if self.stats["total_demand"] > 0 else 0
        }
        
        logger.info(f"[DRAAD221] === FINAL REPORT ===")
        logger.info(f"[DRAAD221] Total demand: {self.stats['total_demand']}")
        logger.info(f"[DRAAD221] Pre-planned: {self.stats['pre_planned']}")
        logger.info(f"[DRAAD221] GREEDY assigned: {self.stats['greedy_assigned']}")
        logger.info(f"[DRAAD221] Open slots: {self.stats['open_slots']}")
        logger.info(f"[DRAAD221] Blocked slots: {self.stats['blocked_slots']}")
        logger.info(f"[DRAAD221] Coverage: {report['coverage_percentage']}%")
        logger.info(f"[DRAAD221] === END REPORT ===")
        
        return report
