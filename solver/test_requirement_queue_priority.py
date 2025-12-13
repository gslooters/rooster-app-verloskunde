"""Test suite for RequirementQueue priority sorting (DRAAD172)

Validates correct 3-layer priority sorting:
  - Layer 1: Date & Dagdeel clustering
  - Layer 2: Priority (System → TOT → GRO/ORA)
  - Layer 3: Alphabetic within priority

All tests use mock Requirement data (no DB).
"""

import pytest
from datetime import date
from requirement_queue import Requirement, RequirementQueue


class TestSystemPriority:
    """Test system services have highest priority."""

    def test_system_priority_ochtend(self):
        """System services (DIO/DDO) come BEFORE TOT in Ochtend."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-1',
                service_code='ECH',
                aantal=2,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-1',
                service_code='DIO',
                aantal=3,
                team=None,
                is_system=True
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-2',
                service_code='DDO',
                aantal=2,
                team=None,
                is_system=True
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Check order: DIO → DDO → ECH
        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'DDO'
        assert sorted_reqs[2].service_code == 'ECH'

    def test_system_priority_avond(self):
        """System services (DIA/DDA) come BEFORE TOT in Avond."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='A',
                service_id='tot-id-1',
                service_code='MDH',
                aantal=1,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='A',
                service_id='sys-id-1',
                service_code='DIA',
                aantal=3,
                team=None,
                is_system=True
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='A',
                service_id='sys-id-2',
                service_code='DDA',
                aantal=2,
                team=None,
                is_system=True
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Check order: DIA → DDA → MDH
        assert sorted_reqs[0].service_code == 'DIA'
        assert sorted_reqs[1].service_code == 'DDA'
        assert sorted_reqs[2].service_code == 'MDH'

    def test_system_order_per_dagdeel(self):
        """DIO comes before DDO (as per SYSTEM_ORDER_BY_DAGDEEL)."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-2',
                service_code='DDO',
                aantal=2,
                team=None,
                is_system=True
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-1',
                service_code='DIO',
                aantal=3,
                team=None,
                is_system=True
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'DDO'


class TestTOTPriority:
    """Test TOT services sorted alphabetically."""

    def test_tot_alphabetic(self):
        """TOT services sorted alphabetically (ECH < MDH < SWZ)."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-3',
                service_code='SWZ',
                aantal=3,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-1',
                service_code='ECH',
                aantal=2,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-2',
                service_code='MDH',
                aantal=1,
                team='TOT',
                is_system=False
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        assert sorted_reqs[0].service_code == 'ECH'
        assert sorted_reqs[1].service_code == 'MDH'
        assert sorted_reqs[2].service_code == 'SWZ'

    def test_tot_after_system(self):
        """TOT never comes before System services."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-1',
                service_code='ECH',
                aantal=2,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-1',
                service_code='DIO',
                aantal=3,
                team=None,
                is_system=True
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # System must be first
        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'ECH'


class TestTeamPriority:
    """Test team services (GRO/ORA) have lowest priority."""

    def test_team_after_tot(self):
        """Team services (GRO/ORA) never come before TOT."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='team-id-1',
                service_code='OSP',
                aantal=2,
                team='ORA',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='tot-id-1',
                service_code='ECH',
                aantal=2,
                team='TOT',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='sys-id-1',
                service_code='DIO',
                aantal=3,
                team=None,
                is_system=True
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Check order: DIO → ECH → OSP
        assert sorted_reqs[0].service_code == 'DIO'
        assert sorted_reqs[1].service_code == 'ECH'
        assert sorted_reqs[2].service_code == 'OSP'

    def test_team_alphabetic(self):
        """Team services sorted alphabetically."""
        reqs = [
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='team-id-2',
                service_code='ORT',
                aantal=1,
                team='ORA',
                is_system=False
            ),
            Requirement(
                date=date(2025, 11, 24),
                dagdeel='O',
                service_id='team-id-1',
                service_code='OSP',
                aantal=2,
                team='ORA',
                is_system=False
            ),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Alphabetic: ORT < OSP
        assert sorted_reqs[0].service_code == 'ORT'
        assert sorted_reqs[1].service_code == 'OSP'


class TestComplexScenarios:
    """Test complex real-world scenarios."""

    def test_full_week_schedule(self):
        """Test multi-day, multi-dagdeel with mixed priorities."""
        reqs = [
            # 24-11 Ochtend
            Requirement(date(2025, 11, 24), 'O', 'id1', 'DIO', 3, None, True),
            Requirement(date(2025, 11, 24), 'O', 'id2', 'ECH', 2, 'TOT', False),
            Requirement(date(2025, 11, 24), 'O', 'id3', 'OSP', 1, 'ORA', False),
            # 24-11 Avond
            Requirement(date(2025, 11, 24), 'A', 'id4', 'DIA', 3, None, True),
            Requirement(date(2025, 11, 24), 'A', 'id5', 'MDH', 1, 'TOT', False),
            # 25-11 Ochtend
            Requirement(date(2025, 11, 25), 'O', 'id6', 'DIO', 3, None, True),
            Requirement(date(2025, 11, 25), 'O', 'id7', 'SWZ', 2, 'TOT', False),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        # Verify timeblock clustering and priority ordering
        assert len(sorted_reqs) == 7

        # First timeblock: 24-11 O
        assert sorted_reqs[0].date == date(2025, 11, 24)
        assert sorted_reqs[0].dagdeel == 'O'
        assert sorted_reqs[0].service_code == 'DIO'  # System first
        assert sorted_reqs[1].service_code == 'ECH'  # TOT second
        assert sorted_reqs[2].service_code == 'OSP'  # Team third

        # Second timeblock: 24-11 A
        assert sorted_reqs[3].date == date(2025, 11, 24)
        assert sorted_reqs[3].dagdeel == 'A'
        assert sorted_reqs[3].service_code == 'DIA'  # System first
        assert sorted_reqs[4].service_code == 'MDH'  # TOT second

        # Third timeblock: 25-11 O
        assert sorted_reqs[5].date == date(2025, 11, 25)
        assert sorted_reqs[5].dagdeel == 'O'
        assert sorted_reqs[5].service_code == 'DIO'  # System first
        assert sorted_reqs[6].service_code == 'SWZ'  # TOT second

    def test_mixed_priorities_same_dagdeel(self):
        """Test correct mixing of all priority levels in one dagdeel."""
        reqs = [
            # Mixed in unsorted order
            Requirement(date(2025, 11, 24), 'O', 'a', 'OSP', 1, 'ORA', False),
            Requirement(date(2025, 11, 24), 'O', 'b', 'DDO', 2, None, True),
            Requirement(date(2025, 11, 24), 'O', 'c', 'SWZ', 3, 'TOT', False),
            Requirement(date(2025, 11, 24), 'O', 'd', 'DIO', 3, None, True),
            Requirement(date(2025, 11, 24), 'O', 'e', 'ECH', 2, 'TOT', False),
            Requirement(date(2025, 11, 24), 'O', 'f', 'ORT', 1, 'ORA', False),
        ]

        sorted_reqs = RequirementQueue.sort_by_priority(reqs)

        codes = [r.service_code for r in sorted_reqs]
        # Should be: DIO, DDO, ECH, SWZ, ORT, OSP
        # (System ordered, TOT alphabetic, Team alphabetic)
        assert codes == ['DIO', 'DDO', 'ECH', 'SWZ', 'ORT', 'OSP']


class TestHelperMethods:
    """Test helper methods for filtering and grouping."""

    def test_get_requirements_for_timeblock(self):
        """Test filtering by timeblock."""
        reqs = [
            Requirement(date(2025, 11, 24), 'O', 'a', 'DIO', 3, None, True),
            Requirement(date(2025, 11, 24), 'O', 'b', 'ECH', 2, 'TOT', False),
            Requirement(date(2025, 11, 24), 'A', 'c', 'DIA', 3, None, True),
            Requirement(date(2025, 11, 25), 'O', 'd', 'DIO', 3, None, True),
        ]

        # Get requirements for 24-11 O
        filtered = RequirementQueue.get_requirements_for_timeblock(
            reqs, date(2025, 11, 24), 'O'
        )

        assert len(filtered) == 2
        assert all(r.date == date(2025, 11, 24) and r.dagdeel == 'O' for r in filtered)

    def test_group_by_timeblock(self):
        """Test grouping by timeblock."""
        reqs = [
            Requirement(date(2025, 11, 24), 'O', 'a', 'DIO', 3, None, True),
            Requirement(date(2025, 11, 24), 'O', 'b', 'ECH', 2, 'TOT', False),
            Requirement(date(2025, 11, 24), 'A', 'c', 'DIA', 3, None, True),
            Requirement(date(2025, 11, 25), 'O', 'd', 'DIO', 3, None, True),
        ]

        grouped = RequirementQueue.group_by_timeblock(reqs)

        assert len(grouped) == 3
        assert len(grouped[(date(2025, 11, 24), 'O')]) == 2
        assert len(grouped[(date(2025, 11, 24), 'A')]) == 1
        assert len(grouped[(date(2025, 11, 25), 'O')]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
