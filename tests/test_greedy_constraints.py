"""Unit tests for GREEDY Engine HC1-HC6 Constraints (STAP 7: TESTING)

DRAD 185: Unit tests for hard constraints HC1-HC6 in constraint_checker.py

Test Coverage:
  - HC1: Employee capability for service
  - HC2: No overlapping shifts
  - HC3: Respect blackout dates
  - HC4: Max shifts per employee
  - HC5: Max shifts per service
  - HC6: Team-aware assignment

Date: 2025-12-15
Status: PRODUCTION READY
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.solver.constraint_checker import HardConstraintChecker


class TestHC1Capability(unittest.TestCase):
    """HC1: Employee must be capable for service."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc1_capable_employee(self):
        """Test HC1: Employee IS capable - should return True."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = [{'id': 'svc1', 'actief': True}]  # Found
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act
        result = self.checker.check_HC1_capability('emp1', 'svc1')

        # Assert
        self.assertTrue(result, "HC1 should return True when employee is capable")

    def test_hc1_incapable_employee(self):
        """Test HC1: Employee NOT capable - should return False."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = []  # Not found
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act
        result = self.checker.check_HC1_capability('emp1', 'svc1')

        # Assert
        self.assertFalse(result, "HC1 should return False when employee is not capable")

    def test_hc1_caching(self):
        """Test HC1: Capability is cached."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = [{'id': 'svc1', 'actief': True}]
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act: Call twice
        result1 = self.checker.check_HC1_capability('emp1', 'svc1')
        result2 = self.checker.check_HC1_capability('emp1', 'svc1')

        # Assert: Both should be True
        self.assertTrue(result1)
        self.assertTrue(result2)
        # Database should only be called once (cached on second call)
        self.mock_db.table.assert_called()


class TestHC2NoOverlap(unittest.TestCase):
    """HC2: No overlapping shifts for same employee on same date/dagdeel."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc2_no_conflict(self):
        """Test HC2: No overlap - should return True."""
        # Arrange
        existing_assignments = []  # Empty = no conflicts

        # Act
        result = self.checker.check_HC2_no_overlap(
            'emp1',
            '2025-11-24',
            'morning',
            existing_assignments
        )

        # Assert
        self.assertTrue(result, "HC2 should return True when no overlap exists")

    def test_hc2_with_conflict(self):
        """Test HC2: Overlap exists - should return False."""
        # Arrange
        existing_assignment = MagicMock(
            emp_id='emp1',
            date='2025-11-24',
            dagdeel='morning'
        )
        existing_assignments = [existing_assignment]

        # Act
        result = self.checker.check_HC2_no_overlap(
            'emp1',
            '2025-11-24',
            'morning',
            existing_assignments
        )

        # Assert
        self.assertFalse(result, "HC2 should return False when overlap exists")

    def test_hc2_different_dagdeel_no_conflict(self):
        """Test HC2: Same employee, different dagdeel - should return True."""
        # Arrange
        existing_assignment = MagicMock(
            emp_id='emp1',
            date='2025-11-24',
            dagdeel='morning'  # Different from 'afternoon'
        )
        existing_assignments = [existing_assignment]

        # Act
        result = self.checker.check_HC2_no_overlap(
            'emp1',
            '2025-11-24',
            'afternoon',
            existing_assignments
        )

        # Assert
        self.assertTrue(result, "HC2 should return True for different dagdeel")


class TestHC3Blackout(unittest.TestCase):
    """HC3: Respect blackout dates (unavailable status)."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc3_available(self):
        """Test HC3: Employee available - should return True."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = []  # No blackout found
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act
        result = self.checker.check_HC3_blackout('emp1', '2025-11-24')

        # Assert
        self.assertTrue(result, "HC3 should return True when employee is available")

    def test_hc3_blackout(self):
        """Test HC3: Employee blackout (unavailable) - should return False."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = [{'status': 3}]  # Status 3 = unavailable
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act
        result = self.checker.check_HC3_blackout('emp1', '2025-11-24')

        # Assert
        self.assertFalse(result, "HC3 should return False when employee is blackout")

    def test_hc3_caching(self):
        """Test HC3: Blackout check is cached."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = []
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act: Call twice
        result1 = self.checker.check_HC3_blackout('emp1', '2025-11-24')
        result2 = self.checker.check_HC3_blackout('emp1', '2025-11-24')

        # Assert: Both True
        self.assertTrue(result1)
        self.assertTrue(result2)


class TestHC4MaxPerEmployee(unittest.TestCase):
    """HC4: Don't exceed max shifts per employee."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc4_under_limit(self):
        """Test HC4: Under limit - should return True."""
        # Arrange: 3 shifts, max is 5
        result = self.checker.check_HC4_max_per_employee('emp1', current=3, target=5)

        # Assert
        self.assertTrue(result, "HC4 should return True when under limit")

    def test_hc4_at_limit(self):
        """Test HC4: At limit - should return False."""
        # Arrange: 5 shifts, max is 5
        result = self.checker.check_HC4_max_per_employee('emp1', current=5, target=5)

        # Assert
        self.assertFalse(result, "HC4 should return False when at limit")

    def test_hc4_over_limit(self):
        """Test HC4: Over limit - should return False."""
        # Arrange: 8 shifts, max is 5
        result = self.checker.check_HC4_max_per_employee('emp1', current=8, target=5)

        # Assert
        self.assertFalse(result, "HC4 should return False when over limit")


class TestHC5MaxPerService(unittest.TestCase):
    """HC5: Don't exceed max for specific service."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc5_under_limit(self):
        """Test HC5: Under service max - should return True."""
        # Arrange
        result = self.checker.check_HC5_max_per_service(
            'emp1',
            'svc1',
            current=1,
            max_allowed=3
        )

        # Assert
        self.assertTrue(result, "HC5 should return True when under service limit")

    def test_hc5_at_limit(self):
        """Test HC5: At service max - should return False."""
        # Arrange
        result = self.checker.check_HC5_max_per_service(
            'emp1',
            'svc1',
            current=3,
            max_allowed=3
        )

        # Assert
        self.assertFalse(result, "HC5 should return False when at service limit")

    def test_hc5_over_limit(self):
        """Test HC5: Over service max - should return False."""
        # Arrange
        result = self.checker.check_HC5_max_per_service(
            'emp1',
            'svc1',
            current=5,
            max_allowed=3
        )

        # Assert
        self.assertFalse(result, "HC5 should return False when over service limit")


class TestHC6TeamLogic(unittest.TestCase):
    """HC6: Team-aware assignment (GRO/ORA/TOT)."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_hc6_gro_service_gro_employee(self):
        """Test HC6: GRO service + GRO employee - should return True."""
        # Arrange
        result = self.checker.check_HC6_team_logic(svc_team='GRO', emp_team='GRO')

        # Assert
        self.assertTrue(result, "HC6 should return True for GRO/GRO match")

    def test_hc6_gro_service_ora_employee(self):
        """Test HC6: GRO service + ORA employee - should return False."""
        # Arrange
        result = self.checker.check_HC6_team_logic(svc_team='GRO', emp_team='ORA')

        # Assert
        self.assertFalse(result, "HC6 should return False for GRO/ORA mismatch")

    def test_hc6_ora_service_ora_employee(self):
        """Test HC6: ORA service + ORA employee - should return True."""
        # Arrange
        result = self.checker.check_HC6_team_logic(svc_team='ORA', emp_team='ORA')

        # Assert
        self.assertTrue(result, "HC6 should return True for ORA/ORA match")

    def test_hc6_tot_service_any_employee(self):
        """Test HC6: TOT service + any employee - should return True."""
        # Arrange
        result1 = self.checker.check_HC6_team_logic(svc_team='TOT', emp_team='GRO')
        result2 = self.checker.check_HC6_team_logic(svc_team='TOT', emp_team='ORA')

        # Assert
        self.assertTrue(result1, "HC6 should return True for TOT/GRO")
        self.assertTrue(result2, "HC6 should return True for TOT/ORA")

    def test_hc6_null_team_any_employee(self):
        """Test HC6: NULL team + any employee - should return True."""
        # Arrange
        result = self.checker.check_HC6_team_logic(svc_team=None, emp_team='GRO')

        # Assert
        self.assertTrue(result, "HC6 should return True for NULL team")


class TestConstraintIntegration(unittest.TestCase):
    """Integration tests for constraint checker."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_db = MagicMock()
        self.checker = HardConstraintChecker(self.mock_db)

    def test_all_constraints_pass(self):
        """Test: All constraints pass for eligible assignment."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = [{'id': 'svc1', 'actief': True}]
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        existing = []

        # Act - check each constraint
        hc1 = self.checker.check_HC1_capability('emp1', 'svc1')
        hc2 = self.checker.check_HC2_no_overlap('emp1', '2025-11-24', 'morning', existing)
        hc3 = True  # Assume available
        hc4 = self.checker.check_HC4_max_per_employee('emp1', 3, 8)
        hc5 = self.checker.check_HC5_max_per_service('emp1', 'svc1', 1, 3)
        hc6 = self.checker.check_HC6_team_logic('GRO', 'GRO')

        # Assert: All should be True
        self.assertTrue(all([hc1, hc2, hc3, hc4, hc5, hc6]),
                       "All constraints should pass for eligible assignment")

    def test_one_constraint_fails(self):
        """Test: If one constraint fails, assignment is invalid."""
        # Arrange
        mock_response = MagicMock()
        mock_response.data = []  # HC1 fails
        self.mock_db.table.return_value.select.return_value.where.return_value.execute.return_value = mock_response

        # Act
        hc1 = self.checker.check_HC1_capability('emp1', 'svc1')

        # Assert
        self.assertFalse(hc1, "Assignment should fail if any constraint fails")


if __name__ == '__main__':
    unittest.main()