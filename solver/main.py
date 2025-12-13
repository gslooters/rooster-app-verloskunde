"""OR-Tools Solver Service

FastAPI service die rooster optimalisatie uitvoert met Google OR-Tools CP-SAT solver.
Integratie met Next.js app via REST API.

Authors: Rooster App Team
Version: 1.2.0
Date: 2025-12-13
DRAD105: Gebruikt roster_employee_services met aantal en actief velden
DRAD106: Status semantiek - fixed_assignments en blocked_slots
DRAD108: Exacte bezetting realiseren via exact_staffing parameter
DRAD164A: Added verbose startup logging for debugging deployment issues
DRAD166: Layer 1 exception handlers - prevents 502 Bad Gateway errors
DRAD169: Enhanced diagnostic logging for solver activation tracking
DRAAD170: ThreadPoolExecutor for non-blocking async solver execution
DRAAD172: Sequential Greedy Solver with priority-based assignment (DRAFT)
"""

import sys
import logging
import asyncio
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import traceback

# Configure logging EARLY - before any other imports
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
    force=True  # Override any existing config
)
logger = logging.getLogger(__name__)

logger.info("[Solver/main] ============================================================")
logger.info("[Solver/main] ROOSTER SOLVER SERVICE - STARTUP SEQUENCE INITIATED")
logger.info(f"[Solver/main] Python version: {sys.version}")
logger.info(f"[Solver/main] Start time: {datetime.now().isoformat()}")
logger.info("[DRAAD169] 🔍 DIAGNOSTIC LOGGING ENABLED FOR CONTAINER DEBUGGING")
logger.info("[DRAAD170] 🚀 ASYNC/AWAIT + THREADPOOLEXECUTOR ENABLED FOR NON-BLOCKING SOLVER")
logger.info("[DRAAD172] 📋 SEQUENTIAL GREEDY SOLVER SELECTOR AVAILABLE (DRAFT)")

try:
    logger.info("[Solver/main] Step 1: Importing FastAPI...")
    from fastapi import FastAPI, HTTPException
    logger.info("[Solver/main] ✅ FastAPI imported successfully")
    
    logger.info("[Solver/main] Step 2: Importing CORS middleware...")
    from fastapi.middleware.cors import CORSMiddleware
    logger.info("[Solver/main] ✅ CORS middleware imported successfully")
    
    logger.info("[Solver/main] Step 3: Importing local models...")
    from models import (
        SolveRequest, SolveResponse,
        HealthResponse, VersionResponse,
        ExactStaffing,  # DRAAD108
        SolveStatus, ConstraintViolation  # DRAAD166: Voor error responses
    )
    logger.info("[Solver/main] ✅ Models imported successfully")
    
    logger.info("[Solver/main] Step 4: Importing RosterSolver engine...")
    from solver_engine import RosterSolver
    logger.info("[Solver/main] ✅ RosterSolver imported successfully")
    logger.info("[DRAAD169] ✅ RosterSolver engine available - solver CAN be called")
    
    logger.info("[Solver/main] Step 5: Importing DRAAD172 solver selector...")
    try:
        from solver_selector import SolverSelector
        logger.info("[Solver/main] ✅ SolverSelector imported successfully")
        logger.info("[DRAAD172] ✅ Sequential Greedy Solver selector available")
        DRAAD172_AVAILABLE = True
    except ImportError as e:
        logger.warning(f"[Solver/main] ⚠️  SolverSelector import failed: {str(e)}")
        logger.warning("[DRAAD172] ⚠️  Sequential Greedy Solver NOT available - using CP-SAT only")
        DRAAD172_AVAILABLE = False
    
except Exception as e:
    logger.error("[Solver/main] ❌ CRITICAL IMPORT ERROR")
    logger.error(f"[Solver/main] Error type: {type(e).__name__}")
    logger.error(f"[Solver/main] Error message: {str(e)}")
    logger.error(f"[Solver/main] Error details:", exc_info=True)
    sys.exit(1)

logger.info("[Solver/main] ============================================================")
logger.info("[Solver/main] ALL IMPORTS SUCCESSFUL - Creating FastAPI app...")
logger.info("[DRAAD169] Container is ready for solve requests")

# FastAPI app
app = FastAPI(
    title="Rooster Solver Service",
    description="OR-Tools CP-SAT solver + DRAAD172 Sequential Greedy solver voor roosteroptimalisatie",
    version="1.2.0-DRAAD172-SELECTOR"
)

logger.info("[Solver/main] ✅ FastAPI application created")

# ============================================================================
# DRAAD170: ThreadPoolExecutor for non-blocking solver execution
# ============================================================================
# Create a thread pool for running sync solver in executor
# max_workers=2: Allow max 2 concurrent solver operations
# This prevents Railway timeouts on long-running solves
SOLVER_EXECUTOR = ThreadPoolExecutor(
    max_workers=2,
    thread_name_prefix="solver-worker"
)

logger.info("[DRAAD170] ✅ ThreadPoolExecutor created with max_workers=2")

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

logger.info(f"[Solver/main] ✅ CORS middleware configured with {len(ALLOWED_ORIGINS)} allowed origins")


# ============================================================================
# GLOBAL EXCEPTION HANDLER (DRAAD166: Layer 1 - Fallback handler)
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """DRAAD166: Global fallback exception handler - prevents 502 Bad Gateway.
    
    If ANY unhandled exception occurs, return 500 with meaningful error.
    This prevents FastAPI from crashing and returning 502 from reverse proxy.
    """
    logger.error(f"[DRAAD166] GLOBAL EXCEPTION HANDLER TRIGGERED", exc_info=True)
    logger.error(f"[DRAAD166] Exception type: {type(exc).__name__}")
    logger.error(f"[DRAAD166] Exception message: {str(exc)}")
    logger.error(f"[DRAAD166] Traceback:\n{traceback.format_exc()}")
    
    return SolveResponse(
        status=SolveStatus.ERROR,
        roster_id="unknown",
        assignments=[],
        solve_time_seconds=0.0,
        violations=[ConstraintViolation(
            constraint_type="global_exception",
            message=f"[DRAAD166] Critieke fout: {str(exc)[:200]}. Contacteer admin.",
            severity="critical"
        )]
    )


# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Called when FastAPI starts - log successful startup."""
    logger.info("[Solver/main] ============================================================")
    logger.info("[Solver/main] ✅ FASTAPI STARTUP COMPLETE")
    logger.info("[Solver/main] Server is ready to accept requests")
    logger.info(f"[Solver/main] Started at: {datetime.now().isoformat()}")
    logger.info("[Solver/main] DRAAD166: Exception handlers active")
    logger.info("[DRAAD169] 🔍 DIAGNOSTIC LOGGING ACTIVE - Ready to track solve() calls")
    logger.info("[DRAAD170] ⚙️  ThreadPoolExecutor active - async solver ready")
    if DRAAD172_AVAILABLE:
        logger.info("[DRAAD172] 📋 Sequential Greedy Solver ACTIVE (selector ready)")
    else:
        logger.warning("[DRAAD172] ⚠️  Sequential Greedy Solver NOT available (import failed)")
    logger.info("[Solver/main] ============================================================")


@app.get("/", response_model=dict)
async def root():
    """Health check root endpoint"""
    logger.info("[DRAAD169] GET / called - health check")
    return {
        "service": "Rooster Solver Service",
        "status": "online",
        "version": "1.2.0-DRAAD172-SELECTOR",
        "solvers": {
            "primary": "Google OR-Tools CP-SAT (DRAAD170)",
            "secondary": "Sequential Greedy (DRAAD172)" if DRAAD172_AVAILABLE else "NOT AVAILABLE"
        },
        "async_mode": "ThreadPoolExecutor (non-blocking)",
        "features": [
            "DRAAD105: roster_employee_services",
            "DRAAD106: status semantiek",
            "DRAAD108: exacte bezetting realiseren",
            "DRAAD166: exception handlers layer 1",
            "DRAAD169: diagnostic logging",
            "DRAAD170: async/await + threadpoolexecutor",
            "DRAAD172: sequential greedy selector" if DRAAD172_AVAILABLE else "DRAAD172: NOT AVAILABLE"
        ],
        "cache_bust": 1765590000 + int(datetime.now().timestamp())  # Dynamic cache bust
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    """Detailed health check"""
    logger.info("[DRAAD169] GET /health called - health check")
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="rooster-solver",
        version="1.2.0-DRAAD172-SELECTOR"
    )


@app.get("/version", response_model=VersionResponse)
async def version():
    """Version en capabilities endpoint"""
    logger.info("[DRAAD169] GET /version called")
    try:
        from ortools import __version__ as ortools_version
    except:
        ortools_version = "unknown"
    
    return VersionResponse(
        version="1.2.0-DRAAD172-SELECTOR",
        or_tools_version=ortools_version,
        phase="DRAAD172-selector + DRAAD170-async-await + DRAAD169-diagnostic-logging",
        capabilities=[
            "constraint_1_bevoegdheden",
            "constraint_2_beschikbaarheid",
            "constraint_3a_fixed_assignments",
            "constraint_3b_blocked_slots",
            "constraint_4_een_dienst_per_dagdeel",
            "constraint_5_max_werkdagen",
            "constraint_6_zzp_minimalisatie",
            "constraint_7_exact_staffing",  # DRAAD108: NIEUW
            "constraint_8_system_service_exclusivity",  # DRAAD108: NIEUW
            "draad166_exception_handlers",  # DRAAD166: NIEUW
            "draad169_diagnostic_logging",  # DRAAD169: NIEUW
            "draad170_async_threadpool",  # DRAAD170: NIEUW
            "draad172_sequential_greedy_selector" if DRAAD172_AVAILABLE else "draad172_NOT_AVAILABLE"  # DRAAD172: NIEUW
        ]
    )


# ============================================================================
# DRAAD170+DRAAD172: SYNC SOLVER LOGIC (runs in thread pool)
# ============================================================================

def _do_solve(request: SolveRequest, strategy: str = None) -> SolveResponse:
    """DRAAD170+DRAAD172: Sync solve logic - runs in ThreadPoolExecutor.
    
    Supports both CP-SAT (DRAAD170) and Sequential Greedy (DRAAD172).
    
    This function contains the actual sync solver execution.
    It's called from the async endpoint via loop.run_in_executor().
    
    This keeps the async event loop responsive while solver computes.
    
    Args:
        request: SolveRequest
        strategy: Optional solver strategy ('draad172' or 'draad170')
                 None = use default from selector
    """
    start_time = datetime.now()
    
    try:
        logger.info("[DRAAD170-SYNC] Thread pool: Starting sync solve logic...")
        
        # DRAAD172: Use selector if available and not explicitly requesting CP-SAT
        if DRAAD172_AVAILABLE and strategy != 'draad170':
            logger.info("[DRAAD172-SYNC] Using SolverSelector...")
            try:
                response = SolverSelector.solve(request, strategy=strategy)
                logger.info("[DRAAD172-SYNC] ✅ SolverSelector.solve() completed")
            except Exception as e:
                logger.error(f"[DRAAD172-SYNC] ERROR in SolverSelector: {str(e)}", exc_info=True)
                logger.warning("[DRAAD172-SYNC] Falling back to CP-SAT...")
                # Fall back to CP-SAT
                response = _do_solve_cpsat(request, start_time)
        else:
            logger.info("[DRAAD170-SYNC] Using CP-SAT solver directly...")
            response = _do_solve_cpsat(request, start_time)
        
        sync_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[DRAAD170-SYNC] Completed in {sync_time:.2f}s")
        logger.info(f"[DRAAD170-SYNC] Status: {response.status}")
        logger.info(f"[DRAAD170-SYNC] Assignments: {response.total_assignments}")
        
        return response
    
    except Exception as e:
        logger.error("[DRAAD170-SYNC] UNCAUGHT EXCEPTION in sync solve", exc_info=True)
        sync_time = (datetime.now() - start_time).total_seconds()
        
        return SolveResponse(
            status=SolveStatus.ERROR,
            roster_id=request.roster_id,
            assignments=[],
            solve_time_seconds=round(sync_time, 2),
            violations=[ConstraintViolation(
                constraint_type="sync_solve_error",
                message=f"[DRAAD170-SYNC] Error: {str(e)[:150]}",
                severity="critical"
            )]
        )


def _do_solve_cpsat(request: SolveRequest, start_time: datetime = None) -> SolveResponse:
    """DRAAD170: CP-SAT solve logic.
    
    Args:
        request: SolveRequest
        start_time: Start time for timing (optional)
    
    Returns:
        SolveResponse
    """
    if start_time is None:
        start_time = datetime.now()
    
    try:
        # Instantieer RosterSolver
        try:
            logger.info("[DRAAD170-CPSAT] Creating RosterSolver instance...")
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
            logger.info("[DRAAD170-CPSAT] ✅ RosterSolver instance created")
        except Exception as e:
            logger.error(f"[DRAAD170-CPSAT] ERROR creating RosterSolver: {str(e)}", exc_info=True)
            raise
        
        try:
            logger.info("[DRAAD170-CPSAT] Calling solver.solve()...")
            # This is the blocking call - but we're in a thread, so event loop is NOT blocked
            response = solver.solve()
            logger.info("[DRAAD170-CPSAT] ✅ solver.solve() completed")
        except Exception as e:
            logger.error(f"[DRAAD170-CPSAT] ERROR in solver.solve(): {str(e)}", exc_info=True)
            raise
        
        return response
    
    except Exception as e:
        logger.error("[DRAAD170-CPSAT] UNCAUGHT EXCEPTION in CP-SAT solve", exc_info=True)
        sync_time = (datetime.now() - start_time).total_seconds()
        
        return SolveResponse(
            status=SolveStatus.ERROR,
            roster_id=request.roster_id,
            assignments=[],
            solve_time_seconds=round(sync_time, 2),
            violations=[ConstraintViolation(
                constraint_type="cpsat_solve_error",
                message=f"[DRAAD170-CPSAT] Error: {str(e)[:150]}",
                severity="critical"
            )]
        )


# ============================================================================
# SOLVER ENDPOINT WITH DRAAD170+DRAAD172 OPTIMIZATION
# ============================================================================

@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """
    Solve rooster met OR-Tools CP-SAT solver of DRAAD172 Sequential Greedy.
    
    DRAAD172: Uses SolverSelector if available (can be overridden with env var)
    DRAAD170: Uses ThreadPoolExecutor for non-blocking async execution
    DRAAD166: Layer 1 exception handling - graceful error handling
    DRAAD169: Enhanced diagnostic logging
    
    Implementeert 8 constraints (DRAAD170 CP-SAT):
    1. Bevoegdheden (DRAAD105: roster_employee_services met actief=TRUE)
    2. Beschikbaarheid (structureel NBH)
    3A. Fixed assignments (DRAAD106: status 1)
    3B. Blocked slots (DRAAD106: status 2, 3)
    4. Een dienst per dagdeel
    5. Max werkdagen per week
    6. ZZP minimalisatie (via objective)
    7. DRAAD108: Exacte bezetting realiseren
    8. DRAAD108: Systeemdienst exclusiviteit (DIO XOR DDO, DIA XOR DDA)
    
    DRAAD172 Features (Sequential Greedy):
    - 3-layer priority: System → TOT → GRO/ORA
    - Per-dagdeel system ordering: DIO→DDO (ochtend), DIA→DDA (avond)
    - Deterministic results
    - Fast execution
    
    DRAAD108 Features:
    - Exacte bezetting per dienst/dagdeel/team via exact_staffing parameter
    - aantal > 0: EXACT dit aantal medewerkers (min=max tegelijk)
    - aantal = 0: VERBODEN (mag niet worden ingepland)
    - Team filtering: TOT=allen, GRO=maat, ORA=loondienst
    - Systeemdienst koppeling: DIO+DIA en DDO+DDA voorkeur (500 bonus punten)
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"[DRAAD170] ============================================================")
        logger.info(f"[DRAAD170] ➡️  ASYNC SOLVE_SCHEDULE ENDPOINT CALLED")
        logger.info(f"[DRAAD170] Roster ID: {request.roster_id}")
        logger.info(f"[DRAAD170] Scheduling solve in ThreadPoolExecutor (non-blocking)...")
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
        
        try:
            logger.info("[DRAAD170-ASYNC] Getting event loop...")
            loop = asyncio.get_event_loop()
            logger.info("[DRAAD170-ASYNC] ✅ Event loop obtained")
            
            logger.info("[DRAAD170-ASYNC] Running solver in ThreadPoolExecutor...")
            # Run sync solve in thread pool WITHOUT blocking async event loop
            response = await loop.run_in_executor(
                SOLVER_EXECUTOR,
                _do_solve,
                request,
                None  # strategy parameter (None = use default)
            )
            logger.info("[DRAAD170-ASYNC] ✅ ThreadPoolExecutor returned response")
            
        except Exception as e:
            logger.error(f"[DRAAD170-ASYNC] ERROR in executor call: {str(e)}", exc_info=True)
            raise
        
        async_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[DRAAD170-ASYNC] Total async time (including thread overhead): {async_time:.2f}s")
        logger.info(f"[Solver] Status: {response.status}")
        logger.info(f"[Solver] Assignments: {response.total_assignments}/{response.total_slots} ({response.fill_percentage:.1f}%)")
        logger.info(f"[DRAAD170] ✅ Returning response with status={response.status}")
        logger.info(f"[DRAAD170] ============================================================")
        
        # DRAAD108: Log bezettings-violations
        if response.violations:
            bezetting_violations = [
                v for v in response.violations 
                if v.constraint_type == "bezetting_realiseren"
            ]
            if bezetting_violations:
                logger.warning(f"[Solver] DRAAD108: {len(bezetting_violations)} bezetting violations")
                for v in bezetting_violations[:5]:  # Log eerste 5
                    logger.warning(f"  - {v.message}")
        
        # DRAAD166: Log if response contains error status
        if response.status == SolveStatus.ERROR:
            logger.error(f"[DRAAD166] Solver returned ERROR status")
            if response.violations:
                logger.error(f"[DRAAD166] Violations: {[v.message for v in response.violations[:3]]}")
        
        return response
    
    except HTTPException:
        # Re-raise HTTP exceptions (these are intentional)
        raise
    
    except Exception as e:
        # DRAAD166: Catch ANY exception and return SolveResponse with ERROR status
        logger.error(f"[DRAAD166] UNCAUGHT EXCEPTION in async solve_schedule endpoint", exc_info=True)
        logger.error(f"[DRAAD166] Exception type: {type(e).__name__}")
        logger.error(f"[DRAAD166] Exception message: {str(e)[:500]}")
        logger.error(f"[DRAAD170] ❌ Async endpoint ERROR - returning ERROR status")
        
        async_time = (datetime.now() - start_time).total_seconds()
        
        # Return SolveResponse with ERROR status instead of raising
        # This prevents FastAPI from returning 500 and being caught by reverse proxy as 502
        return SolveResponse(
            status=SolveStatus.ERROR,
            roster_id=request.roster_id,
            assignments=[],
            solve_time_seconds=round(async_time, 2),
            violations=[ConstraintViolation(
                constraint_type="solver_endpoint_error",
                message=f"[DRAAD166] Async endpoint fout: {str(e)[:150]}. Details in server logs.",
                severity="critical"
            )]
        )


if __name__ == "__main__":
    import uvicorn
    logger.info("[Solver/main] ============================================================")
    logger.info("[Solver/main] RUNNING DIRECTLY - Starting uvicorn...")
    logger.info("[Solver/main] ============================================================")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
