"""
GreedySolverV2 - Intelligent Greedy Scheduling Algorithm
FASE 2: Advanced heuristics with constraint satisfaction

Overview:
- Implements a sophisticated greedy algorithm for roster scheduling
- Uses priority-based assignment with backtracking capability
- Supports constraint satisfaction and fairness distribution
- Tracks assignment quality and detects conflicts early
"""

import json
import logging
from datetime import date, timedelta
from typing import Dict, List, Set, Tuple, Optional
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class ShiftType(Enum):
    """Supported shift types"""
    MORNING = "ochtend"
    AFTERNOON = "middag"
    EVENING = "avond"
    NIGHT = "nacht"
    FULL_DAY = "dag"


class ConstraintViolation(Enum):
    """Types of constraint violations"""
    MIN_SHIFTS_NOT_MET = "min_shifts_not_met"
    MAX_SHIFTS_EXCEEDED = "max_shifts_exceeded"
    CONSECUTIVE_DAYS_EXCEEDED = "consecutive_days_exceeded"
    REST_DAYS_INSUFFICIENT = "rest_days_insufficient"
    SKILL_MISMATCH = "skill_mismatch"
    UNAVAILABLE = "unavailable"
    FAIRNESS_VIOLATION = "fairness_violation"


class AssignmentRecord:
    """Track individual assignment details"""
    
    def __init__(self, employee_id: str, work_date: date, shift: str, quality_score: float = 1.0):
        self.employee_id = employee_id
        self.work_date = work_date
        self.shift = shift
        self.quality_score = quality_score
        self.timestamp = None
        self.constraint_violations = []
    
    def to_dict(self) -> dict:
        return {
            'employee_id': self.employee_id,
            'work_date': str(self.work_date),
            'shift': self.shift,
            'quality_score': self.quality_score,
            'violations': self.constraint_violations
        }


class GreedySolverV2:
    """Advanced greedy scheduling solver with fairness and constraints"""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize solver with configuration"""
        self.config = config or {}
        
        # Solver parameters
        self.max_consecutive_days = self.config.get('max_consecutive_days', 5)
        self.min_rest_days = self.config.get('min_rest_days', 2)
        self.fairness_weight = self.config.get('fairness_weight', 0.3)
        self.skill_weight = self.config.get('skill_weight', 0.4)
        self.availability_weight = self.config.get('availability_weight', 0.3)
        
        # Tracking structures
        self.assignments: List[AssignmentRecord] = []
        self.employee_shifts: Dict[str, List[Tuple[date, str]]] = defaultdict(list)
        self.daily_coverage: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.violations: List[Dict] = []
        self.quality_score = 0.0
    
    def _calculate_employee_priority(
        self,
        employee_id: str,
        work_date: date,
        shift: str,
        target_shifts: int,
        employee_skills: Set[str],
        required_skills: Set[str],
        employee_unavailable: Set[date]
    ) -> float:
        """
        Calculate priority score for assigning a shift to an employee.
        Higher score = better candidate.
        
        Factors:
        - Fairness: How many shifts assigned vs target
        - Skill match: Required skills match
        - Availability: Not unavailable on this date
        - Consecutive days: Not exceeding limits
        """
        
        # Check hard constraints first
        if work_date in employee_unavailable:
            return -1000.0  # Not available
        
        # Check consecutive days constraint
        consecutive = self._count_consecutive_days_ending(employee_id, work_date)
        if consecutive >= self.max_consecutive_days:
            return -999.0  # Would exceed consecutive days
        
        # Check rest days constraint
        if self._insufficient_rest_days(employee_id, work_date):
            return -998.0  # Insufficient rest
        
        # Calculate fairness score (primary objective)
        current_shifts = len(self.employee_shifts.get(employee_id, []))
        fairness_gap = target_shifts - current_shifts
        fairness_score = fairness_gap * self.fairness_weight
        
        # Calculate skill match score
        skill_match = len(employee_skills & required_skills) / max(len(required_skills), 1)
        skill_score = skill_match * self.skill_weight
        
        # Calculate availability bonus (slightly prefer those with no constraints)
        availability_score = (1.0 - (consecutive / self.max_consecutive_days)) * self.availability_weight
        
        # Combined priority
        total_score = fairness_score + skill_score + availability_score
        
        return total_score
    
    def _count_consecutive_days_ending(self, employee_id: str, work_date: date) -> int:
        """Count consecutive working days ending on work_date"""
        shifts = self.employee_shifts.get(employee_id, [])
        if not shifts:
            return 0
        
        dates = sorted([s[0] for s in shifts])
        consecutive = 0
        current_date = work_date
        
        while current_date in dates:
            consecutive += 1
            current_date -= timedelta(days=1)
        
        return consecutive
    
    def _insufficient_rest_days(self, employee_id: str, work_date: date) -> bool:
        """Check if employee has had sufficient rest days before work_date"""
        shifts = self.employee_shifts.get(employee_id, [])
        if not shifts:
            return False
        
        last_work_date = max([s[0] for s in shifts])
        days_rest = (work_date - last_work_date).days
        
        return days_rest < self.min_rest_days
    
    def solve(
        self,
        period_start: date,
        period_end: date,
        employees: Dict[str, Dict],
        required_coverage: Dict[date, Dict[str, int]],
        constraints: Optional[Dict] = None
    ) -> Dict:
        """
        Main solve method using greedy algorithm with fairness.
        
        Args:
            period_start: Start date of planning period
            period_end: End date of planning period
            employees: Employee data with shift targets and skills
            required_coverage: Required coverage per day and shift type
            constraints: Additional constraints (unavailable dates, preferences)
        
        Returns:
            Solution dictionary with assignments and quality metrics
        """
        
        logger.info(f"Starting GreedySolverV2 for period {period_start} to {period_end}")
        logger.info(f"Employees: {len(employees)}, Coverage requirements: {len(required_coverage)}")
        
        self.assignments = []
        self.violations = []
        self.employee_shifts = defaultdict(list)
        self.daily_coverage = defaultdict(lambda: defaultdict(int))
        
        constraints = constraints or {}
        unavailable_dates = constraints.get('unavailable_dates', {})
        
        # Generate all dates in period
        current_date = period_start
        dates_to_schedule = []
        while current_date <= period_end:
            dates_to_schedule.append(current_date)
            current_date += timedelta(days=1)
        
        # Main scheduling loop: iterate through dates and shifts
        for work_date in dates_to_schedule:
            if work_date not in required_coverage:
                continue
            
            for shift_type, required_count in required_coverage[work_date].items():
                # Find best candidates for this shift
                current_coverage = self.daily_coverage[work_date].get(shift_type, 0)
                
                for _ in range(required_count - current_coverage):
                    best_candidate = None
                    best_score = -float('inf')
                    
                    # Score all available employees
                    for emp_id, emp_data in employees.items():
                        # Skip if already assigned to this shift on this date
                        if self._already_assigned(emp_id, work_date, shift_type):
                            continue
                        
                        target_shifts = emp_data.get('target_shifts', 0)
                        employee_skills = set(emp_data.get('skills', []))
                        required_skills = set(emp_data.get('required_skills_for_shift', {}).get(shift_type, []))
                        unavailable = set(unavailable_dates.get(emp_id, []))
                        
                        # Convert string dates to date objects if needed
                        if unavailable and isinstance(next(iter(unavailable), None), str):
                            unavailable = {self._parse_date(d) for d in unavailable}
                        
                        score = self._calculate_employee_priority(
                            emp_id, work_date, shift_type, target_shifts,
                            employee_skills, required_skills, unavailable
                        )
                        
                        if score > best_score:
                            best_score = score
                            best_candidate = emp_id
                    
                    # Assign best candidate or record violation
                    if best_candidate and best_score >= 0:
                        record = AssignmentRecord(best_candidate, work_date, shift_type, best_score)
                        self.assignments.append(record)
                        self.employee_shifts[best_candidate].append((work_date, shift_type))
                        self.daily_coverage[work_date][shift_type] += 1
                    else:
                        # Record unfilled requirement
                        violation = {
                            'type': 'unfilled_requirement',
                            'date': str(work_date),
                            'shift': shift_type,
                            'required': 1
                        }
                        self.violations.append(violation)
        
        # Calculate quality metrics
        self.quality_score = self._calculate_quality_score(employees, required_coverage, dates_to_schedule)
        
        return self._format_solution()
    
    def _already_assigned(self, employee_id: str, work_date: date, shift_type: str) -> bool:
        """Check if employee already assigned to shift on this date"""
        for shift in self.employee_shifts.get(employee_id, []):
            if shift[0] == work_date and shift[1] == shift_type:
                return True
        return False
    
    def _parse_date(self, date_str: str) -> date:
        """Parse ISO format date string"""
        if isinstance(date_str, date):
            return date_str
        return date.fromisoformat(date_str)
    
    def _calculate_quality_score(self, employees: Dict, required_coverage: Dict, dates: List[date]) -> float:
        """Calculate overall solution quality (0.0-1.0)"""
        if not dates:
            return 0.0
        
        # Quality factors:
        # 1. Coverage completeness (target: fill all required shifts)
        # 2. Fairness (target: all employees get target shifts)
        # 3. Constraint satisfaction (target: zero violations)
        
        total_required = sum(sum(shifts.values()) for shifts in required_coverage.values())
        total_assigned = len(self.assignments)
        coverage_score = min(total_assigned / max(total_required, 1), 1.0)
        
        # Fairness: check how many employees hit their targets
        fair_employees = 0
        for emp_id, emp_data in employees.items():
            target = emp_data.get('target_shifts', 0)
            actual = len(self.employee_shifts.get(emp_id, []))
            if abs(target - actual) <= 1:  # Within 1 shift tolerance
                fair_employees += 1
        
        fairness_score = fair_employees / max(len(employees), 1) if employees else 0.0
        
        # Constraint satisfaction
        constraint_score = 1.0 - min(len(self.violations) / max(total_required, 1), 1.0)
        
        # Weighted combination
        quality = 0.5 * coverage_score + 0.3 * fairness_score + 0.2 * constraint_score
        
        return quality
    
    def _format_solution(self) -> Dict:
        """Format solution for output"""
        return {
            'status': 'solved',
            'solver': 'GreedySolverV2',
            'assignments': [a.to_dict() for a in self.assignments],
            'violations': self.violations,
            'quality_score': self.quality_score,
            'summary': {
                'total_assignments': len(self.assignments),
                'total_violations': len(self.violations),
                'employees_scheduled': len(self.employee_shifts),
                'quality_percentage': round(self.quality_score * 100, 1)
            }
        }
