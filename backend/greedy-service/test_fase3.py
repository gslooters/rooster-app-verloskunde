"""
FASE 3: Test Suite for Pairing Logic

Comprehensive tests for:
- PairingLogic blocking and eligibility
- BlockingCalendar management
- PairingIntegratedSolver workflow
- DIO/DDO pairing rules
- Hard and soft constraints
"""

import pytest
from datetime import date, timedelta
from typing import Dict, List

from pairing_logic import (
    PairingLogic,
    PairingRule,
    BlockingCalendar,
    PairingOptimizer
)
from pairing_integration import (
    PairingIntegratedSolver,
    PairingConfig,
    PairingReportGenerator
)


class TestBlockingCalendar:
    """Test BlockingCalendar functionality"""
    
    def test_block_slot_basic(self):
        """Test basic slot blocking"""
        calendar = BlockingCalendar()
        
        test_date = date(2025, 12, 25)
        dagdeel = "O"
        employee_id = "EMP001"
        
        calendar.block_slot(
            work_date=test_date,
            dagdeel=dagdeel,
            employee_id=employee_id,
            reason="Test blocking"
        )
        
        assert calendar.is_blocked(test_date, dagdeel, employee_id)
        assert len(calendar.blocked_slots) == 1
    
    def test_get_blocking_reason(self):
        """Test retrieving blocking reason"""
        calendar = BlockingCalendar()
        
        test_date = date(2025, 12, 25)
        prev_date = date(2025, 12, 24)
        
        calendar.block_slot(
            work_date=test_date,
            dagdeel="M",
            employee_id="EMP001",
            reason="DIO/DDO pairing",
            previous_date=prev_date,
            previous_dagdeel="O",
            previous_service_code="DIO"
        )
        
        reason = calendar.get_blocking_reason(test_date, "M", "EMP001")
        assert reason is not None
        assert reason["reason"] == "DIO/DDO pairing"
        assert reason["previous_service_code"] == "DIO"
    
    def test_clear_employee_blocks(self):
        """Test clearing blocks for employee"""
        calendar = BlockingCalendar()
        
        # Block multiple slots for same employee
        for i in range(3):
            calendar.block_slot(
                work_date=date(2025, 12, 25 + i),
                dagdeel="O",
                employee_id="EMP001",
                reason="Test"
            )
        
        assert len(calendar.blocked_slots) == 3
        
        # Clear all for employee
        calendar.clear_employee_blocks("EMP001")
        
        assert len(calendar.blocked_slots) == 0
    
    def test_export_blocked_slots(self):
        """Test exporting blocked slots for database"""
        calendar = BlockingCalendar()
        
        calendar.block_slot(
            work_date=date(2025, 12, 25),
            dagdeel="O",
            employee_id="EMP001",
            reason="DIO/DDO"
        )
        
        exported = calendar.export_blocked_slots()
        
        assert len(exported) == 1
        assert exported[0]["status"] == 2  # BLOCKED status
        assert exported[0]["employee_id"] == "EMP001"


class TestPairingLogic:
    """Test PairingLogic core functionality"""
    
    def test_register_pairing_rule(self):
        """Test registering pairing rules"""
        logic = PairingLogic()
        
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-ddo",
            service_code_second="DDO",
            block_type="hard"
        )
        
        logic.register_pairing_rule(rule)
        
        assert len(logic.pairing_rules) == 1
        assert logic.pairing_rules[0].service_code_first == "DIO"
    
    def test_on_assignment_made_triggers_blocking(self):
        """Test that assignment triggers blocking"""
        logic = PairingLogic()
        
        # Register rule
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-ddo",
            service_code_second="DDO",
            block_type="hard"
        )
        logic.register_pairing_rule(rule)
        
        # Make assignment
        test_date = date(2025, 12, 24)
        logic.on_assignment_made(
            employee_id="EMP001",
            work_date=test_date,
            dagdeel="O",
            service_code="DIO",
            service_id="srv-dio"
        )
        
        # Check that next day is blocked
        next_date = test_date + timedelta(days=1)
        assert logic.blocking_calendar.is_blocked(next_date, "O", "EMP001")
    
    def test_is_eligible_for_assignment_blocked(self):
        """Test eligibility check for blocked employee"""
        logic = PairingLogic()
        logic.blocking_calendar.block_slot(
            work_date=date(2025, 12, 25),
            dagdeel="O",
            employee_id="EMP001",
            reason="Test block"
        )
        
        eligible, reason = logic.is_eligible_for_assignment(
            employee_id="EMP001",
            work_date=date(2025, 12, 25),
            dagdeel="O",
            service_code="DDO"
        )
        
        assert not eligible
        assert reason is not None
    
    def test_is_eligible_for_assignment_unblocked(self):
        """Test eligibility check for unblocked employee"""
        logic = PairingLogic()
        
        eligible, reason = logic.is_eligible_for_assignment(
            employee_id="EMP001",
            work_date=date(2025, 12, 25),
            dagdeel="O",
            service_code="DDO"
        )
        
        assert eligible
        assert reason is None
    
    def test_get_pairing_penalty_score_soft_constraint(self):
        """Test soft constraint penalty scoring"""
        logic = PairingLogic()
        
        # Register soft rule
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-vlo",
            service_code_second="VLO",
            block_type="soft"
        )
        logic.register_pairing_rule(rule)
        
        # Make first assignment
        first_date = date(2025, 12, 24)
        logic.on_assignment_made(
            employee_id="EMP001",
            work_date=first_date,
            dagdeel="O",
            service_code="DIO",
            service_id="srv-dio"
        )
        
        # Check penalty for next day with soft-blocked service
        next_date = first_date + timedelta(days=1)
        penalty = logic.get_pairing_penalty_score(
            employee_id="EMP001",
            work_date=next_date,
            dagdeel="O",
            service_code="VLO"
        )
        
        assert penalty < 0  # Should be penalized
    
    def test_export_blocking_calendar(self):
        """Test exporting blocking calendar"""
        logic = PairingLogic()
        
        # Create some blocks
        for i in range(3):
            logic.blocking_calendar.block_slot(
                work_date=date(2025, 12, 25 + i),
                dagdeel="O",
                employee_id="EMP001",
                reason="Test"
            )
        
        exported = logic.export_blocking_calendar()
        
        assert len(exported) == 3
        assert all(e["status"] == 2 for e in exported)
    
    def test_pairing_report_generation(self):
        """Test generating pairing report"""
        logic = PairingLogic()
        
        # Register rule
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-ddo",
            service_code_second="DDO",
            block_type="hard"
        )
        logic.register_pairing_rule(rule)
        
        # Create block
        logic.blocking_calendar.block_slot(
            work_date=date(2025, 12, 25),
            dagdeel="O",
            employee_id="EMP001",
            reason="Test"
        )
        
        report = logic.generate_pairing_report()
        
        assert "pairing_rules" in report
        assert "blocked_slots_count" in report
        assert report["blocked_slots_count"] == 1
        assert len(report["pairing_rules"]) == 1
    
    def test_reset_for_new_processing(self):
        """Test resetting state"""
        logic = PairingLogic()
        
        # Add some data
        logic.blocking_calendar.block_slot(
            work_date=date(2025, 12, 25),
            dagdeel="O",
            employee_id="EMP001",
            reason="Test"
        )
        
        assert len(logic.blocking_calendar.blocked_slots) == 1
        
        # Reset
        logic.reset_for_new_processing()
        
        assert len(logic.blocking_calendar.blocked_slots) == 0
        assert len(logic.employee_last_assignment) == 0


class TestPairingIntegratedSolver:
    """Test PairingIntegratedSolver integration"""
    
    def test_export_results_for_database(self):
        """Test exporting results for database storage"""
        config = PairingConfig(enable_hard_blocking=True)
        solver = PairingIntegratedSolver(
            greedy_solver=None,
            config=config
        )
        
        # Mock solution
        solution = {
            'status': 'solved_with_pairing',
            'assignments': [
                {
                    'employee_id': 'EMP001',
                    'date': '2025-12-25',
                    'dagdeel': 'O',
                    'service_id': 'srv-dio',
                    'pairing_score': 0.8
                }
            ],
            'pairing_data': {
                'blocking_calendar': [
                    {
                        'employee_id': 'EMP001',
                        'date': '2025-12-26',
                        'dagdeel': 'O',
                        'status': 2,
                        'blocking_reason': 'DIO/DDO pairing',
                        'previous_service_code': 'DIO'
                    }
                ],
                'pairing_report': {
                    'pairing_violations': [],
                    'pairing_rules': [
                        {'first': 'DIO', 'second': 'DDO', 'type': 'hard'}
                    ],
                    'employees_affected': 1
                }
            }
        }
        
        exported = solver.export_results_for_database(solution)
        
        assert 'assignments' in exported
        assert 'blocked_slots' in exported
        assert len(exported['assignments']) == 1
        assert len(exported['blocked_slots']) == 1
        assert exported['summary']['total_blocked_slots'] == 1


class TestPairingReportGenerator:
    """Test PairingReportGenerator"""
    
    def test_generate_text_report(self):
        """Test generating text report"""
        logic = PairingLogic()
        
        # Register rule
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-ddo",
            service_code_second="DDO",
            block_type="hard",
            description="DIO cannot be followed by DDO"
        )
        logic.register_pairing_rule(rule)
        
        generator = PairingReportGenerator(logic)
        report = generator.generate_text_report()
        
        assert isinstance(report, str)
        assert "DIO" in report
        assert "DDO" in report
        assert "PAIRING LOGIC REPORT" in report
    
    def test_generate_html_report(self):
        """Test generating HTML report"""
        logic = PairingLogic()
        
        generator = PairingReportGenerator(logic)
        report = generator.generate_html_report()
        
        assert isinstance(report, str)
        assert "<!DOCTYPE html>" in report
        assert "Pairing Logic Report" in report
        assert "<table>" in report


class TestPairingIntegration:
    """Integration tests for complete pairing workflow"""
    
    def test_full_pairing_workflow(self):
        """
        Test complete workflow:
        1. Register rules
        2. Make assignments
        3. Verify blocking
        4. Export for database
        """
        logic = PairingLogic()
        
        # Register DIO -> DDO hard block
        rule = PairingRule(
            service_id_first="srv-dio",
            service_code_first="DIO",
            service_id_second="srv-ddo",
            service_code_second="DDO",
            block_type="hard"
        )
        logic.register_pairing_rule(rule)
        
        # Scenario: Employee assigned DIO on 2025-12-24, O part
        logic.on_assignment_made(
            employee_id="EMP001",
            work_date=date(2025, 12, 24),
            dagdeel="O",
            service_code="DIO",
            service_id="srv-dio"
        )
        
        # Next day should be blocked for O part
        eligible, reason = logic.is_eligible_for_assignment(
            employee_id="EMP001",
            work_date=date(2025, 12, 25),
            dagdeel="O",
            service_code="DDO"
        )
        
        assert not eligible, "EMP001 should be blocked from DDO on 2025-12-25 O"
        
        # But should be eligible for different part or service
        eligible_m, _ = logic.is_eligible_for_assignment(
            employee_id="EMP001",
            work_date=date(2025, 12, 25),
            dagdeel="M",
            service_code="DDO"
        )
        
        assert eligible_m, "EMP001 should be eligible for M part"
        
        # Verify export
        exported = logic.export_blocking_calendar()
        assert len(exported) == 1
        assert exported[0]["employee_id"] == "EMP001"
        assert exported[0]["date"] == "2025-12-25"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
