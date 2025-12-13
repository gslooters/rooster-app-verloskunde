"""Assignment Report Generator for DRAAD172

Generates comprehensive report of solver results.

Report includes:
- Summary metrics (total assignments, coverage rate, solve time)
- All assignments created (employee, date, service)
- Unfulfilled services (what/why not filled)
- Employee overview (assignments per employee vs target)
- Export to JSON
"""

import json
import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from decimal import Decimal

logger = logging.getLogger(__name__)


class AssignmentReport:
    """Generates and exports assignment reports."""

    def __init__(self, solve_result, roster_id: str, db):
        """Initialize report generator.

        Args:
            solve_result: SolveResult from SequentialSolver
            roster_id: UUID of roster
            db: Database connection
        """
        self.solve_result = solve_result
        self.roster_id = roster_id
        self.db = db
        self.report = {}

        logger.info(f"[REPORT] Initialized for roster {roster_id}")

    def generate(self) -> Dict[str, Any]:
        """Generate complete report.

        Returns:
            Dictionary with full report structure
        """
        try:
            logger.info("[REPORT] Generating report")

            self.report = {
                "roster_id": self.roster_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "summary": self._generate_summary(),
                "assignments": self._generate_assignments_list(),
                "unfulfilled": self._generate_unfulfilled_list(),
                "employee_overview": self._generate_employee_overview(),
                "statistics": self._generate_statistics()
            }

            logger.info("[REPORT] Report generated successfully")
            return self.report

        except Exception as e:
            logger.error(f"[REPORT] Error generating report: {e}")
            raise

    def export_to_json(self, filepath: str) -> None:
        """Export report to JSON file.

        Args:
            filepath: Path to write JSON to
        """
        try:
            # Ensure report is generated
            if not self.report:
                self.generate()

            with open(filepath, 'w') as f:
                json.dump(self.report, f, indent=2, default=str)

            logger.info(f"[REPORT] Exported to {filepath}")

        except Exception as e:
            logger.error(f"[REPORT] Error exporting to JSON: {e}")
            raise

    # Private methods

    def _generate_summary(self) -> Dict[str, Any]:
        """Generate summary metrics.

        Returns:
            Summary dict with key metrics
        """
        total_assignments = len(self.solve_result.assignments_created)
        total_unfulfilled = sum(
            req.required - req.assigned
            for req in self.solve_result.assignments_failed
        )
        total_required = total_assignments + total_unfulfilled

        success_rate = (
            total_assignments / total_required * 100
            if total_required > 0
            else 0
        )

        return {
            "total_requirements": total_required,
            "total_assignments": total_assignments,
            "total_unfulfilled": total_unfulfilled,
            "success_rate": f"{success_rate:.1f}%",
            "solve_time_seconds": round(self.solve_result.solve_time, 2)
        }

    def _generate_assignments_list(self) -> List[Dict[str, Any]]:
        """Generate list of all assignments.

        Returns:
            List of assignment dicts
        """
        assignments = []
        for assign in self.solve_result.assignments_created:
            assignments.append({
                "date": str(assign.date),
                "dagdeel": assign.dagdeel,
                "service_code": assign.service_code,
                "service_id": assign.service_id,
                "employee_id": assign.employee_id,
                "status": assign.status
            })

        return assignments

    def _generate_unfulfilled_list(self) -> List[Dict[str, Any]]:
        """Generate list of unfulfilled requirements.

        Returns:
            List of unfulfilled dicts
        """
        unfulfilled = []
        for failure in self.solve_result.assignments_failed:
            unfulfilled.append({
                "date": str(failure.date),
                "dagdeel": failure.dagdeel,
                "service_code": failure.service_code,
                "required": failure.required,
                "assigned": failure.assigned,
                "remaining": failure.required - failure.assigned,
                "reason": failure.reason
            })

        return sorted(unfulfilled, key=lambda x: (x['date'], x['dagdeel']))

    def _generate_employee_overview(self) -> Dict[str, Dict[str, Any]]:
        """Generate employee-by-employee overview.

        Returns:
            Dict mapping employee_id to {assigned, target, restgetal}
        """
        overview = {}

        try:
            # Get all employee targets
            sql = """
                SELECT employee_id, target_shifts
                FROM period_employee_staffing
                WHERE roster_id = ?
            """
            targets = self.db.query(sql, [self.roster_id])
            target_map = {row['employee_id']: row['target_shifts'] for row in targets}

            # Count assignments
            for assign in self.solve_result.assignments_created:
                if assign.employee_id not in overview:
                    target = target_map.get(assign.employee_id, 0)
                    overview[assign.employee_id] = {
                        "assigned_count": 0,
                        "target": target,
                        "restgetal": target
                    }
                overview[assign.employee_id]["assigned_count"] += 1

            # Calculate restgetal
            for emp_id, data in overview.items():
                data["restgetal"] = max(0, data["target"] - data["assigned_count"])

            return overview

        except Exception as e:
            logger.error(f"[REPORT] Error generating employee overview: {e}")
            return {}

    def _generate_statistics(self) -> Dict[str, Any]:
        """Generate detailed statistics.

        Returns:
            Statistics dict
        """
        try:
            stats = {
                "by_dagdeel": {},
                "by_service": {},
                "by_team": {}
            }

            # Group assignments by dagdeel
            for assign in self.solve_result.assignments_created:
                if assign.dagdeel not in stats["by_dagdeel"]:
                    stats["by_dagdeel"][assign.dagdeel] = 0
                stats["by_dagdeel"][assign.dagdeel] += 1

            # Group assignments by service
            for assign in self.solve_result.assignments_created:
                if assign.service_code not in stats["by_service"]:
                    stats["by_service"][assign.service_code] = 0
                stats["by_service"][assign.service_code] += 1

            # Group failures by reason
            failure_reasons = {}
            for failure in self.solve_result.assignments_failed:
                if failure.reason not in failure_reasons:
                    failure_reasons[failure.reason] = 0
                failure_reasons[failure.reason] += failure.required - failure.assigned

            stats["failure_reasons"] = failure_reasons

            return stats

        except Exception as e:
            logger.error(f"[REPORT] Error generating statistics: {e}")
            return {}


# Helper for JSON serialization
class DateEncoder(json.JSONEncoder):
    """Custom encoder for date objects."""
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


if __name__ == "__main__":
    print("AssignmentReport loaded successfully")
