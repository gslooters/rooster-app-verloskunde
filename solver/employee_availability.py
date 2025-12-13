"""Employee Availability Tracker for DRAAD172 Sequential Solver

Tracks employee availability during solving to enforce:
  - Status-based blocking (status 2/3)
  - Structural unavailability (structureel_nbh)
  - Dynamic elimination during greedy assignment
  - One-service-per-dagdeel rule
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Set, Dict, Optional, Tuple
import logging
import json

logger = logging.getLogger(__name__)


@dataclass
class EmployeeAvailability:
    """Snapshot of employee availability on a specific date/dagdeel."""
    employee_id: str
    date: date
    dagdeel: str           # 'O', 'M', 'A'
    is_available: bool
    reason: Optional[str] = None  # 'blocked', 'structural', 'no_bevoegdheid', etc.


class EmployeeAvailabilityTracker:
    """Tracks and manages employee availability during solving."""

    def __init__(self, db):
        """Initialize tracker with database connection.

        Args:
            db: Database connection object
        """
        self.db = db
        # Cache: {(employee_id, date, dagdeel): bool}
        self._availability_cache: Dict[Tuple[str, date, str], bool] = {}
        # Track blocked slots: {(employee_id, date, dagdeel): reason}
        self._blocked_reasons: Dict[Tuple[str, date, str], str] = {}
        # Track structural unavailability for employees
        self._structural_nbh: Dict[str, dict] = {}  # {employee_id: structureel_nbh}

        logger.info("[AVAIL] EmployeeAvailabilityTracker initialized")

    def load_structural_unavailability(self, roster_id: str) -> None:
        """Load structural unavailability from employees table.

        Queries employees.structureel_nbh (JSONB) for all employees
        in the roster.

        Format of structureel_nbh:
        {
            "ma": ["O", "M"],   # Monday: unavailable for Ochtend, Middag
            "wo": ["A"],        # Wednesday: unavailable for Avond
            ...
        }

        Args:
            roster_id: UUID of roster
        """
        try:
            sql = """
                SELECT DISTINCT e.id, e.structureel_nbh
                FROM employees e
                JOIN roster_assignments ra ON e.id = ra.employee_id
                WHERE ra.roster_id = ?
            """
            rows = self.db.query(sql, [roster_id])

            for row in rows:
                self._structural_nbh[row['id']] = row.get('structureel_nbh', {})

            logger.info(
                f"[AVAIL] Loaded structural unavailability for "
                f"{len(self._structural_nbh)} employees"
            )
        except Exception as e:
            logger.error(f"[AVAIL] Error loading structural unavailability: {e}")
            raise

    def get_available_employees(
        self,
        date: date,
        dagdeel: str,
        roster_id: str,
        service_id: Optional[str] = None
    ) -> List[str]:
        """Get list of available employees for a date/dagdeel.

        Checks:
        1. Status (2/3 = blocked)
        2. Structural unavailability
        3. Bevoegdheden (if service_id provided)

        Args:
            date: Target date
            dagdeel: Target dagdeel
            roster_id: UUID of roster
            service_id: Optional service UUID to check bevoegdheden

        Returns:
            List of employee IDs that are available
        """
        available = []

        try:
            # Get all employees in roster
            sql = """
                SELECT DISTINCT e.id
                FROM employees e
                JOIN roster_assignments ra ON e.id = ra.employee_id
                WHERE ra.roster_id = ?
            """
            rows = self.db.query(sql, [roster_id])

            for row in rows:
                emp_id = row['id']
                if self.is_available(emp_id, date, dagdeel, service_id):
                    available.append(emp_id)

            logger.debug(
                f"[AVAIL] Found {len(available)} available employees for "
                f"{date} {dagdeel}"
            )
            return available

        except Exception as e:
            logger.error(f"[AVAIL] Error getting available employees: {e}")
            return []

    def is_available(
        self,
        employee_id: str,
        date: date,
        dagdeel: str,
        service_id: Optional[str] = None
    ) -> bool:
        """Check if employee is available for date/dagdeel/service.

        Args:
            employee_id: Employee ID
            date: Target date
            dagdeel: Target dagdeel
            service_id: Optional service ID to check bevoegdheden

        Returns:
            True if available, False otherwise
        """
        cache_key = (employee_id, date, dagdeel)

        # Check cache first
        if cache_key in self._availability_cache:
            return self._availability_cache[cache_key]

        # Check 1: Status-based blocking
        if self._is_blocked_by_status(employee_id, date, dagdeel):
            self._availability_cache[cache_key] = False
            self._blocked_reasons[cache_key] = "blocked_by_status"
            return False

        # Check 2: Structural unavailability
        if self._is_structurally_unavailable(employee_id, date, dagdeel):
            self._availability_cache[cache_key] = False
            self._blocked_reasons[cache_key] = "structural_unavailability"
            return False

        # Check 3: Bevoegdheden (if service provided)
        if service_id and not self._has_bevoegdheid(employee_id, service_id):
            self._availability_cache[cache_key] = False
            self._blocked_reasons[cache_key] = "no_bevoegdheid"
            return False

        # Available
        self._availability_cache[cache_key] = True
        return True

    def mark_unavailable(
        self,
        employee_id: str,
        date: date,
        dagdeel: str,
        reason: str
    ) -> None:
        """Mark employee as unavailable for date/dagdeel.

        Used during greedy solving to mark assigned slots.

        Args:
            employee_id: Employee ID
            date: Target date
            dagdeel: Target dagdeel
            reason: Reason for marking unavailable (e.g., 'assigned')
        """
        cache_key = (employee_id, date, dagdeel)
        self._availability_cache[cache_key] = False
        self._blocked_reasons[cache_key] = reason
        logger.debug(
            f"[AVAIL] Marked {employee_id} unavailable on {date} {dagdeel}: {reason}"
        )

    def get_availability_summary(self) -> Dict:
        """Get summary of availability tracking.

        Returns:
            Dict with availability statistics
        """
        total_checks = len(self._availability_cache)
        available_count = sum(
            1 for v in self._availability_cache.values() if v
        )
        unavailable_count = total_checks - available_count

        # Group reasons
        reasons = {}
        for reason in self._blocked_reasons.values():
            reasons[reason] = reasons.get(reason, 0) + 1

        return {
            "total_checks": total_checks,
            "available": available_count,
            "unavailable": unavailable_count,
            "unavailability_reasons": reasons
        }

    # Private methods

    def _is_blocked_by_status(self, employee_id: str, date: date, dagdeel: str) -> bool:
        """Check if slot is blocked by status 2 or 3.

        Args:
            employee_id: Employee ID
            date: Target date
            dagdeel: Target dagdeel

        Returns:
            True if blocked (status 2 or 3)
        """
        try:
            sql = """
                SELECT 1 FROM roster_assignments
                WHERE employee_id = ? AND date = ? AND dagdeel = ?
                AND status IN (2, 3)
                LIMIT 1
            """
            result = self.db.query(sql, [employee_id, str(date), dagdeel])
            return len(result) > 0
        except Exception as e:
            logger.error(f"[AVAIL] Error checking status blocking: {e}")
            return False

    def _is_structurally_unavailable(
        self,
        employee_id: str,
        date: date,
        dagdeel: str
    ) -> bool:
        """Check structural unavailability from JSONB field.

        Args:
            employee_id: Employee ID
            date: Target date
            dagdeel: Target dagdeel

        Returns:
            True if structurally unavailable
        """
        if employee_id not in self._structural_nbh:
            return False

        nbh = self._structural_nbh[employee_id]
        if not nbh or not isinstance(nbh, dict):
            return False

        # Map date to Dutch day name
        day_map = {
            0: "ma", 1: "di", 2: "wo", 3: "do",
            4: "vr", 5: "za", 6: "zo"
        }
        day_name = day_map.get(date.weekday())

        if day_name not in nbh:
            return False

        # Check if dagdeel is in unavailable list
        unavailable_dagdelen = nbh[day_name]
        if not isinstance(unavailable_dagdelen, list):
            return False

        return dagdeel in unavailable_dagdelen

    def _has_bevoegdheid(self, employee_id: str, service_id: str) -> bool:
        """Check if employee has bevoegdheid for service.

        Args:
            employee_id: Employee ID
            service_id: Service ID

        Returns:
            True if employee can do service
        """
        try:
            sql = """
                SELECT 1 FROM roster_employee_services
                WHERE employee_id = ? AND service_id = ? AND actief = TRUE
                LIMIT 1
            """
            result = self.db.query(sql, [employee_id, service_id])
            return len(result) > 0
        except Exception as e:
            logger.error(f"[AVAIL] Error checking bevoegdheid: {e}")
            return False


if __name__ == "__main__":
    print("EmployeeAvailabilityTracker loaded successfully")
