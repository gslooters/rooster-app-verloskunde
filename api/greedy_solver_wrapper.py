"""
GREEDY Solver Wrapper - FastAPI endpoint for GREEDY rostering engine

DRAAD 185: Provides REST API for GreedyRosteringEngine
Endpoint: POST /api/v1/solve-greedy

This wrapper bridges the Next.js frontend with the local GREEDY solver.
It imports and executes GreedyRosteringEngine from src/solver/greedy_engine.py

Author: DRAAD 185
Date: 2025-12-15
"""

import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import sys
from datetime import datetime
import time

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.solver.greedy_engine import GreedyRosteringEngine, SolveResult

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GREEDY Solver API",
    description="DRAAD 185: GREEDY Rostering Engine",
    version="1.0.0"
)


class SolveRequest(BaseModel):
    """Request model for solve endpoint."""
    roster_id: str
    start_date: str
    end_date: str


class Bottleneck(BaseModel):
    """Bottleneck model."""
    date: str
    dagdeel: str
    service_id: str
    need: int
    assigned: int
    shortage: int
    reason: Optional[str] = None
    suggestion: Optional[str] = None


class SolveResultResponse(BaseModel):
    """Response model for solve endpoint."""
    status: str
    assignments_created: int
    total_required: int
    coverage: float
    solve_time: float
    bottlenecks: List[Dict]
    pre_planned_count: int
    greedy_count: int
    message: str


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "GREEDY Solver API",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/v1/solve-greedy", response_model=SolveResultResponse)
async def solve_greedy(request: SolveRequest):
    """
    Execute GREEDY solver for roster.
    
    This endpoint:
    1. Validates request
    2. Creates GreedyRosteringEngine instance
    3. Executes 5-phase solve algorithm
    4. Returns result with assignments and bottlenecks
    
    Args:
        request: SolveRequest with roster_id, start_date, end_date
        
    Returns:
        SolveResultResponse with assignments, bottlenecks, and metrics
        
    Raises:
        HTTPException: If solve fails
    """
    
    start_time = time.time()
    solver_run_id = str(datetime.utcnow().timestamp())
    
    try:
        logger.info(f"🚀 [DRAAD185] Starting GREEDY solve for roster {request.roster_id}")
        
        # Validate request
        if not request.roster_id:
            logger.error("❌ roster_id is required")
            raise HTTPException(status_code=400, detail="roster_id is required")
        
        # Create solver configuration
        config = {
            'roster_id': request.roster_id,
            'start_date': request.start_date,
            'end_date': request.end_date,
            'max_shifts_per_employee': 8,
            'supabase_url': os.getenv('SUPABASE_URL'),
            'supabase_key': os.getenv('SUPABASE_KEY')
        }
        
        logger.info(f"✅ Config created for roster {request.roster_id}")
        
        # Create and execute solver
        try:
            solver = GreedyRosteringEngine(config)
            logger.info("✅ GreedyRosteringEngine initialized")
            
            result: SolveResult = solver.solve()
            logger.info(f"✅ Solve completed: {result.coverage}% coverage")
            
        except Exception as e:
            logger.error(f"❌ Solver error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Solver failed: {str(e)}"
            )
        
        # Format response
        elapsed = time.time() - start_time
        
        response = SolveResultResponse(
            status=result.status,
            assignments_created=result.assignments_created,
            total_required=result.total_required,
            coverage=result.coverage,
            solve_time=result.solve_time,
            bottlenecks=result.bottlenecks,
            pre_planned_count=result.pre_planned_count,
            greedy_count=result.greedy_count,
            message=result.message
        )
        
        logger.info(f"✅ [DRAAD185] Solve completed in {elapsed:.2f}s")
        logger.info(f"   - Status: {response.status}")
        logger.info(f"   - Coverage: {response.coverage}%")
        logger.info(f"   - Assignments: {response.assignments_created}/{response.total_required}")
        logger.info(f"   - Pre-planned: {response.pre_planned_count}")
        logger.info(f"   - Greedy: {response.greedy_count}")
        logger.info(f"   - Bottlenecks: {len(response.bottlenecks)}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"🚀 Starting GREEDY Solver API on {host}:{port}")
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
