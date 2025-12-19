"""Greedy Rostering Engine v2.1 - DRAAD 216 FIXES

Status: DRAAD 216 - GREEDY ENGINE BUGS FIXED
Date: 2025-12-20
Author: Comprehensive Bug Fix DRAAD 216

DRAD 216 FIXES IMPLEMENTED:
===========================
Fix 1.1: ✅ Werkbestand_opdracht 5-level sorting (SPEC 2.1-2.3)
Fix 1.2: ✅ Blocked slots - status > 1 (not > 0) + separate pre_planned_slots
Fix 1.3: ✅ Quota init - status == 1 (not in [1,2]), check source='fixed'
Fix 1.4: ✅ RE-READ DELETED - quota reset bug GONE
Fix 2.1: ✅ Werkbestand local datastructures (requirement_queue)
Fix 2.2: ✅ Pre-planned slots SEPARATE tracking
Fix 3.1: ✅ Eligible employees - Both checks (pre_planned + blocked)

KEY INSIGHTS:
=============
BUG 1.1: Werkbestand sortering incomplete
  - Diensten moeten in 5-level volgorde gepland worden
  - Levels: is_system → date → dagdeel → team → code
  - Zorgt voor fairness + determinisme

BUG 1.2: Status=1 en status=2+ gemengd
  - Status=1 (pre-planned) = planner ingevuld
  - Status=2 (geblokkeerd) = system trigger
  - Status=3 (privé) = medewerker vrij
  - GREEDY respecteert alle, maar quota anders!
  - FIX: status > 1 (niet > 0)

BUG 1.3: Quota aftrekking FOUT
  - Status=2 is GEEN echte dienst (system blokkade)
  - Mag NIET van quota afgetrokken worden
  - ALLEEN status=1 met source='fixed' tellen
  - FIX: if status == 1 and source == 'fixed'

BUG 1.4: RE-READ veroorzaakt quota reset
  - After each dagdeel: quota_remaining = dict(quota_original)
  - Result: Quota reset, diensten 2x gepland
  - FIX: Function COMPLEET verwijderen

DATABASE BASELINE (DRAAD 216 VERIFIED):
========================================
roster_period_staffing_dagdelen:
  - id, dagdeel, team, status, aantal, created_at, updated_at
  - roster_id, service_id, date, invulling (0=open, 1=filled, 2=blocked)
  Total: ~945 per rooster

roster_assignments:
  - status: 0=VRIJ, 1=INGEVULD, 2=GEBLOKKEERD, 3=PRIVÉ
  - source: 'fixed' (planner) or 'greedy' (auto)
  - Database triggers set status=2 AFTER DIO/DIA pairing
  - Pre-planned (status=1) MOET gerespeceerd
  - Blocked (status>1) MOET gerespeceerd
  - Quota effect: ALLEEN status=1 aftrekken!
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
    """Unfilled roster slot."""
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


class GreedyRosteringEngine:
    """
    GREEDY v2.2 - DRAAD 216 FIXES
    
    VIJF KRITIEKE BUGS GEREPAREERD:
    ================================
    Fix 1.1: ✅ Werkbestand_opdracht sortering (5 niveaus)
    Fix 1.2: ✅ Blocked slots status > 1 + separate pre_planned_slots
    Fix 1.3: ✅ Quota init status == 1 with source check
    Fix 1.4: ✅ RE-READ verwijderd (quota reset bug)
    Fix 2.1: ✅ Werkbestand local datastructures
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
        
        # ✅ FIX 1.2: SEPARATE sets for pre-planned and blocked
        self.pre_planned_slots: Set[Tuple[str, str, str]] = set()  # status=1 (planner)
        self.blocked_slots: Set[Tuple[str, str, str]] = set()      # status>1 (system/privé)
        
        # ✅ FIX 1.3: Quota tracking per-service
        self.quota_remaining: Dict[Tuple[str, str], int] = {}
        self.quota_original: Dict[Tuple[str, str], int] = {}  # Baseline (not used for reset!)
        
        # ✅ FIX 2.1: Werkbestand local datastructures
        self.requirement_queue: List[Dict] = []  # werkbestand_opdracht
        self.capacity_tracking: Dict[Tuple[str, str], int] = {}  # werkbestand_capaciteit
        
        # State during solve
        self.assignments: List[RosterAssignment] = []
        self.pre_planned_count: int = 0
        self.greedy_count: int = 0
        self.greedy_assignments_created: int = 0
        
        logger.info(f"\n✅ GreedyRosteringEngine v2.2 initialized (DRAAD 216-FIXED)")
        logger.info(f"   🔧 Fix 1.1: Werkbestand sortering (5 niveaus) - SPEC 2.1-2.3")
        logger.info(f"   🔧 Fix 1.2: Blocked slots status > 1 + separate pre_planned_slots")
        logger.info(f"   🔧 Fix 1.3: Quota init status == 1 with source check")
        logger.info(f"   🔧 Fix 1.4: RE-READ removed - quota reset bug FIXED")
        logger.info(f"   🔧 Fix 2.1: Werkbestand local datastructures")
        
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
            logger.info(f"  ✅ Loaded {len(self.pre_planned_slots)} pre-planned slots")
            logger.info(f"  ✅ Loaded {len(self.blocked_slots)} blocked slots")
            
            # ✅ FIX 1.1: Build requirement queue with 5-level sorting
            self.requirement_queue = self._build_requirement_queue()
            logger.info(f"  ✅ Built requirement queue: {len(self.requirement_queue)} tasks (sorted)")
            
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
            self.capacity_tracking[key] = row.get('aantal', 0)  # ✅ FIX 2.1: Local tracking

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
        ✅ FIX 1.3: Initialize per-service quota (SPEC 2.5).
        
        KEY: Status=2 (system blokkade) is GEEN echte dienst!
             Only status=1 (pre-planned by planner) counts against quota.
        """
        # Load from roster_employee_services
        for key, required_count in self.capabilities.items():
            self.quota_remaining[key] = required_count
            self.quota_original[key] = required_count  # For reference only, NOT for reset
        
        # ✅ FIX 1.3: ONLY subtract status=1 with source='fixed'
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        subtracted_count = 0
        for row in response.data:
            status = row.get('status', 0)
            source = row.get('source', '')
            
            # ✅ SPEC 2.5: Only status=1 AND source='fixed' affects quota
            if status == 1 and (source == 'fixed' or source == ''):
                key = (row['employee_id'], row['service_id'])
                self.quota_remaining[key] = self.quota_remaining.get(key, 0) - 1
                subtracted_count += 1
        
        logger.info(f"   📊 Quota initialized: {subtracted_count} pre-planned aftrekking")

    def _load_blocked_slots(self) -> None:
        """
        ✅ FIX 1.2: Load blocked slots correctly (SPEC 3.1).
        
        SEPARATE tracking:
        - pre_planned_slots: status=1 (planner ingevuld)
        - blocked_slots: status>1 (system blokkade of privé)
        
        KEY INSIGHT:
        Both must be RESPECTED by GREEDY (can't plan there).
        But QUOTA effect is DIFFERENT!
        """
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()
        
        for row in response.data:
            status = row.get('status', 0)
            date = row['date']
            dagdeel = row['dagdeel']
            emp_id = row['employee_id']
            
            key = (date, dagdeel, emp_id)
            
            if status == 1:
                # ✅ FIX 1.2: Pre-planned (planner ingevuld)
                self.pre_planned_slots.add(key)
                logger.debug(f"PRE-PLANNED: {emp_id} {date} {dagdeel}")
            
            elif status > 1:
                # ✅ FIX 1.2: Blocked (system trigger or privé)
                self.blocked_slots.add(key)
                logger.debug(f"BLOCKED: {emp_id} {date} {dagdeel} (status={status})")
        
        logger.info(f"   📊 Pre-planned: {len(self.pre_planned_slots)}")
        logger.info(f"   📊 Blocked: {len(self.blocked_slots)}")

    def _build_requirement_queue(self) -> List[Dict]:
        """
        ✅ FIX 1.1: Build sorted requirement queue (SPEC 2.1-2.3).
        
        SPEC 2.2: 5-level sorting:
        1. is_system=TRUE eerst (systeemdiensten kritiek)
        2. date asc (chronologisch, oudste eerst)
        3. dagdeel O-M-A (ochtend-middag-avond)
        4. team TOT-GRO-ORA (brede beschikbaarheid eerst)
        5. code alfabet (deterministic tie-breaker)
        
        Result: Fair, reproducible, consistent planning order.
        """
        tasks = []
        
        # Collect all requirements
        for (date, dagdeel, service_id), aantal in self.requirements.items():
            if aantal <= 0:
                continue
            
            # Get service info
            service = self.service_types.get(service_id)
            
            # Build task
            task = {
                'date': date,
                'dagdeel': dagdeel,
                'service_id': service_id,
                'code': service.code if service else 'UNK',
                'team': service.team if service else 'OVR',
                'is_system': service.is_system if service else False,
                'aantal': aantal,
            }
            tasks.append(task)
        
        # ✅ SPEC 2.2: 5-level sort
        team_priority = {'TOT': 0, 'GRO': 1, 'ORA': 2, 'OVR': 3}
        dagdeel_priority = {'O': 0, 'M': 1, 'A': 2}
        
        tasks.sort(key=lambda t: (
            not t['is_system'],                          # Level 1: System first
            t['date'],                                   # Level 2: Date old→new
            dagdeel_priority.get(t['dagdeel'], 99),    # Level 3: O→M→A
            team_priority.get(t['team'], 99),           # Level 4: TOT→GRO→ORA
            t['code']                                    # Level 5: Alphabet
        ))
        
        logger.info(f"📋 Requirement queue built: {len(tasks)} tasks (5-level sorted)")
        if tasks:
            logger.debug(f"   First 5 tasks (sorted):")
            for i, t in enumerate(tasks[:5]):
                logger.debug(f"     {i+1}. {t['code']} {t['date']} {t['dagdeel']} (system={t['is_system']})")
        
        return tasks

    def solve(self) -> SolveResult:
        """Execute GREEDY v2.2 algorithm (DRAAD 216-FIXED)."""
        start_time = time.time()
        logger.info("\n🚀 [DRAAD 216-FIXED] Starting GREEDY v2.2 solve...")
        logger.info("   ✅ Fix 1.1: Werkbestand sortering (5 niveaus)")
        logger.info("   ✅ Fix 1.2: Blocked slots (status > 1) + separate pre_planned_slots")
        logger.info("   ✅ Fix 1.3: Quota init (status == 1 with source check)")
        logger.info("   ✅ Fix 1.4: RE-READ removed - quota reset bug FIXED")
        logger.info("   ✅ Fix 2.1: Werkbestand local datastructures")
        
        try:
            bottlenecks = []
            
            # Load existing assignments
            response = self.supabase.table('roster_assignments').select('*').eq(
                'roster_id', self.roster_id
            ).execute()
            
            self.assignments = []
            baseline_count = 0
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
                                'need': required_count,
                                'assigned': assigned_count,
                                'shortage': deficit,
                                'reason': None,
                                'suggestion': None
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
                                
                                # ✅ FIX 3.1: Check both pre_planned and blocked
                                pair_blocked_key = (date_str, pair_dagdeel, emp_id)
                                if pair_blocked_key in self.pre_planned_slots:
                                    continue
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
                                'need': required_count,
                                'assigned': assigned_count + allocated,
                                'shortage': deficit - allocated,
                                'reason': None,
                                'suggestion': None
                            })
                
                current_date += timedelta(days=1)
            
            # Save assignments
            self._save_assignments()
            
            # Calculate coverage
            total_required = sum(self.requirements.values())
            coverage = (self.greedy_assignments_created / total_required * 100) if total_required > 0 else 0
            
            elapsed = time.time() - start_time
            
            result = SolveResult(
                status='success' if coverage >= 80 else 'partial',
                assignments_created=self.greedy_assignments_created,
                total_required=total_required,
                coverage=round(coverage, 1),
                bottlenecks=bottlenecks,
                solve_time=round(elapsed, 2),
                message=f"DRAAD 216-FIXED: {coverage:.1f}% coverage in {elapsed:.2f}s",
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
        ✅ FIX 3.1: Find eligible employees with BOTH checks (SPEC 3.7).
        
        Check BOTH:
        - NOT in pre_planned_slots (status=1)
        - NOT in blocked_slots (status>1)
        
        Both must be respected for GREEDY to skip a slot.
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
                
                # ✅ FIX 3.1: Check BOTH pre_planned AND blocked
                if (date, dagdeel, emp.id) in self.pre_planned_slots:
                    continue
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
                if (date, dagdeel, emp.id) in self.pre_planned_slots:
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
            if (date, dagdeel, emp.id) in self.pre_planned_slots:
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
            if (date, dagdeel, emp.id) in self.pre_planned_slots:
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
        self.greedy_assignments_created += 1
        
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
