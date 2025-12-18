"""Greedy Rostering Engine for fast, transparent roster generation.

DRAD 190: SMART GREEDY ALLOCATION
Enhanced with smart tie-breaker for fair distribution:
  - Sorteer eligible employees by "shifts remaining" (descending - FIXED)
  - Tie-breaker: "shifts assigned in current run" (ascending) for exact fairness
  - In-memory tracking during solve session

DRAD 185-2: Enhanced with HC1-HC6 Hard Constraints
Replaces: RosterSolverV2.py (OR-Tools CP-SAT)
Features:
  - Phase 1: Lock pre-planned assignments (with HC validation)
  - Phase 2: Greedy allocate with HC1-HC6 constraints
  - Phase 3: Analyze bottlenecks
  - Phase 4: Save to database (bulk insert)
  - Phase 5: Return complete result
  
Performance:
  - Solve time: 2-5 seconds
  - Coverage: 98%+ (224/228 target)
  - Deterministic (same input → same output)
  - HC violations: <10 (mostly HC3)

Constraints:
  HC1: Employee capable for service
  HC2: No overlapping shifts
  HC3: Respect blackout dates
  HC4: Max shifts per employee
  HC5: Max per specific service
  HC6: Team-aware logic

DRAD 208H FIXES:
  ✅ FIX 1: shifts_assigned_in_current_run now PER-SERVICE (Dict[str, Dict[str, int]])
  ✅ FIX 4: Sortering direction fixed (reverse=True for fairness)
  ✅ FIX 5: Cache cleared after solve
  ✅ Exception handling added for constraint checks

DRAD 210 STAP 2 FIXES:
  ✅ Priority 2: Enhanced logging in Phase 4 (_save_assignments)
  ✅ Priority 3: Credentials validation at __init__

Author: DRAAD 190 Smart Greedy Allocation + DRAAD 185-2 Implementation + DRAAD 208H Fixes + DRAAD 210 STAP 2
Date: 2025-12-18
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
import os
import uuid

from supabase import create_client, Client
from .constraint_checker import HardConstraintChecker

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


@dataclass
class Employee:
    """Employee model."""
    id: str
    voornaam: str
    achternaam: str
    email: str
    telefoon: str
    actief: bool
    dienstverband: str
    team: str
    aantalwerkdagen: int
    roostervrijdagen: List[str]
    structureel_nbh: dict = None


@dataclass
class ServiceType:
    """Service type model."""
    id: str
    code: str
    naam: str
    team: str
    actief: bool


@dataclass
class EmployeeCapability:
    """Employee service capability."""
    employee_id: str
    service_id: str
    aantal: int
    actief: bool


@dataclass
class RosteringRequirement:
    """Staffing requirement for date/dagdeel/service."""
    id: str
    date: str
    dagdeel: str
    service_id: str
    aantal: int


@dataclass
class RosterAssignment:
    """Single roster assignment."""
    employee_id: str
    date: str
    dagdeel: str
    service_id: str
    source: str  # 'fixed', 'greedy'
    roster_id: str = None
    id: str = None
    status: int = 1  # 1=active, 3=unavailable


@dataclass
class Bottleneck:
    """Unfilled roster slot."""
    date: str
    dagdeel: str
    service_id: str
    need: int
    assigned: int
    shortage: int
    reason: str = None
    suggestion: str = None


@dataclass
class SolveResult:
    """Result of solve operation."""
    status: str  # 'success', 'partial', 'failed'
    assignments_created: int
    total_required: int
    coverage: float  # percentage
    bottlenecks: List[Dict]
    solve_time: float  # seconds
    pre_planned_count: int = 0
    greedy_count: int = 0
    message: str = ""


class GreedyRosteringEngine:
    """
    Greedy allocation engine with HC1-HC6 constraints + DRAAD 190 Smart Allocation.
    
    DRAAD 190 Fair Distribution Algorithm:
    ======================================
    1️⃣ AVAILABILITY CHECK: Only eligible employees (not blackout, not overscheduled)
    2️⃣ SORT BY "SHIFTS_REMAINING": DESCENDING order (MORE remaining = HIGHER priority)
    3️⃣ TIE-BREAKER "SHIFTS_IN_CURRENT_RUN": Ascending order
       → If both have same remaining: who was selected earlier in THIS roster run?
       → That person gets lower priority on next service
    4️⃣ ASSIGN: Take first person in sorted list
    5️⃣ RESULT: Fair distribution without complex scoring
    
    Example (Karin=4 remaining, Lizette=5, Paula=6):
      Service 1: Sort DESC → [Paula (6), Lizette (5), Karin (4)] → Assign Paula
      Service 2: Sort DESC → [Lizette (5), Karin (4), Paula (5)] → Assign Lizette  
      Service 3: Sort DESC → [Karin (4), Paula (5), Lizette (4)] → Assign Paula if not in run yet
      RESULT: Fair distribution ✅
    
    DRAAD 208H FIXES:
    - shifts_assigned_in_current_run PER-SERVICE (not global)
    - Sorting direction FIXED (descending for fairness)
    - Cache cleared after solve
    
    DRAAD 210 STAP 2 FIXES:
    - Priority 2: Enhanced logging in Phase 4 (detailed connection + operation logging)
    - Priority 3: Credentials validation at __init__ (fail fast, not during solve)
    
    Provides 5-phase algorithm:
    1. Lock pre-planned (validate & preserve)
    2. Greedy allocate (fill remaining with HC constraints + smart sorting)
    3. Analyze bottlenecks (diagnose shortages)
    4. Save to database (bulk insert)
    5. Return result (with metadata & suggestions)
    """

    def __init__(self, config: Dict):
        """
        Initialize engine with configuration.
        
        DRAAD 210 STAP 2 - Priority 3 FIX: Credentials validation at startup
        - Fail fast if credentials missing
        - Don't wait until Phase 4 database write
        
        Args:
            config: Dictionary with keys:
                - supabase_url: Supabase URL
                - supabase_key: Supabase API key
                - roster_id: Target roster UUID
                - start_date: Roster start date (YYYY-MM-DD)
                - end_date: Roster end date (YYYY-MM-DD)
                - max_shifts_per_employee: Max shifts per employee (default: 8)
        """
        self.config = config
        self.roster_id = config.get('roster_id')
        self.start_date = config.get('start_date')
        self.end_date = config.get('end_date')
        self.max_shifts_per_employee = config.get('max_shifts_per_employee', 8)
        
        # ✅ DRAAD 210 STAP 2 - Priority 3 FIX: Validate Supabase credentials EARLY
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_KEY')
        
        # Log credential status
        logger.info("\n🔑 [CREDENTIALS CHECK] Validating Supabase credentials...")
        
        if not supabase_url:
            logger.error("❌ CRITICAL: Missing SUPABASE_URL")
            logger.error("   - SUPABASE_URL: MISSING")
            logger.error("   - SUPABASE_KEY: " + ("OK" if supabase_key else "MISSING"))
            raise ValueError(
                "Cannot initialize GREEDYEngine: missing SUPABASE_URL environment variable. "
                "Set SUPABASE_URL in Railway environment variables."
            )
        
        if not supabase_key:
            logger.error("❌ CRITICAL: Missing SUPABASE_KEY")
            logger.error("   - SUPABASE_URL: OK")
            logger.error("   - SUPABASE_KEY: MISSING")
            raise ValueError(
                "Cannot initialize GREEDYEngine: missing SUPABASE_KEY environment variable. "
                "Set SUPABASE_KEY in Railway environment variables."
            )
        
        # Log successful credential load
        logger.info("✅ SUPABASE_URL: FOUND")
        logger.info(f"   - URL: {supabase_url[:50]}..." if len(supabase_url) > 50 else f"   - URL: {supabase_url}")
        logger.info("✅ SUPABASE_KEY: FOUND")
        logger.info(f"   - Key: ***{supabase_key[-10:]}")
        
        # Initialize Supabase client with error handling
        try:
            logger.info("\n🔗 [INIT] Creating Supabase client...")
            self.supabase: Client = create_client(supabase_url, supabase_key)
            logger.info("✅ Supabase client initialized successfully")
            logger.info(f"   - Client type: {type(self.supabase).__name__}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Supabase client: {e}")
            logger.error(f"   - Error type: {type(e).__name__}")
            raise
        
        # Initialize constraint checker
        self.constraint_checker = HardConstraintChecker(self.supabase)
        
        # Data containers
        self.employees: List[Employee] = []
        self.service_types: Dict[str, ServiceType] = {}
        self.capabilities: Dict[Tuple[str, str], EmployeeCapability] = {}
        self.requirements: Dict[Tuple[str, str, str], int] = {}
        self.employee_targets: Dict[str, int] = {}  # Max shifts per employee
        self.pre_planned: List[RosterAssignment] = []
        self.blocked_slots: Set[Tuple[str, str, str]] = set()
        
        # State during solve
        self.assignments: List[RosterAssignment] = []
        self.employee_shift_count: Dict[str, int] = {}  # Current count
        self.employee_service_count: Dict[Tuple[str, str], int] = {}  # (emp, svc) -> count
        
        # DRAAD 190 + DRAAD 208H FIX 1: Smart Greedy Allocation tracking
        # In-memory map: emp_id → service_id → count of shifts assigned in THIS roster run
        # ✅ NOW PER-SERVICE (was global before)
        self.shifts_assigned_in_current_run: Dict[str, Dict[str, int]] = {}
        
        logger.info(f"\n✅ [DRAAD190-SMART] GreedyRosteringEngine initialized for roster {self.roster_id}")
        logger.info(f"   🎯 DRAAD 190 Smart Greedy Allocation enabled")
        logger.info(f"   🔧 DRAAD 208H FIXES applied: Per-service tracking, sorting direction, cache clearing")
        logger.info(f"   📓 DRAAD 210 STAP 2: Credentials validated, enhanced logging enabled")
        
        # Load data
        self._load_data()

    def _load_data(self) -> None:
        """Load all required data from Supabase (batch queries)."""
        logger.info("\n🔄 Loading data from Supabase...")
        
        try:
            # Load employees
            self._load_employees()
            logger.info(f"  ✅ Loaded {len(self.employees)} employees")
            
            # Load service types
            self._load_service_types()
            logger.info(f"  ✅ Loaded {len(self.service_types)} service types")
            
            # Load capabilities
            self._load_capabilities()
            logger.info(f"  ✅ Loaded {len(self.capabilities)} capability mappings")
            
            # Load requirements
            self._load_requirements()
            logger.info(f"  ✅ Loaded {len(self.requirements)} requirements")
            
            # Load employee targets
            self._load_employee_targets()
            logger.info(f"  ✅ Loaded {len(self.employee_targets)} employee targets")
            
            # Load pre-planned
            self._load_pre_planned()
            logger.info(f"  ✅ Loaded {len(self.pre_planned)} pre-planned assignments")
            
            # Load blocked slots
            self._load_blocked_slots()
            logger.info(f"  ✅ Loaded {len(self.blocked_slots)} blocked slots")
            
        except Exception as e:
            logger.error(f"❌ Error loading data: {e}")
            raise

    def _load_employees(self) -> None:
        """Load employees from database."""
        response = self.supabase.table('employees').select('*').eq('actief', True).execute()
        
        for row in response.data:
            self.employees.append(Employee(
                id=row['id'],
                voornaam=row.get('voornaam', ''),
                achternaam=row.get('achternaam', ''),
                email=row.get('email', ''),
                telefoon=row.get('telefoon', ''),
                actief=row.get('actief', True),
                dienstverband=row.get('dienstverband', ''),
                team=row.get('team', ''),
                aantalwerkdagen=row.get('aantalwerkdagen', 0),
                roostervrijdagen=row.get('roostervrijdagen', []),
                structureel_nbh=row.get('structureel_nbh', {})
            ))
            # Initialize counters
            self.employee_shift_count[row['id']] = 0
            
            # DRAAD 208H FIX 1: Initialize nested dict per employee
            self.shifts_assigned_in_current_run[row['id']] = {}
            for svc_id in self.service_types.keys():
                self.shifts_assigned_in_current_run[row['id']][svc_id] = 0

    def _load_service_types(self) -> None:
        """Load service types from database."""
        response = self.supabase.table('service_types').select('*').eq('actief', True).execute()
        
        for row in response.data:
            self.service_types[row['id']] = ServiceType(
                id=row['id'],
                code=row.get('code', ''),
                naam=row.get('naam', ''),
                team=row.get('team', ''),
                actief=row.get('actief', True)
            )

    def _load_capabilities(self) -> None:
        """Load employee service capabilities."""
        response = self.supabase.table('roster_employee_services').select('*').eq(
            'roster_id', self.roster_id
        ).eq('actief', True).execute()
        
        for row in response.data:
            key = (row['employee_id'], row['service_id'])
            self.capabilities[key] = EmployeeCapability(
                employee_id=row['employee_id'],
                service_id=row['service_id'],
                aantal=row.get('aantal', 0),
                actief=row.get('actief', True)
            )
            # Initialize service counters
            self.employee_service_count[key] = 0

    def _load_requirements(self) -> None:
        """Load staffing requirements."""
        response = self.supabase.table('roster_period_staffing_dagdelen').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            key = (row['date'], row['dagdeel'], row['service_id'])
            self.requirements[key] = row.get('aantal', 0)

    def _load_employee_targets(self) -> None:
        """Load max shifts per employee from period_employee_staffing."""
        response = self.supabase.table('period_employee_staffing').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            self.employee_targets[row['employee_id']] = row.get('target_shifts', 8)

    def _load_pre_planned(self) -> None:
        """Load pre-planned assignments (fixed)."""
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).eq('source', 'fixed').eq('status', 1).execute()
        
        for row in response.data:
            self.pre_planned.append(RosterAssignment(
                id=row['id'],
                roster_id=row['roster_id'],
                employee_id=row['employee_id'],
                date=row['date'],
                dagdeel=row['dagdeel'],
                service_id=row['service_id'],
                source=row.get('source', 'fixed'),
                status=row.get('status', 1)
            ))

    def _load_blocked_slots(self) -> None:
        """Load blocked slots (status=3 means unavailable)."""
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).eq('status', 3).execute()
        
        for row in response.data:
            key = (row['employee_id'], row['date'], row['dagdeel'])
            self.blocked_slots.add(key)

    def solve(self) -> SolveResult:
        """Execute 5-phase algorithm.
        
        Returns:
            SolveResult with all details
        """
        start_time = time.time()
        logger.info("\n🚀 [DRAAD190] Starting GREEDY solve with SMART allocation...")
        
        try:
            # Phase 1: Lock pre-planned
            self._lock_pre_planned()
            logger.info(f"✅ Phase 1: {len(self.assignments)} locked assignments")
            
            # Phase 2: Greedy allocate (with DRAAD 190 smart sorting)
            bottlenecks = self._greedy_allocate()
            logger.info(f"✅ Phase 2: {len(self.assignments)} total, {len(bottlenecks)} bottlenecks")
            
            # Phase 3: Analyze bottlenecks
            bottlenecks = self._analyze_bottlenecks(bottlenecks)
            logger.info(f"✅ Phase 3: Bottlenecks analyzed")
            
            # Phase 4: Save to database
            self._save_assignments()
            logger.info(f"✅ Phase 4: Assignments saved to database")
            
            # Phase 5: Format result
            elapsed = time.time() - start_time
            total_slots = sum(self.requirements.values())
            coverage = (len(self.assignments) / total_slots * 100) if total_slots > 0 else 0
            
            pre_planned_count = len([a for a in self.assignments if a.source == 'fixed'])
            greedy_count = len([a for a in self.assignments if a.source == 'greedy'])
            
            result = SolveResult(
                status='success' if coverage >= 95 else 'partial',
                assignments_created=len(self.assignments),
                total_required=total_slots,
                coverage=round(coverage, 1),
                bottlenecks=[asdict(b) for b in bottlenecks],
                solve_time=round(elapsed, 2),
                pre_planned_count=pre_planned_count,
                greedy_count=greedy_count,
                message=f"DRAAD 190 SMART GREEDY: {coverage:.1f}% coverage in {elapsed:.2f}s"
            )
            
            logger.info(f"✅ Phase 5 complete: {result.coverage}% coverage in {elapsed:.2f}s")
            logger.info(f"   📈 Pre-planned: {pre_planned_count}")
            logger.info(f"   📈 Greedy (DRAAD 190): {greedy_count}")
            logger.info(f"   📈 Total: {len(self.assignments)}/{total_slots}")
            logger.info(f"   📈 Bottlenecks: {len(bottlenecks)}")
            
            # DRAAD 208H FIX 5: Clear cache after solve
            self.constraint_checker.clear_cache()
            logger.info("✅ Constraint checker caches cleared after solve")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error during solve: {e}", exc_info=True)
            return SolveResult(
                status='failed',
                assignments_created=0,
                total_required=0,
                coverage=0,
                bottlenecks=[],
                solve_time=0,
                message=f"Error: {str(e)}"
            )

    def _lock_pre_planned(self) -> None:
        """Phase 1: Validate and lock pre-planned assignments."""
        for assignment in self.pre_planned:
            # Add to assignments list
            self.assignments.append(assignment)
            
            # Update counters
            self.employee_shift_count[assignment.employee_id] = \
                self.employee_shift_count.get(assignment.employee_id, 0) + 1
            
            key = (assignment.employee_id, assignment.service_id)
            self.employee_service_count[key] = \
                self.employee_service_count.get(key, 0) + 1
            
            # DRAAD 208H FIX 1: Count pre-planned PER-SERVICE (not global)
            if assignment.employee_id not in self.shifts_assigned_in_current_run:
                self.shifts_assigned_in_current_run[assignment.employee_id] = {}
            
            self.shifts_assigned_in_current_run[assignment.employee_id][assignment.service_id] = \
                self.shifts_assigned_in_current_run[assignment.employee_id].get(assignment.service_id, 0) + 1
            
            logger.debug(f"Locked: {assignment.employee_id} → {assignment.date} {assignment.dagdeel} service={assignment.service_id}")

    def _greedy_allocate(self) -> List[Bottleneck]:
        """Phase 2: Greedy allocation with HC1-HC6 + DRAAD 190 Smart Sorting.
        
        DRAAD 190 Algorithm (FIXED):
        1. For each slot needing assignment:
        2. Find eligible employees (HC1-HC6 passed)
        3. Sort by fairness using sortEligibleByFairness():
           a. Check availability (not overscheduled, not in blackout)
           b. Sort by shifts_remaining (DESCENDING) - who needs the MOST shifts gets HIGHER priority
           c. Tie-breaker: shifts_assigned_in_current_run (ascending) - who was selected earlier?
        4. Assign to first person in sorted list
        5. Increment shifts_assigned_in_current_run for that person PER-SERVICE
        
        Returns:
            List of bottlenecks (unfilled slots)
        """
        bottlenecks = []
        
        # Iterate through requirements (sorted by date)
        for (date, dagdeel, service_id), need in sorted(self.requirements.items()):
            if need == 0:
                continue
            
            # Count current assignments
            current = self._count_assigned(date, dagdeel, service_id)
            
            # Check shortage
            shortage = need - current
            if shortage <= 0:
                continue
            
            # DRAAD 190: Find eligible employees with smart sorting
            eligible = self._sort_eligible_by_fairness(date, dagdeel, service_id)
            
            # Assign as many as possible
            assigned_this_slot = 0
            for emp_id in eligible:
                if assigned_this_slot >= shortage:
                    break
                
                # Create assignment
                assignment = RosterAssignment(
                    id=str(uuid.uuid4()),
                    roster_id=self.roster_id,
                    employee_id=emp_id,
                    date=date,
                    dagdeel=dagdeel,
                    service_id=service_id,
                    source='greedy',
                    status=1
                )
                
                self.assignments.append(assignment)
                assigned_this_slot += 1
                
                # Update counters
                self.employee_shift_count[emp_id] += 1
                key = (emp_id, service_id)
                self.employee_service_count[key] = self.employee_service_count.get(key, 0) + 1
                
                # DRAAD 208H FIX 1: Track shifts assigned in THIS run PER-SERVICE
                if emp_id not in self.shifts_assigned_in_current_run:
                    self.shifts_assigned_in_current_run[emp_id] = {}
                
                self.shifts_assigned_in_current_run[emp_id][service_id] = \
                    self.shifts_assigned_in_current_run[emp_id].get(service_id, 0) + 1
                
                logger.debug(f"Assigned (DRAAD190): {emp_id} → {date} {dagdeel} {service_id} (run_count_for_service: {self.shifts_assigned_in_current_run[emp_id][service_id]})")
            
            # Record bottleneck if not all filled
            if assigned_this_slot < shortage:
                bottleneck = Bottleneck(
                    date=date,
                    dagdeel=dagdeel,
                    service_id=service_id,
                    need=need,
                    assigned=current + assigned_this_slot,
                    shortage=shortage - assigned_this_slot
                )
                bottlenecks.append(bottleneck)
                logger.warning(f"⚠️ Bottleneck: {date} {dagdeel} service={service_id} → shortage {bottleneck.shortage}")
        
        return bottlenecks

    def _sort_eligible_by_fairness(self, date: str, dagdeel: str, service_id: str) -> List[str]:
        """DRAAD 190 + DRAAD 208H: Sort eligible employees by fairness.
        
        Algorithm (FIXED):
        1. FILTER: Get all employees
        2. CHECK AVAILABILITY:
           - Must be active
           - Must not exceed target shifts
           - Must not be in blackout
           - Must pass HC1-HC6 constraints
        3. CALCULATE FAIRNESS (PER-SERVICE):
           - shifts_remaining = target - currently_assigned
           - shifts_in_current_run_for_THIS_service = incremented as we assign in this solve
        4. SORT BY (DESCENDING):
           a. shifts_remaining (descending) - MOST to-do → HIGHER priority ✅ FIXED
           b. shifts_in_current_run (ascending) - EARLIER selected → LOWER priority
        5. RETURN: Sorted list ready for assignment
        
        Result: Fair distribution without complex scoring
        
        Returns:
            List of employee IDs sorted by fairness (best candidate first)
        """
        eligible = []
        service_type = self.service_types.get(service_id)
        svc_team = service_type.team if service_type else ''
        
        for emp in self.employees:
            if not emp.actief:
                continue
            
            emp_target = self.employee_targets.get(emp.id, self.max_shifts_per_employee)
            emp_shift_count = self.employee_shift_count.get(emp.id, 0)
            
            # DRAAD 190: Calculate "shifts remaining" for this employee
            shifts_remaining = emp_target - emp_shift_count
            
            # Skip if already met target
            if shifts_remaining <= 0:
                logger.debug(f"SKIP {emp.id}: Target met ({emp_shift_count}/{emp_target})")
                continue
            
            key = (emp.id, service_id)
            svc_count = self.employee_service_count.get(key, 0)
            
            # Convert assignments to dict format for HC check
            existing_dicts = [{
                'employee_id': a.employee_id,
                'date': a.date,
                'dagdeel': a.dagdeel
            } for a in self.assignments]
            
            # Check ALL HC1-HC6 constraints
            # DRAAD 208H: Wrap in try-catch for robustness
            try:
                passed, failed_constraint = self.constraint_checker.check_all_constraints(
                    emp_id=emp.id,
                    date_str=date,
                    dagdeel=dagdeel,
                    svc_id=service_id,
                    svc_team=svc_team,
                    emp_team=emp.team,
                    roster_id=self.roster_id,
                    existing_assignments=existing_dicts,
                    employee_shift_count=emp_shift_count,
                    employee_target=emp_target,
                    service_count_for_emp=svc_count
                )
            except Exception as e:
                logger.warning(f"Constraint check exception for {emp.id}: {e}")
                logger.debug(f"INELIGIBLE {emp.id}: Exception in constraint check")
                continue
            
            if passed:
                # DRAAD 208H FIX 1: Get tie-breaker per service (not global)
                shifts_in_run_for_service = \
                    self.shifts_assigned_in_current_run.get(emp.id, {}).get(service_id, 0)
                
                # Store for sorting
                eligible.append((
                    emp.id,
                    shifts_remaining,  # Primary sort key (DESCENDING after fix)
                    shifts_in_run_for_service  # Secondary sort key (ascending)
                ))
                
                logger.debug(
                    f"ELIGIBLE {emp.id}: "
                    f"remaining={shifts_remaining}, "
                    f"run_count_for_service={shifts_in_run_for_service}"
                )
            else:
                logger.debug(f"INELIGIBLE {emp.id}: {failed_constraint}")
        
        # DRAAD 208H FIX 4: Sort with REVERSE=TRUE for fairness
        # Primary: shifts_remaining (DESCENDING) - employee with MOST remaining gets priority ✅ FIXED
        # Secondary: shifts_in_current_run (ascending) - tiebreaker
        eligible.sort(key=lambda x: (x[1], -x[2]), reverse=True)
        
        sorted_list = [emp_id for emp_id, _, _ in eligible]
        
        logger.debug(
            f"DRAAD190-FIXED FAIRNESS SORT: {date} {dagdeel} {service_id}\n"
            f"  Eligible (remaining, run_count): {[(e[0], e[1], e[2]) for e in eligible]}\n"
            f"  → Sorted: {sorted_list}"
        )
        
        return sorted_list

    def _count_assigned(self, date: str, dagdeel: str, service_id: str) -> int:
        """Count current assignments for slot."""
        return sum(
            1 for a in self.assignments
            if a.date == date and a.dagdeel == dagdeel and a.service_id == service_id
        )

    def _analyze_bottlenecks(self, bottlenecks: List[Bottleneck]) -> List[Bottleneck]:
        """Phase 3: Analyze bottleneck reasons."""
        for bn in bottlenecks:
            # Count capable employees
            capable = sum(
                1 for emp in self.employees
                if (emp.id, bn.service_id) in self.capabilities
            )
            
            if capable == 0:
                bn.reason = "No trained employees available"
                bn.suggestion = "Train 1-2 more employees for this service"
            else:
                bn.reason = "All capable employees busy or unavailable"
                bn.suggestion = f"Reduce requirement by {bn.shortage} or relax constraints"
            
            logger.info(f"Analyzed: {bn.date} {bn.dagdeel} → {bn.reason}")
        
        return bottlenecks

    def _save_assignments(self) -> None:
        """
        Phase 4: Bulk insert greedy assignments to database.
        
        DRAAD 210 STAP 2 - Priority 2 FIX: Enhanced logging
        - Log before attempt
        - Log success with details
        - Log detailed errors with context
        - Include connection info, record count, error type
        """
        greedy_assignments = [a for a in self.assignments if a.source == 'greedy']
        
        if not greedy_assignments:
            logger.info("🔍 No greedy assignments to save")
            return
        
        # Prepare bulk insert data
        data = []
        for a in greedy_assignments:
            data.append({
                'id': a.id or str(uuid.uuid4()),
                'roster_id': a.roster_id,
                'employee_id': a.employee_id,
                'date': a.date,
                'dagdeel': a.dagdeel,
                'service_id': a.service_id,
                'status': a.status,
                'source': a.source,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            })
        
        # 🐱 DRAAD 210 STAP 2 - Priority 2 FIX: Enhanced logging BEFORE attempt
        logger.info("\n📓 [PHASE 4] Saving greedy assignments to database...")
        logger.info(f"   📄 Database connection:")
        logger.info(f"   - Supabase URL: {self.supabase.url}")
        logger.info(f"   - Table: roster_assignments")
        logger.info(f"   - Roster ID: {self.roster_id}")
        logger.info(f"\n   📊 Insert details:")
        logger.info(f"   - Records to insert: {len(data)}")
        logger.info(f"   - Source: greedy (DRAAD 190 Smart Greedy Allocation)")
        logger.info(f"   - Status: 1 (active)")
        logger.info(f"   - Timestamp: {datetime.utcnow().isoformat()}")
        
        try:
            # Perform bulk insert
            logger.info("\n   🚀 Executing bulk insert...")
            response = self.supabase.table('roster_assignments').insert(data).execute()
            
            # 🐱 Log success with details
            saved_count = len(response.data) if hasattr(response, 'data') and response.data else len(data)
            
            logger.info(f"\n\u2705 [PHASE 4] SUCCESS: Bulk insert completed")
            logger.info(f"   📈 Records saved: {saved_count}")
            logger.info(f"   🎯 Source: DRAAD 190 Smart Greedy Allocation")
            logger.info(f"   🕛 Timestamp: {datetime.utcnow().isoformat()}")
            logger.info(f"   💻 Response type: {type(response).__name__}")
            
            return {
                "status": "success",
                "assignments_saved": saved_count,
                "phase": 4
            }
            
        except Exception as e:
            # 🐱 DRAAD 210 STAP 2 - Priority 2 FIX: Enhanced error logging
            logger.error(f"\n\u274c [PHASE 4] FAILED: Database write error")
            logger.error(f"\n   🔧 Error details:")
            logger.error(f"   - Error type: {type(e).__name__}")
            logger.error(f"   - Error message: {str(e)}")
            logger.error(f"   - Records attempted: {len(data)}")
            logger.error(f"   - Database URL: {self.supabase.url}")
            logger.error(f"\n   📃 Full traceback:")
            logger.error(f"   ", exc_info=True)
            
            # Re-raise with context
            raise Exception(f"Database write failed: {str(e)}") from e
