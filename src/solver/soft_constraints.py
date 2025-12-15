"""DRAAD 182: Soft Constraints Module

Implements 6 soft constraints (SC1-SC6) for V0.2:
- SC1: Voorkeursdiensten (Service Preferences)
- SC2: Gelijkmatige Verdeling (Even Distribution)
- SC3: Minimale Diensten (Minimum Services)
- SC4: Senioriteitsverschillen (Seniority Levels)
- SC5: Team Samenstelling Balance
- SC6: Geen Dubbele Diensten (No Consecutive Duplicates)

Each constraint has:
- priority: 1-10 (1=critical, 10=optional)
- can_relax: boolean (can constraint be relaxed)
- is_fixed: boolean (hard vs soft)
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
from datetime import date

class ConstraintType(Enum):
    """Constraint type classification"""
    HARD = "HARD"
    SOFT = "SOFT"


class PriorityLevel(Enum):
    """Priority levels for soft constraints"""
    CRITICAL = 1
    HIGH = 3
    MEDIUM = 6
    LOW = 10


@dataclass
class SoftConstraintConfig:
    """Configuration for a soft constraint"""
    id: str
    naam: str
    type: str  # employee_limit, team_composition, preference, etc.
    beschrijving: str
    parameters: Dict
    actief: bool = True
    priority: int = 6  # 1-10 scale
    can_relax: bool = True
    is_fixed: bool = False  # False = soft, True = hard
    team: Optional[str] = None  # null = all teams
    created_at: str = ""
    updated_at: str = ""


@dataclass
class SoftConstraintViolation:
    """Record of a constraint violation"""
    id: str
    solver_run_id: str
    constraint_id: str
    constraint_name: str
    constraint_priority: int
    constraint_type: str  # HARD or SOFT
    severity: str  # CRITICAL, ERROR, WARNING, INFO
    employee_id: str
    date: date
    dagdeel: str
    service_id: str
    message: str
    current_value: int
    max_allowed: int
    overage: int
    resolution_action: str  # BLOCKED, RELAXED, ACCEPTED
    resolution_reason: str
    planner_notification: bool = True
    created_at: str = ""


class SoftConstraints:
    """Soft Constraints Manager for V0.2"""

    def __init__(self):
        self.constraints: Dict[str, SoftConstraintConfig] = {}
        self.violations: List[SoftConstraintViolation] = []
        self._initialize_soft_constraints()

    def _initialize_soft_constraints(self):
        """Initialize default soft constraints (SC1-SC6)"""
        
        # SC1: Voorkeursdiensten Per Medewerker
        self.constraints['SC1'] = SoftConstraintConfig(
            id='sc1-service-preferences',
            naam='voorkeursdiensten',
            type='service_preference',
            beschrijving='Medewerker prefereert bepaalde diensten',
            parameters={
                'source': 'employees.service_preferences',
                'action': 'TRY_SCHEDULE',
                'fallback': 'ALLOW_OTHER'
            },
            priority=PriorityLevel.MEDIUM.value,
            can_relax=True,
            team=None
        )

        # SC2: Gelijkmatige Verdeling Over Weken
        self.constraints['SC2'] = SoftConstraintConfig(
            id='sc2-even-distribution',
            naam='gelijkmatige_verdeling',
            type='distribution',
            beschrijving='Diensten verspreid over weken, niet allemaal in 1e week',
            parameters={
                'calculation': 'target_shifts / weeks_in_period',
                'max_deviation': '20%',
                'action': 'TRACK_PER_WEEK'
            },
            priority=PriorityLevel.MEDIUM.value,
            can_relax=True,
            team=None
        )

        # SC3: Minimale Diensten Per Type
        self.constraints['SC3'] = SoftConstraintConfig(
            id='sc3-minimum-services',
            naam='minimale_diensten',
            type='employee_limit',
            beschrijving='Medewerker mag niet MINDER dan X keer dienst Y doen',
            parameters={
                'source': 'roster_employee_services.aantal',
                'bound_type': 'lower_bound',
                'action': 'PREFER_SCHEDULE'
            },
            priority=PriorityLevel.HIGH.value,
            can_relax=False,  # Minimums should not be relaxed
            team=None
        )

        # SC4: Senioriteitsverschillen
        self.constraints['SC4'] = SoftConstraintConfig(
            id='sc4-seniority-levels',
            naam='senioriteitsverschillen',
            type='skill_requirement',
            beschrijving='Senior medewerkers krijgen voorkeur voor bepaalde diensten',
            parameters={
                'source_employee': 'employees.seniority_level',
                'source_service': 'service_types.seniority_required',
                'eligible': 'seniority_level >= required',
                'junior_priority': 'LOWER'
            },
            priority=PriorityLevel.MEDIUM.value,
            can_relax=True,
            team=None
        )

        # SC5: Team Samenstelling Balance
        self.constraints['SC5'] = SoftConstraintConfig(
            id='sc5-team-composition',
            naam='team_samenstelling',
            type='team_composition',
            beschrijving='Per team min/max aantal medewerkers per shift',
            parameters={
                'source': 'planning_constraints.parameters.team_composition',
                'action': 'TRY_BALANCE',
                'fallback': 'ALLOW_IMBALANCE'
            },
            priority=PriorityLevel.LOW.value,
            can_relax=True,
            team=None
        )

        # SC6: Geen Dubbele Diensten
        self.constraints['SC6'] = SoftConstraintConfig(
            id='sc6-no-consecutive-duplicates',
            naam='geen_dubbele_diensten',
            type='sequence_pattern',
            beschrijving='Medewerker liever geen 2 dezelfde diensten achter elkaar',
            parameters={
                'pattern': 'SAME_SERVICE_CONSECUTIVE',
                'action': 'PREFER_ALTERNATE',
                'fallback': 'ALLOW_DUPLICATE'
            },
            priority=PriorityLevel.LOW.value,
            can_relax=True,
            team=None
        )

    def get_constraint(self, constraint_id: str) -> Optional[SoftConstraintConfig]:
        """Retrieve a constraint by ID"""
        return self.constraints.get(constraint_id)

    def check_constraint(self, constraint_id: str, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check if constraint is satisfied
        
        Returns:
            (is_satisfied, violation_reason)
        """
        constraint = self.get_constraint(constraint_id)
        if not constraint or not constraint.actief:
            return True, None
        
        # Implementation specific to each constraint
        checker_method = getattr(self, f'_check_{constraint_id}', None)
        if checker_method:
            return checker_method(data)
        
        return True, None

    def _check_SC1(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC1: Service Preferences"""
        # Get employee preferences from data
        if 'service_preferences' not in data:
            return True, None
        
        preferences = data['service_preferences']
        assigned_service = data.get('assigned_service')
        
        if assigned_service not in preferences:
            return False, f"Service {assigned_service} not in preferences"
        
        preference_level = preferences[assigned_service]
        if preference_level >= 8:  # 8-10 = avoid
            return False, f"Service preference level {preference_level} indicates avoidance"
        
        return True, None

    def _check_SC2(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC2: Even Distribution Over Weeks"""
        if 'shifts_per_week' not in data:
            return True, None
        
        shifts_per_week = data['shifts_per_week']
        target = data.get('target_shifts', 0)
        
        if target == 0:
            return True, None
        
        # Check if any week exceeds 20% deviation
        for week, count in shifts_per_week.items():
            expected = target / len(shifts_per_week)
            deviation = abs(count - expected) / expected if expected > 0 else 0
            if deviation > 0.20:
                return False, f"Week {week}: {deviation*100:.1f}% deviation from target"
        
        return True, None

    def _check_SC3(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC3: Minimum Services"""
        if 'minimum_count' not in data:
            return True, None
        
        minimum = data['minimum_count']
        current = data.get('current_count', 0)
        
        if current < minimum:
            return False, f"Current: {current}, Required minimum: {minimum}"
        
        return True, None

    def _check_SC4(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC4: Seniority Levels"""
        seniority = data.get('seniority_level', 1)
        required = data.get('seniority_required', 1)
        
        if seniority < required:
            return False, f"Seniority {seniority} < required {required}"
        
        # If junior assigned to senior-preferred service, note it
        if seniority == 1 and required >= 3:
            return False, f"Junior assigned to senior-preferred service"
        
        return True, None

    def _check_SC5(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC5: Team Composition Balance"""
        team_size = data.get('team_size', 0)
        min_size = data.get('min_team_size', 1)
        max_size = data.get('max_team_size', 10)
        
        if team_size < min_size or team_size > max_size:
            return False, f"Team size {team_size} outside range [{min_size}, {max_size}]"
        
        return True, None

    def _check_SC6(self, data: Dict) -> Tuple[bool, Optional[str]]:
        """Check SC6: No Consecutive Duplicate Services"""
        assignment_history = data.get('recent_assignments', [])
        proposed_service = data.get('proposed_service')
        
        if not assignment_history:
            return True, None
        
        # Check if last assignment is same service
        if assignment_history[-1] == proposed_service:
            return False, f"Proposed service matches last assignment"
        
        return True, None

    def add_violation(self, violation: SoftConstraintViolation):
        """Log a constraint violation"""
        self.violations.append(violation)

    def get_violations(self, filter_by: Optional[str] = None) -> List[SoftConstraintViolation]:
        """Get violations, optionally filtered by constraint_id"""
        if filter_by:
            return [v for v in self.violations if v.constraint_id == filter_by]
        return self.violations

    def clear_violations(self):
        """Clear violation log"""
        self.violations = []

    def get_constraint_summary(self) -> Dict:
        """Get summary of all constraints"""
        return {
            'total_constraints': len(self.constraints),
            'active_constraints': sum(1 for c in self.constraints.values() if c.actief),
            'by_priority': self._group_by_priority(),
            'by_type': self._group_by_type(),
        }

    def _group_by_priority(self) -> Dict[int, int]:
        """Group constraints by priority"""
        grouped = {}
        for constraint in self.constraints.values():
            p = constraint.priority
            grouped[p] = grouped.get(p, 0) + 1
        return grouped

    def _group_by_type(self) -> Dict[str, int]:
        """Group constraints by type"""
        grouped = {}
        for constraint in self.constraints.values():
            t = constraint.type
            grouped[t] = grouped.get(t, 0) + 1
        return grouped
