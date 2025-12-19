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
    RosteringRequirement,
    SolveResult
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
from .DRAAD_217_CACHE_BUSTER import (
    CACHE_KEY as CACHE_KEY_217,
    VERSION as VERSION_217,
    DEPLOYMENT_ID as DEPLOYMENT_ID_217,
    get_cache_version as get_cache_version_217,
    log_deployment as log_deployment_217
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
    'SolveResult',
    'BottleneckAnalyzer',
    'ReasonsEnum',
    'SuggestionsEnum',
    # DRAAD-181 Cache Buster
    'CACHE_KEY',
    'VERSION',
    'DEPLOYMENT_ID',
    'get_cache_version',
    'log_deployment',
    # DRAAD-217 Cache Buster (Restoration)
    'CACHE_KEY_217',
    'VERSION_217',
    'DEPLOYMENT_ID_217',
    'get_cache_version_217',
    'log_deployment_217'
]

__version__ = '1.1.1'  # Updated for DRAAD-217 Restoration
__description__ = 'Greedy Rostering Engine (DRAAD-181 + DRAAD-217 Restoration)'
__status__ = 'PRODUCTION-READY'
__deployment__ = DEPLOYMENT_ID_217  # Use latest cache buster
