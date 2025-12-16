#!/usr/bin/env python3
"""
GREEDY API Service - Separate Railway Service
DRAAD-194: FASE 3 - NEW RAILWAY SERVICE SETUP
Datum: 16 December 2025

This is a standalone FastAPI service that exposes the GREEDY engine
as a separate service on Railway. It communicates with Supabase for
data input and output.

Architecture:
- Frontend → /api/greedy/solve → GREEDY API Service (port 8001)
- GREEDY API ← → Supabase (shared database)
- Returns: assignments with high coverage (95-98%+ in 2-5 seconds)
"""

import os
import sys
import logging
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from solver.greedy_engine import GreedyEngine
from solver.constraint_checker import ConstraintChecker

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - GREEDY-API - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class SolveRequest(BaseModel):
    """Request model for /api/greedy/solve"""
    roster_id: str = Field(..., description="UUID of the roster to solve")
    solve_time_limit: Optional[int] = Field(5, description="Maximum solve time in seconds")
    min_coverage_target: Optional[float] = Field(0.95, description="Minimum coverage target (0.0-1.0)")
    prefer_balanced_workload: Optional[bool] = Field(True, description="Balance workload across employees")


class AssignmentResult(BaseModel):
    """Single assignment result"""
    id: str
    roster_id: str
    employee_id: str
    date: str
    dagdeel: str
    service_id: str
    status: int
    source: str = "greedy_engine"
    constraint_reason: Optional[Dict] = None


class SolveResponse(BaseModel):
    """Response model for /api/greedy/solve"""
    success: bool
    solve_time_seconds: float
    total_assignments: int
    coverage_rate: float
    assignments: List[AssignmentResult]
    constraint_violations: Optional[List[Dict]] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Response model for /health"""
    status: str
    timestamp: str
    service_name: str = "GREEDY Engine API"
    version: str = "1.0.0"


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="GREEDY Solver API",
    description="Fast GREEDY rostering engine as separate Railway service",
    version="1.0.0",
)


# ============================================================================
# MIDDLEWARE & STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("🚀 GREEDY API Service starting...")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'production')}")
    logger.info(f"Supabase URL configured: {bool(os.getenv('SUPABASE_URL'))}")
    logger.info(f"Supabase Key configured: {bool(os.getenv('SUPABASE_KEY'))}")
    logger.info("✅ GREEDY API Service ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 GREEDY API Service shutting down...")


@app.middleware("http")
async def add_request_logging(request: Request, call_next):
    """Log all requests"""
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint for Railway monitoring
    
    Returns:
        HealthResponse with current status
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
    )


# ============================================================================
# MAIN SOLVE ENDPOINT
# ============================================================================

@app.post("/api/greedy/solve", response_model=SolveResponse, tags=["Solver"])
async def solve_greedy(request: SolveRequest) -> SolveResponse:
    """
    Solve a roster using GREEDY engine
    
    This endpoint:
    1. Validates the roster ID
    2. Initializes GREEDY engine with roster data
    3. Runs GREEDY algorithm
    4. Returns assignments and metrics
    
    Args:
        request: SolveRequest with roster_id and parameters
        
    Returns:
        SolveResponse with assignments and metrics
    """
    logger.info(f"📋 Processing solve request for roster: {request.roster_id}")
    
    try:
        # Validate request
        if not request.roster_id:
            raise ValueError("roster_id is required")
        
        if not (0.0 <= request.min_coverage_target <= 1.0):
            raise ValueError("min_coverage_target must be between 0.0 and 1.0")
        
        logger.info(f"Parameters: solve_time={request.solve_time_limit}s, min_coverage={request.min_coverage_target}")
        
        # Initialize GREEDY engine
        logger.info("🎯 Initializing GREEDY engine...")
        engine = GreedyEngine(
            roster_id=request.roster_id,
            max_solve_time=request.solve_time_limit,
        )
        
        # Run solve
        logger.info("⚡ Running GREEDY algorithm...")
        result = engine.solve(
            prefer_balanced_workload=request.prefer_balanced_workload,
            min_coverage_target=request.min_coverage_target,
        )
        
        if not result['success']:
            logger.warning(f"⚠️ GREEDY solve incomplete: {result.get('error_message', 'Unknown error')}")
            return SolveResponse(
                success=False,
                solve_time_seconds=result.get('solve_time_seconds', 0),
                total_assignments=len(result.get('assignments', [])),
                coverage_rate=result.get('coverage_rate', 0.0),
                assignments=[],
                error_message=result.get('error_message'),
                constraint_violations=result.get('constraint_violations'),
            )
        
        # Format assignments
        assignments = [
            AssignmentResult(
                id=str(a.get('id', '')),
                roster_id=str(a.get('roster_id', request.roster_id)),
                employee_id=str(a.get('employee_id', '')),
                date=str(a.get('date', '')),
                dagdeel=str(a.get('dagdeel', '')),
                service_id=str(a.get('service_id', '')),
                status=int(a.get('status', 1)),
                source="greedy_engine",
                constraint_reason=a.get('constraint_reason'),
            )
            for a in result.get('assignments', [])
        ]
        
        logger.info(
            f"✅ GREEDY solve completed: "
            f"solve_time={result.get('solve_time_seconds', 0):.2f}s, "
            f"assignments={len(assignments)}, "
            f"coverage={result.get('coverage_rate', 0.0):.1%}"
        )
        
        return SolveResponse(
            success=True,
            solve_time_seconds=result.get('solve_time_seconds', 0),
            total_assignments=len(assignments),
            coverage_rate=result.get('coverage_rate', 0.0),
            assignments=assignments,
            constraint_violations=result.get('constraint_violations'),
            metadata={
                "solver_engine": "greedy",
                "algorithm_phases": result.get('algorithm_phases'),
                "bottleneck_analysis": result.get('bottleneck_analysis'),
            },
        )
    
    except ValueError as e:
        logger.error(f"❌ Validation error: {str(e)}")
        return SolveResponse(
            success=False,
            solve_time_seconds=0,
            total_assignments=0,
            coverage_rate=0.0,
            assignments=[],
            error_message=f"Validation error: {str(e)}",
        )
    
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}", exc_info=True)
        return SolveResponse(
            success=False,
            solve_time_seconds=0,
            total_assignments=0,
            coverage_rate=0.0,
            assignments=[],
            error_message=f"Internal error: {str(e)}",
        )


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/", tags=["Info"])
async def root():
    """
    Root endpoint - API information
    """
    return {
        "service": "GREEDY Solver API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "health": "/health",
            "solve": "/api/greedy/solve",
            "docs": "/docs",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "timestamp": datetime.utcnow().isoformat()},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"🚀 Starting GREEDY API Service on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
    )
