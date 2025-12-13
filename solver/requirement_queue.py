"""RequirementQueue for DRAAD172 Sequential Greedy Solver

Handles priority-based requirement sorting with 3-layer hierarchy:
  Layer 1: Date & Dagdeel (timeblock clustering)
  Layer 2: Priority (System → TOT → GRO/ORA)
  Layer 3: Alphabetic within priority

Implements DRAAD172-AANGEPAST corrections:
  - System services per dagdeel (DIO/DDO for O, DIA/DDA for A)
  - TOT services always after all system services
  - Team services (GRO/ORA) always after all TOT services
"""

from dataclasses import dataclass
from datetime import date
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class Requirement:
    """Single requirement for a service on a specific date/dagdeel."""
    date: date
    dagdeel: str           # 'O', 'M', or 'A'
    service_id: str        # UUID or custom ID
    service_code: str      # 'DIO', 'ECH', 'OSP', etc.
    aantal: int            # Number of positions needed
    team: Optional[str] = 'TOT'  # 'TOT', 'GRO', 'ORA', or None
    is_system: bool = False  # True for DIO/DDO/DIA/DDA


class RequirementQueue:
    """Manages priority-based requirement queue for sequential solver."""

    # System services that must be planned first (per dagdeel)
    SYSTEM_SERVICES = {'DIO', 'DDO', 'DIA', 'DDA'}

    # Per dagdeel: order of system services
    SYSTEM_ORDER_BY_DAGDEEL = {
        'O': {'DIO': 1, 'DDO': 2},       # Ochtend: DIO first, then DDO
        'M': {},                          # Middag (if used)
        'A': {'DIA': 1, 'DDA': 2}        # Avond: DIA first, then DDA
    }

    @staticmethod
    def load_from_db(roster_id: str, db) -> List[Requirement]:
        """Load requirements from database.

        Queries roster_period_staffing_dagdelen and joins with service_types
        to build Requirement objects.

        Args:
            roster_id: UUID of roster
            db: Database connection object with query() method

        Returns:
            List of Requirement objects

        Raises:
            Exception: If DB query fails
        """
        try:
            sql = """
                SELECT 
                    rpsd.date,
                    rpsd.dagdeel,
                    rpsd.service_id,
                    st.code as service_code,
                    rpsd.aantal,
                    rpsd.team,
                    st.is_system
                FROM roster_period_staffing_dagdelen rpsd
                JOIN roster_period_staffing rps 
                    ON rpsd.roster_period_staffing_id = rps.id
                JOIN service_types st 
                    ON rpsd.service_id = st.id
                WHERE rps.roster_id = ?
                ORDER BY rpsd.date, rpsd.dagdeel
            """

            rows = db.query(sql, [roster_id])

            requirements = []
            for row in rows:
                # Determine if system based on code or is_system flag
                is_system = (
                    row.get('is_system', False) or 
                    row['service_code'] in RequirementQueue.SYSTEM_SERVICES
                )

                requirements.append(Requirement(
                    date=row['date'],
                    dagdeel=row['dagdeel'],
                    service_id=row['service_id'],
                    service_code=row['service_code'],
                    aantal=row['aantal'],
                    team=row.get('team', 'TOT'),
                    is_system=is_system
                ))

            logger.info(f"[QUEUE] Loaded {len(requirements)} requirements")
            return requirements

        except Exception as e:
            logger.error(f"[QUEUE] Error loading requirements: {e}")
            raise

    @staticmethod
    def sort_by_priority(requirements: List[Requirement]) -> List[Requirement]:
        """Sort requirements by 3-layer priority hierarchy.

        Layer 1: Timeblock (date, dagdeel) - cluster by day/dagdeel
        Layer 2: Priority tier (System → TOT → GRO/ORA) + within-tier order
        Layer 3: Alphabetic service_code as final tiebreaker

        Critical rule: NO interspersing between priority groups within dagdeel.
        All SYSTEM must complete before TOT begins.
        All TOT must complete before GRO/ORA begins.

        Args:
            requirements: Unsorted list of requirements

        Returns:
            Sorted list with priorities applied

        Example:
            Input: [ECH/TOT, DIO/SYSTEM, SWZ/TOT]
            Output: [DIO, ECH, SWZ]  (system before TOT, alphabetic within TOT)
        """

        def sort_key(req: Requirement) -> Tuple:
            """Generate sort key for requirement.

            Returns tuple of (timeblock, priority, code) for stable sorting.
            """
            # Layer 1: Timeblock clustering
            timeblock = (req.date, req.dagdeel)

            # Layer 2: Priority tier + within-tier order
            if req.is_system:
                # System: order by dagdeel-specific order
                order = RequirementQueue.SYSTEM_ORDER_BY_DAGDEEL.get(
                    req.dagdeel, {}
                )
                priority_idx = order.get(req.service_code, 999)
                priority = (0, priority_idx)  # 0 = highest priority tier

            elif req.team == 'TOT':
                # Praktijk (TOT): priority 1, sort alphabetic
                priority = (1, req.service_code)

            else:
                # Team services (GRO/ORA): priority 2, sort alphabetic
                priority = (2, req.service_code)

            # Layer 3: Alphabetic code as final tiebreaker
            code_sort = req.service_code

            return (timeblock, priority, code_sort)

        # Sort all requirements
        sorted_reqs = sorted(requirements, key=sort_key)

        # Log first 10 for verification
        logger.info("[QUEUE] Sorted requirements (first 10):")
        for i, req in enumerate(sorted_reqs[:10]):
            logger.info(
                f"  [{i+1}] {req.date} {req.dagdeel} {req.service_code} "
                f"({req.team}): {req.aantal} pos"
            )

        return sorted_reqs

    @staticmethod
    def get_requirements_for_timeblock(
        requirements: List[Requirement],
        date: date,
        dagdeel: str
    ) -> List[Requirement]:
        """Get all requirements for a specific date/dagdeel.

        Args:
            requirements: List of all requirements
            date: Target date
            dagdeel: Target dagdeel ('O', 'M', 'A')

        Returns:
            Filtered list of requirements for this timeblock
        """
        return [
            r for r in requirements
            if r.date == date and r.dagdeel == dagdeel
        ]

    @staticmethod
    def group_by_timeblock(
        requirements: List[Requirement]
    ) -> Dict[Tuple[date, str], List[Requirement]]:
        """Group requirements by (date, dagdeel) timeblock.

        Args:
            requirements: List of all requirements

        Returns:
            Dictionary mapping (date, dagdeel) → List[Requirement]
        """
        grouped = {}
        for req in requirements:
            key = (req.date, req.dagdeel)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(req)
        return grouped


if __name__ == "__main__":
    # Quick validation script
    print("RequirementQueue loaded successfully")
    print(f"System services: {RequirementQueue.SYSTEM_SERVICES}")
    print(f"System order (O): {RequirementQueue.SYSTEM_ORDER_BY_DAGDEEL['O']}")
    print(f"System order (A): {RequirementQueue.SYSTEM_ORDER_BY_DAGDEEL['A']}")
