"""
ConstraintValidator - Validates roster solutions against constraints
FASE 2: Comprehensive constraint checking and violation reporting

Supported Constraints:
- Hard constraints: Must be satisfied (availability, skills)
- Soft constraints: Preferably satisfied (fairness, rest days)
- Coverage constraints: Minimum/maximum staffing levels
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Set, Tuple, Optional
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


class ConstraintType(Enum):
    """Types of constraints"""
    HARD = "hard"  # Must be satisfied
    SOFT = "soft"  # Preferably satisfied
    COVERAGE = "coverage"  # Staffing level


class ViolationSeverity(Enum):
    """Severity levels for violations"""
    CRITICAL = "critical"  # Hard constraint violated
    WARNING = "warning"  # Soft constraint violated
    INFO = "info"  # Minor issue


class ConstraintViolationRecord:
    """Record of a single constraint violation"""
    
    def __init__(
        self,
        constraint_type: str,
        severity: str,
        message: str,
        employee_id: Optional[str] = None,
        work_date: Optional[date] = None,
        shift: Optional[str] = None
    ):
        self.constraint_type = constraint_type
        self.severity = severity
        self.message = message
        self.employee_id = employee_id
        self.work_date = work_date
        self.shift = shift
    
    def to_dict(self) -> dict:
        return {
            'constraint_type': self.constraint_type,
            'severity': self.severity,
            'message': self.message,
            'employee_id': self.employee_id,
            'work_date': str(self.work_date) if self.work_date else None,
            'shift': self.shift
        }


class ConstraintValidator:
    """Validates roster solutions against all constraints"""
    
    def __init__(self):
        """Initialize validator"""
        self.violations: List[ConstraintViolationRecord] = []
        self.hard_violations = 0
        self.soft_violations = 0
    
    def validate(
        self,
        solution: Dict,
        employees: Dict[str, Dict],
        required_coverage: Dict[date, Dict[str, int]],
        constraints: Dict,
        period_start: date,
        period_end: date
    ) -> Dict:
        """
        Comprehensive validation of roster solution.
        
        Args:
            solution: Proposed solution from solver
            employees: Employee master data
            required_coverage: Required staffing levels
            constraints: Constraint specifications
            period_start: Period start date
            period_end: Period end date
        
        Returns:
            Validation report
        """
        
        logger.info("Starting comprehensive solution validation")
        self.violations = []
        self.hard_violations = 0
        self.soft_violations = 0
        
        # Parse solution into assignments
        assignments = solution.get('assignments', [])
        assignment_map = self._parse_assignments(assignments)
        
        # Run all validators
        self._validate_hard_constraints(assignment_map, employees, constraints, period_start, period_end)
        self._validate_soft_constraints(assignment_map, employees, constraints, period_start, period_end)
        self._validate_coverage(assignment_map, required_coverage, period_start, period_end)
        self._validate_fairness(assignment_map, employees)
        
        return self._format_report(len(assignments))
    
    def _parse_assignments(self, assignments: List[Dict]) -> Dict[str, List[Tuple]]:
        """Parse assignments into employee-centric format"""
        assignment_map = defaultdict(list)
        
        for assignment in assignments:
            emp_id = assignment.get('employee_id')
            work_date_str = assignment.get('work_date')
            shift = assignment.get('shift')
            
            if emp_id and work_date_str:
                work_date = date.fromisoformat(work_date_str) if isinstance(work_date_str, str) else work_date_str
                assignment_map[emp_id].append((work_date, shift))
        
        return assignment_map
    
    def _validate_hard_constraints(
        self,
        assignment_map: Dict,
        employees: Dict,
        constraints: Dict,
        period_start: date,
        period_end: date
    ) -> None:
        """
        Validate hard constraints (availability, skills).
        Violations are critical.
        """
        
        unavailable_dates = constraints.get('unavailable_dates', {})
        required_skills = constraints.get('required_skills_by_shift', {})
        
        for emp_id, shifts in assignment_map.items():
            emp_data = employees.get(emp_id, {})
            emp_skills = set(emp_data.get('skills', []))
            
            for work_date, shift in shifts:
                # Check availability
                unavailable = set(unavailable_dates.get(emp_id, []))
                if unavailable and isinstance(next(iter(unavailable), None), str):
                    unavailable = {date.fromisoformat(d) for d in unavailable}
                
                if work_date in unavailable:
                    violation = ConstraintViolationRecord(
                        constraint_type='availability',
                        severity='critical',
                        message=f"Employee assigned on unavailable date",
                        employee_id=emp_id,
                        work_date=work_date,
                        shift=shift
                    )
                    self.violations.append(violation)
                    self.hard_violations += 1
                
                # Check required skills
                shift_skills = set(required_skills.get(shift, []))
                if shift_skills and not (emp_skills & shift_skills):
                    violation = ConstraintViolationRecord(
                        constraint_type='skill_mismatch',
                        severity='critical',
                        message=f"Employee lacks required skills for shift",
                        employee_id=emp_id,
                        work_date=work_date,
                        shift=shift
                    )
                    self.violations.append(violation)
                    self.hard_violations += 1
    
    def _validate_soft_constraints(
        self,
        assignment_map: Dict,
        employees: Dict,
        constraints: Dict,
        period_start: date,
        period_end: date
    ) -> None:
        """
        Validate soft constraints (rest days, consecutive days).
        Violations are warnings.
        """
        
        max_consecutive = constraints.get('max_consecutive_days', 5)
        min_rest = constraints.get('min_rest_days', 2)
        
        for emp_id, shifts in assignment_map.items():
            sorted_shifts = sorted(shifts, key=lambda x: x[0])
            
            # Check consecutive days
            consecutive_count = 1
            for i in range(1, len(sorted_shifts)):
                prev_date = sorted_shifts[i-1][0]
                curr_date = sorted_shifts[i][0]
                
                if (curr_date - prev_date).days == 1:
                    consecutive_count += 1
                    if consecutive_count > max_consecutive:
                        violation = ConstraintViolationRecord(
                            constraint_type='consecutive_days',
                            severity='warning',
                            message=f"Exceeds max {max_consecutive} consecutive days",
                            employee_id=emp_id,
                            work_date=curr_date
                        )
                        self.violations.append(violation)
                        self.soft_violations += 1
                else:
                    days_rest = (curr_date - prev_date).days - 1
                    if days_rest < min_rest:
                        violation = ConstraintViolationRecord(
                            constraint_type='rest_days',
                            severity='warning',
                            message=f"Insufficient rest days (need {min_rest}, got {days_rest})",
                            employee_id=emp_id,
                            work_date=curr_date
                        )
                        self.violations.append(violation)
                        self.soft_violations += 1
                    
                    consecutive_count = 1
    
    def _validate_coverage(
        self,
        assignment_map: Dict,
        required_coverage: Dict,
        period_start: date,
        period_end: date
    ) -> None:
        """
        Validate coverage requirements (minimum staffing).
        """
        
        # Count actual coverage
        actual_coverage = defaultdict(lambda: defaultdict(int))
        for emp_id, shifts in assignment_map.items():
            for work_date, shift in shifts:
                actual_coverage[work_date][shift] += 1
        
        # Check against requirements
        for work_date, required_shifts in required_coverage.items():
            if work_date < period_start or work_date > period_end:
                continue
            
            for shift, required_count in required_shifts.items():
                actual_count = actual_coverage[work_date].get(shift, 0)
                
                if actual_count < required_count:
                    violation = ConstraintViolationRecord(
                        constraint_type='understaffed',
                        severity='warning',
                        message=f"Understaffed: need {required_count}, have {actual_count}",
                        work_date=work_date,
                        shift=shift
                    )
                    self.violations.append(violation)
                    self.soft_violations += 1
                
                elif actual_count > required_count:
                    violation = ConstraintViolationRecord(
                        constraint_type='overstaffed',
                        severity='info',
                        message=f"Overstaffed: need {required_count}, have {actual_count}",
                        work_date=work_date,
                        shift=shift
                    )
                    self.violations.append(violation)
    
    def _validate_fairness(self, assignment_map: Dict, employees: Dict) -> None:
        """
        Validate fairness: employees receive approximately equal shifts.
        """
        
        if not employees:
            return
        
        shift_counts = {emp_id: len(shifts) for emp_id, shifts in assignment_map.items()}
        
        for emp_id, emp_data in employees.items():
            target = emp_data.get('target_shifts', 0)
            actual = shift_counts.get(emp_id, 0)
            
            # Allow 1-shift tolerance
            if actual < target - 1:
                violation = ConstraintViolationRecord(
                    constraint_type='under_target',
                    severity='warning',
                    message=f"Below target: need {target}, assigned {actual}",
                    employee_id=emp_id
                )
                self.violations.append(violation)
                self.soft_violations += 1
            
            elif actual > target + 1:
                violation = ConstraintViolationRecord(
                    constraint_type='over_target',
                    severity='info',
                    message=f"Above target: need {target}, assigned {actual}",
                    employee_id=emp_id
                )
                self.violations.append(violation)
    
    def _format_report(self, total_assignments: int) -> Dict:
        """Format validation report"""
        
        violations_by_type = defaultdict(list)
        for v in self.violations:
            violations_by_type[v.constraint_type].append(v.to_dict())
        
        is_valid = self.hard_violations == 0
        
        return {
            'valid': is_valid,
            'total_violations': len(self.violations),
            'critical_violations': self.hard_violations,
            'warning_violations': self.soft_violations,
            'total_assignments': total_assignments,
            'violations_by_type': dict(violations_by_type),
            'violations': [v.to_dict() for v in self.violations],
            'summary': {
                'status': 'valid' if is_valid else 'invalid',
                'hard_constraints_met': self.hard_violations == 0,
                'soft_constraints_met': self.soft_violations == 0,
                'total_checks': len(self.violations) + (total_assignments if total_assignments else 1)
            }
        }
