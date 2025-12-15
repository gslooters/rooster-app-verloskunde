"""Cache buster for DRAAD 185-5: Solver Selector verification and cache busting.

STAP 5: UPDATE src/solver/solver_selector.py - GREEDY as default
Datum: 2025-12-15 17:55 CET
Timestamp: 2025-12-15T17:55:00Z

Random seed: a7f2e9c1
Deployment: DRAAD-185-5-solver-selector-greedy-default

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver selector
  4. Ensures GREEDY is selected as default solver

Usage:
  from src.solver.DRAAD_185_5_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f"Solver Selector with GREEDY default loaded (Cache: {CACHE_KEY})")
"""

import time
from datetime import datetime

# Force new cache on each generation - STAP 5 execution
CACHE_KEY = f"solver-selector-greedy-default-{int(time.time())}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-185-5-v1.0"
DEPLOYMENT_ID = "a7f2e9c1-solver-selector-greedy-2025-12-15"
RANDOM_BUSTER = int(time.time() * 1000) % 999999  # Unique per generation

# This ensures each import gets fresh timestamp
def get_cache_version():
    """Get current cache version string."""
    return f"{VERSION}-{int(time.time())}"

def log_deployment():
    """Log deployment info."""
    return {
        'deployment_id': DEPLOYMENT_ID,
        'version': VERSION,
        'timestamp': TIMESTAMP,
        'cache_key': CACHE_KEY,
        'status': 'SOLVER-SELECTOR-GREEDY-DEFAULT-ACTIVE',
        'random_buster': RANDOM_BUSTER,
        'date': '2025-12-15',
        'step': 'DRAAD-185-5',
        'description': 'Solver Selector Update - GREEDY becomes default'
    }

if __name__ == '__main__':
    print("DRAAD-185-5 Cache Buster - Solver Selector with GREEDY Default")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
    print(f"Random Buster: {RANDOM_BUSTER}")
    print(f"Timestamp: {TIMESTAMP}")
