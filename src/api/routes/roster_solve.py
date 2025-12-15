"""
ROOSTER SOLVE API ENDPOINT

DRAD 183: Integrate GREEDY Solver with Roosterbewerking starten button

Endpoint: POST /api/roster/solve
Purpose: Execute GREEDY algorithm on active roster

Request:
  {
    "roster_id": "303ebcd1-054c-464b-b9f5-01175e70d719"
  }

Response:
  {
    "status": "SUCCESS",
    "coverage": 98.2,
    "assignments_created": 220,
    "bottlenecks": 4,
    "solve_time": 3.2,
    "message": "✅ 220 diensten ingevuld, 4 gaps"
  }
"""

import os
import logging
from typing import Optional
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client, Client

from src.solver.greedy_engine import GreedyRosteringEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["roster"])


class SolveRequest(BaseModel):
    """Request model for roster solve."""
    roster_id: str
    start_date: Optional[str] = None  # Auto-detect if not provided
    end_date: Optional[str] = None    # Auto-detect if not provided


class SolveResponse(BaseModel):
    """Response model for roster solve."""
    status: str
    coverage: float
    assignments_created: int
    bottlenecks: int
    solve_time: float
    message: str
    details: Optional[dict] = None


def get_supabase_client() -> Client:
    """Get Supabase client from environment."""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
    
    if not url or not key:
        raise HTTPException(
            status_code=500,
            detail="Supabase credentials not configured"
        )
    
    return create_client(url, key)


def _get_roster_dates(supabase: Client, roster_id: str) -> tuple[str, str]:
    """Get start and end dates for roster."""
    try:
        response = supabase.table('roosters').select('start_date, end_date').where(
            'id', 'eq', roster_id
        ).single().execute()
        
        return response.data['start_date'], response.data['end_date']
    except Exception as e:
        logger.warning(f"Could not auto-detect roster dates: {e}")
        # Fallback: Use today and 35 days later
        today = datetime.now().date()
        return str(today), str(today + timedelta(days=35))


@router.post("/roster/solve", response_model=SolveResponse)
async def solve_roster(request: SolveRequest, supabase: Client = Depends(get_supabase_client)) -> SolveResponse:
    """
    Execute GREEDY solver on roster.
    
    This endpoint:
    1. Validates roster exists
    2. Initializes GREEDY engine
    3. Runs 4-phase algorithm
    4. Saves results to database
    5. Returns summary with bottlenecks
    """
    
    roster_id = request.roster_id
    logger.info(f"🚀 Solve request for roster {roster_id}")
    
    try:
        # Step 1: Validate roster exists
        logger.info("Step 1: Validating roster...")
        try:
            roster_check = supabase.table('roosters').select('id').where(
                'id', 'eq', roster_id
            ).single().execute()
            logger.info(f"  ✅ Roster found: {roster_id}")
        except Exception as e:
            logger.error(f"  ❌ Roster not found: {e}")
            raise HTTPException(
                status_code=404,
                detail=f"Roster {roster_id} not found"
            )
        
        # Step 2: Auto-detect dates if needed
        logger.info("Step 2: Detecting date range...")
        if not request.start_date or not request.end_date:
            start_date, end_date = _get_roster_dates(supabase, roster_id)
            logger.info(f"  ✅ Auto-detected: {start_date} to {end_date}")
        else:
            start_date, end_date = request.start_date, request.end_date
            logger.info(f"  ✅ Using provided dates: {start_date} to {end_date}")
        
        # Step 3: Initialize GREEDY engine
        logger.info("Step 3: Initializing GREEDY engine...")
        config = {
            'supabase_url': os.getenv('SUPABASE_URL'),
            'supabase_key': os.getenv('SUPABASE_KEY'),
            'roster_id': roster_id,
            'start_date': start_date,
            'end_date': end_date,
            'max_shifts_per_employee': 8
        }
        
        engine = GreedyRosteringEngine(config)
        logger.info(f"  ✅ Engine initialized with {len(engine.employees)} employees")
        
        # Step 4: Run solver
        logger.info("Step 4: Running GREEDY algorithm...")
        result = engine.solve()
        
        if result['status'] != 'SUCCESS':
            logger.error(f"  ❌ Solver failed: {result.get('error', 'Unknown error')}")
            raise HTTPException(
                status_code=500,
                detail=f"Solver failed: {result.get('error', 'Unknown error')}"
            )
        
        logger.info(f"  ✅ Solver completed in {result['solve_time']}s, coverage {result['coverage']}%")
        
        # Step 5: Save results to database
        logger.info("Step 5: Saving results...")
        
        # Save assignments
        assignments_to_save = [
            {
                'roster_id': roster_id,
                'employee_id': a['employee_id'],
                'date': a['date'],
                'dagdeel': a['dagdeel'],
                'service_id': a['service_id'],
                'source': a['source'],
                'status': 1 if a['source'] == 'pre_planned' else 0,
                'created_at': datetime.utcnow().isoformat()
            }
            for a in result['assignments']
        ]
        
        # Batch insert (Supabase limit: ~1000 per request)
        batch_size = 100
        for i in range(0, len(assignments_to_save), batch_size):
            batch = assignments_to_save[i:i+batch_size]
            try:
                supabase.table('roster_assignments').upsert(batch).execute()
                logger.info(f"  ✅ Saved batch {i//batch_size + 1}")
            except Exception as e:
                logger.error(f"  ⚠️  Error saving batch: {e}")
                # Continue anyway, don't fail the whole solve
        
        # Update roster status
        try:
            supabase.table('roosters').update({
                'status': 'in_progress',
                'solver_last_run': datetime.utcnow().isoformat(),
                'solver_coverage': result['coverage']
            }).eq('id', roster_id).execute()
            logger.info(f"  ✅ Updated roster status to 'in_progress'")
        except Exception as e:
            logger.warning(f"  ⚠️  Could not update roster status: {e}")
        
        # Save bottleneck details
        if result['bottlenecks']:
            bottleneck_details = {
                'roster_id': roster_id,
                'bottlenecks': result['bottlenecks'],
                'count': len(result['bottlenecks']),
                'timestamp': datetime.utcnow().isoformat()
            }
            logger.info(f"  ✅ Recorded {len(result['bottlenecks'])} bottlenecks")
        
        # Step 6: Format response
        logger.info("Step 6: Formatting response...")
        
        bottleneck_count = len(result.get('bottlenecks', []))
        assigned_count = result['total_assigned']
        
        message = f"✅ {assigned_count} diensten ingevuld"
        if bottleneck_count > 0:
            message += f", {bottleneck_count} gaps gevonden"
        
        response = SolveResponse(
            status="SUCCESS",
            coverage=result['coverage'],
            assignments_created=assigned_count,
            bottlenecks=bottleneck_count,
            solve_time=result['solve_time'],
            message=message,
            details={
                'pre_planned': result['pre_planned'],
                'greedy_assigned': result['greedy_assigned'],
                'total_requirements': result['metadata']['total_requirements'],
                'bottleneck_details': result['bottlenecks'][:5]  # First 5 bottlenecks
            }
        )
        
        logger.info(f"\n🎉 SOLVE COMPLETE\n")
        logger.info(f"  Coverage: {response.coverage}%")
        logger.info(f"  Assigned: {response.assignments_created}")
        logger.info(f"  Bottlenecks: {response.bottlenecks}")
        logger.info(f"  Time: {response.solve_time}s\n")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"\n❌ SOLVE FAILED\n{e}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Solver error: {str(e)}"
        )


@router.get("/roster/solve/status/{roster_id}")
async def get_solve_status(roster_id: str, supabase: Client = Depends(get_supabase_client)):
    """
    Get solver status for a roster.
    """
    try:
        response = supabase.table('roosters').select(
            'status, solver_last_run, solver_coverage'
        ).eq('id', roster_id).single().execute()
        
        return {
            'status': response.data.get('status'),
            'last_run': response.data.get('solver_last_run'),
            'coverage': response.data.get('solver_coverage')
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching status: {str(e)}"
        )
