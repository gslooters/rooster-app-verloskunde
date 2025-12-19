"""Comprehensive tests for FASE 4 database integration.

Tests for:
- Batch writer functionality
- Trigger verification
- Database consistency
- Error handling
"""

import pytest
import os
from datetime import date, timedelta, datetime
from unittest.mock import Mock, MagicMock, patch
from models import Assignment, WorkspaceState
from writer import BatchWriter
from trigger_verify import TriggerVerifier


class TestBatchWriter:
    """Tests for BatchWriter class."""
    
    @pytest.fixture
    def workspace(self):
        """Create test workspace."""
        return WorkspaceState(
            roster_id='test-roster-123',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28)
        )
    
    @pytest.fixture
    def assignments(self):
        """Create test assignments."""
        assignments = [
            Assignment(
                id='test-1',
                roster_id='test-roster-123',
                employee_id='emp-001',
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='service-dio',
                status=1,
                source='greedy'
            ),
            Assignment(
                id='test-2',
                roster_id='test-roster-123',
                employee_id='emp-001',
                date=date(2025, 11, 24),
                dagdeel='M',
                service_id='service-block',
                status=2,
                source='greedy-blocking'
            ),
            Assignment(
                id='test-3',
                roster_id='test-roster-123',
                employee_id='emp-002',
                date=date(2025, 11, 25),
                dagdeel='O',
                service_id='service-ddo',
                status=0,
                source='manual'
            ),
        ]
        return assignments
    
    def test_batch_writer_initialization(self, workspace):
        """Test BatchWriter initialization."""
        writer = BatchWriter(workspace)
        assert writer.workspace == workspace
        assert writer.client is not None
    
    def test_write_statistics(self, workspace, assignments):
        """Test get_write_statistics method."""
        workspace.assignments = assignments
        writer = BatchWriter(workspace)
        
        stats = writer.get_write_statistics()
        
        assert stats['active_assignments'] == 1
        assert stats['blocking_assignments'] == 1
        assert stats['open_slots'] == 1
        assert stats['total'] == 3
        assert stats['roster_id'] == 'test-roster-123'
    
    def test_prepare_records(self, workspace, assignments):
        """Test _prepare_records conversion."""
        active_assignments = [a for a in assignments if a.status == 1]
        writer = BatchWriter(workspace)
        
        records = writer._prepare_records(active_assignments)
        
        assert len(records) == 1
        assert records[0]['roster_id'] == 'test-roster-123'
        assert records[0]['employee_id'] == 'emp-001'
        assert records[0]['dagdeel'] == 'O'
        assert records[0]['status'] == 1
        assert records[0]['source'] == 'greedy'
        assert 'created_at' in records[0]
    
    def test_prepare_blocking_records(self, workspace, assignments):
        """Test _prepare_blocking_records conversion."""
        blocking_assignments = [a for a in assignments if a.status == 2]
        writer = BatchWriter(workspace)
        
        records = writer._prepare_blocking_records(blocking_assignments)
        
        assert len(records) == 1
        assert records[0]['status'] == 2
        assert records[0]['source'] == 'greedy-blocking'
        assert 'notes' in records[0]
        assert 'DIO/DDO' in records[0]['notes']
    
    @patch('writer.create_client')
    def test_write_assignments_success(self, mock_create_client, workspace, assignments):
        """Test successful assignment write."""
        # Mock Supabase client
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        workspace.assignments = assignments
        writer = BatchWriter(workspace)
        writer.client = mock_client
        
        # Mock insert response
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[{}])
        
        result = writer.write_assignments()
        
        assert result['written'] == 1  # Only status=1
        assert result['failed'] == 0
        assert result['error'] is None
        assert result['duration_ms'] >= 0
    
    @patch('writer.create_client')
    def test_write_assignments_empty(self, mock_create_client, workspace):
        """Test writing with no assignments."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        workspace.assignments = []
        writer = BatchWriter(workspace)
        writer.client = mock_client
        
        result = writer.write_assignments()
        
        assert result['written'] == 0
        assert result['failed'] == 0
        assert result['error'] is None
    
    @patch('writer.create_client')
    def test_write_assignments_failure(self, mock_create_client, workspace, assignments):
        """Test handling of write failure."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        workspace.assignments = assignments
        writer = BatchWriter(workspace)
        writer.client = mock_client
        
        # Mock failure
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_table.insert.return_value.execute.side_effect = Exception("Database error")
        
        result = writer.write_assignments()
        
        assert result['written'] == 0
        assert result['failed'] == 1
        assert 'Database error' in result['error']
    
    @patch('writer.create_client')
    def test_write_blocking_records(self, mock_create_client, workspace, assignments):
        """Test writing blocking records."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        workspace.assignments = assignments
        writer = BatchWriter(workspace)
        writer.client = mock_client
        
        # Mock insert response
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[{}])
        
        result = writer.write_blocking_records()
        
        assert result['written'] == 1  # Only status=2
        assert result['failed'] == 0
    
    @patch('writer.create_client')
    def test_verify_write(self, mock_create_client, workspace):
        """Test write verification."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        writer = BatchWriter(workspace)
        writer.client = mock_client
        
        # Mock query response
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{'id': '1'}, {'id': '2'}])
        
        result = writer.verify_write(expected_count=2)
        
        assert result['verified'] is True
        assert result['found_count'] == 2
        assert result['expected_count'] == 2


class TestTriggerVerifier:
    """Tests for TriggerVerifier class."""
    
    @pytest.fixture
    def workspace(self):
        """Create test workspace."""
        return WorkspaceState(
            roster_id='test-roster-123',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28)
        )
    
    def test_trigger_verifier_initialization(self, workspace):
        """Test TriggerVerifier initialization."""
        verifier = TriggerVerifier(workspace)
        assert verifier.workspace == workspace
        assert verifier.client is not None
    
    @patch('trigger_verify.create_client')
    def test_verify_blocking_records_exist(self, mock_create_client, workspace):
        """Test verification of blocking records existence."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        verifier = TriggerVerifier(workspace)
        verifier.client = mock_client
        
        # Mock query response with blocking records
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[
            {'id': '1', 'date': '2025-11-24', 'dagdeel': 'M', 'employee_id': 'emp-001', 'status': 2},
            {'id': '2', 'date': '2025-11-25', 'dagdeel': 'O', 'employee_id': 'emp-001', 'status': 2},
        ])
        
        result = verifier.verify_blocking_records_exist()
        
        assert result['passed'] is True
        assert result['blocking_records_count'] == 2
    
    @patch('trigger_verify.create_client')
    def test_verify_blocking_records_none(self, mock_create_client, workspace):
        """Test verification when no blocking records exist."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        verifier = TriggerVerifier(workspace)
        verifier.client = mock_client
        
        # Mock empty response
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[])
        
        result = verifier.verify_blocking_records_exist()
        
        assert result['passed'] is False
        assert result['blocking_records_count'] == 0
    
    @patch('trigger_verify.create_client')
    def test_verify_trigger_consistency(self, mock_create_client, workspace):
        """Test trigger consistency verification."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        verifier = TriggerVerifier(workspace)
        verifier.client = mock_client
        
        # Mock query response with mixed statuses
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[
            {'status': 1, 'date': '2025-11-24', 'dagdeel': 'O'},
            {'status': 2, 'date': '2025-11-24', 'dagdeel': 'M'},
            {'status': 0, 'date': '2025-11-25', 'dagdeel': 'O'},
        ])
        
        result = verifier.verify_trigger_consistency()
        
        assert result['passed'] is True
        assert result['active_count'] == 1
        assert result['blocked_count'] == 1
        assert result['total_count'] == 3
    
    def test_find_duplicates(self, workspace):
        """Test duplicate detection."""
        verifier = TriggerVerifier(workspace)
        
        records = [
            {'date': '2025-11-24', 'dagdeel': 'O', 'employee_id': 'emp-001', 'service_id': 'svc-001'},
            {'date': '2025-11-24', 'dagdeel': 'O', 'employee_id': 'emp-001', 'service_id': 'svc-001'},  # Duplicate
            {'date': '2025-11-24', 'dagdeel': 'M', 'employee_id': 'emp-001', 'service_id': 'svc-001'},
        ]
        
        duplicates = verifier._find_duplicates(records)
        
        assert len(duplicates) == 1
        assert ('2025-11-24', 'O', 'emp-001', 'svc-001') in duplicates
    
    @patch('trigger_verify.create_client')
    def test_verify_all_triggers_passed(self, mock_create_client, workspace):
        """Test successful verification of all triggers."""
        mock_client = MagicMock()
        mock_create_client.return_value = mock_client
        
        verifier = TriggerVerifier(workspace)
        verifier.client = mock_client
        
        # Mock all verification responses
        mock_table = MagicMock()
        mock_client.table.return_value = mock_table
        mock_query = MagicMock()
        mock_table.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.in_.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[
            {'status': 1},
            {'status': 2},
        ])
        
        result = verifier.verify_all_triggers()
        
        # Should have all checks
        assert 'checks' in result
        assert 'blocking_records' in result['checks']
        assert 'trigger_consistency' in result['checks']
        assert 'duration_ms' in result


class TestDatabaseIntegrationScenarios:
    """Integration tests for database operations."""
    
    @pytest.fixture
    def test_workspace(self):
        """Create realistic test workspace."""
        workspace = WorkspaceState(
            roster_id='roster-2025-week48-52',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28)
        )
        
        # Add realistic assignments
        for day_offset in range(5):
            for dagdeel in ['O', 'M', 'A']:
                for emp_num in range(1, 4):
                    workspace.assignments.append(Assignment(
                        id=f"assign-{day_offset}-{dagdeel}-{emp_num}",
                        roster_id=workspace.roster_id,
                        employee_id=f"emp-{emp_num:03d}",
                        date=date(2025, 11, 24) + timedelta(days=day_offset),
                        dagdeel=dagdeel,
                        service_id=f"service-{dagdeel}",
                        status=1,
                        source='greedy'
                    ))
        
        return workspace
    
    def test_batch_writer_large_dataset(self, test_workspace):
        """Test BatchWriter with realistic dataset size."""
        writer = BatchWriter(test_workspace)
        stats = writer.get_write_statistics()
        
        # Should have 5 days * 3 dagdelen * 3 employees = 45 assignments
        assert stats['active_assignments'] == 45
        assert stats['total'] == 45
    
    def test_write_statistics_accuracy(self, test_workspace):
        """Test write statistics accuracy."""
        # Add some blocking assignments
        test_workspace.assignments.append(Assignment(
            id="blocking-1",
            roster_id=test_workspace.roster_id,
            employee_id="emp-001",
            date=date(2025, 11, 24),
            dagdeel="M",
            service_id="service-blocking",
            status=2,
            source='greedy-blocking'
        ))
        
        writer = BatchWriter(test_workspace)
        stats = writer.get_write_statistics()
        
        assert stats['active_assignments'] == 45
        assert stats['blocking_assignments'] == 1
        assert stats['total'] == 46


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
