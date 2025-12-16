"""
Main FastAPI Application for OPTIE C - GREEDY Separate Railway Service

DRAAD 194: GREEDY als separate service (independent from Solver2)
- FastAPI server
- GREEDY API endpoint: POST /api/greedy/solve
- Health check: GET /api/greedy/health
- Request validation: POST /api/greedy/validate

Deployment:
- Railway service: roostervarw1-greedy (separate from Solver2)
- Port: 3001 (or $PORT from Railway)
- Environment: Production
- Logs: Streamed to Railway

Author: DRAAD 194 FASE 2
Date: 2025-12-16
"""

import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from src.solver.greedy_api import setup_greedy_routes

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("\n" + "="*70)
logger.info("[GREEDY SERVICE] FastAPI Server Starting")
logger.info("DRAAD 194 FASE 2: GREEDY Separate Service")
logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")
logger.info("="*70)

# ============================================================================
# FASTAPI APP CREATION
# ============================================================================

app = FastAPI(
    title="GREEDY Rostering Engine",
    description="Fast roster generation using DRAAD 190 Smart Greedy Allocation",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

logger.info("FastAPI app created")

# ============================================================================
# MIDDLEWARE CONFIGURATION
# ============================================================================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (Railway internal)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("CORS middleware configured")

# ============================================================================
# ROUTES REGISTRATION
# ============================================================================

# Setup GREEDY routes
setup_greedy_routes(app)

logger.info("GREEDY API routes registered")

# ============================================================================
# ROOT ROUTES
# ============================================================================

@app.get("/")
async def root() -> dict:
    """Root endpoint - service info."""
    return {
        "service": "greedy-rostering-engine",
        "version": "1.0.0",
        "solver_type": "GREEDY",
        "draad": "DRAAD 194 FASE 2",
        "endpoints": {
            "solve": "POST /api/greedy/solve",
            "health": "GET /api/greedy/health",
            "validate": "POST /api/greedy/validate",
            "docs": "GET /docs",
            "redoc": "GET /redoc"
        },
        "performance": {
            "solve_time": "2-5 seconds",
            "coverage": "98%+",
            "algorithm": "DRAAD 190 Smart Greedy Allocation"
        },
        "status": "ready"
    }


@app.get("/info")
async def info() -> dict:
    """Service info endpoint."""
    return {
        "service": "greedy-rostering-engine",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "environment": os.getenv('RAILWAY_ENVIRONMENT', 'local'),
        "supabase": "configured" if os.getenv('SUPABASE_URL') else "NOT configured"
    }


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc) -> JSONResponse:
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error",
            "error": str(exc),
            "timestamp": datetime.utcnow().isoformat() + 'Z'
        }
    )


# ============================================================================
# STARTUP & SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event() -> None:
    """Startup event handler."""
    logger.info("\n" + "="*70)
    logger.info("[STARTUP] GREEDY Service initialized")
    logger.info("[STARTUP] Ready to accept requests")
    logger.info(f"[STARTUP] Supabase URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:50]}...")
    logger.info(f"[STARTUP] Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'local')}")
    logger.info("="*70 + "\n")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Shutdown event handler."""
    logger.info("\n" + "="*70)
    logger.info("[SHUTDOWN] GREEDY Service shutting down")
    logger.info("="*70 + "\n")


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv('PORT', 3001))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"Starting uvicorn server on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
