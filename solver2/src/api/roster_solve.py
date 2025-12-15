"""
REST API Endpoint for GREEDY Roster Solver
DRAAD 184 Implementation

Endpoint: POST /api/roster/solve
Body: { "roster_id": "uuid" }
Response: { "success": bool, "coverage": float, "message": str, ...}
"""

import logging
from typing import Dict, Optional
from datetime import datetime
import os
import sys

try:
    from fastapi import APIRouter, HTTPException, BackgroundTasks
    from pydantic import BaseModel
    from supabase import create_client, Client
except ImportError:
    APIRouter = None
    BaseModel = object
    Client = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from solvers.greedy_engine import GreedyPlanner, SolveResult

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/roster", tags=["roster"])

# Pydantic models
class SolveRequest(BaseModel):
    roster_id: str

class SolveResponse(BaseModel):
    success: bool
    status: str
    coverage: float
    assignments_created: int
    total_required: int
    solve_time: float
    bottleneck_count: int
    message: str
    solver_run_id: Optional[str] = None

def get_db_client() -> Optional[Client]:
    """Get Supabase client"""
    try:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_KEY')
        
        if not url or not key:
            logger.error("SUPABASE_URL or SUPABASE_KEY not configured")
            return None
        
        return create_client(url, key)
    except Exception as e:
        logger.error(f"Failed to create database client: {e}")
        return None

@router.post("/solve", response_model=SolveResponse)
async def solve_roster(request: SolveRequest, background_tasks: BackgroundTasks = None) -> SolveResponse:
    """
    Main endpoint to trigger GREEDY solver
    
    POST /api/roster/solve
    Body: { "roster_id": "UUID" }
    
    Returns:
    {
        "success": bool,
        "status": "success|partial|failed",
        "coverage": float (0-100),
        "assignments_created": int,
        "total_required": int,
        "solve_time": float (seconds),
        "bottleneck_count": int,
        "message": str,
        "solver_run_id": str
    }
    """
    try:
        logger.info(f"🎯 Received solve request for roster: {request.roster_id[:8]}...")
        
        # Validate request
        if not request.roster_id:
            raise HTTPException(status_code=400, detail="roster_id is required")
        
        # Get database client
        db = get_db_client()
        if not db:
            raise HTTPException(
                status_code=503,
                detail="Database connection failed"
            )
        
        # Create solver run record (for tracking)
        solver_run_id = create_solver_run_record(db, request.roster_id)
        logger.info(f"  ✅ Created solver_run record: {solver_run_id[:8]}...")
        
        # Initialize planner
        logger.info("  🚀 Initializing GREEDY Planner...")
        planner = GreedyPlanner(request.roster_id, db)
        
        # Run solve
        logger.info("  ⚙️  Solving roster...")
        result: SolveResult = planner.solve()
        
        # Update solver_run record
        update_solver_run_record(
            db, 
            solver_run_id, 
            result
        )
        logger.info(f"  ✅ Updated solver_run record")
        
        # Update roster status
        update_roster_status(db, request.roster_id, result)
        logger.info(f"  ✅ Updated roster status to 'in_progress'")
        
        # Log result
        logger.info(
            f"\n" + "="*60 + f"\n"
            f"✅ GREEDY Solver Complete\n"
            f"Roster: {request.roster_id[:8]}\n"
            f"Coverage: {result.coverage:.1f}% ({result.assignments_created}/{result.total_required})\n"
            f"Solve Time: {result.solve_time:.2f}s\n"
            f"Bottlenecks: {len(result.bottlenecks)}\n"
            f"Status: {result.status}\n"
            f"" + "="*60
        )
        
        return SolveResponse(
            success=True,
            status=result.status,
            coverage=result.coverage,
            assignments_created=result.assignments_created,
            total_required=result.total_required,
            solve_time=result.solve_time,
            bottleneck_count=len(result.bottlenecks),
            message=result.message,
            solver_run_id=solver_run_id
        )
    
    except HTTPException as he:
        logger.error(f"❌ HTTP Error: {he.detail}")
        raise
    
    except Exception as e:
        logger.error(f"❌ Solve failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Solver error: {str(e)}"
        )


def create_solver_run_record(db: Client, roster_id: str) -> str:
    """
    Create a solver_runs record to track this solve
    """
    try:
        now = datetime.utcnow().isoformat()
        
        response = db.table('solver_runs').insert({
            'roster_id': roster_id,
            'status': 'pending',
            'started_at': now,
            'solver_config': {
                'solver_type': 'GREEDY',
                'version': 'v0.1',
                'draad': '184'
            }
        }).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]['id']
        else:
            raise ValueError("No solver_run ID returned")
    
    except Exception as e:
        logger.error(f"Failed to create solver_run record: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create solver run record: {str(e)}"
        )


def update_solver_run_record(db: Client, solver_run_id: str, result: SolveResult):
    """
    Update solver_runs record with result
    """
    try:
        now = datetime.utcnow().isoformat()
        
        update_data = {
            'status': result.status,
            'completed_at': now,
            'solve_time_seconds': result.solve_time,
            'coverage_rate': result.coverage,
            'total_assignments': result.assignments_created,
            'constraint_violations': [
                v.to_dict() if hasattr(v, 'to_dict') else v
                for v in result.constraint_violations
            ],
            'metadata': {
                'total_required': result.total_required,
                'bottleneck_count': len(result.bottlenecks),
                'bottlenecks': [
                    {
                        'date': str(b.date),
                        'dagdeel': b.dagdeel,
                        'service_id': b.service_id,
                        'shortage': b.shortage,
                        'reason': b.reason
                    }
                    for b in result.bottlenecks
                ]
            }
        }
        
        db.table('solver_runs').update(update_data).eq('id', solver_run_id).execute()
        logger.info(f"✅ Updated solver_run record: {solver_run_id[:8]}")
    
    except Exception as e:
        logger.error(f"Failed to update solver_run record: {e}")
        # Don't raise - this is non-critical


def update_roster_status(db: Client, roster_id: str, result: SolveResult):
    """
    Update roster status to in_progress
    """
    try:
        db.table('roosters').update({
            'status': 'in_progress'
        }).eq('id', roster_id).execute()
        logger.info(f"✅ Updated roster status to 'in_progress'")
    
    except Exception as e:
        logger.error(f"Failed to update roster status: {e}")
        # Don't raise - this is non-critical


# Health check endpoint
@router.get("/health")
async def health_check():
    """
    Health check endpoint for GREEDY solver
    """
    return {
        "status": "ok",
        "service": "GREEDY Solver v0.1",
        "draad": "184",
        "timestamp": datetime.utcnow().isoformat()
    }


# For testing
if __name__ == '__main__':
    # This would be run in a FastAPI context
    logger.info("Roster Solve API module loaded")
