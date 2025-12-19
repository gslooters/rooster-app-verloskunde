# GREEDY Service - Roster Scheduling Greedy Algorithm

**Status:** FASE 1 FOUNDATION BASELINE ✅  
**Version:** 0.1.0  
**Date:** 2025-12-19  

## Overview

GREEDY Service implements an efficient greedy algorithm for automatic roster scheduling. It replaces the inefficient re-read pattern with a load-once workspace model.

### Key Characteristics
- **Load-Once Pattern:** Single data load into in-memory workspace
- **No Database I/O Until End:** Clean-slate restart semantics
- **Per-Service Fairness:** Quota-based fair distribution
- **Pairing Support:** DIODDO pairing with blocking calendars
- **Performance Target:** 10 minutes for 5-week roster

## FASE 1: Foundation Baseline

Completed deliverables for database schema verification and data loading:

### Files Implemented

- **`models.py`** - Data structures
  - `ServiceTask` - Staffing requirement record
  - `Assignment` - Roster assignment record
  - `WorkspaceState` - Complete processing state

- **`loader.py`** - Supabase data loading
  - `DataLoader` class
  - Workspace initialization
  - Task sorting per specification

- **`tests/test_baseline.py`** - Database verification
  - 6 comprehensive schema tests
  - Data count validation
  - Connection testing

## Database Schema

FASE 1 verifies these Supabase tables:

| Table | Purpose | Status |
|-------|---------|--------|
| roosters | Rooster periods | ✅ |
| rosterperiodstaffingdagdelen | Staffing requirements | ✅ |
| rosteremployeeservices | Employee capabilities | ✅ |
| rosterassignments | Assignments (planning) | ✅ |
| servicetypes | Service definitions | ✅ |
| employees | Employee records | ✅ |

## Running Tests

### Prerequisites
```bash
cd greedy-service
pip install -r requirements.txt
```

### Baseline Verification
```bash
# Set environment variables
export SUPABASE_URL="https://rzecogncpkjfytebfkni.supabase.co"
export SUPABASE_KEY="eyJ..."  # From Railway secrets
export ROOSTER_ID="<uuid>"    # Rooster to verify

# Run baseline test
python -m pytest tests/test_baseline.py -v
```

### Expected Output
```
======================================================================
FASE 1: BASELINE VERIFICATION
======================================================================

TEST 1: Verify rooster record exists...
  ✓ Rooster found

TEST 2: Verify staffing requirements...
  ✓ Found 2835 staffing requirement records

TEST 3: Verify employee services...
  ✓ Found 106 active employee service records

TEST 4: Verify assignments...
  ✓ Found 1470 assignment records

TEST 5: Verify service types...
  ✓ Found 9 active service types

TEST 6: Verify employees...
  ✓ Found 14 active employees

✅ BASELINE VERIFICATION COMPLETE - ALL TESTS PASSED
```

## Architecture

### Workspace Model

Three separate in-memory work files:

1. **werkbestandopdracht** (tasks)
   - Source: rosterperiodstaffingdagdelen
   - Sorted by: issystem, date, dagdeel, team, servicecode
   - Status: 0=OPEN, 1=INGEVULD

2. **werkbestandcapaciteit** (capacity)
   - Source: rosteremployeeservices
   - Key: (employeeid, serviceid) -> remaining count
   - Updated: -1 per assignment

3. **werkbestandplanning** (assignments)
   - Source: rosterassignments (status 0,1)
   - Updated with GREEDY assignments
   - Blocking calendar managed

### Load Process

```
FASE 1 LOAD (execute once)
└─ Load rooster period
└─ Load staffing requirements
└─ Load employee capacity
└─ Load existing assignments
└─ Load blocked slots
```

## Next Phases

### FASE 2: Core Algorithm
- Eligibility checking
- Per-service fairness selection
- Main processing loop

### FASE 3: Pairing Logic
- DIODDO pairing validation
- Blocking calendar management

### FASE 4: Database Integration
- Batch write to Supabase
- Trigger verification

### FASE 5: Orchestration
- Reporter generation
- Main entry point

## Environment Variables

Required for deployment on Railway:

```bash
SUPABASE_URL=https://rzecogncpkjfytebfkni.supabase.co
SUPABASE_KEY=<from Railway secrets>
ROOSTER_ID=<rooster UUID>
ENVIRONMENT=production
```

## Development

### Code Quality
- Type hints throughout
- Comprehensive docstrings
- Error handling for all I/O
- Verbose logging

### Testing Strategy
- Unit tests per module (FASE 2+)
- Integration tests with Supabase
- End-to-end roster generation tests

## Performance Target

- **Input:** 227 required shifts, 14 employees, 5 weeks
- **Capacity:** 246 available slots
- **Target Runtime:** 10 minutes
- **Current:** FASE 1 baseline only

## Support

For issues or questions:
1. Check logs in Railway dashboard
2. Run baseline test to verify data
3. Trace execution with print statements
4. Contact development team

## Version History

- **0.1.0-fase1** - Foundation Baseline (2025-12-19)
  - Database schema verification
  - Data loading implementation
  - Workspace model definition
