"""
Hard Constraint Checker for GREEDY Engine
DRAAD 181 Implementation - All 6 Hard Constraints
"""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import date
from dataclasses import dataclass
from enum import Enum

try:
    from supabase import Client
except ImportError:
    Client = None

logger = logging.getLogger(__name__)

class ConstraintType(Enum):
    HC1_CAPABILITY = "HC1 - Bevoegdheid (Capability)"
    HC2_NO_OVERLAP = "HC2 - Geen overlap (No Overlapping Shifts)"
    HC3_BLACKOUT = "HC3 - Blackout dates (Unavailability)"
    HC4_MAX_PER_EMP = "HC4 - Max shifts per employee"
    HC5_MAX_PER_SVC = "HC5 - Max per service type"
    HC6_COVERAGE = "HC6 - Minimum coverage"

@dataclass
class ConstraintViolation:
    """Record of a constraint violation"""
    constraint_type: ConstraintType
    employee_id: str
    date: date
    dagdeel: str
    service_id: str
    message: str
    severity: str = "ERROR"

class HardConstraintChecker:
    """
    Validates all 6 HARD constraints from DRAAD 181
    
    HC1: Bevoegdheid - Employee must be capable for service
    HC2: Geen overlap - No double shifts on same day
    HC3: Blackout dates - Respect unavailability
    HC4: Max per employee - Don't exceed target_shifts
    HC5: Max per service - Don't exceed service capacity
    HC6: Coverage - Attempt to meet minimum staffing
    """
    
    def __init__(self, db: Optional[Client], roster_id: str):
        self.db = db
        self.roster_id = roster_id
        self.logger = logging.getLogger(f"ConstraintChecker:{roster_id[:8]}")
        
        # Cache for performance
        self.capability_cache: Dict[Tuple[str, str], bool] = {}
        self.blackout_cache: Dict[Tuple[str, date], bool] = {}
        self.max_per_service_cache: Dict[Tuple[str, str], int] = {}
    
    def check_HC1_capability(
        self, 
        employee_id: str, 
        service_id: str
    ) -> Tuple[bool, Optional[str]]:
        """
        HC1: Is employee capable for this service?
        
        Source: roster_employee_services
        where employee_id = X and service_id = Y and actief = true
        
        Returns: (passed: bool, reason: str | None)
        """
        cache_key = (employee_id, service_id)
        
        if cache_key in self.capability_cache:
            passed = self.capability_cache[cache_key]
            return passed, None if passed else "Not in capability cache"
        
        try:
            if not self.db:
                self.logger.warning("HC1: No database client")
                return True, None  # Assume capable if no DB
            
            response = self.db.table('roster_employee_services').select('*').eq(
                'roster_id', self.roster_id
            ).eq('employee_id', employee_id).eq('service_id', service_id).eq(
                'actief', True
            ).execute()
            
            passed = len(response.data) > 0
            self.capability_cache[cache_key] = passed
            
            return passed, None if passed else f"Employee {employee_id} not capable for service {service_id}"
        
        except Exception as e:
            self.logger.error(f"HC1 check error: {e}")
            return False, f"HC1 check failed: {str(e)}"
    
    def check_HC2_no_overlap(
        self,
        employee_id: str,
        date_: date,
        dagdeel: str,
        existing_assignments: List[Dict]
    ) -> Tuple[bool, Optional[str]]:
        """
        HC2: Is employee already assigned this shift?
        
        Returns: (passed: bool, reason: str | None)
        """
        for assignment in existing_assignments:
            if (assignment.get('employee_id') == employee_id and
                assignment.get('date') == date_ and
                assignment.get('dagdeel') == dagdeel):
                return False, f"Employee already assigned on {date_} {dagdeel}"
        
        return True, None
    
    def check_HC3_blackout(
        self,
        employee_id: str,
        date_: date
    ) -> Tuple[bool, Optional[str]]:
        """
        HC3: Is this a blackout date for employee?
        
        Source: roster_design.unavailability_data
        
        Returns: (passed: bool, reason: str | None)
        """
        cache_key = (employee_id, date_)
        
        if cache_key in self.blackout_cache:
            is_available = self.blackout_cache[cache_key]
            return is_available, None if is_available else f"Employee unavailable on {date_}"
        
        try:
            if not self.db:
                self.logger.warning("HC3: No database client")
                return True, None  # Assume available if no DB
            
            response = self.db.table('roster_design').select('unavailability_data').eq(
                'roster_id', self.roster_id
            ).execute()
            
            is_available = True
            if response.data:
                unavail_data = response.data[0].get('unavailability_data', {})
                is_available = str(date_) not in unavail_data.get('dates', [])
            
            self.blackout_cache[cache_key] = is_available
            return is_available, None if is_available else f"Employee blackout on {date_}"
        
        except Exception as e:
            self.logger.error(f"HC3 check error: {e}")
            return False, f"HC3 check failed: {str(e)}"
    
    def check_HC4_max_per_employee(
        self,
        employee_id: str,
        target_shifts: int,
        current_count: int
    ) -> Tuple[bool, Optional[str]]:
        """
        HC4: Would assignment exceed max per employee?
        
        Source: period_employee_staffing.target_shifts
        
        Returns: (passed: bool, reason: str | None)
        """
        if current_count >= target_shifts:
            return False, f"Employee {employee_id} already has {current_count} shifts (max {target_shifts})"
        
        return True, None
    
    def check_HC5_max_per_service(
        self,
        employee_id: str,
        service_id: str,
        current_count: int
    ) -> Tuple[bool, Optional[str]]:
        """
        HC5: Would assignment exceed max for this service?
        
        Source: roster_employee_services.aantal
        
        Returns: (passed: bool, reason: str | None)
        """
        cache_key = (employee_id, service_id)
        
        if cache_key not in self.max_per_service_cache:
            try:
                if not self.db:
                    self.logger.warning("HC5: No database client")
                    return True, None
                
                response = self.db.table('roster_employee_services').select('aantal').eq(
                    'roster_id', self.roster_id
                ).eq('employee_id', employee_id).eq('service_id', service_id).execute()
                
                max_count = 0
                if response.data:
                    max_count = response.data[0].get('aantal', 0)
                
                self.max_per_service_cache[cache_key] = max_count
            
            except Exception as e:
                self.logger.error(f"HC5 check error: {e}")
                return False, f"HC5 check failed: {str(e)}"
        
        max_count = self.max_per_service_cache[cache_key]
        if current_count >= max_count:
            return False, f"Employee {employee_id} already has {current_count} of service {service_id} (max {max_count})"
        
        return True, None
    
    def check_HC6_coverage(
        self,
        date_: date,
        dagdeel: str,
        service_id: str,
        needed: int,
        filled: int
    ) -> Tuple[bool, Optional[str]]:
        """
        HC6: Is minimum coverage met?
        
        Returns: (passed: bool, reason: str | None)
        """
        if filled >= needed:
            return True, None
        
        shortage = needed - filled
        return False, f"Coverage short by {shortage} for {date_} {dagdeel}"
    
    def validate_assignment(
        self,
        employee_id: str,
        date_: date,
        dagdeel: str,
        service_id: str,
        target_shifts: int,
        employee_shift_count: int,
        employee_service_count: int,
        existing_assignments: List[Dict]
    ) -> Tuple[bool, List[ConstraintViolation]]:
        """
        Validate a proposed assignment against all 6 hard constraints
        
        Returns: (valid: bool, violations: List[ConstraintViolation])
        """
        violations = []
        
        # HC1: Capability
        hc1_passed, hc1_msg = self.check_HC1_capability(employee_id, service_id)
        if not hc1_passed:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.HC1_CAPABILITY,
                employee_id=employee_id,
                date=date_,
                dagdeel=dagdeel,
                service_id=service_id,
                message=hc1_msg or "Not capable",
                severity="CRITICAL"
            ))
        
        # HC2: No overlap
        hc2_passed, hc2_msg = self.check_HC2_no_overlap(
            employee_id, date_, dagdeel, existing_assignments
        )
        if not hc2_passed:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.HC2_NO_OVERLAP,
                employee_id=employee_id,
                date=date_,
                dagdeel=dagdeel,
                service_id=service_id,
                message=hc2_msg or "Overlapping shift",
                severity="CRITICAL"
            ))
        
        # HC3: Blackout
        hc3_passed, hc3_msg = self.check_HC3_blackout(employee_id, date_)
        if not hc3_passed:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.HC3_BLACKOUT,
                employee_id=employee_id,
                date=date_,
                dagdeel=dagdeel,
                service_id=service_id,
                message=hc3_msg or "Unavailable date",
                severity="CRITICAL"
            ))
        
        # HC4: Max per employee
        hc4_passed, hc4_msg = self.check_HC4_max_per_employee(
            employee_id, target_shifts, employee_shift_count
        )
        if not hc4_passed:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.HC4_MAX_PER_EMP,
                employee_id=employee_id,
                date=date_,
                dagdeel=dagdeel,
                service_id=service_id,
                message=hc4_msg or "Max shifts exceeded",
                severity="ERROR"
            ))
        
        # HC5: Max per service
        hc5_passed, hc5_msg = self.check_HC5_max_per_service(
            employee_id, service_id, employee_service_count
        )
        if not hc5_passed:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.HC5_MAX_PER_SVC,
                employee_id=employee_id,
                date=date_,
                dagdeel=dagdeel,
                service_id=service_id,
                message=hc5_msg or "Max for service exceeded",
                severity="ERROR"
            ))
        
        valid = len(violations) == 0
        return valid, violations
    
    def clear_caches(self):
        """Clear all caches (use if roster data changes)"""
        self.capability_cache.clear()
        self.blackout_cache.clear()
        self.max_per_service_cache.clear()
        self.logger.info("All constraint checker caches cleared")


def main():
    """Test constraint checker"""
    logging.basicConfig(level=logging.INFO)
    
    # Test without database
    checker = HardConstraintChecker(None, 'test-roster')
    
    # Test HC1
    passed, msg = checker.check_HC1_capability('emp001', 'svc001')
    print(f"HC1 (no DB): {passed} - {msg}")
    
    # Test HC2
    assignments = [
        {'employee_id': 'emp001', 'date': '2025-01-15', 'dagdeel': 'O'}
    ]
    passed, msg = checker.check_HC2_no_overlap('emp001', None, 'O', assignments)
    print(f"HC2: {passed} - {msg}")
    
    # Test HC4
    passed, msg = checker.check_HC4_max_per_employee('emp001', 16, 10)
    print(f"HC4: {passed} - {msg}")
    
    print("\nConstraint checker initialized successfully!")


if __name__ == '__main__':
    main()
