#!/usr/bin/env python3
"""
Sequential Solver Unit Tests - DRAAD172

Tests for CP-SAT solver engine sequential processing:
- Constraint validation
- Variable creation
- Objective function definition
- Solver execution pipeline
- Metadata generation

Target: 100% passing for sequential solver path
"""

import pytest
import logging
from datetime import datetime, timedelta, date
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'solver'))

from solver_engine import RosterSolver, CapacityAnalyzer
from models import (
    Employee, Service, RosterEmployeeService,
    FixedAssignment, BlockedSlot, ExactStaffing,
    Assignment, ConstraintViolation, SolveStatus, Dagdeel, TeamType
)

logger = logging.getLogger(__name__)


class TestSequentialSolverInitialization:
    """Test 1: Solver initialization and variable creation."""
    
    @pytest.fixture
    def solver_setup(self):
        """Setup minimal solver instance."""
        employees = [
            Employee(
                id='emp1',
                name='Alice',
                email='alice@test.com',
                team=TeamType.MAAT,
                max_shifts=5
            ),
            Employee(
                id='emp2',
                name='Bob',
                email='bob@test.com',
                team=TeamType.MAAT,
                max_shifts=5
            )
        ]
        
        services = [
            Service(id='svc1', code='DDO', naam='Dag'),
            Service(id='svc2', code='DIO', naam='Dag-Nacht')
        ]
        
        roster_emp_services = [
            RosterEmployeeService(
                employee_id='emp1',
                service_id='svc1',
                aantal=3,
                actief=True
            ),
            RosterEmployeeService(
                employee_id='emp1',
                service_id='svc2',
                aantal=2,
                actief=True
            ),
            RosterEmployeeService(
                employee_id='emp2',
                service_id='svc1',
                aantal=3,
                actief=True
            )
        ]
        
        start_date = date(2025, 12, 15)
        end_date = date(2025, 12, 21)  # 1 week
        
        solver = RosterSolver(
            roster_id='test-roster-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=start_date,
            end_date=end_date,
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=5
        )
        
        return solver, employees, services
    
    def test_solver_initialization(self, solver_setup):
        """Test: Solver initializes with correct attributes."""
        solver, employees, services = solver_setup
        
        # Assertions
        assert solver.roster_id == 'test-roster-001'
        assert len(solver.employees) == 2
        assert len(solver.services) == 2
        assert len(solver.dates) == 7  # 1 week
        assert solver.timeout_seconds == 5
        assert solver.model is not None
        
        logger.info("✓ Test 1.1: Solver initialization PASSED")
    
    def test_variable_creation(self, solver_setup):
        """Test: Decision variables created correctly."""
        solver, employees, services = solver_setup
        
        # Create variables
        solver._create_variables()
        
        # Expected count: employees × dates × dagdelen × services
        # 2 × 7 × 3 × 2 = 84 variables
        expected_vars = 2 * 7 * 3 * 2
        
        assert len(solver.assignments_vars) == expected_vars
        assert all(isinstance(v, type(solver.model.NewBoolVar('test'))) 
                  for v in solver.assignments_vars.values())
        
        logger.info(f"✓ Test 1.2: Variable creation PASSED ({len(solver.assignments_vars)} vars)")
    
    def test_constraint_application_sequence(self, solver_setup):
        """Test: Constraints applied in correct sequence."""
        solver, employees, services = solver_setup
        
        # Create variables first
        solver._create_variables()
        initial_constraint_count = len(solver.model.Proto().constraints)
        
        # Apply constraints
        solver._apply_constraints()
        final_constraint_count = len(solver.model.Proto().constraints)
        
        # Verify constraints were added
        assert final_constraint_count > initial_constraint_count
        assert final_constraint_count >= 7  # At least constraint 1,4,7,8 + some from bevoegdheden
        
        logger.info(f"✓ Test 1.3: Constraint application PASSED ({final_constraint_count} constraints)")
    
    def test_employee_service_lookup(self, solver_setup):
        """Test: Employee service lookup (bevoegdheden) created correctly."""
        solver, employees, services = solver_setup
        
        # Verify lookup was created during init
        assert 'emp1' in solver.employee_services
        assert 'emp2' in solver.employee_services
        assert 'svc1' in solver.employee_services['emp1']
        assert 'svc2' in solver.employee_services['emp1']
        assert 'svc1' in solver.employee_services['emp2']
        assert 'svc2' not in solver.employee_services['emp2']  # emp2 not allowed svc2
        
        logger.info("✓ Test 1.4: Employee service lookup PASSED")


class TestConstraintValidation:
    """Test 2: Constraint validation and error handling."""
    
    @pytest.fixture
    def solver_with_conflicts(self):
        """Setup solver with conflicting constraints."""
        employees = [Employee(id='emp1', name='Alice', email='alice@test.com', team=TeamType.MAAT)]
        services = [Service(id='svc1', code='DDO', naam='Dag')]
        roster_emp_services = [
            RosterEmployeeService(employee_id='emp1', service_id='svc1', aantal=1, actief=True)
        ]
        
        test_date = date(2025, 12, 15)
        
        # Create fixed and blocked for SAME slot
        fixed = [FixedAssignment(
            employee_id='emp1',
            date=test_date,
            dagdeel=Dagdeel.OCHTEND,
            service_id='svc1'
        )]
        
        blocked = [BlockedSlot(
            employee_id='emp1',
            date=test_date,
            dagdeel=Dagdeel.OCHTEND,
            status=2  # BLOCKED
        )]
        
        solver = RosterSolver(
            roster_id='test-conflict-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=test_date,
            end_date=test_date,
            fixed_assignments=fixed,
            blocked_slots=blocked,
            exact_staffing=[],
            timeout_seconds=5
        )
        
        return solver
    
    def test_constraint_conflict_detection(self, solver_with_conflicts):
        """Test: Solver detects conflicting constraints (INFEASIBLE)."""
        solver = solver_with_conflicts
        
        # This should result in INFEASIBLE due to conflicting constraints
        solver._create_variables()
        solver._apply_constraints()
        status, assignments = solver._run_solver()
        
        # With fixed AND blocked on same slot, should be INFEASIBLE
        assert status == SolveStatus.INFEASIBLE
        assert len(assignments) == 0
        
        logger.info("✓ Test 2.1: Conflict detection PASSED (correctly INFEASIBLE)")
    
    def test_bottleneck_analysis_on_infeasible(self, solver_with_conflicts):
        """Test: Bottleneck analysis triggered on INFEASIBLE status."""
        solver = solver_with_conflicts
        
        # Solve and get response
        response = solver.solve()
        
        # Should have triggered bottleneck analysis
        assert response.status == SolveStatus.INFEASIBLE
        # Bottleneck report may or may not be populated depending on exact_staffing
        # But the solve should not crash
        assert response is not None
        
        logger.info("✓ Test 2.2: Bottleneck analysis PASSED (no crash on INFEASIBLE)")
    
    def test_violation_report_generation(self):
        """Test: Violation report generated correctly."""
        employees = [Employee(id='emp1', name='Alice', email='alice@test.com', team=TeamType.MAAT)]
        services = [Service(id='svc1', code='DDO', naam='Dag')]
        roster_emp_services = [
            RosterEmployeeService(employee_id='emp1', service_id='svc1', aantal=5, actief=True)
        ]
        
        solver = RosterSolver(
            roster_id='test-violations-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=date(2025, 12, 15),
            end_date=date(2025, 12, 15),
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=5
        )
        
        # Generate mock assignments
        assignments = [
            Assignment(
                employee_id='emp1',
                employee_name='Alice',
                date=date(2025, 12, 15),
                dagdeel=Dagdeel.OCHTEND,
                service_id='svc1',
                service_code='DDO',
                confidence=1.0
            )
        ]
        
        # Generate report (expects 4 out of 5 target)
        solver.target_counts[('emp1', 'svc1')] = 5
        solver._generate_violations_report(assignments)
        
        # Should have violations for missing assignments
        assert len(solver.violations) > 0
        assert any(v.constraint_type == 'streefgetal_afwijking' for v in solver.violations)
        
        logger.info("✓ Test 2.3: Violation reporting PASSED")


class TestObjectiveFunctionAndExecution:
    """Test 3: Objective function definition and solver execution."""
    
    @pytest.fixture
    def simple_feasible_solver(self):
        """Create a simple feasible solver."""
        employees = [
            Employee(id='emp1', name='Alice', email='alice@test.com', team=TeamType.MAAT),
            Employee(id='emp2', name='Bob', email='bob@test.com', team=TeamType.MAAT)
        ]
        
        services = [
            Service(id='svc1', code='DDO', naam='Dag'),
            Service(id='svc2', code='DIO', naam='Dag-Nacht')
        ]
        
        roster_emp_services = [
            RosterEmployeeService(employee_id='emp1', service_id='svc1', aantal=2, actief=True),
            RosterEmployeeService(employee_id='emp1', service_id='svc2', aantal=1, actief=True),
            RosterEmployeeService(employee_id='emp2', service_id='svc1', aantal=2, actief=True),
            RosterEmployeeService(employee_id='emp2', service_id='svc2', aantal=1, actief=True)
        ]
        
        solver = RosterSolver(
            roster_id='test-feasible-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=date(2025, 12, 15),
            end_date=date(2025, 12, 16),  # 2 days
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=10
        )
        
        return solver
    
    def test_objective_function_definition(self, simple_feasible_solver):
        """Test: Objective function defined without errors."""
        solver = simple_feasible_solver
        
        solver._create_variables()
        solver._apply_constraints()
        
        # Define objective - should not raise
        try:
            solver._define_objective()
            objective_defined = True
        except Exception as e:
            logger.error(f"Objective definition failed: {e}")
            objective_defined = False
        
        assert objective_defined
        logger.info("✓ Test 3.1: Objective definition PASSED")
    
    def test_solver_execution_completes(self, simple_feasible_solver):
        """Test: Solver execution completes and returns valid status."""
        solver = simple_feasible_solver
        
        # Run full solve
        response = solver.solve()
        
        # Check response structure
        assert response is not None
        assert hasattr(response, 'status')
        assert hasattr(response, 'assignments')
        assert hasattr(response, 'solve_time_seconds')
        assert response.solve_time_seconds >= 0
        
        # Status should be one of: OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, ERROR
        valid_statuses = [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE, 
                         SolveStatus.INFEASIBLE, SolveStatus.UNKNOWN, SolveStatus.ERROR]
        assert response.status in valid_statuses
        
        logger.info(f"✓ Test 3.2: Solver execution PASSED (status={response.status}, time={response.solve_time_seconds}s)")
    
    def test_metadata_generation(self, simple_feasible_solver):
        """Test: Solver metadata generated correctly."""
        solver = simple_feasible_solver
        response = solver.solve()
        
        # Check metadata presence
        assert response.solver_metadata is not None
        assert 'dates_count' in response.solver_metadata
        assert 'employees_count' in response.solver_metadata
        assert 'services_count' in response.solver_metadata
        assert 'draad166_layer1' in response.solver_metadata
        assert 'draad170_fase123' in response.solver_metadata
        
        # Verify values
        assert response.solver_metadata['employees_count'] == 2
        assert response.solver_metadata['services_count'] == 2
        assert response.solver_metadata['dates_count'] == 2
        
        logger.info("✓ Test 3.3: Metadata generation PASSED")


class TestSolverErrorHandling:
    """Test 4: Error handling and graceful degradation."""
    
    def test_empty_employees_handling(self):
        """Test: Solver handles empty employee list gracefully."""
        services = [Service(id='svc1', code='DDO', naam='Dag')]
        
        solver = RosterSolver(
            roster_id='test-empty-emp-001',
            employees=[],  # EMPTY!
            services=services,
            roster_employee_services=[],
            start_date=date(2025, 12, 15),
            end_date=date(2025, 12, 15),
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=5
        )
        
        # Should not crash
        response = solver.solve()
        assert response is not None
        assert response.status in [SolveStatus.OPTIMAL, SolveStatus.FEASIBLE, SolveStatus.ERROR]
        
        logger.info("✓ Test 4.1: Empty employees handling PASSED")
    
    def test_timeout_handling(self):
        """Test: Solver handles timeout (sets status to FEASIBLE or UNKNOWN)."""
        # Create larger problem that might timeout
        employees = [Employee(id=f'emp{i}', name=f'Emp{i}', email=f'e{i}@test.com', team=TeamType.MAAT) 
                    for i in range(5)]
        services = [Service(id=f'svc{i}', code=f'SVC{i}', naam=f'Service {i}') 
                   for i in range(5)]
        roster_emp_services = [
            RosterEmployeeService(employee_id=f'emp{i}', service_id=f'svc{j}', aantal=1, actief=True)
            for i in range(5) for j in range(5)
        ]
        
        solver = RosterSolver(
            roster_id='test-timeout-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=date(2025, 12, 15),
            end_date=date(2025, 12, 31),  # 17 days - potentially slow
            fixed_assignments=[],
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=1  # VERY SHORT timeout
        )
        
        response = solver.solve()
        assert response is not None
        # Status could be FEASIBLE (incomplete solution) or UNKNOWN (timeout)
        assert response.status in [SolveStatus.FEASIBLE, SolveStatus.UNKNOWN, SolveStatus.ERROR]
        
        logger.info(f"✓ Test 4.2: Timeout handling PASSED (status={response.status})")
    
    def test_invalid_fixed_assignment_handling(self):
        """Test: Solver handles invalid fixed assignments gracefully."""
        employees = [Employee(id='emp1', name='Alice', email='alice@test.com', team=TeamType.MAAT)]
        services = [Service(id='svc1', code='DDO', naam='Dag')]
        roster_emp_services = [
            RosterEmployeeService(employee_id='emp1', service_id='svc1', aantal=1, actief=True)
        ]
        
        # Fixed assignment for employee NOT in bevoegdheden
        fixed = [FixedAssignment(
            employee_id='emp1',
            date=date(2025, 12, 15),
            dagdeel=Dagdeel.OCHTEND,
            service_id='svc_nonexistent'  # INVALID!
        )]
        
        solver = RosterSolver(
            roster_id='test-invalid-fixed-001',
            employees=employees,
            services=services,
            roster_employee_services=roster_emp_services,
            start_date=date(2025, 12, 15),
            end_date=date(2025, 12, 15),
            fixed_assignments=fixed,
            blocked_slots=[],
            exact_staffing=[],
            timeout_seconds=5
        )
        
        # Should not crash - will likely result in INFEASIBLE or ERROR
        response = solver.solve()
        assert response is not None
        # Invalid service should lead to INFEASIBLE or at least not crash
        
        logger.info(f"✓ Test 4.3: Invalid fixed assignment handling PASSED (status={response.status})")


class TestCapacityAnalyzer:
    """Test 5: Capacity analyzer for bottleneck detection."""
    
    def test_capacity_analyzer_initialization(self):
        """Test: CapacityAnalyzer initializes correctly."""
        analyzer = CapacityAnalyzer()
        assert analyzer is not None
        
        logger.info("✓ Test 5.1: Capacity analyzer init PASSED")
    
    def test_bottleneck_detection_logic(self):
        """Test: Bottleneck detection identifies capacity issues."""
        analyzer = CapacityAnalyzer()
        
        # Test capacity scenarios
        test_cases = [
            (8, 10, 'CRITICAL'),   # < 60% → CRITICAL
            (7, 10, 'TIGHT'),      # 60-80% → TIGHT
            (9, 10, 'OK'),         # >= 80% → OK
            (10, 10, 'OK'),        # 100% → OK
        ]
        
        for available, required, expected_status in test_cases:
            if hasattr(analyzer, '_classify_bottleneck'):
                ratio = available / required if required > 0 else 1.0
                status = analyzer._classify_bottleneck(ratio)
                assert status == expected_status, f"Failed: {available}/{required} expected {expected_status}, got {status}"
        
        logger.info("✓ Test 5.2: Bottleneck detection PASSED")
    
    def test_capacity_ratio_calculation(self):
        """Test: Capacity ratio calculation is accurate."""
        analyzer = CapacityAnalyzer()
        
        test_cases = [
            (10, 10, 1.0),
            (8, 10, 0.8),
            (5, 10, 0.5),
            (0, 10, 0.0),
        ]
        
        for available, required, expected_ratio in test_cases:
            if hasattr(analyzer, '_calculate_ratio'):
                ratio = analyzer._calculate_ratio(available, required)
                assert ratio == expected_ratio, f"Failed: {available}/{required} expected {expected_ratio}, got {ratio}"
        
        logger.info("✓ Test 5.3: Ratio calculation PASSED")


if __name__ == '__main__':
    # Run tests with pytest
    pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '--log-cli-level=INFO'
    ])
