"""
DRAAD 219B: Shortage Field Handling - Cache Buster

Date: 2025-12-20
Status: DEPLOYED

Implementation Complete:
✅ Added _get_shortage_reason() method
   - Intelligent categorization: no eligible, quota, blocking, pairing
   - All messages in Dutch language
   - No performance impact
✅ Added _get_shortage_suggestion() method
   - Actionable suggestions based on reason
   - Specific recommendations for each case
   - Customer-friendly language
✅ Added _check_all_quota_exhausted() helper
   - Checks if ALL employees out of quota for service
   - Used by reason analysis
✅ Added _check_many_blocked() helper
   - Detects >50% workforce blocked/absent
   - Identifies blocking as root cause
✅ Added _count_pairing_failures() helper
   - Counts eligible but unpaired employees
   - Used for pairing failure detection
✅ Enhanced bottleneck recording in solve()
   - Now calls reason/suggestion methods
   - Bottleneck records ALWAYS have reason + suggestion (never None)
   - Detailed logging at WARNING level

Quality Assurance:
✅ No syntax errors - Python 3.12+ compatible
✅ All methods have type hints
✅ All methods have docstrings
✅ reason field never None (always filled)
✅ suggestion field never None (always filled)
✅ All text in Dutch language
✅ Suggestions are actionable
✅ Logging at correct levels
✅ Performance: O(n) complexity, no extra database queries
✅ Backwards compatible with DRAAD 218C + DRAAD 211 v2.0

Bottleneck Structure (DRAAD 219B):
{
  'date': str,
  'dagdeel': str,
  'service_id': str,
  'need': int,
  'assigned': int,
  'shortage': int,
  'reason': str (ALWAYS FILLED - DRAAD 219B NEW),
  'suggestion': str (ALWAYS FILLED - DRAAD 219B NEW)
}

Test Cases Covered:
✅ No eligible employees✅ Quota exhausted
✅ Many blocked
✅ Partial fill
✅ Pairing failure

Related: DRAAD 219B (shortage handling)
Previous: DRAAD 218C (DIO/DDA pairing)
Next: Production testing
"""
