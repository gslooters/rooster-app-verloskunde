"""OR-Tools Solver Service

FastAPI service die rooster optimalisatie uitvoert met Google OR-Tools CP-SAT solver.
Integratie met Next.js app via REST API.

Authors: Rooster App Team
Version: 1.0.0
Date: 2025-12-05
DRAAD105: Gebruikt roster_employee_services met aantal en actief velden
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal
from datetime import datetime, timedelta
import logging

# OR-Tools imports
from ortools.sat.python import cp_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Rooster Solver Service",
    description="OR-Tools CP-SAT solver voor roosteroptimalisatie",
    version="1.0.0"
)

# CORS middleware (accept Next.js app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In productie: specificeer Next.js URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# PYDANTIC MODELS (komen overeen met TypeScript types)
# ============================================================================

class Employee(BaseModel):
    id: int
    name: str
    team: Literal['maat', 'loondienst', 'overig']
    structureel_nbh: Optional[Dict[str, List[str]]] = None  # {"ma": ["O", "M"]}
    max_werkdagen: Optional[int] = None
    min_werkdagen: Optional[int] = None


class Service(BaseModel):
    id: int
    code: str
    naam: str
    # DRAAD100C: is_nachtdienst removed (field does not exist in DB)


# LEGACY - Vervangen door RosterEmployeeService (DRAAD105)
class EmployeeService(BaseModel):
    employee_id: int
    service_id: int


# DRAAD105: RosterEmployeeService met aantal en actief
class RosterEmployeeService(BaseModel):
    roster_id: int
    employee_id: int
    service_id: int
    aantal: int = Field(ge=0, description="Streefgetal (0=ZZP/reserve)")
    actief: bool = Field(default=True, description="Alleen TRUE mag toegewezen worden")


class PreAssignment(BaseModel):
    employee_id: int
    date: str  # ISO date
    dagdeel: Literal['O', 'M', 'A']
    service_id: int
    status: int


class SolveRequest(BaseModel):
    roster_id: int
    start_date: str
    end_date: str
    employees: List[Employee]
    services: List[Service]
    roster_employee_services: List[RosterEmployeeService]  # DRAAD105: renamed
    pre_assignments: List[PreAssignment]
    timeout_seconds: int = Field(default=30, ge=1, le=300)


class Assignment(BaseModel):
    employee_id: int
    employee_name: str
    date: str
    dagdeel: Literal['O', 'M', 'A']
    service_id: int
    service_code: str
    confidence: float = Field(ge=0.0, le=1.0)


class ConstraintViolation(BaseModel):
    constraint_type: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    date: Optional[str] = None
    dagdeel: Optional[str] = None
    service_id: Optional[int] = None
    message: str
    severity: Literal['critical', 'warning', 'info']


class Suggestion(BaseModel):
    type: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    action: str
    impact: str


class SolveResponse(BaseModel):
    status: Literal['optimal', 'feasible', 'infeasible', 'timeout', 'error']
    roster_id: int
    assignments: List[Assignment]
    solve_time_seconds: float
    total_assignments: int
    total_slots: int
    fill_percentage: float
    violations: List[ConstraintViolation]
    suggestions: List[Suggestion]
    solver_metadata: Dict


# ============================================================================
# HEALTH CHECK ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Health check root endpoint"""
    return {
        "service": "Rooster Solver Service",
        "status": "online",
        "version": "1.0.0",
        "solver": "Google OR-Tools CP-SAT"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "ortools_available": True
    }


# ============================================================================
# SOLVER ENDPOINT
# ============================================================================

@app.post("/api/v1/solve-schedule", response_model=SolveResponse)
async def solve_schedule(request: SolveRequest):
    """
    Solve rooster met OR-Tools CP-SAT solver.
    
    DRAAD105: Implementeert bevoegdheden via roster_employee_services.
    Alleen actief=TRUE bevoegdheden mogen worden toegewezen.
    
    Implementeert CORE 3 constraints:
    1. Max werkdagen per week
    2. Structureel NBH
    3. Service bevoegdheid (met actief check)
    """
    start_time = datetime.now()
    
    try:
        logger.info(f"[Solver] Start solving roster {request.roster_id}")
        logger.info(f"[Solver] Periode: {request.start_date} - {request.end_date}")
        logger.info(f"[Solver] {len(request.employees)} medewerkers, {len(request.services)} diensten")
        logger.info(f"[Solver] {len(request.roster_employee_services)} actieve bevoegdheden")
        
        # Parse dates
        start_date = datetime.fromisoformat(request.start_date)
        end_date = datetime.fromisoformat(request.end_date)
        
        # Generate date range
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date.date())
            current_date += timedelta(days=1)
        
        logger.info(f"[Solver] {len(date_range)} dagen te plannen")
        
        # Create CP-SAT model
        model = cp_model.CpModel()
        
        # ================================================================
        # VARIABLES: assignment[employee, date, dagdeel, service]
        # ================================================================
        dagdelen = ['O', 'M', 'A']
        assignments = {}
        
        for emp in request.employees:
            for date in date_range:
                for dagdeel in dagdelen:
                    for svc in request.services:
                        var_name = f"assign_{emp.id}_{date}_{dagdeel}_{svc.id}"
                        assignments[(emp.id, date, dagdeel, svc.id)] = model.new_bool_var(var_name)
        
        logger.info(f"[Solver] {len(assignments)} decision variables created")
        
        # ================================================================
        # CONSTRAINT 1: Eén dienst per medewerker per dagdeel
        # ================================================================
        for emp in request.employees:
            for date in date_range:
                for dagdeel in dagdelen:
                    # Check if pre-assigned
                    pre_assigned = any(
                        pa.employee_id == emp.id and 
                        pa.date == str(date) and 
                        pa.dagdeel == dagdeel and
                        pa.status > 0
                        for pa in request.pre_assignments
                    )
                    
                    if not pre_assigned:
                        # Max 1 dienst per dagdeel
                        model.add_at_most_one([
                            assignments[(emp.id, date, dagdeel, svc.id)]
                            for svc in request.services
                        ])
        
        logger.info("[Solver] Constraint 1: Eén dienst per dagdeel - added")
        
        # ================================================================
        # CONSTRAINT 2: Service bevoegdheid (DRAAD105)
        # ================================================================
        # DRAAD105: Gebruik roster_employee_services met actief=TRUE filter
        # Medewerker mag alleen diensten doen waarvoor bevoegd EN actief=TRUE
        bevoegdheden = {}
        for res in request.roster_employee_services:
            # DRAAD105: Check actief=TRUE (harde eis)
            if res.actief:
                if res.employee_id not in bevoegdheden:
                    bevoegdheden[res.employee_id] = []
                bevoegdheden[res.employee_id].append(res.service_id)
        
        for emp in request.employees:
            emp_services = bevoegdheden.get(emp.id, [])
            for date in date_range:
                for dagdeel in dagdelen:
                    for svc in request.services:
                        if svc.id not in emp_services:
                            # Niet bevoegd OF niet actief -> mag niet assigned worden
                            model.add(assignments[(emp.id, date, dagdeel, svc.id)] == 0)
        
        logger.info(f"[Solver] Constraint 2: Service bevoegdheid (actief=TRUE) - {len(bevoegdheden)} employees met bevoegdheden")
        
        # ================================================================
        # CONSTRAINT 3: Pre-assignments (status > 0)
        # ================================================================
        pre_count = 0
        for pa in request.pre_assignments:
            try:
                pa_date = datetime.fromisoformat(pa.date).date()
                if pa_date in date_range:
                    # Force deze assignment
                    model.add(assignments[(pa.employee_id, pa_date, pa.dagdeel, pa.service_id)] == 1)
                    pre_count += 1
            except Exception as e:
                logger.warning(f"[Solver] Pre-assignment parse error: {e}")
        
        logger.info(f"[Solver] Constraint 3: {pre_count} pre-assignments fixed")
        
        # ================================================================
        # CONSTRAINT 4: Max werkdagen per week (CORE 3)
        # ================================================================
        for emp in request.employees:
            if emp.max_werkdagen:
                # Bepaal weken in periode
                week_starts = []
                current = start_date
                while current <= end_date:
                    # Maandag van week
                    monday = current - timedelta(days=current.weekday())
                    if monday.date() not in week_starts:
                        week_starts.append(monday.date())
                    current += timedelta(days=7)
                
                # Voor elke week: max X werkdagen
                for week_start in week_starts:
                    week_dates = [
                        week_start + timedelta(days=i)
                        for i in range(7)
                        if week_start + timedelta(days=i) in date_range
                    ]
                    
                    # Tel dagen met MINSTENS 1 dienst
                    day_worked_vars = []
                    for date in week_dates:
                        # Boolean: heeft deze dag minstens 1 dienst?
                        day_worked = model.new_bool_var(f"worked_{emp.id}_{date}")
                        
                        # day_worked == 1 als ER MINSTENS 1 dienst is die dag
                        all_assignments_day = [
                            assignments[(emp.id, date, dagdeel, svc.id)]
                            for dagdeel in dagdelen
                            for svc in request.services
                        ]
                        model.add_max_equality(day_worked, all_assignments_day)
                        day_worked_vars.append(day_worked)
                    
                    # Som van gewerkte dagen <= max_werkdagen
                    if day_worked_vars:
                        model.add(sum(day_worked_vars) <= emp.max_werkdagen)
        
        logger.info("[Solver] Constraint 4: Max werkdagen per week - added")
        
        # ================================================================
        # CONSTRAINT 5: Structureel NBH (CORE 3)
        # ================================================================
        for emp in request.employees:
            if emp.structureel_nbh:
                for date in date_range:
                    weekday_nl = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'][date.weekday()]
                    
                    if weekday_nl in emp.structureel_nbh:
                        blocked_dagdelen = emp.structureel_nbh[weekday_nl]
                        
                        for dagdeel in blocked_dagdelen:
                            # Deze dagdeel is NBH -> mag GEEN diensten
                            for svc in request.services:
                                model.add(assignments[(emp.id, date, dagdeel, svc.id)] == 0)
        
        logger.info("[Solver] Constraint 5: Structureel NBH - added")
        
        # ================================================================
        # OBJECTIVE: Maximize aantal assignments
        # ================================================================
        objective_vars = []
        for emp in request.employees:
            for date in date_range:
                for dagdeel in dagdelen:
                    for svc in request.services:
                        objective_vars.append(assignments[(emp.id, date, dagdeel, svc.id)])
        
        model.maximize(sum(objective_vars))
        
        logger.info("[Solver] Objective: Maximize assignments")
        
        # ================================================================
        # SOLVE
        # ================================================================
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = request.timeout_seconds
        solver.parameters.log_search_progress = True
        
        logger.info(f"[Solver] Starting CP-SAT solver (timeout: {request.timeout_seconds}s)...")
        status = solver.solve(model)
        
        solve_time = (datetime.now() - start_time).total_seconds()
        
        # ================================================================
        # EXTRACT SOLUTION
        # ================================================================
        result_assignments = []
        violations = []
        suggestions = []
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            logger.info(f"[Solver] Solution found: {'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE'}")
            
            # Extract assignments
            for emp in request.employees:
                for date in date_range:
                    for dagdeel in dagdelen:
                        for svc in request.services:
                            if solver.value(assignments[(emp.id, date, dagdeel, svc.id)]) == 1:
                                result_assignments.append(Assignment(
                                    employee_id=emp.id,
                                    employee_name=emp.name,
                                    date=str(date),
                                    dagdeel=dagdeel,
                                    service_id=svc.id,
                                    service_code=svc.code,
                                    confidence=1.0 if status == cp_model.OPTIMAL else 0.8
                                ))
            
            status_str = 'optimal' if status == cp_model.OPTIMAL else 'feasible'
        
        elif status == cp_model.INFEASIBLE:
            logger.warning("[Solver] INFEASIBLE - no solution possible")
            status_str = 'infeasible'
            violations.append(ConstraintViolation(
                constraint_type="infeasibility",
                message="Geen oplossing mogelijk met huidige constraints",
                severity="critical"
            ))
        
        else:
            logger.warning(f"[Solver] Status: {status}")
            status_str = 'timeout' if status == cp_model.UNKNOWN else 'error'
        
        # ================================================================
        # STATISTICS
        # ================================================================
        total_slots = len(request.employees) * len(date_range) * len(dagdelen)
        total_assignments = len(result_assignments)
        fill_percentage = (total_assignments / total_slots * 100) if total_slots > 0 else 0.0
        
        logger.info(f"[Solver] Completed in {solve_time:.2f}s")
        logger.info(f"[Solver] Assignments: {total_assignments}/{total_slots} ({fill_percentage:.1f}%)")
        
        return SolveResponse(
            status=status_str,
            roster_id=request.roster_id,
            assignments=result_assignments,
            solve_time_seconds=round(solve_time, 3),
            total_assignments=total_assignments,
            total_slots=total_slots,
            fill_percentage=round(fill_percentage, 2),
            violations=violations,
            suggestions=suggestions,
            solver_metadata={
                "solver": "CP-SAT",
                "ortools_status": str(status),
                "variables": len(assignments),
                "timeout_seconds": request.timeout_seconds
            }
        )
    
    except Exception as e:
        logger.error(f"[Solver] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
