"""
Greedy API Endpoint for OPTIE C - Separate Railway Service

DRAAD 194 FASE 2: FastAPI endpoint for GREEDY solver
- Expose: POST /api/greedy/solve
- Request validation
- Call GreedyRosteringEngine
- Save results
- Return response (fast & reliable)

Performance:
- Solve time: 2-5 seconds
- Coverage: 98%+
- HTTP: 200 success (or 400/500 errors)

FIXES (OPDRACHT 195):
- Pydantic V2 deprecation: schema_extra → json_schema_extra
- ConfigDict for model configuration
- Clean logs without warnings

Author: DRAAD 194 FASE 2 + OPDRACHT 195
Date: 2025-12-16
"""

import logging
import os
import traceback
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
import uuid

from .greedy_engine import GreedyRosteringEngine, SolveResult

logger = logging.getLogger(__name__)

# ============================================================================
# REQUEST & RESPONSE MODELS (Pydantic V2)
# ============================================================================

class SolveRequest(BaseModel):
    """Request payload for GREEDY solver."""
    roster_id: str = Field(..., description="Target roster UUID")
    start_date: str = Field(..., description="Roster start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="Roster end date (YYYY-MM-DD)")
    max_shifts_per_employee: Optional[int] = Field(
        default=8,
        description="Maximum shifts per employee (default: 8)"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "roster_id": "550e8400-e29b-41d4-a716-446655440000",
                "start_date": "2025-01-01",
                "end_date": "2025-01-31",
                "max_shifts_per_employee": 8
            }
        }
    )


class BottleneckResponse(BaseModel):
    """Single bottleneck in response."""
    date: str
    dagdeel: str
    service_id: str
    need: int
    assigned: int
    shortage: int
    reason: Optional[str] = None
    suggestion: Optional[str] = None


class SolveResponse(BaseModel):
    """Response payload from GREEDY solver."""
    status: str = Field(..., description="'success', 'partial', or 'failed'")
    assignments_created: int = Field(..., description="Total assignments created")
    total_required: int = Field(..., description="Total slots needed")
    coverage: float = Field(..., description="Coverage percentage (0-100)")
    pre_planned_count: int = Field(..., description="Pre-planned assignments locked")
    greedy_count: int = Field(..., description="New greedy assignments created")
    solve_time: float = Field(..., description="Solve duration in seconds")
    bottlenecks: List[BottleneckResponse] = Field(default_factory=list, description="Unfilled slots")
    message: str = Field(..., description="Human-readable result message")
    solver_type: str = Field(default="GREEDY", description="Solver type (always 'GREEDY')")
    timestamp: str = Field(..., description="ISO8601 timestamp of solve")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "assignments_created": 224,
                "total_required": 228,
                "coverage": 98.2,
                "pre_planned_count": 10,
                "greedy_count": 214,
                "solve_time": 3.24,
                "bottlenecks": [],
                "message": "DRAAD 190 SMART GREEDY: 98.2% coverage in 3.24s",
                "solver_type": "GREEDY",
                "timestamp": "2025-12-16T14:30:45.123456Z"
            }
        }
    )


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(prefix="/api/greedy", tags=["greedy-solver"])


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/solve", response_model=SolveResponse, status_code=200)
async def solve_greedy(request: SolveRequest) -> SolveResponse:
    """
    GREEDY Solver Endpoint
    
    Fast roster generation using smart greedy allocation (DRAAD 190).
    - Phase 1: Lock pre-planned assignments
    - Phase 2: Greedy allocate with HC1-HC6 constraints
    - Phase 3: Analyze bottlenecks
    - Phase 4: Save to database
    - Phase 5: Return result
    
    **Performance:**
    - Solve time: 2-5 seconds
    - Coverage: 98%+
    - Deterministic output
    
    **Usage:**
    ```json
    POST /api/greedy/solve
    {
        "roster_id": "550e8400-e29b-41d4-a716-446655440000",
        "start_date": "2025-01-01",
        "end_date": "2025-01-31",
        "max_shifts_per_employee": 8
    }
    ```
    
    **Response:**
    - **success**: Coverage >= 95%
    - **partial**: Coverage 50-94%
    - **failed**: Error during solve
    
    Raises:
        HTTPException: 400 if validation fails, 500 if solve fails
    """
    logger.info(
        f"[GREEDY-API] Solve request: roster={request.roster_id}, "
        f"period={request.start_date} to {request.end_date}"
    )
    
    try:
        # Validate request
        _validate_solve_request(request)
        
        # Get Supabase credentials
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error("Missing SUPABASE_URL or SUPABASE_KEY")
            raise HTTPException(
                status_code=500,
                detail="Missing Supabase configuration"
            )
        
        # Create config for engine
        config = {
            'supabase_url': supabase_url,
            'supabase_key': supabase_key,
            'roster_id': request.roster_id,
            'start_date': request.start_date,
            'end_date': request.end_date,
            'max_shifts_per_employee': request.max_shifts_per_employee
        }
        
        # Create and run engine
        logger.info("Creating GreedyRosteringEngine...")
        engine = GreedyRosteringEngine(config)
        
        logger.info("Starting GREEDY algorithm (DRAAD 190 Smart Allocation)...")
        result: SolveResult = engine.solve()
        
        # Build response
        response = SolveResponse(
            status=result.status,
            assignments_created=result.assignments_created,
            total_required=result.total_required,
            coverage=result.coverage,
            pre_planned_count=result.pre_planned_count,
            greedy_count=result.greedy_count,
            solve_time=result.solve_time,
            bottlenecks=[BottleneckResponse(**bn) for bn in result.bottlenecks],
            message=result.message,
            solver_type="GREEDY",
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )
        
        logger.info(
            f"[GREEDY-API] SUCCESS: {response.coverage}% coverage "
            f"({response.assignments_created}/{response.total_required}) "
            f"in {response.solve_time}s"
        )
        
        return response
        
    except ValueError as e:
        # Validation error
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
        
    except Exception as e:
        # Server error
        logger.error(f"Solve error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Solve failed: {str(e)}"
        )


@router.get("/health", status_code=200)
async def health_check() -> Dict[str, str]:
    """
    Health Check Endpoint
    
    Used by Railway for service monitoring.
    
    Returns:
        {"status": "ok", "solver": "greedy"}
    """
    logger.debug("Health check")
    return {
        "status": "ok",
        "solver": "greedy",
        "timestamp": datetime.utcnow().isoformat() + 'Z'
    }


@router.post("/validate", status_code=200)
async def validate_request(request: SolveRequest) -> Dict[str, Any]:
    """
    Validate Solve Request
    
    Check if request is valid before solving.
    Useful for pre-flight checks from frontend.
    
    Returns:
        {"valid": true, "message": "Request OK"}
    """
    try:
        _validate_solve_request(request)
        logger.info("Request validation passed")
        return {
            "valid": True,
            "message": "Request is valid",
            "roster_id": request.roster_id,
            "period": f"{request.start_date} to {request.end_date}"
        }
    except ValueError as e:
        logger.warning(f"Request validation failed: {e}")
        return {
            "valid": False,
            "message": str(e),
            "error": str(e)
        }


# ============================================================================
# VALIDATION HELPERS
# ============================================================================

def _validate_solve_request(request: SolveRequest) -> None:
    """Validate SolveRequest payload.
    
    Args:
        request: Request to validate
        
    Raises:
        ValueError: If validation fails
    """
    errors = []
    
    # Validate roster_id (UUID format)
    try:
        uuid.UUID(request.roster_id)
    except ValueError:
        errors.append(f"Invalid roster_id: '{request.roster_id}' (not valid UUID)")
    
    # Validate dates (YYYY-MM-DD format)
    try:
        datetime.strptime(request.start_date, '%Y-%m-%d')
    except ValueError:
        errors.append(f"Invalid start_date: '{request.start_date}' (expected YYYY-MM-DD)")
    
    try:
        datetime.strptime(request.end_date, '%Y-%m-%d')
    except ValueError:
        errors.append(f"Invalid end_date: '{request.end_date}' (expected YYYY-MM-DD)")
    
    # Validate date range
    if not errors:  # Only check if dates parsed OK
        start = datetime.strptime(request.start_date, '%Y-%m-%d')
        end = datetime.strptime(request.end_date, '%Y-%m-%d')
        if start > end:
            errors.append(f"Invalid date range: start_date ({request.start_date}) must be before end_date ({request.end_date})")
        if (end - start).days < 1:
            errors.append("Date range must span at least 1 day")
        if (end - start).days > 365:
            errors.append("Date range must not exceed 365 days")
    
    # Validate max_shifts_per_employee
    if request.max_shifts_per_employee < 1:
        errors.append(f"Invalid max_shifts_per_employee: {request.max_shifts_per_employee} (must be > 0)")
    if request.max_shifts_per_employee > 100:
        errors.append(f"Invalid max_shifts_per_employee: {request.max_shifts_per_employee} (must be <= 100)")
    
    if errors:
        raise ValueError("; ".join(errors))


# ============================================================================
# SETUP
# ============================================================================

def setup_greedy_routes(app) -> None:
    """Setup GREEDY API routes on FastAPI app.
    
    Args:
        app: FastAPI application
    """
    app.include_router(router)
    logger.info("GREEDY API routes mounted at /api/greedy")
