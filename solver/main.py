"""FastAPI Rooster Solver Microservice met Google OR-Tools CP-SAT.

Deze service genereert automatisch roosters voor verloskundigen
gebruikmakend van constraint programming.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import os
import logging
from typing import Dict, Any

from models import (
    SolveRequest,
    SolveResponse,
    HealthResponse,
    VersionResponse
)
from solver_engine import RosterSolver

# Logging configuratie
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Rooster Solver API",
    description="Google OR-Tools CP-SAT solver voor verloskundige roosters",
    version="1.0.0-fase1"
)

# CORS configuratie voor Next.js integratie
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In productie: specificeer Next.js URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint voor Railway monitoring."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="rooster-solver",
        version="1.0.0-fase1"
    )


@app.get("/version", response_model=VersionResponse)
async def get_version() -> VersionResponse:
    """Version informatie endpoint."""
    return VersionResponse(
        version="1.0.0-fase1",
        or_tools_version="9.8.0",
        phase="Fase 1 - Proof of Concept",
        capabilities=[
            "6 basis constraints",
            "10 medewerkers",
            "1 week planning",
            "<10s solve time"
        ]
    )


@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest) -> SolveResponse:
    """Hoofdendpoint: Los roosterplanning op met CP-SAT.
    
    Args:
        request: SolveRequest met roster data, medewerkers, diensten, constraints
    
    Returns:
        SolveResponse met assignments, status, rapportage
    
    Raises:
        HTTPException: Bij validatie fouten of solver failures
    """
    try:
        logger.info(f"Solve request ontvangen voor roster_id: {request.roster_id}")
        logger.info(f"Aantal medewerkers: {len(request.employees)}")
        logger.info(f"Aantal diensten: {len(request.services)}")
        logger.info(f"Periode: {request.start_date} t/m {request.end_date}")
        
        # Initialiseer solver
        solver = RosterSolver(
            roster_id=request.roster_id,
            employees=request.employees,
            services=request.services,
            employee_services=request.employee_services,
            start_date=request.start_date,
            end_date=request.end_date,
            pre_assignments=request.pre_assignments,
            timeout_seconds=request.timeout_seconds
        )
        
        # Voer solve uit
        result = solver.solve()
        
        logger.info(f"Solve voltooid: status={result.status}, assignments={len(result.assignments)}")
        
        return result
        
    except ValueError as e:
        logger.error(f"Validatie fout: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Onverwachte fout: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler voor betere error logging."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__}
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # False in productie
        log_level="info"
    )
