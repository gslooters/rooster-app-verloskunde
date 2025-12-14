"""Cache buster for Greedy Engine deployment.

DRAD 181: Forces Railway to rebuild when this file changes.

Random seed: d1a7e9f2
Timestamp: 2025-12-14T20:33:00Z
Deployment: DRAAD-181-greedy-pivot

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver
  4. Ensures fresh Greedy Engine code

Usage:
  from src.solver.DRAAD_181_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f"Greedy Engine loaded (Cache: {CACHE_KEY})")
"""

import time
from datetime import datetime

# Force new cache on each generation
CACHE_KEY = f"greedy-engine-{datetime.now().timestamp()}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-181-v1.0"
DEPLOYMENT_ID = "d1a7e9f2-greedy-pivot-2025-12-14"

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
        'status': 'GREEDY-ENGINE-ACTIVE'
    }

if __name__ == '__main__':
    print("DRAAD-181 Cache Buster Active")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
