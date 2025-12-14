#!/usr/bin/env python3
# DRAAD 181: Greedy Planning Engine
# Fast, transparent roster generation without OR-Tools CP-SAT

# Legacy imports (kept for compatibility)
from .requirement_queue import Requirement, RequirementQueue
from .employee_availability import EmployeeAvailabilityTracker
from .sequential_solver import SequentialSolver, Assignment
from .assignment_report import AssignmentReport

# New Greedy Engine (DRAAD-181)
from .greedy_engine import (
    GreedyRosteringEngine,
    Employee,
    RosterAssignment,
    Bottleneck,
    EmployeeCapability,
    RosteringRequirement
)
from .bottleneck_analyzer import (
    BottleneckAnalyzer,
    ReasonsEnum,
    SuggestionsEnum
)
from .DRAAD_181_CACHE_BUSTER import (
    CACHE_KEY,
    VERSION,
    DEPLOYMENT_ID,
    get_cache_version,
    log_deployment
)

__all__ = [
    # Legacy
    'Requirement',
    'RequirementQueue',
    'EmployeeAvailabilityTracker',
    'SequentialSolver',
    'Assignment',
    'AssignmentReport',
    # DRAAD-181 Greedy Engine
    'GreedyRosteringEngine',
    'Employee',
    'RosterAssignment',
    'Bottleneck',
    'EmployeeCapability',
    'RosteringRequirement',
    'BottleneckAnalyzer',
    'ReasonsEnum',
    'SuggestionsEnum',
    'CACHE_KEY',
    'VERSION',
    'DEPLOYMENT_ID',
    'get_cache_version',
    'log_deployment'
]

__version__ = '1.1.0'  # Updated for Greedy Engine
__description__ = 'Greedy Rostering Engine (DRAAD-181)'
__status__ = 'PRODUCTION-READY'
__deployment__ = DEPLOYMENT_ID
