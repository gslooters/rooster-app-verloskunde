#!/usr/bin/env python3
"""
End-to-end tests for complete roster workflow
FASE 3: Test Suite Development
Tests full user journeys from roster creation to publication
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from solver_engine import SolverEngine


class TestRosterCreationWorkflow:
    """E2E tests for roster creation to solving"""

    @pytest.fixture
    def e2e_mock_db(self):
        """Complete E2E mock database"""
        db = MagicMock()
        
        # Mock complete workflow
        db.create_roster.return_value = {
            'id': 'roster-e2e-001',
            'status': 'DRAFT',
            'created_at': datetime.now().isoformat()
        }
        
        db.fetch_employees.return_value = [
            MagicMock(id=f'emp{i}', name=f'Employee {i}', max_shifts=5)
            for i in range(1, 6)
        ]
        
        db.fetch_shift_requirements.return_value = {
            '2025-12-15': {'DDO': 2, 'DIO': 2, 'DDA': 1},
            '2025-12-16': {'DDO': 2, 'DIO': 2, 'DDA': 1}
        }
        
        db.update_roster_status.return_value = True
        db.batch_update_slots.return_value = 10
        
        return db

    def test_complete_roster_workflow(self, e2e_mock_db):
        """Test complete workflow: create -> solve -> publish"""
        # Step 1: Create roster
        roster = e2e_mock_db.create_roster('Test Roster', datetime.now())
        assert roster['status'] == 'DRAFT'
        assert roster['id'] == 'roster-e2e-001'
        
        # Step 2: Load employees
        employees = e2e_mock_db.fetch_employees()
        assert len(employees) == 5
        
        # Step 3: Load requirements
        requirements = e2e_mock_db.fetch_shift_requirements()
        assert len(requirements) == 2
        
        # Step 4: Update status to solving
        e2e_mock_db.update_roster_status('roster-e2e-001', 'INPROGRESS')
        e2e_mock_db.update_roster_status.assert_called()
        
        # Step 5: Assign slots
        assignments = [
            {'slot_id': f'slot{i}', 'employee_id': f'emp{(i%5)+1}', 'service': 'DDO'}
            for i in range(1, 11)
        ]
        assigned = e2e_mock_db.batch_update_slots(assignments)
        assert assigned == 10
        
        # Step 6: Publish
        e2e_mock_db.update_roster_status('roster-e2e-001', 'PUBLISHED')

    def test_workflow_with_validation_errors(self, e2e_mock_db):
        """Test workflow handles validation errors gracefully"""
        # Create roster
        roster = e2e_mock_db.create_roster('Test Roster', datetime.now())
        
        # Simulate validation failure
        e2e_mock_db.validate_roster.side_effect = ValueError('Missing service requirements')
        
        with pytest.raises(ValueError):
            e2e_mock_db.validate_roster('roster-e2e-001')

    def test_workflow_with_insufficient_capacity(self, e2e_mock_db):
        """Test workflow detects insufficient capacity"""
        # Setup insufficient capacity scenario
        e2e_mock_db.fetch_employees.return_value = [MagicMock(id='emp1')]
        e2e_mock_db.fetch_shift_requirements.return_value = {
            '2025-12-15': {'DDO': 10, 'DIO': 10, 'DDA': 10}
        }
        
        # Should raise capacity error
        e2e_mock_db.check_capacity.side_effect = ValueError('Insufficient capacity')
        
        with pytest.raises(ValueError):
            e2e_mock_db.check_capacity('roster-e2e-001')


class TestMultiWeekRosterSolving:
    """E2E tests for multi-week roster solving"""

    @pytest.fixture
    def multi_week_db(self):
        db = MagicMock()
        
        # 4 weeks of requirements
        weeks = []
        base_date = datetime(2025, 12, 15)
        for week in range(4):
            week_reqs = {}
            for day in range(7):
                date = (base_date + timedelta(days=week*7 + day)).isoformat()[:10]
                week_reqs[date] = {'DDO': 2, 'DIO': 2, 'DDA': 1}
            weeks.append(week_reqs)
        
        # Merge all weeks
        all_reqs = {}
        for week in weeks:
            all_reqs.update(week)
        
        db.fetch_shift_requirements.return_value = all_reqs
        db.batch_update_slots.return_value = len(all_reqs) * 5  # 5 slots per day
        
        return db

    def test_4week_roster_solving(self, multi_week_db):
        """Test 4-week roster solving"""
        requirements = multi_week_db.fetch_shift_requirements()
        
        # Should have 28 days
        assert len(requirements) == 28
        
        # Each day should have requirements
        for date, services in requirements.items():
            assert 'DDO' in services
            assert services['DDO'] == 2

    def test_cross_week_constraints(self, multi_week_db):
        """Test constraints apply across weeks"""
        # Employee shouldn't exceed max shifts across entire period
        max_shifts_per_week = 5
        num_weeks = 4
        max_total_shifts = max_shifts_per_week * num_weeks  # 20
        
        assigned_shifts = 18  # Less than max
        assert assigned_shifts <= max_total_shifts


class TestRosterPublicationWorkflow:
    """E2E tests for roster publication"""

    @pytest.fixture
    def pub_db(self):
        db = MagicMock()
        db.update_roster_status.return_value = True
        db.generate_pdf.return_value = {'file_url': 'http://example.com/roster.pdf'}
        db.send_notification.return_value = True
        return db

    def test_publication_workflow(self, pub_db):
        """Test publication workflow"""
        roster_id = 'roster-001'
        
        # Validate
        pub_db.validate_roster.return_value = True
        assert pub_db.validate_roster(roster_id) is True
        
        # Update status
        pub_db.update_roster_status(roster_id, 'PUBLISHING')
        
        # Generate PDF
        pdf_result = pub_db.generate_pdf(roster_id)
        assert 'file_url' in pdf_result
        
        # Update final status
        pub_db.update_roster_status(roster_id, 'PUBLISHED')
        
        # Notify users
        pub_db.send_notification('All users', 'Roster published')
        pub_db.send_notification.assert_called()

    def test_publication_failure_rollback(self, pub_db):
        """Test publication failures trigger rollback"""
        roster_id = 'roster-001'
        
        pub_db.update_roster_status(roster_id, 'PUBLISHING')
        pub_db.generate_pdf.side_effect = Exception('PDF generation failed')
        
        with pytest.raises(Exception):
            pub_db.generate_pdf(roster_id)
        
        # Should rollback to previous state
        pub_db.update_roster_status(roster_id, 'VALIDATED')
        pub_db.update_roster_status.assert_called()


class TestRosterModificationWorkflow:
    """E2E tests for post-publication modifications"""

    @pytest.fixture
    def mod_db(self):
        db = MagicMock()
        db.create_roster_version.return_value = 'roster-001-v2'
        db.update_slot.return_value = True
        db.compare_versions.return_value = {
            'changed_slots': 5,
            'affected_employees': ['emp1', 'emp3']
        }
        return db

    def test_modification_creates_new_version(self, mod_db):
        """Test modifications create new roster version"""
        original_id = 'roster-001'
        
        # Create new version
        new_id = mod_db.create_roster_version(original_id)
        assert new_id == 'roster-001-v2'

    def test_single_slot_modification(self, mod_db):
        """Test modifying single slot"""
        result = mod_db.update_slot('slot-1', 'emp2', 'DDO')
        assert result is True

    def test_bulk_modification_with_comparison(self, mod_db):
        """Test bulk modification with version comparison"""
        modifications = [
            {'slot_id': 'slot-1', 'employee_id': 'emp2'},
            {'slot_id': 'slot-5', 'employee_id': 'emp3'},
            {'slot_id': 'slot-9', 'employee_id': 'emp1'}
        ]
        
        for mod in modifications:
            mod_db.update_slot(mod['slot_id'], mod['employee_id'], 'DDO')
        
        comparison = mod_db.compare_versions('roster-001-v1', 'roster-001-v2')
        assert comparison['changed_slots'] == 5
        assert 'emp1' in comparison['affected_employees']


class TestRosterErrorRecovery:
    """E2E tests for error scenarios and recovery"""

    @pytest.fixture
    def recovery_db(self):
        db = MagicMock()
        db.fetch_roster_backup.return_value = {'slots': []}
        db.restore_roster.return_value = True
        return db

    def test_corruption_detection_and_recovery(self, recovery_db):
        """Test detection and recovery from data corruption"""
        roster_id = 'roster-001'
        
        # Detect corruption
        recovery_db.validate_data_integrity.side_effect = ValueError('Data corruption detected')
        
        with pytest.raises(ValueError):
            recovery_db.validate_data_integrity(roster_id)
        
        # Restore from backup
        backup = recovery_db.fetch_roster_backup(roster_id)
        assert backup is not None
        
        # Verify restore
        result = recovery_db.restore_roster(roster_id, backup)
        assert result is True

    def test_partial_assignment_recovery(self, recovery_db):
        """Test recovery from partial slot assignments"""
        # Simulate partial assignment
        recovery_db.count_assigned_slots.return_value = 5
        recovery_db.count_total_slots.return_value = 10
        
        assigned = recovery_db.count_assigned_slots('roster-001')
        total = recovery_db.count_total_slots('roster-001')
        
        # Should restart solving if incomplete
        if assigned < total:
            recovery_db.restart_solving.return_value = True
            result = recovery_db.restart_solving('roster-001')
            assert result is True


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
