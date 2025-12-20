"""Greedy Rostering Engine v2.0 - DRAAD 221 DIAGNOSTICS (FASE 1)

Status: FASE 1 DIAGNOSTICS - QUOTA INITIALIZATION ANALYSIS
Date: 2025-12-20

FASE 1 OBJECTIVE (DRAAD 221):
=============================
Add extensive diagnostics to _initialize_quota() to identify:
1. How many capabilities are loaded
2. Status field TYPE (integer vs string)
3. Skip reasons during quota subtraction
4. Final quota distribution

CRITICAL FIX (DRAAD 220):
========================
❌ BUG: _load_employee_targets() queried non-existent table 'period_employee_staffing'
✅ FIX: Use correct table 'roster_employee_services' per actual database schema
✅ NEW: _validate_schema() method for early database validation
✅ NEW: Enhanced logging in _load_employee_targets()

CRITICAL BUGS FIXED (DRAAD 211):
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

NEW FEATURES (DRAAD 218C):
==========================
✅ DIO/DIA Pairing: DIO (dagstart ochtend) auto-pairs with DIA (dagstart avond)
✅ DDO/DDA Pairing: DDO (dagsluit ochtend) auto-pairs with DDA (dagsluit avond)
✅ Pairing Validation: Checks employee availability, quota, capability for BOTH services
✅ Blocking Rules: Auto-blocks conflicting slots per spec 3.7.1 and 3.7.2
✅ End-Date Boundary: No next-day blocks when date = end_date

NEW FEATURES (DRAAD 219B):
==========================
✅ Shortage Reason Analysis: Intelligent categorization why slot couldn't be filled
✅ Shortage Suggestion: Actionable suggestions for resolution
✅ Category 1: No eligible employees (quota exhausted, all blocked, etc.)
✅ Category 2: Partial fill (some but not all positions filled)
✅ Category 3: Pairing failure (DIO/DIA pairing requirements not met)
✅ All messages in Dutch (customer language)

CORE FEATURES:
==============
1. Team-based availability (team fallback logic)
2. Per-service quota constraints (NICHT global)
3. Fair load balancing (medewerker met MEESTE remaining for THIS service krijgt prioriteit)
4. Service pairing validation (DIO/DDO ↔ DIA/DDA pairing)
5. Status blocking (privé/verlof/geblokkeerd slot respect)
6. Database RE-READ after each dagdeel (sync with triggers)
7. Pairing auto-assignment with recursive flagging to prevent loops
8. Intelligent shortage analysis (DRAAD 219B NEW)
9. Database schema validation at startup (DRAAD 220 NEW)
10. Extensive diagnostics in _initialize_quota (DRAAD 221 FASE 1 NEW)

Algorithm Flow:
- Iterate: Date → Dagdeel (O, M, A) → Service
- For each service/slot: Find eligible → Sort by fairness → Assign
- After assignment of DIO/DDO: Auto-assign pair (DIA/DDA) if possible
- After each dagdeel: RE-READ database (sync status=2 updates from triggers + pairing)
- Respect: Per-service quota, team fallback, pairing requirements, blocking
- For unfilled slots: Analyze reason and suggest solution (DRAAD 219B NEW)

DATABASE RE-READ (KRITIEK!):
============================
After each dagdeel completes:
1. Re-fetch roster_assignments from database
2. Rebuild blocked_slots from status > 0 records
3. Rebuild quota_remaining (subtract actual assignments)
4. Continue with next dagdeel

REASON: Database triggers set status=2 after DIO/DDO pairing.
WITHOUT re-read: Next dagdeel sees stale status=1, might overwrite valid pairings!

PAIRING LOGIC FLOW:
===================
1. When assigning DIO/DDO with auto_pair=True:
   a) Find pair service ID (DIA/DDA)
   b) Call _can_pair() to validate:
      - Employee available on pair dagdeel (not in blocked_slots)
      - Employee has quota for pair service (> 0)
      - Employee capable for pair service (in capabilities)
      - Pair dagdeel has requirement (not disabled)
      - Not end-date boundary (date < end_date for next-day pairs)
   c) If all checks pass: Recursively assign pair with auto_pair=False
   d) This prevents infinite recursion (pair won't try to pair again)

2. Blocking rules applied in _refresh_from_database():
   - DIO blocks: Same day M (status=2), same day A reserved for DIA
   - DIA blocks: Next day O,M (status=2) if not end_date
   - DDO blocks: Same day M (status=2), same day A reserved for DDA  
   - DDA blocks: Next day O,M (status=2) if not end_date

SHORTAGE ANALYSIS (DRAAD 219B):
================================
When a slot cannot be fully filled, analyze WHY:

1. No Eligible Employees:
   - All quota exhausted for this service
   - All employees blocked (absent/verlof/privé)
   - No employees with this service capability
   
   Reason: "Geen medewerkers beschikbaar"
   Suggestion: "Voeg medewerker toe met capability" OR "Verhoog quota"

2. Partial Fill:
   - Some but not all positions filled
   - Quota limits reached before deficit covered
   - Pairing requirements partially satisfied
   
   Reason: "Onvoldoende beschikbare medewerkers"
   Suggestion: "Verhoog quota voor medewerkers"

3. Pairing Failure:
   - Employee available for DIO but NOT for DIA
   - Quota available for DIO but NOT for DIA
   - Next day blocked for DIA
   
   Reason: "Pairing-vereiste kan niet vervuld"
   Suggestion: "Check quota en beschikbaarheid volgende dag"

Author: DRAAD 221 FASE 1 DIAGNOSTICS on DRAAD 220 SCHEMA FIX on DRAAD 219B on DRAAD 218C + DRAAD 211 v2.0 Base
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
    GREEDY v2.0 + DRAAD 218C + DRAAD 219B + DRAAD 220 + DRAAD 221 FASE 1 - Fair Distribution Greedy Algorithm with DIO/DDA Pairing + Shortage Analysis + Schema Validation + Diagnostics
    
    KERNBEGRIP:
    ===========
    GREEDY wijst AUTOMATISCH diensten toe aan medewerkers op basis van:
    1. Team-based availability (team fallback logica)
    2. Per-service quota constraints (NIET globaal!)
    3. Fair load balancing (medewerker met MEESTE remaining voor DEZE SERVICE krijgt prioriteit)
    4. Service pairing validation (DIO/DDO ↔ DIA/DDA auto-pairing)
    5. Status blocking (privé/verlof/geblokkeerd slot respect)
    6. Intelligent shortage analysis (DRAAD 219B NEW)
    7. Database schema validation (DRAAD 220 NEW)
    8. Extensive diagnostics in _initialize_quota (DRAAD 221 FASE 1 NEW)
    
    TRE KRITIEKE BUGS GEREPAREERD (DRAAD 211):
    ==========================================
    BUG 1 - GEBLOKKEERDE SLOTS:
    ❌ VORIG: blocked_slots = Set[(date, dagdeel)]
       → HEEL dagdeel geskipped als EEN medewerker status > 0 had!
       → 217 status=3 records → 217 dagdelen TOTAAL GEBLOKKEERD!
    
    ✅ NIEUW: blocked_slots = Set[(date, dagdeel, employee_id)]
       → ALLEEN DEZE MEDEWERKER skipped voor dit slot
       → Andere medewerkers kunnen VRIJ ingevuld worden!
    
    BUG 2 - QUOTA FILTERING:
    ❌ VORIG: if quota_remaining[emp] <= 0: skip
       → TOTAAL shifts gecheckt (niet per-service!)
    
    ✅ NIEUW: if quota_remaining[(emp, service)] <= 0: skip
       → Per-SERVICE quota gecheckt
    
    BUG 3 - FAIRNESS SORTING:
    ❌ VORIG: Sort op TOTAAL remaining shifts over alle services
    ✅ NIEUW: Sort op remaining shifts VOOR DEZE SPECIFIEKE SERVICE!
    
    PAIRING ADDITIONS (DRAAD 218C):
    ===============================
    ✅ DIO/DIA: When DIO assigned, auto-assign DIA same day if possible
    ✅ DDO/DDA: When DDO assigned, auto-assign DDA same day if possible
    ✅ Validation: Check availability, quota, capability for BOTH services
    ✅ Blocking: Apply spec 3.7.1/3.7.2 blocking rules after pairing
    ✅ Recursion guard: Use auto_pair=False on recursive call to prevent loops
    
    SHORTAGE ANALYSIS (DRAAD 219B):
    ===============================
    ✅ Intelligent reason categorization (no eligible, quota, blocking, pairing)
    ✅ Actionable suggestions (Dutch language)
    ✅ Per-bottleneck analysis without extra queries
    ✅ Performance optimized
    
    DATABASE SCHEMA FIX (DRAAD 220):
    ================================
    ✅ Corrected table name in _load_employee_targets()
    ✅ Added _validate_schema() for early validation
    ✅ Enhanced logging for debugging
    
    DIAGNOSTICS (DRAAD 221 FASE 1):
    ===============================
    ✅ Extensive logging in _initialize_quota()
    ✅ Check status field TYPE (integer vs string)
    ✅ Track skip reasons (NULL service_id, no capability, etc.)
    ✅ Report final quota distribution
    """
    
    # Service Pairing Rules (DRAAD 218C NEW)
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
        
        logger.info(f"\n✅ GreedyRosteringEngine v2.0 + DRAAD 221 FASE 1 DIAGNOSTICS initialized")
        logger.info(f"   🔧 BUG 1 FIX: blocked_slots as (date, dagdeel, employee_id)")
        logger.info(f"   🔧 BUG 2 FIX: quota_remaining as (employee_id, service_id)")
        logger.info(f"   🔧 BUG 3 FIX: fairness sort by per-service remaining")
        logger.info(f"   🔧 BUG 4-5 FIX: Restored dataclasses + fixed bottleneck fields")
        logger.info(f"   ✨ DRAAD 218C: DIO/DIA + DDO/DDA pairing with validation")
        logger.info(f"   ✨ DRAAD 219B: Intelligent shortage reason/suggestion analysis")
        logger.info(f"   ✨ DRAAD 220: Database schema validation + corrected table names")
        logger.info(f"   ✨ DRAAD 221 FASE 1: Extensive diagnostics in _initialize_quota()")
        
        # DRAAD 220: Validate schema before loading data
        self._validate_schema()
        
        # Load data
        self._load_data()

    def _validate_schema(self) -> None:
        """
        DRAAD 220 NEW: Validate that all required database tables exist.
        
        This provides early failure with clear error messages if database schema
        is incorrect or tables are missing.
        
        Raises:
            ValueError: If any required table is not found
        """
        required_tables = [
            "roosters",
            "roster_assignments", 
            "roster_employee_services",
            "roster_period_staffing_dagdelen",
            "employees",
            "service_types"
        ]
        
        logger.info("\n🔍 [DRAAD 220] Validating database schema...")
        
        errors = []
        for table_name in required_tables:
            try:
                # Test query to check table existence
                result = self.supabase.table(table_name).select("id").limit(1).execute()
                logger.info(f"   ✅ Table '{table_name}' exists and accessible")
            except Exception as e:
                error_msg = f"Table '{table_name}' NOT FOUND or not accessible: {str(e)}"
                logger.error(f"   ❌ {error_msg}")
                errors.append(error_msg)
        
        if errors:
            error_summary = "\n".join(errors)
            raise ValueError(
                f"[DRAAD 220] Database schema validation FAILED:\n{error_summary}\n\n"
                f"Required tables: {', '.join(required_tables)}"
            )
        
        logger.info(f"   ✅ [DRAAD 220] All {len(required_tables)} required tables validated successfully")

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
            logger.info(f"  ✅ Initialized quota tracking with DIAGNOSTICS (DRAAD 221 FASE 1)")
            
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
        """
        DRAAD 220 FIX: Load employee service targets from roster_employee_services.
        
        This was previously querying non-existent table 'period_employee_staffing'.
        Now uses correct table 'roster_employee_services' per actual database schema.
        
        Enhanced with detailed logging for debugging.
        """
        logger.info(f"\n📊 [DRAAD 220] Loading employee targets for roster_id={self.roster_id}")
        logger.info(f"   Table: roster_employee_services")
        
        try:
            # ✅ DRAAD 220 FIX: Use correct table name
            response = self.supabase.table('roster_employee_services').select(
                'employee_id, service_id, aantal, actief'
            ).eq(
                'roster_id', self.roster_id
            ).eq(
                'actief', True
            ).execute()
            
            logger.info(f"   ✅ [DRAAD 220] Loaded {len(response.data)} employee service records")
            
            # Process targets
            # Note: employee_targets stores per-employee total, but actual quota is per-service
            # This is used as a baseline/reference
            for row in response.data:
                emp_id = row['employee_id']
                aantal = row.get('aantal', 0)
                
                # Accumulate total for employee (across all services)
                self.employee_targets[emp_id] = self.employee_targets.get(emp_id, 0) + aantal
            
            logger.info(f"   ✅ [DRAAD 220] Processed targets for {len(self.employee_targets)} employees")
            
            # Log summary
            if self.employee_targets:
                total_capacity = sum(self.employee_targets.values())
                avg_capacity = total_capacity / len(self.employee_targets)
                logger.info(f"   📊 Total capacity: {total_capacity} shifts")
                logger.info(f"   📊 Average per employee: {avg_capacity:.1f} shifts")
            else:
                logger.warning(f"   ⚠️  No employee targets loaded - check roster_employee_services data")
            
        except Exception as e:
            logger.error(f"   ❌ [DRAAD 220] Failed to load employee targets: {e}")
            logger.error(f"   💡 Verify that roster_employee_services table exists and has data for roster_id={self.roster_id}")
            raise

    def _initialize_quota(self) -> None:
        """
        ✅ DRAAD 221 FASE 1: Initialize per-service quota WITH EXTENSIVE DIAGNOSTICS.
        
        Structure: quota_remaining[(emp_id, service_id)] = remaining_count
        
        This method now includes comprehensive logging to identify why quota
        becomes zero/negative during initialization.
        """
        logger.info("\n" + "="*80)
        logger.info("🔍 [DRAAD 221 FASE 1] QUOTA INITIALIZATION START WITH DIAGNOSTICS")
        logger.info("="*80)

        # Check 1: Capabilities loaded?
        if not self.capabilities:
            logger.error("❌ FATAL: self.capabilities is EMPTY!")
            raise ValueError("No capabilities loaded")

        logger.info(f"\n✅ Capabilities loaded: {len(self.capabilities)} entries")
        logger.info(f"   Total capacity: {sum(self.capabilities.values())} shifts")

        # Initialize from capabilities
        for key, aantal in self.capabilities.items():
            self.quota_remaining[key] = aantal
            self.quota_original[key] = aantal

        logger.info(f"\n✅ Initial quota set: {len(self.quota_remaining)} entries")
        logger.info(f"   Total: {sum(self.quota_remaining.values())} shifts")

        # Load assignments
        logger.info(f"\n📥 Loading roster_assignments...")
        response = self.supabase.table('roster_assignments').select('*').eq(
            'roster_id', self.roster_id
        ).execute()

        logger.info(f"   ✅ Loaded {len(response.data)} roster_assignments")

        # CRITICAL: Check status types (DRAAD 221 FASE 1 NEW)
        logger.info(f"\n🔍 [DRAAD 221 FASE 1] Analyzing status field TYPE...")
        status_types = {}
        status_counts = {}
        
        for row in response.data:
            status = row.get('status', 0)
            status_type = type(status).__name__
            status_types[status_type] = status_types.get(status_type, 0) + 1
            status_counts[status] = status_counts.get(status, 0) + 1

        logger.info(f"\n   📊 Status FIELD TYPE distribution:")
        for stype, count in status_types.items():
            logger.info(f"      {stype}: {count} records")

        logger.info(f"\n   📊 Status VALUE distribution:")
        for sval in sorted(status_counts.keys(), key=lambda x: (isinstance(x, str), x)):
            logger.info(f"      status={repr(sval)}: {status_counts[sval]} records")

        # Subtract assignments (DRAAD 221 FASE 1: WITH EXTENSIVE TRACKING)
        logger.info(f"\n📊 [DRAAD 221 FASE 1] Subtracting existing assignments...")
        
        subtracted = 0
        skipped_null_service = 0
        skipped_no_capability = 0
        skipped_wrong_status_type = 0
        skipped_status_not_eligible = 0

        for row in response.data:
            status = row.get('status', 0)

            # ✅ DRAAD 221 FASE 1: Force integer conversion with logging
            if not isinstance(status, int):
                logger.warning(f"   ⚠️  Status field is {type(status).__name__}: {repr(status)}")
                try:
                    status = int(status)
                except (ValueError, TypeError):
                    skipped_wrong_status_type += 1
                    logger.debug(f"      Cannot convert to int, skipping this record")
                    continue

            # ✅ PHASE 1: Check if status is eligible for subtraction
            if status not in [1, 2]:
                skipped_status_not_eligible += 1
                logger.debug(f"      status={status} not in [1,2], skipping")
                continue

            service_id = row.get('service_id')

            # ✅ BUG FIX (DRAAD 221 FASE 1): Skip if service_id is NULL
            if service_id is None:
                skipped_null_service += 1
                logger.debug(f"      NULL service_id detected (status={status}), SKIPPING")
                continue

            emp_id = row['employee_id']
            key = (emp_id, service_id)

            # ✅ BUG FIX: Skip if no capability
            if key not in self.quota_remaining:
                skipped_no_capability += 1
                logger.debug(
                    f"      Assignment without capability: "
                    f"emp={emp_id[-8:]} service={service_id[-8:]}, SKIPPING"
                )
                continue

            # Subtract
            old = self.quota_remaining[key]
            self.quota_remaining[key] = old - 1
            subtracted += 1

            if self.quota_remaining[key] < 0:
                logger.warning(
                    f"   ⚠️  NEGATIVE QUOTA after subtraction: emp={emp_id[-8:]} "
                    f"service={service_id[-8:]} quota {old} → {self.quota_remaining[key]}"
                )

        logger.info(f"\n📊 [DRAAD 221 FASE 1] Subtraction Summary:")
        logger.info(f"   ✅ Successfully subtracted: {subtracted}")
        logger.info(f"   ⚠️  Skipped NULL service_id: {skipped_null_service}")
        logger.info(f"   ⚠️  Skipped no capability: {skipped_no_capability}")
        logger.info(f"   ⚠️  Skipped wrong type: {skipped_wrong_status_type}")
        logger.info(f"   ⚠️  Skipped status not in [1,2]: {skipped_status_not_eligible}")

        # Final state (DRAAD 221 FASE 1: COMPREHENSIVE REPORT)
        final_total = sum(self.quota_remaining.values())
        positive = sum(1 for v in self.quota_remaining.values() if v > 0)
        zero = sum(1 for v in self.quota_remaining.values() if v == 0)
        negative = sum(1 for v in self.quota_remaining.values() if v < 0)

        logger.info(f"\n📊 [DRAAD 221 FASE 1] FINAL QUOTA STATE:")
        logger.info(f"   Total remaining: {final_total} shifts")
        logger.info(f"   ✅ Positive (>0): {positive} entries")
        logger.info(f"   ⚠️  Zero (=0): {zero} entries")
        logger.info(f"   ❌ Negative (<0): {negative} entries")

        # Health check
        if positive == 0:
            logger.error("\n" + "="*80)
            logger.error("❌ [DRAAD 221 FASE 1] FATAL: NO positive quota remaining!")
            logger.error("="*80)
            logger.error("\nDIAGNOSIS:")
            logger.error(f"  - Started with: {sum(self.quota_original.values())} total shifts")
            logger.error(f"  - Subtracted: {subtracted} assignments")
            logger.error(f"  - Skipped NULL service_id: {skipped_null_service}")
            logger.error(f"  - Skipped no capability: {skipped_no_capability}")
            logger.error(f"\nPOSSIBLE CAUSES:")
            if skipped_null_service > 50:
                logger.error(f"  ❌ TOO MANY NULL service_id records ({skipped_null_service})")
                logger.error(f"     → These are likely status=2 blocked slots from DB triggers")
                logger.error(f"     → Need to SKIP them instead of subtracting!")
            if skipped_no_capability > 20:
                logger.error(f"  ❌ TOO MANY records without capability ({skipped_no_capability})")
                logger.error(f"     → Assignments for services employees don't have?")
            raise ValueError("All quota <= 0 after initialization - CANNOT PROCEED")

        logger.info("\n" + "="*80)
        logger.info(f"✅ [DRAAD 221 FASE 1] QUOTA INITIALIZATION COMPLETE - {positive} eligible (emp, service) pairs")
        logger.info("="*80 + "\n")

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

    def _get_pair_service(self, service_code: str) -> Optional[Tuple[str, str]]:
        """
        DRAAD 218C NEW: Get pair service for a given service code.
        
        Args:
            service_code: Service code (e.g., 'DIO', 'DDO')
        
        Returns:
            Tuple of (pair_service_code, pair_dagdeel) or None if no pair
        
        Logic:
            DIO → (DIA, A)
            DDO → (DDA, A)
            Others → None (no pairing)
        """
        if service_code == 'DIO':
            return ('DIA', 'A')
        elif service_code == 'DDO':
            return ('DDA', 'A')
        else:
            return None

    def _can_pair(
        self,
        date: str,
        dagdeel: str,
        emp_id: str,
        service_id: str
    ) -> bool:
        """
        DRAAD 218C NEW: Check if employee CAN be paired for this service.
        
        Args:
            date: Date (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
            emp_id: Employee ID
            service_id: Service ID
        
        Returns:
            True if ALL validation checks pass, else False
        
        Validations:
            1. Is employee available on PAIR dagdeel? (not in blocked_slots)
            2. Heeft employee QUOTA voor PAIR service? (> 0)
            3. Heeft employee CAPABILITY voor PAIR service? (in capabilities)
            4. Is PAIR dagdeel beschikbaar? (requirement voor die dag/dagdeel)
            5. End-date check: if date = end_date, don't pair with next day
        """
        service_type = self.service_types.get(service_id)
        if not service_type:
            logger.warning(f"⚠️ Service {service_id} not found")
            return False
        
        service_code = service_type.code
        pair_info = self._get_pair_service(service_code)
        
        if not pair_info:
            # Not a pairing service
            return False
        
        pair_service_code, pair_dagdeel = pair_info
        
        # Find pair service ID
        pair_service_id = None
        for svc_id, svc_type in self.service_types.items():
            if svc_type.code == pair_service_code:
                pair_service_id = svc_id
                break
        
        if not pair_service_id:
            logger.warning(f"⚠️ Pair service {pair_service_code} not found")
            return False
        
        # Validation 1: Check if employee available on pair dagdeel
        blocked_key = (date, pair_dagdeel, emp_id)
        if blocked_key in self.blocked_slots:
            logger.debug(f"   ❌ Pairing failed: {emp_id} blocked on {date} {pair_dagdeel}")
            return False
        
        # Validation 2: Check pair quota
        pair_quota_key = (emp_id, pair_service_id)
        if self.quota_remaining.get(pair_quota_key, 0) <= 0:
            logger.debug(f"   ❌ Pairing failed: {emp_id} no quota for {pair_service_code}")
            return False
        
        # Validation 3: Check pair capability
        if (emp_id, pair_service_id) not in self.capabilities:
            logger.debug(f"   ❌ Pairing failed: {emp_id} not capable for {pair_service_code}")
            return False
        
        # Validation 4: Check pair requirement exists
        pair_req_key = (date, pair_dagdeel, pair_service_id)
        if self.requirements.get(pair_req_key, 0) <= 0:
            logger.debug(f"   ❌ Pairing failed: No requirement for {pair_service_code} on {date} {pair_dagdeel}")
            return False
        
        # Validation 5: End-date boundary check
        # For DIA/DDA: Next-day pairing. If date = end_date, no next-day exists
        # For DIO/DDO: Same-day pairing. No boundary issue.
        # SPEC 3.7.1.4: "BEHALVE als datum = end_date in roosters"
        if service_code in ('DIO', 'DDO'):
            # Same-day pairing - OK
            pass
        elif service_code in ('DIA', 'DDA'):
            # This shouldn't happen as DIA/DDA never START a pair
            pass
        
        logger.debug(f"   ✅ Pairing validation passed: {emp_id} can pair {service_code} + {pair_service_code}")
        return True

    def _check_all_quota_exhausted(self, service_id: str) -> bool:
        """
        DRAAD 219B NEW: Check if ALL employees have zero remaining quota for this service.
        
        Args:
            service_id: Service ID to check
        
        Returns:
            True if all employees have quota <= 0 for this service, else False
        """
        for emp_id in [e.id for e in self.employees if e.actief]:
            key = (emp_id, service_id)
            if self.quota_remaining.get(key, 0) > 0:
                return False
        return True

    def _check_many_blocked(self, date: str, dagdeel: str) -> bool:
        """
        DRAAD 219B NEW: Check if majority (>50%) of active employees are blocked for this slot.
        
        Args:
            date: Date (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
        
        Returns:
            True if >50% of active employees are blocked for this slot, else False
        """
        total_active = len([e for e in self.employees if e.actief])
        if total_active == 0:
            return False
        
        blocked_count = 0
        for emp_id in [e.id for e in self.employees if e.actief]:
            if (date, dagdeel, emp_id) in self.blocked_slots:
                blocked_count += 1
        
        return (blocked_count / total_active) > 0.5

    def _count_pairing_failures(self, date: str, dagdeel: str, service_id: str) -> int:
        """
        DRAAD 219B NEW: Count how many otherwise-eligible employees can't be paired.
        
        Args:
            date: Date (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
            service_id: Service ID
        
        Returns:
            Number of eligible employees that can't be paired
        """
        service = self.service_types.get(service_id)
        if not service or service.code not in ('DIO', 'DDO', 'DIA', 'DDA'):
            return 0
        
        eligible = self._find_eligible_employees(date, dagdeel, service_id)
        pair_fails = 0
        
        for emp_id in eligible:
            if not self._can_pair(date, dagdeel, emp_id, service_id):
                pair_fails += 1
        
        return pair_fails

    def _get_shortage_reason(self, date: str, dagdeel: str, service_id: str) -> str:
        """
        DRAAD 219B NEW: Analyze WHY a slot couldn't be fully filled.
        
        Returns human-readable reason in Dutch.
        
        Logic:
        1. Check if ANY eligible employees exist
           → if none: analyze further (quota, blocked, no capability)
        
        2. Check pairing requirements (if system service)
           → if pair failures: "Pairing-vereiste kan niet vervuld"
        
        3. Default to generic message
        """
        service = self.service_types.get(service_id)
        service_code = service.code if service else ''
        
        # Check 1: Are there ANY eligible employees?
        eligible = self._find_eligible_employees(date, dagdeel, service_id)
        
        if not eligible:
            # No eligible employees - analyze WHY
            if self._check_all_quota_exhausted(service_id):
                return "Quota-limiet bereikt voor alle medewerkers"
            elif self._check_many_blocked(date, dagdeel):
                return "Veel medewerkers afwezig/privé/verlof"
            else:
                return "Geen medewerkers beschikbaar"
        
        # Check 2: Pairing failures (if system service)
        if service and service.is_system and service_code in ('DIO', 'DDO', 'DIA', 'DDA'):
            pair_fails = self._count_pairing_failures(date, dagdeel, service_id)
            if pair_fails > 0:
                return f"Pairing-vereiste kan niet vervuld ({pair_fails} mismatches)"
        
        # Check 3: Partial coverage (some but not all)
        return "Onvoldoende beschikbare medewerkers"

    def _get_shortage_suggestion(self, date: str, dagdeel: str, service_id: str) -> str:
        """
        DRAAD 219B NEW: Provide actionable suggestion for resolver.
        
        Returns human-readable suggestion in Dutch.
        
        Based on reason, suggest actions to resolve the shortage.
        """
        reason = self._get_shortage_reason(date, dagdeel, service_id)
        service = self.service_types.get(service_id)
        service_code = service.code if service else ''
        
        if "Quota-limiet" in reason:
            return f"Verhoog quota voor medewerkers met capability voor {service_code}"
        
        elif "afwezig/privé" in reason:
            return "Controleer status-velden (privé/verlof/geblokkeerd) in rooster"
        
        elif "Pairing-vereiste" in reason:
            pair_info = self._get_pair_service(service_code)
            if pair_info:
                pair_service_code, _ = pair_info
                return f"Check quota en beschikbaarheid voor {pair_service_code}"
            return "Herverken pairing-vereisten voor deze dag"
        
        elif "Geen medewerkers beschikbaar" in reason:
            return f"Voeg medewerker toe met capability voor {service_code}"
        
        else:
            return "Verhoog quota of voeg medewerker toe"

    def _refresh_from_database(self) -> None:
        """
        RE-READ from database after each dagdeel.
        
        REASON: Database triggers set status=2 after DIO/DDO pairing.
        If we don't re-read, next dagdeel sees stale status=1!
        
        DRAAD 218C: Also applies pairing blocks to blocked_slots.
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
                
                # DRAAD 218C: Apply pairing blocks
                # If this is a DIO/DDO/DIA/DDA assignment, add pairing blocks
                service_id = row.get('service_id')
                emp_id = row['employee_id']
                date = row['date']
                dagdeel = row['dagdeel']
                
                if service_id:
                    service_type = self.service_types.get(service_id)
                    if service_type and service_type.is_system:
                        service_code = service_type.code
                        
                        # DIO blocks same-day M
                        if service_code == 'DIO':
                            block_key = (date, 'M', emp_id)
                            self.blocked_slots.add(block_key)
                            logger.debug(f"   Pairing block: DIO on {date} O blocks {date} M")
                        
                        # DIA blocks next-day O,M (unless end_date)
                        elif service_code == 'DIA':
                            if date < self.end_date:
                                next_date = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                                if next_date <= self.end_date:
                                    block_o = (next_date, 'O', emp_id)
                                    block_m = (next_date, 'M', emp_id)
                                    self.blocked_slots.add(block_o)
                                    self.blocked_slots.add(block_m)
                                    logger.debug(f"   Pairing block: DIA on {date} A blocks {next_date} O,M")
                        
                        # DDO blocks same-day M
                        elif service_code == 'DDO':
                            block_key = (date, 'M', emp_id)
                            self.blocked_slots.add(block_key)
                            logger.debug(f"   Pairing block: DDO on {date} O blocks {date} M")
                        
                        # DDA blocks next-day O,M (unless end_date)
                        elif service_code == 'DDA':
                            if date < self.end_date:
                                next_date = (datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
                                if next_date <= self.end_date:
                                    block_o = (next_date, 'O', emp_id)
                                    block_m = (next_date, 'M', emp_id)
                                    self.blocked_slots.add(block_o)
                                    self.blocked_slots.add(block_m)
                                    logger.debug(f"   Pairing block: DDA on {date} A blocks {next_date} O,M")
        
        logger.info(f"   ✅ Quota refreshed")
        logger.info(f"   ✅ Blocked slots updated: {len(self.blocked_slots)}")

    def solve(self) -> SolveResult:
        """Execute GREEDY v2.0 + DRAAD 221 FASE 1 DIAGNOSTICS algorithm."""
        start_time = time.time()
        logger.info("\n🚀 [DRAAD 221 FASE 1] Starting GREEDY with QUOTA DIAGNOSTICS...")
        logger.info("   ✅ BUG 1 FIX: blocked_slots (date, dagdeel, employee_id)")
        logger.info("   ✅ BUG 2 FIX: quota_remaining (employee_id, service_id)")
        logger.info("   ✅ BUG 3 FIX: fairness sort by per-service remaining")
        logger.info("   ✨ DRAAD 221 FASE 1: Extensive diagnostics in _initialize_quota()")
        
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
                            reason = self._get_shortage_reason(date_str, dagdeel, service_id)
                            suggestion = self._get_shortage_suggestion(date_str, dagdeel, service_id)
                            logger.warning(f"       Reason: {reason}")
                            logger.warning(f"       Suggestion: {suggestion}")
                            bottlenecks.append({
                                'date': date_str,
                                'dagdeel': dagdeel,
                                'service_id': service_id,
                                'need': required_count,
                                'assigned': assigned_count,
                                'shortage': deficit,
                                'reason': reason,
                                'suggestion': suggestion
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
                                # Check if pairing can be satisfied (DRAAD 218C)
                                if self._can_pair(date_str, dagdeel, emp_id, service_id):
                                    pair_info = self.SERVICE_PAIRS[service_code]
                                    pair_service_code = pair_info['pair_service']
                                    pair_dagdeel = pair_info['pair_dagdeel']
                                    
                                    # Find pair service ID
                                    pair_service_id = None
                                    for svc_id, svc_type in self.service_types.items():
                                        if svc_type.code == pair_service_code:
                                            pair_service_id = svc_id
                                            break
                                    
                                    if pair_service_id:
                                        # Assign both
                                        self._assign_shift(date_str, dagdeel, emp_id, service_id, auto_pair=False)
                                        self._assign_shift(date_str, pair_dagdeel, emp_id, pair_service_id, auto_pair=False)
                                        allocated += 1
                                        logger.info(f"   ✅ Paired: {emp_id} ({service_code} + {pair_service_code})")
                                    else:
                                        logger.warning(f"   ⚠️ Pair service {pair_service_code} not found")
                                else:
                                    logger.debug(f"   ⚠️ {emp_id} cannot be paired for {service_code}")
                            else:
                                # Normal assignment
                                self._assign_shift(date_str, dagdeel, emp_id, service_id, auto_pair=False)
                                allocated += 1
                                logger.debug(f"   ✅ Assigned: {emp_id}")
                        
                        if allocated < deficit:
                            reason = self._get_shortage_reason(date_str, dagdeel, service_id)
                            suggestion = self._get_shortage_suggestion(date_str, dagdeel, service_id)
                            logger.warning(f"   ⚠️  PARTIAL BOTTLENECK: {allocated}/{deficit} filled")
                            logger.warning(f"       Reason: {reason}")
                            logger.warning(f"       Suggestion: {suggestion}")
                            bottlenecks.append({
                                'date': date_str,
                                'dagdeel': dagdeel,
                                'service_id': service_id,
                                'need': required_count,
                                'assigned': assigned_count + allocated,
                                'shortage': deficit - allocated,
                                'reason': reason,
                                'suggestion': suggestion
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
                message=f"DRAAD 221 FASE 1: {coverage:.1f}% coverage in {elapsed:.2f}s",
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

    def _assign_shift(
        self,
        date: str,
        dagdeel: str,
        emp_id: str,
        service_id: str,
        auto_pair: bool = True
    ) -> None:
        """
        DRAAD 218C: Assign a shift to an employee with optional auto-pairing.
        
        Args:
            date: Assignment date (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
            emp_id: Employee ID
            service_id: Service ID
            auto_pair: Whether to auto-pair DIO/DDO (set to False on recursive call)
        """
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
        
        # DRAAD 218C: Auto-pair if enabled and applicable
        if auto_pair:
            service_type = self.service_types.get(service_id)
            if service_type and service_type.is_system:
                service_code = service_type.code
                if service_code in self.SERVICE_PAIRS:
                    pair_info = self.SERVICE_PAIRS[service_code]
                    pair_service_code = pair_info['pair_service']
                    pair_dagdeel = pair_info['pair_dagdeel']
                    
                    # Find pair service ID
                    pair_service_id = None
                    for svc_id, svc_type in self.service_types.items():
                        if svc_type.code == pair_service_code:
                            pair_service_id = svc_id
                            break
                    
                    if pair_service_id and self._can_pair(date, dagdeel, emp_id, service_id):
                        # Recursively assign pair WITHOUT double-pairing
                        logger.info(f"   ✨ Auto-pairing: {emp_id} {service_code} → {pair_service_code}")
                        self._assign_shift(date, pair_dagdeel, emp_id, pair_service_id, auto_pair=False)

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
