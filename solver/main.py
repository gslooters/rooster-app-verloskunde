"""OR-Tools CP-SAT Solver Service (DRAAD224-SIMPLIFIED)

FastAPI service voor rooster optimalisatie met RosterSolverV2:
- RosterSolverV2: Google OR-Tools CP-SAT (optimization)

DRAARD224-SIMPLIFICATION:
- Removed SequentialSolverV2 (priority queue greedy solver)
- Removed SolverSelector routing logic
- Removed all Solver2-related patches and dependencies
- Direct CP-SAT solving for all requests
- Enhanced error reporting and database integration

Authors: Rooster App Team
Version: 2.0.0-DRAAD224-SIMPLIFIED
Date: 2025-12-20
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
logger.info("[Main] ROOSTER SOLVER SERVICE - DRAAD224-SIMPLIFIED")
logger.info(f"[Main] Python version: {sys.version}")
logger.info(f"[Main] Start time: {datetime.now().isoformat()}")
logger.info("[Main] Version: 2.0.0-DRAAD224-SIMPLIFIED")
logger.info("[Main] Solver: RosterSolverV2 (CP-SAT) - DIRECT")
logger.info("[Main] DRAAD224: All Solver2 code removed for simplicity")

# ============================================================================
# DRAAD224: Environment Variable Validation (Non-blocking)
# ============================================================================

class DatabaseConnectionStatus:
    """Track database connection status across application lifecycle."""
    def __init__(self):
        self.is_available = False
        self.supabase_url = None
        self.supabase_key = None
        self.validation_error = None
        self.last_validation_time = None

# Global status object
DB_STATUS = DatabaseConnectionStatus()

def validate_database_connection_nonblocking():
    """DRAAD224: Non-blocking database validation.
    
    This validation is NON-CRITICAL:
    - If database is unavailable, service still starts
    - Solvers can still run (limited functionality)
    - Better feedback for deployment debugging
    """
    logger.info("[Boot] ================================================")
    logger.info("[Boot] DRAAD224: Database Connection Validation")
    logger.info("[Boot] Mode: NON-BLOCKING (graceful degradation enabled)")
    
    try:
        # Check for required environment variables
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_KEY')
        
        if not supabase_url:
            DB_STATUS.validation_error = "SUPABASE_URL not set"
            logger.warning("[Boot] ⚠ SUPABASE_URL environment variable not found")
            logger.warning("[Boot] ⚠ This is normal during build/test")
            logger.warning("[Boot] ⚠ Railway will inject this at runtime")
            logger.warning("[Boot] ⚠ Database features will be unavailable until environment is configured")
            return None  # Not an error - graceful degradation
        
        if not supabase_key:
            DB_STATUS.validation_error = "SUPABASE_KEY not set"
            logger.warning("[Boot] ⚠ SUPABASE_KEY environment variable not found")
            logger.warning("[Boot] ⚠ Database features will be unavailable until environment is configured")
            return None  # Not an error - graceful degradation
        
        DB_STATUS.supabase_url = supabase_url
        DB_STATUS.supabase_key = supabase_key
        
        logger.info(f"[Boot] ✓ SUPABASE_URL detected: {supabase_url[:50]}...")
        logger.info(f"[Boot] ✓ SUPABASE_KEY detected: {supabase_key[:20]}...")
        
        # Try to import and test Supabase client
        try:
            from supabase import create_client
            logger.info("[Boot] ✓ Supabase library imported")
        except ImportError as e:
            DB_STATUS.validation_error = f"Supabase import failed: {e}"
            logger.warning(f"[Boot] ⚠ Failed to import supabase: {e}")
            return None
        
        # Try to create client
        try:
            client = create_client(supabase_url, supabase_key)
            logger.info("[Boot] ✓ Supabase client created")
        except Exception as e:
            DB_STATUS.validation_error = f"Supabase client creation failed: {str(e)[:100]}"
            logger.warning(f"[Boot] ⚠ Failed to create Supabase client: {e}")
            logger.warning(f"[Boot] ⚠ Database may be temporarily unreachable")
            return None
        
        # Try to make a test query to roosters table
        try:
            response = client.table('roosters').select('id').limit(1).execute()
            logger.info("[Boot] ✓ Supabase connection test successful (roosters table accessible)")
            DB_STATUS.is_available = True
        except Exception as e:
            DB_STATUS.validation_error = f"Query test failed: {str(e)[:100]}"
            logger.warning(f"[Boot] ⚠ Failed to query roosters table: {e}")
            logger.warning(f"[Boot] ⚠ Database may be unreachable or credentials invalid")
            return None
        
        logger.info("[Boot] ✓ Database validation complete - All checks passed")
        logger.info("[Boot] ================================================")
        return True
    
    except Exception as e:
        logger.warning(f"[Boot] ⚠ Unexpected error during validation: {e}")
        DB_STATUS.validation_error = f"Validation exception: {str(e)[:100]}"
        return None  # Graceful degradation

# Run database validation - NON-CRITICAL
logger.info("[Main] Step 0: Running non-blocking database validation...")
db_validation_result = validate_database_connection_nonblocking()
if db_validation_result is True:
    logger.info("[Main] ✓ Database validation passed")
elif db_validation_result is None:
    logger.warning("[Main] ⚠ Database validation skipped/failed - using graceful degradation")
    logger.warning("[Main] ⚠ Solvers will still work but database features may be limited")
logger.info(f"[Main] ⚠ Database status: {'AVAILABLE' if DB_STATUS.is_available else 'UNAVAILABLE (graceful mode)'}")
if DB_STATUS.validation_error:
    logger.warning(f"[Main] ⚠ Database error: {DB_STATUS.validation_error}")

# ============================================================================
# END DATABASE VALIDATION BOOT (NON-BLOCKING)
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
    
    logger.info("[Main] Step 4: Importing RosterSolverV2 (OR-Tools)...")
    from RosterSolverV2 import RosterSolverV2
    logger.info("[Main] RosterSolverV2 imported successfully")
    
    logger.info("[Main] DRAAD224: Solver2-specific imports removed")
    logger.info("[Main] All imports complete - CP-SAT solver ready")
    
except Exception as e:
    logger.error("[Main] CRITICAL IMPORT ERROR", exc_info=True)
    sys.exit(1)

logger.info("[Main] ============================================================")
logger.info("[Main] ALL IMPORTS SUCCESSFUL - Creating FastAPI app")

# FastAPI app
app = FastAPI(
    title="Rooster Solver Service",
    description="V2: RosterSolverV2 (OR-Tools CP-SAT) - DRAAD224-SIMPLIFIED",
    version="2.0.0-DRAAD224-SIMPLIFIED"
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
# GLOBAL EXCEPTION HANDLER - DRAAD224: Better error responses
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler - prevents 502 errors.
    
    DRAAD224: Return detailed error information instead of generic response
    Includes database status for debugging
    """
    logger.error(f"[Main] GLOBAL EXCEPTION: {type(exc).__name__}", exc_info=True)
    
    # Include detailed error context
    error_details = {
        "error_type": type(exc).__name__,
        "error_message": str(exc),
        "timestamp": datetime.utcnow().isoformat(),
        "request_path": str(request.url),
        "database_available": DB_STATUS.is_available,
        "database_error": DB_STATUS.validation_error,
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
    logger.info(f"[Main] Service: Rooster Solver V2 (DRAAD224-SIMPLIFIED)")
    logger.info(f"[Main] Solver: RosterSolverV2 (OR-Tools CP-SAT)")
    logger.info(f"[Main] Database: {'✓ CONNECTED' if DB_STATUS.is_available else '⚠ OFFLINE (graceful mode)'}")
    if DB_STATUS.validation_error:
        logger.warning(f"[Main] Database error: {DB_STATUS.validation_error}")
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
        "version": "2.0.0-DRAAD224-SIMPLIFIED",
        "solver": "RosterSolverV2 (OR-Tools CP-SAT)",
        "database_status": "CONNECTED" if DB_STATUS.is_available else "OFFLINE",
        "features": [
            "OR-Tools CP-SAT optimization",
            "4 hard constraints (bevoegdheden, one-per-slot, fixed, blocked)",
            "Database integration (Supabase)",
            "Async/await with ThreadPoolExecutor",
            "CORS security",
            "DRAAD224: Simplified architecture (Solver2 removed)",
            "Graceful database degradation",
            "Enhanced error reporting"
        ],
        "removed_components": [
            "SequentialSolverV2 (priority queue greedy)",
            "SolverSelector (routing logic)",
            "Solver2-specific patches and utilities"
        ]
    }

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if DB_STATUS.is_available else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        service="rooster-solver",
        version="2.0.0-DRAAD224-SIMPLIFIED"
    )

@app.get("/version", response_model=VersionResponse)
async def version():
    """Version information endpoint."""
    try:
        from ortools import __version__ as ortools_version
    except:
        ortools_version = "unknown"
    
    return VersionResponse(
        version="2.0.0-DRAAD224-SIMPLIFIED",
        or_tools_version=ortools_version,
        phase="CP-SAT-ONLY",
        capabilities=[
            "rostersolver_v2_or_tools_cp_sat",
            "4_hard_constraints",
            "async_executor",
            "supabase_integration",
            "graceful_database_degradation",
            "exception_handling",
            "cors_security",
            "draad224_simplified"
        ]
    )

# ============================================================================
# SOLVER LOGIC - DRAAD224: Direct CP-SAT solving
# ============================================================================

def _do_solve(request: SolveRequest) -> SolveResponse:
    """Execute solve in thread pool - Direct RosterSolverV2 (CP-SAT).
    
    DRAAD224: Simplified - no solver selection or fallback logic
    
    Args:
        request: SolveRequest
    
    Returns:
        SolveResponse
    """
    start_time = datetime.now()
    
    try:
        logger.info("[Solver] Starting CP-SAT solve in thread pool...")
        logger.info(f"[Solver] Roster: {request.roster_id}")
        logger.info(f"[Solver] Period: {request.start_date} to {request.end_date}")
        logger.info(f"[Solver] Database available: {DB_STATUS.is_available}")
        
        # Direct CP-SAT solving
        logger.info("[Solver] Calling RosterSolverV2.solve()...")
        response = RosterSolverV2.solve(request)
        
        solve_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"[Solver] Solve completed: status={response.status.value}, "
                   f"assignments={response.total_assignments}, time={solve_time:.2f}s")
        
        return response
    
    except Exception as e:
        logger.error(f"[Solver] ERROR: {str(e)}", exc_info=True)
        solve_time = (datetime.now() - start_time).total_seconds()
        
        # Include database status in error message
        error_msg = f"{type(e).__name__}: {str(e)[:150]}"
        if not DB_STATUS.is_available:
            error_msg += f" (Note: Database offline - {DB_STATUS.validation_error})"
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
# SOLVER ENDPOINT (DRAAD224-SIMPLIFIED)
# ============================================================================

@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """Solve rooster using RosterSolverV2 (OR-Tools CP-SAT).
    
    DRAAD224-SIMPLIFIED:
    - Direct CP-SAT optimization
    - 4 hard constraints:
      1. Bevoegdheden (authorized services only)
      2. One-per-slot (max 1 service/dagdeel)
      3. Fixed assignments (status 1)
      4. Blocked slots (status 2,3)
    - No Solver2 priority queue fallback
    - Graceful database degradation
    - Enhanced HTTP error responses
    - Comprehensive logging
    """
    start_time = datetime.now()
    
    try:
        logger.info("[Async] ================================================")
        logger.info(f"[Async] SOLVE_SCHEDULE called for roster {request.roster_id}")
        logger.info(f"[Async] Scheduling in ThreadPoolExecutor (non-blocking)...")
        logger.info(f"[Async] Database available: {DB_STATUS.is_available}")
        
        # Run solve in thread pool (non-blocking for async event loop)
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            SOLVER_EXECUTOR,
            _do_solve,
            request
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
        
        # Include database status in error
        error_msg = f"{type(e).__name__}: {str(e)[:200]}"
        if not DB_STATUS.is_available:
            error_msg += f" (Database offline: {DB_STATUS.validation_error})"
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
