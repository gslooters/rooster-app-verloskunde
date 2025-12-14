"""Bottleneck analyzer for Greedy Rostering Engine.

DRAD 181: Provides advanced bottleneck diagnosis and suggestion generation.

Features:
  - Detailed reason analysis
  - Contextual suggestion generation
  - Multi-level diagnostics

Author: DRAAD 181 Implementation
Date: 2025-12-14
"""

import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class BottleneckAnalyzer:
    """Advanced bottleneck analysis and suggestion engine."""

    @staticmethod
    def diagnose(bottleneck_data: Dict, employees: List, capabilities: Dict, 
                 roster: List, blocked_slots: set) -> str:
        """Diagnose bottleneck reason.
        
        Args:
            bottleneck_data: {date, dagdeel, service_id, need, assigned, shortage}
            employees: List of all employees
            capabilities: Dict of (employee_id, service_id) -> capability
            roster: Current roster assignments
            blocked_slots: Set of blocked (employee_id, date, dagdeel)
            
        Returns:
            Reason string in German
        """
        date = bottleneck_data['date']
        dagdeel = bottleneck_data['dagdeel']
        service_id = bottleneck_data['service_id']
        shortage = bottleneck_data['shortage']
        
        # Analyze capability
        capable_employees = [
            emp for emp in employees
            if emp.get('actief', True) and 
            (emp['id'], service_id) in capabilities and
            capabilities[(emp['id'], service_id)].get('actief', True)
        ]
        
        if not capable_employees:
            return "Keine geschulten Mitarbeiter für diesen Service verfügbar"
        
        # Analyze availability (blocked)
        blocked_capable = [
            emp for emp in capable_employees
            if (emp['id'], date, dagdeel) in blocked_slots
        ]
        
        if len(blocked_capable) >= len(capable_employees):
            return f"Alle {len(capable_employees)} geschulten Mitarbeiter sind am {date} im {dagdeel} blockiert"
        
        # Analyze workload
        employee_shifts = {}
        for assignment in roster:
            emp_id = assignment.get('employee_id')
            if emp_id not in employee_shifts:
                employee_shifts[emp_id] = 0
            employee_shifts[emp_id] += 1
        
        available_capable = [
            emp for emp in capable_employees
            if (emp['id'], date, dagdeel) not in blocked_slots
        ]
        
        overloaded = [
            emp for emp in available_capable
            if employee_shifts.get(emp['id'], 0) >= 8  # Max shifts per employee
        ]
        
        if len(overloaded) == len(available_capable):
            return f"Alle {len(available_capable)} verfügbaren Mitarbeiter haben bereits maximale Schichten"
        
        # Generic
        return f"Nicht genügend verfügbare Mitarbeiter (Mangel: {shortage})"

    @staticmethod
    def suggest(bottleneck_data: Dict, reason: str, service_name: str = "Service") -> str:
        """Generate actionable suggestion.
        
        Args:
            bottleneck_data: Bottleneck details
            reason: Diagnosed reason
            service_name: Name of service for context
            
        Returns:
            Suggestion string
        """
        shortage = bottleneck_data.get('shortage', 1)
        date = bottleneck_data.get('date', '?')
        
        if "keine geschulten" in reason.lower():
            return (
                f"Aktion: Schulen Sie {shortage} weitere(n) Mitarbeiter in {service_name}. "
                f"Zieltermin: vor {date}"
            )
        elif "blockiert" in reason.lower():
            return (
                f"Aktion: Überprüfen Sie die Blockierungen für {date} {bottleneck_data.get('dagdeel', '?')}. "
                f"Mögliche Konflikte mit anderen Diensten?"
            )
        elif "maximale schichten" in reason.lower():
            return (
                f"Aktion: Erhöhen Sie das Schichtlimit für geschulte Mitarbeiter oder "
                f"verteilen Sie die Anforderung über mehrere Tage. "
                f"Oder: Reduzieren Sie die Anforderung für {date} um {shortage}"
            )
        else:
            return (
                f"Aktion: Reduzieren Sie die Anforderung für {date} um {shortage} oder "
                f"erhöhen Sie die Schichtkapazität. "
                f"Hinweis: Dies ist eine Engpass-Anforderung, die manuell überpruft werden sollte."
            )

    @staticmethod
    def get_context(bottleneck_data: Dict, service_id: str, 
                   services: Dict[str, Dict]) -> Dict[str, str]:
        """Get additional context for bottleneck.
        
        Args:
            bottleneck_data: Bottleneck details
            service_id: Service UUID
            services: Service definitions
            
        Returns:
            Context dict with service info
        """
        service = services.get(service_id, {})
        
        return {
            'service_name': service.get('naam', 'Unknown'),
            'service_code': service.get('code', '?'),
            'service_duration': service.get('duur', '?'),
            'date': bottleneck_data['date'],
            'dagdeel': bottleneck_data['dagdeel'],
            'need': str(bottleneck_data['need']),
            'assigned': str(bottleneck_data['assigned']),
            'shortage': str(bottleneck_data['shortage'])
        }


class ReasonsEnum:
    """Standard bottleneck reason strings (in German)."""
    
    NO_CAPABILITY = "Keine geschulten Mitarbeiter für diesen Service verfügbar"
    ALL_BLOCKED = "Alle geschulten Mitarbeiter sind blockiert"
    WORKLOAD_EXCEEDED = "Alle verfügbaren Mitarbeiter haben bereits maximale Schichten"
    INSUFFICIENT_CAPACITY = "Nicht genügend verfügbare Mitarbeiter"
    UNKNOWN = "Unbekannte Engpass-Ursache"


class SuggestionsEnum:
    """Standard suggestion strings (in German)."""
    
    TRAIN_MORE = "Schulen Sie weitere Mitarbeiter in diesem Service"
    CHECK_BLOCKS = "Prüfen Sie die Blockierungen und mögliche Konflikte"
    RAISE_LIMIT = "Erhöhen Sie das Schichtlimit oder verteilen Sie die Anforderung"
    REDUCE_NEED = "Reduzieren Sie die Personalanforderung für diesen Slot"
    MANUAL_REVIEW = "Dies erfordert manuelle Überprüfung und Entscheidung"
