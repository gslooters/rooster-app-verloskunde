#!/usr/bin/env python3
# DRAAD172: Assignment Report Generator
# Status: Report generation from solver results
# Date: 2025-12-13

from datetime import date
from typing import Dict, List, Optional
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class AssignmentReport:
    """
    Generate comprehensive report from solver results.
    
    Includes:
    - Summary: Total assignments, unfulfilled slots
    - Roster overview: Who is assigned to what
    - Unfulfilled details: Which services lack staff
    - Remaining count per employee: Service distribution
    """
    
    def __init__(self, roster_id: str, roster_name: str = None):
        self.roster_id = roster_id
        self.roster_name = roster_name or roster_id
        self.timestamp = datetime.now().isoformat()
        self.assignments: List[Dict] = []
        self.unfulfilled: Dict[str, int] = {}
        self.employee_stats: Dict[str, Dict] = {}  # emp_id → {service_code: count}
    
    def add_assignments(self, assignments: List, db) -> None:
        """
        Add assignments from solver result.
        
        Args:
            assignments: List of Assignment objects from SequentialSolver
            db: Database connection for enriching data
        """
        for assign in assignments:
            # Query for service name
            sql = "SELECT code, name FROM service_types WHERE id = %s"
            service = db.execute(sql, [assign.service_id]).fetchone()
            
            assignment_dict = {
                'employee_id': assign.employee_id,
                'service_id': assign.service_id,
                'service_code': service['code'] if service else '?',
                'service_name': service['name'] if service else 'Unknown',
                'date': assign.assignment_date.isoformat(),
                'dagdeel': assign.dagdeel
            }
            
            self.assignments.append(assignment_dict)
            
            # Update employee stats
            if assign.employee_id not in self.employee_stats:
                self.employee_stats[assign.employee_id] = {}
            
            service_code = service['code'] if service else '?'
            current = self.employee_stats[assign.employee_id].get(service_code, 0)
            self.employee_stats[assign.employee_id][service_code] = current + 1
        
        logger.info(f"[REPORT] Added {len(self.assignments)} assignments")
    
    def add_unfulfilled(self, unfulfilled: Dict[str, int], db) -> None:
        """
        Add unfulfilled slots information.
        
        Args:
            unfulfilled: Dict mapping service_code → count
            db: Database connection for service names
        """
        for service_code, count in unfulfilled.items():
            # Query for service name
            sql = "SELECT id, name FROM service_types WHERE code = %s"
            service = db.execute(sql, [service_code]).fetchone()
            
            self.unfulfilled[service_code] = {
                'service_id': service['id'] if service else '?',
                'service_name': service['name'] if service else 'Unknown',
                'unfulfilled_count': count
            }
        
        logger.info(f"[REPORT] Added unfulfilled info for {len(self.unfulfilled)} services")
    
    def generate_summary(self) -> Dict:
        """
        Generate summary statistics.
        
        Returns:
            Dict with summary info
        """
        total_unfulfilled = sum(v['unfulfilled_count'] 
                               for v in self.unfulfilled.values())
        
        return {
            'timestamp': self.timestamp,
            'roster_id': self.roster_id,
            'roster_name': self.roster_name,
            'total_assignments': len(self.assignments),
            'total_unfulfilled': total_unfulfilled,
            'unfulfilled_services': len(self.unfulfilled),
            'unique_employees_assigned': len(self.employee_stats)
        }
    
    def generate_employee_summary(self) -> Dict[str, Dict]:
        """
        Generate per-employee assignment summary.
        
        Returns:
            Dict mapping employee_id → assignment breakdown by service
        """
        return self.employee_stats
    
    def generate_unfulfilled_details(self) -> List[Dict]:
        """
        Generate list of unfulfilled services with details.
        
        Returns:
            List of dicts with service and unfulfilled count
        """
        return [{
            'service_code': code,
            'service_name': info['service_name'],
            'unfulfilled_count': info['unfulfilled_count']
        } for code, info in self.unfulfilled.items()]
    
    def generate_roster_overview(self) -> List[Dict]:
        """
        Generate full roster assignment list.
        
        Returns:
            Sorted list of all assignments by date/dagdeel
        """
        sorted_assignments = sorted(
            self.assignments,
            key=lambda x: (x['date'], x['dagdeel'], x['service_code'])
        )
        return sorted_assignments
    
    def to_json(self) -> str:
        """
        Serialize entire report to JSON.
        
        Returns:
            JSON string
        """
        report = {
            'summary': self.generate_summary(),
            'roster_overview': self.generate_roster_overview(),
            'employee_summary': self.generate_employee_summary(),
            'unfulfilled_details': self.generate_unfulfilled_details()
        }
        
        return json.dumps(report, indent=2, default=str)
    
    def to_dict(self) -> Dict:
        """
        Serialize entire report to dict.
        
        Returns:
            Dict containing full report
        """
        return {
            'summary': self.generate_summary(),
            'roster_overview': self.generate_roster_overview(),
            'employee_summary': self.generate_employee_summary(),
            'unfulfilled_details': self.generate_unfulfilled_details()
        }
