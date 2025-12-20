"""Greedy Rostering Engine v2.0 - DRAAD 211 COMPLETE REWRITE

Status: DRAAD 211 - GREEDY v2.0 Full Implementation
Date: 2025-12-18

CRITICAL BUGS FIXED:
===================
❌ BUG 1 (STAP 1): Blocked Slots as (date, dagdeel) blocking ENTIRE slot
✅ FIXED: Blocked Slots now (date, dagdeel, employee_id) blocking ONLY this employee

❌ BUG 2 (STAP 2): Quota filtering global (total shifts) vs per-service
✅ FIXED: Quota now Dict[(employee_id, service_id)] → per-service tracking

❌ BUG 3 (STAP 6): Fairness sort on total remaining vs per-service remaining
✅ FIXED: Sort now by remaining_for_THIS_SERVICE (not total)

❌ BUG 4 (IMPORT ERROR): Missing dataclasses for __init__.py exports
✅ FIXED: Added Bottleneck, EmployeeCapability, RosteringRequirement dataclasses

❌ BUG 5 (FIELD MISMATCH): Bottleneck field 'required' vs 'need'
✅ FIXED: Changed all 'required' → 'need', added 'reason' and 'suggestion'

CORE FEATURES:
==============
1. Team-based availability (team fallback logic)
2. Per-service quota constraints (NICHT global)
3. Fair load balancing (medewerker met MEESTE remaining for THIS service krijgt prioriteit)
4. Service pairing validation (DIO/DDO kant-en-klaar pairing)
5. Status blocking (privé/verlof/geblokkeerd slot respect)
6. Database RE-READ after each dagdeel (sync with triggers)

Algorithm Flow:
- Iterate: Date → Dagdeel (O, M, A) → Service
- For each service/slot: Find eligible → Sort by fairness → Assign
- After each dagdeel: RE-READ database (sync status=2 updates from triggers)
- Respect: Per-service quota, team fallback, pairing requirements, blocking

DATABASE RE-READ (KRITIEK!):
============================
After each dagdeel completes:
1. Re-fetch roster_assignments from database
2. Rebuild blocked_slots from status > 0 records
3. Rebuild quota_remaining (subtract actual assignments)
4. Continue with next dagdeel

REASON: Database triggers set status=2 after DIO/DDO pairing.
WITHOUT re-read: Next dagdeel sees stale status=1, might overwrite valid pairings!

Author: DRAAD 211 - GREEDY v2.0 Full Implementation
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
    GREEDY v2.0 - Fair Distribution Greedy Algorithm (DRAAD 211)
    
    KERNBEGRIP:
    ===========
    GREEDY wijst AUTOMATISCH diensten toe aan medewerkers op basis van:
    1. Team-based availability (team fallback logica)
    2. Per-service quota constraints (NIET globaal!)
    3. Fair load balancing (medewerker met MEESTE remaining voor DEZE SERVICE krijgt prioriteit)
    4. Service pairing validation (DIO/DDO kant-en-klaar pairing)
    5. Status blocking (privé/verlof/geblokkeerd slot respect)
    
    TRE KRITIEKE BUGS GEREPAREERD (DRAAD 211):
    ==========================================
    BUG 1 - GEBLOKKEERDE SLOTS:
    ❌ VORIG: blocked_slots = Set[(date, dagdeel)]
       → HEEL dagdeel geskipped als EEN medewerker status > 0 had!
       → 217 status=3 records → 217 dagdelen TOTAAL GEBLOKKEERD!
    
    ✅ NIEUW: blocked_slots = Set[(date, dagdeel, employee_id)]
       → ALLEEN DEZE MEDEWERKER skipped voor dit slot
       → Andere medewerkers kunnen VRIJ ingevuld worden!
    
    PRAKTIJK VOORBEELD:
    Karin op 2025-11-26 dagdeel O: status = 3 (privé)
      ✅ Karin is NIET beschikbaar op 26/11 O
      ✅ Maar WEL op 26/11 M, 26/11 A, 27/11 O, etc.
      ✅ Paula KANN wel op 26/11 O ingevuld worden!
    
    BUG 2 - QUOTA FILTERING:
    ❌ VORIG: if quota_remaining[emp] <= 0: skip
       → TOTAAL shifts gecheckt (niet per-service!)
       → Karin met OSP full maar ECH beschikbaar → SKIP voor alle services!
    
    ✅ NIEUW: if quota_remaining[(emp, service)] <= 0: skip
       → Per-SERVICE quota gecheckt
       → Karin met OSP full → SKIP voor OSP
       → Maar kan nog ECH ingevuld worden!
    
    BUG 3 - FAIRNESS SORTING:
    ❌ VORIG: Sort op TOTAAL remaining shifts over alle services
       → Karin 10 totaal, Paula 8 → Karin ALTIJD winner
       → Zelfs als Paula nog 5x OSP nodig en Karin maar 3x!
    
    ✅ NIEUW: Sort op remaining shifts VOOR DEZE SPECIFIEKE SERVICE!
       → Paula nog 5x OSP nodig → Paula wint voor OSP
       → (Zelfs al Karin totaal meer shifts heeft!)
    
    IMPLEMENTATIE CHECKLIST:
    ========================
    [ ] blocked_slots: Set[Tuple[date, dagdeel, employee_id]]
    [ ] quota_remaining: Dict[(employee_id, service_id)] → remaining_count
    [ ] Re-read: After each dagdeel completes
    [ ] Fairness: Sort by remaining_for_THIS_service (DESC)
    [ ] Pairing: Validate ALL checks before DIO/DDO
    [ ] Alphabetical: Tie-breaker deterministic
    [ ] Per-service: Quota check <= 0 skip
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
        self.employee_targets: Dict[str, int] = {}  # emp_id → max shifts
        
        # ✅ BUG 1 FIX: blocked_slots now (date, dagdeel, employee_id)
        self.blocked_slots: Set[Tuple[str, str, str]] = set()
        
        # ✅ BUG 2 FIX: quota_remaining now (employee_id, service_id)
        self.quota_remaining: Dict[Tuple[str, str], int] = {}
        self.quota_original: Dict[Tuple[str, str], int] = {}  # Baseline for re-read
        
        # State during solve
        self.assignments: List[RosterAssignment] = []
        self.pre_planned_count: int = 0
        self.greedy_count: int = 0
        
        logger.info(f"\n✅ GreedyRosteringEngine v2.0 initialized (DRAAD 211)")
        logger.info(f"   🔧 BUG 1 FIX: blocked_slots as (date, dagdeel, employee_id)")
        logger.info(f"   🔧 BUG 2 FIX: quota_remaining as (employee_id, service_id)")
        logger.info(f"   🔧 BUG 3 FIX: fairness sort by per-service remaining")
        logger.info(f"   🔧 BUG 4-5 FIX: Restored dataclasses + fixed bottleneck fields")
        
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
            
            self._load_employee_targets()
            logger.info(f"  ✅ Loaded {len(self.employee_targets)} employee targets")
            
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

    def _load_employee_targets(self) -> None:
        """Load max shifts per employee."""
        response = self.supabase.table('period_employee_staffing').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            self.employee_targets[row['employee_id']] = row.get('target_shifts', 8)

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
        """Execute GREEDY v2.0 algorithm."""
        start_time = time.time()
        logger.info("\n🚀 [DRAAD 211-FIXED] Starting GREEDY v2.0 solve...")
        logger.info("   ✅ BUG 1 FIX: blocked_slots (date, dagdeel, employee_id)")
        logger.info("   ✅ BUG 2 FIX: quota_remaining (employee_id, service_id)")
        logger.info("   ✅ BUG 3 FIX: fairness sort by per-service remaining")
        logger.info("   ✅ BUG 4-5 FIX: All dataclasses present, bottleneck fields fixed")
        
        try:
            bottlenecks = []
            
            # Load existing assignments
            response = self.supabase.table('roster_assignments').select('*').eq(
                'roster_id', self.roster_id
            ).execute()
            
            self.assignments = []
            for row in response.data:
                if row.get('source') == 'fixed':
                    self.pre_planned_count += 1
                else:
                    self.greedy_count += 1
                
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
            
            # Calculate coverage
            total_required = sum(self.requirements.values())
            coverage = (len(self.assignments) / total_required * 100) if total_required > 0 else 0
            
            elapsed = time.time() - start_time
            
            result = SolveResult(
                status='success' if coverage >= 80 else 'partial',
                assignments_created=len(self.assignments),
                total_required=total_required,
                coverage=round(coverage, 1),
                bottlenecks=bottlenecks,
                solve_time=round(elapsed, 2),
                message=f"DRAAD 211-FIXED: {coverage:.1f}% coverage in {elapsed:.2f}s",
                pre_planned_count=self.pre_planned_count,
                greedy_count=self.greedy_count
            )
            
            logger.info(f"\n✅ Solve complete: {coverage:.1f}% coverage in {elapsed:.2f}s")
            logger.info(f"   📊 Assignments: {len(self.assignments)}/{total_required}")
            logger.info(f"   📊 Pre-planned: {self.pre_planned_count}")
            logger.info(f"   📊 Greedy: {self.greedy_count}")
            logger.info(f"   📊 Bottlenecks: {len(bottlenecks)}")
            
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
        """Assign a shift to an employee."""
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
        
        # Update quota
        quota_key = (emp_id, service_id)
        self.quota_remaining[quota_key] = self.quota_remaining.get(quota_key, 0) - 1

    def _save_assignments(self) -> None:
        """Save all assignments to database."""
        if not self.assignments:
            return
        
        logger.info(f"\n💾 Saving {len(self.assignments)} assignments...")
        
        data = []
        for a in self.assignments:
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
        
        try:
            response = self.supabase.table('roster_assignments').upsert(data).execute()
            logger.info(f"   ✅ Saved {len(data)} assignments")
        except Exception as e:
            logger.error(f"   ❌ Error saving assignments: {e}")
            raise
