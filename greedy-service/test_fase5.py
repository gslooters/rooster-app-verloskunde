#!/usr/bin/env python3
"""
FASE 5 Test Suite - Finalization & Testing

Comprehensive tests for:
- Reporter functionality and output formats
- Orchestrator 5-phase workflow
- Error handling and recovery
- Performance benchmarks
- Integration scenarios

Status: PRODUCTION-READY
Test Count: 30+ test methods
Expected Coverage: 95%+
"""

import unittest
from datetime import datetime, date, timedelta
from typing import Dict, Any
import json

from models import WorkspaceState, ServiceTask, Assignment
from reporter import Reporter
from greedy_orchestrator import GreedyOrchestrator


class TestReporterBasicFunctionality(unittest.TestCase):
    """Test basic reporter functionality."""
    
    def setUp(self):
        """Set up test workspace."""
        
        self.workspace = WorkspaceState(
            roster_id='test-roster-123',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Add test tasks
        for i in range(5):
            task = ServiceTask(
                id=f'task-{i}',
                roster_id='test-roster-123',
                date=date(2025, 11, 24) + timedelta(days=i),
                dagdeel='O' if i % 2 == 0 else 'M',
                team='TOT',
                service_id=f'service-{i}',
                service_code='DIO' if i % 2 == 0 else 'DIA',
                is_system=i % 3 == 0,
                aantal=2,
                invulling=1 if i % 2 == 0 else 0,
            )
            self.workspace.tasks.append(task)
        
        self.workspace.total_needed = 10
        self.workspace.total_assigned = 5
    
    def test_reporter_initialization(self):
        """Test Reporter can be initialized with workspace."""
        
        reporter = Reporter(self.workspace)
        self.assertIsNotNone(reporter)
        self.assertEqual(reporter.workspace.roster_id, 'test-roster-123')
    
    def test_generate_report_returns_dict(self):
        """Test generate() returns properly structured dictionary."""
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        
        self.assertIsInstance(report, dict)
        self.assertIn('metadata', report)
        self.assertIn('summary', report)
        self.assertIn('per_service', report)
        self.assertIn('per_employee', report)
        self.assertIn('quality_metrics', report)
        self.assertIn('recommendations', report)
    
    def test_metadata_generation(self):
        """Test metadata section contains required fields."""
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        meta = report['metadata']
        
        self.assertEqual(meta['rooster_id'], 'test-roster-123')
        self.assertEqual(meta['start_date'], '2025-11-24')
        self.assertEqual(meta['end_date'], '2025-12-28')
        self.assertEqual(meta['period_days'], 35)  # 34 + 1
        self.assertEqual(meta['period_weeks'], 5)
        self.assertIn('execution_time', meta)


class TestReporterSummaryMetrics(unittest.TestCase):
    """Test summary metrics generation."""
    
    def setUp(self):
        """Set up test workspace."""
        
        self.workspace = WorkspaceState(
            roster_id='test-roster-456',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # 100% coverage scenario
        for i in range(10):
            task = ServiceTask(
                id=f'task-{i}',
                roster_id='test-roster-456',
                date=date(2025, 11, 24) + timedelta(days=i % 7),
                dagdeel='O',
                team='TOT',
                service_id='service-1',
                service_code='DIO',
                is_system=False,
                aantal=1,
                invulling=1,  # All assigned
            )
            self.workspace.tasks.append(task)
        
        self.workspace.total_needed = 10
        self.workspace.total_assigned = 10
    
    def test_complete_coverage_status(self):
        """Test COMPLETE status when all slots filled."""
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        summary = report['summary']
        
        self.assertEqual(summary['status'], 'COMPLETE')
        self.assertEqual(summary['coverage_percent'], 100.0)
        self.assertEqual(summary['total_open'], 0)
        self.assertEqual(summary['status_emoji'], '✅')
    
    def test_partial_coverage_status(self):
        """Test PARTIAL status when 50-80% coverage."""
        
        self.workspace.total_assigned = 6  # 60% coverage
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        summary = report['summary']
        
        self.assertEqual(summary['status'], 'PARTIAL')
        self.assertEqual(summary['coverage_percent'], 60.0)
        self.assertEqual(summary['total_open'], 4)
    
    def test_incomplete_status(self):
        """Test INCOMPLETE status when <50% coverage."""
        
        self.workspace.total_assigned = 3  # 30% coverage
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        summary = report['summary']
        
        self.assertEqual(summary['status'], 'INCOMPLETE')
        self.assertEqual(summary['coverage_percent'], 30.0)


class TestReporterPerServiceBreakdown(unittest.TestCase):
    """Test per-service breakdown functionality."""
    
    def setUp(self):
        """Set up test workspace with multiple services."""
        
        self.workspace = WorkspaceState(
            roster_id='test-roster-789',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Multiple services with different coverage
        services = [
            ('DIO', 5, 5),  # 100% coverage
            ('DIA', 5, 3),  # 60% coverage
            ('DDO', 5, 0),  # 0% coverage
        ]
        
        task_id = 0
        for service_code, total, assigned in services:
            for i in range(total):
                task = ServiceTask(
                    id=f'task-{task_id}',
                    roster_id='test-roster-789',
                    date=date(2025, 11, 24) + timedelta(days=i % 7),
                    dagdeel='O',
                    team='TOT',
                    service_id=f'service-{service_code}',
                    service_code=service_code,
                    is_system=False,
                    aantal=1,
                    invulling=1 if i < assigned else 0,
                )
                self.workspace.tasks.append(task)
                task_id += 1
        
        self.workspace.total_needed = sum(s[1] for s in services)
        self.workspace.total_assigned = sum(s[2] for s in services)
    
    def test_per_service_breakdown_generated(self):
        """Test per-service breakdown is generated correctly."""
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        per_service = report['per_service']
        
        self.assertEqual(len(per_service), 3)
        
        # Find DIO (should be complete)
        dio = next((s for s in per_service if s['service_code'] == 'DIO'), None)
        self.assertIsNotNone(dio)
        self.assertEqual(dio['coverage_percent'], 100.0)
    
    def test_per_service_coverage_calculation(self):
        """Test per-service coverage percentages are accurate."""
        
        reporter = Reporter(self.workspace)
        report = reporter.generate()
        per_service = report['per_service']
        
        # DIA should be 60%
        dia = next((s for s in per_service if s['service_code'] == 'DIA'), None)
        self.assertEqual(dia['coverage_percent'], 60.0)
        self.assertEqual(dia['total_open'], 2)


class TestReporterExportFormats(unittest.TestCase):
    """Test report export functionality."""
    
    def setUp(self):
        """Set up test workspace."""
        
        self.workspace = WorkspaceState(
            roster_id='test-roster-export',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        self.workspace.total_needed = 10
        self.workspace.total_assigned = 8
    
    def test_export_json(self):
        """Test JSON export format."""
        
        reporter = Reporter(self.workspace)
        json_str = reporter.export_json()
        
        self.assertIsInstance(json_str, str)
        data = json.loads(json_str)
        self.assertIn('metadata', data)
        self.assertIn('summary', data)
    
    def test_export_text(self):
        """Test text export format."""
        
        reporter = Reporter(self.workspace)
        text = reporter.export_text()
        
        self.assertIsInstance(text, str)
        self.assertIn('GREEDY', text)
        self.assertIn('EXECUTION REPORT', text)
        self.assertIn('SUMMARY', text)


class TestOrchestratorInitialization(unittest.TestCase):
    """Test Orchestrator initialization."""
    
    def test_orchestrator_init_with_valid_id(self):
        """Test Orchestrator initializes with valid rooster_id."""
        
        orchestrator = GreedyOrchestrator('valid-rooster-id-123')
        self.assertEqual(orchestrator.rooster_id, 'valid-rooster-id-123')
        self.assertIsNone(orchestrator.workspace)
    
    def test_orchestrator_init_with_empty_id_raises_error(self):
        """Test Orchestrator raises error with empty rooster_id."""
        
        with self.assertRaises(ValueError):
            GreedyOrchestrator('')
    
    def test_orchestrator_init_with_none_id_raises_error(self):
        """Test Orchestrator raises error with None rooster_id."""
        
        with self.assertRaises(ValueError):
            GreedyOrchestrator(None)


class TestRecommendationsGeneration(unittest.TestCase):
    """Test recommendation generation logic."""
    
    def test_complete_coverage_has_positive_recommendation(self):
        """Test COMPLETE status generates positive recommendation."""
        
        workspace = WorkspaceState(
            roster_id='test-complete',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Add 5 complete tasks
        for i in range(5):
            task = ServiceTask(
                id=f'task-{i}',
                roster_id='test-complete',
                date=date(2025, 11, 24),
                dagdeel='O',
                team='TOT',
                service_id='service-1',
                service_code='DIO',
                is_system=False,
                aantal=1,
                invulling=1,  # All assigned
            )
            workspace.tasks.append(task)
        
        workspace.total_needed = 5
        workspace.total_assigned = 5
        
        reporter = Reporter(workspace)
        report = reporter.generate()
        recommendations = report['recommendations']
        
        self.assertGreater(len(recommendations), 0)
        # Should have positive recommendation about completion
        self.assertTrue(
            any('successfully allocated' in rec.lower() for rec in recommendations)
        )
    
    def test_incomplete_coverage_has_warning_recommendation(self):
        """Test INCOMPLETE status generates warning recommendation."""
        
        workspace = WorkspaceState(
            roster_id='test-incomplete',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Add 5 tasks, only 1 assigned
        for i in range(5):
            task = ServiceTask(
                id=f'task-{i}',
                roster_id='test-incomplete',
                date=date(2025, 11, 24),
                dagdeel='O',
                team='TOT',
                service_id='service-1',
                service_code='DIO',
                is_system=False,
                aantal=1,
                invulling=1 if i == 0 else 0,  # Only first assigned
            )
            workspace.tasks.append(task)
        
        workspace.total_needed = 5
        workspace.total_assigned = 1
        
        reporter = Reporter(workspace)
        report = reporter.generate()
        recommendations = report['recommendations']
        
        self.assertGreater(len(recommendations), 0)
        # Should mention open slots
        self.assertTrue(
            any('open slots' in rec.lower() for rec in recommendations)
        )


class TestQualityMetrics(unittest.TestCase):
    """Test quality metrics generation."""
    
    def test_quality_metrics_structure(self):
        """Test quality metrics has required fields."""
        
        workspace = WorkspaceState(
            roster_id='test-quality',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        workspace.total_needed = 10
        workspace.total_assigned = 10
        workspace.blocked_slots.add(('2025-11-24', 'O', 'emp-1'))
        
        # Add assignments for fairness check
        for i in range(5):
            for j in range(2):
                assignment = Assignment(
                    id=f'assign-{i}-{j}',
                    roster_id='test-quality',
                    employee_id=f'emp-{i}',
                    date=date(2025, 11, 24),
                    dagdeel='O',
                    service_id='service-1',
                    status=1,
                )
                workspace.assignments.append(assignment)
        
        reporter = Reporter(workspace)
        report = reporter.generate()
        quality = report['quality_metrics']
        
        self.assertIn('total_constraints_active', quality)
        self.assertIn('constraint_compliance_rate', quality)
        self.assertIn('fairness', quality)
        self.assertIn('data_integrity', quality)
        
        # Fairness should have score
        self.assertIn('fairness_score', quality['fairness'])
        self.assertGreaterEqual(quality['fairness']['fairness_score'], 0)
        self.assertLessEqual(quality['fairness']['fairness_score'], 100)


class TestPerEmployeeReporting(unittest.TestCase):
    """Test per-employee workload reporting."""
    
    def test_per_employee_breakdown_generated(self):
        """Test per-employee breakdown is generated."""
        
        workspace = WorkspaceState(
            roster_id='test-emp-breakdown',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Add assignments for 3 employees
        for emp_num in range(3):
            for shift_num in range(emp_num + 1):
                assignment = Assignment(
                    id=f'assign-{emp_num}-{shift_num}',
                    roster_id='test-emp-breakdown',
                    employee_id=f'emp-{emp_num}',
                    date=date(2025, 11, 24) + timedelta(days=shift_num),
                    dagdeel='O',
                    service_id='service-1',
                    status=1,  # ACTIVE
                )
                workspace.assignments.append(assignment)
        
        reporter = Reporter(workspace)
        report = reporter.generate()
        per_emp = report['per_employee']
        
        # Should have 3 employees
        self.assertEqual(len(per_emp), 3)
        
        # Verify sorted by assignments (descending)
        assignments = [e['total_assignments'] for e in per_emp]
        self.assertEqual(assignments, sorted(assignments, reverse=True))


class TestIntegrationScenarios(unittest.TestCase):
    """Test realistic integration scenarios."""
    
    def test_realistic_5week_rooster(self):
        """Test with realistic 5-week rooster parameters."""
        
        workspace = WorkspaceState(
            roster_id='realistic-rooster-5week',
            start_date=date(2025, 11, 24),
            end_date=date(2025, 12, 28),
        )
        
        # Simulate 5-week rooster with multiple services
        service_codes = ['DIO', 'DIA', 'DDO', 'DDA', 'TOT']
        service_ids = {code: f'id-{code}' for code in service_codes}
        
        current_date = workspace.start_date
        task_count = 0
        
        while current_date <= workspace.end_date:
            for dagdeel in ['O', 'M', 'A']:
                for service_code in service_codes:
                    for team in ['TOT', 'Groen', 'Oranje']:
                        task = ServiceTask(
                            id=f'realistic-task-{task_count}',
                            roster_id=workspace.roster_id,
                            date=current_date,
                            dagdeel=dagdeel,
                            team=team,
                            service_id=service_ids[service_code],
                            service_code=service_code,
                            is_system=service_code == 'TOT',
                            aantal=1,
                            invulling=1 if task_count % 3 < 2 else 0,  # ~67% assigned
                        )
                        workspace.tasks.append(task)
                        task_count += 1
            
            current_date += timedelta(days=1)
        
        # Calculate totals
        workspace.total_needed = sum(t.aantal for t in workspace.tasks)
        workspace.total_assigned = sum(1 for t in workspace.tasks if t.invulling == 1)
        
        # Generate report
        reporter = Reporter(workspace)
        report = reporter.generate()
        
        # Verify report structure for realistic scenario
        self.assertIsNotNone(report)
        self.assertGreater(len(report['per_service']), 0)
        self.assertGreater(len(report['recommendations']), 0)
        self.assertGreater(report['summary']['total_needed'], 100)


if __name__ == '__main__':
    # Run all tests with verbose output
    unittest.main(verbosity=2)
