"""
FASE 1: Data Loader
Load all data from Supabase into workspace state
"""

import os
import sys
from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase library not installed")
    sys.exit(1)

from models import ServiceTask, Assignment, WorkspaceState


class DataLoader:
    """Load all data from Supabase into workspace."""

    def __init__(self, rooster_id: str):
        self.rooster_id = rooster_id
        self.client = Client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )

    def load_workspace(self) -> WorkspaceState:
        """Load all data into workspace state."""

        print("Loading workspace...")

        # 1. Load rooster info
        print("  1. Loading rooster info...")
        rooster_data = (
            self.client.table("roosters")
            .select("*")
            .eq("id", self.rooster_id)
            .single()
            .execute()
        )
        rooster = rooster_data.data
        startdate = date.fromisoformat(rooster["startdate"])
        enddate = date.fromisoformat(rooster["enddate"])

        workspace = WorkspaceState(
            rosterid=self.rooster_id,
            startdate=startdate,
            enddate=enddate
        )
        print(f"    -> Rooster period: {startdate} to {enddate}")

        # 2. Load staffing requirements
        print("  2. Loading staffing requirements...")
        staffing_data = (
            self.client.table("rosterperiodstaffingdagdelen")
            .select("*")
            .eq("rosterid", self.rooster_id)
            .execute()
        )

        # Load service mapping
        services_map = self._load_services_map()

        tasks = []
        for row in staffing_data.data:
            service_info = services_map.get(row["serviceid"], {})
            task = ServiceTask(
                id=row["id"],
                rosterid=row["rosterid"],
                date=date.fromisoformat(row["date"]),
                dagdeel=row["dagdeel"],
                team=row["team"],
                serviceid=row["serviceid"],
                servicecode=service_info.get("code", "UNKNOWN"),
                issystem=service_info.get("issystem", False),
                aantal=row["aantal"],
                invulling=0  # All start as OPEN
            )
            tasks.append(task)
            workspace.totalneeded += row["aantal"]

        # Sort werkbestandopdracht per spec
        tasks = self._sort_tasks(tasks)
        workspace.tasks = tasks
        print(f"    -> Loaded {len(tasks)} tasks, {workspace.totalneeded} total needed")

        # 3. Load capacity (employee services)
        print("  3. Loading employee capacity...")
        emp_services_data = (
            self.client.table("rosteremployeeservices")
            .select("*")
            .eq("rosterid", self.rooster_id)
            .eq("actief", True)
            .execute()
        )
        capacity = {}
        for row in emp_services_data.data:
            key = (row["employeeid"], row["serviceid"])
            capacity[key] = row["aantal"]
        workspace.capacity = capacity
        print(f"    -> Loaded {len(capacity)} employee-service combinations")

        # 4. Load assignments (pre-planning)
        print("  4. Loading existing assignments...")
        assignments_data = (
            self.client.table("rosterassignments")
            .select("*")
            .eq("rosterid", self.rooster_id)
            .execute()
        )
        assignments = []
        for row in assignments_data.data:
            # Only load status 0 (OPEN) and 1 (ACTIVE)
            if row["status"] in [0, 1]:
                assignment = Assignment(
                    id=row["id"],
                    rosterid=row["rosterid"],
                    employeeid=row["employeeid"],
                    date=date.fromisoformat(row["date"]),
                    dagdeel=row["dagdeel"],
                    serviceid=row["serviceid"],
                    status=row["status"],
                    source=row.get("source", "manual")
                )
                assignments.append(assignment)
                if row["status"] == 1:
                    workspace.totalassigned += 1
        workspace.assignments = assignments
        print(f"    -> Loaded {len(assignments)} assignments (active={workspace.totalassigned})")

        # 5. Load blocked slots (status=2)
        print("  5. Loading blocked slots...")
        blocked_data = (
            self.client.table("rosterassignments")
            .select("*")
            .eq("rosterid", self.rooster_id)
            .filter("status", "gt", 0)  # status > 0 means BLOCKED or higher
            .execute()
        )
        blocked_slots = set()
        for row in blocked_data.data:
            if row["status"] == 2:  # BLOCKED
                key = (row["date"], row["dagdeel"], row["employeeid"])
                blocked_slots.add(key)
        workspace.blockedslots = blocked_slots
        print(f"    -> Loaded {len(blocked_slots)} blocked slots")

        print("\nWorkspace loaded successfully!")
        return workspace

    def _load_services_map(self) -> Dict[str, Dict]:
        """Load service types into a map."""
        services_data = self.client.table("servicetypes").select("*").execute()
        return {
            s["id"]: {
                "code": s.get("code", ""),
                "naam": s.get("naam", ""),
                "issystem": s.get("issystem", False)
            }
            for s in services_data.data
        }

    def _sort_tasks(self, tasks: List[ServiceTask]) -> List[ServiceTask]:
        """Sort werkbestandopdracht per spec.
        
        Priority:
        1. issystem: TRUE first (0), then FALSE (1)
        2. date: old -> new
        3. dagdeel: O(0) < M(1) < A(2)
        4. team: TOT(0) < Groen(1) < Oranje(2) < Other(3)
        5. servicecode: alphabetical
        """
        def sort_key(t: ServiceTask) -> Tuple:
            return (
                not t.issystem,  # TRUE first = False (0), FALSE second = True (1)
                t.date,  # oldest first
                self._dagdeel_order(t.dagdeel),
                self._team_order(t.team),
                t.servicecode  # alphabetical
            )

        return sorted(tasks, key=sort_key)

    @staticmethod
    def _dagdeel_order(dagdeel: str) -> int:
        """Get sort order for dagdeel: O=0, M=1, A=2"""
        order = {"O": 0, "M": 1, "A": 2}
        return order.get(dagdeel, 99)

    @staticmethod
    def _team_order(team: str) -> int:
        """Get sort order for team: TOT=0, Groen=1, Oranje=2, Other=3"""
        order = {"TOT": 0, "Groen": 1, "Oranje": 2}
        return order.get(team, 3)
