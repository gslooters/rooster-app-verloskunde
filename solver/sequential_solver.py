"""Sequential Greedy Solver for DRAAD172

Implements greedy sequential assignment with priority-based requirement queue.

Algorithm:
1. Load sorted requirements from RequirementQueue
2. For each requirement:
   a. Get available employees (respecting bevoegdheden, status, structural)
   b. Calculate restgetal = target - current_assigned
   c. If restgetal > 0:
      - Select N employees (greedy, by available count)
      - Create roster_assignments (status 0 → 1)
      - Mark as unavailable if single-service constraint
   d. Log assignments and failures
3. Return SolveResult with assignments and unfulfilled services

Constraints enforced:
- Status 1/2/3 NEVER modified (only count them)
- Only status 0 → 1 transitions
- Respects bevoegdheden (roster_employee_services.actief = TRUE)
- Respects structural unavailability (employees.structureel_nbh)
- One service per dagdeel per employee
"""

import time
import logging
from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Optional, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


@dataclass
class Assignment:
    """Represents a single successful assignment."""
    employee_id: str
    date: date
    dagdeel: str
    service_id: str
    service_code: str
    status: int = 1  # Always 1 (assigned)


@dataclass
class FailedAssignment:
    """Represents an unfulfilled requirement."""
    date: date
    dagdeel: str
    service_code: str
    required: int
    assigned: int
    reason: str  # 'insufficient_available_employees', 'no_bevoegdheid', etc.


@dataclass
class SolveResult:
    """Result of solving."""
    roster_id: str
    assignments_created: List[Assignment] = field(default_factory=list)
    assignments_failed: List[FailedAssignment] = field(default_factory=list)
    solve_time: float = 0.0


class SequentialSolver:
    """Greedy sequential solver for roster assignments."""

    def __init__(self, roster_id: str, db, availability_tracker):
        """Initialize solver.

        Args:
            roster_id: UUID of roster to solve
            db: Database connection
            availability_tracker: EmployeeAvailabilityTracker instance
        """
        self.roster_id = roster_id
        self.db = db
        self.availability_tracker = availability_tracker
        self.result = SolveResult(roster_id=roster_id)

        logger.info(f"[SOLVER] Initialized for roster {roster_id}")

    def solve(self) -> SolveResult:
        """Execute solving algorithm.

        Returns:
            SolveResult with assignments and failures
        """
        start_time = time.time()

        try:
            # Import here to avoid circular imports
            from requirement_queue import RequirementQueue

            logger.info("[SOLVER] Starting sequential greedy solve")

            # 1. Load requirements from DB
            requirements = RequirementQueue.load_from_db(
                self.roster_id, self.db
            )

            if not requirements:
                logger.warning("[SOLVER] No requirements loaded")
                return self.result

            # 2. Sort by priority
            sorted_reqs = RequirementQueue.sort_by_priority(requirements)
            logger.info(f"[SOLVER] Processing {len(sorted_reqs)} requirements")

            # 3. Load structural unavailability
            self.availability_tracker.load_structural_unavailability(
                self.roster_id
            )

            # 4. Process each requirement
            for req in sorted_reqs:
                self._process_requirement(req)

            # 5. Calculate solve time
            self.result.solve_time = time.time() - start_time

            # 6. Log summary
            self._log_summary()

            return self.result

        except Exception as e:
            logger.error(f"[SOLVER] Error during solving: {e}")
            self.result.solve_time = time.time() - start_time
            raise

    def _process_requirement(self, req) -> None:
        """Process a single requirement.

        Implements greedy assignment:
        1. Get available employees
        2. Calculate restgetal
        3. Assign N employees if restgetal > 0

        Args:
            req: Requirement object
        """
        try:
            # Get current assignments (status 1)
            current_count = self._get_current_assignment_count(
                req.service_id, req.date, req.dagdeel
            )

            # Calculate remaining
            restgetal = req.aantal - current_count
            if restgetal <= 0:
                logger.debug(
                    f"[SOLVER] {req.date} {req.dagdeel} {req.service_code}: "
                    f"already fulfilled ({current_count}/{req.aantal})"
                )
                return

            # Get available employees
            available = self.availability_tracker.get_available_employees(
                req.date,
                req.dagdeel,
                self.roster_id,
                req.service_id
            )

            if not available:
                logger.info(
                    f"[SOLVER] {req.date} {req.dagdeel} {req.service_code}: "
                    f"NO AVAILABLE EMPLOYEES (needed {restgetal})"
                )
                self.result.assignments_failed.append(
                    FailedAssignment(
                        date=req.date,
                        dagdeel=req.dagdeel,
                        service_code=req.service_code,
                        required=req.aantal,
                        assigned=current_count,
                        reason="no_available_employees"
                    )
                )
                return

            # Select N employees (greedy: first N available)
            to_assign = min(restgetal, len(available))
            selected = available[:to_assign]

            logger.info(
                f"[SOLVER] {req.date} {req.dagdeel} {req.service_code}: "
                f"assigning {to_assign} of {restgetal} needed (from {len(available)} available)"
            )

            # Create assignments
            for emp_id in selected:
                self._assign_employee(
                    emp_id, req.date, req.dagdeel,
                    req.service_id, req.service_code
                )

                # Mark unavailable for this dagdeel (one service per dagdeel)
                self.availability_tracker.mark_unavailable(
                    emp_id, req.date, req.dagdeel,
                    "assigned"
                )

            # Check if fully fulfilled
            if to_assign < restgetal:
                unfulfilled = restgetal - to_assign
                logger.warning(
                    f"[SOLVER] {req.date} {req.dagdeel} {req.service_code}: "
                    f"PARTIAL ({to_assign}/{restgetal} assigned)"
                )
                self.result.assignments_failed.append(
                    FailedAssignment(
                        date=req.date,
                        dagdeel=req.dagdeel,
                        service_code=req.service_code,
                        required=req.aantal,
                        assigned=current_count + to_assign,
                        reason="insufficient_available_employees"
                    )
                )

        except Exception as e:
            logger.error(f"[SOLVER] Error processing requirement {req}: {e}")
            raise

    def _assign_employee(
        self,
        employee_id: str,
        date: date,
        dagdeel: str,
        service_id: str,
        service_code: str
    ) -> None:
        """Create roster_assignment with status 1.

        Args:
            employee_id: Employee ID
            date: Assignment date
            dagdeel: Assignment dagdeel
            service_id: Service ID
            service_code: Service code (for logging)
        """
        try:
            # Find existing status 0 slot to update
            sql = """
                SELECT id FROM roster_assignments
                WHERE roster_id = ? AND employee_id = ?
                AND date = ? AND dagdeel = ?
                AND status = 0
                LIMIT 1
            """
            rows = self.db.query(sql, [self.roster_id, employee_id, str(date), dagdeel])

            if rows:
                # Update existing status 0 slot
                assignment_id = rows[0]['id']
                update_sql = """
                    UPDATE roster_assignments
                    SET status = 1, service_id = ?, updated_at = NOW()
                    WHERE id = ?
                """
                self.db.execute(update_sql, [service_id, assignment_id])
                logger.debug(
                    f"[SOLVER] Updated assignment {assignment_id} to status 1"
                )
            else:
                # Create new assignment
                insert_sql = """
                    INSERT INTO roster_assignments
                    (roster_id, employee_id, date, dagdeel, service_id,
                     status, source, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 1, 'system', NOW(), NOW())
                """
                self.db.execute(
                    insert_sql,
                    [self.roster_id, employee_id, str(date), dagdeel, service_id]
                )
                logger.debug(
                    f"[SOLVER] Created assignment for {employee_id} on {date} {dagdeel}"
                )

            # Add to result
            self.result.assignments_created.append(
                Assignment(
                    employee_id=employee_id,
                    date=date,
                    dagdeel=dagdeel,
                    service_id=service_id,
                    service_code=service_code
                )
            )

        except Exception as e:
            logger.error(f"[SOLVER] Error assigning employee: {e}")
            raise

    def _get_current_assignment_count(
        self,
        service_id: str,
        date: date,
        dagdeel: str
    ) -> int:
        """Count current assignments (status 1) for service on date/dagdeel.

        Args:
            service_id: Service ID
            date: Target date
            dagdeel: Target dagdeel

        Returns:
            Count of status 1 assignments
        """
        try:
            sql = """
                SELECT COUNT(*) as cnt FROM roster_assignments
                WHERE roster_id = ? AND service_id = ?
                AND date = ? AND dagdeel = ?
                AND status = 1
            """
            result = self.db.query(
                sql,
                [self.roster_id, service_id, str(date), dagdeel]
            )
            return result[0]['cnt'] if result else 0
        except Exception as e:
            logger.error(f"[SOLVER] Error getting current assignment count: {e}")
            return 0

    def _log_summary(self) -> None:
        """Log solve summary."""
        total_assignments = len(self.result.assignments_created)
        total_failures = len(self.result.assignments_failed)
        total_positions = total_assignments + sum(
            f.required - f.assigned for f in self.result.assignments_failed
        )

        coverage = (
            total_assignments / total_positions * 100
            if total_positions > 0
            else 0
        )

        logger.info("[SOLVER] === SOLVE SUMMARY ===")
        logger.info(f"[SOLVER] Assignments created: {total_assignments}")
        logger.info(f"[SOLVER] Positions unfulfilled: {total_failures}")
        logger.info(f"[SOLVER] Coverage: {coverage:.1f}%")
        logger.info(f"[SOLVER] Solve time: {self.result.solve_time:.2f}s")

        if self.result.assignments_failed:
            logger.info("[SOLVER] Unfulfilled services:")
            for failure in self.result.assignments_failed[:5]:
                logger.info(
                    f"  - {failure.date} {failure.dagdeel} {failure.service_code}: "
                    f"{failure.assigned}/{failure.required} "
                    f"({failure.reason})"
                )
            if len(self.result.assignments_failed) > 5:
                logger.info(
                    f"  ... and {len(self.result.assignments_failed) - 5} more"
                )


if __name__ == "__main__":
    print("SequentialSolver loaded successfully")
