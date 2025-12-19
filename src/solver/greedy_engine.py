"""Greedy Rostering Engine v2.0 - DRAAD 214 CRITICAL FIX

Status: DRAAD 214 - TOTAL_REQUIRED Calculation Fix
Date: 2025-12-19
Author: Root Cause Analysis & Critical Bug Fix

CRITICAL BUG FIXED:
===================
❌ BUG DRAAD 214: total_required berekening FOUT
   - Probleem: Pre-planned assignments worden MEEGETELD in total_required
   - Gevolg: Coverage wordt absurd hoog (1792%) en frontend crasht
   - Oorzaak: self.assignments bevat ALLE records (pre-planned + greedy)
   - Fix: Gebruik ALLEEN greedy_count voor coverage berekening

✅ FIXED in v2.1:
   - total_required = sum(self.requirements.values()) ✅ CORRECT
   - greedy_assignments = assignments gemaakt DOOR greedy (niet pre-planned)
   - coverage = (greedy_assignments / total_required * 100) ✅ CORRECT
   - result.total_required = total_required ✅ CORRECT
   - result.assignments_created = greedy_count (NIET len(self.assignments)) ✅ CORRECT

DATABASE BASELINE VERIFY:
========================
Table roster_period_staffing_dagdelen:
  - id, dagdeel, team, status, aantal, created_at, updated_at
  - roster_id, service_id, date, invulling
  Total records: ~945 per rooster
  Data: aantal = hoeveel diensten nodig (1-3 meestal)

Table roster_assignments:
  - id, roster_id, employee_id, date, dagdeel, status, service_id
  - source: 'fixed' (pre-planned) of 'greedy' (automatic)
  - Pre-planned counts as baseline, NOT in greedy coverage

All bugs from DRAAD 211 REMAIN FIXED (BUG 1-5).
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, asdict
import os
import uuid

from supabase import create_client, Client

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
    is_system: bool = False


@dataclass
class RosterAssignment:
    """Single roster assignment."""
    employee_id: str
    date: str
    dagdeel: str
    service_id: str
    source: str
    roster_id: str = None
    id: str = None
    status: int = 1


@dataclass
class SolveResult:
    """Result of solve operation."""
    status: str
    assignments_created: int
    total_required: int
    coverage: float
    bottlenecks: List[Dict]
    solve_time: float
    message: str = ""
    pre_planned_count: int = 0
    greedy_count: int = 0


@dataclass
class Bottleneck:
    """Unfilled roster slot (DRAAD 211-FIX: Restored for __init__.py exports)."""
    date: str
    dagdeel: str
    service_id: str
    need: int
    assigned: int
    shortage: int
    reason: Optional[str] = None
    suggestion: Optional[str] = None


@dataclass
class EmployeeCapability:
    """Employee service capability (DRAAD 211-FIX: Restored for __init__.py exports)."""
    employee_id: str
    service_id: str
    aantal: int
    actief: bool


@dataclass
class RosteringRequirement:
    """Staffing requirement for date/dagdeel/service (DRAAD 211-FIX: Restored for __init__.py exports)."""
    id: str
    date: str
    dagdeel: str
    service_id: str
    aantal: int


class GreedyRosteringEngine:
    """
    GREEDY v2.1 - Fair Distribution Greedy Algorithm (DRAAD 214-FIX)
    
    KERNBEGRIP:
    ===========
    GREEDY wijst AUTOMATISCH diensten toe aan medewerkers op basis van:
    1. Team-based availability (team fallback logica)
    2. Per-service quota constraints (NIET globaal!)
    3. Fair load balancing (medewerker met MEESTE remaining voor DEZE SERVICE krijgt prioriteit)
    4. Service pairing validation (DIO/DDO kant-en-klaar pairing)
    5. Status blocking (privé/verlof/geblokkeerd slot respect)
    
    VIJF KRITIEKE BUGS GEREPAREERD (DRAAD 211-214):
    ===============================================
    BUG 1 - GEBLOKKEERDE SLOTS:
    ✅ blocked_slots = Set[(date, dagdeel, employee_id)] (DRAAD 211)
    
    BUG 2 - QUOTA FILTERING:
    ✅ quota_remaining = Dict[(employee_id, service_id)] (DRAAD 211)
    
    BUG 3 - FAIRNESS SORTING:
    ✅ Sort by remaining_for_THIS_service (DESC) (DRAAD 211)
    
    BUG 4-5 - DATACLASS FIELDS:
    ✅ All dataclasses restored with correct fields (DRAAD 211)
    
    BUG 6 (DRAAD 214) - TOTAL_REQUIRED CALCULATION:
    ❌ VORIG: coverage = (len(self.assignments) / total_required * 100)
       → FOUT: self.assignments bevat ALLE records (pre-planned + greedy)
       → Result: 1470/82 = 1792% (absurd)
    
    ✅ NIEUW: coverage = (greedy_count / total_required * 100)
       → CORRECT: Telt ALLEEN greedy assignments
       → Result: correct percentage
    
    IMPLEMENTATIE CHECKLIST:
    ========================
    [ ] blocked_slots: Set[Tuple[date, dagdeel, employee_id]] ✅
    [ ] quota_remaining: Dict[(employee_id, service_id)] ✅
    [ ] Re-read: After each dagdeel completes ✅
    [ ] Fairness: Sort by remaining_for_THIS_service (DESC) ✅
    [ ] Pairing: Validate ALL checks before DIO/DDO ✅
    [ ] Alphabetical: Tie-breaker deterministic ✅
    [ ] Per-service: Quota check <= 0 skip ✅
    [ ] Coverage: Use ONLY greedy_count, NOT total assignments ✅ NEW
    """
    
    # Service Pairing Rules
    SERVICE_PAIRS = {
        'DIO': {'pair_service': 'DIA', 'pair_dagdeel': 'A'},
        'DDO': {'pair_service': 'DDA', 'pair_dagdeel': 'A'},
    }

    def __init__(self, config: Dict):
        """
        Initialize engine with configuration.
        
        Args:
            config: Dictionary with keys:
                - supabase_url: Supabase URL
                - supabase_key: Supabase API key
                - roster_id: Target roster UUID
                - start_date: Roster start date (YYYY-MM-DD)
                - end_date: Roster end date (YYYY-MM-DD)
        """
        self.config = config
        self.roster_id = config.get('roster_id')
        self.start_date = config.get('start_date')
        self.end_date = config.get('end_date')
        self.max_shifts_per_employee = config.get('max_shifts_per_employee', 8)
        
        # Initialize Supabase
        supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
        supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing Supabase credentials")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Data containers
        self.employees: List[Employee] = []
        self.service_types: Dict[str, ServiceType] = {}
        self.capabilities: Dict[Tuple[str, str], int] = {}  # (emp_id, service_id) → required_count
        self.requirements: Dict[Tuple[str, str, str], int] = {}  # (date, dagdeel, service_id) → need
        
        # ✅ BUG 1 FIX: blocked_slots now (date, dagdeel, employee_id)
        self.blocked_slots: Set[Tuple[str, str, str]] = set()
        
        # ✅ BUG 2 FIX: quota_remaining now (employee_id, service_id)
        self.quota_remaining: Dict[Tuple[str, str], int] = {}
        self.quota_original: Dict[Tuple[str, str], int] = {}  # Baseline for re-read
        
        # State during solve
        self.assignments: List[RosterAssignment] = []
        self.pre_planned_count: int = 0
        self.greedy_count: int = 0
        self.greedy_assignments_created: int = 0  # ✅ DRAAD 214: Track ONLY new greedy assignments
        
        logger.info(f"\n✅ GreedyRosteringEngine v2.1 initialized (DRAAD 214-FIX)")
        logger.info(f"   🔧 BUG 1 FIX: blocked_slots as (date, dagdeel, employee_id)")
        logger.info(f"   🔧 BUG 2 FIX: quota_remaining as (employee_id, service_id)")
        logger.info(f"   🔧 BUG 3 FIX: fairness sort by per-service remaining")
        logger.info(f"   🔧 BUG 4-5 FIX: Restored dataclasses + fixed bottleneck fields")
        logger.info(f"   🔧 BUG 6 FIX: coverage uses ONLY greedy_assignments_created")
        
        # Load data
        self._load_data()

    def _load_data(self) -> None:
        """Load all required data from Supabase."""
        logger.info("\n🔄 Loading data from Supabase...")
        
        try:
            self._load_employees()
            logger.info(f"  ✅ Loaded {len(self.employees)} employees")
            
            self._load_service_types()
            logger.info(f"  ✅ Loaded {len(self.service_types)} service types")
            
            self._load_capabilities()
            logger.info(f"  ✅ Loaded {len(self.capabilities)} capability mappings")
            
            self._load_requirements()
            logger.info(f"  ✅ Loaded {len(self.requirements)} requirements")
            
            self._initialize_quota()
            logger.info(f"  ✅ Initialized quota tracking")
            
            self._load_blocked_slots()
            logger.info(f"  ✅ Loaded {len(self.blocked_slots)} blocked slots (date, dagdeel, emp_id)")
            
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
                roostervrijdagen=row.get('roostervrijdagen', [])
            ))

    def _load_service_types(self) -> None:
        """Load service types from database."""
        response = self.supabase.table('service_types').select('*').eq('actief', True).execute()
        
        for row in response.data:
            self.service_types[row['id']] = ServiceType(
                id=row['id'],
                code=row.get('code', ''),
                naam=row.get('naam', ''),
                team=row.get('team', ''),
                actief=row.get('actief', True),
                is_system=row.get('is_system', False)
            )

    def _load_capabilities(self) -> None:
        """Load employee service capabilities."""
        response = self.supabase.table('roster_employee_services').select('*').eq(
            'roster_id', self.roster_id
        ).eq('actief', True).execute()
        
        for row in response.data:
            key = (row['employee_id'], row['service_id'])
            self.capabilities[key] = row.get('aantal', 0)

    def _load_requirements(self) -> None:
        """Load staffing requirements."""
        response = self.supabase.table('roster_period_staffing_dagdelen').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            key = (row['date'], row['dagdeel'], row['service_id'])
            self.requirements[key] = row.get('aantal', 0)

    def _initialize_quota(self) -> None:
        """
        ✅ BUG 2 FIX: Initialize per-service quota.
        
        Structure: quota_remaining[(emp_id, service_id)] = remaining_count
        """
        # Load from roster_employee_services
        for key, required_count in self.capabilities.items():
            self.quota_remaining[key] = required_count
            self.quota_original[key] = required_count
        
        # Subtract existing assignments (status in [1, 2])
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            if row['status'] in [1, 2]:
                key = (row['employee_id'], row['service_id'])
                self.quota_remaining[key] = self.quota_remaining.get(key, 0) - 1

    def _load_blocked_slots(self) -> None:
        """
        ✅ BUG 1 FIX: Load blocked slots as (date, dagdeel, employee_id).
        
        SPEC 3.1: "Greedy moet respecteert alle datums/dagdelen/medewerker met de status>0
                   deze zijn uitgesloten van gebruik door GREEDY"
        
        Only records with status > 0 are blocked.
        """
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            status = row.get('status', 0)
            
            # ✅ FIX 1: Check if status > 0 (not just != 1)
            if status > 0:
                key = (row['date'], row['dagdeel'], row['employee_id'])
                self.blocked_slots.add(key)
                logger.debug(
                    f"BLOCKED: {row['employee_id']} on {row['date']} {row['dagdeel']} "
                    f"(status={status} > 0)"
                )

    def _refresh_from_database(self) -> None:
        """
        RE-READ from database after each dagdeel.
        
        REASON: Database triggers set status=2 after DIO/DDO pairing.
        If we don't re-read, next dagdeel sees stale status=1!
        """
        logger.info("\n🔄 [RE-READ] Refreshing from database after dagdeel...")
        
        # Re-initialize quota
        self.quota_remaining = dict(self.quota_original)
        
        # Subtract existing assignments
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            if row['status'] in [1, 2]:
                key = (row['employee_id'], row['service_id'])
                self.quota_remaining[key] = self.quota_remaining.get(key, 0) - 1
        
        # Re-load blocked slots
        self.blocked_slots = set()
        for row in response.data:
            if row['status'] > 0:
                key = (row['date'], row['dagdeel'], row['employee_id'])
                self.blocked_slots.add(key)
        
        logger.info(f"   ✅ Quota refreshed")
        logger.info(f"   ✅ Blocked slots updated: {len(self.blocked_slots)}")

    def solve(self) -> SolveResult:
        """Execute GREEDY v2.1 algorithm (DRAAD 214-FIX)."""
        start_time = time.time()
        logger.info("\n🚀 [DRAAD 214-FIXED] Starting GREEDY v2.1 solve...")
        logger.info("   ✅ BUG 1 FIX: blocked_slots (date, dagdeel, employee_id)")
        logger.info("   ✅ BUG 2 FIX: quota_remaining (employee_id, service_id)")
        logger.info("   ✅ BUG 3 FIX: fairness sort by per-service remaining")
        logger.info("   ✅ BUG 4-5 FIX: All dataclasses present, bottleneck fields fixed")
        logger.info("   ✅ BUG 6 FIX: coverage = greedy_assignments_created / total_required")
        
        try:
            bottlenecks = []
            
            # Load existing assignments
            response = self.supabase.table('roster_assignments').select('*').eq(
                'roster_id', self.roster_id
            ).execute()
            
            self.assignments = []
            baseline_count = 0  # Count assignments that already existed
            for row in response.data:
                if row.get('source') == 'fixed':
                    self.pre_planned_count += 1
                    baseline_count += 1
                
                self.assignments.append(RosterAssignment(
                    id=row['id'],
                    roster_id=row['roster_id'],
                    employee_id=row['employee_id'],
                    date=row['date'],
                    dagdeel=row['dagdeel'],
                    service_id=row['service_id'],
                    source=row.get('source', 'greedy'),
                    status=row.get('status', 1)
                ))
            
            logger.info(f"📊 Baseline assignments: {baseline_count} (pre-planned)")
            
            # Iterate: Date → Dagdeel → Service
            start_date = datetime.strptime(self.start_date, '%Y-%m-%d')
            end_date = datetime.strptime(self.end_date, '%Y-%m-%d')
            current_date = start_date
            
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                
                # Iterate dagdelen: O → M → A
                for dagdeel in ['O', 'M', 'A']:
                    logger.info(f"\n📅 Processing {date_str} {dagdeel}...")
                    
                    # Get services to plan (sorted by priority)
                    services_to_plan = self._get_services_by_priority(date_str, dagdeel)
                    
                    for service_id, required_count in services_to_plan:
                        # Check if slot is blocked
                        slot_key = (date_str, dagdeel)
                        
                        # Count current assignments
                        assigned_count = sum(
                            1 for a in self.assignments
                            if a.date == date_str and a.dagdeel == dagdeel and a.service_id == service_id
                        )
                        
                        deficit = required_count - assigned_count
                        if deficit <= 0:
                            continue
                        
                        logger.info(f"   📊 {service_id}: need {required_count}, have {assigned_count}, deficit {deficit}")
                        
                        # Find eligible employees
                        eligible = self._find_eligible_employees(date_str, dagdeel, service_id)
                        
                        if not eligible:
                            logger.warning(f"   ❌ BOTTLENECK: No eligible employees for {service_id}")
                            bottlenecks.append({
                                'date': date_str,
                                'dagdeel': dagdeel,
                                'service_id': service_id,
                                'need': required_count,  # ✅ FIX 5: Changed from 'required' to 'need'
                                'assigned': assigned_count,
                                'shortage': deficit,
                                'reason': None,  # ✅ FIX 5: Added
                                'suggestion': None  # ✅ FIX 5: Added
                            })
                            continue
                        
                        # Allocate
                        allocated = 0
                        for emp_id in eligible:
                            if allocated >= deficit:
                                break
                            
                            # Check pairing if needed
                            service_type = self.service_types.get(service_id)
                            service_code = service_type.code if service_type else ''
                            
                            if service_code in self.SERVICE_PAIRS:
                                # Check if pairing can be satisfied
                                pair_info = self.SERVICE_PAIRS[service_code]
                                pair_service_code = pair_info['pair_service']
                                pair_dagdeel = pair_info['pair_dagdeel']
                                
                                # Find pair service ID
                                pair_service_id = None
                                for svc_id, svc_type in self.service_types.items():
                                    if svc_type.code == pair_service_code:
                                        pair_service_id = svc_id
                                        break
                                
                                if not pair_service_id:
                                    continue
                                
                                # Check if employee blocked on pair day
                                pair_blocked_key = (date_str, pair_dagdeel, emp_id)
                                if pair_blocked_key in self.blocked_slots:
                                    continue
                                
                                # Check pair quota
                                pair_quota_key = (emp_id, pair_service_id)
                                if self.quota_remaining.get(pair_quota_key, 0) <= 0:
                                    continue
                                
                                # Check pair capability
                                if (emp_id, pair_service_id) not in self.capabilities:
                                    continue
                                
                                # Assign both
                                self._assign_shift(date_str, dagdeel, emp_id, service_id)
                                self._assign_shift(date_str, pair_dagdeel, emp_id, pair_service_id)
                                
                                allocated += 1
                                logger.info(f"   ✅ Paired: {emp_id} ({service_code} + {pair_service_code})")
                            else:
                                # Normal assignment
                                self._assign_shift(date_str, dagdeel, emp_id, service_id)
                                allocated += 1
                                logger.debug(f"   ✅ Assigned: {emp_id}")
                        
                        if allocated < deficit:
                            bottlenecks.append({
                                'date': date_str,
                                'dagdeel': dagdeel,
                                'service_id': service_id,
                                'need': required_count,  # ✅ FIX 5: Changed from 'required' to 'need'
                                'assigned': assigned_count + allocated,
                                'shortage': deficit - allocated,
                                'reason': None,  # ✅ FIX 5: Added
                                'suggestion': None  # ✅ FIX 5: Added
                            })
                    
                    # ✅ RE-READ after each dagdeel
                    self._refresh_from_database()
                
                current_date += timedelta(days=1)
            
            # Save assignments
            self._save_assignments()
            
            # ✅ DRAAD 214 FIX: Calculate coverage correctly
            # total_required = total diensten die moeten worden ingepland
            # greedy_assignments_created = diensten die DOOR GREEDY zijn ingepland (niet pre-planned)
            total_required = sum(self.requirements.values())
            
            # Coverage is percentage van totale behoefte dat DOOR GREEDY is ingevuld
            coverage = (self.greedy_assignments_created / total_required * 100) if total_required > 0 else 0
            
            elapsed = time.time() - start_time
            
            result = SolveResult(
                status='success' if coverage >= 80 else 'partial',
                assignments_created=self.greedy_assignments_created,  # ✅ ONLY greedy
                total_required=total_required,  # ✅ CORRECT: sum of all requirements
                coverage=round(coverage, 1),  # ✅ CORRECT: greedy/total
                bottlenecks=bottlenecks,
                solve_time=round(elapsed, 2),
                message=f"DRAAD 214-FIXED: {coverage:.1f}% coverage in {elapsed:.2f}s",
                pre_planned_count=self.pre_planned_count,
                greedy_count=self.greedy_assignments_created
            )
            
            logger.info(f"\n✅ Solve complete: {coverage:.1f}% coverage in {elapsed:.2f}s")
            logger.info(f"   📊 Total required: {total_required}")
            logger.info(f"   📊 GREEDY created: {self.greedy_assignments_created}")
            logger.info(f"   📊 Pre-planned: {self.pre_planned_count}")
            logger.info(f"   📊 Bottlenecks: {len(bottlenecks)}")
            logger.info(f"   📊 Coverage: {coverage:.1f}%")
            
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

    def _get_services_by_priority(self, date: str, dagdeel: str) -> List[Tuple[str, int]]:
        """Get services to plan, sorted by priority."""
        services = []
        
        for (d, dd, service_id), required in self.requirements.items():
            if d == date and dd == dagdeel and required > 0:
                service_type = self.service_types.get(service_id)
                
                # Determine priority
                if service_type and service_type.is_system:
                    priority = 0  # System first
                elif service_type and service_type.team == 'TOT':
                    priority = 1  # TOT second
                else:
                    priority = 2  # Others last
                
                services.append((priority, service_type.code if service_type else '', service_id, required))
        
        # Sort by priority, then code
        services.sort(key=lambda x: (x[0], x[1]))
        
        return [(service_id, required) for _, _, service_id, required in services]

    def _find_eligible_employees(self, date: str, dagdeel: str, service_id: str) -> List[str]:
        """
        ✅ BUG 1 + BUG 2 + BUG 3 FIXES:
        Find eligible employees sorted by fairness.
        
        1. Filter by: capability, not blocked, quota available
        2. Sort by: remaining_for_THIS_SERVICE (DESC)
        3. Tie-breaker: alphabetical (deterministic)
        """
        eligible = []
        service_type = self.service_types.get(service_id)
        svc_team = service_type.team if service_type else ''
        
        # Handle TOT special logic
        if svc_team == 'TOT':
            # Priority 1: Permanent staff
            for emp in self.employees:
                if not emp.actief:
                    continue
                if emp.dienstverband not in ['Maat', 'Loondienst']:
                    continue
                
                # Check if capable
                if (emp.id, service_id) not in self.capabilities:
                    continue
                
                # ✅ BUG 1 FIX: Check (date, dagdeel, emp_id) not (date, dagdeel)
                if (date, dagdeel, emp.id) in self.blocked_slots:
                    continue
                
                # ✅ BUG 2 FIX: Check per-service quota
                quota_key = (emp.id, service_id)
                if self.quota_remaining.get(quota_key, 0) <= 0:
                    continue
                
                # ✅ BUG 3 FIX: Calculate remaining for THIS service
                remaining = self.quota_remaining.get(quota_key, 0)
                eligible.append((emp.id, remaining))
            
            if eligible:
                # ✅ BUG 3 FIX: Sort by remaining for THIS service (DESC), then name
                eligible.sort(key=lambda x: (-x[1], x[0]))
                return [emp_id for emp_id, _ in eligible]
            
            # Priority 2: ZZP
            for emp in self.employees:
                if not emp.actief:
                    continue
                if emp.dienstverband != 'ZZP':
                    continue
                
                if (emp.id, service_id) not in self.capabilities:
                    continue
                if (date, dagdeel, emp.id) in self.blocked_slots:
                    continue
                
                quota_key = (emp.id, service_id)
                if self.quota_remaining.get(quota_key, 0) <= 0:
                    continue
                
                remaining = self.quota_remaining.get(quota_key, 0)
                eligible.append((emp.id, remaining))
            
            if eligible:
                eligible.sort(key=lambda x: (-x[1], x[0]))
                return [emp_id for emp_id, _ in eligible]
            
            return []
        
        # Normal team logic
        # Priority 1: Same team
        for emp in self.employees:
            if not emp.actief:
                continue
            if emp.team != svc_team:
                continue
            if (emp.id, service_id) not in self.capabilities:
                continue
            if (date, dagdeel, emp.id) in self.blocked_slots:
                continue
            
            quota_key = (emp.id, service_id)
            if self.quota_remaining.get(quota_key, 0) <= 0:
                continue
            
            remaining = self.quota_remaining.get(quota_key, 0)
            eligible.append((emp.id, remaining))
        
        if eligible:
            eligible.sort(key=lambda x: (-x[1], x[0]))
            return [emp_id for emp_id, _ in eligible]
        
        # Priority 2: Overige team
        for emp in self.employees:
            if not emp.actief:
                continue
            if emp.team != 'Overige':
                continue
            if (emp.id, service_id) not in self.capabilities:
                continue
            if (date, dagdeel, emp.id) in self.blocked_slots:
                continue
            
            quota_key = (emp.id, service_id)
            if self.quota_remaining.get(quota_key, 0) <= 0:
                continue
            
            remaining = self.quota_remaining.get(quota_key, 0)
            eligible.append((emp.id, remaining))
        
        if eligible:
            eligible.sort(key=lambda x: (-x[1], x[0]))
            return [emp_id for emp_id, _ in eligible]
        
        return []

    def _assign_shift(self, date: str, dagdeel: str, emp_id: str, service_id: str) -> None:
        """Assign a shift to an employee. ✅ DRAAD 214: Track ONLY new greedy assignments."""
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
        self.greedy_count += 1
        self.greedy_assignments_created += 1  # ✅ DRAAD 214: Count new assignments
        
        # Update quota
        quota_key = (emp_id, service_id)
        self.quota_remaining[quota_key] = self.quota_remaining.get(quota_key, 0) - 1

    def _save_assignments(self) -> None:
        """Save all assignments to database."""
        if not self.assignments:
            return
        
        logger.info(f"\n💾 Saving {self.greedy_assignments_created} assignments (GREEDY created)...")
        
        data = []
        for a in self.assignments:
            # Only save GREEDY assignments (source='greedy')
            if a.source == 'greedy':
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
        
        if not data:
            logger.info("   ⚠️  No new GREEDY assignments to save")
            return
        
        try:
            response = self.supabase.table('roster_assignments').upsert(data).execute()
            logger.info(f"   ✅ Saved {len(data)} GREEDY assignments")
        except Exception as e:
            logger.error(f"   ❌ Error saving assignments: {e}")
            raise
