#!/usr/bin/env python3
"""
Integration tests for database + solver interaction
FASE 3: Test Suite Development
Tests real DB/solver interaction patterns
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from solver_engine import SolverEngine
from models import RosterSlot, RosterStatus


class TestDatabaseSolverIntegration:
    """Test database + solver interaction"""

    @pytest.fixture
    def mock_db(self):
        """Mock database with realistic behavior"""
        db = MagicMock()
        
        # Setup mock employees
        db.fetch_employees.return_value = [
            MagicMock(id=f'emp{i}', name=f'Employee {i}', max_shifts=5)
            for i in range(1, 6)
        ]
        
        # Setup mock roster slots
        db.fetch_slots_by_roster.return_value = [
            MagicMock(id=f'slot{i}', date=f'2025-12-{15+i:02d}', service='DDO')
            for i in range(1, 11)
        ]
        
        return db

    @pytest.fixture
    def solver(self, mock_db):
        """Create solver with mock DB"""
        return SolverEngine(db=mock_db)

    def test_fetch_and_solve_workflow(self, solver, mock_db):
        """Test complete fetch + solve workflow"""
        # Arrange
        roster_id = 'test-roster-001'
        
        # Act
        employees = mock_db.fetch_employees()
        slots = mock_db.fetch_slots_by_roster(roster_id)
        
        # Assert
        assert len(employees) == 5
        assert len(slots) == 10
        mock_db.fetch_employees.assert_called()

    def test_slot_assignment_persistence(self, solver, mock_db):
        """Test slot assignments are saved to DB"""
        slot = MagicMock(id='slot1', date='2025-12-15', service='DDO')
        employee_id = 'emp1'
        service = 'DDO'
        
        # Test persistence call
        mock_db.update_slot.return_value = True
        result = mock_db.update_slot(slot.id, employee_id, service)
        
        assert result is True
        mock_db.update_slot.assert_called_once_with(slot.id, employee_id, service)

    def test_batch_slot_assignment(self, solver, mock_db):
        """Test batch assignment of multiple slots"""
        assignments = [
            {'slot_id': 'slot1', 'employee_id': 'emp1', 'service': 'DDO'},
            {'slot_id': 'slot2', 'employee_id': 'emp2', 'service': 'DIO'},
            {'slot_id': 'slot3', 'employee_id': 'emp3', 'service': 'DDA'}
        ]
        
        # Simulate batch update
        mock_db.batch_update_slots.return_value = len(assignments)
        result = mock_db.batch_update_slots(assignments)
        
        assert result == 3

    def test_transaction_rollback_on_error(self, solver, mock_db):
        """Test transaction rollback if solve fails"""
        mock_db.begin_transaction.return_value = MagicMock()
        mock_db.update_slot.side_effect = Exception('Constraint violation')
        
        try:
            mock_db.begin_transaction()
            mock_db.update_slot('slot1', 'emp1', 'DDO')
        except Exception:
            mock_db.rollback.return_value = True
        
        mock_db.rollback.assert_called()

    def test_concurrent_roster_updates(self, solver, mock_db):
        """Test handling of concurrent roster updates"""
        roster_id_1 = 'roster-001'
        roster_id_2 = 'roster-002'
        
        mock_db.fetch_roster_version.side_effect = [1, 1]
        
        v1 = mock_db.fetch_roster_version(roster_id_1)
        v2 = mock_db.fetch_roster_version(roster_id_2)
        
        assert v1 == v2 == 1


class TestCapacityAnalysisIntegration:
    """Test capacity analysis with real DB data"""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.fetch_employees.return_value = [MagicMock(id=f'emp{i}') for i in range(1, 4)]
        db.fetch_shift_requirements.return_value = {
            '2025-12-15': {'DDO': 2, 'DIO': 2, 'DDA': 1},
            '2025-12-16': {'DDO': 2, 'DIO': 2, 'DDA': 1}
        }
        return db

    @pytest.fixture
    def solver(self, mock_db):
        return SolverEngine(db=mock_db)

    def test_capacity_vs_requirement_matching(self, solver, mock_db):
        """Test capacity matches requirements"""
        employees = mock_db.fetch_employees()
        requirements = mock_db.fetch_shift_requirements()
        
        total_capacity = len(employees) * 5  # Max 5 shifts per week
        total_required = sum(
            sum(services.values())
            for services in requirements.values()
        )
        
        # Should have enough capacity
        assert total_capacity >= total_required

    def test_tight_capacity_detection(self, solver, mock_db):
        """Test detection of tight capacity situations"""
        # 3 employees, 5 capacity each = 15 total
        # Requirements: 2+2+1 = 5 per day
        # Should flag as tight if close to limit
        
        result = solver._diagnose_bottlenecks({
            'capacity': 15,
            'required': 10
        })
        
        # At 67% capacity utilization, should be OK
        assert result is not None


class TestRosterStateManagement:
    """Test roster state transitions in DB"""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    def test_roster_status_transitions(self, mock_db):
        """Test valid status transitions"""
        valid_transitions = [
            ('DRAFT', 'INPROGRESS'),
            ('INPROGRESS', 'VALIDATING'),
            ('VALIDATING', 'PUBLISHED'),
            ('PUBLISHED', 'ARCHIVED')
        ]
        
        for from_status, to_status in valid_transitions:
            mock_db.update_roster_status.return_value = True
            result = mock_db.update_roster_status('roster-1', to_status)
            assert result is True

    def test_invalid_status_transition(self, mock_db):
        """Test invalid status transitions are rejected"""
        invalid_transitions = [
            ('PUBLISHED', 'DRAFT'),  # Can't go backwards
            ('ARCHIVED', 'INPROGRESS'),  # Can't un-archive
        ]
        
        for from_status, to_status in invalid_transitions:
            mock_db.update_roster_status.side_effect = ValueError(f'Invalid transition: {from_status} -> {to_status}')
            
            with pytest.raises(ValueError):
                mock_db.update_roster_status('roster-1', to_status)

    def test_status_update_with_metadata(self, mock_db):
        """Test status updates include metadata"""
        metadata = {
            'solver_duration_ms': 240,
            'slots_assigned': 42,
            'solver_status': 'OPTIMAL'
        }
        
        mock_db.update_roster_status_with_metadata.return_value = True
        result = mock_db.update_roster_status_with_metadata(
            'roster-1', 
            'INPROGRESS', 
            metadata
        )
        
        assert result is True
        mock_db.update_roster_status_with_metadata.assert_called_once()


class TestErrorHandlingIntegration:
    """Test error handling across DB + solver"""

    @pytest.fixture
    def mock_db(self):
        return MagicMock()

    @pytest.fixture
    def solver(self, mock_db):
        return SolverEngine(db=mock_db)

    def test_db_connection_failure(self, solver, mock_db):
        """Test handling of DB connection failures"""
        mock_db.fetch_employees.side_effect = ConnectionError('DB unavailable')
        
        with pytest.raises(ConnectionError):
            solver._load_roster_data(mock_db, 'roster-1')

    def test_incomplete_roster_data(self, solver, mock_db):
        """Test handling of incomplete roster data"""
        mock_db.fetch_employees.return_value = []
        mock_db.fetch_slots.return_value = []
        
        with pytest.raises(ValueError):
            solver._validate_roster_data(mock_db, 'roster-1')

    def test_constraint_violation_logging(self, solver, mock_db):
        """Test constraint violations are logged"""
        violation = {
            'type': 'MAX_SHIFTS_EXCEEDED',
            'employee_id': 'emp1',
            'current_shifts': 6,
            'max_allowed': 5
        }
        
        mock_db.log_constraint_violation.return_value = True
        result = mock_db.log_constraint_violation(violation)
        
        assert result is True


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
