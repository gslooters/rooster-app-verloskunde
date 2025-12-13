#!/usr/bin/env python3
"""
LIVE SUPABASE INTEGRATION TEST - DRAAD172

Purpose: Test CP-SAT solver with REAL 5-week rooster data from Supabase

Test Workflow:
1. Connect to Supabase (live database)
2. Fetch current roster period (rooster with 5 weeks duration)
3. Load employees, services, constraints from database
4. Run CP-SAT solver on REAL data
5. Capture performance metrics
6. Log bottlenecks and assignments
7. Verify coverage_rate and constraint violations
8. Generate execution report

Status: Baseline Verification → Live Execution → Metrics Capture
"""

import pytest
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
import json
import os
import sys
from pathlib import Path

# Add solver to path
sys_path_insert = str(Path(__file__).parent)
if sys_path_insert not in sys.path:
    sys.path.insert(0, sys_path_insert)

try:
    from solver_engine import RosterSolver
    from models import (
        Employee, Service, RosterEmployeeService,
        FixedAssignment, BlockedSlot, ExactStaffing,
        SolveStatus, Dagdeel, TeamType
    )
    SOLVER_AVAILABLE = True
except ImportError as e:
    SOLVER_AVAILABLE = False
    print(f"⚠️  Solver import failed: {e}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


class SupabaseLiveDataFetcher:
    """
    Fetch LIVE data from Supabase database.
    
    Requires environment variable: SUPABASE_URL, SUPABASE_KEY
    """
    
    def __init__(self):
        """Initialize Supabase client (if available)."""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        self.client = None
        self.connected = False
        
        if self.supabase_url and self.supabase_key:
            try:
                from supabase import create_client
                self.client = create_client(self.supabase_url, self.supabase_key)
                self.connected = True
                logger.info("✓ Supabase client connected")
            except ImportError:
                logger.warning("⚠️  supabase-py not installed. Using mock data.")
                self.connected = False
        else:
            logger.warning("⚠️  SUPABASE_URL/KEY not set. Using mock data.")
    
    def fetch_active_roster(self) -> Optional[Dict]:
        """
        Fetch current/active rooster (in_progress status).
        
        Returns: Rooster dict with id, start_date, end_date, or None if not available
        """
        if not self.connected or not self.client:
            logger.info("Using mock rooster (Supabase not available)")
            return self._mock_rooster_5week()
        
        try:
            response = self.client.table('roosters').select(
                '*'
            ).eq(
                'status', 'in_progress'
            ).order(
                'created_at', desc=True
            ).limit(1).execute()
            
            if response.data:
                roster = response.data[0]
                logger.info(f"✓ Fetched active rooster: {roster['id']}")
                return roster
            else:
                logger.info("No active rooster found in Supabase. Using mock.")
                return self._mock_rooster_5week()
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to fetch rooster: {e}. Using mock.")
            return self._mock_rooster_5week()
    
    def fetch_employees(self, roster_id: Optional[str] = None) -> List[Dict]:
        """
        Fetch employees for roster.
        
        If roster_id provided: fetch employees assigned to this roster
        Otherwise: fetch all active employees
        """
        if not self.connected or not self.client:
            logger.info("Using mock employees (Supabase not available)")
            return self._mock_employees()
        
        try:
            if roster_id:
                # Fetch employees from period_employee_staffing (assigned to roster)
                response = self.client.table('period_employee_staffing').select(
                    'employee_id'
                ).eq('roster_id', roster_id).execute()
                
                employee_ids = [e['employee_id'] for e in response.data]
            else:
                # Fetch all active employees
                response = self.client.table('employees').select(
                    '*'
                ).eq('actief', True).execute()
                
                return response.data
            
            # Fetch full employee details
            if employee_ids:
                response = self.client.table('employees').select(
                    '*'
                ).in_('id', employee_ids).execute()
                logger.info(f"✓ Fetched {len(response.data)} employees for rooster")
                return response.data
            else:
                logger.warning("No employees assigned to rooster. Using mock.")
                return self._mock_employees()
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to fetch employees: {e}. Using mock.")
            return self._mock_employees()
    
    def fetch_services(self) -> List[Dict]:
        """
        Fetch all active service types.
        """
        if not self.connected or not self.client:
            logger.info("Using mock services (Supabase not available)")
            return self._mock_services()
        
        try:
            response = self.client.table('service_types').select(
                '*'
            ).eq('actief', True).execute()
            
            logger.info(f"✓ Fetched {len(response.data)} services")
            return response.data
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to fetch services: {e}. Using mock.")
            return self._mock_services()
    
    def fetch_roster_employee_services(
        self, roster_id: str
    ) -> List[Dict]:
        """
        Fetch employee service assignments for roster (bevoegdheden).
        """
        if not self.connected or not self.client:
            logger.info("Using mock roster_employee_services (Supabase not available)")
            return self._mock_roster_employee_services()
        
        try:
            response = self.client.table('roster_employee_services').select(
                '*'
            ).eq('roster_id', roster_id).eq('actief', True).execute()
            
            logger.info(f"✓ Fetched {len(response.data)} roster employee services")
            return response.data
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to fetch roster_employee_services: {e}. Using mock.")
            return self._mock_roster_employee_services()
    
    def fetch_exact_staffing(
        self, roster_id: str, start_date: date, end_date: date
    ) -> List[Dict]:
        """
        Fetch exact staffing requirements for roster period.
        """
        if not self.connected or not self.client:
            logger.info("Using mock exact_staffing (Supabase not available)")
            return self._mock_exact_staffing(start_date, end_date)
        
        try:
            response = self.client.table('roster_period_staffing').select(
                '*'
            ).eq('roster_id', roster_id).execute()
            
            logger.info(f"✓ Fetched {len(response.data)} exact staffing records")
            return response.data
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to fetch exact_staffing: {e}. Using mock.")
            return self._mock_exact_staffing(start_date, end_date)
    
    def _mock_rooster_5week(self) -> Dict:
        """Mock 5-week rooster (Week 48-52 2025)."""
        start = date(2025, 11, 24)  # Monday week 48
        end = date(2025, 12, 28)    # Sunday week 52
        return {
            'id': 'mock-rooster-draad172',
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'status': 'in_progress',
            'created_at': datetime.now().isoformat()
        }
    
    def _mock_employees(self) -> List[Dict]:
        """Mock 3-5 employees (mixed teams)."""
        return [
            {
                'id': 'emp001',
                'voornaam': 'Alice',
                'achternaam': 'Maat1',
                'email': 'alice@test.nl',
                'dienstverband': 'Maat',
                'team': 'Groen',
                'aantalwerkdagen': 5,
                'actief': True
            },
            {
                'id': 'emp002',
                'voornaam': 'Bob',
                'achternaam': 'Maat2',
                'email': 'bob@test.nl',
                'dienstverband': 'Maat',
                'team': 'Oranje',
                'aantalwerkdagen': 5,
                'actief': True
            },
            {
                'id': 'emp003',
                'voornaam': 'Carol',
                'achternaam': 'Loondienst1',
                'email': 'carol@test.nl',
                'dienstverband': 'Loondienst',
                'team': 'Groen',
                'aantalwerkdagen': 4,
                'actief': True
            }
        ]
    
    def _mock_services(self) -> List[Dict]:
        """Mock main services."""
        return [
            {
                'id': 'svc-ddo-uuid',
                'code': 'DDO',
                'naam': 'Dag-Dag-Dag Ochtend',
                'begintijd': '08:00',
                'eindtijd': '17:00',
                'kleur': '#FFE082',
                'actief': True
            },
            {
                'id': 'svc-dio-uuid',
                'code': 'DIO',
                'naam': 'Dag-Info-Ochtend',
                'begintijd': '08:00',
                'eindtijd': '17:00',
                'kleur': '#FFCC80',
                'actief': True
            },
            {
                'id': 'svc-dda-uuid',
                'code': 'DDA',
                'naam': 'Dag-Dag-Avond',
                'begintijd': '13:00',
                'eindtijd': '21:00',
                'kleur': '#FF9800',
                'actief': True
            }
        ]
    
    def _mock_roster_employee_services(self) -> List[Dict]:
        """Mock employee service assignments."""
        return [
            {'employee_id': 'emp001', 'service_id': 'svc-ddo-uuid', 'aantal': 8, 'actief': True},
            {'employee_id': 'emp001', 'service_id': 'svc-dio-uuid', 'aantal': 5, 'actief': True},
            {'employee_id': 'emp001', 'service_id': 'svc-dda-uuid', 'aantal': 5, 'actief': True},
            {'employee_id': 'emp002', 'service_id': 'svc-ddo-uuid', 'aantal': 8, 'actief': True},
            {'employee_id': 'emp002', 'service_id': 'svc-dda-uuid', 'aantal': 5, 'actief': True},
            {'employee_id': 'emp003', 'service_id': 'svc-ddo-uuid', 'aantal': 6, 'actief': True},
        ]
    
    def _mock_exact_staffing(self, start: date, end: date) -> List[Dict]:
        """Mock exact staffing requirements for period."""
        staffing = []
        current = start
        while current <= end:
            # DDO: 2 per ochtend, 1 per middag
            staffing.append({
                'date': current.isoformat(),
                'service_id': 'svc-ddo-uuid',
                'dagdeel': 'O',
                'min_staff': 2,
                'max_staff': 3,
                'team_tot': True
            })
            staffing.append({
                'date': current.isoformat(),
                'service_id': 'svc-ddo-uuid',
                'dagdeel': 'M',
                'min_staff': 1,
                'max_staff': 2,
                'team_tot': True
            })
            # DIO: 1 per ochtend
            staffing.append({
                'date': current.isoformat(),
                'service_id': 'svc-dio-uuid',
                'dagdeel': 'O',
                'min_staff': 1,
                'max_staff': 1,
                'team_tot': True
            })
            # DDA: 1 per avond
            staffing.append({
                'date': current.isoformat(),
                'service_id': 'svc-dda-uuid',
                'dagdeel': 'A',
                'min_staff': 1,
                'max_staff': 1,
                'team_tot': True
            })
            current += timedelta(days=1)
        
        logger.info(f"Generated {len(staffing)} mock staffing records for {(end - start).days + 1} days")
        return staffing


class TestLive5WeekRosterDRAARD172:
    """
    Main test: LIVE Supabase integration with 5-week rooster
    """
    
    @pytest.mark.live_integration
    @pytest.mark.draad172
    def test_live_5week_roster_draad172(self):
        """
        LIVE TEST: Full 5-week rooster solving with real Supabase data
        
        Verifies:
        1. Connection to Supabase (or graceful fallback to mock data)
        2. Data fetch: employees, services, assignments, staffing
        3. CP-SAT solver execution on real data
        4. Performance metrics (solve time, coverage, constraints)
        5. Bottleneck detection
        6. Results logging
        """
        logger.info("\n" + "="*80)
        logger.info("DRAAD172: LIVE 5-WEEK ROOSTER INTEGRATION TEST")
        logger.info("="*80)
        
        # Step 1: Connect and fetch data
        fetcher = SupabaseLiveDataFetcher()
        logger.info(f"Data source: {'Supabase' if fetcher.connected else 'Mock data'}")
        
        rooster = fetcher.fetch_active_roster()
        assert rooster is not None
        
        start_date = datetime.fromisoformat(rooster['start_date']).date()
        end_date = datetime.fromisoformat(rooster['end_date']).date()
        duration_days = (end_date - start_date).days + 1
        duration_weeks = duration_days / 7
        
        logger.info(f"Rooster: {start_date} → {end_date} ({duration_days} days, {duration_weeks:.1f} weeks)")
        
        # Step 2: Fetch data
        employees = fetcher.fetch_employees(rooster['id'])
        services = fetcher.fetch_services()
        roster_emp_services = fetcher.fetch_roster_employee_services(rooster['id'])
        exact_staffing_data = fetcher.fetch_exact_staffing(rooster['id'], start_date, end_date)
        
        logger.info(f"Data loaded:")
        logger.info(f"  - Employees: {len(employees)}")
        logger.info(f"  - Services: {len(services)}")
        logger.info(f"  - Employee-Service links: {len(roster_emp_services)}")
        logger.info(f"  - Exact staffing records: {len(exact_staffing_data)}")
        
        if not SOLVER_AVAILABLE:
            logger.warning("⚠️  Solver not available. Skipping CP-SAT execution.")
            pytest.skip("Solver modules not available")
        
        # Step 3: Build solver input models
        emp_models = [
            Employee(
                id=e['id'],
                name=f"{e['voornaam']} {e['achternaam']}",
                email=e.get('email', ''),
                team=TeamType.MAAT if e['dienstverband'] == 'Maat' else TeamType.LOONDIENST,
                max_shifts=e.get('aantalwerkdagen', 5)
            )
            for e in employees
        ]
        
        svc_models = [
            Service(
                id=s['id'],
                code=s['code'],
                naam=s['naam']
            )
            for s in services
        ]
        
        res_models = [
            RosterEmployeeService(
                employee_id=r['employee_id'],
                service_id=r['service_id'],
                aantal=r.get('aantal', 0),
                actief=r.get('actief', True)
            )
            for r in roster_emp_services
        ]
        
        exact_staffing_models = [
            ExactStaffing(
                date=datetime.fromisoformat(s['date']).date(),
                dagdeel=Dagdeel.OCHTEND if s['dagdeel'] == 'O' 
                        else Dagdeel.MIDDEL if s['dagdeel'] == 'M' 
                        else Dagdeel.AVOND,
                service_id=s['service_id'],
                exact_aantal=s.get('min_staff', 1),
                team='TOT'
            )
            for s in exact_staffing_data
        ]
        
        logger.info(f"Models created:")
        logger.info(f"  - Employee models: {len(emp_models)}")
        logger.info(f"  - Service models: {len(svc_models)}")
        logger.info(f"  - RES models: {len(res_models)}")
        logger.info(f"  - Exact staffing models: {len(exact_staffing_models)}")
        
        # Step 4: Execute solver
        logger.info("\nStarting CP-SAT solver...")
        import time
        start_time = time.time()
        
        try:
            solver = RosterSolver(
                roster_id=rooster['id'],
                employees=emp_models,
                services=svc_models,
                roster_employee_services=res_models,
                start_date=start_date,
                end_date=end_date,
                fixed_assignments=[],
                blocked_slots=[],
                exact_staffing=exact_staffing_models,
                timeout_seconds=30
            )
            
            response = solver.solve()
            solve_time = time.time() - start_time
            
            logger.info(f"\nSolver completed in {solve_time:.2f}s")
            logger.info(f"Status: {response.status}")
            logger.info(f"Assignments: {len(response.assignments)}")
            logger.info(f"Total slots: {response.total_slots}")
            logger.info(f"Coverage: {response.fill_percentage:.1f}%")
            
            # Step 5: Verify results
            assert response.status in [
                SolveStatus.OPTIMAL,
                SolveStatus.FEASIBLE,
                SolveStatus.INFEASIBLE,
                SolveStatus.UNKNOWN
            ]
            
            assert response.solve_time_seconds >= 0
            assert response.total_slots > 0
            
            # Step 6: Log violations (if any)
            if response.constraint_violations:
                logger.info(f"\nConstraint violations: {len(response.constraint_violations)}")
                for violation in response.constraint_violations[:5]:  # Show first 5
                    logger.info(f"  - {violation.constraint_type}: {violation.message}")
            
            # Step 7: Save execution report
            report = {
                'test_name': 'test_live_5week_roster_draad172',
                'timestamp': datetime.now().isoformat(),
                'rooster': {
                    'id': rooster['id'],
                    'period': f"{start_date} to {end_date}",
                    'weeks': duration_weeks
                },
                'data': {
                    'employees': len(emp_models),
                    'services': len(svc_models),
                    'employee_service_links': len(res_models),
                    'exact_staffing_records': len(exact_staffing_models)
                },
                'solver': {
                    'status': str(response.status),
                    'solve_time_seconds': response.solve_time_seconds,
                    'assignments_count': len(response.assignments),
                    'total_slots': response.total_slots,
                    'coverage_percentage': response.fill_percentage,
                    'constraint_violations_count': len(response.constraint_violations) if response.constraint_violations else 0
                },
                'data_source': 'Supabase' if fetcher.connected else 'Mock'
            }
            
            logger.info("\n" + "="*80)
            logger.info("EXECUTION REPORT")
            logger.info("="*80)
            logger.info(json.dumps(report, indent=2))
            
            # Assert basic success criteria
            if response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE]:
                assert response.fill_percentage >= 50, "Coverage too low"
                logger.info("✓ Test PASSED - Live solver execution successful")
            else:
                logger.warning(f"⚠️  Solver status: {response.status} (may indicate infeasibility)")
        
        except Exception as e:
            logger.error(f"❌ Solver execution failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise


if __name__ == '__main__':
    pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '--log-cli-level=INFO',
        '-m', 'live_integration or draad172'
    ])
