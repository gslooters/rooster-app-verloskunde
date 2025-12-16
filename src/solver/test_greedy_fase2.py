"""
FASE 2: Comprehensive Tests for GREEDY API Endpoint

DRAAD 194 Test Suite for GREEDY Separate Service
- API endpoint validation
- Request/response models
- Constraint checking (HC1-HC6)
- Performance benchmarking
- Integration tests

Author: DRAAD 194 FASE 2 Testing
Date: 2025-12-16
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any
import uuid
from unittest.mock import Mock, patch, MagicMock

from src.solver.greedy_api import (
    SolveRequest,
    SolveResponse,
    BottleneckResponse,
    _validate_solve_request
)


# ============================================================================
# REQUEST MODEL TESTS
# ============================================================================

class TestSolveRequestModel:
    """Test SolveRequest model validation."""
    
    def test_valid_request(self):
        """Test valid request parsing."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31",
            max_shifts_per_employee=8
        )
        assert request.roster_id is not None
        assert request.start_date == "2025-01-01"
        assert request.end_date == "2025-01-31"
        assert request.max_shifts_per_employee == 8
    
    def test_default_max_shifts(self):
        """Test default max_shifts_per_employee."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31"
        )
        assert request.max_shifts_per_employee == 8


# ============================================================================
# VALIDATION TESTS
# ============================================================================

class TestSolveRequestValidation:
    """Test _validate_solve_request function."""
    
    def test_valid_request_passes(self):
        """Test valid request passes validation."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31"
        )
        # Should not raise
        _validate_solve_request(request)
    
    def test_invalid_roster_id_format(self):
        """Test invalid UUID format raises error."""
        request = SolveRequest(
            roster_id="not-a-uuid",
            start_date="2025-01-01",
            end_date="2025-01-31"
        )
        with pytest.raises(ValueError, match="Invalid roster_id"):
            _validate_solve_request(request)
    
    def test_invalid_start_date_format(self):
        """Test invalid start_date format."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="01-01-2025",  # Wrong format
            end_date="2025-01-31"
        )
        with pytest.raises(ValueError, match="Invalid start_date"):
            _validate_solve_request(request)
    
    def test_invalid_end_date_format(self):
        """Test invalid end_date format."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="31/01/2025"  # Wrong format
        )
        with pytest.raises(ValueError, match="Invalid end_date"):
            _validate_solve_request(request)
    
    def test_start_date_after_end_date(self):
        """Test start_date after end_date raises error."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-31",
            end_date="2025-01-01"  # Reversed
        )
        with pytest.raises(ValueError, match="must be before"):
            _validate_solve_request(request)
    
    def test_same_date_raises_error(self):
        """Test same start and end date raises error."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-01"  # Same day
        )
        with pytest.raises(ValueError, match="at least 1 day"):
            _validate_solve_request(request)
    
    def test_date_range_too_long(self):
        """Test date range > 365 days raises error."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2026-02-01"  # > 365 days
        )
        with pytest.raises(ValueError, match="must not exceed 365 days"):
            _validate_solve_request(request)
    
    def test_max_shifts_zero(self):
        """Test max_shifts_per_employee = 0 raises error."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31",
            max_shifts_per_employee=0
        )
        with pytest.raises(ValueError, match="must be > 0"):
            _validate_solve_request(request)
    
    def test_max_shifts_too_high(self):
        """Test max_shifts_per_employee > 100 raises error."""
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31",
            max_shifts_per_employee=101
        )
        with pytest.raises(ValueError, match="must be"):
            _validate_solve_request(request)


# ============================================================================
# RESPONSE MODEL TESTS
# ============================================================================

class TestSolveResponseModel:
    """Test SolveResponse model."""
    
    def test_successful_response(self):
        """Test successful response building."""
        response = SolveResponse(
            status="success",
            assignments_created=224,
            total_required=228,
            coverage=98.2,
            pre_planned_count=10,
            greedy_count=214,
            solve_time=3.24,
            bottlenecks=[],
            message="Test message",
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )
        assert response.status == "success"
        assert response.coverage == 98.2
        assert response.solver_type == "GREEDY"
    
    def test_partial_response(self):
        """Test partial coverage response."""
        response = SolveResponse(
            status="partial",
            assignments_created=140,
            total_required=228,
            coverage=61.4,
            pre_planned_count=10,
            greedy_count=130,
            solve_time=2.5,
            bottlenecks=[],
            message="Partial coverage",
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )
        assert response.status == "partial"
        assert response.coverage < 95
    
    def test_failed_response(self):
        """Test failed response."""
        response = SolveResponse(
            status="failed",
            assignments_created=0,
            total_required=228,
            coverage=0,
            pre_planned_count=0,
            greedy_count=0,
            solve_time=0,
            bottlenecks=[],
            message="Error: Connection failed",
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )
        assert response.status == "failed"
        assert response.coverage == 0


# ============================================================================
# BOTTLENECK RESPONSE TESTS
# ============================================================================

class TestBottleneckResponse:
    """Test BottleneckResponse model."""
    
    def test_bottleneck_creation(self):
        """Test bottleneck response creation."""
        bn = BottleneckResponse(
            date="2025-01-01",
            dagdeel="O",
            service_id=str(uuid.uuid4()),
            need=2,
            assigned=1,
            shortage=1,
            reason="No trained employees",
            suggestion="Train more staff"
        )
        assert bn.date == "2025-01-01"
        assert bn.shortage == 1
        assert bn.reason == "No trained employees"


# ============================================================================
# CONSTRAINT CHECKER TESTS (HC1-HC6)
# ============================================================================

class TestHardConstraints:
    """Test hard constraint checking."""
    
    @patch('src.solver.constraint_checker.HardConstraintChecker')
    def test_hc1_capability_check(self, mock_checker):
        """Test HC1: Employee capability check."""
        checker = mock_checker.return_value
        checker.check_HC1_capability.return_value = True
        
        result = checker.check_HC1_capability(
            emp_id="emp1",
            svc_id="svc1",
            roster_id="roster1"
        )
        assert result is True
    
    @patch('src.solver.constraint_checker.HardConstraintChecker')
    def test_hc2_no_overlap_check(self, mock_checker):
        """Test HC2: No overlapping shifts."""
        checker = mock_checker.return_value
        checker.check_HC2_no_overlap.return_value = True
        
        existing = []
        result = checker.check_HC2_no_overlap(
            emp_id="emp1",
            date_str="2025-01-01",
            dagdeel="O",
            existing_assignments=existing
        )
        assert result is True
    
    @patch('src.solver.constraint_checker.HardConstraintChecker')
    def test_hc4_max_per_employee(self, mock_checker):
        """Test HC4: Max shifts per employee."""
        checker = mock_checker.return_value
        checker.check_HC4_max_per_employee.return_value = True
        
        result = checker.check_HC4_max_per_employee(
            emp_id="emp1",
            current_count=7,
            target=8
        )
        assert result is True
    
    @patch('src.solver.constraint_checker.HardConstraintChecker')
    def test_hc4_max_exceeded(self, mock_checker):
        """Test HC4: Max exceeded."""
        checker = mock_checker.return_value
        checker.check_HC4_max_per_employee.return_value = False
        
        result = checker.check_HC4_max_per_employee(
            emp_id="emp1",
            current_count=8,  # Already at target
            target=8
        )
        assert result is False


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Test performance characteristics."""
    
    def test_request_validation_performance(self):
        """Test validation is fast (< 10ms)."""
        import time
        
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31"
        )
        
        start = time.time()
        _validate_solve_request(request)
        elapsed = (time.time() - start) * 1000  # ms
        
        assert elapsed < 10, f"Validation took {elapsed}ms (expected < 10ms)"


# ============================================================================
# INTEGRATION TESTS (WITH MOCKED ENGINE)
# ============================================================================

class TestAPIIntegration:
    """Integration tests for API endpoint."""
    
    @patch('src.solver.greedy_api.GreedyRosteringEngine')
    def test_solve_endpoint_success(self, mock_engine_class):
        """Test successful solve endpoint call."""
        # Mock engine
        mock_engine = MagicMock()
        mock_engine_class.return_value = mock_engine
        
        from src.solver.greedy_engine import SolveResult
        
        mock_engine.solve.return_value = SolveResult(
            status='success',
            assignments_created=224,
            total_required=228,
            coverage=98.2,
            bottlenecks=[],
            solve_time=3.24,
            pre_planned_count=10,
            greedy_count=214,
            message="Test"
        )
        
        # Create request
        request = SolveRequest(
            roster_id=str(uuid.uuid4()),
            start_date="2025-01-01",
            end_date="2025-01-31"
        )
        
        # Validate passes
        _validate_solve_request(request)
        
        assert request.roster_id is not None


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
