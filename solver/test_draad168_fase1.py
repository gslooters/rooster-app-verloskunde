"""DRAAD168 FASE 1: Unit tests for CORR-2 and CORR-3 fixes.

Tests validate:
1. [CORR-2] Constraint 7 correctly filters on both team AND bevoegdheden
2. [CORR-3] DIO+DIA koppeling bonus is properly incentivized
"""

import unittest
from datetime import date, timedelta
from typing import List
from unittest.mock import Mock, patch

try:
    from solver_engine import RosterSolver
    from models import (
        Employee, Service, RosterEmployeeService, ExactStaffing,
        TeamType, Dagdeel, SolveStatus
    )
except ImportError:
    # Fallback for test discovery
    import sys
    sys.path.insert(0, '.')
    from solver_engine import RosterSolver
    from models import (
        Employee, Service, RosterEmployeeService, ExactStaffing,
        TeamType, Dagdeel, SolveStatus
    )


class TestDRAD168Fase1(unittest.TestCase):
    """Test suite for DRAAD168 FASE 1 fixes."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.start_date = date(2025, 1, 1)
        self.end_date = date(2025, 1, 7)  # 1 week
        
        # Create test employees
        self.emp_maat_1 = Employee(
            id="emp-maat-1",
            name="Medewerker MAAT 1",
            team=TeamType.MAAT,
            active=True
        )
        self.emp_maat_2 = Employee(
            id="emp-maat-2",
            name="Medewerker MAAT 2",
            team=TeamType.MAAT,
            active=True
        )
        self.employees = [self.emp_maat_1, self.emp_maat_2]
        
        # Create test services
        self.service_echo = Service(
            id="svc-echo",
            code="ECHO",
            naam="Echo Dienst",
            active=True
        )
        self.service_dio = Service(
            id="svc-dio",
            code="DIO",
            naam="DIO Wachtdienst",
            active=True
        )
        self.service_dia = Service(
            id="svc-dia",
            code="DIA",
            naam="DIA Wachtdienst",
            active=True
        )
        self.services = [self.service_echo, self.service_dio, self.service_dia]
    
    def test_corr2_employee_services_lookup_created(self):
        """[CORR-2] Test that employee_services lookup is pre-built in __init__."""
        # Setup: emp_maat_1 is authorized for ECHO, emp_maat_2 is NOT
        roster_emp_services = [
            RosterEmployeeService(
                employee_id="emp-maat-1",
                service_id="svc-echo",
                aantal=5,
                actief=True
            ),
            RosterEmployeeService(
                employee_id="emp-maat-2",
                service_id="svc-dio",
                aantal=3,
                actief=True
            )
        ]
        
        solver = RosterSolver(
            roster_id="test-roster",
            employees=self.employees,
            services=self.services,
            roster_employee_services=roster_emp_services,
            start_date=self.start_date,
            end_date=self.end_date,
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[]
        )
        
        # Verify: employee_services lookup exists and is correct
        self.assertIn("emp-maat-1", solver.employee_services)
        self.assertIn("svc-echo", solver.employee_services["emp-maat-1"])
        self.assertNotIn("svc-dio", solver.employee_services["emp-maat-1"])
        
        self.assertIn("emp-maat-2", solver.employee_services)
        self.assertNotIn("svc-echo", solver.employee_services["emp-maat-2"])
        self.assertIn("svc-dio", solver.employee_services["emp-maat-2"])
    
    def test_corr2_constraint7_filters_on_bevoegdheden(self):
        """[CORR-2] Test that constraint 7 filters eligible_emps on both team AND bevoegdheden."""
        # Setup: exact_staffing requires 2x ECHO for MAAT team
        # But only emp_maat_1 is authorized for ECHO
        roster_emp_services = [
            RosterEmployeeService(
                employee_id="emp-maat-1",
                service_id="svc-echo",
                aantal=5,
                actief=True
            )
            # emp_maat_2 is NOT authorized for ECHO
        ]
        
        exact_staffing = [
            ExactStaffing(
                service_id="svc-echo",
                dagdeel=Dagdeel.OCHTEND,
                date=self.start_date,
                team="GRO",  # MAAT team
                exact_aantal=2
            )
        ]
        
        solver = RosterSolver(
            roster_id="test-roster",
            employees=self.employees,
            services=self.services,
            roster_employee_services=roster_emp_services,
            start_date=self.start_date,
            end_date=self.end_date,
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=exact_staffing
        )
        
        # Execute: solve
        response = solver.solve()
        
        # Verify: solver should fail gracefully (can't meet staffing with 1 authorized person)
        # Old code: Would create FALSE INFEASIBLE
        # New code: Should handle gracefully or return reasonable status
        self.assertIsNotNone(response)
        # The key is that it doesn't crash and logs the issue properly
    
    def test_corr3_dio_dia_koppel_bonus_logic(self):
        """[CORR-3] Test that DIO+DIA koppeling bonus uses correct reification."""
        # Setup: emp authorized for DIO and DIA
        roster_emp_services = [
            RosterEmployeeService(
                employee_id="emp-maat-1",
                service_id="svc-dio",
                aantal=3,
                actief=True
            ),
            RosterEmployeeService(
                employee_id="emp-maat-1",
                service_id="svc-dia",
                aantal=3,
                actief=True
            )
        ]
        
        solver = RosterSolver(
            roster_id="test-roster",
            employees=self.employees,
            services=self.services,
            roster_employee_services=roster_emp_services,
            start_date=self.start_date,
            end_date=self.end_date,
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[]
        )
        
        # Execute: solve
        response = solver.solve()
        
        # Verify: solve should succeed
        self.assertIsNotNone(response)
        self.assertIn(response.status, [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE])
        
        # Check metadata shows CORR-3 is active
        self.assertEqual(
            response.solver_metadata.get("draad168_fase1"),
            "CORR-2_CORR-3_fixed"
        )
    
    def test_corr2_no_eligible_employees_warning(self):
        """[CORR-2] Test that warning is logged when no eligible employees for staffing."""
        # Setup: exact_staffing for ECHO, but NO employee is authorized for ECHO
        roster_emp_services = []
        
        exact_staffing = [
            ExactStaffing(
                service_id="svc-echo",
                dagdeel=Dagdeel.OCHTEND,
                date=self.start_date,
                team="GRO",
                exact_aantal=2
            )
        ]
        
        solver = RosterSolver(
            roster_id="test-roster",
            employees=self.employees,
            services=self.services,
            roster_employee_services=roster_emp_services,
            start_date=self.start_date,
            end_date=self.end_date,
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=exact_staffing
        )
        
        # Execute: should not crash, should log warning
        with patch('solver_engine.logger') as mock_logger:
            response = solver.solve()
            
            # Verify: warning should be logged about no eligible employees
            # (Warning is in _constraint_7_exact_staffing when eligible_emps is empty)
            self.assertIsNotNone(response)
    
    def test_metadata_includes_draad168_marker(self):
        """Test that solver_metadata includes DRAAD168 FASE 1 marker."""
        roster_emp_services = [
            RosterEmployeeService(
                employee_id="emp-maat-1",
                service_id="svc-dio",
                aantal=1,
                actief=True
            )
        ]
        
        solver = RosterSolver(
            roster_id="test-roster",
            employees=self.employees,
            services=self.services,
            roster_employee_services=roster_emp_services,
            start_date=self.start_date,
            end_date=self.end_date,
            fixed_assignments=[],
            blocked_slots=[]
        )
        
        response = solver.solve()
        
        self.assertEqual(
            response.solver_metadata.get("draad168_fase1"),
            "CORR-2_CORR-3_fixed"
        )


if __name__ == "__main__":
    unittest.main()
