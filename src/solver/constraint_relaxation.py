"""DRAAD 182: Constraint Relaxation Module

Manages relaxation of soft constraints based on:
1. Coverage requirements (85%, 95% thresholds)
2. Priority levels (1-10)
3. Explicit can_relax flag
4. Hard vs Soft distinction

Relaxation Stack:
1. HARD constraints (NOOIT relaxen)
2. CRITICAL soft (priority 1-3) - only if coverage < 80%
3. IMPORTANT soft (priority 4-6) - only if coverage < 85%
4. NICE-TO-HAVE (priority 7-10) - always OK to relax
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum
from datetime import datetime


class RelaxationAction(Enum):
    """Actions when constraint cannot be satisfied"""
    BLOCKED = "BLOCKED"  # Cannot relax, must abort
    RELAXED = "RELAXED"  # Constraint relaxed
    ACCEPTED = "ACCEPTED"  # User accepted violation


class CoverageLevel(Enum):
    """Coverage thresholds for relaxation"""
    CRITICAL = 0.80  # Below 80% - relax anything
    HIGH = 0.85      # 80-85% - relax non-critical
    OPTIMAL = 0.95   # 85%+ - strict constraints


@dataclass
class RelaxationDecision:
    """Decision record for a relaxation attempt"""
    constraint_id: str
    constraint_name: str
    is_fixed: bool  # Hard=true, Soft=false
    can_relax: bool
    priority: int  # 1-10
    coverage_rate: float  # 0-100%
    decision: RelaxationAction
    reason: str
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class ConstraintRelaxationManager:
    """Manages constraint relaxation based on priority and coverage"""

    def __init__(self):
        self.decisions: List[RelaxationDecision] = []
        self.relaxation_history: Dict[str, List[RelaxationDecision]] = {}

    def should_relax_constraint(
        self,
        constraint_id: str,
        constraint_name: str,
        is_fixed: bool,
        can_relax: bool,
        priority: int,
        coverage_rate: float
    ) -> Tuple[bool, RelaxationDecision]:
        """Determine if constraint should be relaxed
        
        Args:
            constraint_id: Unique constraint ID
            constraint_name: Human-readable name
            is_fixed: True=HARD, False=SOFT
            can_relax: Explicitly allowed to relax
            priority: 1-10 (1=critical, 10=optional)
            coverage_rate: Current coverage 0-1 (e.g., 0.95 = 95%)
        
        Returns:
            (should_relax, decision_record)
        """
        
        # Step 1: Check if HARD constraint
        if is_fixed:
            decision = RelaxationDecision(
                constraint_id=constraint_id,
                constraint_name=constraint_name,
                is_fixed=is_fixed,
                can_relax=can_relax,
                priority=priority,
                coverage_rate=coverage_rate,
                decision=RelaxationAction.BLOCKED,
                reason="HARD constraint - NOOIT relaxen"
            )
            self._record_decision(constraint_id, decision)
            return False, decision

        # Step 2: Check explicit can_relax flag
        if not can_relax:
            decision = RelaxationDecision(
                constraint_id=constraint_id,
                constraint_name=constraint_name,
                is_fixed=is_fixed,
                can_relax=can_relax,
                priority=priority,
                coverage_rate=coverage_rate,
                decision=RelaxationAction.BLOCKED,
                reason="Constraint marked as non-relaxable"
            )
            self._record_decision(constraint_id, decision)
            return False, decision

        # Step 3: Apply relaxation priority stack
        should_relax, reason = self._apply_relaxation_stack(
            priority=priority,
            coverage_rate=coverage_rate
        )

        action = RelaxationAction.RELAXED if should_relax else RelaxationAction.BLOCKED
        decision = RelaxationDecision(
            constraint_id=constraint_id,
            constraint_name=constraint_name,
            is_fixed=is_fixed,
            can_relax=can_relax,
            priority=priority,
            coverage_rate=coverage_rate,
            decision=action,
            reason=reason
        )
        self._record_decision(constraint_id, decision)
        return should_relax, decision

    def _apply_relaxation_stack(
        self,
        priority: int,
        coverage_rate: float
    ) -> Tuple[bool, str]:
        """Apply the relaxation priority stack
        
        Priority Stack:
        1. CRITICAL (1-3): only relax if coverage < 80%
        2. IMPORTANT (4-6): only relax if coverage < 85%
        3. NICE-TO-HAVE (7-10): always OK to relax
        """
        
        # CRITICAL soft constraints (priority 1-3)
        if priority <= 3:
            if coverage_rate < CoverageLevel.CRITICAL.value:
                return True, f"Coverage {coverage_rate*100:.1f}% < 80% threshold for CRITICAL constraint"
            else:
                return False, f"Coverage {coverage_rate*100:.1f}% >= 80%, cannot relax CRITICAL constraint"
        
        # IMPORTANT soft constraints (priority 4-6)
        elif priority <= 6:
            if coverage_rate < CoverageLevel.HIGH.value:
                return True, f"Coverage {coverage_rate*100:.1f}% < 85% threshold for IMPORTANT constraint"
            else:
                return False, f"Coverage {coverage_rate*100:.1f}% >= 85%, cannot relax IMPORTANT constraint"
        
        # NICE-TO-HAVE constraints (priority 7-10)
        else:
            return True, f"Priority {priority} is NICE-TO-HAVE, always OK to relax"

    def _record_decision(self, constraint_id: str, decision: RelaxationDecision):
        """Record a relaxation decision"""
        self.decisions.append(decision)
        
        if constraint_id not in self.relaxation_history:
            self.relaxation_history[constraint_id] = []
        self.relaxation_history[constraint_id].append(decision)

    def get_relaxation_summary(self) -> Dict:
        """Get summary of all relaxation decisions"""
        if not self.decisions:
            return {
                'total_decisions': 0,
                'relaxed': 0,
                'blocked': 0,
                'by_action': {}
            }

        by_action = {}
        for decision in self.decisions:
            action_name = decision.decision.value
            by_action[action_name] = by_action.get(action_name, 0) + 1

        return {
            'total_decisions': len(self.decisions),
            'relaxed': sum(1 for d in self.decisions if d.decision == RelaxationAction.RELAXED),
            'blocked': sum(1 for d in self.decisions if d.decision == RelaxationAction.BLOCKED),
            'by_action': by_action,
            'by_priority': self._summary_by_priority(),
            'coverage_stats': self._coverage_statistics()
        }

    def _summary_by_priority(self) -> Dict[int, Dict]:
        """Summarize decisions by priority"""
        summary = {}
        for decision in self.decisions:
            p = decision.priority
            if p not in summary:
                summary[p] = {'total': 0, 'relaxed': 0, 'blocked': 0}
            
            summary[p]['total'] += 1
            if decision.decision == RelaxationAction.RELAXED:
                summary[p]['relaxed'] += 1
            else:
                summary[p]['blocked'] += 1
        
        return summary

    def _coverage_statistics(self) -> Dict:
        """Statistics on coverage rates seen"""
        if not self.decisions:
            return {}
        
        coverage_rates = [d.coverage_rate for d in self.decisions]
        return {
            'min': min(coverage_rates),
            'max': max(coverage_rates),
            'avg': sum(coverage_rates) / len(coverage_rates),
            'below_80': sum(1 for c in coverage_rates if c < 0.80),
            'below_85': sum(1 for c in coverage_rates if c < 0.85),
            'above_95': sum(1 for c in coverage_rates if c >= 0.95)
        }

    def get_constraint_relaxation_history(self, constraint_id: str) -> List[RelaxationDecision]:
        """Get history of relaxation attempts for a constraint"""
        return self.relaxation_history.get(constraint_id, [])

    def clear_history(self):
        """Clear all relaxation history"""
        self.decisions = []
        self.relaxation_history = {}


class PlannerFlexibilityOptions:
    """Planner flexibility options after solver run"""

    @staticmethod
    def option_a_ignore_violations(violations: List, planner_notes: str = "") -> Dict:
        """Option A: Ignore Soft Violations
        
        Planner: "Ik ga akkoord met deze soft constraint violations"
        Result:
        - Rooster accepted as-is
        - Violations logged
        - No re-solve needed
        """
        return {
            'action': 'IGNORE_SOFT_VIOLATIONS',
            'violations_count': len(violations),
            'planner_notes': planner_notes,
            'rooster_status': 'ACCEPTED_WITH_VIOLATIONS',
            'requires_resolve': False
        }

    @staticmethod
    def option_b_adjust_priorities(priority_adjustments: Dict[str, int]) -> Dict:
        """Option B: Adjust Priorities & Re-Solve
        
        Planner: "Team composition is less important this week"
        Action:
        - Adjust priority (e.g., team_balance from 5 to 8)
        - Re-run greedy engine
        - New result with adjusted priorities
        """
        return {
            'action': 'ADJUST_PRIORITIES_RESOLVE',
            'adjustments': priority_adjustments,
            'rooster_status': 'PENDING_RESOLVE',
            'requires_resolve': True
        }

    @staticmethod
    def option_c_manual_override(assignments: List[Dict]) -> Dict:
        """Option C: Manually Override Assignment
        
        Planner: "I want this specific assignment anyway"
        Action:
        - Manual assignment in UI
        - Mark as 'locked' (protected)
        - Greedy respects protected assignments
        """
        return {
            'action': 'MANUAL_OVERRIDE',
            'manual_assignments': len(assignments),
            'rooster_status': 'MANUALLY_ADJUSTED',
            'requires_resolve': False
        }

    @staticmethod
    def option_d_relax_constraint(constraint_id: str, reason: str) -> Dict:
        """Option D: Relax Specific Constraint
        
        Planner: "Ignore max_shifts for this roster"
        Action:
        - Disable constraint in roster_planning_constraints
        - is_active = false
        - Re-run greedy
        - New result without that constraint
        """
        return {
            'action': 'RELAX_CONSTRAINT',
            'constraint_id': constraint_id,
            'reason': reason,
            'rooster_status': 'CONSTRAINT_RELAXED',
            'requires_resolve': True
        }
