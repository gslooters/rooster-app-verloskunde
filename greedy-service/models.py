"""
GREEDY Werkbestand Datamodellen
Versie 1.0 - FASE 1 Foundation Baseline
"""

from dataclasses import dataclass, field
from typing import Dict, Set, List, Tuple, Optional
from datetime import date


@dataclass
class ServiceTask:
    """Een enkele taak uit werkbestandopdracht."""
    id: str
    rosterid: str
    date: date
    dagdeel: str  # O, M, A
    team: str  # Groen, Oranje, TOT, etc
    serviceid: str
    servicecode: str
    issystem: bool
    aantal: int  # Totaal benodigd
    invulling: int = 0  # 0=OPEN, 1=INGEVULD, 2=PRE-PLANNED


@dataclass
class Assignment:
    """Een enkele rij uit werkbestandplanning."""
    id: str
    rosterid: str
    employeeid: str
    date: date
    dagdeel: str
    serviceid: str
    status: int  # 0=OPEN, 1=ACTIVE, 2=BLOCKED
    source: str  # "greedy" or "manual"
    blockingfuture: List[Tuple[str, str, str]] = field(default_factory=list)
    # blockingfuture = [(datestr, dagdeel, employeeid), ...]


@dataclass
class WorkspaceState:
    """Totale state van GREEDY processing."""
    rosterid: str
    startdate: date
    enddate: date

    # Werkbestanden
    tasks: List[ServiceTask] = field(default_factory=list)
    assignments: List[Assignment] = field(default_factory=list)

    # Capaciteit tracking
    # Key: (employeeid, serviceid), Value: remaining count
    capacity: Dict[Tuple[str, str], int] = field(default_factory=dict)

    # Blocking calendar
    # Key: (datestr, dagdeel, employeeid)
    blockedslots: Set[Tuple[str, str, str]] = field(default_factory=set)

    # Statistieken
    totalneeded: int = 0
    totalassigned: int = 0
    totalopen: int = 0
