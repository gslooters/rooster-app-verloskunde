#!/usr/bin/env python3
"""Live integration test for GREEDY API on production Railway.

DRAAD 209: TEST 2 - Complete GREEDY Service Verification

This test:
1. ✅ Tests health endpoint
2. ⏳ Tests root endpoint (service info)
3. ⏳ Tests validate endpoint
4. ⏳ Tests docs endpoint

Run via: GitHub Actions or Python directly
No local terminal required - all via GitHub tools
"""

import json
import sys
from datetime import datetime
from typing import Dict, List, Any

try:
    import requests
except ImportError:
    print("ERROR: requests library not found")
    print("Install: pip install requests")
    sys.exit(1)


class GreedyAPITest:
    """Test GREEDY API endpoints on production."""
    
    def __init__(self, base_url: str = "https://greedy-production.up.railway.app"):
        """Initialize test runner.
        
        Args:
            base_url: GREEDY service base URL
        """
        self.base_url = base_url
        self.results: List[Dict[str, Any]] = []
        self.test_start = datetime.utcnow()
        
    def test_health(self) -> Dict[str, Any]:
        """Test 1: Health endpoint.
        
        Endpoint: GET /api/greedy/health
        Expected: {"status": "ok", "solver": "greedy", ...}
        """
        test_name = "Test 1: Health Endpoint"
        url = f"{self.base_url}/api/greedy/health"
        
        try:
            response = requests.get(url, timeout=5)
            
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": response.status_code,
                "passed": response.status_code == 200,
                "response": response.json() if response.status_code == 200 else response.text,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Additional validation
            if response.status_code == 200:
                data = response.json()
                result["details"] = {
                    "has_status": "status" in data,
                    "has_solver": "solver" in data,
                    "has_timestamp": "timestamp" in data,
                    "status_value": data.get("status"),
                    "solver_value": data.get("solver")
                }
            
            self.results.append(result)
            return result
            
        except requests.exceptions.Timeout:
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": None,
                "passed": False,
                "error": "Request timeout (>5s)",
                "timestamp": datetime.utcnow().isoformat()
            }
            self.results.append(result)
            return result
            
        except Exception as e:
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": None,
                "passed": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            self.results.append(result)
            return result
    
    def test_root(self) -> Dict[str, Any]:
        """Test 2: Root endpoint.
        
        Endpoint: GET /
        Expected: Service info with endpoints list
        """
        test_name = "Test 2: Root Endpoint (Service Info)"
        url = f"{self.base_url}/"
        
        try:
            response = requests.get(url, timeout=5)
            
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": response.status_code,
                "passed": response.status_code == 200,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["details"] = {
                    "has_service": "service" in data,
                    "has_version": "version" in data,
                    "has_endpoints": "endpoints" in data,
                    "service_name": data.get("service"),
                    "version": data.get("version"),
                    "endpoints_count": len(data.get("endpoints", {}))
                }
            else:
                result["response"] = response.text
            
            self.results.append(result)
            return result
            
        except Exception as e:
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": None,
                "passed": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            self.results.append(result)
            return result
    
    def test_validate(self) -> Dict[str, Any]:
        """Test 3: Validate endpoint.
        
        Endpoint: POST /api/greedy/validate
        Purpose: Validate roster data structure
        """
        test_name = "Test 3: Validate Endpoint"
        url = f"{self.base_url}/api/greedy/validate"
        
        # Test with minimal valid payload
        payload = {
            "roster_id": "00000000-0000-0000-0000-000000000000",
            "start_date": "2025-01-06",
            "end_date": "2025-01-10"
        }
        
        try:
            response = requests.post(
                url,
                json=payload,
                timeout=5,
                headers={"Content-Type": "application/json"}
            )
            
            result = {
                "test": test_name,
                "url": url,
                "method": "POST",
                "status_code": response.status_code,
                "payload": payload,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # 200 = valid, 400 = validation error (both OK for endpoint test)
            result["passed"] = response.status_code in [200, 400, 422]
            result["response"] = response.json() if response.status_code < 500 else response.text
            
            self.results.append(result)
            return result
            
        except Exception as e:
            result = {
                "test": test_name,
                "url": url,
                "method": "POST",
                "status_code": None,
                "passed": False,
                "error": str(e),
                "payload": payload,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.results.append(result)
            return result
    
    def test_docs(self) -> Dict[str, Any]:
        """Test 4: Documentation endpoint.
        
        Endpoint: GET /docs
        Purpose: Verify API documentation is available
        """
        test_name = "Test 4: API Docs Endpoint"
        url = f"{self.base_url}/docs"
        
        try:
            response = requests.get(url, timeout=5)
            
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": response.status_code,
                "passed": response.status_code == 200,
                "content_type": response.headers.get("Content-Type", "unknown"),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if response.status_code == 200:
                # Just verify it's HTML (Swagger UI)
                has_swagger = "swagger" in response.text.lower()
                has_openapi = "openapi" in response.text.lower()
                result["details"] = {
                    "is_swagger": has_swagger or has_openapi,
                    "response_size": len(response.text)
                }
            else:
                result["response"] = response.text[:200]  # First 200 chars
            
            self.results.append(result)
            return result
            
        except Exception as e:
            result = {
                "test": test_name,
                "url": url,
                "method": "GET",
                "status_code": None,
                "passed": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            self.results.append(result)
            return result
    
    def get_summary(self) -> Dict[str, Any]:
        """Generate test summary."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.get("passed", False))
        
        return {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%",
            "test_duration": str(datetime.utcnow() - self.test_start),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def run_all_tests(self) -> None:
        """Execute all tests."""
        print("\n" + "="*70)
        print("DRAAD 209: TEST 2 - GREEDY API LIVE INTEGRATION TEST")
        print("="*70)
        print(f"Base URL: {self.base_url}")
        print(f"Start Time: {self.test_start.isoformat()}")
        print("="*70)
        
        # Run tests
        print("\n[1/4] Testing Health Endpoint...")
        test1 = self.test_health()
        print(f"  Status: {'✅ PASS' if test1['passed'] else '❌ FAIL'}")
        
        print("\n[2/4] Testing Root Endpoint...")
        test2 = self.test_root()
        print(f"  Status: {'✅ PASS' if test2['passed'] else '❌ FAIL'}")
        
        print("\n[3/4] Testing Validate Endpoint...")
        test3 = self.test_validate()
        print(f"  Status: {'✅ PASS' if test3['passed'] else '❌ FAIL'}")
        
        print("\n[4/4] Testing Docs Endpoint...")
        test4 = self.test_docs()
        print(f"  Status: {'✅ PASS' if test4['passed'] else '❌ FAIL'}")
        
        # Summary
        summary = self.get_summary()
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']}")
        print(f"Failed: {summary['failed']}")
        print(f"Success Rate: {summary['success_rate']}")
        print(f"Duration: {summary['test_duration']}")
        print("="*70)
    
    def save_results(self, filename: str = "tests/DRAAD_209_TEST_RESULTS.json") -> None:
        """Save test results to file."""
        output = {
            "test_suite": "DRAAD 209: GREEDY API Integration",
            "test_type": "Live Production Endpoint Test",
            "execution_date": datetime.utcnow().isoformat(),
            "results": self.results,
            "summary": self.get_summary()
        }
        
        try:
            with open(filename, 'w') as f:
                json.dump(output, f, indent=2)
            print(f"\n✅ Results saved to: {filename}")
        except Exception as e:
            print(f"\n❌ Failed to save results: {e}")


def main():
    """Main entry point."""
    # Run tests
    tester = GreedyAPITest()
    tester.run_all_tests()
    tester.save_results()
    
    # Exit code based on results
    summary = tester.get_summary()
    sys.exit(0 if summary['failed'] == 0 else 1)


if __name__ == "__main__":
    main()
