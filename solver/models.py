"""Pydantic models voor API input/output validatie."""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import date
from enum import Enum


class TeamType(str, Enum):
    """Team types volgens database."""
    MAAT = "maat"
    LOONDIENST = "loondienst"
    OVERIG = "overig"  # ZZP-ers


class Dagdeel(str, Enum):
    """Dagdelen."""
    OCHTEND = "O"
    MIDDAG = "M"
    AVOND = "A"


class SolveStatus(str, Enum):
    """Status van solve resultaat."""
    OPTIMAL = "optimal"  # Optimale oplossing gevonden
    FEASIBLE = "feasible"  # Geldige oplossing, niet optimaal
    INFEASIBLE = "infeasible"  # Geen oplossing mogelijk
    TIMEOUT = "timeout"  # Timeout bereikt
    ERROR = "error"  # Fout opgetreden


class Employee(BaseModel):
    """Medewerker informatie."""
    id: int
    name: str
    team: TeamType
    structureel_nbh: Optional[Dict[str, List[str]]] = Field(
        default=None,
        description="Structurele niet-beschikbaarheid: {dag_code: [dagdelen]}"
    )
    max_werkdagen: Optional[int] = Field(
        default=None,
        description="Max aantal werkdagen per week"
    )
    min_werkdagen: Optional[int] = Field(
        default=None,
        description="Min aantal werkdagen per week"
    )


class Service(BaseModel):
    """Dienst informatie."""
    id: int
    code: str
    naam: str
    dagdeel: Dagdeel
    is_nachtdienst: bool = False


class EmployeeService(BaseModel):
    """Bevoegdheid: welke medewerker mag welke dienst doen."""
    employee_id: int
    service_id: int


class PreAssignment(BaseModel):
    """Pre-planning: reeds ingeplande diensten (status > 0)."""
    employee_id: int
    date: date
    dagdeel: Dagdeel
    service_id: int
    status: int = Field(
        ge=1,
        description="Status: 1=ORT filled, 2=uit nacht, 3=handmatig, 4=definitief"
    )


class SolveRequest(BaseModel):
    """Request body voor solve endpoint."""
    roster_id: int
    start_date: date
    end_date: date
    employees: List[Employee]
    services: List[Service]
    employee_services: List[EmployeeService]
    pre_assignments: List[PreAssignment] = Field(default_factory=list)
    timeout_seconds: int = Field(default=30, ge=5, le=300)
    
    @validator('end_date')
    def validate_date_range(cls, v, values):
        """Valideer dat end_date na start_date ligt."""
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date moet na start_date liggen')
        return v


class Assignment(BaseModel):
    """Resultaat: één assignment (medewerker → dienst op datum/dagdeel)."""
    employee_id: int
    employee_name: str
    date: date
    dagdeel: Dagdeel
    service_id: int
    service_code: str
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Hoe zeker is solver van deze assignment (1.0 = zeer zeker)"
    )


class ConstraintViolation(BaseModel):
    """Constraint die niet gehaald kon worden."""
    constraint_type: str = Field(
        description="Bijv: 'bevoegdheid', 'beschikbaarheid', 'max_werkdagen'"
    )
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    date: Optional[date] = None
    dagdeel: Optional[Dagdeel] = None
    service_id: Optional[int] = None
    message: str = Field(description="Beschrijving van het probleem")
    severity: str = Field(
        default="warning",
        description="'critical', 'warning', of 'info'"
    )


class Suggestion(BaseModel):
    """Prescriptive suggestie voor planner."""
    type: str = Field(
        description="Bijv: 'increase_max_werkdagen', 'add_bevoegdheid', 'hire_zzp'"
    )
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    action: str = Field(description="Concrete actie die planner kan nemen")
    impact: str = Field(
        description="Verwachte impact van deze suggestie"
    )


class SolveResponse(BaseModel):
    """Response van solve endpoint."""
    status: SolveStatus
    roster_id: int
    assignments: List[Assignment] = Field(default_factory=list)
    solve_time_seconds: float
    
    # Statistieken
    total_assignments: int = 0
    total_slots: int = 0
    fill_percentage: float = 0.0
    
    # Rapportage (Level 2 + 3)
    violations: List[ConstraintViolation] = Field(default_factory=list)
    suggestions: List[Suggestion] = Field(default_factory=list)
    
    # Metadata
    solver_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extra metadata: objective_value, branches, walltime, etc."
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    service: str
    version: str


class VersionResponse(BaseModel):
    """Version informatie response."""
    version: str
    or_tools_version: str
    phase: str
    capabilities: List[str]
