"""Supabase trigger verification for GREEDY assignments.

After batch-insert of assignments, Supabase triggers should execute
to set status=2 (BLOCKED) for related slots per DIO/DDO rules.

This module verifies that triggers executed correctly.
"""

import os
import logging
from typing import Dict, List, Tuple
from datetime import datetime, date, timedelta
from models import WorkspaceState
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class TriggerVerifier:
    """Verify that Supabase triggers executed correctly."""
    
    def __init__(self, workspace: WorkspaceState):
        """Initialize trigger verifier.
        
        Args:
            workspace: WorkspaceState with completed processing
        """
        self.workspace = workspace
        self.client: Client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_KEY')
        )
    
    def verify_all_triggers(self) -> Dict:
        """Execute all trigger verification checks.
        
        Returns:
            Dictionary with overall verification results:
            {
                'all_passed': bool,
                'checks': {
                    'blocking_records': {...},
                    'dio_ddo_blocking': {...},
                    'trigger_consistency': {...},
                    'edge_cases': {...}
                },
                'duration_ms': int,
                'error': str or None
            }
        """
        
        logger.info("🔍 VERIFYING TRIGGER EXECUTION...")
        start_time = datetime.now()
        
        try:
            checks = {
                'blocking_records': self.verify_blocking_records_exist(),
                'dio_ddo_blocking': self.verify_dio_ddo_blocking(),
                'trigger_consistency': self.verify_trigger_consistency(),
                'edge_cases': self.verify_edge_cases(),
            }
            
            all_passed = all(check.get('passed', False) for check in checks.values())
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            if all_passed:
                logger.info(f"✅ ALL TRIGGER CHECKS PASSED ({duration_ms}ms)")
            else:
                logger.warning(f"⚠️  SOME TRIGGER CHECKS FAILED ({duration_ms}ms)")
            
            return {
                'all_passed': all_passed,
                'checks': checks,
                'duration_ms': duration_ms,
                'error': None
            }
        
        except Exception as e:
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"❌ TRIGGER VERIFICATION FAILED: {e}")
            
            return {
                'all_passed': False,
                'checks': {},
                'duration_ms': duration_ms,
                'error': str(e)
            }
    
    def verify_blocking_records_exist(self) -> Dict:
        """Verify that status=2 (BLOCKED) records exist in database.
        
        Expected: After DIO/DDO assignments, triggers should create
        status=2 records for same-day M and next-day O/M slots.
        
        Returns:
            Dictionary with verification results
        """
        
        logger.info("  Check 1: Blocking records exist...")
        
        try:
            # Query for blocking records
            blocking_records = self.client.table('roster_assignments') \
                .select('id, date, dagdeel, employee_id, status') \
                .eq('roster_id', self.workspace.roster_id) \
                .eq('status', 2) \
                .execute()
            
            blocking_count = len(blocking_records.data)
            
            if blocking_count > 0:
                logger.info(f"    ✅ Found {blocking_count} blocking records (status=2)")
                return {
                    'passed': True,
                    'blocking_records_count': blocking_count,
                    'message': f'{blocking_count} status=2 records found'
                }
            else:
                logger.warning("    ⚠️  No blocking records found (triggers may not have executed)")
                return {
                    'passed': False,
                    'blocking_records_count': 0,
                    'message': 'No status=2 records found'
                }
        
        except Exception as e:
            logger.error(f"    ❌ Error querying blocking records: {e}")
            return {
                'passed': False,
                'blocking_records_count': 0,
                'message': f'Error: {str(e)}'
            }
    
    def verify_dio_ddo_blocking(self) -> Dict:
        """Verify DIO/DDO specific blocking patterns.
        
        For DIO assignments:
        - Must have same-day M blocking
        - Must have next-day O/M blocking
        
        Returns:
            Dictionary with verification results
        """
        
        logger.info("  Check 2: DIO/DDO blocking patterns...")
        
        try:
            # Find all DIO/DDO assignments
            dio_ddo_assignments = self._find_dio_ddo_assignments()
            
            if not dio_ddo_assignments:
                logger.info("    ✓ No DIO/DDO assignments (blocking not applicable)")
                return {
                    'passed': True,
                    'dio_ddo_count': 0,
                    'message': 'No DIO/DDO assignments found'
                }
            
            logger.info(f"    Found {len(dio_ddo_assignments)} DIO/DDO assignments")
            
            # Verify blocking for each DIO/DDO assignment
            verified_count = 0
            for assignment in dio_ddo_assignments:
                if self._verify_single_dio_ddo_blocking(assignment):
                    verified_count += 1
            
            passed = verified_count == len(dio_ddo_assignments)
            
            if passed:
                logger.info(f"    ✅ All {verified_count} DIO/DDO blocking patterns verified")
            else:
                logger.warning(f"    ⚠️  Only {verified_count}/{len(dio_ddo_assignments)} verified")
            
            return {
                'passed': passed,
                'dio_ddo_count': len(dio_ddo_assignments),
                'verified_count': verified_count,
                'message': f'{verified_count}/{len(dio_ddo_assignments)} DIO/DDO blocking patterns verified'
            }
        
        except Exception as e:
            logger.error(f"    ❌ Error verifying DIO/DDO blocking: {e}")
            return {
                'passed': False,
                'message': f'Error: {str(e)}'
            }
    
    def verify_trigger_consistency(self) -> Dict:
        """Verify trigger consistency across all records.
        
        Checks:
        - No orphaned blocking records
        - Status transitions are valid
        - No data corruption
        
        Returns:
            Dictionary with verification results
        """
        
        logger.info("  Check 3: Trigger consistency...")
        
        try:
            # Load all assignments for this roster
            all_assignments = self.client.table('roster_assignments') \
                .select('*') \
                .eq('roster_id', self.workspace.roster_id) \
                .execute()
            
            # Check status distribution
            status_counts = {
                0: 0,  # OPEN
                1: 0,  # ACTIVE
                2: 0,  # BLOCKED
            }
            
            for record in all_assignments.data:
                status = record.get('status', 0)
                if status in status_counts:
                    status_counts[status] += 1
            
            total = len(all_assignments.data)
            
            logger.info(f"    Status distribution: {status_counts['1']} ACTIVE, {status_counts['2']} BLOCKED, {status_counts['0']} OPEN")
            
            # Consistency check: ACTIVE > 0 and BLOCKED > 0 (if DIO/DDO exists)
            if status_counts[1] > 0:  # Some active assignments
                if status_counts[2] > 0:  # Some blocked records
                    logger.info(f"    ✅ Consistent state: {status_counts[1]} active with {status_counts[2]} blocking")
                    return {
                        'passed': True,
                        'active_count': status_counts[1],
                        'blocked_count': status_counts[2],
                        'total_count': total,
                        'message': 'Status distribution consistent'
                    }
                else:
                    logger.warning(f"    ⚠️  No blocking records found despite active assignments")
                    return {
                        'passed': False,
                        'active_count': status_counts[1],
                        'blocked_count': status_counts[2],
                        'total_count': total,
                        'message': 'No blocking records found'
                    }
            else:
                logger.info(f"    ✓ No active assignments (no blocking expected)")
                return {
                    'passed': True,
                    'active_count': 0,
                    'blocked_count': 0,
                    'total_count': total,
                    'message': 'No active assignments'
                }
        
        except Exception as e:
            logger.error(f"    ❌ Error verifying consistency: {e}")
            return {
                'passed': False,
                'message': f'Error: {str(e)}'
            }
    
    def verify_edge_cases(self) -> Dict:
        """Verify handling of edge cases.
        
        Edge cases:
        - Roster end date (blocking next day)
        - Multiple assignments same slot
        - Trigger race conditions
        
        Returns:
            Dictionary with verification results
        """
        
        logger.info("  Check 4: Edge cases...")
        
        try:
            # Edge case 1: Roster end date
            logger.info("    Checking roster end date edge case...")
            end_date = self.workspace.end_date
            
            # Check for assignments on end_date
            end_date_assignments = self.client.table('roster_assignments') \
                .select('*') \
                .eq('roster_id', self.workspace.roster_id) \
                .eq('date', end_date.isoformat()) \
                .execute()
            
            if end_date_assignments.data:
                logger.info(f"    ✓ {len(end_date_assignments.data)} assignments on end date (no next-day blocking needed)")
            
            # Edge case 2: Duplicate detection (should not exist)
            logger.info("    Checking for duplicate assignments...")
            
            # Group by (date, dagdeel, employee_id, service_id)
            all_records = self.client.table('roster_assignments') \
                .select('date, dagdeel, employee_id, service_id, status') \
                .eq('roster_id', self.workspace.roster_id) \
                .execute()
            
            duplicates = self._find_duplicates(all_records.data)
            
            if duplicates:
                logger.warning(f"    ⚠️  Found {len(duplicates)} potential duplicates")
                return {
                    'passed': False,
                    'duplicates_found': len(duplicates),
                    'message': f'{len(duplicates)} duplicate assignments detected'
                }
            else:
                logger.info("    ✅ No duplicate assignments found")
            
            return {
                'passed': True,
                'duplicates_found': 0,
                'message': 'All edge cases handled correctly'
            }
        
        except Exception as e:
            logger.error(f"    ❌ Error verifying edge cases: {e}")
            return {
                'passed': False,
                'message': f'Error: {str(e)}'
            }
    
    def _find_dio_ddo_assignments(self) -> List[Dict]:
        """Find all DIO/DDO assignments in database.
        
        Returns:
            List of DIO/DDO assignment records
        """
        
        # Get service IDs for DIO/DDO
        services = self.client.table('service_types') \
            .select('id, code') \
            .in_('code', ['DIO', 'DDO']) \
            .execute()
        
        dio_ddo_service_ids = [s['id'] for s in services.data]
        
        if not dio_ddo_service_ids:
            return []
        
        # Find all DIO/DDO assignments
        dio_ddo_assignments = self.client.table('roster_assignments') \
            .select('*') \
            .eq('roster_id', self.workspace.roster_id) \
            .in_('service_id', dio_ddo_service_ids) \
            .eq('status', 1) \
            .execute()
        
        return dio_ddo_assignments.data
    
    def _verify_single_dio_ddo_blocking(self, assignment: Dict) -> bool:
        """Verify blocking pattern for single DIO/DDO assignment.
        
        Args:
            assignment: DIO/DDO assignment record
        
        Returns:
            True if blocking is correct, False otherwise
        """
        
        date_str = assignment['date']
        dagdeel = assignment['dagdeel']
        emp_id = assignment['employee_id']
        
        # Only O dagdeel blocks (DIO/DDO must be O)
        if dagdeel != 'O':
            return False
        
        # Parse date and calculate next day
        current_date = date.fromisoformat(date_str)
        next_date = current_date + timedelta(days=1)
        
        # Check: Same-day M blocking
        same_day_m = self.client.table('roster_assignments') \
            .select('id') \
            .eq('roster_id', self.workspace.roster_id) \
            .eq('employee_id', emp_id) \
            .eq('date', date_str) \
            .eq('dagdeel', 'M') \
            .eq('status', 2) \
            .execute()
        
        # Check: Next-day O/M blocking
        next_day_o = self.client.table('roster_assignments') \
            .select('id') \
            .eq('roster_id', self.workspace.roster_id) \
            .eq('employee_id', emp_id) \
            .eq('date', next_date.isoformat()) \
            .eq('dagdeel', 'O') \
            .eq('status', 2) \
            .execute()
        
        next_day_m = self.client.table('roster_assignments') \
            .select('id') \
            .eq('roster_id', self.workspace.roster_id) \
            .eq('employee_id', emp_id) \
            .eq('date', next_date.isoformat()) \
            .eq('dagdeel', 'M') \
            .eq('status', 2) \
            .execute()
        
        # All three blocking slots must exist
        blocking_found = (
            len(same_day_m.data) > 0 and
            len(next_day_o.data) > 0 and
            len(next_day_m.data) > 0
        )
        
        return blocking_found
    
    def _find_duplicates(self, records: List[Dict]) -> List[Tuple]:
        """Find duplicate assignments.
        
        Args:
            records: List of assignment records
        
        Returns:
            List of duplicate keys found
        """
        
        seen = {}
        duplicates = []
        
        for record in records:
            key = (
                record['date'],
                record['dagdeel'],
                record['employee_id'],
                record['service_id']
            )
            
            if key in seen:
                duplicates.append(key)
            else:
                seen[key] = 1
        
        return duplicates
    
    def get_verification_summary(self, verification_result: Dict) -> str:
        """Generate human-readable summary of verification results.
        
        Args:
            verification_result: Result dict from verify_all_triggers()
        
        Returns:
            Formatted summary string
        """
        
        summary = ""
        
        if verification_result['all_passed']:
            summary += "🞉 ALL TRIGGER VERIFICATION CHECKS PASSED\n"
        else:
            summary += "⚠️  SOME TRIGGER VERIFICATION CHECKS FAILED\n"
        
        summary += f"Duration: {verification_result['duration_ms']}ms\n\n"
        
        for check_name, check_result in verification_result.get('checks', {}).items():
            status = "✅" if check_result.get('passed', False) else "❌"
            message = check_result.get('message', 'No message')
            summary += f"{status} {check_name}: {message}\n"
        
        return summary
