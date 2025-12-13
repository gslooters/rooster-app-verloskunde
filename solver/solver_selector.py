"""Solver Selection Module - Updated for V2 Solvers (DRAAD175)

Decides at runtime whether to use:
- SequentialSolverV2: Sequential Priority Queue (Fast, deterministic)
- RosterSolverV2: OR-Tools CP-SAT (Optimization, powerful)

FEATURES DRAAD175:
- FOUT#1 FIX: Explicit environment variable validation with fallback
- Better error reporting for missing env vars
- Graceful degradation when DB credentials missing
- Detailed logging for troubleshooting

Features:
- Environment variable override: SOLVER_STRATEGY
- Automatic fallback on errors
- Unified response interface (SolveResponse)
- Logging for strategy selection
"""

import os
import logging
from typing import Optional
from datetime import date
from models import SolveRequest, SolveResponse, SolveStatus, ConstraintViolation
from RosterSolverV2 import RosterSolverV2
from sequential_solver_v2 import SequentialSolverV2

logger = logging.getLogger(__name__)

# ==========================================================================
# FASE 2+3: Strategy Selection (V2 Solvers) - DRAAD175 FOUT#1 FIX
# ==========================================================================

# DRAAD175 FIX: Validate environment variables explicitly
def _validate_env_vars():
    """Validate critical environment variables at startup."""
    warnings = []
    errors = []
    
    # Check SUPABASE variables (needed for Sequential solver)
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url:
        errors.append("MISSING: SUPABASE_URL environment variable")
        logger.error("[ENVCHECK] SUPABASE_URL not found in environment")
    else:
        logger.info(f"[ENVCHECK] SUPABASE_URL present: {supabase_url[:50]}...")
    
    if not supabase_key:
        errors.append("MISSING: SUPABASE_KEY environment variable")
        logger.error("[ENVCHECK] SUPABASE_KEY not found in environment")
    else:
        logger.info(f"[ENVCHECK] SUPABASE_KEY present: {supabase_key[:30]}...")
    
    # Check optional solver strategy
    strategy = os.getenv('SOLVER_STRATEGY', 'sequential')
    logger.info(f"[ENVCHECK] SOLVER_STRATEGY: {strategy}")
    
    if errors:
        logger.error(f"[ENVCHECK] CRITICAL ERRORS: {len(errors)} environment variable(s) missing")
        for err in errors:
            logger.error(f"   - {err}")
    
    if warnings:
        logger.warning(f"[ENVCHECK] WARNINGS: {len(warnings)} configuration issue(s)")
        for warn in warnings:
            logger.warning(f"   - {warn}")
    
    return errors, warnings

# Run validation at import time
_env_errors, _env_warnings = _validate_env_vars()

SOLVER_STRATEGY_ENV = os.getenv('SOLVER_STRATEGY', 'sequential')
if SOLVER_STRATEGY_ENV.lower() in ['sequential', 'draad172', 'v2_sequential']:
    DEFAULT_SOLVER_STRATEGY = 'sequential'
else:
    DEFAULT_SOLVER_STRATEGY = 'cpsat'

logger.info(f"[SELECTOR] Solver strategy environment: SOLVER_STRATEGY={SOLVER_STRATEGY_ENV}")
logger.info(f"[SELECTOR] Default strategy: {DEFAULT_SOLVER_STRATEGY}")
logger.info(f"[SELECTOR] Environment validation: {len(_env_errors)} errors, {len(_env_warnings)} warnings")


class SolverSelectorV2:
    """Unified solver selector for V2 solvers."""

    @staticmethod
    def select_strategy(strategy_override: Optional[str] = None) -> str:
        """Determine which solver strategy to use.

        Args:
            strategy_override: Force specific strategy ('sequential' or 'cpsat')

        Returns:
            Strategy name: 'sequential' or 'cpsat'
        """
        if strategy_override:
            strategy = strategy_override.lower()
            if strategy in ['sequential', 'draad172', 'v2_sequential']:
                return 'sequential'
            else:
                return 'cpsat'
        else:
            return DEFAULT_SOLVER_STRATEGY

    @staticmethod
    def solve(
        request: SolveRequest,
        strategy: str = None
    ) -> SolveResponse:
        """Solve roster using selected strategy.

        Implements V2 selector logic with fallback:
        - Default: Sequential (fast, deterministic)
        - Fallback: CP-SAT (powerful optimization)

        Args:
            request: SolveRequest
            strategy: Force strategy ('sequential', 'cpsat', or None for default)

        Returns:
            SolveResponse (unified interface)
        """
        # Step 1: Select strategy
        selected_strategy = SolverSelectorV2.select_strategy(strategy)
        logger.info(f"[SELECTOR] Using strategy: {selected_strategy}")

        try:
            if selected_strategy == 'sequential':
                logger.info("[SELECTOR] Executing SequentialSolverV2 (Priority Queue)")
                response = SolverSelectorV2._solve_sequential(request)
            else:
                logger.info("[SELECTOR] Executing RosterSolverV2 (CP-SAT)")
                response = SolverSelectorV2._solve_cpsat(request)

            return response

        except Exception as e:
            logger.error(f"[SELECTOR] ERROR in {selected_strategy}: {str(e)}", exc_info=True)
            
            # Fallback: try other solver
            if selected_strategy == 'sequential':
                logger.warning("[SELECTOR] Sequential failed, falling back to CP-SAT...")
                try:
                    return SolverSelectorV2._solve_cpsat(request)
                except Exception as fallback_error:
                    logger.error(f"[SELECTOR] Fallback also failed: {str(fallback_error)}")
                    return SolveResponse(
                        status=SolveStatus.ERROR,
                        roster_id=request.roster_id,
                        assignments=[],
                        solve_time_seconds=0.0,
                        violations=[ConstraintViolation(
                            constraint_type="solver_fallback_error",
                            message=f"Both solvers failed: {str(e)[:100]}",
                            severity="critical"
                        )]
                    )
            else:
                # CP-SAT failed, no fallback
                return SolveResponse(
                    status=SolveStatus.ERROR,
                    roster_id=request.roster_id,
                    assignments=[],
                    solve_time_seconds=0.0,
                    violations=[ConstraintViolation(
                        constraint_type="cpsat_error",
                        message=f"CP-SAT solver error: {str(e)[:150]}",
                        severity="critical"
                    )]
                )

    @staticmethod
    def _solve_sequential(request: SolveRequest) -> SolveResponse:
        """SequentialSolverV2: Fast priority-queue based solving.

        Features:
        - Deterministic: always same result for same input
        - Fast: O(requirements x eligible_employees), typically 1-5 seconds
        - Priority-based: 3-layer priority (dagdeel -> service -> team)
        - Database-driven: loads real requirements from roster_period_staffing_dagdelen
        - Availability tracking: respects blocked slots, structureel_nbh, one-per-slot
        - Graceful degradation: reports failures but doesn't crash

        DRAAD175 FOUT#1 FIX: Better error messages for missing DB credentials

        Args:
            request: SolveRequest (must have Supabase DB configured)

        Returns:
            SolveResponse with status OPTIMAL/FEASIBLE/ERROR
        """
        try:
            logger.info("[SEQUENTIAL] Starting sequential priority queue solve...")
            
            # Get Supabase client from environment - DRAAD175 FOUT#1 FIX
            import os
            from supabase import create_client
            
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_KEY')
            
            # DRAAD175 FIX: Explicit validation with better error message
            if not supabase_url:
                error_msg = (
                    "SUPABASE_URL environment variable is MISSING. "
                    "This is required for Sequential Solver to connect to database. "
                    "Configure in Railway secrets or .env file."
                )
                logger.error(f"[SEQUENTIAL] {error_msg}")
                raise ValueError(error_msg)
            
            if not supabase_key:
                error_msg = (
                    "SUPABASE_KEY environment variable is MISSING. "
                    "This is required for Sequential Solver authentication. "
                    "Configure in Railway secrets or .env file."
                )
                logger.error(f"[SEQUENTIAL] {error_msg}")
                raise ValueError(error_msg)
            
            logger.info(f"[SEQUENTIAL] Using SUPABASE_URL: {supabase_url[:50]}...")
            db = create_client(supabase_url, supabase_key)
            logger.info("[SEQUENTIAL] Connected to Supabase")
            
            # Create and run solver
            logger.info(f"[SEQUENTIAL] Creating SequentialSolverV2 for roster {request.roster_id}...")
            solver = SequentialSolverV2(request.roster_id, db)
            logger.info("[SEQUENTIAL] Solver created")
            
            logger.info("[SEQUENTIAL] Executing solver.solve()...")
            response = solver.solve()
            logger.info(f"[SEQUENTIAL] Solve completed: {response.total_assignments} assignments, "
                       f"status={response.status.value}")
            
            return response
        
        except Exception as e:
            logger.error("[SEQUENTIAL] ERROR in sequential solve", exc_info=True)
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=request.roster_id,
                assignments=[],
                solve_time_seconds=0.0,
                violations=[ConstraintViolation(
                    constraint_type="sequential_error",
                    message=f"Sequential solver error: {str(e)[:150]}",
                    severity="critical"
                )]
            )

    @staticmethod
    def _solve_cpsat(request: SolveRequest) -> SolveResponse:
        """RosterSolverV2: OR-Tools CP-SAT optimization solver.

        Features:
        - Optimization: finds best solution within timeout (default 30s)
        - Hard constraints (4):
          1. Bevoegdheden: Only authorized employee-service combos
          2. One-per-slot: Max 1 service per employee-date-dagdeel
          3. Fixed assignments: Status 1 must be assigned
          4. Blocked slots: Status 2,3 must not be assigned
        - No soft constraints in V2 (pure feasibility mode)
        - Powerful: Can handle complex interdependencies
        - Deterministic timeout: Returns best found solution when timeout reached

        Args:
            request: SolveRequest with all solver parameters

        Returns:
            SolveResponse with status OPTIMAL/FEASIBLE/INFEASIBLE/ERROR
        """
        try:
            logger.info("[CPSAT] Starting CP-SAT optimization solve...")
            
            # Create RosterSolverV2
            logger.info(f"[CPSAT] Creating RosterSolverV2 for roster {request.roster_id}...")
            solver = RosterSolverV2(
                roster_id=request.roster_id,
                employees=request.employees,
                services=request.services,
                roster_employee_services=request.roster_employee_services,
                start_date=request.start_date,
                end_date=request.end_date,
                fixed_assignments=request.fixed_assignments,
                blocked_slots=request.blocked_slots,
                timeout_seconds=request.timeout_seconds if hasattr(request, 'timeout_seconds') else 30
            )
            logger.info("[CPSAT] RosterSolverV2 created")
            
            # Execute solve
            logger.info("[CPSAT] Executing solver.solve()...")
            response = solver.solve()
            logger.info(f"[CPSAT] Solve completed: {response.total_assignments} assignments, "
                       f"status={response.status.value}")
            
            return response
        
        except Exception as e:
            logger.error("[CPSAT] ERROR in CP-SAT solve", exc_info=True)
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=request.roster_id,
                assignments=[],
                solve_time_seconds=0.0,
                violations=[ConstraintViolation(
                    constraint_type="cpsat_error",
                    message=f"CP-SAT solver error: {str(e)[:150]}",
                    severity="critical"
                )]
            )


# Legacy alias for backward compatibility
SolverSelector = SolverSelectorV2
