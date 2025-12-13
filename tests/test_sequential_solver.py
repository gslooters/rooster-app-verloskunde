#!/usr/bin/env python3
# DRAAD172: Sequential Solver Test Suite
# Status: Unit tests for priority sorting + solver logic
# Date: 2025-12-13

import pytest
from datetime import date
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from solver.requirement_queue import Requirement, RequirementQueue
from solver.employee_availability import EmployeeAvailabilityTracker
from solver.sequential_solver import SequentialSolver, Assignment


class TestRequirementQueue:
    """Test priority sorting"""
    
    def test_system_priority_ochtend(self):
        """System services BEFORE TOT (Ochtend)"""
        reqs = [
            Requirement(date(2025, 11, 24), 'O', 'tot-id', 'ECH', 2, team='TOT'),
            Requirement(date(2025, 11, 24), 'O', 'dio-id', 'DIO', 3, is_system=True),
            Requirement(date(2025, 11, 24), 'O', 'ddo-id', 'DDO', 2, is_system=True),
        ]
        
        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        
        # Check order: DIO → DDO → ECH
        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'DDO'
        assert sorted_reqs[2].service_code == 'ECH'
    
    def test_system_priority_avond(self):
        """System services in correct order for Avond"""
        reqs = [
            Requirement(date(2025, 11, 24), 'A', 'dda-id', 'DDA', 2, is_system=True),
            Requirement(date(2025, 11, 24), 'A', 'dia-id', 'DIA', 3, is_system=True),
        ]
        
        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        
        # Check order: DIA → DDA (avond order)
        assert sorted_reqs[0].service_code == 'DIA'
        assert sorted_reqs[1].service_code == 'DDA'
    
    def test_tot_alphabetic(self):
        """TOT services sorted alphabetically"""
        reqs = [
            Requirement(date(2025, 11, 24), 'O', 'swz-id', 'SWZ', 3, team='TOT'),
            Requirement(date(2025, 11, 24), 'O', 'ech-id', 'ECH', 2, team='TOT'),
            Requirement(date(2025, 11, 24), 'O', 'mdh-id', 'MDH', 1, team='TOT'),
        ]
        
        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        
        # Check order: ECH → MDH → SWZ (alphabetic)
        assert sorted_reqs[0].service_code == 'ECH'
        assert sorted_reqs[1].service_code == 'MDH'
        assert sorted_reqs[2].service_code == 'SWZ'
    
    def test_team_after_tot(self):
        """Team services (GRO/ORA) AFTER TOT"""
        reqs = [
            Requirement(date(2025, 11, 24), 'O', 'osp-id', 'OSP', 2, team='ORA'),
            Requirement(date(2025, 11, 24), 'O', 'tot-id', 'ECH', 2, team='TOT'),
            Requirement(date(2025, 11, 24), 'O', 'dio-id', 'DIO', 3, is_system=True),
        ]
        
        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        
        # Check order: DIO → ECH → OSP
        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'ECH'
        assert sorted_reqs[2].service_code == 'OSP'
    
    def test_cluster_by_timeblock(self):
        """Requirements clustered by date + dagdeel"""
        reqs = [
            # Day 2
            Requirement(date(2025, 11, 25), 'O', 'dio-id', 'DIO', 1, is_system=True),
            # Day 1
            Requirement(date(2025, 11, 24), 'A', 'osp-id', 'OSP', 1, team='ORA'),
            # Day 1
            Requirement(date(2025, 11, 24), 'O', 'ech-id', 'ECH', 1, team='TOT'),
        ]
        
        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        
        # Check date/dagdeel clustering
        assert sorted_reqs[0].date == date(2025, 11, 24)
        assert sorted_reqs[0].dagdeel == 'O'
        assert sorted_reqs[1].date == date(2025, 11, 24)
        assert sorted_reqs[1].dagdeel == 'A'
        assert sorted_reqs[2].date == date(2025, 11, 25)


class TestEmployeeAvailability:
    """Test availability constraints"""
    
    def test_eligibility_check(self):
        """Employee competency check"""
        # Mock DB
        class MockDB:
            def execute(self, sql, params):
                return MockResult([
                    {'employee_id': 'emp1', 'service_code': 'DIO', 'target_count': 5}
                ])
        
        class MockResult:
            def __init__(self, rows):
                self.rows = rows
            def fetchall(self):
                return self.rows
        
        tracker = EmployeeAvailabilityTracker(MockDB())
        tracker.load_competencies('roster1')
        
        # emp1 has DIO
        assert tracker.is_eligible('emp1', 'DIO') is True
        # emp1 doesn't have ECH
        assert tracker.is_eligible('emp1', 'ECH') is False
        # emp2 unknown
        assert tracker.is_eligible('emp2', 'DIO') is False
    
    def test_remaining_calculation(self):
        """Remaining positions calculation"""
        # Target: 5, Current: 2 → Remaining: 3
        class MockDB:
            def execute(self, sql, params):
                class R:
                    def fetchall(self):
                        return [{'employee_id': 'emp1', 'service_code': 'DIO', 'target_count': 5}]
                return R()
        
        tracker = EmployeeAvailabilityTracker(MockDB())
        tracker.competencies['emp1'] = {'DIO'}
        tracker.targets[('emp1', 'DIO')] = 5
        tracker.assigned_count[('emp1', 'DIO')] = 2
        
        remaining = tracker.get_remaining('emp1', 'DIO')
        assert remaining == 3
    
    def test_remaining_zero_if_exceeded(self):
        """Remaining is 0 if target already met/exceeded"""
        tracker = EmployeeAvailabilityTracker(None)
        tracker.targets[('emp1', 'DIO')] = 3
        tracker.assigned_count[('emp1', 'DIO')] = 5  # Already exceeded
        
        remaining = tracker.get_remaining('emp1', 'DIO')
        assert remaining == 0


class TestSequentialSolver:
    """Test solver algorithm"""
    
    def test_solver_initialization(self):
        """Solver initializes correctly"""
        class MockDB:
            def execute(self, sql, params):
                class R:
                    def fetchall(self):
                        return []
                    def fetchone(self):
                        return None
                return R()
        
        solver = SequentialSolver(MockDB())
        assert len(solver.assignments) == 0
        assert len(solver.unfulfilled) == 0
    
    def test_assignment_creation(self):
        """Assignment objects created correctly"""
        assign = Assignment('emp1', 'service1', date(2025, 11, 24), 'O')
        assert assign.employee_id == 'emp1'
        assert assign.service_id == 'service1'
        assert assign.assignment_date == date(2025, 11, 24)
        assert assign.dagdeel == 'O'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
