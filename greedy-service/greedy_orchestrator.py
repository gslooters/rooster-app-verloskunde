#!/usr/bin/env python3
"""
GREEDY Alternatieve Werkwijze - Main Orchestration Module

Coordinates the complete workflow:
1. LOAD: Data initialization
2. PROCESS: Algorithm execution
3. WRITE: Database persistence
4. VERIFY: Constraint validation
5. REPORT: Result analysis

Status: PRODUCTION-READY
"""

import os
import sys
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from loader import DataLoader
from processor import GreedyProcessor
from writer import BatchWriter
from trigger_verify import TriggerVerifier
from reporter import Reporter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/greedy_orchestration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class GreedyOrchestrator:
    """
    Main orchestration engine for GREEDY processing.
    
    Manages complete workflow:
    - Phase 1: Load workspace data
    - Phase 2: Execute core algorithm
    - Phase 3: Write results to database
    - Phase 4: Verify constraints and triggers
    - Phase 5: Generate comprehensive report
    
    Attributes:
        rooster_id (str): Target rooster UUID
        workspace: Current WorkspaceState
        start_time: Execution start timestamp
        result: Final execution result
    """
    
    def __init__(self, rooster_id: str):
        """
        Initialize orchestrator.
        
        Args:
            rooster_id: UUID of rooster to process
        
        Raises:
            ValueError: If rooster_id is empty
        """
        if not rooster_id:
            raise ValueError("rooster_id cannot be empty")
        
        self.rooster_id = rooster_id
        self.workspace = None
        self.start_time = None
        self.result = None
    
    def execute(self) -> Dict[str, Any]:
        """
        Execute complete GREEDY processing workflow.
        
        Implements 5-phase processing:
        1. LOAD: Initialize workspace from database
        2. PROCESS: Execute GREEDY algorithm
        3. WRITE: Persist results to database
        4. VERIFY: Validate constraints and triggers
        5. REPORT: Generate analysis and recommendations
        
        Returns:
            Dictionary containing:
            - success: Boolean execution status
            - workspace: Final WorkspaceState
            - report: Comprehensive execution report
            - metrics: Performance metrics (timing, counts)
            - errors: Any errors encountered (if failed)
        
        Raises:
            Exception: Catches and logs errors, returns in result
        """
        
        self.start_time = datetime.now()
        
        # Print header
        self._print_header()
        
        try:
            # PHASE 1: LOAD
            logger.info("\n" + "="*70)
            logger.info("PHASE 1: LOAD - Initialize workspace")
            logger.info("="*70)
            self.workspace = self._execute_phase_load()
            if self.workspace is None:
                return self._result_error("Phase 1 LOAD failed")
            
            # PHASE 2: PROCESS
            logger.info("\n" + "="*70)
            logger.info("PHASE 2: PROCESS - Execute GREEDY algorithm")
            logger.info("="*70)
            self.workspace = self._execute_phase_process()
            if self.workspace is None:
                return self._result_error("Phase 2 PROCESS failed")
            
            # PHASE 3: WRITE
            logger.info("\n" + "="*70)
            logger.info("PHASE 3: WRITE - Persist to database")
            logger.info("="*70)
            write_result = self._execute_phase_write()
            if not write_result:
                return self._result_error("Phase 3 WRITE failed")
            
            # PHASE 4: VERIFY
            logger.info("\n" + "="*70)
            logger.info("PHASE 4: VERIFY - Validate constraints")
            logger.info("="*70)
            verify_result = self._execute_phase_verify()
            if not verify_result:
                logger.warning("Phase 4 VERIFY: Some validations failed")
            
            # PHASE 5: REPORT
            logger.info("\n" + "="*70)
            logger.info("PHASE 5: REPORT - Generate analysis")
            logger.info("="*70)
            report = self._execute_phase_report()
            
            # Success result
            runtime = (datetime.now() - self.start_time).total_seconds()
            self.result = {
                'success': True,
                'workspace': self.workspace,
                'report': report,
                'metrics': {
                    'runtime_seconds': runtime,
                    'total_needed': self.workspace.total_needed,
                    'total_assigned': self.workspace.total_assigned,
                    'total_open': self.workspace.total_needed - self.workspace.total_assigned,
                    'coverage_percent': (
                        100 * self.workspace.total_assigned / self.workspace.total_needed
                        if self.workspace.total_needed > 0 else 0
                    ),
                },
                'write_result': write_result,
                'verify_result': verify_result,
            }
            
            # Print summary
            self._print_execution_summary()
            
            return self.result
            
        except Exception as e:
            logger.exception(f"Fatal error in orchestration: {e}")
            return self._result_error(str(e))
    
    def _execute_phase_load(self) -> Optional[Any]:
        """
        Phase 1: Load workspace from database.
        
        Returns:
            WorkspaceState if successful, None if failed
        """
        
        try:
            logger.info(f"Loading rooster {self.rooster_id}...")
            loader = DataLoader(self.rooster_id)
            workspace = loader.load_workspace()
            
            logger.info(f"✅ Phase 1 complete. Workspace initialized.")
            return workspace
            
        except Exception as e:
            logger.error(f"❌ Phase 1 failed: {e}")
            return None
    
    def _execute_phase_process(self) -> Optional[Any]:
        """
        Phase 2: Execute GREEDY algorithm.
        
        Returns:
            Updated WorkspaceState if successful, None if failed
        """
        
        try:
            logger.info(f"Processing {len(self.workspace.tasks)} tasks...")
            processor = GreedyProcessor(self.workspace)
            workspace = processor.process()
            
            logger.info(f"✅ Phase 2 complete. {workspace.total_assigned} assignments created.")
            return workspace
            
        except Exception as e:
            logger.error(f"❌ Phase 2 failed: {e}")
            return None
    
    def _execute_phase_write(self) -> bool:
        """
        Phase 3: Write results to database.
        
        Returns:
            True if write successful, False otherwise
        """
        
        try:
            logger.info(f"Writing {self.workspace.total_assigned} assignments to database...")
            writer = BatchWriter(self.workspace)
            result = writer.write_assignments()
            
            if result['success']:
                logger.info(f"✅ Phase 3 complete. {result['written']} records written.")
                return True
            else:
                logger.error(f"❌ Phase 3 write failed: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Phase 3 failed: {e}")
            return False
    
    def _execute_phase_verify(self) -> bool:
        """
        Phase 4: Verify constraints and database triggers.
        
        Returns:
            True if verification passed, False otherwise
        """
        
        try:
            logger.info("Verifying database triggers and constraints...")
            verifier = TriggerVerifier(self.workspace)
            result = verifier.verify_all_triggers()
            
            if result['success']:
                logger.info(f"✅ Phase 4 complete. All constraints verified.")
                return True
            else:
                logger.warning(f"⚠️  Phase 4: Verification issues detected: {result.get('details', [])}")
                return False
                
        except Exception as e:
            logger.warning(f"⚠️  Phase 4 verification error: {e}")
            return False
    
    def _execute_phase_report(self) -> Dict[str, Any]:
        """
        Phase 5: Generate comprehensive report.
        
        Returns:
            Report dictionary
        """
        
        try:
            logger.info("Generating execution report...")
            reporter = Reporter(self.workspace)
            report = reporter.generate()
            
            logger.info(f"✅ Phase 5 complete. Report generated.")
            
            # Print report to console
            reporter.print_summary()
            
            return report
            
        except Exception as e:
            logger.error(f"❌ Phase 5 failed: {e}")
            return {}
    
    def _print_header(self):
        """
        Print execution header.
        """
        
        print("\n" + "="*70)
        print("🚀 GREEDY ALTERNATIEVE WERKWIJZE - ROOSTER INGEVULD")
        print("="*70)
        print(f"Start Time: {self.start_time}")
        print(f"Rooster ID: {self.rooster_id}")
        print("="*70 + "\n")
    
    def _print_execution_summary(self):
        """
        Print execution summary.
        """
        
        if not self.result or not self.result['success']:
            return
        
        metrics = self.result['metrics']
        runtime = metrics['runtime_seconds']
        
        print("\n" + "="*70)
        print("✏️  EXECUTION SUMMARY")
        print("="*70)
        print(f"Runtime: {runtime:.2f} seconds")
        print(f"Coverage: {metrics['coverage_percent']:.1f}%")
        print(f"Assigned: {metrics['total_assigned']}/{metrics['total_needed']}")
        print(f"Open: {metrics['total_open']}")
        print("="*70 + "\n")
    
    def _result_error(self, error_msg: str) -> Dict[str, Any]:
        """
        Create error result dictionary.
        
        Args:
            error_msg: Error message
        
        Returns:
            Error result dictionary
        """
        
        runtime = (
            (datetime.now() - self.start_time).total_seconds()
            if self.start_time else 0
        )
        
        return {
            'success': False,
            'error': error_msg,
            'runtime_seconds': runtime,
            'workspace': self.workspace,
        }


def main():
    """
    Main entry point for GREEDY orchestrator.
    
    Reads rooster_id from environment variable ROOSTER_ID.
    Executes complete GREEDY workflow.
    
    Exit codes:
    - 0: Success
    - 1: Configuration error
    - 2: Execution error
    """
    
    # Verify Supabase configuration
    required_env = ['SUPABASE_URL', 'SUPABASE_KEY', 'ROOSTER_ID']
    for var in required_env:
        if not os.getenv(var):
            logger.error(f"❌ Missing environment variable: {var}")
            sys.exit(1)
    
    rooster_id = os.getenv('ROOSTER_ID')
    
    try:
        # Execute orchestrator
        orchestrator = GreedyOrchestrator(rooster_id)
        result = orchestrator.execute()
        
        # Exit with status
        if result['success']:
            logger.info("\n✅ GREEDY execution SUCCESSFUL")
            sys.exit(0)
        else:
            logger.error(f"\n❌ GREEDY execution FAILED: {result.get('error')}")
            sys.exit(2)
            
    except KeyboardInterrupt:
        logger.warning("\nExecution interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Fatal error: {e}", exc_info=True)
        sys.exit(2)


if __name__ == '__main__':
    main()
