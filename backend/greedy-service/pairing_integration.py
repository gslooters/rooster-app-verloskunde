"""
FASE 3: Pairing Integration with GreedySolverV2

Integrates pairing logic into the greedy solving process:
1. Loads pairing rules from service_types
2. Applies blocking during assignment
3. Exports blocked slots to database
4. Generates pairing reports
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass

from pairing_logic import PairingLogic, PairingRule, BlockingCalendar

logger = logging.getLogger(__name__)


@dataclass
class PairingConfig:
    """Configuration for pairing behavior"""
    enable_hard_blocking: bool = True
    enable_soft_penalties: bool = True
    hard_block_weight: float = -1000.0  # Extremely negative
    soft_penalty_weight: float = -0.2  # 20% penalty
    enable_pairing_reports: bool = True
    max_consecutive_days_override: Optional[int] = None


class PairingIntegratedSolver:
    """
    GreedySolverV2 with integrated pairing logic.
    Wraps the solver to add pairing awareness.
    """
    
    def __init__(
        self,
        greedy_solver,
        pairing_logic: Optional[PairingLogic] = None,
        config: Optional[PairingConfig] = None
    ):
        """
        Initialize integrated solver.
        
        Args:
            greedy_solver: GreedySolverV2 instance
            pairing_logic: PairingLogic instance (created if None)
            config: PairingConfig for behavior
        """
        self.solver = greedy_solver
        self.pairing_logic = pairing_logic or PairingLogic()
        self.config = config or PairingConfig()
    
    def solve_with_pairing(
        self,
        roster_id: str,
        period_start: date,
        period_end: date,
        assignments_workspace: Dict,  # From loader.load_workspace()
        service_types: Dict,
        employees_data: Dict,
        constraints: Optional[Dict] = None
    ) -> Dict:
        """
        Main solving method with integrated pairing logic.
        
        Args:
            roster_id: Roster ID
            period_start: Start date
            period_end: End date
            assignments_workspace: Workspace from DataLoader
            service_types: Service types configuration
            employees_data: Employee data
            constraints: Additional constraints
        
        Returns:
            Solution with pairing information
        """
        logger.info("="*80)
        logger.info("FASE 3: Starting PAIRING-INTEGRATED solve")
        logger.info("="*80)
        
        # Reset pairing logic for fresh processing
        self.pairing_logic.reset_for_new_processing()
        
        # Register standard pairing rules
        self.pairing_logic.register_standard_pairing_rules(service_types)
        
        # Process assignments with pairing awareness
        solution = self._process_assignments_with_pairing(
            roster_id,
            period_start,
            period_end,
            assignments_workspace,
            service_types,
            employees_data,
            constraints
        )
        
        # Enhance solution with pairing data
        solution['pairing_data'] = {
            'blocking_calendar': self.pairing_logic.export_blocking_calendar(),
            'pairing_report': self.pairing_logic.generate_pairing_report(),
            'status': 'integrated'
        }
        
        logger.info(f"✅ Pairing-integrated solve completed")
        logger.info(f"   Blocked slots: {len(self.pairing_logic.blocking_calendar.blocked_slots)}")
        logger.info(f"   Pairing violations: {len(solution['pairing_data']['pairing_report'].get('pairing_violations', []))}")
        
        return solution
    
    def _process_assignments_with_pairing(
        self,
        roster_id: str,
        period_start: date,
        period_end: date,
        assignments_workspace: Dict,
        service_types: Dict,
        employees_data: Dict,
        constraints: Optional[Dict]
    ) -> Dict:
        """
        Process assignments with pairing-aware logic.
        
        Workflow:
        1. Iterate through each task in assignments_workspace['tasks']
        2. For each task, find eligible employees
        3. Filter blocked employees via pairing_logic
        4. Apply pairing penalty scores
        5. Select best employee
        6. Notify pairing_logic of assignment
        7. Export blocked slots
        """
        
        tasks = assignments_workspace.get('tasks', [])
        capacity = assignments_workspace.get('capacity', {})
        current_assignments = assignments_workspace.get('assignments', [])
        
        logger.info(f"Processing {len(tasks)} tasks with pairing logic")
        
        # Build service_id -> service_data map
        service_map = {s.get('id'): s for s in service_types.values()}
        
        assignments_made = []
        blocked_by_pairing = 0
        soft_penalties_applied = 0
        
        for task_idx, task in enumerate(tasks):
            if task_idx % 100 == 0:
                logger.debug(f"Processing task {task_idx}/{len(tasks)}")
            
            task_id = task.get('id')
            service_id = task.get('service_id')
            service_data = service_map.get(service_id, {})
            service_code = service_data.get('code', 'UNKNOWN')
            work_date = task.get('date')
            dagdeel = task.get('dagdeel')
            team = task.get('team')
            aantal = task.get('aantal', 1)
            
            if task.get('invulling', 0) > 0:
                # Already filled
                continue
            
            # Find candidate employees
            candidates = []
            for emp_id, emp_data in employees_data.items():
                # Check capacity for this service
                capacity_key = (emp_id, service_id)
                remaining = capacity.get(capacity_key, 0)
                
                if remaining <= 0:
                    continue  # No capacity left
                
                # Check team match
                emp_team = emp_data.get('team')
                if emp_team and team and emp_team != team:
                    continue  # Team mismatch
                
                candidates.append(emp_id)
            
            # Sort candidates with pairing awareness
            scored_candidates = []
            for emp_id in candidates:
                base_score = 0.0  # Could be from other factors
                
                # Check pairing eligibility (HARD BLOCK)
                eligible, block_reason = self.pairing_logic.is_eligible_for_assignment(
                    emp_id, work_date, dagdeel, service_code
                )
                
                if not eligible and self.config.enable_hard_blocking:
                    blocked_by_pairing += 1
                    continue  # Skip this candidate
                
                # Apply soft penalty if applicable
                penalty = 0.0
                if self.config.enable_soft_penalties:
                    penalty = self.pairing_logic.get_pairing_penalty_score(
                        emp_id, work_date, dagdeel, service_code
                    )
                    if penalty < 0:
                        soft_penalties_applied += 1
                
                final_score = base_score + penalty
                scored_candidates.append((emp_id, final_score))
            
            # Sort by score (descending)
            scored_candidates.sort(key=lambda x: x[1], reverse=True)
            
            # Assign to best candidates
            for idx in range(min(aantal, len(scored_candidates))):
                best_emp_id, score = scored_candidates[idx]
                
                # Record assignment
                assignment = {
                    'task_id': task_id,
                    'employee_id': best_emp_id,
                    'date': str(work_date),
                    'dagdeel': dagdeel,
                    'service_id': service_id,
                    'service_code': service_code,
                    'pairing_score': score,
                    'status': 1,
                    'source': 'greedy_fase3'
                }
                assignments_made.append(assignment)
                
                # Notify pairing logic
                self.pairing_logic.on_assignment_made(
                    best_emp_id, work_date, dagdeel, service_code, service_id
                )
                
                # Update capacity
                capacity_key = (best_emp_id, service_id)
                if capacity_key in capacity:
                    capacity[capacity_key] -= 1
        
        logger.info(f"\n📊 PAIRING PROCESSING STATISTICS:")
        logger.info(f"   Total assignments made: {len(assignments_made)}")
        logger.info(f"   Blocked by pairing: {blocked_by_pairing}")
        logger.info(f"   Soft penalties applied: {soft_penalties_applied}")
        logger.info(f"   Total blocked slots: {len(self.pairing_logic.blocking_calendar.blocked_slots)}")
        
        return {
            'status': 'solved_with_pairing',
            'assignments': assignments_made,
            'statistics': {
                'total_assignments': len(assignments_made),
                'blocked_by_pairing': blocked_by_pairing,
                'soft_penalties_applied': soft_penalties_applied,
                'blocked_slots_created': len(self.pairing_logic.blocking_calendar.blocked_slots)
            }
        }
    
    def export_results_for_database(
        self,
        solution: Dict
    ) -> Dict:
        """
        Export solution in format ready for database storage.
        
        Returns:
            {
                'assignments': [...],  # For roster_assignments table
                'blocked_slots': [...],  # For roster_assignments with status=2
                'violations': [...],  # For constraint_violations table
                'summary': {...}  # Metadata
            }
        """
        
        assignments = solution.get('assignments', [])
        blocked_slots = solution.get('pairing_data', {}).get('blocking_calendar', [])
        pairing_report = solution.get('pairing_data', {}).get('pairing_report', {})
        
        return {
            'assignments': [
                {
                    'employee_id': a.get('employee_id'),
                    'date': a.get('date'),
                    'dagdeel': a.get('dagdeel'),
                    'service_id': a.get('service_id'),
                    'status': 1,
                    'source': 'greedy_fase3',
                    'pairing_score': a.get('pairing_score')
                }
                for a in assignments
            ],
            'blocked_slots': [
                {
                    'employee_id': b.get('employee_id'),
                    'date': b.get('date'),
                    'dagdeel': b.get('dagdeel'),
                    'status': 2,  # BLOCKED status
                    'blocked_reason': b.get('blocking_reason'),
                    'previous_service': b.get('previous_service_code')
                }
                for b in blocked_slots
            ],
            'violations': pairing_report.get('pairing_violations', []),
            'summary': {
                'total_assignments': len(assignments),
                'total_blocked_slots': len(blocked_slots),
                'pairing_rules_registered': len(pairing_report.get('pairing_rules', [])),
                'employees_affected': pairing_report.get('employees_affected', 0)
            }
        }


class PairingReportGenerator:
    """Generate detailed pairing reports for stakeholders"""
    
    def __init__(self, pairing_logic: PairingLogic):
        self.pairing_logic = pairing_logic
    
    def generate_html_report(self) -> str:
        """
        Generate HTML report of pairing decisions.
        
        Returns:
            HTML string
        """
        report = self.pairing_logic.generate_pairing_report()
        
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Pairing Logic Report - FASE 3</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
                h2 { color: #666; margin-top: 30px; }
                table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #0066cc; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .hard { color: #d9534f; font-weight: bold; }
                .soft { color: #f0ad4e; font-weight: bold; }
                .stat { background-color: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 4px; }
                .warning { background-color: #fcf8e3; padding: 10px; margin: 10px 0; border-left: 4px solid #f0ad4e; }
                .critical { background-color: #f2dede; padding: 10px; margin: 10px 0; border-left: 4px solid #d9534f; }
            </style>
        </head>
        <body>
            <h1>🔗 Pairing Logic Report - FASE 3</h1>
            <div class="stat">Report generated at runtime for roster planning analysis</div>
        """
        
        # Section: Pairing Rules
        html += "<h2>Registered Pairing Rules</h2>"
        html += "<table><tr><th>First Service</th><th>Second Service</th><th>Type</th><th>Description</th></tr>"
        for rule in report.get('pairing_rules', []):
            rule_type = f"<span class='hard'>{rule['type'].upper()}</span>" if rule['type'] == 'hard' else f"<span class='soft'>{rule['type'].upper()}</span>"
            html += f"<tr><td>{rule['first']}</td><td>{rule['second']}</td><td>{rule_type}</td><td>{rule['description']}</td></tr>"
        html += "</table>"
        
        # Section: Statistics
        html += "<h2>Blocking Statistics</h2>"
        stats = report.get('blocking_statistics', {})
        html += f"<div class='stat'>"
        html += f"<strong>Total blocked slots:</strong> {report.get('blocked_slots_count', 0)}<br/>"
        html += f"<strong>Employees affected:</strong> {report.get('employees_affected', 0)}<br/>"
        html += f"</div>"
        
        # Section: Violations
        violations = report.get('pairing_violations', [])
        if violations:
            html += "<h2>Pairing Violations Detected</h2>"
            html += "<div class='critical'>"
            html += f"<strong>⚠️ {len(violations)} CRITICAL violations detected:</strong>"
            html += "<ul>"
            for v in violations:
                html += f"<li>Employee {v['employee_id']}: {v['first_service']} on {v['first_date']} → {v['second_service']} on {v['second_date']} ({v['description']})</li>"
            html += "</ul></div>"
        else:
            html += "<div class='stat'><strong>✅ No pairing violations detected!</strong></div>"
        
        html += "</body></html>"
        return html
    
    def generate_text_report(self) -> str:
        """
        Generate text report for console/logging.
        
        Returns:
            Text string
        """
        report = self.pairing_logic.generate_pairing_report()
        
        text = """
╔════════════════════════════════════════════════════════════╗
║        🔗 PAIRING LOGIC REPORT - FASE 3                   ║
╚════════════════════════════════════════════════════════════╝

📋 REGISTERED PAIRING RULES:
"""
        for rule in report.get('pairing_rules', []):
            rule_type = "🚫 HARD" if rule['type'] == 'hard' else "⚠️  SOFT"
            text += f"  {rule_type}: {rule['first']} → {rule['second']}\n"
            text += f"          {rule['description']}\n"
        
        text += f"""
📊 BLOCKING STATISTICS:
  Total blocked slots: {report.get('blocked_slots_count', 0)}
  Employees affected: {report.get('employees_affected', 0)}
"""
        
        violations = report.get('pairing_violations', [])
        if violations:
            text += f"\n⚠️  PAIRING VIOLATIONS: {len(violations)} detected\n"
            for v in violations:
                text += f"  - Employee {v['employee_id']}: {v['first_service']} ({v['first_date']}) → {v['second_service']} ({v['second_date']})\n"
        else:
            text += "\n✅ No pairing violations detected!\n"
        
        return text
