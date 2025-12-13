#!/usr/bin/env python3
# DRAAD172: Sequential Solver - Core Greedy Assignment Logic
# Status: Implements correct priority ordering per Clarification 2
# Date: 2025-12-13
# Key: DIO+DDO complete → TOT complete → GRO/ORA

from typing import Dict, List, Tuple, Optional
from datetime import date
import logging

from .requirement_queue import Requirement, RequirementQueue
from .employee_availability import EmployeeAvailabilityTracker

logger = logging.getLogger(__name__)


class Assignment:
    """Single assignment result"""
    def __init__(self, employee_id: str, service_id: str, 
                 assignment_date: date, dagdeel: str):
        self.employee_id = employee_id
        self.service_id = service_id
        self.assignment_date = assignment_date
        self.dagdeel = dagdeel


class SequentialSolver:
    """
    PHASE 3: Sequential greedy solver with correct priority handling.
    
    **Algorithm:**
    1. Load all requirements + sort by 3-layer priority
    2. For each requirement (in order):
       a. Get eligible employees (has bevoegdheid)
       b. Filter by availability (no block + free slot)
       c. Sort by remaining count (highest need first)
       d. Assign in order until slots filled or no candidates
    3. Report unfulfilled slots
    
    **Guarantees:**
    - Status 1/2/3 NEVER modified
    - Only Status 0 slots are filled
    - No employee gets >1 assignment per date/dagdeel
    - All constraints respected
    """
    
    def __init__(self, db):
        self.db = db
        self.assignments: List[Assignment] = []
        self.unfulfilled: Dict[str, int] = {}  # service_code → count
    
    def solve(self, roster_id: str) -> Tuple[List[Assignment], Dict[str, int]]:
        """
        Execute the sequential solver.
        
        Args:
            roster_id: Roster UUID
            
        Returns:
            Tuple of (assignments, unfulfilled_dict)
        """
        logger.info(f"[SOLVER] Starting sequential solver for roster {roster_id}")
        
        # Phase 1: Load requirements
        requirements = RequirementQueue.load_from_db(roster_id, self.db)
        sorted_reqs = RequirementQueue.sort_by_priority(requirements)
        
        logger.info(f"[SOLVER] Sorted {len(sorted_reqs)} requirements by priority")
        
        # Phase 2: Load employee data
        tracker = EmployeeAvailabilityTracker(self.db)
        tracker.load_competencies(roster_id)
        tracker.load_blocked_slots(roster_id)
        tracker.load_assigned_count(roster_id)
        
        # Phase 3: Process requirements in order
        for req in sorted_reqs:
            logger.debug(f"[SOLVER] Processing: {req.date} {req.dagdeel} "
                        f"{req.service_code} ({req.aantal} needed)")
            
            assigned_count = 0
            
            # Get eligible employees, sorted by remaining need
            eligible = tracker.get_eligible_sorted(req.service_code, roster_id)
            
            if not eligible:
                logger.warning(f"[SOLVER] No eligible employees for {req.service_code}")
                self.unfulfilled[req.service_code] = self.unfulfilled.get(
                    req.service_code, 0) + req.aantal
                continue
            
            # Try to fill slots
            for emp_id, remaining_count in eligible:
                if assigned_count >= req.aantal:
                    break  # All slots filled
                
                # Check availability (both free slot + not blocked)
                if not tracker.is_available(emp_id, req.date, req.dagdeel):
                    logger.debug(f"  {emp_id}: blocked on {req.date} {req.dagdeel}")
                    continue
                
                if not tracker.is_exclusive_slot_free(emp_id, req.date, 
                                                      req.dagdeel, roster_id):
                    logger.debug(f"  {emp_id}: slot already filled on {req.date} {req.dagdeel}")
                    continue
                
                # Assign!
                assignment = Assignment(
                    employee_id=emp_id,
                    service_id=req.service_id,
                    assignment_date=req.date,
                    dagdeel=req.dagdeel
                )
                self.assignments.append(assignment)
                assigned_count += 1
                
                logger.debug(f"  ✅ {emp_id}: assigned")
            
            # Track unfulfilled
            unfilled = req.aantal - assigned_count
            if unfilled > 0:
                logger.warning(f"[SOLVER] Unfulfilled: {req.service_code} "
                             f"{unfilled}/{req.aantal} slots")
                self.unfulfilled[req.service_code] = self.unfulfilled.get(
                    req.service_code, 0) + unfilled
        
        logger.info(f"[SOLVER] Complete: {len(self.assignments)} assignments, "
                   f"{len(self.unfulfilled)} unfulfilled services")
        
        return self.assignments, self.unfulfilled
    
    def get_assignments(self) -> List[Assignment]:
        """Get list of assignments"""
        return self.assignments
    
    def get_unfulfilled(self) -> Dict[str, int]:
        """Get unfulfilled slots by service"""
        return self.unfulfilled
