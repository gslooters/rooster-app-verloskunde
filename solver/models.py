"""Pydantic models voor API input/output validatie.

DRAD117: Schema cleanup - removed Employee.aantalwerkdagen + Service.dagdeel
- Only pure Solver constraints remain (bevoegdheid, beschikbaarheid, fixed/blocked, exact bezetting)
- Planning metadata moved out of schema

DRAD106: Status semantiek duidelijk gedefinieerd:
- Status 0 + NULL: Beschikbaar slot (ORT mag plannen)
- Status 0 + service_id: ORT voorlopig (hint, mag wijzigen)
- Status 1 + service_id: Fixed (handmatig of gefinaliseerd, ORT MOET respecteren)
- Status 2 + NULL: Geblokkeerd door DIA/DDA/DIO/DDO (ORT MAG NIET gebruiken)
- Status 3 + NULL: Structureel NBH (ORT MAG NOOIT aanraken)

DRAD108: Bezetting realiseren constraint toegevoegd:
- ExactStaffing model voor roster_period_staffing_dagdelen integratie
- Exact aantal medewerkers per dienst/dagdeel/team afdwingen

DRAD118A: INFEASIBLE handling met Bottleneck Analysis
- BottleneckItem: Per service capacity analysis
- BottleneckSuggestion: Actionable recommendations
- BottleneckReport: Complete analysis when INFEASIBLE
- Status STAYS 'draft' when INFEASIBLE (not 'in_progress')

DRAD128: BlockedSlot validation fix
- CHANGED: BlockedSlot.status now accepts Literal[1, 2, 3] (was Literal[2, 3])
- REASON: DRAAD130 includes status 1 fixed assignments in blocked_slots array
- SEMANTICS: Status 1 = Fixed (MUST be respected), Status 2-3 = Blocked (CANNOT be used)
- COMPATIBILITY: Solver properly handles all three statuses as hard constraints

DRAD214-FIX: Add missing solver_result field
- ISSUE: Frontend received undefined solver_result, causing dashboard errors
- ROOT CAUSE: Field was used by frontend but never defined in model
- SOLUTION: Add optional solver_result: str field to SolveResponse
"""

from pydantic import BaseModel, Field, validator, ConfigDict
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
    """Medewerker informatie - DRAAD117 schema cleanup.
    
    DRAAD117: Removed aantalwerkdagen (planning metadata, not Solver constraint).
    Constraint sources:
    - RosterEmployeeService.aantal: streefgetal per dienst
    - ExactStaffing: exact bezetting per date/dagdeel/team/service
    """
    id: str  # text in database
    voornaam: str  # text in database
    achternaam: str  # text in database
    team: TeamType  # text in database
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
    """Dienst informatie - DRAAD117 schema cleanup.
    
    DRAAD117: Removed dagdeel (data already in ExactStaffing via dagdeel field).
    Constraint sources:
    - ExactStaffing: bezetting per date/dagdeel/team/service
    """
    id: str  # uuid in database (als string)
    code: str
    naam: str
    is_nachtdienst: bool = Field(default=False)


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
    """Status 1, 2, 3: Niet beschikbaar of gefinaliseerd (DRAAD128).
    
    DRAAD128 CHANGE: Now accepts status 1 (Fixed assignments from DRAAD130)
    - Status 1: Fixed (handmatig gepland, ORT MOET respecteren)
    - Status 2: Geblokkeerd door DIA/DDA/DIO/DDO dienst (automatisch)
    - Status 3: Structureel NBH (handmatig of systeem)
    
    ORT gedrag: HARD CONSTRAINT - respecteer status 1, mag status 2-3 NIET gebruiken.
    
    RATIONALE: DRAAD130 optimizes data transfer by including status 1 fixed
    assignments in the same blocked_slots array as status 2-3 blocked items.
    This reduces payload size and simplifies data handling.
    """
    employee_id: str
    date: date
    dagdeel: Dagdeel
    status: Literal[1, 2, 3]  # DRAAD128: Now includes 1 (Fixed)
    blocked_by_service_id: Optional[str] = Field(
        default=None,
        description="For status 1: assigned service; for status 2: blocking service"
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
# DRAAD108: NIEUWE MODELLEN VOOR BEZETTING REALISEREN
# ============================================================================

class ExactStaffing(BaseModel):
    """DRAAD108: Exacte bezetting per dienst/dagdeel/team uit roster_period_staffing_dagdelen.
    
    DRAAD120: Pydantic alias for backward compatibility
    - Database veld: 'aantal'
    - Model veld: 'exact_aantal' (internally)
    - Accepts both field names via populate_by_name=True
    
    Logica:
    - aantal > 0: ORT MOET exact dit aantal plannen (min=max tegelijk)
    - aantal = 0: ORT MAG NIET plannen (verboden)
    
    Team mapping:
    - 'TOT' → alle medewerkers (geen filter)
    - 'GRO' → employees.team = 'maat'
    - 'ORA' → employees.team = 'loondienst'
    
    Priority: HARD CONSTRAINT (is_fixed: true)
    """
    date: date
    dagdeel: Dagdeel  # 'O', 'M', 'A'
    service_id: str  # UUID als string
    team: str = Field(
        description="Team scope: 'TOT' (totaal), 'GRO' (groen/maat), 'ORA' (oranje/loondienst)"
    )  # 'TOT', 'GRO', 'ORA'
    exact_aantal: int = Field(
        alias='aantal',
        ge=0,
        le=9,
        description="Exact aantal medewerkers vereist (0=verboden, >0=exact aantal)"
    )
    is_system_service: bool = Field(
        default=False,
        description="Voor prioritering: systeemdiensten eerst (DIO, DIA, DDO, DDA)"
    )
    
    model_config = ConfigDict(populate_by_name=True)


# ============================================================================
# DRAAD118A: BOTTLENECK ANALYSIS VOOR INFEASIBLE HANDLING
# ============================================================================

class BottleneckItem(BaseModel):
    """DRAAD118A: Per-dienst capacity analysis voor Bottleneck Report.
    
    Analyse van nodig vs beschikbaar per dienst over hele periode.
    """
    service_id: str
    service_code: str
    service_naam: str
    nodig: int = Field(
        description="Totaal benodigde capaciteit (sum over alle date/dagdeel/team)"
    )
    beschikbaar: int = Field(
        description="Totaal beschikbare capaciteit (aantal bevoegde medewerkers × aantal slots)"
    )
    tekort: int = Field(
        description="Capaciteits tekort: max(0, nodig - beschikbaar)"
    )
    tekort_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Tekort als % van benodigde: (tekort / nodig) × 100"
    )
    is_system_service: bool = Field(
        default=False,
        description="DRAAD118A: Kritieke systeemdiensten (DIO/DIA/DDO/DDA) → ROOD in UI"
    )
    severity: Literal["critical", "high", "medium"] = Field(
        description="Prioriteit: CRITICAL=system service of >50% tekort, HIGH=>30%, MEDIUM=rest"
    )


class BottleneckSuggestion(BaseModel):
    """DRAAD118A: Actionable advice voor planner to resolve bottleneck."""
    type: Literal["increase_capability", "reduce_requirement", "hire_temp"] = Field(
        description="Type actie: mogelijkheden uitbreiden, norm verlagen, of temp inhuren"
    )
    service_code: str
    action: str = Field(
        description="Concrete, human-readable actie bijv 'Voeg 3 medewerkers toe aan Echo' of 'Verlaag Ochtend spreekuur van 44 naar 27'"
    )
    impact: str = Field(
        description="Expected impact, bijv 'Dekt 60% van tekort' of 'Lost probleem volledig op'"
    )
    priority: int = Field(
        ge=1,
        le=10,
        description="Prioriteit voor planner: 10=most urgent, 1=nice-to-have"
    )


class BottleneckReport(BaseModel):
    """DRAAD118A: Complete analysis when solver returns INFEASIBLE.
    
    Status 'draft' stays (NOT changed to 'in_progress').
    Frontend shows this report on BottleneckAnalysisScreen with tabel + graphs + suggestions.
    """
    total_capacity_needed: int = Field(
        description="Sum of all nodig values"
    )
    total_capacity_available: int = Field(
        description="Sum of all beschikbaar values"
    )
    total_shortage: int = Field(
        description="Sum of all tekort values = needed - available"
    )
    shortage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="(total_shortage / total_needed) × 100"
    )
    bottlenecks: List[BottleneckItem] = Field(
        description="Per-service analysis, sorted by tekort DESC"
    )
    critical_count: int = Field(
        description="Number of CRITICAL bottlenecks (system services or >50% tekort)"
    )
    suggestions: List[BottleneckSuggestion] = Field(
        description="Actionable recommendations for planner"
    )


# ============================================================================
# SOLVE REQUEST & RESPONSE
# ============================================================================

class SolveRequest(BaseModel):
    """Request body voor solve endpoint.
    
    DRAAD117: Schema cleanup - only pure Solver constraints
    DRAAD105: Gebruikt roster_employee_services ipv employee_services
    DRAAD106: Splitst pre_assignments in fixed, blocked, suggested
    DRAAD108: Voegt exact_staffing toe voor bezetting realiseren
    DRAAD118A: Verwacht bottleneck_report in response bij INFEASIBLE
    DRAAD128: BlockedSlot.status now includes 1 (Fixed assignments)
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
        description="Status 1 (DRAAD128), 2, 3: Status 1=respect, Status 2-3=CANNOT use"
    )
    suggested_assignments: List[SuggestedAssignment] = Field(
        default_factory=list,
        description="Status 0 + service_id: Hints (optioneel)"
    )
    
    # DRAAD108: Nieuwe veld voor exacte bezetting
    exact_staffing: List[ExactStaffing] = Field(
        default_factory=list,
        description="DRAAD108: Exacte bezetting eisen per dienst/dagdeel/team"
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
        description="Bijv: 'bevoegdheid', 'beschikbaarheid'"
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
        description="Bijj: 'add_bevoegdheid', 'hire_zzp'"
    )
    employee_id: Optional[str] = None  # text in database
    employee_name: Optional[str] = None
    action: str = Field(description="Concrete actie die planner kan nemen")
    impact: str = Field(
        description="Verwachte impact van deze suggestie"
    )


class FeasibleSummary(BaseModel):
    """DRAAD118A: Brief summary when solver returns FEASIBLE.
    
    Shown on FeasibleSummaryScreen before entering plan view.
    Status changes to 'in_progress' at this point.
    """
    total_services_scheduled: int = Field(
        description="Number of assignments made by solver"
    )
    coverage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Fill rate: (assignments / total slots) × 100"
    )
    unfilled_slots: int = Field(
        description="Number of available slots without assignment"
    )


class SolveResponse(BaseModel):
    """Response van solve endpoint.
    
    DRAAD118A: CRITICAL CHANGE - Response structure depends on solver_status:
    
    IF FEASIBLE/OPTIMAL:
      - status: 'feasible' / 'optimal'
      - assignments: list of Assignment objects
      - summary: FeasibleSummary with stats
      - bottleneck_report: None or empty
      → Frontend: Show FeasibleSummary, then go to plan view
      → Backend (route.ts): Change rooster status to 'in_progress'
    
    IF INFEASIBLE:
      - status: 'infeasible'
      - assignments: [] (empty - no plan made)
      - summary: None
      - bottleneck_report: BottleneckReport with detailed analysis
      → Frontend: Show BottleneckAnalysisScreen with report
      → Backend (route.ts): Keep rooster status as 'draft' (DO NOT change!)
    
    DRAAD106: Respecteer fixed, blocked, suggested assignments
    DRAAD128: BlockedSlot.status validation now accepts 1, 2, 3
    DRAAD214-FIX: Added missing solver_result field for frontend compatibility
    """
    status: SolveStatus
    roster_id: str  # uuid in database (als string)
    assignments: List[Assignment] = Field(default_factory=list)
    solve_time_seconds: float
    
    # Statistieken
    total_assignments: int = 0
    total_slots: int = 0
    fill_percentage: float = 0.0
    
    # DRAAD118A: NIEUW - Conditioneel veld
    summary: Optional[FeasibleSummary] = Field(
        default=None,
        description="Present only when FEASIBLE/OPTIMAL (not INFEASIBLE)"
    )
    bottleneck_report: Optional[BottleneckReport] = Field(
        default=None,
        description="Present only when INFEASIBLE - full analysis of capacity shortfalls"
    )
    
    # Rapportage (Level 2 + 3)
    violations: List[ConstraintViolation] = Field(default_factory=list)
    suggestions: List[Suggestion] = Field(default_factory=list)
    
    # Metadata
    solver_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extra metadata: objective_value, branches, walltime, etc."
    )
    
    # DRAAD214-FIX: Missing field that frontend expects
    solver_result: Optional[str] = Field(
        default=None,
        description="Which solver was used: 'sequential_v2' or 'cpsat' or None if error"
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
