"""Hard Constraint Checker for Greedy Rostering Engine.

DRAAD 185-2: Isolated constraint validation logic (HC1-HC6)

Constraints:
  HC1: Employee must be capable for service
  HC2: No overlapping shifts (same employee, date, dagdeel)
  HC3: Respect blackout dates (employee unavailable)
  HC4: Don't exceed max shifts per employee
  HC5: Don't exceed max for specific service per employee
  HC6: Team-aware assignment logic

Author: DRAAD 185-2 Implementation
Date: 2025-12-15
"""

import logging
from typing import Dict, List, Set, Tuple, Optional
from datetime import date

logger = logging.getLogger(__name__)


class HardConstraintChecker:
    """Validates hard constraints for roster assignments."""

    def __init__(self, supabase_client):
        """Initialize constraint checker with Supabase client.
        
        Args:
            supabase_client: Supabase client for database queries
        """
        self.db = supabase_client
        
        # Performance optimization: caching
        self.capabilities_cache: Dict[str, bool] = {}  # f"{emp_id}_{svc_id}": bool
        self.blackout_cache: Dict[str, bool] = {}      # f"{emp_id}_{date}": bool
        self.service_limits_cache: Dict[str, int] = {} # f"{emp_id}_{svc_id}": max_aantal
        
        logger.info("HardConstraintChecker initialized with caching")

    def check_HC1_capability(self, emp_id: str, svc_id: str, roster_id: str) -> bool:
        """HC1: Employee capable for service?
        
        Checks roster_employee_services table for active capability.
        
        Args:
            emp_id: Employee ID
            svc_id: Service ID
            roster_id: Roster ID (for roster-specific capabilities)
            
        Returns:
            True if employee can do service, False otherwise
        """
        cache_key = f"{emp_id}_{svc_id}_{roster_id}"
        
        # Check cache first
        if cache_key in self.capabilities_cache:
            return self.capabilities_cache[cache_key]
        
        try:
            # Query roster_employee_services
            response = self.db.table('roster_employee_services').select('*').match({
                'roster_id': roster_id,
                'employee_id': emp_id,
                'service_id': svc_id,
                'actief': True
            }).execute()
            
            result = len(response.data) > 0
            
            # Cache result
            self.capabilities_cache[cache_key] = result
            
            if not result:
                logger.debug(f"HC1 FAIL: {emp_id} not capable for {svc_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"HC1 check error: {e}")
            return False

    def check_HC2_no_overlap(self, emp_id: str, date_str: str, dagdeel: str,
                            existing_assignments: List) -> bool:
        """HC2: No overlapping shifts?
        
        Checks if employee already has assignment on same date/dagdeel.
        
        Args:
            emp_id: Employee ID
            date_str: Date string (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
            existing_assignments: List of current assignments
            
        Returns:
            True if no overlap, False if overlap exists
        """
        # Check existing assignments in memory
        has_overlap = any(
            a.get('employee_id') == emp_id and 
            a.get('date') == date_str and 
            a.get('dagdeel') == dagdeel
            for a in existing_assignments
        )
        
        if has_overlap:
            logger.debug(f"HC2 FAIL: {emp_id} already assigned on {date_str} {dagdeel}")
            return False
        
        return True

    def check_HC3_blackout(self, emp_id: str, date_str: str, roster_id: str) -> bool:
        """HC3: Date available (not blackout)?
        
        Checks roster_assignments for status=3 (unavailable).
        
        Args:
            emp_id: Employee ID
            date_str: Date string (YYYY-MM-DD)
            roster_id: Roster ID
            
        Returns:
            True if available, False if blackout
        """
        cache_key = f"{emp_id}_{date_str}_{roster_id}"
        
        # Check cache
        if cache_key in self.blackout_cache:
            return self.blackout_cache[cache_key]
        
        try:
            # Query for blackout (status=3 means unavailable)
            response = self.db.table('roster_assignments').select('id').match({
                'roster_id': roster_id,
                'employee_id': emp_id,
                'date': date_str,
                'status': 3  # Status 3 = unavailable/blackout
            }).execute()
            
            # If found, it's a blackout
            is_available = len(response.data) == 0
            
            # Cache result
            self.blackout_cache[cache_key] = is_available
            
            if not is_available:
                logger.debug(f"HC3 FAIL: {emp_id} blackout on {date_str}")
            
            return is_available
            
        except Exception as e:
            logger.error(f"HC3 check error: {e}")
            return True  # Assume available on error

    def check_HC4_max_per_employee(self, emp_id: str, current_count: int, 
                                   target: int) -> bool:
        """HC4: Under max shifts per employee?
        
        Checks if adding one more shift would exceed target.
        
        Args:
            emp_id: Employee ID
            current_count: Current number of shifts assigned
            target: Target max shifts (from period_employee_staffing)
            
        Returns:
            True if under limit, False if would exceed
        """
        would_exceed = (current_count + 1) > target
        
        if would_exceed:
            logger.debug(f"HC4 FAIL: {emp_id} would exceed max ({current_count}+1 > {target})")
            return False
        
        return True

    def check_HC5_max_per_service(self, emp_id: str, svc_id: str, roster_id: str,
                                 current_count: int) -> bool:
        """HC5: Under max for this specific service?
        
        Checks roster_employee_services.aantal for service-specific limit.
        
        Args:
            emp_id: Employee ID
            svc_id: Service ID
            roster_id: Roster ID
            current_count: Current count for this service
            
        Returns:
            True if under limit, False if would exceed
        """
        cache_key = f"{emp_id}_{svc_id}_{roster_id}"
        
        # Get max from cache or database
        if cache_key not in self.service_limits_cache:
            try:
                response = self.db.table('roster_employee_services').select('aantal').match({
                    'roster_id': roster_id,
                    'employee_id': emp_id,
                    'service_id': svc_id
                }).execute()
                
                if response.data:
                    max_allowed = response.data[0].get('aantal', 999)
                else:
                    max_allowed = 999  # No limit if not specified
                
                self.service_limits_cache[cache_key] = max_allowed
                
            except Exception as e:
                logger.error(f"HC5 check error: {e}")
                return True  # Assume OK on error
        
        max_allowed = self.service_limits_cache[cache_key]
        would_exceed = (current_count + 1) > max_allowed
        
        if would_exceed:
            logger.debug(f"HC5 FAIL: {emp_id} would exceed service limit for {svc_id} ({current_count}+1 > {max_allowed})")
            return False
        
        return True

    def check_HC6_team_logic(self, svc_team: str, emp_team: str) -> bool:
        """HC6: Team-aware assignment?
        
        Service team logic:
        - GRO: prefer GRO employees (strict match)
        - ORA: prefer ORA employees (strict match)
        - TOT/NULL: any employee OK (flexible)
        
        Args:
            svc_team: Service team (from service_types.team)
            emp_team: Employee team (from employees.team)
            
        Returns:
            True if team match OK, False otherwise
        """
        # Normalize to uppercase and handle None
        svc_team_norm = (svc_team or 'TOT').upper()
        emp_team_norm = (emp_team or 'TOT').upper()
        
        # TOT or NULL services: any team OK
        if svc_team_norm in ['TOT', 'TOTAAL', 'NULL', '']:
            return True
        
        # GRO/ORA services: strict team match required
        if svc_team_norm in ['GRO', 'GROEN', 'ORA', 'ORANJE']:
            match = emp_team_norm == svc_team_norm
            
            if not match:
                logger.debug(f"HC6 FAIL: Team mismatch - Service:{svc_team_norm} vs Employee:{emp_team_norm}")
            
            return match
        
        # Unknown service team: allow any
        logger.warning(f"HC6: Unknown service team '{svc_team}', allowing assignment")
        return True

    def check_all_constraints(self, emp_id: str, date_str: str, dagdeel: str,
                            svc_id: str, svc_team: str, emp_team: str,
                            roster_id: str, existing_assignments: List,
                            employee_shift_count: int, employee_target: int,
                            service_count_for_emp: int) -> Tuple[bool, str]:
        """Check all 6 hard constraints at once.
        
        Args:
            emp_id: Employee ID
            date_str: Date (YYYY-MM-DD)
            dagdeel: Dagdeel (O, M, A)
            svc_id: Service ID
            svc_team: Service team
            emp_team: Employee team
            roster_id: Roster ID
            existing_assignments: Current assignments list
            employee_shift_count: Current total shifts for employee
            employee_target: Max shifts target for employee
            service_count_for_emp: Current count for this service
            
        Returns:
            Tuple of (passed: bool, failed_constraint: str)
        """
        # HC1: Capability
        if not self.check_HC1_capability(emp_id, svc_id, roster_id):
            return (False, "HC1_CAPABILITY")
        
        # HC2: No overlap
        if not self.check_HC2_no_overlap(emp_id, date_str, dagdeel, existing_assignments):
            return (False, "HC2_OVERLAP")
        
        # HC3: Blackout
        if not self.check_HC3_blackout(emp_id, date_str, roster_id):
            return (False, "HC3_BLACKOUT")
        
        # HC4: Max per employee
        if not self.check_HC4_max_per_employee(emp_id, employee_shift_count, employee_target):
            return (False, "HC4_MAX_EMPLOYEE")
        
        # HC5: Max per service
        if not self.check_HC5_max_per_service(emp_id, svc_id, roster_id, service_count_for_emp):
            return (False, "HC5_MAX_SERVICE")
        
        # HC6: Team logic
        if not self.check_HC6_team_logic(svc_team, emp_team):
            return (False, "HC6_TEAM_LOGIC")
        
        # All passed
        return (True, "")

    def clear_cache(self) -> None:
        """Clear all caches (useful between solve runs)."""
        self.capabilities_cache.clear()
        self.blackout_cache.clear()
        self.service_limits_cache.clear()
        logger.info("All constraint caches cleared")
