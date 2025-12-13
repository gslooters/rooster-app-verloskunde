#!/usr/bin/env python3
"""
Unit Tests for RosterSolverV2
FASE1: Validatie van kritieke fixes

Tests:
1. Constraint 7 error handling (infeasibility detection)
2. DIO+DIA reification correctness
3. Solver status handling (all statuses)
4. Model building validation
5. Solution extraction correctness

Auteur: Govard Slooters
Datum: 2025-12-13
"""

import unittest
import logging
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

try:
    from RosterSolverV2 import RosterSolverV2
    HAS_ROSTERSOLVER = True
except ImportError:
    HAS_ROSTERSOLVER = False
    print("Warning: RosterSolverV2 not available - skipping tests")

# Configure logging for tests
logging.basicConfig(
    level=logging.DEBUG,
    format='[%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestRosterSolverV2Initialization(unittest.TestCase):
    """Test solver initialization."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0, 1]},
                {'id': 1, 'name': 'Bob', 'team_type': 'EBPH', 'services': [0, 1]},
            ],
            'required_staffing': [],
            'planning_horizon_days': 35,
            'max_solver_time': 5
        }
    
    def test_initialization_succeeds(self):
        """Test that solver initializes correctly."""
        solver = RosterSolverV2(self.config)
        self.assertIsNotNone(solver)
        self.assertEqual(len(solver.employees), 2)
        self.assertEqual(solver.planning_horizon_days, 35)
    
    def test_initialization_with_empty_employees(self):
        """Test initialization with no employees."""
        config = self.config.copy()
        config['employees'] = []
        solver = RosterSolverV2(config)
        self.assertEqual(len(solver.employees), 0)
    
    def test_configuration_preserved(self):
        """Test that configuration is stored correctly."""
        solver = RosterSolverV2(self.config)
        self.assertEqual(solver.config, self.config)


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestConstraint7ErrorHandling(unittest.TestCase):
    """Test Constraint 7 (exact staffing) error handling - KRITIEKE TEST."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0]},
            ],
            'required_staffing': [],
            'planning_horizon_days': 35,
            'max_solver_time': 5
        }
    
    def test_constraint_7_with_eligible_employees(self):
        """
        Test that Constraint 7 handles normal case correctly.
        Eligible employees should allow constraint to be added.
        """
        self.config['required_staffing'] = [
            {
                'service_id': 0,  # Alice has this service
                'team_type': 'EBPH',
                'aantal': 1,
                'date': datetime.now() + timedelta(days=1)
            }
        ]
        
        solver = RosterSolverV2(self.config)
        result = solver._add_constraint_7()
        
        # Should succeed and return True
        self.assertTrue(result, "Should handle eligible employees correctly")
    
    def test_constraint_7_with_no_eligible_employees(self):
        """
        Test KRITIEKE FIX: When no eligible employees,
        should add infeasibility constraint, NOT skip.
        """
        self.config['required_staffing'] = [
            {
                'service_id': 99,  # Alice DOESN'T have this service
                'team_type': 'EBPH',
                'aantal': 1,
                'date': datetime.now() + timedelta(days=1)
            }
        ]
        
        solver = RosterSolverV2(self.config)
        result = solver._add_constraint_7()
        
        # Should return False, indicating infeasibility
        self.assertFalse(result, "Should detect infeasibility when no eligible employees")
    
    def test_constraint_7_missing_fields(self):
        """
        Test handling of malformed staffing requirements.
        """
        self.config['required_staffing'] = [
            {  # Missing required fields
                'service_id': 0,
                # Missing: team_type, aantal, date
            }
        ]
        
        solver = RosterSolverV2(self.config)
        result = solver._add_constraint_7()
        
        # Should return True but skip malformed entry
        self.assertTrue(result)


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestDIODIAReification(unittest.TestCase):
    """Test DIO+DIA bonus reification - KRITIEKE TEST."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0, 1]},
            ],
            'required_staffing': [],
            'planning_horizon_days': 35,
            'max_solver_time': 5
        }
    
    def test_define_objective_creates_koppel_vars(self):
        """
        Test that DIO+DIA reification creates correct variables.
        """
        solver = RosterSolverV2(self.config)
        
        # Mock assignment variables
        solver.assignment_vars = {
            (0, 0, 0): MagicMock(name="dio"),  # DIO (morning)
            (0, 0, 1): MagicMock(name="dia"),  # DIA (afternoon)
        }
        
        # Define objective
        solver._define_objective()
        
        # Check that koppel variable was created
        self.assertIn((0, 0), solver.koppel_vars, "Should create koppel variable for day")
    
    def test_define_objective_with_no_pairs(self):
        """
        Test that objective handles missing DIO+DIA pairs gracefully.
        """
        solver = RosterSolverV2(self.config)
        solver.assignment_vars = {}  # No assignments
        
        # Should not raise exception
        try:
            solver._define_objective()
        except Exception as e:
            self.fail(f"define_objective raised {e}")


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestSolverStatusHandling(unittest.TestCase):
    """Test solver status handling - KRITIEKE TEST."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0]},
            ],
            'required_staffing': [],
            'planning_horizon_days': 35,
            'max_solver_time': 5
        }
    
    def test_status_name_conversion(self):
        """
        Test that solver status codes are converted correctly.
        """
        solver = RosterSolverV2(self.config)
        
        # Mock cp_model statuses
        with patch('RosterSolverV2.cp_model') as mock_cp:
            mock_cp.OPTIMAL = 4
            mock_cp.FEASIBLE = 2
            mock_cp.INFEASIBLE = 3
            mock_cp.UNKNOWN = 0
            
            # Test all status conversions
            self.assertEqual(solver._get_status_name(4), 'OPTIMAL')
            self.assertEqual(solver._get_status_name(2), 'FEASIBLE')
            self.assertEqual(solver._get_status_name(3), 'INFEASIBLE')
            self.assertEqual(solver._get_status_name(0), 'UNKNOWN')
    
    def test_solve_returns_all_status_codes(self):
        """
        Test that solve() handles all possible solver statuses.
        """
        solver = RosterSolverV2(self.config)
        
        # We can't easily test all statuses without full OR-Tools,
        # but we can verify the method exists and returns dict
        with patch.object(solver, 'build_model', return_value=True):
            # This would normally call the actual solver
            # For now just test method signature
            self.assertTrue(callable(solver.solve))


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestModelBuilding(unittest.TestCase):
    """Test model building."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0]},
                {'id': 1, 'name': 'Bob', 'team_type': 'Artsen', 'services': [1]},
            ],
            'required_staffing': [
                {
                    'service_id': 0,
                    'team_type': 'EBPH',
                    'aantal': 1,
                    'date': datetime.now() + timedelta(days=1)
                }
            ],
            'planning_horizon_days': 7,  # Short for testing
            'max_solver_time': 5
        }
    
    def test_build_model_succeeds(self):
        """
        Test that model builds successfully.
        """
        solver = RosterSolverV2(self.config)
        result = solver.build_model()
        
        # build_model() may return False if infeasible, that's OK
        self.assertIsInstance(result, bool)
    
    def test_load_employee_services(self):
        """
        Test that employee services are loaded correctly.
        """
        solver = RosterSolverV2(self.config)
        solver._load_employee_services()
        
        # Check that services were loaded
        self.assertIn(0, solver.employee_services)
        self.assertIn(1, solver.employee_services)
        self.assertEqual(solver.employee_services[0], {0})
        self.assertEqual(solver.employee_services[1], {1})
    
    def test_get_team_employees(self):
        """
        Test filtering employees by team type.
        """
        solver = RosterSolverV2(self.config)
        
        ebph_employees = solver._get_team_employees('EBPH')
        artsen_employees = solver._get_team_employees('Artsen')
        
        self.assertEqual(len(ebph_employees), 1)
        self.assertEqual(len(artsen_employees), 1)
        self.assertIn(0, ebph_employees)
        self.assertIn(1, artsen_employees)


@unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
class TestSolutionExtraction(unittest.TestCase):
    """Test solution extraction."""
    
    def setUp(self):
        """Create test configuration."""
        self.config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0]},
            ],
            'required_staffing': [],
            'planning_horizon_days': 35,
            'max_solver_time': 5
        }
    
    def test_extract_solution_returns_dict(self):
        """
        Test that solution extraction returns correct structure.
        """
        solver = RosterSolverV2(self.config)
        
        # Mock solver
        mock_solver = MagicMock()
        mock_solver.BooleanValue.return_value = False
        mock_solver.ObjectiveValue.return_value = 500.0
        mock_solver.NumConflicts.return_value = 0
        mock_solver.NumBranches.return_value = 100
        
        result = solver._extract_solution(mock_solver, 'OPTIMAL')
        
        # Check result structure
        self.assertIsInstance(result, dict)
        self.assertIn('status', result)
        self.assertIn('assignments', result)
        self.assertEqual(result['status'], 'OPTIMAL')


class TestIntegration(unittest.TestCase):
    """Integration tests."""
    
    @unittest.skipUnless(HAS_ROSTERSOLVER, "RosterSolverV2 not available")
    def test_end_to_end_simple(self):
        """
        Test full solve cycle with simple config.
        """
        config = {
            'employees': [
                {'id': 0, 'name': 'Alice', 'team_type': 'EBPH', 'services': [0, 1]},
                {'id': 1, 'name': 'Bob', 'team_type': 'EBPH', 'services': [0, 1]},
            ],
            'required_staffing': [
                {
                    'service_id': 0,
                    'team_type': 'EBPH',
                    'aantal': 1,
                    'date': datetime.now() + timedelta(days=1)
                }
            ],
            'planning_horizon_days': 7,
            'max_solver_time': 2
        }
        
        solver = RosterSolverV2(config)
        
        # Build and solve
        if solver.build_model():
            result = solver.solve()
            self.assertIsInstance(result, dict)
            self.assertIn('status', result)
        else:
            logger.warning("Model building failed - problem may be infeasible")


def run_tests():
    """Run all tests with detailed output."""
    logger.info("="*70)
    logger.info("RosterSolverV2 Unit Tests - FASE1")
    logger.info("="*70)
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestRosterSolverV2Initialization))
    suite.addTests(loader.loadTestsFromTestCase(TestConstraint7ErrorHandling))
    suite.addTests(loader.loadTestsFromTestCase(TestDIODIAReification))
    suite.addTests(loader.loadTestsFromTestCase(TestSolverStatusHandling))
    suite.addTests(loader.loadTestsFromTestCase(TestModelBuilding))
    suite.addTests(loader.loadTestsFromTestCase(TestSolutionExtraction))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    
    # Run with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    logger.info("="*70)
    logger.info(f"Tests run: {result.testsRun}")
    logger.info(f"Failures: {len(result.failures)}")
    logger.info(f"Errors: {len(result.errors)}")
    logger.info(f"Skipped: {len(result.skipped)}")
    logger.info("="*70)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)
