"""
FASE 3: Pairing Logic Implementation
DIO/DDO Pairing Blocking and Consecutive Days Management

This module implements the intelligent pairing logic for DIO (Diensten Informatie Opslag)
and DDO (Diensten Directe Opvolging) constraints.

Key responsibilities:
1. Detect DIO/DDO service combinations (e.g., DIO followed by DDO next day)
2. Block conflicting subsequent shifts when pairing detected
3. Manage blocking calendar (status=2 in roster_assignments)
4. Provide fairness-aware pairing suggestions
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Set, Tuple, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class PairingRule:
    """Define a pairing rule between two service types"""
    
    def __init__(
        self,
        service_id_first: str,
        service_code_first: str,
        service_id_second: str,
        service_code_second: str,
        block_type: str = "hard",
        description: str = ""
    ):
        """
        Initialize a pairing rule.
        
        Args:
            service_id_first: UUID of first service (e.g., DIO)
            service_code_first: Code of first service
            service_id_second: UUID of second service (e.g., DDO)
            service_code_second: Code of second service
            block_type: "hard" (cannot pair), "soft" (discourage pairing)
            description: Human-readable description
        """
        self.service_id_first = service_id_first
        self.service_code_first = service_code_first
        self.service_id_second = service_id_second
        self.service_code_second = service_code_second
        self.block_type = block_type
        self.description = description
    
    def matches(self, code_first: str, code_second: str) -> bool:
        """Check if rule matches given service codes"""
        return (
            code_first == self.service_code_first and
            code_second == self.service_code_second
        )
    
    def __repr__(self) -> str:
        return f"PairingRule({self.service_code_first} → {self.service_code_second}, {self.block_type})"


class BlockingCalendar:
    """Manage blocked slots (status=2 assignments)"""
    
    def __init__(self):
        """Initialize blocking calendar"""
        self.blocked_slots: Set[Tuple[str, str, str]] = set()
        # blocked_slots: {(date_str, dagdeel, employee_id), ...}
        
        self.blocking_reasons: Dict[Tuple[str, str, str], Dict] = {}
        # blocking_reasons[(date_str, dagdeel, employee_id)] = {
        #   "reason": "DIO/DDO pairing",
        #   "previous_date": "2025-12-25",
        #   "previous_dagdeel": "O",
        #   "previous_service_code": "DIO"
        # }
    
    def block_slot(
        self,
        work_date: date,
        dagdeel: str,
        employee_id: str,
        reason: str,
        previous_date: Optional[date] = None,
        previous_dagdeel: Optional[str] = None,
        previous_service_code: Optional[str] = None
    ) -> None:
        """
        Block a slot (mark status=2).
        
        Args:
            work_date: Date to block
            dagdeel: Shift part (O/M/A)
            employee_id: Employee to block
            reason: Reason for blocking (e.g., "DIO/DDO pairing")
            previous_date: Date of previous assignment
            previous_dagdeel: Shift part of previous assignment
            previous_service_code: Service code of previous assignment
        """
        key = (str(work_date), dagdeel, employee_id)
        self.blocked_slots.add(key)
        
        self.blocking_reasons[key] = {
            "reason": reason,
            "previous_date": str(previous_date) if previous_date else None,
            "previous_dagdeel": previous_dagdeel,
            "previous_service_code": previous_service_code,
            "blocked_at": str(date.today())
        }
        
        logger.debug(f"Blocked: {employee_id} on {work_date} {dagdeel} ({reason})")
    
    def is_blocked(self, work_date: date, dagdeel: str, employee_id: str) -> bool:
        """Check if slot is blocked"""
        key = (str(work_date), dagdeel, employee_id)
        return key in self.blocked_slots
    
    def get_blocking_reason(self, work_date: date, dagdeel: str, employee_id: str) -> Optional[Dict]:
        """Get reason for blocking"""
        key = (str(work_date), dagdeel, employee_id)
        return self.blocking_reasons.get(key)
    
    def clear_employee_blocks(self, employee_id: str) -> None:
        """Clear all blocks for an employee (e.g., when rescheduling)"""
        keys_to_remove = [k for k in self.blocked_slots if k[2] == employee_id]
        for key in keys_to_remove:
            self.blocked_slots.discard(key)
            self.blocking_reasons.pop(key, None)
        
        logger.debug(f"Cleared {len(keys_to_remove)} blocks for {employee_id}")
    
    def export_blocked_slots(self) -> List[Dict]:
        """Export blocked slots for database storage"""
        result = []
        for date_str, dagdeel, employee_id in sorted(self.blocked_slots):
            reason = self.blocking_reasons.get((date_str, dagdeel, employee_id), {})
            result.append({
                "employee_id": employee_id,
                "date": date_str,
                "dagdeel": dagdeel,
                "status": 2,  # BLOCKED status
                "blocking_reason": reason.get("reason"),
                "previous_service_code": reason.get("previous_service_code")
            })
        return result


class PairingLogic:
    """Main pairing logic engine"""
    
    def __init__(self):
        """Initialize pairing logic"""
        self.pairing_rules: List[PairingRule] = []
        self.blocking_calendar = BlockingCalendar()
        
        # Track employee history during processing
        self.employee_last_assignment: Dict[str, Tuple[date, str, str]] = {}
        # employee_last_assignment[employee_id] = (date, dagdeel, service_code)
        
        self.assignments_history: Dict[str, List[Tuple[date, str, str]]] = defaultdict(list)
        # assignments_history[employee_id] = [(date, dagdeel, service_code), ...]
    
    def register_pairing_rule(self, rule: PairingRule) -> None:
        """Register a pairing rule"""
        self.pairing_rules.append(rule)
        logger.info(f"Registered pairing rule: {rule}")
    
    def register_standard_pairing_rules(self, service_types: Dict[str, Dict]) -> None:
        """
        Register standard DIO/DDO pairing rules based on service_types table.
        
        Args:
            service_types: Dict of service_id -> service_data
        """
        # Build code -> id mapping
        code_to_id = {s.get('code'): s.get('id') for s in service_types.values()}
        
        # Standard rules
        pairing_configs = [
            ("DIO", "DDO", "hard", "DIO cannot be followed by DDO next day"),
            ("DIO", "VLO", "soft", "DIO followed by VLO should be avoided"),
        ]
        
        for code_first, code_second, block_type, description in pairing_configs:
            if code_first in code_to_id and code_second in code_to_id:
                rule = PairingRule(
                    service_id_first=code_to_id[code_first],
                    service_code_first=code_first,
                    service_id_second=code_to_id[code_second],
                    service_code_second=code_second,
                    block_type=block_type,
                    description=description
                )
                self.register_pairing_rule(rule)
                logger.info(f"Registered standard rule: {description}")
    
    def on_assignment_made(
        self,
        employee_id: str,
        work_date: date,
        dagdeel: str,
        service_code: str,
        service_id: str
    ) -> None:
        """
        Called whenever an assignment is made. Updates history and applies blocking rules.
        
        Args:
            employee_id: Employee ID
            work_date: Date of assignment
            dagdeel: Shift part (O/M/A)
            service_code: Service code (e.g., "DIO")
            service_id: Service UUID
        """
        # Update history
        self.employee_last_assignment[employee_id] = (work_date, dagdeel, service_code)
        self.assignments_history[employee_id].append((work_date, dagdeel, service_code))
        
        logger.debug(f"Assignment made: {employee_id} on {work_date} {dagdeel} ({service_code})")
        
        # Check if this assignment triggers blocking for next day
        self._apply_pairing_blocks(employee_id, work_date, dagdeel, service_code)
    
    def _apply_pairing_blocks(
        self,
        employee_id: str,
        work_date: date,
        dagdeel: str,
        service_code: str
    ) -> None:
        """
        Apply blocking for next day if this assignment matches a pairing rule.
        """
        # Check all pairing rules where this service is the FIRST in the pair
        for rule in self.pairing_rules:
            if rule.service_code_first == service_code:
                # This service triggers blocking
                next_date = work_date + timedelta(days=1)
                
                if rule.block_type == "hard":
                    # Hard block: prevent assignment of second service next day
                    self.blocking_calendar.block_slot(
                        work_date=next_date,
                        dagdeel=dagdeel,
                        employee_id=employee_id,
                        reason=f"{service_code} → cannot have {rule.service_code_second} next {dagdeel}",
                        previous_date=work_date,
                        previous_dagdeel=dagdeel,
                        previous_service_code=service_code
                    )
                    
                    logger.info(
                        f"Hard blocking: {employee_id} cannot do {rule.service_code_second} "
                        f"on {next_date} {dagdeel} due to {service_code} on {work_date}"
                    )
                
                elif rule.block_type == "soft":
                    # Soft block: discourage but allow (handled in scoring)
                    logger.debug(
                        f"Soft discourage: {employee_id} {rule.service_code_second} "
                        f"on {next_date} {dagdeel} after {service_code}"
                    )
    
    def is_eligible_for_assignment(
        self,
        employee_id: str,
        work_date: date,
        dagdeel: str,
        service_code: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if employee can be assigned to this service on this date.
        
        Returns:
            (is_eligible, blocking_reason)
        """
        # Check hard blocks
        if self.blocking_calendar.is_blocked(work_date, dagdeel, employee_id):
            reason = self.blocking_calendar.get_blocking_reason(work_date, dagdeel, employee_id)
            return False, reason.get("reason") if reason else "Blocked (reason unknown)"
        
        # Check soft constraints (discouraged but allowed)
        # This would be handled in scoring, not blocking
        
        return True, None
    
    def get_pairing_penalty_score(
        self,
        employee_id: str,
        work_date: date,
        dagdeel: str,
        service_code: str
    ) -> float:
        """
        Calculate pairing penalty for this assignment.
        Returns negative score if pairing is discouraged (soft constraint).
        
        Args:
            employee_id: Employee ID
            work_date: Date
            dagdeel: Shift part
            service_code: Service code to assign
        
        Returns:
            Penalty score (negative = discouraged)
        """
        penalty = 0.0
        
        # Check if this service was recently assigned
        if employee_id in self.employee_last_assignment:
            last_date, last_dagdeel, last_service_code = self.employee_last_assignment[employee_id]
            
            # Check if pairing rule exists for (last_service_code → service_code)
            for rule in self.pairing_rules:
                if (rule.service_code_first == last_service_code and
                    rule.service_code_second == service_code):
                    
                    # Check if it's a soft constraint
                    if rule.block_type == "soft":
                        days_since_last = (work_date - last_date).days
                        if days_since_last == 1 and dagdeel == last_dagdeel:
                            # Same day part, day after: apply soft penalty
                            penalty = -0.2  # 20% penalty
                            logger.debug(
                                f"Soft penalty for {employee_id}: "
                                f"{rule.service_code_first} → {service_code} "
                                f"(penalty: {penalty})"
                            )
        
        return penalty
    
    def export_blocking_calendar(self) -> List[Dict]:
        """Export blocking calendar for database storage"""
        return self.blocking_calendar.export_blocked_slots()
    
    def get_employee_assignment_history(self, employee_id: str) -> List[Tuple[date, str, str]]:
        """Get assignment history for employee"""
        return self.assignments_history.get(employee_id, [])
    
    def generate_pairing_report(self) -> Dict:
        """Generate detailed pairing report"""
        report = {
            "pairing_rules": [
                {
                    "first": rule.service_code_first,
                    "second": rule.service_code_second,
                    "type": rule.block_type,
                    "description": rule.description
                }
                for rule in self.pairing_rules
            ],
            "blocked_slots_count": len(self.blocking_calendar.blocked_slots),
            "employees_affected": len(set(k[2] for k in self.blocking_calendar.blocked_slots)),
            "blocking_statistics": self._calculate_blocking_statistics(),
            "pairing_violations": self._detect_pairing_violations()
        }
        return report
    
    def _calculate_blocking_statistics(self) -> Dict:
        """Calculate statistics about blocking"""
        stats = {
            "by_reason": defaultdict(int),
            "by_employee": defaultdict(int),
            "by_date": defaultdict(int)
        }
        
        for (date_str, dagdeel, employee_id) in self.blocking_calendar.blocked_slots:
            reason = self.blocking_calendar.get_blocking_reason(
                date.fromisoformat(date_str), dagdeel, employee_id
            )
            if reason:
                stats["by_reason"][reason.get("reason", "unknown")] += 1
            stats["by_employee"][employee_id] += 1
            stats["by_date"][date_str] += 1
        
        return {
            "by_reason": dict(stats["by_reason"]),
            "by_employee": dict(stats["by_employee"]),
            "by_date": dict(stats["by_date"])
        }
    
    def _detect_pairing_violations(self) -> List[Dict]:
        """Detect instances where pairing rules were violated"""
        violations = []
        
        for employee_id, history in self.assignments_history.items():
            for i in range(len(history) - 1):
                current_date, current_dagdeel, current_service = history[i]
                next_date, next_dagdeel, next_service = history[i + 1]
                
                # Check if consecutive days with same dagdeel
                if next_date == current_date + timedelta(days=1) and next_dagdeel == current_dagdeel:
                    # Check if this violates a pairing rule
                    for rule in self.pairing_rules:
                        if (rule.service_code_first == current_service and
                            rule.service_code_second == next_service and
                            rule.block_type == "hard"):
                            violations.append({
                                "employee_id": employee_id,
                                "first_date": str(current_date),
                                "first_service": current_service,
                                "second_date": str(next_date),
                                "second_service": next_service,
                                "severity": "CRITICAL",
                                "description": rule.description
                            })
        
        return violations
    
    def reset_for_new_processing(self) -> None:
        """Reset state for a fresh processing run"""
        self.blocking_calendar = BlockingCalendar()
        self.employee_last_assignment = {}
        self.assignments_history = defaultdict(list)
        logger.info("Pairing logic state reset for new processing")


class PairingOptimizer:
    """Optimize assignments considering pairing constraints"""
    
    def __init__(self, pairing_logic: PairingLogic):
        """Initialize optimizer"""
        self.pairing_logic = pairing_logic
    
    def suggest_alternative_assignments(
        self,
        employee_id: str,
        work_date: date,
        dagdeel: str,
        service_code: str,
        candidate_employees: List[str],
        service_types: Dict[str, Dict]
    ) -> List[Tuple[str, float, str]]:
        """
        If employee cannot be assigned due to pairing, suggest alternatives.
        
        Returns:
            List of (employee_id, suitability_score, reason)
        """
        suggestions = []
        
        # Check why employee is blocked
        eligible, reason = self.pairing_logic.is_eligible_for_assignment(
            employee_id, work_date, dagdeel, service_code
        )
        
        if not eligible:
            logger.debug(f"Employee {employee_id} blocked: {reason}")
            
            # Find alternatives among candidate_employees
            for candidate in candidate_employees:
                if candidate == employee_id:
                    continue
                
                # Check if candidate is eligible
                cand_eligible, cand_reason = self.pairing_logic.is_eligible_for_assignment(
                    candidate, work_date, dagdeel, service_code
                )
                
                if cand_eligible:
                    # Calculate suitability based on history
                    history = self.pairing_logic.get_employee_assignment_history(candidate)
                    last_assignments = len(history)
                    suitability = 1.0 - (last_assignments / 100.0)  # Recent assignments reduce suitability
                    
                    suggestions.append((candidate, suitability, "Eligible alternative"))
        
        return sorted(suggestions, key=lambda x: x[1], reverse=True)
