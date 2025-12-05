"""Pydantic models voor API input/output validatie.

DRAAD106: Status semantiek duidelijk gedefinieerd:
- Status 0 + NULL: Beschikbaar slot (ORT mag plannen)
- Status 0 + service_id: ORT voorlopig (hint, mag wijzigen)
- Status 1 + service_id: Fixed (handmatig of gefinaliseerd, ORT MOET respecteren)
- Status 2 + NULL: Geblokkeerd door DIA/DDA/DIO/DDO (ORT MAG NIET gebruiken)
- Status 3 + NULL: Structureel NBH (ORT MAG NOOIT aanraken)
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
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
    """Medewerker informatie - volgens Supabase employees tabel."""
    id: str  # text in database
    voornaam: str  # text in database
    achternaam: str  # text in database
    team: TeamType  # text in database
    aantalwerkdagen: int  # integer in database
    structureel_nbh: Optional[Dict[str, List[str]]] = Field(
        default=None,
        description="Structurele niet-beschikbaarheid: {dag_code: [dagdelen]}"
    )
    actief: bool = Field(default=True)
    
    @property
    def name(self) -> str:
        """Helper property voor volledige naam."""
        return f"{self.voornaam} {self.achternaam}"


class Service(BaseModel):
    """Dienst informatie."""
    id: str  # uuid in database (als string)
    code: str
    naam: str
    dagdeel: Dagdeel
    is_nachtdienst: bool = False


class EmployeeService(BaseModel):
    """Bevoegdheid: welke medewerker mag welke dienst doen - volgens employee_services tabel.
    
    LEGACY - Vervangen door RosterEmployeeService (DRAAD105)
    """
    employee_id: str  # text in database
    service_id: str  # uuid in database (als string)


class RosterEmployeeService(BaseModel):
    """DRAAD105: Bevoegdheid per roster met streefaantal en actieve status.
    
    Bron: roster_employee_services tabel
    - roster_id: uuid (als string)
    - employee_id: text in database
    - service_id: uuid in database (als string)
    - aantal: integer - streefgetal (min=max tegelijk), 0=ZZP/reserve
    - actief: boolean - alleen TRUE mag worden toegewezen (harde eis)
    """
    roster_id: str  # uuid in database (als string)
    employee_id: str  # text in database
    service_id: str  # uuid in database (als string)
    aantal: int = Field(
        ge=0,
        description="Streefaantal: min=max tegelijk. 0=ZZP/reserve (lagere priority)"
    )
    actief: bool = Field(
        default=True,
        description="Alleen actieve bevoegdheden (TRUE) mogen worden toegewezen"
    )


# ============================================================================
# DRAAD106: NIEUWE MODELLEN VOOR STATUS SEMANTIEK
# ============================================================================

class FixedAssignment(BaseModel):
    """Status 1: Handmatig gepland of gefinaliseerd, MOET worden gerespecteerd.
    
    ORT gedrag: HARD CONSTRAINT - moet exact worden overgenomen.
    """
    employee_id: str
    date: date
    dagdeel: Dagdeel
    service_id: str


class BlockedSlot(BaseModel):
    """Status 2, 3: Niet beschikbaar voor ORT.
    
    - Status 2: Geblokkeerd door DIA/DDA/DIO/DDO dienst (automatisch)
    - Status 3: Structureel NBH (handmatig of systeem)
    
    ORT gedrag: HARD CONSTRAINT - mag NIET worden gebruikt voor ENIGE dienst.
    """
    employee_id: str
    date: date
    dagdeel: Dagdeel
    status: Literal[2, 3]
    blocked_by_service_id: Optional[str] = Field(
        default=None,
        description="Voor status 2: welke dienst veroorzaakt blokkering"
    )


class SuggestedAssignment(BaseModel):
    """Status 0 + service_id: Hint van vorige ORT run.
    
    ORT gedrag: SOFT CONSTRAINT (optioneel) - preference maar geen harde eis.
    Wordt gebruikt als warm-start of volledig genegeerd (Optie C).
    """
    employee_id: str
    date: date
    dagdeel: Dagdeel
    service_id: str


class PreAssignment(BaseModel):
    """Pre-planning: reeds ingeplande diensten (status > 0).
    
    DEPRECATED (DRAAD106): Gebruik FixedAssignment + BlockedSlot + SuggestedAssignment.
    Behouden voor backwards compatibility.
    """
    employee_id: str  # text in database
    date: date
    dagdeel: Dagdeel
    service_id: str  # uuid in database (als string)
    status: int = Field(
        ge=1,
        description="Status: 1=Fixed, 2=Blocked, 3=Structureel NBH"
    )


# ============================================================================
# SOLVE REQUEST & RESPONSE
# ============================================================================

class SolveRequest(BaseModel):
    """Request body voor solve endpoint.
    
    DRAAD105: Gebruikt roster_employee_services ipv employee_services
    DRAAD106: Splitst pre_assignments in fixed, blocked, suggested
    """
    roster_id: str  # uuid in database (als string)
    start_date: date
    end_date: date
    employees: List[Employee]
    services: List[Service]
    roster_employee_services: List[RosterEmployeeService]  # DRAAD105
    
    # DRAAD106: Nieuwe velden (preferred)
    fixed_assignments: List[FixedAssignment] = Field(
        default_factory=list,
        description="Status 1: MOET worden gerespecteerd"
    )
    blocked_slots: List[BlockedSlot] = Field(
        default_factory=list,
        description="Status 2, 3: MAG NIET worden gebruikt"
    )
    suggested_assignments: List[SuggestedAssignment] = Field(
        default_factory=list,
        description="Status 0 + service_id: Hints (optioneel)"
    )
    
    # DEPRECATED: Backwards compatibility
    pre_assignments: List[PreAssignment] = Field(
        default_factory=list,
        description="DEPRECATED - Gebruik fixed_assignments + blocked_slots"
    )
    
    timeout_seconds: int = Field(default=30, ge=5, le=300)
    
    @validator('end_date')
    def validate_date_range(cls, v, values):
        """Valideer dat end_date na start_date ligt."""
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date moet na start_date liggen')
        return v


class Assignment(BaseModel):
    """Resultaat: één assignment (medewerker → dienst op datum/dagdeel)."""
    employee_id: str  # text in database
    employee_name: str
    date: date
    dagdeel: Dagdeel
    service_id: str  # uuid in database (als string)
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
    employee_id: Optional[str] = None  # text in database
    employee_name: Optional[str] = None
    date: Optional[date] = None
    dagdeel: Optional[Dagdeel] = None
    service_id: Optional[str] = None  # uuid in database (als string)
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
    employee_id: Optional[str] = None  # text in database
    employee_name: Optional[str] = None
    action: str = Field(description="Concrete actie die planner kan nemen")
    impact: str = Field(
        description="Verwachte impact van deze suggestie"
    )


class SolveResponse(BaseModel):
    """Response van solve endpoint."""
    status: SolveStatus
    roster_id: str  # uuid in database (als string)
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
