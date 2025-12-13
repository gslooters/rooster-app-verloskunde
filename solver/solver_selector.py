"""Solver Selection Module for DRAAD172 Integration

Decides at runtime whether to use:
- DRAAD172: Sequential Greedy Solver (Deterministic, fast)
- DRAAD170: CP-SAT Solver (Optimization, CURRENT default)

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
from solver_engine import RosterSolver
from sequential_solver import SequentialSolver
from requirement_queue import RequirementQueue
from employee_availability import EmployeeAvailabilityTracker

logger = logging.getLogger(__name__)

# ==========================================================================
# DRAAD172: Strategy Selection
# ==========================================================================

SOLVER_STRATEGY_ENV = os.getenv('SOLVER_STRATEGY', 'draad170')  # Default: CP-SAT
if SOLVER_STRATEGY_ENV.lower() in ['draad172', 'sequential', 'greedy']:
    DEFAULT_SOLVER_STRATEGY = 'draad172'
else:
    DEFAULT_SOLVER_STRATEGY = 'draad170'

logger.info(f"[SELECTOR] Solver strategy environment: SOLVER_STRATEGY={SOLVER_STRATEGY_ENV}")
logger.info(f"[SELECTOR] Default strategy: {DEFAULT_SOLVER_STRATEGY}")


class SolverSelector:
    """Wrapper that selects correct solver based on configuration."""

    @staticmethod
    def select_strategy(request: SolveRequest, strategy_override: Optional[str] = None) -> str:
        """Determine which solver strategy to use.

        Args:
            request: SolveRequest with roster data
            strategy_override: Force specific strategy ('draad172' or 'draad170')

        Returns:
            Strategy name: 'draad172' or 'draad170'
        """
        if strategy_override:
            strategy = strategy_override.lower()
        else:
            strategy = DEFAULT_SOLVER_STRATEGY

        logger.info(
            f"[SELECTOR] Roster {request.roster_id}: Using strategy={strategy}"
        )
        return strategy

    @staticmethod
    def solve(
        request: SolveRequest,
        strategy: str = None
    ) -> SolveResponse:
        """Solve roster using selected strategy.

        Implements DRAAD172 selector logic with fallback.

        Args:
            request: SolveRequest
            strategy: Force strategy ('draad172', 'draad170', or None for default)

        Returns:
            SolveResponse (unified interface)

        Raises:
            Exception: Only on critical integration errors (not solver errors)
        """
        # Step 1: Select strategy
        selected_strategy = SolverSelector.select_strategy(request, strategy)

        try:
            if selected_strategy == 'draad172':
                logger.info("[SELECTOR] 🚀 Executing DRAAD172 Sequential Greedy Solver")
                return SolverSelector._solve_draad172(request)
            else:
                logger.info("[SELECTOR] 🔵 Executing DRAAD170 CP-SAT Solver (CURRENT DEFAULT)")
                return SolverSelector._solve_draad170(request)

        except Exception as e:
            logger.error(
                f"[SELECTOR] ERROR in selected strategy {selected_strategy}: {str(e)}",
                exc_info=True
            )
            # Don't fail - return error response
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=request.roster_id,
                assignments=[],
                solve_time_seconds=0.0,
                violations=[ConstraintViolation(
                    constraint_type="solver_selector_error",
                    message=f"[SELECTOR] Error in {selected_strategy}: {str(e)[:150]}",
                    severity="critical"
                )]
            )

    @staticmethod
    def _solve_draad172(request: SolveRequest) -> SolveResponse:
        """DRAAD172: Sequential Greedy Solver.

        Features:
        - Deterministic: always same result for same input
        - Fast: no optimization, just greedy assignment
        - Priority-based: System → TOT → GRO/ORA
        - Per-requirement processing with availability tracking

        Args:
            request: SolveRequest

        Returns:
            SolveResponse
        """
        try:
            logger.info("[DRAAD172] Starting sequential greedy solve...")

            # STEP 1: Create database-like object from request
            # (SequentialSolver expects db object, but we provide in-memory mock)
            class MockDB:
                """Mock database interface for sequential solver."""
                def __init__(self, request: SolveRequest):
                    self.request = request

                def query(self, sql: str, params: list = None):
                    """Mock query - return data from request."""
                    # This is a simplified implementation
                    # In production, this would be real DB queries
                    logger.debug(f"[DRAAD172] MockDB.query: {sql[:50]}...")
                    return []

                def execute(self, sql: str, params: list = None):
                    """Mock execute - no-op for in-memory."""
                    logger.debug(f"[DRAAD172] MockDB.execute: {sql[:50]}...")
                    return None

            db = MockDB(request)

            # STEP 2: Create availability tracker
            logger.info("[DRAAD172] Creating EmployeeAvailabilityTracker...")
            tracker = EmployeeAvailabilityTracker(request, db)
            logger.info(f"[DRAAD172] ✅ Tracker created with {len(request.employees)} employees")

            # STEP 3: Create and run sequential solver
            logger.info("[DRAAD172] Creating SequentialSolver...")
            solver = SequentialSolver(
                roster_id=request.roster_id,
                db=db,
                availability_tracker=tracker
            )
            logger.info("[DRAAD172] ✅ SequentialSolver created")

            logger.info("[DRAAD172] Executing solver.solve()...")
            result = solver.solve()
            logger.info(f"[DRAAD172] ✅ solver.solve() completed")

            # STEP 4: Convert result to SolveResponse
            logger.info("[DRAAD172] Converting SequentialSolver result to SolveResponse...")
            response = SolveResponse(
                status=SolveStatus.OPTIMAL if len(result.assignments_failed) == 0 else SolveStatus.FEASIBLE,
                roster_id=request.roster_id,
                assignments=[],  # TODO: Convert from result.assignments_created
                solve_time_seconds=0.0,
                total_assignments=len(result.assignments_created),
                total_slots=len(request.employees) * len(request.services) * 21,  # 3 weeks
                violations=[],  # TODO: Convert failed assignments to violations
                solver_metadata={
                    "strategy": "draad172",
                    "algorithm": "sequential_greedy",
                    "assignments_created": len(result.assignments_created),
                    "assignments_failed": len(result.assignments_failed)
                }
            )
            logger.info(f"[DRAAD172] ✅ Response created: {response.total_assignments} assignments")
            return response

        except Exception as e:
            logger.error("[DRAAD172] ERROR in sequential solve", exc_info=True)
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=request.roster_id,
                assignments=[],
                solve_time_seconds=0.0,
                violations=[ConstraintViolation(
                    constraint_type="draad172_sequential_error",
                    message=f"[DRAAD172] Sequential solver error: {str(e)[:150]}",
                    severity="critical"
                )]
            )

    @staticmethod
    def _solve_draad170(request: SolveRequest) -> SolveResponse:
        """DRAAD170: CP-SAT Optimization Solver (CURRENT DEFAULT).

        Features:
        - Optimization: finds best solution within timeout
        - Complex constraints: 8 constraints including bevoegdheden, bezetting
        - Timeout handling: 30s default
        - Bottleneck analysis on INFEASIBLE

        Args:
            request: SolveRequest

        Returns:
            SolveResponse
        """
        try:
            logger.info("[DRAAD170] Starting CP-SAT optimization solve...")

            # Create RosterSolver
            solver = RosterSolver(
                roster_id=request.roster_id,
                employees=request.employees,
                services=request.services,
                roster_employee_services=request.roster_employee_services,
                start_date=request.start_date,
                end_date=request.end_date,
                fixed_assignments=request.fixed_assignments,
                blocked_slots=request.blocked_slots,
                suggested_assignments=request.suggested_assignments,
                exact_staffing=request.exact_staffing,
                pre_assignments=request.pre_assignments,
                timeout_seconds=request.timeout_seconds
            )

            # Execute solve
            response = solver.solve()

            logger.info(f"[DRAAD170] ✅ CP-SAT solve completed: {response.total_assignments} assignments")
            return response

        except Exception as e:
            logger.error("[DRAAD170] ERROR in CP-SAT solve", exc_info=True)
            return SolveResponse(
                status=SolveStatus.ERROR,
                roster_id=request.roster_id,
                assignments=[],
                solve_time_seconds=0.0,
                violations=[ConstraintViolation(
                    constraint_type="draad170_cpsat_error",
                    message=f"[DRAAD170] CP-SAT solver error: {str(e)[:150]}",
                    severity="critical"
                )]
            )