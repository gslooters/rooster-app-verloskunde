#!/usr/bin/env python3
"""
Pytest configuration and shared fixtures
FASE 3: Test Suite Development
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock


# ============================================================================
# GLOBAL CONFIGURATION
# ============================================================================

def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "e2e: mark test as end-to-end test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )


# ============================================================================
# SHARED FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
def test_config():
    """Global test configuration"""
    return {
        'test_roster_id': 'test-roster-001',
        'test_employees': 5,
        'test_weeks': 4,
        'test_date_start': '2025-12-15',
        'services': ['DDO', 'DIO', 'DDA', 'OSP', 'NVAO'],
        'max_shifts_per_employee': 5,
        'min_shifts_per_employee': 2
    }


@pytest.fixture
def mock_db():
    """Mock database instance"""
    db = MagicMock()
    
    # Default mock behaviors
    db.is_connected.return_value = True
    db.ping.return_value = True
    
    return db


@pytest.fixture
def sample_employees():
    """Sample employees for testing"""
    return [
        MagicMock(
            id=f'emp{i}',
            name=f'Employee {i}',
            email=f'emp{i}@example.com',
            max_shifts=5,
            available_services=['DDO', 'DIO', 'DDA'],
            blackout_dates=[]
        )
        for i in range(1, 6)
    ]


@pytest.fixture
def sample_shift_requirements():
    """Sample shift requirements for testing"""
    requirements = {}
    base_date = datetime(2025, 12, 15)
    
    for day in range(28):  # 4 weeks
        date_str = (base_date + timedelta(days=day)).isoformat()[:10]
        requirements[date_str] = {
            'DDO': 2,  # Day shifts
            'DIO': 2,  # Day-to-evening
            'DDA': 1   # Day-to-afternoon
        }
    
    return requirements


@pytest.fixture
def sample_roster_data(test_config, sample_employees, sample_shift_requirements):
    """Complete sample roster data"""
    return {
        'roster_id': test_config['test_roster_id'],
        'status': 'DRAFT',
        'start_date': test_config['test_date_start'],
        'num_weeks': test_config['test_weeks'],
        'employees': sample_employees,
        'shift_requirements': sample_shift_requirements,
        'created_at': datetime.now().isoformat()
    }


@pytest.fixture
def sample_slot_assignments():
    """Sample slot assignments"""
    assignments = []
    for i in range(1, 41):  # 40 slots
        assignments.append({
            'slot_id': f'slot{i}',
            'date': f'2025-12-{15 + (i//5):02d}',
            'employee_id': f'emp{(i % 5) + 1}',
            'service': ['DDO', 'DIO', 'DDA'][i % 3]
        })
    return assignments


# ============================================================================
# DATABASE FIXTURES
# ============================================================================

@pytest.fixture
def db_with_employees(mock_db, sample_employees):
    """Mock DB with sample employees loaded"""
    mock_db.fetch_employees.return_value = sample_employees
    return mock_db


@pytest.fixture
def db_with_roster_data(mock_db, sample_roster_data, sample_shift_requirements):
    """Mock DB with complete roster data"""
    mock_db.fetch_roster.return_value = sample_roster_data
    mock_db.fetch_shift_requirements.return_value = sample_shift_requirements
    mock_db.fetch_employees.return_value = sample_roster_data['employees']
    return mock_db


# ============================================================================
# SOLVER FIXTURES
# ============================================================================

@pytest.fixture
def solver_engine(db_with_roster_data):
    """SolverEngine instance with mock DB"""
    from solver_engine import SolverEngine
    return SolverEngine(db=db_with_roster_data)


@pytest.fixture
def capacity_analyzer():
    """CapacityAnalyzer instance"""
    from solver_engine import CapacityAnalyzer
    return CapacityAnalyzer()


# ============================================================================
# UTILITY FIXTURES
# ============================================================================

@pytest.fixture
def cleanup_temp_files():
    """Cleanup temporary test files after tests"""
    import os
    import tempfile
    
    temp_files = []
    
    def register_temp_file(path):
        temp_files.append(path)
        return path
    
    yield register_temp_file
    
    # Cleanup
    for file_path in temp_files:
        if os.path.exists(file_path):
            os.remove(file_path)


@pytest.fixture
def timer():
    """Simple timer for performance testing"""
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            import time
            self.start_time = time.time()
        
        def stop(self):
            import time
            self.end_time = time.time()
        
        @property
        def elapsed_ms(self):
            if self.start_time and self.end_time:
                return (self.end_time - self.start_time) * 1000
            return None
    
    return Timer()


# ============================================================================
# LOGGING FIXTURES
# ============================================================================

@pytest.fixture
def caplog_setup(caplog):
    """Setup logging capture"""
    import logging
    caplog.set_level(logging.DEBUG)
    return caplog


# ============================================================================
# MARKERS & SKIP CONDITIONS
# ============================================================================

def pytest_collection_modifyitems(config, items):
    """Modify test collection"""
    for item in items:
        # Mark unmarked tests by file pattern
        if "test_solver_engine" in item.nodeid:
            item.add_marker(pytest.mark.unit)
        elif "test_integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)
        elif "test_e2e" in item.nodeid:
            item.add_marker(pytest.mark.e2e)


# ============================================================================
# REPORT HOOKS
# ============================================================================

def pytest_runtest_logreport(report):
    """Add custom reporting"""
    if report.when == "call":
        if hasattr(report, 'duration'):
            if report.duration > 1.0:  # Slow test
                report.add_marker(pytest.mark.slow)


if __name__ == '__main__':
    # Run when conftest is executed directly
    pytest.main([__file__, '--collect-only', '-q'])
