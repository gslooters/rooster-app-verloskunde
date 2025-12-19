"""
FASE 1: FOUNDATION BASELINE
Verify all required tables and data exist in Supabase
"""

import os
import sys
from datetime import datetime

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase library not installed")
    sys.exit(1)


def verify_baseline():
    """Verify all required tables and data exist."""

    # Get environment variables
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    ROOSTER_ID = os.getenv("ROOSTER_ID")

    if not all([SUPABASE_URL, SUPABASE_KEY, ROOSTER_ID]):
        print("ERROR: Missing environment variables")
        print(f"  SUPABASE_URL: {bool(SUPABASE_URL)}")
        print(f"  SUPABASE_KEY: {bool(SUPABASE_KEY)}")
        print(f"  ROOSTER_ID: {bool(ROOSTER_ID)}")
        return False

    try:
        client = Client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to create Supabase client: {e}")
        return False

    print("="*70)
    print("FASE 1: BASELINE VERIFICATION")
    print("="*70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"ROOSTER_ID: {ROOSTER_ID}")
    print()

    results = {}
    all_passed = True

    # Test 1: Rooster exists
    print("TEST 1: Verify rooster record exists...")
    try:
        rooster = client.table("roosters").select("*").eq("id", ROOSTER_ID).execute()
        if len(rooster.data) > 0:
            r = rooster.data[0]
            print(f"  ✓ Rooster found")
            print(f"    - ID: {r.get('id')}")
            print(f"    - Start: {r.get('startdate')}")
            print(f"    - End: {r.get('enddate')}")
            print(f"    - Status: {r.get('status')}")
            results["rooster"] = True
        else:
            print(f"  ✗ Rooster not found for ID: {ROOSTER_ID}")
            results["rooster"] = False
            all_passed = False
    except Exception as e:
        print(f"  ✗ Error querying roosters: {e}")
        results["rooster"] = False
        all_passed = False
    print()

    # Test 2: Staffing requirements exist
    print("TEST 2: Verify staffing requirements (rosterperiodstaffingdagdelen)...")
    try:
        staffing = client.table("rosterperiodstaffingdagdelen").select("*").eq(
            "rosterid", ROOSTER_ID
        ).execute()
        count = len(staffing.data)
        if count > 0:
            print(f"  ✓ Found {count} staffing requirement records")
            # Show sample
            s = staffing.data[0]
            print(f"    - Sample: date={s.get('date')}, dagdeel={s.get('dagdeel')}, "
                  f"team={s.get('team')}, aantal={s.get('aantal')}")
            results["staffing"] = True
        else:
            print(f"  ✗ No staffing requirements found")
            results["staffing"] = False
            all_passed = False
    except Exception as e:
        print(f"  ✗ Error querying staffing: {e}")
        results["staffing"] = False
        all_passed = False
    print()

    # Test 3: Employee services exist
    print("TEST 3: Verify employee services (rosteremployeeservices)...")
    try:
        empservices = (
            client.table("rosteremployeeservices")
            .select("*")
            .eq("rosterid", ROOSTER_ID)
            .eq("actief", True)
            .execute()
        )
        count = len(empservices.data)
        if count > 0:
            print(f"  ✓ Found {count} active employee service records")
            # Show sample
            e = empservices.data[0]
            print(f"    - Sample: employeeid={e.get('employeeid')}, "
                  f"serviceid={e.get('serviceid')}, aantal={e.get('aantal')}")
            results["employee_services"] = True
        else:
            print(f"  ✗ No employee services found")
            results["employee_services"] = False
            all_passed = False
    except Exception as e:
        print(f"  ✗ Error querying employee services: {e}")
        results["employee_services"] = False
        all_passed = False
    print()

    # Test 4: Assignments exist (pre-planning)
    print("TEST 4: Verify assignments (rosterassignments)...")
    try:
        assignments = (
            client.table("rosterassignments")
            .select("*")
            .eq("rosterid", ROOSTER_ID)
            .execute()
        )
        total = len(assignments.data)
        active = sum(1 for a in assignments.data if a.get("status") == 1)
        blocked = sum(1 for a in assignments.data if a.get("status") == 2)
        print(f"  ✓ Found {total} assignment records (active={active}, blocked={blocked})")
        results["assignments"] = True
    except Exception as e:
        print(f"  ✗ Error querying assignments: {e}")
        results["assignments"] = False
        all_passed = False
    print()

    # Test 5: Service types exist
    print("TEST 5: Verify service types (servicetypes)...")
    try:
        services = client.table("servicetypes").select("*").eq("actief", True).execute()
        count = len(services.data)
        if count > 0:
            print(f"  ✓ Found {count} active service types")
            # Show sample
            s = services.data[0]
            print(f"    - Sample: code={s.get('code')}, naam={s.get('naam')}, "
                  f"issystem={s.get('issystem')}")
            results["services"] = True
        else:
            print(f"  ✗ No service types found")
            results["services"] = False
            all_passed = False
    except Exception as e:
        print(f"  ✗ Error querying service types: {e}")
        results["services"] = False
        all_passed = False
    print()

    # Test 6: Employees exist
    print("TEST 6: Verify employees...")
    try:
        employees = (
            client.table("employees")
            .select("*")
            .eq("actief", True)
            .execute()
        )
        count = len(employees.data)
        if count > 0:
            print(f"  ✓ Found {count} active employees")
            # Show sample
            e = employees.data[0]
            print(f"    - Sample: id={e.get('id')}, voornaam={e.get('voornaam')}, "
                  f"team={e.get('team')}")
            results["employees"] = True
        else:
            print(f"  ✗ No employees found")
            results["employees"] = False
            all_passed = False
    except Exception as e:
        print(f"  ✗ Error querying employees: {e}")
        results["employees"] = False
        all_passed = False
    print()

    # Summary
    print("="*70)
    print("BASELINE VERIFICATION SUMMARY")
    print("="*70)
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {test_name}")
    print()

    if all_passed:
        print("✓ BASELINE VERIFICATION COMPLETE - ALL TESTS PASSED")
        return True
    else:
        print("✗ BASELINE VERIFICATION FAILED - SEE ERRORS ABOVE")
        return False


if __name__ == "__main__":
    success = verify_baseline()
    sys.exit(0 if success else 1)
