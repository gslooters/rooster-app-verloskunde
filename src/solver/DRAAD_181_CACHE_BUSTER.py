"""Cache buster for Greedy Engine deployment.

DRAD 181: Forces Railway to rebuild when this file changes.
Updated: 2025-12-15 (DRAAD 185)

Random seed: f7c4a9e3
Timestamp: 2025-12-15T17:35:30Z
Deployment: DRAAD-185-update-cache-bust

How it works:
  1. This file is imported in main app
  2. When deployed to Railway, changes trigger rebuild
  3. New cache prevents serving old solver
  4. Ensures fresh Greedy Engine code

Usage:
  from src.solver.DRAAD_181_CACHE_BUSTER import CACHE_KEY, TIMESTAMP
  
  # In your Flask/FastAPI app startup:
  logger.info(f\"Greedy Engine loaded (Cache: {CACHE_KEY})\")
"""

import time
from datetime import datetime

# Force new cache on each generation
CACHE_KEY = f"greedy-engine-{datetime.now().timestamp()}"
TIMESTAMP = datetime.utcnow().isoformat()
VERSION = "DRAAD-181-v1.1-updated"
DEPLOYMENT_ID = "f7c4a9e3-greedy-pivot-2025-12-15-updated"
RANDOM_BUSTER = 1734272130

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
        'status': 'GREEDY-ENGINE-ACTIVE',
        'random_buster': RANDOM_BUSTER,
        'updated': '2025-12-15'
    }

if __name__ == '__main__':
    print("DRAAD-181 Cache Buster Active (Updated)")
    print(f"Cache Key: {CACHE_KEY}")
    print(f"Version: {VERSION}")
    print(f"Deployment: {DEPLOYMENT_ID}")
    print(f"Random Buster: {RANDOM_BUSTER}")
