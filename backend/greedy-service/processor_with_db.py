"""Enhanced processor with database integration support.

This is an extension to the FASE 2 processor.py that adds
FASE 4 database write operations.
"""

import logging
from datetime import date, timedelta
from typing import List, Tuple
from models import WorkspaceState, Assignment
from writer import BatchWriter
from trigger_verify import TriggerVerifier

logger = logging.getLogger(__name__)


class GreedyProcessorWithDB:
    """Enhanced GREEDY processor with database integration.
    
    Extends the core FASE 2 processor with:
    - Batch database writes
    - Trigger verification
    - Database consistency checks
    """
    
    def __init__(self, workspace: WorkspaceState, base_processor):
        """Initialize processor with DB integration.
        
        Args:
            workspace: WorkspaceState from FASE 2
            base_processor: FASE 2 GreedyProcessor instance
        """
        self.workspace = workspace
        self.base_processor = base_processor
        self.writer = None
        self.verifier = None
    
    def execute_with_database(self) -> dict:
        """Execute full GREEDY process with database integration.
        
        Flow:
        1. FASE 1-3: Load, Process, Pairing (from base processor)
        2. FASE 4A: Batch write assignments
        3. FASE 4B: Batch write blocking records
        4. FASE 4C: Verify trigger execution
        5. Return comprehensive results
        
        Returns:
            Dictionary with full execution results
        """
        
        logger.info("\n" + "="*60)
        logger.info("🚀 GREEDY WITH DATABASE INTEGRATION")
        logger.info("="*60 + "\n")
        
        result = {
            'success': False,
            'phases': {}
        }
        
        try:
            # FASE 4A: Batch write assignments
            logger.info("FASE 4A: BATCH WRITE ASSIGNMENTS")
            logger.info("-" * 40)
            
            self.writer = BatchWriter(self.workspace)
            
            # Show statistics before write
            stats = self.writer.get_write_statistics()
            logger.info(f"Write statistics:")
            logger.info(f"  Active assignments: {stats['active_assignments']}")
            logger.info(f"  Blocking assignments: {stats['blocking_assignments']}")
            logger.info(f"  Open slots: {stats['open_slots']}")
            
            # Execute write
            write_result = self.writer.write_assignments()
            result['phases']['write_assignments'] = write_result
            
            if write_result['failed'] > 0:
                logger.error(f"❌ Assignment write failed: {write_result['error']}")
                return result
            
            # FASE 4B: Batch write blocking records
            logger.info("\nFASE 4B: BATCH WRITE BLOCKING RECORDS")
            logger.info("-" * 40)
            
            blocking_result = self.writer.write_blocking_records()
            result['phases']['write_blocking'] = blocking_result
            
            if blocking_result['failed'] > 0:
                logger.error(f"❌ Blocking write failed: {blocking_result['error']}")
                # Don't return - blocking failures are not critical
            
            # FASE 4C: Verify trigger execution
            logger.info("\nFASE 4C: VERIFY TRIGGER EXECUTION")
            logger.info("-" * 40)
            
            self.verifier = TriggerVerifier(self.workspace)
            verify_result = self.verifier.verify_all_triggers()
            result['phases']['trigger_verification'] = verify_result
            
            # Summary
            logger.info("\n" + "="*60)
            logger.info("📊 DATABASE INTEGRATION SUMMARY")
            logger.info("="*60)
            
            self._print_database_summary(result)
            
            result['success'] = write_result['written'] > 0
            
            return result
        
        except Exception as e:
            logger.error(f"\n❌ DATABASE INTEGRATION FAILED: {e}")
            import traceback
            traceback.print_exc()
            result['error'] = str(e)
            return result
    
    def _print_database_summary(self, result: dict):
        """Print summary of database operations.
        
        Args:
            result: Result dictionary from execute_with_database
        """
        
        write_phase = result['phases'].get('write_assignments', {})
        blocking_phase = result['phases'].get('write_blocking', {})
        verify_phase = result['phases'].get('trigger_verification', {})
        
        logger.info(f"\n✅ DATABASE OPERATIONS:")
        logger.info(f"  Assignments written: {write_phase.get('written', 0)}")
        logger.info(f"  Assignments failed: {write_phase.get('failed', 0)}")
        logger.info(f"  Write duration: {write_phase.get('duration_ms', 0)}ms")
        
        logger.info(f"\n✅ BLOCKING OPERATIONS:")
        logger.info(f"  Blocking written: {blocking_phase.get('written', 0)}")
        logger.info(f"  Blocking failed: {blocking_phase.get('failed', 0)}")
        logger.info(f"  Write duration: {blocking_phase.get('duration_ms', 0)}ms")
        
        logger.info(f"\n✅ TRIGGER VERIFICATION:")
        if verify_phase.get('all_passed'):
            logger.info(f"  Status: ✅ ALL CHECKS PASSED")
        else:
            logger.info(f"  Status: ⚠️  SOME CHECKS FAILED")
        
        logger.info(f"  Duration: {verify_phase.get('duration_ms', 0)}ms")
        
        # Detail per check
        for check_name, check_result in verify_phase.get('checks', {}).items():
            status = "✅" if check_result.get('passed', False) else "⚠️"
            message = check_result.get('message', 'No message')
            logger.info(f"    {status} {check_name}: {message}")


class DatabaseOperationOrchestrator:
    """Orchestrate complete GREEDY execution with database integration.
    
    Coordinates:
    1. FASE 1-3: Load, Process, Pairing (via base processor)
    2. FASE 4: Database integration (via enhanced processor)
    """
    
    def __init__(self, rooster_id: str):
        """Initialize orchestrator.
        
        Args:
            rooster_id: UUID of rooster to process
        """
        self.rooster_id = rooster_id
        self.workspace = None
        self.base_processor = None
        self.db_processor = None
    
    def execute_full_pipeline(self) -> dict:
        """Execute full GREEDY pipeline including database integration.
        
        Returns:
            Dictionary with complete results from all phases
        """
        
        logger.info("\n" + "#"*60)
        logger.info("# GREEDY ROOSTER-INVULLING WITH DATABASE INTEGRATION")
        logger.info("#"*60 + "\n")
        
        results = {
            'success': False,
            'rooster_id': self.rooster_id,
            'phases': {
                'fase1_load': {},
                'fase2_process': {},
                'fase3_pairing': {},
                'fase4_database': {}
            }
        }
        
        try:
            # FASE 1-3 execution (from base processor)
            # This would be imported from existing processor.py
            # For now, showing the structure
            
            logger.info("FASE 1-3: LOAD, PROCESS, PAIRING")
            logger.info("(Execute via existing processor.py)")
            # self.workspace = loader.load_workspace()
            # self.base_processor = GreedyProcessor(self.workspace)
            # self.workspace = self.base_processor.process()
            
            # FASE 4: Database integration
            logger.info("\nFASE 4: DATABASE INTEGRATION")
            logger.info("=" * 60)
            
            self.db_processor = GreedyProcessorWithDB(
                self.workspace,
                self.base_processor
            )
            
            db_result = self.db_processor.execute_with_database()
            results['phases']['fase4_database'] = db_result
            results['success'] = db_result['success']
            
            return results
        
        except Exception as e:
            logger.error(f"\n❌ FULL PIPELINE FAILED: {e}")
            import traceback
            traceback.print_exc()
            results['error'] = str(e)
            return results
