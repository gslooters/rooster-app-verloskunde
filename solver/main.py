"""OR-Tools + Sequential Solver Service (DRAAD175)

FastAPI service voor rooster optimalisatie met twee solvers:
- RosterSolverV2: Google OR-Tools CP-SAT (optimization)
- SequentialSolverV2: Priority queue greedy (fast + deterministic)

FASE 1: RosterSolverV2 with 4 hard constraints (DRAAD170)
FASE 2: SequentialSolverV2 with 3-layer priority (DRAAD174)
FASE 3: SolverSelector routes between solvers (DRAAD174)

DRARD175 FIXES:
- FOUT#2: HTTP 400 responses now include detailed error information
- Better error handling and reporting
- Structured error responses

DRAAD208C FIXES (COMPONENT 1):
- Database validation boot at startup
- Detailed Supabase connection testing
- Early error detection for credentials
- Clear error messages for debugging

Authors: Rooster App Team
Version: 2.0.0-DRAAD208C
Date: 2025-12-18
"""

import sys
import logging
import asyncio
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import traceback
import os

# Configure logging EARLY - before any other imports
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
    force=True  # Override any existing config
)
logger = logging.getLogger(__name__)

logger.info("[Main] ============================================================")
logger.info("[Main] ROOSTER SOLVER SERVICE - FASE 2 + DRAAD208C")
logger.info(f"[Main] Python version: {sys.version}")
logger.info(f"[Main] Start time: {datetime.now().isoformat()}")
logger.info("[Main] Version: 2.0.0-DRAAD208C")
logger.info("[Main] Solver 1: RosterSolverV2 (CP-SAT) - FASE 1 COMPLETE")
logger.info("[Main] Solver 2: SequentialSolverV2 (Priority Queue) - FASE 2 COMPLETE")
logger.info("[Main] Routing: SolverSelector (FASE 3) - PRIMARY: Sequential, FALLBACK: CP-SAT")
logger.info("[Main] DRAAD208C: Database validation boot enabled")

# ============================================================================
# DRAAD208C FIX 1: Database Validation Boot
# ============================================================================

def validate_database_connection():
    """DRAAD208C FIX 1: Validate Supabase connection at startup.
    
    This catches credential/network issues early before solver attempts
    to use the database.
    """
    logger.info("[Boot] ================================================")
    logger.info("[Boot] DRAAD208C: Database Validation Boot Starting...")
    
    try:
        # Check for required environment variables
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_KEY')
        
        if not supabase_url:
            logger.error("[Boot] ✗ SUPABASE_URL environment variable not set")
            logger.error("[Boot] ✗ Cannot proceed - database configuration incomplete")
            return False
        
        if not supabase_key:
            logger.error("[Boot] ✗ SUPABASE_KEY environment variable not set")
            logger.error("[Boot] ✗ Cannot proceed - database authentication incomplete")
            return False
        
        logger.info(f"[Boot] ✓ SUPABASE_URL detected: {supabase_url[:50]}...")
        logger.info(f"[Boot] ✓ SUPABASE_KEY detected: {supabase_key[:20]}...")
        
        # Try to import and test Supabase client
        try:
            from supabase import create_client
            logger.info("[Boot] ✓ Supabase library imported")
        except ImportError as e:
            logger.error(f"[Boot] ✗ Failed to import supabase: {e}")
            return False
        
        # Try to create client
        try:
            client = create_client(supabase_url, supabase_key)
            logger.info("[Boot] ✓ Supabase client created")
        except Exception as e:
            logger.error(f"[Boot] ✗ Failed to create Supabase client: {e}")
            logger.error(f"[Boot] ✗ Error details: {str(e)[:200]}")
            return False
        
        # Try to make a test query to roosters table
        try:
            response = client.table('roosters').select('id').limit(1).execute()
            logger.info("[Boot] ✓ Supabase connection test successful (roosters table accessible)")
        except Exception as e:
            logger.error(f"[Boot] ✗ Failed to query roosters table: {e}")
            logger.error(f"[Boot] ✗ Error details: {str(e)[:200]}")
            logger.error("[Boot] ✗ Database may be unreachable or credentials invalid")
            return False
        
        logger.info("[Boot] ✓ Database validation complete - All checks passed")
        logger.info("[Boot] ================================================")
        return True
    
    except Exception as e:
        logger.error(f"[Boot] ✗ Unexpected error during validation: {e}")
        logger.error(f"[Boot] ✗ Stack trace: {traceback.format_exc()}")
        return False

# Run database validation before importing other modules
logger.info("[Main] Step 0: Running database validation...")
db_valid = validate_database_connection()
if not db_valid:
    logger.error("[Main] ✗ Database validation failed - service cannot start")
    logger.error("[Main] ✗ Fix environment variables and restart")
    sys.exit(1)
logger.info("[Main] ✓ Database validation passed - proceeding with imports")

# ============================================================================
# END DATABASE VALIDATION BOOT
# ============================================================================

try:
    logger.info("[Main] Step 1: Importing FastAPI...")
    from fastapi import FastAPI, HTTPException
    logger.info("[Main] FastAPI imported successfully")
    
    logger.info("[Main] Step 2: Importing CORS middleware...")
    from fastapi.middleware.cors import CORSMiddleware
    logger.info("[Main] CORS middleware imported successfully")
    
    logger.info("[Main] Step 3: Importing models...")
    from models import (
        SolveRequest, SolveResponse,
        HealthResponse, VersionResponse,
        SolveStatus, ConstraintViolation
    )
    logger.info("[Main] Models imported successfully")
    
    logger.info("[Main] Step 4: Importing RosterSolverV2 (FASE 1)...")
    from RosterSolverV2 import RosterSolverV2
    logger.info("[Main] RosterSolverV2 imported successfully")
    
    logger.info("[Main] Step 5: Importing SequentialSolverV2 (FASE 2)...")
    from sequential_solver_v2 import SequentialSolverV2
    logger.info("[Main] SequentialSolverV2 imported successfully")
    
    logger.info("[Main] Step 6: Importing SolverSelectorV2 (FASE 3)...")
    from solver_selector import SolverSelectorV2
    logger.info("[Main] SolverSelectorV2 imported successfully")
    logger.info("[Main] FASE 2+3 INTEGRATION COMPLETE - Both solvers available")
    
except Exception as e:
    logger.error("[Main] CRITICAL IMPORT ERROR", exc_info=True)
    sys.exit(1)

logger.info("[Main] ============================================================")
logger.info("[Main] ALL IMPORTS SUCCESSFUL - Creating FastAPI app")

# FastAPI app
app = FastAPI(
    title="Rooster Solver Service",
    description="V2: RosterSolverV2 (FASE 1) + SequentialSolverV2 (FASE 2) + SolverSelector (FASE 3) - DRAAD208C",
    version="2.0.0-DRAAD208C"
)

logger.info("[Main] FastAPI application created")

# ThreadPoolExecutor for non-blocking solver execution
SOLVER_EXECUTOR = ThreadPoolExecutor(
    max_workers=2,
    thread_name_prefix="solver-worker"
)

logger.info("[Main] ThreadPoolExecutor created with max_workers=2")

# ============================================================================
# CORS Middleware Configuration
# ============================================================================

ALLOWED_ORIGINS = [
    "https://rooster-app-verloskunde.up.railway.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

logger.info(f"[Main] CORS configured with {len(ALLOWED_ORIGINS)} allowed origins")

# ============================================================================
# GLOBAL EXCEPTION HANDLER - DRAAD175 FIX #2: Better error responses
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler - prevents 502 errors.
    
    DRAAD175 FIX #2: Return detailed error information instead of generic response
    DRAAD208C FIX: Include database validation status in error
    """
    logger.error(f"[Main] GLOBAL EXCEPTION: {type(exc).__name__}", exc_info=True)
    
    # DRAAD175 FIX: Include detailed error context
    error_details = {
        "error_type": type(exc).__name__,
        "error_message": str(exc),
        "timestamp": datetime.utcnow().isoformat(),
        "request_path": str(request.url),
        "traceback": traceback.format_exc()[:500]  # First 500 chars of traceback
    }
    
    logger.error(f"[Main] Error details: {error_details}")
    
    return SolveResponse(
        status=SolveStatus.ERROR,
        roster_id="unknown",
        assignments=[],
        solve_time_seconds=0.0,
        violations=[ConstraintViolation(
            constraint_type="global_exception",
            message=f"Critical error: {type(exc).__name__}: {str(exc)[:200]}",
            severity="critical"
        )]
    )

# ============================================================================
# LIFECYCLE EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Called when FastAPI starts."""
    logger.info("[Main] STARTUP COMPLETE - Server ready")
    logger.info(f"[Main] Service: Rooster Solver V2 (DRAAD208C)")
    logger.info(f"[Main] Primary solver: SequentialSolverV2 (Priority Queue)")
    logger.info(f"[Main] Fallback solver: RosterSolverV2 (OR-Tools CP-SAT)")
    logger.info(f"[Main] Database validation: ✓ PASSED")
    logger.info(f"[Main] Started: {datetime.now().isoformat()}")

# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/", response_model=dict)
async def root():
    """Root endpoint - health check."""
    return {
        "service": "Rooster Solver V2",
        "status": "online",
        "version": "2.0.0-DRAAD208C",
        "fase1_rosterset2_solver": "RosterSolverV2 (OR-Tools CP-SAT)",
        "fase2_sequential_solver": "SequentialSolverV2 (Priority Queue)",
        "fase3_selector": "SolverSelectorV2 (Unified routing)",
        "routing": "PRIMARY: Sequential, FALLBACK: CP-SAT",
        "features": [
            "FASE 1: 4 hard constraints (bevoegdheden, one-per-slot, fixed, blocked)",
            "FASE 2: 3-layer priority (dagdeel -> service -> team)",
            "FASE 2: Real database integration (Supabase)",
            "FASE 3: Unified SolverSelector with fallback",
            "Async/await with ThreadPoolExecutor",
            "CORS security",
            "DRAAD208C: Database validation boot",
            "DRAAD208C: Enhanced error reporting"
        ]
    }

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="rooster-solver",
        version="2.0.0-DRAAD208C"
    )

@app.get("/version", response_model=VersionResponse)
async def version():
    """Version information endpoint."""
    try:
        from ortools import __version__ as ortools_version
    except:
        ortools_version = "unknown"
    
    return VersionResponse(
        version="2.0.0-DRAAD208C",
        or_tools_version=ortools_version,
        phase="FASE1+FASE2+FASE3",
        capabilities=[
            "FASE_1_RosterSolverV2_4_constraints",
            "FASE_2_SequentialSolverV2_priority_queue",
            "FASE_3_SolverSelectorV2_unified_routing",
            "async_executor",
            "supabase_integration",
            "database_validation_boot",
            "fallback_strategy",
            "exception_handling",
            "cors_security",
            "draad208c_enhanced_errors"
        ]
    )

# ============================================================================
# SOLVER LOGIC - DRAAD208C: Enhanced error context
# ============================================================================

def _do_solve(request: SolveRequest, strategy: str = None) -> SolveResponse:
    """Execute solve in thread pool (runs synchronously but in separate thread).
    
    DRAAD208C FIX: Improved error reporting and logging
    
    Args:
        request: SolveRequest
        strategy: Optional strategy override ('sequential' or 'cpsat')
    
    Returns:
        SolveResponse
    """
    start_time = datetime.now()
    
    try:
        logger.info("[Solver] Starting solve in thread pool...")
        logger.info(f"[Solver] Roster: {request.roster_id}")
        logger.info(f"[Solver] Period: {request.start_date} to {request.end_date}")
        
        # Use SolverSelector to route to appropriate solver
        logger.info("[Solver] Calling SolverSelectorV2.solve()...")
        response = SolverSelectorV2.solve(request, strategy=strategy)
        
        solve_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[Solver] Solve completed: status={response.status.value}, "
                   f"assignments={response.total_assignments}, time={solve_time:.2f}s")
        
        return response
    
    except Exception as e:
        logger.error(f"[Solver] ERROR: {str(e)}", exc_info=True)
        solve_time = (datetime.now() - start_time).total_seconds()
        
        # DRAAD208C FIX: Return detailed error information
        error_msg = f"{type(e).__name__}: {str(e)[:150]}"
        logger.error(f"[Solver] Error details: {error_msg}")
        
        return SolveResponse(
            status=SolveStatus.ERROR,
            roster_id=request.roster_id,
            assignments=[],
            solve_time_seconds=round(solve_time, 2),
            violations=[ConstraintViolation(
                constraint_type="solver_error",
                message=error_msg,
                severity="critical"
            )]
        )

# ============================================================================
# SOLVER ENDPOINT (FASE 2+DRAAD208C)
# ============================================================================

@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """Solve rooster using FASE 2 complete system (DRAAD208C).
    
    FASE 1 (RosterSolverV2):
    - Constraint 1: Bevoegdheden (authorized services only)
    - Constraint 2: One-per-slot (max 1 service/dagdeel)
    - Constraint 3: Fixed assignments (status 1)
    - Constraint 4: Blocked slots (status 2,3)
    
    FASE 2 (SequentialSolverV2):
    - 3-layer priority sorting
    - Real database integration
    - Employee availability tracking
    - Failure reporting
    
    FASE 3 (SolverSelectorV2):
    - Routes to SequentialSolverV2 (default)
    - Fallback to RosterSolverV2 on error
    - Unified response format
    - Environment variable override
    
    DRAAD208C IMPROVEMENTS:
    - Database validation at startup
    - Better HTTP error responses with details
    - Detailed violation reporting
    - Comprehensive logging
    """
    start_time = datetime.now()
    
    try:
        logger.info("[Async] ================================================")
        logger.info(f"[Async] SOLVE_SCHEDULE called for roster {request.roster_id}")
        logger.info(f"[Async] Scheduling in ThreadPoolExecutor (non-blocking)...")
        
        # Run solve in thread pool (non-blocking for async event loop)
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            SOLVER_EXECUTOR,
            _do_solve,
            request,
            None  # strategy parameter (None = use default)
        )
        
        total_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[Async] Total time (including overhead): {total_time:.2f}s")
        logger.info(f"[Async] Status: {response.status.value}")
        logger.info(f"[Async] Assignments: {response.total_assignments}")
        logger.info(f"[Async] Violations: {len(response.violations)}")
        logger.info("[Async] ================================================")
        
        return response
    
    except Exception as e:
        logger.error(f"[Async] ERROR: {str(e)}", exc_info=True)
        total_time = (datetime.now() - start_time).total_seconds()
        
        # DRAAD208C FIX: Detailed error response
        error_msg = f"{type(e).__name__}: {str(e)[:200]}"
        logger.error(f"[Async] Endpoint error: {error_msg}")
        
        return SolveResponse(
            status=SolveStatus.ERROR,
            roster_id=request.roster_id,
            assignments=[],
            solve_time_seconds=round(total_time, 2),
            violations=[ConstraintViolation(
                constraint_type="endpoint_error",
                message=error_msg,
                severity="critical"
            )]
        )

if __name__ == "__main__":
    import uvicorn
    logger.info("[Main] Starting uvicorn...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
