#!/usr/bin/env python3
# DRAAD172: Employee Availability Tracker
# Status: Core availability & eligibility checking
# Date: 2025-12-13

from typing import Dict, List, Optional, Tuple
from datetime import date
import logging

logger = logging.getLogger(__name__)


class EmployeeAvailabilityTracker:
    """
    Tracks employee availability and calculates remaining position counts.
    
    **Constraints checked:**
    1. Bevoegdheden: employee_service must exist with actief=TRUE
    2. Beschikbaarheid: No Status 2/3 blocks on that date/dagdeel
    3. Exclusivity: Max 1 assignment per employee per date/dagdeel
    4. Restgetal: Respects roster_employee_services.aantal planning
    """
    
    def __init__(self, db):
        self.db = db
        self.competencies: Dict[str, set] = {}  # employee_id → set(service_codes)
        self.blocked: Dict[str, set] = {}        # employee_id → set((date, dagdeel))
        self.assigned_count: Dict[Tuple[str, str], int] = {}  # (employee_id, service_code) → count
        self.targets: Dict[Tuple[str, str], int] = {}        # (employee_id, service_code) → target
        
    def load_competencies(self, roster_id: str) -> None:
        """
        Load all active employee competencies (bevoegdheden) for the roster.
        Only loads where roster_employee_services.actief = TRUE.
        
        Args:
            roster_id: The roster UUID
        """
        sql = """
          SELECT 
            res.employee_id,
            st.code as service_code,
            res.aantal as target_count
          FROM roster_employee_services res
          JOIN service_types st ON res.service_id = st.id
          JOIN roster_periods rp ON res.roster_period_id = rp.id
          WHERE rp.roster_id = %s
          AND res.actief = TRUE
          ORDER BY res.employee_id, st.code
        """
        
        rows = self.db.execute(sql, [roster_id]).fetchall()
        
        for row in rows:
            emp_id = row['employee_id']
            service_code = row['service_code']
            target = row['target_count'] or 0
            
            # Add to competencies set
            if emp_id not in self.competencies:
                self.competencies[emp_id] = set()
            self.competencies[emp_id].add(service_code)
            
            # Track target
            self.targets[(emp_id, service_code)] = target
        
        logger.info(f"[AVAIL] Loaded competencies for {len(self.competencies)} employees")
    
    def load_blocked_slots(self, roster_id: str) -> None:
        """
        Load blocked slots (Status 2/3) for all employees in roster.
        
        Args:
            roster_id: The roster UUID
        """
        sql = """
          SELECT DISTINCT
            ra.employee_id,
            ra.date,
            ra.dagdeel
          FROM roster_assignments ra
          JOIN roster_periods rp ON ra.roster_period_id = rp.id
          WHERE rp.roster_id = %s
          AND ra.status IN (2, 3)
        """
        
        rows = self.db.execute(sql, [roster_id]).fetchall()
        
        for row in rows:
            emp_id = row['employee_id']
            block_key = (row['date'], row['dagdeel'])
            
            if emp_id not in self.blocked:
                self.blocked[emp_id] = set()
            self.blocked[emp_id].add(block_key)
        
        logger.info(f"[AVAIL] Loaded {sum(len(v) for v in self.blocked.values())} blocked slots")
    
    def load_assigned_count(self, roster_id: str) -> None:
        """
        Load current assignment counts (Status 1) for all employees.
        Only counts Status 1 (confirmed assignments).
        
        Args:
            roster_id: The roster UUID
        """
        sql = """
          SELECT 
            ra.employee_id,
            st.code as service_code,
            COUNT(*) as count
          FROM roster_assignments ra
          JOIN roster_periods rp ON ra.roster_period_id = rp.id
          JOIN service_types st ON ra.service_id = st.id
          WHERE rp.roster_id = %s
          AND ra.status = 1
          GROUP BY ra.employee_id, st.code
        """
        
        rows = self.db.execute(sql, [roster_id]).fetchall()
        
        for row in rows:
            key = (row['employee_id'], row['service_code'])
            self.assigned_count[key] = row['count']
        
        logger.info(f"[AVAIL] Loaded assignment counts")
    
    def is_eligible(self, employee_id: str, service_code: str) -> bool:
        """
        Check if employee has competency for service.
        
        Args:
            employee_id: Employee UUID
            service_code: Service code (e.g. 'DIO', 'ECH')
            
        Returns:
            True if employee has active bevoegdheid
        """
        if employee_id not in self.competencies:
            return False
        return service_code in self.competencies[employee_id]
    
    def is_available(self, employee_id: str, 
                     assignment_date: date, 
                     dagdeel: str) -> bool:
        """
        Check if employee is available on date/dagdeel.
        Returns False if Status 2/3 block exists.
        
        Args:
            employee_id: Employee UUID
            assignment_date: Assignment date
            dagdeel: Time part ('O', 'M', 'A')
            
        Returns:
            True if not blocked
        """
        if employee_id not in self.blocked:
            return True
        
        block_key = (assignment_date, dagdeel)
        return block_key not in self.blocked[employee_id]
    
    def is_exclusive_slot_free(self, employee_id: str,
                               assignment_date: date,
                               dagdeel: str,
                               roster_id: str) -> bool:
        """
        Check if employee doesn't already have assignment for date/dagdeel.
        Constraint: Max 1 assignment per employee per date/dagdeel.
        
        Args:
            employee_id: Employee UUID
            assignment_date: Assignment date
            dagdeel: Time part
            roster_id: Roster UUID (for DB query)
            
        Returns:
            True if slot is free
        """
        sql = """
          SELECT COUNT(*) as count
          FROM roster_assignments ra
          JOIN roster_periods rp ON ra.roster_period_id = rp.id
          WHERE rp.roster_id = %s
          AND ra.employee_id = %s
          AND ra.date = %s
          AND ra.dagdeel = %s
          AND ra.status IN (0, 1)
        """
        
        result = self.db.execute(sql, 
            [roster_id, employee_id, assignment_date, dagdeel]
        ).fetchone()
        
        return result['count'] == 0 if result else True
    
    def get_remaining(self, employee_id: str, service_code: str) -> int:
        """
        Calculate remaining positions for employee/service.
        Formula: remaining = target - current
        
        Where:
        - target = roster_employee_services.aantal (planning)
        - current = COUNT(Status 1 assignments)
        
        Args:
            employee_id: Employee UUID
            service_code: Service code
            
        Returns:
            Number of remaining positions (0 if met/exceeded)
        """
        key = (employee_id, service_code)
        target = self.targets.get(key, 0)
        current = self.assigned_count.get(key, 0)
        remaining = max(0, target - current)
        
        return remaining
    
    def get_eligible_sorted(self, service_code: str, 
                           roster_id: str) -> List[Tuple[str, int]]:
        """
        Get list of eligible employees for a service, sorted by remaining count.
        Higher remaining count = higher priority.
        
        Args:
            service_code: Service code
            roster_id: Roster UUID (unused in this simple version)
            
        Returns:
            List of (employee_id, remaining_count) tuples, sorted descending by count
        """
        eligible = []
        
        for emp_id, services in self.competencies.items():
            if service_code in services:
                remaining = self.get_remaining(emp_id, service_code)
                if remaining > 0:  # Only include if still needs positions
                    eligible.append((emp_id, remaining))
        
        # Sort by remaining count descending (highest need first)
        eligible.sort(key=lambda x: x[1], reverse=True)
        
        logger.debug(f"[AVAIL] {service_code}: {len(eligible)} eligible employees")
        return eligible
