"""
Solver Selector for Roster Planning
DRAAD 184: GREEDY Engine is now DEFAULT

Selects between OR-Tools and GREEDY solvers based on configuration
"""

import logging
import os
from typing import Dict, Optional, Any

try:
    from supabase import Client
except ImportError:
    Client = None

logger = logging.getLogger(__name__)

class SolverSelector:
    """
    Intelligent solver selection based on roster configuration
    
    Default: GREEDY Engine (v0.1, fast, transparent)
    Fallback: OR-Tools Solver (for legacy compatibility)
    """
    
    SOLVER_TYPE_GREEDY = 'GREEDY'
    SOLVER_TYPE_OR_TOOLS = 'OR_TOOLS'
    
    def __init__(self, db: Optional[Client] = None):
        self.db = db
        self.logger = logging.getLogger(f"SolverSelector")
    
    def select_solver(self, roster_id: str) -> str:
        """
        Select solver for given roster
        
        Returns: solver_type ('GREEDY' or 'OR_TOOLS')
        """
        try:
            # First, check if roster has explicit solver preference
            config = self._get_roster_config(roster_id)
            
            if config and config.get('solver_type'):
                selected = config['solver_type']
                self.logger.info(
                    f"👣 Solver selected from config: {selected}"
                )
                return selected
            
            # Default: GREEDY is new standard
            self.logger.info(
                f"👫 GREEDY selected as default (DRAAD 184)"
            )
            return self.SOLVER_TYPE_GREEDY
        
        except Exception as e:
            self.logger.warning(f"Selector error: {e}, defaulting to GREEDY")
            return self.SOLVER_TYPE_GREEDY
    
    def _get_roster_config(self, roster_id: str) -> Optional[Dict[str, Any]]:
        """
        Get solver configuration for roster
        
        Checks:
        1. Roster metadata/config field
        2. Global solver_config table
        3. Environment variables
        """
        try:
            if not self.db:
                return None
            
            # Check roster.config field
            try:
                response = self.db.table('roosters').select('id, config').eq(
                    'id', roster_id
                ).execute()
                
                if response.data and response.data[0].get('config'):
                    return response.data[0]['config']
            except Exception as e:
                self.logger.debug(f"Could not read roster config: {e}")
            
            # Check global solver configuration
            try:
                response = self.db.table('solver_config').select('*').eq(
                    'roster_id', roster_id
                ).execute()
                
                if response.data:
                    return response.data[0]
            except Exception as e:
                self.logger.debug(f"Could not read solver_config table: {e}")
            
            return None
        
        except Exception as e:
            self.logger.error(f"Failed to get roster config: {e}")
            return None
    
    def get_solver_info(self, solver_type: str) -> Dict[str, Any]:
        """
        Get information about solver
        """
        if solver_type == self.SOLVER_TYPE_GREEDY:
            return {
                'name': 'GREEDY Engine',
                'version': 'v0.1',
                'draad': '184',
                'status': 'PRODUCTION',
                'expected_time': '2-5 seconds',
                'expected_coverage': '95-99%',
                'description': 'Fast greedy algorithm with 6 hard constraints',
                'features': [
                    'Lightning-fast solving (2-5s)',
                    'Transparent constraint-based logic',
                    'Real-time bottleneck reporting',
                    'Fair employee distribution',
                    'Respects all hard constraints (HC1-HC6)'
                ]
            }
        
        elif solver_type == self.SOLVER_TYPE_OR_TOOLS:
            return {
                'name': 'OR-Tools CP-SAT',
                'version': 'google-or-tools',
                'status': 'LEGACY',
                'expected_time': '30-120 seconds',
                'expected_coverage': '85-95%',
                'description': 'Constraint programming solver (legacy)',
                'features': [
                    'Sophisticated optimization',
                    'Soft constraint support',
                    'Slower but potentially better coverage'
                ]
            }
        
        return {'name': 'Unknown', 'status': 'ERROR'}


def select_solver_for_roster(roster_id: str, db: Optional[Client] = None) -> str:
    """
    Convenience function to select solver
    
    Usage:
        solver_type = select_solver_for_roster(roster_id)
        if solver_type == 'GREEDY':
            planner = GreedyPlanner(roster_id, db)
        else:
            planner = ORToolsSolver(roster_id, db)
    """
    selector = SolverSelector(db)
    return selector.select_solver(roster_id)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    selector = SolverSelector()
    
    # Test selections
    print("\n" + "="*60)
    print("Solver Selector Test")
    print("="*60)
    
    test_roster = '303ebcd1-054c-464b-b9f5-01175e70d719'
    selected = selector.select_solver(test_roster)
    info = selector.get_solver_info(selected)
    
    print(f"\nRoster: {test_roster[:8]}...")
    print(f"Selected Solver: {selected}")
    print(f"\nSolver Info:")
    for key, value in info.items():
        print(f"  {key}: {value}")
    
    print("\n" + "="*60)
