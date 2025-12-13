"""RequirementQueue: Sequenced processing of service requirements.

Implements 3-layer priority system:
  Layer 1: Date + Dagdeel (timeblock clustering)
  Layer 2: Service priority (System → TOT → GRO/ORA)
  Layer 3: Alphabetic within priority tier

CRITICAL RULES (do not violate):
  - System services (DIO/DDO/DIA/DDA) MUST complete BEFORE TOT
  - TOT MUST complete BEFORE GRO/ORA
  - Within each tier: alphabetic sort by service_code
  - Per dagdeel: 'O' system order [DIO, DDO], 'A' system order [DIA, DDA]

Implements DRAAD172 Clarification 2 (corrected system service priority)
"""

from datetime import date as DateType
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class Requirement:
    """Single service requirement for one timeblock (date + dagdeel)."""

    def __init__(
        self,
        date: DateType,
        dagdeel: str,  # 'O', 'M', or 'A'
        service_id: str,  # UUID from service_types.id
        service_code: str,  # e.g., 'DIO', 'ECH', 'OSP'
        aantal: int,  # Number of positions needed
        team: Optional[str] = 'TOT',  # 'TOT', 'GRO', 'ORA', or None for system
        is_system: bool = False,  # True if system service
    ):
        self.date = date
        self.dagdeel = dagdeel
        self.service_id = service_id
        self.service_code = service_code
        self.aantal = aantal
        self.team = team
        self.is_system = is_system

    def __repr__(self):
        team_str = f"team={self.team}" if self.team else "SYSTEM"
        return f"Req({self.date} {self.dagdeel} {self.service_code} {team_str} x{self.aantal})"


class RequirementQueue:
    """Queue and prioritizer for service requirements."""

    # System service codes (from service_types.is_system = TRUE)
    SYSTEM_SERVICES = {"DIO", "DDO", "DIA", "DDA"}

    # Per dagdeel: priority order for system services
    # This ensures DIO+DDO complete before moving to TOT (for Ochtend)
    # and DIA+DDA complete before moving to TOT (for Avond)
    SYSTEM_ORDER_BY_DAGDEEL = {
        "O": {"DIO": 1, "DDO": 2},  # Ochtend: DIO first, then DDO
        "M": {},  # Middag (empty if not used)
        "A": {"DIA": 1, "DDA": 2},  # Avond: DIA first, then DDA
    }

    @staticmethod
    def load_from_db(roster_id: str, db) -> List[Requirement]:
        """Load requirements from roster_period_staffing_dagdelen.

        Args:
            roster_id: UUID of roster
            db: Database connection

        Returns:
            List of Requirement objects (unsorted)
        """
        sql = """
        SELECT
            rpsd.date,
            rpsd.dagdeel,
            rps.service_id,
            st.code as service_code,
            rpsd.aantal,
            rpsd.team,
            COALESCE(st.is_system, false) as is_system
        FROM roster_period_staffing_dagdelen rpsd
        JOIN roster_period_staffing rps
            ON rpsd.roster_period_staffing_id = rps.id
        JOIN service_types st
            ON rps.service_id = st.id
        WHERE rps.roster_id = %s
        ORDER BY rpsd.date, rpsd.dagdeel
        """

        rows = db.query(sql, [roster_id])

        requirements = []
        for row in rows:
            service_code = row["service_code"]
            is_system = row["is_system"] or (
                service_code in RequirementQueue.SYSTEM_SERVICES
            )

            req = Requirement(
                date=row["date"],
                dagdeel=row["dagdeel"],
                service_id=row["service_id"],
                service_code=service_code,
                aantal=row["aantal"],
                team=row["team"],
                is_system=is_system,
            )
            requirements.append(req)

        logger.info(f"[QUEUE] Loaded {len(requirements)} requirements from DB")
        return requirements

    @staticmethod
    def sort_by_priority(requirements: List[Requirement]) -> List[Requirement]:
        """Sort requirements by 3-layer priority.

        Layer 1: Date + Dagdeel (timeblock clustering)
            - Ensures all requirements for same timeblock are grouped
            - Order: chronological by (date, dagdeel)

        Layer 2: Service priority (within timeblock)
            - System services (priority 0)
            - TOT services (priority 1)
            - Team services GRO/ORA (priority 2)
            - Ensures System completes before TOT, TOT before Teams

        Layer 3: Alphabetic sort within priority tier
            - Enables consistent, deterministic assignment order

        Args:
            requirements: Unsorted list of Requirement objects

        Returns:
            Sorted list of Requirement objects
        """

        def sort_key(req: Requirement) -> Tuple:
            # Layer 1: Timeblock (date, dagdeel)
            timeblock = (req.date, req.dagdeel)

            # Layer 2: Priority tier and within-tier sort
            if req.is_system:
                # System service: priority 0
                # Within system: use dagdeel-specific order
                order_dict = RequirementQueue.SYSTEM_ORDER_BY_DAGDEEL.get(
                    req.dagdeel, {}
                )
                priority_idx = order_dict.get(req.service_code, 999)
                priority = (0, priority_idx)  # 0 = highest priority

            elif req.team == "TOT":
                # Praktijk/TOT service: priority 1
                # Within TOT: alphabetic
                priority = (1, req.service_code)

            else:
                # Team service (GRO/ORA): priority 2
                # Within teams: alphabetic
                priority = (2, req.service_code)

            # Layer 3: Secondary alphabetic sort
            code_sort = req.service_code

            return (timeblock, priority, code_sort)

        sorted_reqs = sorted(requirements, key=sort_key)

        # Log first 10 for visibility
        logger.info("[QUEUE] Sorted requirements (first 10):")
        for i, req in enumerate(sorted_reqs[:10]):
            priority_label = "SYSTEM" if req.is_system else req.team or "NONE"
            logger.info(
                f"  [{i + 1:2d}] {req.date} {req.dagdeel} {req.service_code:4s} "
                f"({priority_label:6s}): {req.aantal} positions"
            )

        logger.info(f"[QUEUE] Total {len(sorted_reqs)} requirements sorted")
        return sorted_reqs

    @staticmethod
    def validate_sort_order(sorted_reqs: List[Requirement]) -> Dict[str, any]:
        """Validate that sort order follows priority rules.

        Returns:
            Dict with validation results:
              - is_valid: bool
              - violations: List of issues found
        """
        violations = []

        for i in range(len(sorted_reqs) - 1):
            curr = sorted_reqs[i]
            next_req = sorted_reqs[i + 1]

            # Within same timeblock
            if (curr.date, curr.dagdeel) == (next_req.date, next_req.dagdeel):
                # Priority must not decrease
                def get_priority_tier(req):
                    if req.is_system:
                        return 0
                    elif req.team == "TOT":
                        return 1
                    else:
                        return 2

                curr_tier = get_priority_tier(curr)
                next_tier = get_priority_tier(next_req)

                if next_tier < curr_tier:
                    violations.append(
                        f"Priority decrease at {i+1}: "
                        f"{curr} should come after {next_req}"
                    )

        is_valid = len(violations) == 0
        logger.info(f"[QUEUE] Validation: {'PASS' if is_valid else 'FAIL'}")

        return {"is_valid": is_valid, "violations": violations}
