#!/usr/bin/env python3
# DRAAD172: Requirement Queue with 3-Layer Priority Sorting
# Status: FINAL IMPLEMENTATION (Clarification 2 CORRECTED)
# Date: 2025-12-13
# Validation: ✅ Correct system service ordering per dagdeel

from datetime import date
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class Requirement:
    """
    Represents a single staffing requirement from roster_period_staffing_dagdelen.
    """
    def __init__(self, 
                 date: date,
                 dagdeel: str,           # 'O', 'M', or 'A'
                 service_id: str,
                 service_code: str,
                 aantal: int,            # number of positions needed
                 team: Optional[str] = 'TOT',
                 is_system: bool = False):
        self.date = date
        self.dagdeel = dagdeel
        self.service_id = service_id
        self.service_code = service_code
        self.aantal = aantal
        self.team = team
        self.is_system = is_system
    
    def __repr__(self):
        return (f"Requirement({self.date}, {self.dagdeel}, {self.service_code}, "
                f"{self.aantal}, team={self.team})")


class RequirementQueue:
    """
    PHASE 2: Requirement Queue with CORRECTED 3-layer priority sorting.
    
    **CRITICAL RULES:**
    - Layer 1: Cluster by timeblock (date, dagdeel)
    - Layer 2: Priority tier (System → TOT → GRO/ORA)
    - Layer 3: Alphabetic within priority
    
    **System Service Order (CORRECTED):**
    - Per dagdeel, system services have dagdeel-specific order
    - Ochtend (O): DIO → DDO
    - Avond (A):   DIA → DDA
    - MUST be complete before moving to TOT
    """
    
    SYSTEM_SERVICES = {'DIO', 'DDO', 'DIA', 'DDA'}
    
    # Per dagdeel: prioriteitsorder voor systeemdiensten
    SYSTEM_ORDER_BY_DAGDEEL = {
        'O': {'DIO': 1, 'DDO': 2},       # Ochtend: DIO first, then DDO
        'M': {},                          # Middag (if any used)
        'A': {'DIA': 1, 'DDA': 2}        # Avond: DIA first, then DDA
    }
    
    @staticmethod
    def load_from_db(roster_id: str, db) -> List[Requirement]:
        """
        Load requirements from roster_period_staffing_dagdelen table.
        
        Args:
            roster_id: The roster UUID
            db: Database connection
            
        Returns:
            List of Requirement objects
        """
        
        sql = """
          SELECT 
            rpsd.date,
            rpsd.dagdeel,
            rpsd.service_id,
            st.code as service_code,
            rpsd.aantal,
            COALESCE(rpsd.team, 'TOT') as team,
            COALESCE(st.is_system, FALSE) as is_system
          FROM roster_period_staffing_dagdelen rpsd
          JOIN roster_period_staffing rps 
            ON rpsd.roster_period_staffing_id = rps.id
          JOIN service_types st 
            ON rpsd.service_id = st.id
          WHERE rps.roster_id = %s
          ORDER BY rpsd.date, rpsd.dagdeel
        """
        
        rows = db.execute(sql, [roster_id]).fetchall()
        
        requirements = []
        for row in rows:
            # Check if service code indicates system service
            is_system = bool(row['is_system']) or row['service_code'] in \
                       RequirementQueue.SYSTEM_SERVICES
            
            requirements.append(Requirement(
                date=row['date'],
                dagdeel=row['dagdeel'],
                service_id=row['service_id'],
                service_code=row['service_code'],
                aantal=row['aantal'],
                team=row['team'],
                is_system=is_system
            ))
        
        logger.info(f"[QUEUE] Loaded {len(requirements)} requirements for roster {roster_id}")
        return requirements
    
    @staticmethod
    def sort_by_priority(requirements: List[Requirement]) -> List[Requirement]:
        """
        Sort requirements using 3-layer priority:
        
        **Layer 1:** Timeblock (date, dagdeel) - cluster by day and part
        **Layer 2:** Priority tier:
          - 0 = System services (DIO/DDO/DIA/DDA)
          - 1 = TOT (praktijk diensten)
          - 2 = Team services (GRO/ORA)
        **Layer 3:** Within each tier, sort alphabetically by service_code
        
        **CRITICAL:**
        - Within system services, order by dagdeel-specific sequence
        - DIO+DDO MUST complete before TOT starts
        - TOT MUST complete before GRO/ORA starts
        
        Args:
            requirements: Unsorted list of Requirement objects
            
        Returns:
            Sorted list maintaining priority constraints
        """
        
        def sort_key(req: Requirement) -> Tuple:
            # Layer 1: Timeblock (date, dagdeel)
            timeblock = (req.date, req.dagdeel)
            
            # Layer 2: Priority tier with sub-ordering
            if req.is_system:
                # System service: sort by dagdeel-specific order
                order = RequirementQueue.SYSTEM_ORDER_BY_DAGDEEL.get(
                    req.dagdeel, {}
                )
                priority_idx = order.get(req.service_code, 999)
                priority = (0, priority_idx)  # 0 = highest priority
                
            elif req.team == 'TOT':
                # Praktijk dienst: priority 1, sort alphabetically
                priority = (1, req.service_code)
                
            else:
                # Team service (GRO/ORA): priority 2, sort alphabetically
                priority = (2, req.service_code)
            
            # Layer 3: Final sort by service code (fallback)
            code_sort = req.service_code
            
            return (timeblock, priority, code_sort)
        
        sorted_reqs = sorted(requirements, key=sort_key)
        
        # Log first 10 for debugging
        logger.info("[QUEUE] Sorted requirements (first 10):")
        for i, req in enumerate(sorted_reqs[:10]):
            logger.info(
                f"  [{i+1:2d}] {req.date} {req.dagdeel} {req.service_code:4s} "
                f"({req.team:3s}): {req.aantal:2d} pos"
            )
        
        return sorted_reqs
    
    @staticmethod
    def get_unfulfilled(requirements: List[Requirement],
                       assignments: Dict[str, int]) -> List[Requirement]:
        """
        Filter requirements that have unfulfilled positions.
        
        Args:
            requirements: List of all requirements
            assignments: Dict mapping requirement_id → count_assigned
            
        Returns:
            List of requirements with remaining positions > 0
        """
        unfulfilled = []
        
        for req in requirements:
            assigned = assignments.get(req.service_id, 0)
            remaining = req.aantal - assigned
            
            if remaining > 0:
                unfulfilled.append(req)
        
        return unfulfilled
