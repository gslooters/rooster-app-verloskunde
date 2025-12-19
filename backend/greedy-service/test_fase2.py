"""
Test suite for FASE 2 - GreedySolverV2 and ConstraintValidator
Comprehensive testing of solver algorithm and validation logic
"""

import pytest
from datetime import date, timedelta
from typing import Dict, List
from greedy_solver_v2 import GreedySolverV2, AssignmentRecord
from constraint_validator import ConstraintValidator


class TestGreedySolverV2:
    """Tests for GreedySolverV2"""
    
    @pytest.fixture
    def solver(self):
        """Create solver instance"""
        return GreedySolverV2()
    
    @pytest.fixture
    def sample_data(self):
        """Create sample test data"""
        period_start = date(2025, 1, 1)
        period_end = date(2025, 1, 7)
        
        employees = {
            'EMP001': {
                'target_shifts': 3,
                'skills': ['verloskundige', 'experienced'],
                'name': 'Alice'
            },
            'EMP002': {
                'target_shifts': 3,
                'skills': ['verloskundige'],
                'name': 'Bob'
            },
            'EMP003': {
                'target_shifts': 2,
                'skills': ['student', 'verloskundige'],
                'name': 'Carol'
            }
        }
        
        required_coverage = {}
        for day_offset in range(7):
            current_date = period_start + timedelta(days=day_offset)
            required_coverage[current_date] = {
                'ochtend': 2,
                'middag': 1,
                'avond': 1
            }
        
        return {
            'period_start': period_start,
            'period_end': period_end,
            'employees': employees,
            'required_coverage': required_coverage
        }
    
    def test_solver_initialization(self, solver):
        """Test solver initializes correctly"""
        assert solver is not None
        assert solver.max_consecutive_days == 5
        assert solver.min_rest_days == 2
        assert len(solver.assignments) == 0
    
    def test_solve_basic(self, solver, sample_data):
        """Test basic solving functionality"""
        solution = solver.solve(
            period_start=sample_data['period_start'],
            period_end=sample_data['period_end'],
            employees=sample_data['employees'],
            required_coverage=sample_data['required_coverage']
        )
        
        assert solution['status'] == 'solved'
        assert len(solution['assignments']) > 0
        assert solution['quality_score'] >= 0.0
        assert solution['quality_score'] <= 1.0
    
    def test_employee_priority_calculation(self, solver, sample_data):
        """Test priority calculation logic"""
        work_date = date(2025, 1, 1)
        shift = 'ochtend'
        
        # Employee with all skills - should have high priority
        score = solver._calculate_employee_priority(
            'EMP001', work_date, shift, 3,
            {'verloskundige', 'experienced'},
            {'verloskundige'},
            set()
        )
        
        assert score > 0  # Should be positive
        
        # Unavailable employee - should have very low score
        score_unavailable = solver._calculate_employee_priority(
            'EMP001', work_date, shift, 3,
            {'verloskundige'},
            {'verloskundige'},
            {work_date}  # Mark as unavailable
        )
        
        assert score_unavailable < 0  # Should be negative
    
    def test_consecutive_days_limit(self, solver, sample_data):
        """Test consecutive days constraint is respected"""
        # Manually create consecutive day assignments
        for i in range(6):  # 6 consecutive days
            work_date = sample_data['period_start'] + timedelta(days=i)
            record = AssignmentRecord('EMP001', work_date, 'ochtend')
            solver.assignments.append(record)
            solver.employee_shifts['EMP001'].append((work_date, 'ochtend'))
        
        # Next day should fail
        next_date = sample_data['period_start'] + timedelta(days=6)
        score = solver._calculate_employee_priority(
            'EMP001', next_date, 'ochtend', 3,
            {'verloskundige'},
            {'verloskundige'},
            set()
        )
        
        assert score < 0  # Should be rejected
    
    def test_assignment_record(self):
        """Test AssignmentRecord creation and serialization"""
        record = AssignmentRecord('EMP001', date(2025, 1, 1), 'ochtend', 0.95)
        
        assert record.employee_id == 'EMP001'
        assert record.quality_score == 0.95
        
        record_dict = record.to_dict()
        assert record_dict['employee_id'] == 'EMP001'
        assert record_dict['work_date'] == '2025-01-01'
        assert record_dict['shift'] == 'ochtend'


class TestConstraintValidator:
    """Tests for ConstraintValidator"""
    
    @pytest.fixture
    def validator(self):
        """Create validator instance"""
        return ConstraintValidator()
    
    @pytest.fixture
    def sample_solution(self):
        """Create sample solution for validation"""
        return {
            'status': 'solved',
            'assignments': [
                {
                    'employee_id': 'EMP001',
                    'work_date': '2025-01-01',
                    'shift': 'ochtend',
                    'quality_score': 0.9
                },
                {
                    'employee_id': 'EMP002',
                    'work_date': '2025-01-01',
                    'shift': 'middag',
                    'quality_score': 0.8
                }
            ],
            'violations': []
        }
    
    @pytest.fixture
    def sample_data(self):
        """Create sample test data for validation"""
        period_start = date(2025, 1, 1)
        period_end = date(2025, 1, 7)
        
        employees = {
            'EMP001': {
                'target_shifts': 3,
                'skills': ['verloskundige']
            },
            'EMP002': {
                'target_shifts': 3,
                'skills': ['verloskundige']
            }
        }
        
        required_coverage = {
            date(2025, 1, 1): {'ochtend': 1, 'middag': 1},
            date(2025, 1, 2): {'ochtend': 1, 'middag': 1}
        }
        
        constraints = {
            'max_consecutive_days': 5,
            'min_rest_days': 2,
            'unavailable_dates': {},
            'required_skills_by_shift': {'ochtend': ['verloskundige']}
        }
        
        return {
            'period_start': period_start,
            'period_end': period_end,
            'employees': employees,
            'required_coverage': required_coverage,
            'constraints': constraints
        }
    
    def test_validator_initialization(self, validator):
        """Test validator initializes correctly"""
        assert validator is not None
        assert len(validator.violations) == 0
        assert validator.hard_violations == 0
    
    def test_validate_valid_solution(self, validator, sample_solution, sample_data):
        """Test validation of valid solution"""
        report = validator.validate(
            solution=sample_solution,
            employees=sample_data['employees'],
            required_coverage=sample_data['required_coverage'],
            constraints=sample_data['constraints'],
            period_start=sample_data['period_start'],
            period_end=sample_data['period_end']
        )
        
        assert 'valid' in report
        assert 'total_violations' in report
        assert report['critical_violations'] == 0  # No hard constraint violations
    
    def test_availability_violation_detection(self, validator, sample_data):
        """Test detection of availability violations"""
        # Create solution with unavailable assignment
        solution = {
            'assignments': [
                {
                    'employee_id': 'EMP001',
                    'work_date': '2025-01-01',
                    'shift': 'ochtend'
                }
            ]
        }
        
        # Mark employee as unavailable on that date
        constraints = sample_data['constraints'].copy()
        constraints['unavailable_dates'] = {'EMP001': ['2025-01-01']}
        
        report = validator.validate(
            solution=solution,
            employees=sample_data['employees'],
            required_coverage=sample_data['required_coverage'],
            constraints=constraints,
            period_start=sample_data['period_start'],
            period_end=sample_data['period_end']
        )
        
        assert report['critical_violations'] > 0  # Should have hard constraint violation
    
    def test_coverage_validation(self, validator, sample_data):
        """Test coverage requirement validation"""
        # Create solution with insufficient coverage
        solution = {
            'assignments': [
                {
                    'employee_id': 'EMP001',
                    'work_date': '2025-01-01',
                    'shift': 'ochtend'
                }
            ]
        }
        
        report = validator.validate(
            solution=solution,
            employees=sample_data['employees'],
            required_coverage=sample_data['required_coverage'],
            constraints=sample_data['constraints'],
            period_start=sample_data['period_start'],
            period_end=sample_data['period_end']
        )
        
        # Should report understaffed for middag shift
        assert any(
            'understaffed' in str(v) or v.get('constraint_type') == 'understaffed'
            for v in report['violations']
        )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
