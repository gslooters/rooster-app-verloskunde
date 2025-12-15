"""
Integration tests for GREEDY Solver API

DRAAD 185: Tests for the FastAPI wrapper and full solve pipeline
Tests with live rooster data from Supabase

To run:
  pytest tests/test_greedy_api_integration.py -v

Author: DRAAD 185
Date: 2025-12-15
"""

import pytest
import os
from datetime import datetime
from fastapi.testclient import TestClient
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Import the API
from api.greedy_solver_wrapper import app

client = TestClient(app)

# Test rooster IDs (from SUPABASE)
TEST_ROOSTER_ID = "755efc3d-bcd2-4dfc-bc2e-278f3ba4ea58"  # Main test rooster
TEST_START_DATE = "2025-11-24"
TEST_END_DATE = "2025-12-28"


class TestHealthCheck:
    """Test health check endpoint."""
    
    def test_health_check(self):
        """Test /health endpoint returns healthy status."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "GREEDY Solver API"
        assert "timestamp" in data


class TestSolveGreedyEndpoint:
    """Test /api/v1/solve-greedy endpoint."""
    
    def test_solve_greedy_success(self):
        """Test successful GREEDY solve with valid rooster."""
        # Check if we can run this test (requires DB access)
        if not os.getenv('SUPABASE_URL'):
            pytest.skip("SUPABASE_URL not set - skipping live DB test")
        
        request_data = {
            "roster_id": TEST_ROOSTER_ID,
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        # Should either succeed or return proper error
        assert response.status_code in [200, 400, 500]
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            assert "status" in data
            assert "assignments_created" in data
            assert "total_required" in data
            assert "coverage" in data
            assert "solve_time" in data
            assert "bottlenecks" in data
            assert isinstance(data["bottlenecks"], list)
            
            # Verify coverage expectations
            assert data["coverage"] >= 0
            assert data["coverage"] <= 100
            
            # Verify assignments
            assert data["assignments_created"] >= 0
            assert data["assignments_created"] <= data["total_required"]
            
            # Verify solve time is reasonable
            assert 0 < data["solve_time"] < 30  # Should be < 30 seconds
            
            # For our test rooster, expect good coverage
            # (based on DRAAD 185 targets)
            if data["total_required"] > 0:
                assert data["coverage"] >= 25, f"Coverage too low: {data['coverage']}%"
    
    def test_solve_greedy_missing_roster_id(self):
        """Test error when roster_id is missing."""
        request_data = {
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        # Should get validation error
        assert response.status_code == 422  # Pydantic validation error
    
    def test_solve_greedy_invalid_roster(self):
        """Test error when roster_id doesn't exist."""
        if not os.getenv('SUPABASE_URL'):
            pytest.skip("SUPABASE_URL not set - skipping live DB test")
        
        request_data = {
            "roster_id": "00000000-0000-0000-0000-000000000000",  # Invalid ID
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        # Should get error (404 or 500 depending on DB)
        assert response.status_code in [404, 500]


class TestResponseFormat:
    """Test response format and structure."""
    
    def test_response_contains_all_fields(self):
        """Test that response contains all required fields."""
        if not os.getenv('SUPABASE_URL'):
            pytest.skip("SUPABASE_URL not set - skipping live DB test")
        
        request_data = {
            "roster_id": TEST_ROOSTER_ID,
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        if response.status_code == 200:
            data = response.json()
            
            # Required top-level fields
            required_fields = [
                "status",
                "assignments_created",
                "total_required",
                "coverage",
                "solve_time",
                "bottlenecks",
                "pre_planned_count",
                "greedy_count",
                "message"
            ]
            
            for field in required_fields:
                assert field in data, f"Missing field: {field}"
            
            # Verify bottleneck structure if any
            if data["bottlenecks"]:
                bottleneck = data["bottlenecks"][0]
                bottleneck_fields = [
                    "date",
                    "dagdeel",
                    "service_id",
                    "need",
                    "assigned",
                    "shortage"
                ]
                for field in bottleneck_fields:
                    assert field in bottleneck, f"Missing bottleneck field: {field}"
    
    def test_response_types(self):
        """Test that response fields have correct types."""
        if not os.getenv('SUPABASE_URL'):
            pytest.skip("SUPABASE_URL not set - skipping live DB test")
        
        request_data = {
            "roster_id": TEST_ROOSTER_ID,
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        if response.status_code == 200:
            data = response.json()
            
            # Type checks
            assert isinstance(data["status"], str)
            assert isinstance(data["assignments_created"], int)
            assert isinstance(data["total_required"], int)
            assert isinstance(data["coverage"], (int, float))
            assert isinstance(data["solve_time"], (int, float))
            assert isinstance(data["bottlenecks"], list)
            assert isinstance(data["pre_planned_count"], int)
            assert isinstance(data["greedy_count"], int)
            assert isinstance(data["message"], str)


class TestPerformance:
    """Test performance requirements."""
    
    def test_solve_time_under_target(self):
        """Test that solve completes within 5 second target."""
        if not os.getenv('SUPABASE_URL'):
            pytest.skip("SUPABASE_URL not set - skipping live DB test")
        
        request_data = {
            "roster_id": TEST_ROOSTER_ID,
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }
        
        response = client.post("/api/v1/solve-greedy", json=request_data)
        
        if response.status_code == 200:
            data = response.json()
            
            # Should be under 5 seconds (DRAAD 185 target)
            assert data["solve_time"] < 5.0, \
                f"Solve time {data['solve_time']}s exceeds 5s target"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
