#!/usr/bin/env python3
"""
Pytest configuration for tests/ directory - DRAAD172

Shared fixtures and configuration for test suite.
"""

import pytest
import logging
import sys
from pathlib import Path
from datetime import date, timedelta
from unittest.mock import MagicMock

# Add solver directory to path
solver_path = Path(__file__).parent.parent / 'solver'
sys.path.insert(0, str(solver_path))

from models import Employee, Service, RosterEmployeeService, TeamType

logger = logging.getLogger(__name__)


def pytest_configure(config):
    """Configure pytest."""
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


@pytest.fixture(scope="session")
def test_config():
    """Global test configuration."""
    return {
        'test_roster_id': 'test-roster-draad172',
        'test_employees': 3,
        'test_weeks': 2,
        'test_date_start': date(2025, 12, 15),
        'services': ['DDO', 'DIO', 'DDA'],
    }


@pytest.fixture
def sample_employees():
    """Sample employees for testing."""
    return [
        Employee(
            id=f'emp{i}',
            name=f'Employee {i}',
            email=f'emp{i}@test.com',
            team=TeamType.MAAT if i % 2 == 0 else TeamType.LOONDIENST,
            max_shifts=5
        )
        for i in range(1, 4)
    ]


@pytest.fixture
def sample_services():
    """Sample services."""
    return [
        Service(id='s1', code='DDO', naam='Dag-Dag-Dag Ochtend'),
        Service(id='s2', code='DIO', naam='Dag-Info-Ochtend'),
        Service(id='s3', code='DDA', naam='Dag-Dag-Avond')
    ]


if __name__ == '__main__':
    pytest.main([__file__, '--collect-only'])
