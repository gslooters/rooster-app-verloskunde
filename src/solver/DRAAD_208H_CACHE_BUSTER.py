# DRAAD 208H CACHE BUSTER
# Date: 2025-12-18 10:52:00 UTC
# Random: 4829301
# Purpose: Force Railway to reload GREEDY modules after bug fixes

# All DRAAD 208H fixes applied:
# ✅ FIX 1: shifts_assigned_in_current_run now PER-SERVICE
# ✅ FIX 2: API status case fixed (lowercase 'success')
# ✅ FIX 3: Result field names corrected
# ✅ FIX 4: Sorting direction fixed (reverse=True)
# ✅ FIX 5: Cache clearing enabled
# ✅ FIX 6: Exception handling for constraint_checker

CACHE_BUSTER = "2025-12-18T10:52:00Z_4829301"

def get_buster():
    return CACHE_BUSTER
