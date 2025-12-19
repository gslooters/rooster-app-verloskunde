import time
import random

from supabase import create_client


def run_cache_bust():
    """DRAAD 216: Nieuwe cache-bust run met unieke timestamp.

    - Maakt een nieuwe entry in cache_buster table
    - Zorgt dat Railway deployment een verse versie laadt
    """
    url = "https://iyoezbvkixsyvhgvkqfc.supabase.co"
    key = "service_role_key_placeholder"
    supabase = create_client(url, key)

    payload = {
        "created_at": time.time(),
        "note": "DRAAD 216 GREEDY FIX",
        "random": random.randint(1, 1_000_000_000),
    }

    supabase.table("cache_buster").insert(payload).execute()


if __name__ == "__main__":
    run_cache_bust()
