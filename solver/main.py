"""OR-Tools Solver Service

FastAPI service die rooster optimalisatie uitvoert met Google OR-Tools CP-SAT solver.
Integratie met Next.js app via REST API.

Authors: Rooster App Team
Version: 1.1.0
Date: 2025-12-05
DRAAD105: Gebruikt roster_employee_services met aantal en actief velden
DRAAD106: Status semantiek - fixed_assignments en blocked_slots
DRAAD108: Exacte bezetting realiseren via exact_staffing parameter
DRAAD113: Production CORS security - specificeer rooster-app domain
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging

# Local imports
from models import (
    SolveRequest, SolveResponse,
    HealthResponse, VersionResponse,
    ExactStaffing  # DRAAD108
)
from solver_engine import RosterSolver

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Rooster Solver Service",
    description="OR-Tools CP-SAT solver voor roosteroptimalisatie met DRAAD108 bezetting realiseren",
    version="1.1.0-DRAAD108"
)

# ============================================================================
# CORS middleware configuration (DRAAD113: Production-ready)
# ============================================================================

# DRAAD113: Production CORS security
# Specificeer EXACT which origins mag access hebben tot solver API
ALLOWED_ORIGINS = [
    # Rooster-app production
    "https://rooster-app-verloskunde.up.railway.app",
    # Rooster-app development (local testing)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # DRAAD113: Secure - only rooster-app
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Only needed methods
    allow_headers=["Content-Type", "Authorization"],  # Only needed headers
)

logger.info(f"[CORS] Initialized with allowed origins: {ALLOWED_ORIGINS}")


# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/", response_model=dict)
async def root():
    """Health check root endpoint"""
    return {
        "service": "Rooster Solver Service",
        "status": "online",
        "version": "1.1.0-DRAAD108",
        "solver": "Google OR-Tools CP-SAT",
        "features": [
            "DRAAD105: roster_employee_services",
            "DRAAD106: status semantiek",
            "DRAAD108: exacte bezetting realiseren"
        ]
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    """Detailed health check"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="rooster-solver",
        version="1.1.0-DRAAD108"
    )


@app.get("/version", response_model=VersionResponse)
async def version():
    """Version en capabilities endpoint"""
    try:
        from ortools import __version__ as ortools_version
    except:
        ortools_version = "unknown"
    
    return VersionResponse(
        version="1.1.0-DRAAD108",
        or_tools_version=ortools_version,
        phase="DRAAD108-implementation",
        capabilities=[
            "constraint_1_bevoegdheden",
            "constraint_2_beschikbaarheid",
            "constraint_3a_fixed_assignments",
            "constraint_3b_blocked_slots",
            "constraint_4_een_dienst_per_dagdeel",
            "constraint_5_max_werkdagen",
            "constraint_6_zzp_minimalisatie",
            "constraint_7_exact_staffing",  # DRAAD108: NIEUW
            "constraint_8_system_service_exclusivity"  # DRAAD108: NIEUW
        ]
    )


# ============================================================================
# SOLVER ENDPOINT
# ============================================================================

@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """
    Solve rooster met OR-Tools CP-SAT solver.
    
    Implementeert 8 constraints:
    1. Bevoegdheden (DRAAD105: roster_employee_services met actief=TRUE)
    2. Beschikbaarheid (structureel NBH)
    3A. Fixed assignments (DRAAD106: status 1)
    3B. Blocked slots (DRAAD106: status 2, 3)
    4. Een dienst per dagdeel
    5. Max werkdagen per week
    6. ZZP minimalisatie (via objective)
    7. DRAAD108: Exacte bezetting realiseren
    8. DRAAD108: Systeemdienst exclusiviteit (DIO XOR DDO, DIA XOR DDA)
    
    DRAAD108 Features:
    - Exacte bezetting per dienst/dagdeel/team via exact_staffing parameter
    - aantal > 0: EXACT dit aantal medewerkers (min=max tegelijk)
    - aantal = 0: VERBODEN (mag niet worden ingepland)
    - Team filtering: TOT=allen, GRO=maat, ORA=loondienst
    - Systeemdienst koppeling: DIO+DIA en DDO+DDA voorkeur (500 bonus punten)
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"[Solver] Start solving roster {request.roster_id}")
        logger.info(f"[Solver] Periode: {request.start_date} - {request.end_date}")
        logger.info(f"[Solver] {len(request.employees)} medewerkers, {len(request.services)} diensten")
        logger.info(f"[Solver] {len(request.roster_employee_services)} bevoegdheden")
        logger.info(f"[Solver] {len(request.fixed_assignments)} fixed assignments")
        logger.info(f"[Solver] {len(request.blocked_slots)} blocked slots")
        
        # DRAAD108: Log exacte bezetting
        if request.exact_staffing:
            logger.info(f"[Solver] DRAAD108: {len(request.exact_staffing)} exacte bezetting eisen")
            # Log systeemdiensten apart
            system_staffing = [es for es in request.exact_staffing if es.is_system_service]
            if system_staffing:
                logger.info(f"[Solver] DRAAD108: {len(system_staffing)} systeemdienst eisen (DIO/DIA/DDO/DDA)")
        else:
            logger.warning("[Solver] DRAAD108: Geen exact_staffing data - constraint 7 wordt OVERGESLAGEN!")
        
        # Instantieer RosterSolver met alle parameters
        solver = RosterSolver(
            roster_id=request.roster_id,
            employees=request.employees,
            services=request.services,
            roster_employee_services=request.roster_employee_services,
            start_date=request.start_date,
            end_date=request.end_date,
            # DRAAD106 parameters
            fixed_assignments=request.fixed_assignments,
            blocked_slots=request.blocked_slots,
            suggested_assignments=request.suggested_assignments,
            # DRAAD108 parameter - NIEUW!
            exact_staffing=request.exact_staffing,
            # DEPRECATED maar backwards compatible
            pre_assignments=request.pre_assignments,
            timeout_seconds=request.timeout_seconds
        )
        
        # Solve
        logger.info("[Solver] Starten CP-SAT solver...")
        response = solver.solve()
        
        solve_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[Solver] Completed in {solve_time:.2f}s")
        logger.info(f"[Solver] Status: {response.status}")
        logger.info(f"[Solver] Assignments: {response.total_assignments}/{response.total_slots} ({response.fill_percentage:.1f}%)")
        
        # DRAAD108: Log bezettings-violations
        bezetting_violations = [
            v for v in response.violations 
            if v.constraint_type == "bezetting_realiseren"
        ]
        if bezetting_violations:
            logger.warning(f"[Solver] DRAAD108: {len(bezetting_violations)} bezetting violations")
            for v in bezetting_violations[:5]:  # Log eerste 5
                logger.warning(f"  - {v.message}")
        
        return response
    
    except Exception as e:
        logger.error(f"[Solver] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
