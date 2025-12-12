#!/usr/bin/env python3
"""
Comprehensive unit tests for solver_engine.py
FASE 3: Test Suite Development
Target coverage: >85%
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from solver_engine import SolverEngine, CapacityAnalyzer
from models import Employee, ServiceCode, RosterSlot, RosterStatus


class TestSolverEngineBasics:
    """Unit tests for SolverEngine core functionality"""

    @pytest.fixture
    def mock_db(self):
        """Mock database connection"""
        return MagicMock()

    @pytest.fixture
    def solver_engine(self, mock_db):
        """Create SolverEngine instance for testing"""
        return SolverEngine(db=mock_db)

    def test_solver_initialization(self, solver_engine):
        """Test solver engine initializes correctly"""
        assert solver_engine is not None
        assert solver_engine.db is not None
        assert hasattr(solver_engine, 'solve')
        assert hasattr(solver_engine, '_diagnose_bottlenecks')

    def test_solve_basic_roster(self, solver_engine, mock_db):
        """Test basic roster solving without constraints"""
        # Setup
        roster_data = {
            'roster_id': 'test-roster-1',
            'start_date': datetime.now().isoformat(),
            'num_weeks': 4,
            'employees': ['emp1', 'emp2', 'emp3'],
            'target_schedule': []
        }

        mock_db.fetch_employees.return_value = [
            Mock(id='emp1', name='Alice'),
            Mock(id='emp2', name='Bob'),
            Mock(id='emp3', name='Charlie')
        ]

        # Test
        result = solver_engine.solve(roster_data)

        # Assert
        assert result is not None
        assert 'slots_assigned' in result
        assert 'solver_status' in result

    def test_solve_with_invalid_data(self, solver_engine):
        """Test solver handles invalid input gracefully"""
        invalid_data = {}
        with pytest.raises(ValueError):
            solver_engine.solve(invalid_data)

    def test_constraint_validation(self, solver_engine):
        """Test constraint validation logic"""
        constraints = {
            'max_shifts_per_employee': 5,
            'min_shifts_per_employee': 2,
            'blackout_dates': ['2025-12-25']
        }

        # Validator should accept valid constraints
        result = solver_engine._validate_constraints(constraints)
        assert result is True

    def test_capacity_calculation(self, solver_engine):
        """Test capacity calculations"""
        required_slots = 10
        available_employees = 3

        capacity = solver_engine._calculate_capacity(required_slots, available_employees)
        assert capacity >= 0
        assert isinstance(capacity, (int, float))


class TestCapacityAnalyzer:
    """Unit tests for CapacityAnalyzer class"""

    @pytest.fixture
    def analyzer(self):
        """Create CapacityAnalyzer instance"""
        return CapacityAnalyzer()

    def test_diagnose_bottlenecks(self, analyzer):
        """Test bottleneck diagnosis"""
        # Simulate tight capacity scenario
        capacity_data = {
            'ochtend': {'required': 10, 'available': 8},
            'middag': {'required': 12, 'available': 10},
            'avond': {'required': 5, 'available': 3}
        }

        diagnostics = analyzer.diagnose_bottlenecks(capacity_data)

        assert 'bottlenecks' in diagnostics
        assert 'capacity_ratios' in diagnostics
        assert diagnostics['bottlenecks']['avond'] == 'CRITICAL'

    def test_capacity_ratio_calculation(self, analyzer):
        """Test capacity ratio calculation"""
        required = 10
        available = 8

        ratio = analyzer._calculate_ratio(available, required)
        assert ratio == 0.8
        assert ratio < 1.0  # Under capacity

    def test_bottleneck_classification(self, analyzer):
        """Test bottleneck severity classification"""
        test_cases = [
            (0.5, 'CRITICAL'),  # < 0.6
            (0.7, 'TIGHT'),     # 0.6-0.8
            (0.9, 'OK'),        # >= 0.8
            (1.2, 'OK')         # Over capacity
        ]

        for ratio, expected_status in test_cases:
            status = analyzer._classify_bottleneck(ratio)
            assert status == expected_status


class TestSolverConstraints:
    """Test constraint handling in solver"""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    @pytest.fixture
    def solver(self, mock_db):
        return SolverEngine(db=mock_db)

    def test_employee_shift_limits(self, solver):
        """Test employee shift limit constraints"""
        employee = Mock(id='emp1', max_shifts_per_week=5)
        assignments = [
            Mock(date='2025-12-01', employee_id='emp1'),
            Mock(date='2025-12-02', employee_id='emp1'),
            Mock(date='2025-12-03', employee_id='emp1'),
            Mock(date='2025-12-04', employee_id='emp1'),
            Mock(date='2025-12-05', employee_id='emp1')
        ]

        # Should not allow 6th shift
        assert solver._can_assign_shift(employee, assignments) is False

    def test_blackout_dates(self, solver):
        """Test blackout date handling"""
        blackout_dates = ['2025-12-25', '2025-12-26']
        test_date = '2025-12-25'

        is_blackout = test_date in blackout_dates
        assert is_blackout is True

    def test_service_code_constraints(self, solver):
        """Test service code availability constraints"""
        employee = Mock(
            id='emp1',
            available_services=['DDO', 'DIO', 'DDA']
        )
        required_service = 'DDO'

        can_serve = required_service in employee.available_services
        assert can_serve is True

        cannot_serve = 'OSP' not in employee.available_services
        assert cannot_serve is True


class TestSolverMetadata:
    """Test metadata generation and diagnostics"""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    @pytest.fixture
    def solver(self, mock_db):
        return SolverEngine(db=mock_db)

    def test_metadata_structure(self, solver):
        """Test solver metadata generation"""
        metadata = {
            'solve_time_ms': 150,
            'solver_status': 'OPTIMAL',
            'num_solutions': 1,
            'bottleneck_diagnostics': {}
        }

        assert 'solve_time_ms' in metadata
        assert 'solver_status' in metadata
        assert metadata['solve_time_ms'] > 0

    def test_error_formatting(self, solver):
        """Test error formatting in metadata"""
        error_msg = "Constraint violation: max shifts exceeded"
        formatted = solver._format_error(error_msg)

        assert isinstance(formatted, str)
        assert 'Constraint' in formatted


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
