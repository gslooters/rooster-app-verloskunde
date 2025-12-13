"""Test suite for RequirementQueue priority sorting.

Validates the 3-layer priority system:
  Layer 1: Timeblock (date + dagdeel)
  Layer 2: Service priority (System → TOT → GRO/ORA)
  Layer 3: Alphabetic within priority

Tests DRAAD172 clarification 2 requirements:
  - System services (DIO/DDO/DIA/DDA) sorted first per dagdeel
  - TOT services sorted second, alphabetically
  - Team services (GRO/ORA) sorted third, alphabetically
  - No interspersing between priority tiers
"""

import pytest
from datetime import date
from src.solver.requirement_queue import Requirement, RequirementQueue


class TestSystemServicePriority:
    """Test that system services get highest priority per dagdeel."""

    def test_system_services_before_tot_ochtend(self):
        """System services (DIO/DDO) MUST come before TOT in Ochtend."""
        reqs = [
            # Unsorted: TOT before system
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="tot-ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
                is_system=False,
            ),
            # System service
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                team=None,
                is_system=True,
            ),
            # Another system
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ddo-id",
                service_code="DDO",
                aantal=2,
                team=None,
                is_system=True,
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # DIO should be first (priority 0, order 1)
        assert sorted_reqs[0].service_code == "DIO", "DIO must be first"
        # DDO should be second (priority 0, order 2)
        assert sorted_reqs[1].service_code == "DDO", "DDO must be second"
        # ECH (TOT) should be third (priority 1)
        assert sorted_reqs[2].service_code == "ECH", "ECH (TOT) must come after system"

    def test_system_services_before_tot_avond(self):
        """System services (DIA/DDA) MUST come before TOT in Avond."""
        reqs = [
            # TOT in avond
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="A",
                service_id="tot-ech-id",
                service_code="ECH",
                aantal=1,
                team="TOT",
                is_system=False,
            ),
            # System avond
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="A",
                service_id="dia-id",
                service_code="DIA",
                aantal=3,
                team=None,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="A",
                service_id="dda-id",
                service_code="DDA",
                aantal=0,
                team=None,
                is_system=True,
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        assert sorted_reqs[0].service_code == "DIA", "DIA must be first in Avond"
        assert sorted_reqs[1].service_code == "DDA", "DDA must be second in Avond"
        assert sorted_reqs[2].service_code == "ECH", "ECH (TOT) must come after system"

    def test_system_order_per_dagdeel(self):
        """Verify SYSTEM_ORDER_BY_DAGDEEL is respected."""
        # Ochtend: DIO=1, DDO=2
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ddo-id",
                service_code="DDO",
                aantal=2,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # DIO order 1 must come before DDO order 2
        assert sorted_reqs[0].service_code == "DIO"
        assert sorted_reqs[1].service_code == "DDO"


class TestTOTAlphabeticSort:
    """Test that TOT services are sorted alphabetically."""

    def test_tot_alphabetic_order(self):
        """TOT services must be sorted alphabetically by service_code."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="swz-id",
                service_code="SWZ",
                aantal=3,
                team="TOT",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="mdh-id",
                service_code="MDH",
                aantal=1,
                team="TOT",
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Should be: ECH < MDH < SWZ (alphabetic)
        assert sorted_reqs[0].service_code == "ECH"
        assert sorted_reqs[1].service_code == "MDH"
        assert sorted_reqs[2].service_code == "SWZ"

    def test_tot_with_multiple_instances(self):
        """Multiple instances of same TOT service should preserve quantity."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="swz-id",
                service_code="SWZ",
                aantal=3,
                team="TOT",
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        assert sorted_reqs[0].service_code == "ECH"
        assert sorted_reqs[0].aantal == 2
        assert sorted_reqs[1].service_code == "SWZ"
        assert sorted_reqs[1].aantal == 3


class TestTeamServicePriority:
    """Test that team services (GRO/ORA) come after TOT."""

    def test_team_services_after_tot(self):
        """Team services (GRO/ORA) must come after TOT."""
        reqs = [
            # ORA team
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="osp-id",
                service_code="OSP",
                aantal=2,
                team="ORA",
            ),
            # TOT
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
            ),
            # GRO team
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="mec-id",
                service_code="MEC",
                aantal=1,
                team="GRO",
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # ECH (TOT) at index 0 (priority 1)
        # OSP and MEC at indices 1-2 (priority 2)
        assert sorted_reqs[0].service_code == "ECH", "TOT must be before teams"
        assert sorted_reqs[0].team == "TOT"
        # Remaining two are teams
        assert sorted_reqs[1].team in ["ORA", "GRO"]
        assert sorted_reqs[2].team in ["ORA", "GRO"]

    def test_team_alphabetic_sort(self):
        """Team services must be sorted alphabetically."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ort-id",
                service_code="ORT",
                aantal=1,
                team="ORA",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="mec-id",
                service_code="MEC",
                aantal=2,
                team="GRO",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="osp-id",
                service_code="OSP",
                aantal=2,
                team="ORA",
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Should be alphabetic: MEC < ORA/ORT < ORA/OSP
        codes = [req.service_code for req in sorted_reqs]
        assert codes == sorted(codes), f"Expected alphabetic, got {codes}"


class TestTimeblockClustering:
    """Test that requirements are grouped by timeblock (date + dagdeel)."""

    def test_timeblock_clustering(self):
        """Requirements for same timeblock must be clustered."""
        reqs = [
            # Date 25-11 Avond
            Requirement(
                date=date(2025, 11, 25),
                dagdeel="A",
                service_id="ech-id",
                service_code="ECH",
                aantal=1,
                team="TOT",
            ),
            # Date 24-11 Ochtend
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
            # Date 25-11 Ochtend (another avond after ochtend)
            Requirement(
                date=date(2025, 11, 25),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
            # Date 24-11 Avond
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="A",
                service_id="dia-id",
                service_code="DIA",
                aantal=3,
                is_system=True,
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Check clustering by timeblock
        prev_timeblock = None
        for req in sorted_reqs:
            curr_timeblock = (req.date, req.dagdeel)
            if prev_timeblock and prev_timeblock != curr_timeblock:
                # Timeblock changed; verify it advanced (no backtracking)
                assert curr_timeblock > prev_timeblock, (
                    f"Timeblock went backward: {prev_timeblock} → {curr_timeblock}"
                )
            prev_timeblock = curr_timeblock

    def test_date_order(self):
        """Requirements must be ordered by date."""
        reqs = [
            Requirement(
                date=date(2025, 11, 26),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 25),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        assert sorted_reqs[0].date == date(2025, 11, 24)
        assert sorted_reqs[1].date == date(2025, 11, 25)
        assert sorted_reqs[2].date == date(2025, 11, 26)


class TestValidation:
    """Test the validation function."""

    def test_validation_passes_correct_sort(self):
        """Validation should pass for correctly sorted requirements."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ddo-id",
                service_code="DDO",
                aantal=2,
                is_system=True,
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)
        result = RequirementQueue.validate_sort_order(sorted_reqs)

        assert result["is_valid"] is True
        assert len(result["violations"]) == 0

    def test_validation_detects_priority_violation(self):
        """Validation should detect when priority decreases within timeblock."""
        # Manually create violation: TOT then System
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="ech-id",
                service_code="ECH",
                aantal=2,
                team="TOT",
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel="O",
                service_id="dio-id",
                service_code="DIO",
                aantal=3,
                is_system=True,
            ),
        ]

        # This list is NOT sorted correctly (TOT before System)
        result = RequirementQueue.validate_sort_order(reqs)

        # Should detect violation
        assert result["is_valid"] is False
        assert len(result["violations"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
