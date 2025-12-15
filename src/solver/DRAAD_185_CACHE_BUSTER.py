"""Cache buster for Greedy Engine V0.2 deployment.

DRAAD 185-2: Forces Railway to rebuild when this file changes.
Datum: 2025-12-15 17:44 CET
Timestamp: 2025-12-15T16:44:00Z

Random seed: b3f8c4d9
Deployment: DRAAD-185-2-greedy-hc-constraints

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver
  4. Ensures fresh Greedy Engine code with HC1-HC6

Usage:
  from src.solver.DRAAD_185_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f\"Greedy Engine V0.2 loaded (Cache: {CACHE_KEY})\")
"""

import time
from datetime import datetime

# Force new cache on each generation
CACHE_KEY = f"greedy-engine-v0.2-hc-{datetime.now().timestamp()}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-185-2-v0.2"
DEPLOYMENT_ID = "b3f8c4d9-greedy-hc-2025-12-15"
RANDOM_BUSTER = 1734284640  # Updated for STAP 2

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
        'status': 'GREEDY-ENGINE-V0.2-HC-CONSTRAINTS-ACTIVE',
        'random_buster': RANDOM_BUSTER,
        'date': '2025-12-15',
        'step': 'DRAAD-185-2'
    }

if __name__ == '__main__':
    print("DRAAD-185-2 Cache Buster V0.2 with HC1-HC6 Active")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
    print(f"Random Buster: {RANDOM_BUSTER}")
