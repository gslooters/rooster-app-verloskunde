#!/usr/bin/env python3
"""
Sequential Solver V2 - Complete Implementation

FASE 2: Sequential Priority Queue Solver

Doel: Implement a deterministic sequential solver that:
  1. Loads real requirements from database
  2. Sorts by correct 3-layer priority (dagdeel -> service -> team)
  3. Tracks employee availability correctly
  4. Assigns employees sequentially
  5. Reports failures gracefully

Based on DRAAD172 template but with REAL DATABASE, correct logic, proper error handling.
"""

import logging
from datetime import date, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional
from enum import Enum
import os
from supabase import create_client, Client
import json

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class Dagdeel(str, Enum):
    """Dagdeel enumeration."""
    OCHTEND = "O"
    MIDDAG = "M"
    AVOND = "A"


class TeamType(str, Enum):
    """Team enumeration."""
    MAAT = "Maat"
    LOONDIENST = "Loondienst"
    ZZP = "ZZP"
    OVERIG = "Overig"


class SolveStatus(str, Enum):
    """Solve status enumeration."""
    OPTIMAL = "optimal"
    FEASIBLE = "feasible"
    INFEASIBLE = "infeasible"
    ERROR = "error"
    UNKNOWN = "unknown"


@dataclass
class Requirement:
    """Single requirement to fulfill."""
    service_id: str
    date: date
    dagdeel: str  # 'O', 'M', 'A'
    team: str    # 'TOT', 'GRO', 'ORA'
    priority: int  # 1-10, higher = earlier
    count_needed: int
    service_code: str = ""
    
    def __repr__(self) -> str:
        return f"Req({self.service_code} {self.date} {self.dagdeel}/{self.team} x{self.count_needed})"


@dataclass
class Employee:
    """Employee data from database."""
    id: str
    voornaam: str
    achternaam: str
    team: Optional[str] = None
    dienstverband: Optional[str] = None
    structureel_nbh: Optional[Dict] = None
    
    @property
    def name(self) -> str:
        return f"{self.voornaam} {self.achternaam}"
    
    def __repr__(self) -> str:
        return f"Emp({self.name})"


@dataclass
class Service:
    """Service type from database."""
    id: str
    code: str
    naam: str
    begintijd: Optional[str] = None
    eindtijd: Optional[str] = None
    
    def __repr__(self) -> str:
        return f"Service({self.code})"


@dataclass
class RosterEmployeeService:
    """Employee's capability for a service."""
    id: str
    roster_id: str
    employee_id: str
    service_id: str
    aantal: int
    actief: bool


@dataclass
class Assignment:
    """Single assignment result."""
    employee_id: str
    employee_name: str
    date: date
    dagdeel: Dagdeel
    service_id: str
    service_code: str
    
    def to_dict(self) -> Dict:
        return {
            "employee_id": self.employee_id,
            "employee_name": self.employee_name,
            "date": self.date.isoformat(),
            "dagdeel": self.dagdeel.value,
            "service_id": self.service_id,
            "service_code": self.service_code
        }


@dataclass
class ConstraintViolation:
    """A constraint violation or failure."""
    constraint_type: str
    message: str
    severity: str  # 'critical', 'warning'
    employee_id: Optional[str] = None
    date: Optional[date] = None
    
    def to_dict(self) -> Dict:
        return {
            "constraint_type": self.constraint_type,
            "message": self.message,
            "severity": self.severity,
            "employee_id": self.employee_id,
            "date": self.date.isoformat() if self.date else None
        }


@dataclass
class SolveResponse:
    """Response from solver."""
    status: SolveStatus
    roster_id: str
    assignments: List[Assignment]
    solve_time_seconds: float = 0.0
    total_assignments: int = 0
    violations: List[ConstraintViolation] = field(default_factory=list)
    solver_metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "status": self.status.value,
            "roster_id": self.roster_id,
            "assignments": [a.to_dict() for a in self.assignments],
            "solve_time_seconds": self.solve_time_seconds,
            "total_assignments": self.total_assignments,
            "violations": [v.to_dict() for v in self.violations],
            "solver_metadata": self.solver_metadata
        }


class RequirementQueue:
    """Load and manage requirements from database."""
    
    def __init__(self, roster_id: str, db: Client):
        self.roster_id = roster_id
        self.db = db
        self.requirements: List[Requirement] = []
        self.services_cache: Dict[str, Service] = {}
    
    def load_from_db(self, services: Dict[str, Service]) -> List[Requirement]:
        """Load requirements from roster_period_staffing with joined dagdelen data.
        
        DRAAD176 FIX: Query parent table (roster_period_staffing) with nested select
        of dagdelen child records. This ensures we have the 'date' field from parent.
        """
        logger.info(f"Loading requirements for roster {self.roster_id}...")
        self.services_cache = services
        
        try:
            # ✅ CORRECT: Get parent table with nested child data
            # This ensures we have the 'date' field from roster_period_staffing
            response = self.db.table('roster_period_staffing')\
                .select('*, roster_period_staffing_dagdelen(id, dagdeel, team, status, aantal)')\
                .eq('roster_id', self.roster_id)\
                .execute()
            
            requirements = []
            
            # Process each parent record (one per service/date combination)
            for parent_row in response.data:
                parent_date = self._parse_date(parent_row.get('date'))  # ✅ NOW EXISTS
                parent_service_id = parent_row.get('service_id', '')
                
                # Get nested child records (dagdelen breakdowns)
                dagdelen_list = parent_row.get('roster_period_staffing_dagdelen', [])
                
                if not dagdelen_list:
                    # No dagdelen specified - create single requirement for all staff
                    req = Requirement(
                        service_id=parent_service_id,
                        date=parent_date,
                        dagdeel='O',  # Default
                        team='TOT',   # Default
                        priority=self._calculate_priority(parent_row),
                        count_needed=0,
                        service_code=self._get_service_code(parent_service_id)
                    )
                    requirements.append(req)
                else:
                    # Create one requirement per dagdeel breakdown
                    for dagdeel_row in dagdelen_list:
                        req = Requirement(
                            service_id=parent_service_id,
                            date=parent_date,  # ✅ From parent
                            dagdeel=dagdeel_row.get('dagdeel', 'O'),
                            team=dagdeel_row.get('team', 'TOT'),
                            priority=self._calculate_priority(parent_row),
                            count_needed=dagdeel_row.get('aantal', 0),
                            service_code=self._get_service_code(parent_service_id)
                        )
                        requirements.append(req)
            
            self.requirements = requirements
            logger.info(f"Loaded {len(requirements)} requirements from {len(response.data)} parent records")
            return requirements
        
        except Exception as e:
            logger.error(f"ERROR loading requirements: {str(e)}", exc_info=True)
            raise
    
    def sort_by_priority(self, requirements: List[Requirement]) -> List[Requirement]:
        """
        3-layer priority sorting (DRAAD172 correct logic):
        
        Layer 1: Per dagdeel
        ├─ Ochtend (O): DIO → DDO → rest
        ├─ Middag (M): all equal
        └─ Avond (A): DIA → DDA → rest
        
        Layer 2: Within service type
        ├─ System (DIO/etc): GRO → ORA → TOT
        ├─ Others: alfabetisch
        
        Layer 3: Within team
        └─ Alfabetisch team
        """
        logger.info(f"Sorting {len(requirements)} requirements by 3-layer priority...")
        
        def sort_key(req: Requirement) -> Tuple:
            # Layer 1: Per-dagdeel priority
            dagdeel_order = {
                'O': {  # Ochtend
                    'DIO': 1,
                    'DDO': 2,
                },
                'M': {  # Middag - all same
                    '*': 5,
                },
                'A': {  # Avond
                    'DIA': 3,
                    'DDA': 4,
                }
            }
            
            dagdeel_pri = dagdeel_order.get(req.dagdeel, {}).get(
                req.service_code,
                dagdeel_order.get(req.dagdeel, {}).get('*', 5)
            )
            
            # Layer 2: Team order (GRO before ORA before TOT)
            team_order = {'GRO': 1, 'ORA': 2, 'TOT': 3}
            team_pri = team_order.get(req.team, 4)
            
            # Layer 3: alfabetisch service code + date
            return (dagdeel_pri, team_pri, req.service_code, req.date)
        
        sorted_reqs = sorted(requirements, key=sort_key)
        logger.info(f"Sorted {len(sorted_reqs)} requirements successfully")
        return sorted_reqs
    
    def _parse_date(self, date_str: str) -> date:
        """Parse date from database with defensive checks.
        
        DRAAD176 FIX: Added explicit None check to catch data join errors early.
        """
        # Defensive: Check for None first
        if date_str is None:
            raise ValueError(
                f"CRITICAL: date_str is None in load_from_db. "
                f"Verify SQL query includes parent roster_period_staffing table with 'date' field."
            )
        
        # If already a date object, return as-is
        if isinstance(date_str, date):
            return date_str
        
        # Must be a string
        if not isinstance(date_str, str):
            raise TypeError(
                f"Expected str or date, got {type(date_str).__name__}: {date_str}"
            )
        
        try:
            # Expected format: YYYY-MM-DD
            parts = date_str.split('-')
            if len(parts) != 3:
                raise ValueError(f"Invalid date format (expected YYYY-MM-DD): {date_str}")
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, IndexError) as e:
            raise ValueError(f"Failed to parse date '{date_str}': {str(e)}")
    
    def _calculate_priority(self, row: Dict) -> int:
        """
        Priority calculation (1-10, higher = first):
        1. System services (DIO/DDO/DIA/DDA) = 10
        2. Team services (OSP/MSP/SWZ) = 7
        3. Praktijk services (ECH/GRB/MDH) = 5
        4. Reserve services (NB) = 1
        """
        code = self._get_service_code(row.get('service_id', ''))
        if code in ['DIO', 'DDO', 'DIA', 'DDA']:
            return 10
        elif code in ['OSP', 'MSP', 'SWZ']:
            return 7
        elif code in ['ECH', 'GRB', 'MDH']:
            return 5
        else:
            return 1
    
    def _get_service_code(self, service_id: str) -> str:
        """Get service code from service ID."""
        if service_id in self.services_cache:
            return self.services_cache[service_id].code
        return "UNK"


class EmployeeAvailabilityTracker:
    """Track employee availability throughout solve."""
    
    def __init__(self, roster_id: str, db: Client, employees: Dict[str, Employee]):
        self.roster_id = roster_id
        self.db = db
        self.employees = employees
        self.assigned_count: Dict[Tuple[str, str], int] = {}  # (emp_id, service_id) -> count
        self.slot_assignments: Dict[Tuple[str, date, str], str] = {}  # (emp_id, date, dagdeel) -> service_id
        self.blocked_slots: Set[Tuple[str, date, str]] = set()  # {(emp_id, date, dagdeel)}
        self._initialize()
    
    def _initialize(self):
        """Load blocked slots from database."""
        logger.info("Initializing availability tracker...")
        
        try:
            # Load blocked slots (status 2, 3)
            response = self.db.table('roster_assignments')\
                .select('*')\
                .eq('roster_id', self.roster_id)\
                .in_('status', [2, 3])\
                .execute()
            
            for row in response.data:
                key = (row['employee_id'], self._parse_date(row['date']), row['dagdeel'])
                self.blocked_slots.add(key)
            
            logger.info(f"Loaded {len(self.blocked_slots)} blocked slots")
        
        except Exception as e:
            logger.error(f"ERROR initializing tracker: {str(e)}", exc_info=True)
            raise
    
    def is_available(self, emp_id: str, date_val: date, dagdeel: str) -> bool:
        """Check if employee is available in this slot."""
        # Not blocked
        if (emp_id, date_val, dagdeel) in self.blocked_slots:
            return False
        
        # Not already assigned
        if (emp_id, date_val, dagdeel) in self.slot_assignments:
            return False
        
        # Not structurally blocked
        emp = self.employees.get(emp_id)
        if emp and self._is_structureel_blocked(emp, date_val, dagdeel):
            return False
        
        return True
    
    def assign(self, emp_id: str, service_id: str, date_val: date, dagdeel: str):
        """Record assignment."""
        self.slot_assignments[(emp_id, date_val, dagdeel)] = service_id
        key = (emp_id, service_id)
        self.assigned_count[key] = self.assigned_count.get(key, 0) + 1
    
    def get_assigned_count(self, emp_id: str, service_id: str) -> int:
        """Get count of assignments for this employee-service."""
        return self.assigned_count.get((emp_id, service_id), 0)
    
    def _is_structureel_blocked(self, employee: Employee, date_val: date, dagdeel: str) -> bool:
        """Check structureel_nbh (structured non-availability)."""
        if not employee.structureel_nbh:
            return False
        
        if isinstance(employee.structureel_nbh, str):
            try:
                nbh = json.loads(employee.structureel_nbh)
            except:
                return False
        else:
            nbh = employee.structureel_nbh
        
        # Get day name
        days = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
        day_key = days[date_val.weekday()]
        
        if day_key not in nbh:
            return False
        
        blocked_dagdelen = nbh[day_key]
        return dagdeel in blocked_dagdelen
    
    def _parse_date(self, date_str: str) -> date:
        """Parse date from database."""
        if isinstance(date_str, date):
            return date_str
        parts = date_str.split('-')
        return date(int(parts[0]), int(parts[1]), int(parts[2]))


class SequentialSolverV2:
    """Sequential Priority Queue Solver - V2 with real database integration."""
    
    def __init__(self, roster_id: str, db: Client):
        self.roster_id = roster_id
        self.db = db
        self.assignments: List[Assignment] = []
        self.failures: List[Dict] = []
        self.tracker: Optional[EmployeeAvailabilityTracker] = None
        self.employees: Dict[str, Employee] = {}
        self.services: Dict[str, Service] = {}
    
    def solve(self) -> SolveResponse:
        """Main sequential solve loop."""
        logger.info("=== SequentialSolverV2.solve() START ===")
        import time
        start_time = time.time()
        
        try:
            # Step 1: Load data
            logger.info("Step 1: Loading employees, services...")
            self._load_data()
            
            # Step 2: Load requirements
            logger.info("Step 2: Loading requirements...")
            queue = RequirementQueue(self.roster_id, self.db)
            requirements = queue.load_from_db(self.services)
            
            if not requirements:
                logger.warning("No requirements loaded - returning empty roster")
                return self._build_response(time.time() - start_time)
            
            # Step 3: Sort requirements
            logger.info("Step 3: Sorting by priority...")
            requirements = queue.sort_by_priority(requirements)
            
            # Step 4: Initialize tracker
            logger.info("Step 4: Initializing tracker...")
            self.tracker = EmployeeAvailabilityTracker(self.roster_id, self.db, self.employees)
            
            # Step 5: Main assignment loop
            logger.info("Step 5: Starting assignment loop...")
            for requirement in requirements:
                self._process_requirement(requirement)
            
            # Step 6: Build response
            solve_time = time.time() - start_time
            response = self._build_response(solve_time)
            logger.info(f"=== Solve complete: {len(self.assignments)} assignments, "
                       f"{len(self.failures)} failures, {solve_time:.2f}s ===")
            return response
        
        except Exception as e:
            logger.error(f"CRITICAL ERROR in sequential solve: {str(e)}", exc_info=True)
            import time as time_module
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=self.roster_id,
                assignments=[],
                solve_time_seconds=round(time_module.time() - start_time, 2),
                violations=[ConstraintViolation(
                    constraint_type="sequential_error",
                    message=f"Sequential solver error: {str(e)[:200]}",
                    severity="critical"
                )]
            )
    
    def _process_requirement(self, requirement: Requirement):
        """Process one requirement - assign needed employees."""
        logger.debug(f"Processing: {requirement}")
        
        # Filter eligible employees
        eligible = self._filter_eligible_employees(requirement)
        
        if not eligible:
            logger.warning(f"NO eligible employees for {requirement}")
            self.failures.append({
                'requirement': requirement,
                'reason': 'no_eligible_employees'
            })
            return
        
        # Sort eligible employees (prefer less-assigned first)
        eligible.sort(
            key=lambda e: self.tracker.get_assigned_count(e.id, requirement.service_id)
        )
        
        # Assign employees until requirement met
        assigned = 0
        for employee in eligible:
            if assigned >= requirement.count_needed:
                break
            
            if self.tracker.is_available(employee.id, requirement.date, requirement.dagdeel):
                # Create assignment
                self.tracker.assign(employee.id, requirement.service_id, 
                                   requirement.date, requirement.dagdeel)
                self.assignments.append(Assignment(
                    employee_id=employee.id,
                    employee_name=employee.name,
                    date=requirement.date,
                    dagdeel=Dagdeel(requirement.dagdeel),
                    service_id=requirement.service_id,
                    service_code=requirement.service_code
                ))
                assigned += 1
        
        if assigned < requirement.count_needed:
            shortage = requirement.count_needed - assigned
            logger.warning(f"SHORTAGE: {requirement} short by {shortage}")
            self.failures.append({
                'requirement': requirement,
                'reason': 'insufficient_capacity',
                'shortage': shortage,
                'assigned': assigned
            })
    
    def _filter_eligible_employees(self, requirement: Requirement) -> List[Employee]:
        """Filter employees eligible for this requirement."""
        eligible = []
        
        try:
            # Load roster_employee_services for this service
            response = self.db.table('roster_employee_services')\
                .select('*')\
                .eq('roster_id', self.roster_id)\
                .eq('service_id', requirement.service_id)\
                .eq('actief', True)\
                .execute()
            
            for res in response.data:
                emp = self.employees.get(res['employee_id'])
                if not emp:
                    continue
                
                # Team filtering
                if requirement.team == 'GRO' and emp.team != TeamType.MAAT.value:
                    continue
                elif requirement.team == 'ORA' and emp.team != TeamType.LOONDIENST.value:
                    continue
                elif requirement.team == 'TOT':
                    pass  # All allowed
                
                eligible.append(emp)
        
        except Exception as e:
            logger.error(f"ERROR filtering eligible: {str(e)}", exc_info=True)
        
        return eligible
    
    def _load_data(self):
        """Load employees, services from DB."""
        try:
            # Employees
            emp_resp = self.db.table('employees').select('*').execute()
            for e in emp_resp.data:
                emp = Employee(
                    id=e['id'],
                    voornaam=e.get('voornaam', ''),
                    achternaam=e.get('achternaam', ''),
                    team=e.get('team'),
                    dienstverband=e.get('dienstverband'),
                    structureel_nbh=e.get('structureel_nbh')
                )
                self.employees[emp.id] = emp
            
            # Services
            svc_resp = self.db.table('service_types').select('*').execute()
            for s in svc_resp.data:
                svc = Service(
                    id=s['id'],
                    code=s.get('code', ''),
                    naam=s.get('naam', ''),
                    begintijd=s.get('begintijd'),
                    eindtijd=s.get('eindtijd')
                )
                self.services[svc.id] = svc
            
            logger.info(f"Loaded {len(self.employees)} employees, {len(self.services)} services")
        
        except Exception as e:
            logger.error(f"ERROR loading data: {str(e)}", exc_info=True)
            raise
    
    def _build_response(self, solve_time: float) -> SolveResponse:
        """Build SolveResponse from assignments."""
        status = SolveStatus.OPTIMAL if not self.failures else SolveStatus.FEASIBLE
        
        violations = []
        for failure in self.failures:
            violations.append(ConstraintViolation(
                constraint_type=failure['reason'],
                message=f"{failure['requirement']}: {failure['reason']}",
                severity="warning"
            ))
        
        return SolveResponse(
            status=status,
            roster_id=self.roster_id,
            assignments=self.assignments,
            solve_time_seconds=round(solve_time, 2),
            total_assignments=len(self.assignments),
            violations=violations,
            solver_metadata={
                "version": "v2_sequential",
                "method": "sequential_priority_queue",
                "failures": len(self.failures)
            }
        )


def get_supabase_client() -> Client:
    """Get Supabase client from environment."""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables required")
    return create_client(url, key)


if __name__ == "__main__":
    # Test harness
    import sys
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    if len(sys.argv) < 2:
        print("Usage: sequential_solver_v2.py <roster_id>")
        sys.exit(1)
    
    roster_id = sys.argv[1]
    db = get_supabase_client()
    
    solver = SequentialSolverV2(roster_id, db)
    response = solver.solve()
    
    print(f"\nStatus: {response.status.value}")
    print(f"Assignments: {response.total_assignments}")
    print(f"Failures: {len(response.violations)}")
    print(f"Time: {response.solve_time_seconds}s")
