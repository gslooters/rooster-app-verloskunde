#!/usr/bin/env python3
"""
Unit tests voor SequentialSolverV2

Test coverage voor:
  - Requirement loading en sorting
  - Employee availability tracking
  - Priority queue logic
  - Error handling
  - Database integration
"""

import pytest
from datetime import date, timedelta
from unittest.mock import Mock, MagicMock, patch
from sequential_solver_v2 import (
    SequentialSolverV2,
    RequirementQueue,
    EmployeeAvailabilityTracker,
    Requirement,
    Employee,
    Service,
    Assignment,
    Dagdeel,
    SolveStatus,
    ConstraintViolation
)


class TestRequirementQueue:
    """Test RequirementQueue functionality."""
    
    def test_load_from_db(self):
        """RequirementQueue loads from database."""
        # Mock database
        db = MagicMock()
        queue = RequirementQueue("test-roster", db)
        
        # Create mock requirements data
        mock_data = [
            {
                'service_id': 'svc1',
                'date': '2025-12-29',
                'dagdeel': 'O',
                'team': 'TOT',
                'aantal': 2
            }
        ]
        
        db.table.return_value.select.return_value.execute.return_value.data = mock_data
        
        services = {'svc1': Service(id='svc1', code='DIO', naam='DIO')}
        requirements = queue.load_from_db(services)
        
        assert len(requirements) > 0
        assert requirements[0].dagdeel == 'O'
        assert requirements[0].count_needed == 2
    
    def test_sort_by_priority(self):
        """RequirementQueue sorts by 3-layer priority."""
        db = MagicMock()
        queue = RequirementQueue("test-roster", db)
        queue.services_cache = {
            'dio': Service(id='dio', code='DIO', naam='DIO'),
            'ddo': Service(id='ddo', code='DDO', naam='DDO'),
            'dia': Service(id='dia', code='DIA', naam='DIA'),
            'dda': Service(id='dda', code='DDA', naam='DDA'),
        }
        
        # Create mixed requirements
        requirements = [
            Requirement(
                service_id='dia', date=date(2025, 12, 29), 
                dagdeel='A', team='TOT', priority=10, count_needed=1, service_code='DIA'
            ),
            Requirement(
                service_id='dio', date=date(2025, 12, 29),
                dagdeel='O', team='TOT', priority=10, count_needed=2, service_code='DIO'
            ),
            Requirement(
                service_id='ddo', date=date(2025, 12, 29),
                dagdeel='O', team='TOT', priority=10, count_needed=1, service_code='DDO'
            ),
        ]
        
        sorted_reqs = queue.sort_by_priority(requirements)
        
        # DIO should come before DDO (same dagdeel, DIO first)
        dio_idx = next(i for i, r in enumerate(sorted_reqs) if r.service_code == 'DIO')
        ddo_idx = next(i for i, r in enumerate(sorted_reqs) if r.service_code == 'DDO')
        assert dio_idx < ddo_idx
        
        # DIO (ochtend) should come before DIA (avond)
        dia_idx = next(i for i, r in enumerate(sorted_reqs) if r.service_code == 'DIA')
        assert dio_idx < dia_idx


class TestEmployeeAvailabilityTracker:
    """Test EmployeeAvailabilityTracker functionality."""
    
    def test_initialize_tracker(self):
        """Tracker initializes with blocked slots."""
        db = MagicMock()
        employees = {'emp1': Employee(id='emp1', voornaam='Test', achternaam='User')}
        
        # Mock blocked slots
        mock_blocked = [
            {'employee_id': 'emp1', 'date': '2025-12-29', 'dagdeel': 'O', 'status': 2}
        ]
        db.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = mock_blocked
        
        tracker = EmployeeAvailabilityTracker('test-roster', db, employees)
        
        assert ('emp1', date(2025, 12, 29), 'O') in tracker.blocked_slots
    
    def test_is_available(self):
        """Tracker correctly reports availability."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
        
        emp = Employee(id='emp1', voornaam='Test', achternaam='User')
        employees = {'emp1': emp}
        
        tracker = EmployeeAvailabilityTracker('test-roster', db, employees)
        
        # Should be available
        assert tracker.is_available('emp1', date(2025, 12, 29), 'O')
        
        # Assign and check not available
        tracker.assign('emp1', 'svc1', date(2025, 12, 29), 'O')
        assert not tracker.is_available('emp1', date(2025, 12, 29), 'O')
        
        # Different dagdeel should be available
        assert tracker.is_available('emp1', date(2025, 12, 29), 'M')
    
    def test_assignment_counting(self):
        """Tracker counts assignments correctly."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
        
        employees = {'emp1': Employee(id='emp1', voornaam='Test', achternaam='User')}
        tracker = EmployeeAvailabilityTracker('test-roster', db, employees)
        
        # Assign same service twice
        tracker.assign('emp1', 'svc1', date(2025, 12, 29), 'O')
        tracker.assign('emp1', 'svc1', date(2025, 12, 30), 'O')
        
        assert tracker.get_assigned_count('emp1', 'svc1') == 2
    
    def test_structureel_nbh_blocking(self):
        """Tracker respects structureel_nbh."""
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = []
        
        # Employee blocked on Monday morning
        emp = Employee(
            id='emp1',
            voornaam='Test',
            achternaam='User',
            structureel_nbh={'ma': ['O']}  # Monday morning blocked
        )
        employees = {'emp1': emp}
        
        tracker = EmployeeAvailabilityTracker('test-roster', db, employees)
        
        # Monday is 2025-12-29 (first day of rooster)
        monday = date(2025, 12, 29)
        
        # Should be blocked for morning, available for afternoon
        assert not tracker.is_available('emp1', monday, 'O')
        assert tracker.is_available('emp1', monday, 'M')


class TestSequentialSolverV2:
    """Test SequentialSolverV2 functionality."""
    
    def test_solver_instantiation(self):
        """Solver can be instantiated."""
        db = MagicMock()
        solver = SequentialSolverV2('test-roster', db)
        
        assert solver.roster_id == 'test-roster'
        assert len(solver.assignments) == 0
        assert len(solver.failures) == 0
    
    @patch('sequential_solver_v2.RequirementQueue')
    @patch('sequential_solver_v2.EmployeeAvailabilityTracker')
    def test_solve_with_empty_requirements(self, mock_tracker, mock_queue):
        """Solver handles empty requirements gracefully."""
        db = MagicMock()
        
        # Mock empty requirements
        mock_queue.return_value.load_from_db.return_value = []
        mock_queue.return_value.sort_by_priority.return_value = []
        
        solver = SequentialSolverV2('test-roster', db)
        
        # Mock data loading
        solver._load_data = MagicMock()
        
        response = solver.solve()
        
        assert response.status != SolveStatus.ERROR
        assert len(response.assignments) == 0
    
    def test_filter_eligible_employees(self):
        """Solver correctly filters eligible employees."""
        db = MagicMock()
        solver = SequentialSolverV2('test-roster', db)
        
        # Create test data
        solver.employees = {
            'emp1': Employee(id='emp1', voornaam='Test', achternaam='User1', team='Maat'),
            'emp2': Employee(id='emp2', voornaam='Test', achternaam='User2', team='Loondienst')
        }
        
        # Mock roster_employee_services query
        mock_res = [
            {'employee_id': 'emp1'},
            {'employee_id': 'emp2'}
        ]
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value.data = mock_res
        
        # Create requirement for GRO team (Maat)
        req = Requirement(
            service_id='svc1',
            date=date(2025, 12, 29),
            dagdeel='O',
            team='GRO',  # Only Maat
            priority=10,
            count_needed=1,
            service_code='DIO'
        )
        
        eligible = solver._filter_eligible_employees(req)
        
        # Should only have emp1 (Maat)
        employee_ids = [e.id for e in eligible]
        assert 'emp1' in employee_ids
        assert 'emp2' not in employee_ids  # Loondienst not in GRO
    
    def test_process_requirement(self):
        """Solver processes requirement and assigns employees."""
        db = MagicMock()
        solver = SequentialSolverV2('test-roster', db)
        
        # Setup
        emp = Employee(id='emp1', voornaam='Test', achternaam='User')
        solver.employees = {'emp1': emp}
        
        # Mock tracker
        solver.tracker = MagicMock()
        solver.tracker.is_available.return_value = True
        solver.tracker.get_assigned_count.return_value = 0
        
        # Mock filter method
        solver._filter_eligible_employees = MagicMock(return_value=[emp])
        
        # Create requirement
        req = Requirement(
            service_id='svc1',
            date=date(2025, 12, 29),
            dagdeel='O',
            team='TOT',
            priority=10,
            count_needed=1,
            service_code='DIO'
        )
        
        solver._process_requirement(req)
        
        # Should have 1 assignment
        assert len(solver.assignments) == 1
        assert solver.assignments[0].employee_id == 'emp1'
    
    def test_failure_handling(self):
        """Solver handles failures gracefully."""
        db = MagicMock()
        solver = SequentialSolverV2('test-roster', db)
        
        # Mock empty eligible list
        solver._filter_eligible_employees = MagicMock(return_value=[])
        
        req = Requirement(
            service_id='svc1',
            date=date(2025, 12, 29),
            dagdeel='O',
            team='TOT',
            priority=10,
            count_needed=1,
            service_code='DIO'
        )
        
        solver._process_requirement(req)
        
        # Should have recorded failure
        assert len(solver.failures) == 1
        assert solver.failures[0]['reason'] == 'no_eligible_employees'


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
