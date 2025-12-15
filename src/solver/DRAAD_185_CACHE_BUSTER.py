"""Cache buster for Greedy Engine V0.2 deployment.

DRAA D 185-2: Forces Railway to rebuild when this file changes.
Datum: 2025-12-15 17:55 CET (STAP 5 Update)
Timestamp: 2025-12-15T17:55:30Z

Random seed: f4e8d2b7
Deployment: DRAAD-185-solver-selector-verification

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver
  4. Ensures fresh Greedy Engine code with HC1-HC6
  5. STAP 5: Solver Selector now has GREEDY as default

Usage:
  from src.solver.DRAAD_185_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f"Greedy Engine V0.2 with GREEDY-default-selector loaded (Cache: {CACHE_KEY})")
"""

import time
from datetime import datetime

# Force new cache on each generation - STAP 5 update
CACHE_KEY = f"greedy-engine-stap5-{int(time.time() * 1000)}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-185-5-v0.2-updated"
DEPLOYMENT_ID = "f4e8d2b7-greedy-stap5-2025-12-15"
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
        'status': 'GREEDY-ENGINE-V0.2-WITH-SOLVER-SELECTOR-VERIFIED',
        'random_buster': RANDOM_BUSTER,
        'date': '2025-12-15',
        'step': 'DRAAD-185-5',
        'description': 'Cache update for Solver Selector GREEDY default verification'
    }

if __name__ == '__main__':
    print("DRAAD-185 Cache Buster V0.2 - STAP 5 Updated")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
    print(f"Random Buster: {RANDOM_BUSTER}")
    print(f"Timestamp: {TIMESTAMP}")
