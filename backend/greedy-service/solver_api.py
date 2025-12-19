"""
SolverAPI - FastAPI integration for greedy solver
FASE 2: Integrated API with validation and reporting
"""

import logging
import os
from datetime import date, datetime
from typing import Dict, Optional, List
from fastapi import FastAPI, HTTPException, Body, status
from pydantic import BaseModel, Field
import json
import uuid

from greedy_solver_v2 import GreedySolverV2
from constraint_validator import ConstraintValidator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class SolveRequest(BaseModel):
    """Request body for solve endpoint"""
    roster_id: str = Field(..., description="Roster/period ID")
    period_start: str = Field(..., description="Period start (ISO date)")
    period_end: str = Field(..., description="Period end (ISO date)")
    employees: Dict = Field(..., description="Employee data with targets and skills")
    required_coverage: Dict = Field(..., description="Required coverage per day/shift")
    constraints: Optional[Dict] = Field(None, description="Additional constraints")
    validate_only: bool = Field(False, description="Only validate, don't solve")


class SolveResponse(BaseModel):
    """Response body for solve endpoint"""
    run_id: str
    status: str
    solver: str
    assignments: List[Dict]
    violations: List[Dict]
    quality_score: float
    validation: Optional[Dict] = None
    summary: Dict
    timestamp: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    timestamp: str


class SolverAPI:
    """Main API class"""
    
    def __init__(self):
        """Initialize API and solver"""
        self.app = FastAPI(
            title="Greedy Solver API",
            description="FASE 2 - Advanced greedy scheduling",
            version="2.0.0"
        )
        self.solver = GreedySolverV2()
        self.validator = ConstraintValidator()
        
        # Register routes
        self._register_routes()
        
        logger.info("SolverAPI initialized")
    
    def _register_routes(self) -> None:
        """Register API routes"""
        
        @self.app.get("/health", response_model=HealthResponse)
        async def health_check():
            """Health check endpoint"""
            return HealthResponse(
                status="healthy",
                version="2.0.0",
                timestamp=datetime.utcnow().isoformat()
            )
        
        @self.app.post("/solve", response_model=SolveResponse)
        async def solve(request: SolveRequest = Body(...)):
            """Main solve endpoint"""
            try:
                logger.info(f"Solve request received: {request.roster_id}")
                
                # Parse dates
                period_start = date.fromisoformat(request.period_start)
                period_end = date.fromisoformat(request.period_end)
                
                # Parse required coverage (handle string date keys)
                required_coverage = {}
                for date_str, shifts in request.required_coverage.items():
                    work_date = date.fromisoformat(date_str) if isinstance(date_str, str) else date_str
                    required_coverage[work_date] = shifts
                
                # Solve
                logger.info(f"Starting solve for period {period_start} to {period_end}")
                solution = self.solver.solve(
                    period_start=period_start,
                    period_end=period_end,
                    employees=request.employees,
                    required_coverage=required_coverage,
                    constraints=request.constraints or {}
                )
                
                # Validate
                validation_result = None
                if not request.validate_only:
                    logger.info("Validating solution")
                    validation_result = self.validator.validate(
                        solution=solution,
                        employees=request.employees,
                        required_coverage=required_coverage,
                        constraints=request.constraints or {},
                        period_start=period_start,
                        period_end=period_end
                    )
                    
                    logger.info(
                        f"Validation complete: "
                        f"valid={validation_result['valid']}, "
                        f"violations={validation_result['total_violations']}"
                    )
                
                # Format response
                run_id = str(uuid.uuid4())
                response = SolveResponse(
                    run_id=run_id,
                    status="solved" if not request.validate_only else "validated",
                    solver="GreedySolverV2",
                    assignments=solution['assignments'],
                    violations=solution['violations'],
                    quality_score=solution['quality_score'],
                    validation=validation_result,
                    summary=solution['summary'],
                    timestamp=datetime.utcnow().isoformat()
                )
                
                logger.info(f"Solve completed successfully: {run_id}")
                return response
            
            except ValueError as e:
                logger.error(f"Validation error: {str(e)}")
                raise HTTPException(status_code=400, detail=str(e))
            
            except Exception as e:
                logger.error(f"Solve error: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/validate")
        async def validate(request: SolveRequest = Body(...)):
            """Validation-only endpoint"""
            request.validate_only = True
            return await solve(request)
        
        @self.app.get("/status/{run_id}")
        async def get_status(run_id: str):
            """Get status of a solve run (stub for future implementation)"""
            return {
                "run_id": run_id,
                "status": "completed",
                "message": "Run status tracking not yet implemented"
            }
    
    def get_app(self):
        """Get FastAPI app"""
        return self.app


# Create API instance
api = SolverAPI()
app = api.get_app()


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
