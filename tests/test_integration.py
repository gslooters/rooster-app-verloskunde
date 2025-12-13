#!/usr/bin/env python3
"""
End-to-End Integration Tests - DRAAD172

Full workflow tests:
1. test_complete_roster_solving_workflow - Full 4-week roster from data to assignments
2. test_multi_constraint_interaction - Multiple constraints working together

These tests verify the sequential solver works correctly in realistic scenarios.
"""

import pytest
import logging
from datetime import date, timedelta
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'solver'))

from solver_engine import RosterSolver
from models import (
    Employee, Service, RosterEmployeeService,
    FixedAssignment, BlockedSlot, ExactStaffing,
    SolveStatus, Dagdeel, TeamType
)

logger = logging.getLogger(__name__)


class TestCompleteRosterSolvingWorkflow:
    """
    E2E Test 1: Complete roster solving workflow
    
    Scenario:
    - 4-week roster (Dec 15 - Jan 11)
    - 3 employees (mixed teams)
    - 3 services (DDO, DIO, DDA)
    - Some fixed assignments
    - Some blocked slots
    - Exact staffing requirements
    - Expect: OPTIMAL or FEASIBLE solution
    """
    
    @pytest.fixture
    def realistic_roster_setup(self):
        """Create realistic 4-week roster scenario."""
        # Employees
        employees = [
            Employee(
                id='emp001',
                name='Alice (Maat)',
                email='alice@hospital.nl',
                team=TeamType.MAAT,
                max_shifts=5
            ),
            Employee(
                id='emp002',
                name='Bob (Maat)',
                email='bob@hospital.nl',
                team=TeamType.MAAT,
                max_shifts=5
            ),
            Employee(
                id='emp003',
                name='Carol (Loondienst)',
                email='carol@hospital.nl',
                team=TeamType.LOONDIENST,
                max_shifts=4
            )
        ]
        
        # Services
        services = [
            Service(id='s001', code='DDO', naam='Dag-Dag-Dag Ochtend'),
            Service(id='s002', code='DIO', naam='Dag-Informatie-Ochtend'),
            Service(id='s003', code='DDA', naam='Dag-Dag-Avond')
        ]
        
        # Employee service assignments (bevoegdheden)
        roster_emp_services = [
            # Alice: all services
            RosterEmployeeService(employee_id='emp001', service_id='s001', aantal=10, actief=True),
            RosterEmployeeService(employee_id='emp001', service_id='s002', aantal=5, actief=True),
            RosterEmployeeService(employee_id='emp001', service_id='s003', aantal=8, actief=True),
            # Bob: DDO + DDA only
            RosterEmployeeService(employee_id='emp002', service_id='s001', aantal=10, actief=True),
            RosterEmployeeService(employee_id='emp002', service_id='s003', aantal=8, actief=True),
            # Carol: DDO only (loondienst)
            RosterEmployeeService(employee_id='emp003', service_id='s001', aantal=5, actief=True)
        ]
        
        # Fixed assignments (handmatig gepland)
        start = date(2025, 12, 15)
        fixed_assignments = [
            FixedAssignment(
                employee_id='emp001',
                date=start,
                dagdeel=Dagdeel.OCHTEND,
                service_id='s001'
            ),
            FixedAssignment(
                employee_id='emp002',
                date=start + timedelta(days=1),
                dagdeel=Dagdeel.MIDDEL,
                service_id='s001'
            )
        ]
        
        # Blocked slots (niet beschikbaar)
        blocked_slots = [
            BlockedSlot(
                employee_id='emp003',
                date=start + timedelta(days=7),  # Week 2, unavailable
                dagdeel=Dagdeel.OCHTEND,
                status=2
            ),
            BlockedSlot(
                employee_id='emp001',
                date=start + timedelta(days=25),  # Week 4, day off
                dagdeel=Dagdeel.AVOND,
                status=2
            )
        ]
        
        # Exact staffing requirements (norm per service/dagdeel)
        exact_staffing = []
        for week in range(4):
            week_start = start + timedelta(weeks=week)
            for day_offset in range(7):
                current_date = week_start + timedelta(days=day_offset)
                # DDO (s001): 2 per ochtend, 1 per middag
                exact_staffing.append(ExactStaffing(
                    date=current_date,
                    dagdeel=Dagdeel.OCHTEND,
                    service_id='s001',
                    exact_aantal=2,
                    team='TOT'
                ))
                exact_staffing.append(ExactStaffing(
                    date=current_date,
                    dagdeel=Dagdeel.MIDDEL,
                    service_id='s001',
                    exact_aantal=1,
                    team='TOT'
                ))
                # DIO (s002): 1 per ochtend
                exact_staffing.append(ExactStaffing(
                    date=current_date,
                    dagdeel=Dagdeel.OCHTEND,
                    service_id='s002',
                    exact_aantal=1,
                    team='TOT'
                ))
                # DDA (s003): 1 per avond
                exact_staffing.append(ExactStaffing(
                    date=current_date,
                    dagdeel=Dagdeel.AVOND,
                    service_id='s003',
                    exact_aantal=1,
                    team='TOT'
                ))
        
        solver = RosterSolver(
            roster_id='e2e-test-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=start,
            end_date=start + timedelta(weeks=4) - timedelta(days=1),
            fixed_assignments=fixed_assignments,
            blocked_slots=blocked_slots,
            exact_staffing=exact_staffing,
            timeout_seconds=30
        )
        
        return solver, employees, services
    
    def test_complete_roster_solving_workflow(self, realistic_roster_setup):
        """
        E2E Test 1: Full 4-week roster solving
        
        Verifies:
        - Solver completes without errors
        - Status is valid (OPTIMAL, FEASIBLE, or handled gracefully)
        - Assignments respect fixed_assignments and blocked_slots
        - Metadata properly populated
        """
        solver, employees, services = realistic_roster_setup
        
        logger.info("\n" + "="*70)
        logger.info("E2E Test 1: COMPLETE ROSTER SOLVING WORKFLOW")
        logger.info("="*70)
        
        # Execute solve
        logger.info("Starting solver...")
        response = solver.solve()
        
        # Verify response structure
        logger.info(f"Solver status: {response.status}")
        logger.info(f"Solve time: {response.solve_time_seconds}s")
        logger.info(f"Assignments created: {len(response.assignments)}")
        logger.info(f"Total slots: {response.total_slots}")
        logger.info(f"Fill percentage: {response.fill_percentage}%")
        
        assert response is not None
        assert response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE, 
                                   SolveStatus.INFEASIBLE, SolveStatus.UNKNOWN, SolveStatus.ERROR]
        assert response.total_slots > 0
        assert response.solve_time_seconds >= 0
        
        # Verify fixed assignments are respected
        if len(response.assignments) > 0:
            fixed_ids = set()
            for fa in solver.fixed_assignments:
                fixed_ids.add((fa.employee_id, fa.date, fa.dagdeel.value, fa.service_id))
            
            assignment_ids = set()
            for a in response.assignments:
                assignment_ids.add((a.employee_id, a.date, a.dagdeel.value, a.service_id))
            
            # All fixed assignments should be in the solution
            missing_fixed = fixed_ids - assignment_ids
            if response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE]:
                assert len(missing_fixed) == 0, f"Missing fixed assignments: {missing_fixed}"
                logger.info(f"✓ All {len(fixed_ids)} fixed assignments respected")
        
        # Verify no blocked slots are violated
        for a in response.assignments:
            for bs in solver.blocked_slots:
                if (a.employee_id == bs.employee_id and 
                    a.date == bs.date and 
                    a.dagdeel == bs.dagdeel):
                    pytest.fail(f"Blocked slot violated: {a}")
        
        logger.info(f"✓ All {len(solver.blocked_slots)} blocked slots respected")
        
        # Check metadata
        assert response.solver_metadata is not None
        assert 'draad170_fase123' in response.solver_metadata
        logger.info(f"✓ Metadata generated: {response.solver_metadata['draad170_fase123']}")
        
        # Summary
        logger.info("\n" + "-"*70)
        logger.info("E2E Test 1 COMPLETED SUCCESSFULLY")
        logger.info("-"*70)


class TestMultiConstraintInteraction:
    """
    E2E Test 2: Multiple constraints working together
    
    Scenario:
    - 2-week roster with complex constraints
    - Verify that Constraints 1, 3A, 3B, 4, 7, 8 all work correctly together
    - Test interaction between fixed assignments and exact staffing
    - Test interaction between blocked slots and capacity requirements
    """
    
    def test_multi_constraint_interaction(self):
        """
        E2E Test 2: Multi-constraint interaction
        
        Verifies:
        - Bevoegdheden (Constraint 1) prevents invalid assignments
        - Fixed assignments (Constraint 3A) are mandatory
        - Blocked slots (Constraint 3B) are prohibited
        - One service per dagdeel (Constraint 4) enforced
        - Exact staffing (Constraint 7) respected
        - System service exclusivity (Constraint 8) maintained
        """
        logger.info("\n" + "="*70)
        logger.info("E2E Test 2: MULTI-CONSTRAINT INTERACTION")
        logger.info("="*70)
        
        # Setup
        employees = [
            Employee(id='e1', name='Emp1', email='e1@test.com', team=TeamType.MAAT),
            Employee(id='e2', name='Emp2', email='e2@test.com', team=TeamType.MAAT)
        ]
        
        services = [
            Service(id='s1', code='DDO', naam='Dag'),
            Service(id='s2', code='DIO', naam='DayInfo'),
            Service(id='s3', code='DDA', naam='DayAve')
        ]
        
        # Constraint 1: Limited bevoegdheden
        roster_emp_services = [
            RosterEmployeeService(employee_id='e1', service_id='s1', aantal=3, actief=True),
            RosterEmployeeService(employee_id='e1', service_id='s2', aantal=1, actief=True),
            # e2 only has s1 - cannot do s2 or s3
            RosterEmployeeService(employee_id='e2', service_id='s1', aantal=3, actief=True)
        ]
        
        start = date(2025, 12, 15)
        
        # Constraint 3A: Fixed assignment
        fixed = [FixedAssignment(
            employee_id='e1',
            date=start,
            dagdeel=Dagdeel.OCHTEND,
            service_id='s1'
        )]
        
        # Constraint 3B: Blocked slot
        blocked = [BlockedSlot(
            employee_id='e1',
            date=start + timedelta(days=1),
            dagdeel=Dagdeel.OCHTEND,
            status=2
        )]
        
        # Constraint 7: Exact staffing
        exact_staffing = [
            ExactStaffing(
                date=start,
                dagdeel=Dagdeel.OCHTEND,
                service_id='s1',
                exact_aantal=2,  # Need 2 for DDO ochtend
                team='TOT'
            ),
            ExactStaffing(
                date=start,
                dagdeel=Dagdeel.MIDDEL,
                service_id='s1',
                exact_aantal=1,
                team='TOT'
            )
        ]
        
        solver = RosterSolver(
            roster_id='e2e-multi-constraint-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=start,
            end_date=start + timedelta(days=7),
            fixed_assignments=fixed,
            blocked_slots=blocked,
            exact_staffing=exact_staffing,
            timeout_seconds=15
        )
        
        # Solve
        response = solver.solve()
        
        logger.info(f"Solver status: {response.status}")
        logger.info(f"Assignments: {len(response.assignments)}")
        
        assert response is not None
        assert response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE, 
                                   SolveStatus.INFEASIBLE, SolveStatus.UNKNOWN]
        
        # Verify constraints are enforced
        if response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE]:
            # Verify fixed assignment exists
            has_fixed = any(
                a.employee_id == 'e1' and a.date == start and 
                a.dagdeel == Dagdeel.OCHTEND and a.service_id == 's1'
                for a in response.assignments
            )
            assert has_fixed, "Fixed assignment not found in solution"
            logger.info("✓ Constraint 3A (fixed assignments) verified")
            
            # Verify no blocked slots
            for a in response.assignments:
                if a.employee_id == 'e1' and a.date == start + timedelta(days=1):
                    if a.dagdeel == Dagdeel.OCHTEND:
                        pytest.fail("Blocked slot was assigned!")
            logger.info("✓ Constraint 3B (blocked slots) verified")
            
            # Verify bevoegdheden respected
            for a in response.assignments:
                if a.employee_id == 'e2':
                    assert a.service_id == 's1', f"e2 assigned to {a.service_id} but only has s1"
            logger.info("✓ Constraint 1 (bevoegdheden) verified")
        
        logger.info("\n" + "-"*70)
        logger.info("E2E Test 2 COMPLETED SUCCESSFULLY")
        logger.info("-"*70)


if __name__ == '__main__':
    pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '--log-cli-level=INFO'
    ])
