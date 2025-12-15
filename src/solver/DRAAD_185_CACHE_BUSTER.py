"""Cache buster for Greedy Engine V0.2 deployment.

DRAD 185: Forces Railway to rebuild when this file changes.
Datum: 2025-12-15
Timestamp: 2025-12-15T17:35:00Z

Random seed: a9f3e2c7
Deployment: DRAAD-185-greedy-v0.2-cache-bust

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver
  4. Ensures fresh Greedy Engine code

Usage:
  from src.solver.DRAAD_185_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f\"Greedy Engine V0.2 loaded (Cache: {CACHE_KEY})\")
"""

import time
from datetime import datetime

# Force new cache on each generation
CACHE_KEY = f"greedy-engine-v0.2-{datetime.now().timestamp()}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-185-v0.2"
DEPLOYMENT_ID = "a9f3e2c7-greedy-v0.2-2025-12-15"
RANDOM_BUSTER = 1734272100

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
        'status': 'GREEDY-ENGINE-V0.2-ACTIVE',
        'random_buster': RANDOM_BUSTER,
        'date': '2025-12-15'
    }

if __name__ == '__main__':
    print("DRAAD-185 Cache Buster V0.2 Active")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
    print(f"Random Buster: {RANDOM_BUSTER}")
