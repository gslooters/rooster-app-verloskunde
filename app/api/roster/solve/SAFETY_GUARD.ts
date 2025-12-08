/**
 * SAFETY GUARD: Prevent DELETE from roster_assignments
 * 
 * This guard ensures that roster_assignments table is protected from
 * destructive DELETE operations.
 * 
 * CRITICAL RULE (ABSOLUTE):
 * ❌ NEVER: DELETE FROM roster_assignments
 * ✅ ALWAYS: UPSERT or UPDATE
 * 
 * Impact of violation:
 * - DRAAD134: 1365 → 231 records (1134 lost)
 * - Data loss is PERMANENT
 * - Planner assignments destroyed
 * 
 * This guard will log and alert if any DELETE is detected
 */

import { NextRequest } from 'next/server';

interface DeleteDetection {
  detected: boolean;
  severity: 'CRITICAL';
  message: string;
  action: 'BLOCK' | 'LOG';
}

/**
 * Runtime detection of DELETE statements in code
 * (This is a defensive measure for code review)
 */
export function detectDeleteStatement(sourceCode: string): DeleteDetection {
  const deletePatterns = [
    /\.delete\(\)/gi,
    /DELETE\s+FROM\s+roster_assignments/gi,
    /supabase\.from\('roster_assignments'\)\.delete\(\)/gi
  ];
  
  for (const pattern of deletePatterns) {
    if (pattern.test(sourceCode)) {
      return {
        detected: true,
        severity: 'CRITICAL',
        message: '🚨 DELETE statement detected on roster_assignments',
        action: 'BLOCK'
      };
    }
  }
  
  return {
    detected: false,
    severity: 'CRITICAL',
    message: '✅ No DELETE statement found - SAFE',
    action: 'LOG'
  };
}

/**
 * Logs safety rule at startup
 */
export function logSafetyRule(): void {
  console.log('\n' + '='.repeat(70));
  console.log('🔒 ROSTER_ASSIGNMENTS SAFETY GUARD ACTIVE');
  console.log('='.repeat(70));
  console.log('RULE: roster_assignments records are NEVER deleted');
  console.log('WHY:  This table is the heart of the application');
  console.log('HOW:  Only UPSERT or UPDATE operations allowed');
  console.log('');
  console.log('VIOLATION HISTORY:');
  console.log('  DRAAD134: DELETE from status=0 → lost 1134 records');
  console.log('  DRAAD135: Rollback implemented, UPSERT restored');
  console.log('='.repeat(70) + '\n');
}

/**
 * Alert if DELETE is attempted
 */
export function alertDeleteAttempt(context: string): void {
  const alertMessage = `
🚨 CRITICAL ALERT: DELETE ATTEMPT DETECTED
   Context: ${context}
   Action: BLOCKED
   Reason: roster_assignments is write-protected
   Status: Contact admin immediately
  `;
  
  console.error(alertMessage);
  throw new Error('[SAFETY_GUARD] DELETE from roster_assignments is forbidden');
}

/**
 * Verify UPSERT is being used (defensive check)
 */
export function verifyUpsertMethod(methodName: string): boolean {
  const upsertMethods = ['upsert', 'UPSERT', 'onConflict', 'ignoreDuplicates'];
  return upsertMethods.some(method => methodName.includes(method));
}
