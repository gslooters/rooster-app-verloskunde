"""Database batch writer for GREEDY assignments.

Handles efficient batch-insert of processed assignments to Supabase
after GREEDY processing is complete.
"""

import os
import logging
from typing import List, Dict, Tuple
from datetime import datetime
from models import Assignment, WorkspaceState
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class BatchWriter:
    """Write workspace back to database in batch."""
    
    def __init__(self, workspace: WorkspaceState):
        """Initialize batch writer.
        
        Args:
            workspace: Completed WorkspaceState with all assignments
        """
        self.workspace = workspace
        self.client: Client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
    
    def write_assignments(self) -> Dict:
        """Write all GREEDY assignments to database.
        
        Only writes assignments with status=1 (ACTIVE).
        Skips status=0 (OPEN) and status=2 (BLOCKED) records.
        
        Returns:
            Dictionary with statistics:
            {
                'written': int,     # Number of records successfully inserted
                'failed': int,       # Number of records that failed
                'duration_ms': int,  # Time taken in milliseconds
                'error': str or None # Error message if any
            }
        """
        
        logger.info("💾 Writing assignments to database...")
        start_time = datetime.now()
        
        # Prepare data for insert
        assignments_to_write = [
            a for a in self.workspace.assignments
            if a.status == 1  # ACTIVE assignments only
        ]
        
        if not assignments_to_write:
            logger.warning("⚠️  No assignments to write (status=1)")
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            return {
                'written': 0,
                'failed': 0,
                'duration_ms': duration_ms,
                'error': None
            }
        
        # Convert to database format
        db_records = self._prepare_records(assignments_to_write)
        
        # Batch insert
        try:
            logger.info(f"  Inserting {len(db_records)} records...")
            result = self.client.table('roster_assignments').insert(db_records).execute()
            
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.info(f"✅ Wrote {len(db_records)} assignments in {duration_ms}ms")
            
            return {
                'written': len(db_records),
                'failed': 0,
                'duration_ms': duration_ms,
                'error': None
            }
        
        except Exception as e:
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"❌ Write failed: {e}")
            logger.error(f"  Attempted to write {len(db_records)} records")
            
            return {
                'written': 0,
                'failed': len(db_records),
                'duration_ms': duration_ms,
                'error': str(e)
            }
    
    def write_blocking_records(self) -> Dict:
        """Write blocking assignments (status=2) to database.
        
        In GREEDYAlternatief architecture:
        - Blocking is set IN MEMORY by pairing logic
        - Status=2 records are inserted here to persist blocking
        - Supabase triggers then update related records
        
        Returns:
            Dictionary with statistics about blocking writes
        """
        
        logger.info("🔒 Writing blocking assignments...")
        start_time = datetime.now()
        
        # Prepare blocking records
        blocking_to_write = [
            a for a in self.workspace.assignments
            if a.status == 2  # BLOCKED
        ]
        
        if not blocking_to_write:
            logger.info("✓ No blocking assignments needed")
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            return {
                'written': 0,
                'failed': 0,
                'duration_ms': duration_ms,
                'error': None
            }
        
        # Convert to database format
        db_records = self._prepare_blocking_records(blocking_to_write)
        
        # Batch insert
        try:
            logger.info(f"  Inserting {len(db_records)} blocking records...")
            result = self.client.table('roster_assignments').insert(db_records).execute()
            
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.info(f"✅ Wrote {len(db_records)} blocking records in {duration_ms}ms")
            
            return {
                'written': len(db_records),
                'failed': 0,
                'duration_ms': duration_ms,
                'error': None
            }
        
        except Exception as e:
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"❌ Blocking write failed: {e}")
            
            return {
                'written': 0,
                'failed': len(db_records),
                'duration_ms': duration_ms,
                'error': str(e)
            }
    
    def _prepare_records(self, assignments: List[Assignment]) -> List[Dict]:
        """Convert Assignment objects to database insert format.
        
        Args:
            assignments: List of Assignment objects
        
        Returns:
            List of dictionaries ready for database insert
        """
        
        db_records = []
        
        for assignment in assignments:
            record = {
                'roster_id': assignment.roster_id,
                'employee_id': assignment.employee_id,
                'date': assignment.date.isoformat(),
                'dagdeel': assignment.dagdeel,
                'service_id': assignment.service_id,
                'status': assignment.status,
                'source': assignment.source,
                'created_at': datetime.now().isoformat(),
            }
            db_records.append(record)
        
        return db_records
    
    def _prepare_blocking_records(self, assignments: List[Assignment]) -> List[Dict]:
        """Convert blocking Assignment objects to database format.
        
        Blocking records are marked with status=2 to indicate
        they should be auto-managed by system (DIO/DDO rules).
        
        Args:
            assignments: List of Assignment objects with status=2
        
        Returns:
            List of dictionaries for database insert
        """
        
        db_records = []
        
        for assignment in assignments:
            record = {
                'roster_id': assignment.roster_id,
                'employee_id': assignment.employee_id,
                'date': assignment.date.isoformat(),
                'dagdeel': assignment.dagdeel,
                'service_id': assignment.service_id,
                'status': 2,  # BLOCKED
                'source': 'greedy-blocking',
                'notes': 'Auto-blocked by DIO/DDO pairing logic',
                'created_at': datetime.now().isoformat(),
            }
            db_records.append(record)
        
        return db_records
    
    def verify_write(self, expected_count: int) -> Dict:
        """Verify that written records exist in database.
        
        Queries database to confirm records were actually inserted.
        
        Args:
            expected_count: Number of records expected to be written
        
        Returns:
            Dictionary with verification results:
            {
                'verified': bool,
                'found_count': int,
                'expected_count': int,
                'error': str or None
            }
        """
        
        logger.info("🔍 Verifying written records...")
        
        try:
            # Query records for this roster
            records = self.client.table('roster_assignments') \
                .select('id') \
                .eq('roster_id', self.workspace.roster_id) \
                .eq('source', 'greedy') \
                .execute()
            
            found_count = len(records.data)
            
            if found_count >= expected_count:
                logger.info(f"✅ Verification passed: {found_count} records found (expected {expected_count})")
                return {
                    'verified': True,
                    'found_count': found_count,
                    'expected_count': expected_count,
                    'error': None
                }
            else:
                logger.warning(f"⚠️  Verification warning: {found_count} records found (expected {expected_count})")
                return {
                    'verified': False,
                    'found_count': found_count,
                    'expected_count': expected_count,
                    'error': f'Found {found_count} records, expected {expected_count}'
                }
        
        except Exception as e:
            logger.error(f"❌ Verification failed: {e}")
            return {
                'verified': False,
                'found_count': 0,
                'expected_count': expected_count,
                'error': str(e)
            }
    
    def get_write_statistics(self) -> Dict:
        """Get statistics about what will be written.
        
        Returns:
            Dictionary with counts of different record types
        """
        
        active_count = sum(1 for a in self.workspace.assignments if a.status == 1)
        blocking_count = sum(1 for a in self.workspace.assignments if a.status == 2)
        open_count = sum(1 for a in self.workspace.assignments if a.status == 0)
        
        return {
            'active_assignments': active_count,
            'blocking_assignments': blocking_count,
            'open_slots': open_count,
            'total': len(self.workspace.assignments),
            'roster_id': self.workspace.roster_id
        }
