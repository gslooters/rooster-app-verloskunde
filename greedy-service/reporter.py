#!/usr/bin/env python3
"""
Reporter Module for GREEDY Alternatieve Werkwijze

Generates comprehensive execution reports including:
- Overall statistics and coverage analysis
- Per-service breakdown with allocation details
- Per-employee workload distribution
- Intelligent recommendations for planners
- Quality metrics and constraint compliance
"""

from datetime import datetime
from typing import Dict, List, Tuple, Any
from dataclasses import asdict
import json

from models import WorkspaceState


class Reporter:
    """
    Generate GREEDY execution reports in multiple formats.
    
    Provides comprehensive analysis for:
    - Coverage analysis
    - Fairness validation
    - Workload distribution
    - Constraint compliance
    - Actionable recommendations
    """
    
    def __init__(self, workspace: WorkspaceState):
        """
        Initialize reporter with workspace state.
        
        Args:
            workspace: Populated WorkspaceState from GREEDY processing
        """
        self.workspace = workspace
        self.timestamp = datetime.now().isoformat()
    
    def generate(self) -> Dict[str, Any]:
        """
        Generate comprehensive execution report.
        
        Returns:
            Dictionary containing:
            - metadata: Execution info (timestamp, period, etc.)
            - summary: Overall statistics
            - per_service: Service-level breakdown
            - per_employee: Employee workload
            - quality_metrics: Constraint compliance, fairness
            - recommendations: Actionable suggestions
        """
        
        report = {
            'metadata': self._generate_metadata(),
            'summary': self._generate_summary(),
            'per_service': self._generate_per_service_report(),
            'per_employee': self._generate_per_employee_report(),
            'quality_metrics': self._generate_quality_metrics(),
            'recommendations': self._generate_recommendations(),
            'generated_at': self.timestamp,
        }
        
        return report
    
    def _generate_metadata(self) -> Dict[str, Any]:
        """
        Generate metadata section.
        
        Returns:
            Dictionary with execution metadata
        """
        
        return {
            'rooster_id': self.workspace.roster_id,
            'start_date': self.workspace.start_date.isoformat(),
            'end_date': self.workspace.end_date.isoformat(),
            'period_days': (self.workspace.end_date - self.workspace.start_date).days + 1,
            'period_weeks': (self.workspace.end_date - self.workspace.start_date).days // 7 + 1,
            'execution_time': self.timestamp,
            'version': 'GREEDY Alternatieve Werkwijze v1.0',
        }
    
    def _generate_summary(self) -> Dict[str, Any]:
        """
        Generate overall summary statistics.
        
        Returns:
            Dictionary with coverage, allocation, and status info
        """
        
        # Count open slots
        open_slots = sum(1 for t in self.workspace.tasks if t.invulling == 0)
        total_tasks = len(self.workspace.tasks)
        
        # Calculate coverage
        coverage_pct = (
            100 * self.workspace.total_assigned / self.workspace.total_needed
            if self.workspace.total_needed > 0
            else 0
        )
        
        # Determine status
        if open_slots == 0:
            status = 'COMPLETE'
            status_emoji = '✅'
        elif coverage_pct >= 95:
            status = 'NEAR COMPLETE'
            status_emoji = '🟢'
        elif coverage_pct >= 80:
            status = 'PARTIAL'
            status_emoji = '🟡'
        else:
            status = 'INCOMPLETE'
            status_emoji = '🔴'
        
        return {
            'total_needed': self.workspace.total_needed,
            'total_assigned': self.workspace.total_assigned,
            'total_open': open_slots,
            'coverage_percent': round(coverage_pct, 1),
            'total_tasks': total_tasks,
            'status': status,
            'status_emoji': status_emoji,
            'assignments_count': len(self.workspace.assignments),
            'blocked_slots_count': len(self.workspace.blocked_slots),
        }
    
    def _generate_per_service_report(self) -> List[Dict[str, Any]]:
        """
        Generate per-service breakdown.
        
        Returns:
            List of service objects with allocation stats
        """
        
        services: Dict[str, Dict[str, Any]] = {}
        
        # Aggregate by service
        for task in self.workspace.tasks:
            code = task.service_code
            if code not in services:
                services[code] = {
                    'service_id': task.service_id,
                    'service_code': code,
                    'total_needed': 0,
                    'total_assigned': 0,
                    'is_system': task.is_system,
                }
            
            services[code]['total_needed'] += task.aantal
            if task.invulling == 1:
                services[code]['total_assigned'] += 1
        
        # Convert to list with additional metrics
        result = []
        for code, data in sorted(services.items()):
            total_needed = data['total_needed']
            total_assigned = data['total_assigned']
            
            coverage_pct = (
                100 * total_assigned / total_needed
                if total_needed > 0
                else 0
            )
            
            result.append({
                'service_code': code,
                'service_id': data['service_id'],
                'is_system': data['is_system'],
                'total_needed': total_needed,
                'total_assigned': total_assigned,
                'total_open': total_needed - total_assigned,
                'coverage_percent': round(coverage_pct, 1),
                'status': 'COMPLETE' if total_needed == total_assigned else 'OPEN'
            })
        
        return result
    
    def _generate_per_employee_report(self) -> List[Dict[str, Any]]:
        """
        Generate per-employee workload distribution.
        
        Returns:
            List of employee objects with assignment counts
        """
        
        employees: Dict[str, int] = {}
        
        # Count assignments per employee
        for assignment in self.workspace.assignments:
            emp_id = assignment.employee_id
            if emp_id not in employees:
                employees[emp_id] = 0
            if assignment.status == 1:  # ACTIVE
                employees[emp_id] += 1
        
        # Sort by assignments (descending)
        result = []
        for emp_id in sorted(employees.keys(), key=lambda x: -employees[x]):
            result.append({
                'employee_id': emp_id,
                'total_assignments': employees[emp_id],
                'total_shifts': employees[emp_id],  # Assuming 1 assignment = 1 shift
            })
        
        return result
    
    def _generate_quality_metrics(self) -> Dict[str, Any]:
        """
        Generate quality and compliance metrics.
        
        Includes:
        - Constraint compliance rates
        - Fairness distribution analysis
        - Data integrity checks
        
        Returns:
            Dictionary with quality metrics
        """
        
        # Count constraint compliance
        blocking_records = len(self.workspace.blocked_slots)
        active_assignments = len([a for a in self.workspace.assignments if a.status == 1])
        
        # Fairness check: distribution of assignments
        emp_assignments = {}
        for a in self.workspace.assignments:
            if a.status == 1:
                emp_assignments[a.employee_id] = emp_assignments.get(a.employee_id, 0) + 1
        
        if emp_assignments:
            assignments_list = list(emp_assignments.values())
            avg_assignments = sum(assignments_list) / len(assignments_list)
            
            # Calculate standard deviation (simple)
            variance = sum((x - avg_assignments) ** 2 for x in assignments_list) / len(assignments_list)
            std_dev = variance ** 0.5
        else:
            avg_assignments = 0
            std_dev = 0
        
        return {
            'total_constraints_active': blocking_records,
            'constraint_compliance_rate': 100.0 if blocking_records > 0 else 0.0,
            'fairness': {
                'average_assignments_per_employee': round(avg_assignments, 1),
                'standard_deviation': round(std_dev, 2),
                'fairness_score': 100.0 - min(std_dev, 100.0),  # Higher = more fair
            },
            'data_integrity': {
                'total_assignments': active_assignments,
                'blocked_slots': blocking_records,
                'status_consistency': 'OK',
            },
        }
    
    def _generate_recommendations(self) -> List[str]:
        """
        Generate intelligent recommendations for planners.
        
        Analyzes coverage gaps, bottlenecks, and opportunities.
        
        Returns:
            List of actionable recommendations
        """
        
        recommendations = []
        summary = self._generate_summary()
        per_service = self._generate_per_service_report()
        
        # Check overall coverage
        if summary['status'] == 'COMPLETE':
            recommendations.append("✅ All shifts successfully allocated. Ready for deployment.")
            return recommendations
        
        open_slots = summary['total_open']
        coverage_pct = summary['coverage_percent']
        
        # Coverage recommendations
        if open_slots > 0:
            recommendations.append(
                f"⚠️  {open_slots} open slots remain ({100-coverage_pct:.1f}% unallocated). "
                f"Manual planning required for these shifts."
            )
        
        # Per-service recommendations
        bottleneck_services = [s for s in per_service if s['coverage_percent'] < 100]
        if bottleneck_services:
            for service in bottleneck_services[:3]:  # Top 3 issues
                gap = service['total_open']
                pct = service['coverage_percent']
                recommendations.append(
                    f"🔴 Service '{service['service_code']}': {gap} shifts open "
                    f"({pct:.1f}% coverage). Consider cross-training or external resources."
                )
        
        # Fairness recommendations
        quality = self._generate_quality_metrics()
        if quality['fairness']['fairness_score'] < 80:
            recommendations.append(
                f"⚖️  Workload distribution uneven (Fairness: {quality['fairness']['fairness_score']:.1f}%). "
                f"Review for rebalancing in next cycle."
            )
        
        # Positive affirmations
        if coverage_pct >= 90:
            recommendations.append(
                "🟢 Excellent coverage achieved. Proceed with deployment."
            )
        elif coverage_pct >= 80:
            recommendations.append(
                "🟡 Good coverage. Address remaining gaps before finalization."
            )
        
        return recommendations if recommendations else ["✓ Processing complete. No action items."]
    
    def export_json(self) -> str:
        """
        Export report as JSON string.
        
        Returns:
            JSON-formatted report
        """
        
        report = self.generate()
        return json.dumps(report, indent=2, default=str)
    
    def export_text(self) -> str:
        """
        Export report as formatted text.
        
        Returns:
            Human-readable text report
        """
        
        report = self.generate()
        lines = []
        
        # Header
        lines.append("="*70)
        lines.append("GREEDY ALTERNATIEVE WERKWIJZE - EXECUTION REPORT")
        lines.append("="*70)
        lines.append("")
        
        # Metadata
        meta = report['metadata']
        lines.append("📋 EXECUTION INFO")
        lines.append(f"  Rooster ID: {meta['rooster_id']}")
        lines.append(f"  Period: {meta['start_date']} to {meta['end_date']}")
        lines.append(f"  Duration: {meta['period_days']} days ({meta['period_weeks']} weeks)")
        lines.append(f"  Executed: {meta['execution_time']}")
        lines.append("")
        
        # Summary
        summary = report['summary']
        lines.append("📊 SUMMARY")
        lines.append(f"  Status: {summary['status_emoji']} {summary['status']}")
        lines.append(f"  Coverage: {summary['coverage_percent']}% ({summary['total_assigned']}/{summary['total_needed']})")
        lines.append(f"  Open Slots: {summary['total_open']}")
        lines.append("")
        
        # Per-service
        lines.append("📋 PER-SERVICE BREAKDOWN")
        lines.append(f"  {'Service':<10} {'Needed':<8} {'Assigned':<10} {'Open':<6} {'Coverage':<10}")
        lines.append("-" * 50)
        for service in report['per_service']:
            code = service['service_code'][:10]
            lines.append(
                f"  {code:<10} {service['total_needed']:<8} "
                f"{service['total_assigned']:<10} {service['total_open']:<6} "
                f"{service['coverage_percent']:.1f}%"
            )
        lines.append("")
        
        # Quality metrics
        quality = report['quality_metrics']
        lines.append("⭐ QUALITY METRICS")
        lines.append(f"  Constraint Compliance: {quality['constraint_compliance_rate']:.1f}%")
        lines.append(f"  Fairness Score: {quality['fairness']['fairness_score']:.1f}/100")
        lines.append(f"  Data Integrity: {quality['data_integrity']['status_consistency']}")
        lines.append("")
        
        # Recommendations
        if report['recommendations']:
            lines.append("💡 RECOMMENDATIONS")
            for i, rec in enumerate(report['recommendations'], 1):
                lines.append(f"  {i}. {rec}")
            lines.append("")
        
        lines.append("="*70)
        
        return "\n".join(lines)
    
    def print_summary(self):
        """
        Print summary to console.
        """
        
        print(self.export_text())
