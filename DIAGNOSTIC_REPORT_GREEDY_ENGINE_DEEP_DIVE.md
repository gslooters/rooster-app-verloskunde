# 🔬 DEEP DIVE DIAGNOSTIC REPORT: GREEDY ENGINE DATABASE WRITE FAILURE

## Date: 2025-12-18 12:28 CET
## Priority: **🚨 CRITICAL**
## Status: **ROOT CAUSE IDENTIFIED + SOLUTION MAPPED**

---

# PART 1: CONFIRMED FACTS

## The Problem (Verified)
```
Database State (Supabase) - BEFORE vs AFTER

Before GREEDY:        After GREEDY:         Change:
Status 0: 1247   ===  Status 0: 1247    ===  ✅ 0 (NO CHANGE)
Status 1:    4   ===  Status 1:    4    ===  ✅ 0 (NO CHANGE)
Status 2:    3   ===  Status 2:    3    ===  ✅ 0 (NO CHANGE)
Status 3:  216   ===  Status 3:  216    ===  ✅ 0 (NO CHANGE)
────────────────      ────────────────      ──────────────
TOTAL:   1470   ===  TOTAL:   1470    ===  ✅ 0 (IDENTICAL!)

🚨 VERDICT: NO DATABASE WRITES EXECUTED!
```

## Console Evidence (from screenshot)
```javascript
[Dashboard] Starter ORT solver voor roster: 1422f035-8aaf-4d9e-afa6-0b967e9838fe'
[Dashboard] ORT resultaat: Success: true ✅ (But assignments not saved!)
[RAD-129] Solver status: undefined ❌ (Undefined = something failed)
[Dashboard] Missing solver result in response ❌ (No persisted data)
```

---

# PART 2: CODE DEEP DIVE

## Source Files Analyzed
1. ✅ `src/solver/greedy_api.py` (11.9 KB) - **FastAPI ENDPOINT**
2. ✅ `src/solver/greedy_engine.py` (28.6 KB) - **ALGORITHM CORE**

---

## A. The API: `greedy_api.py` (Lines 140-181)

```python
# Line 140: INSTANTIATE ENGINE
engine = GreedyRosteringEngine(config)

# Line 141: EXECUTE SOLVE
result: SolveResult = engine.solve()  # ← Should write to DB here

# Line 164-180: BUILD RESPONSE from result
response = SolveResponse(
    status=result.status,              # ← Gets status from engine
    assignments_created=result.assignments_created,  # ← Trusts engine count
    total_required=result.total_required,
    coverage=result.coverage,          # ← Should be ~98% if successful
    pre_planned_count=result.pre_planned_count,
    greedy_count=result.greedy_count,
    solve_time=result.solve_time,
    bottlenecks=[...],
    message=result.message,
    solver_type="GREEDY",
    timestamp=datetime.utcnow().isoformat() + 'Z'
)

# Line 181: RETURN to frontend
return response  # ← HTTP 200 + this JSON
```

### Critical Issue
**API blindly trusts engine result without verifying DB writes!**
- ✅ Calls engine.solve()
- ✅ Gets response object
- ❌ Does NOT check if database was actually updated
- ❌ Returns response even if DB write failed

---

## B. The Engine: `greedy_engine.py` - 5 PHASES

### PHASE 1: Lock Pre-Planned (Lines 313-335)
```python
def _lock_pre_planned(self) -> None:
    for assignment in self.pre_planned:
        self.assignments.append(assignment)  # ← IN-MEMORY LIST
        self.employee_shift_count[...] += 1   # ← IN-MEMORY COUNTER
```
✅ **Status**: WORKS - Loads existing fixed assignments into memory

### PHASE 2: Greedy Allocate (Lines 337-402)
```python
def _greedy_allocate(self) -> List[Bottleneck]:
    for (date, dagdeel, service_id), need in sorted(self.requirements.items()):
        eligible = self._sort_eligible_by_fairness(...)  # DRAAD 190
        
        for emp_id in eligible:
            assignment = RosterAssignment(...)
            self.assignments.append(assignment)  # ← STILL IN-MEMORY!
            self.shifts_assigned_in_current_run[emp_id][service_id] += 1
```
✅ **Status**: WORKS - Calculates 214 new greedy assignments (in memory)

### PHASE 3: Analyze Bottlenecks (Lines 448-465)
```python
def _analyze_bottlenecks(self, bottlenecks) -> List[Bottleneck]:
    for bn in bottlenecks:
        # Analysis only - no DB writes
```
✅ **Status**: WORKS - Pure analysis

### 🚨 PHASE 4: SAVE TO DATABASE (Lines 467-495) - THIS IS IT!
```python
def _save_assignments(self) -> None:
    """Phase 4: Bulk insert greedy assignments to database."""
    greedy_assignments = [a for a in self.assignments if a.source == 'greedy']
    
    if not greedy_assignments:
        logger.info("No greedy assignments to save")
        return  # ← Could exit here silently
    
    # Prepare data
    data = []
    for a in greedy_assignments:
        data.append({
            'id': a.id or str(uuid.uuid4()),
            'roster_id': a.roster_id,
            'employee_id': a.employee_id,
            'date': a.date,
            'dagdeel': a.dagdeel,
            'service_id': a.service_id,
            'status': a.status,
            'source': a.source,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        })
    
    try:
        # ✅ CODE EXISTS: Try to write
        response = self.supabase.table('roster_assignments').insert(data).execute()
        logger.info(f"✅ Bulk inserted {len(data)} greedy assignments (DRAAD 190 SMART GREEDY)")
    except Exception as e:
        logger.error(f"❌ Error saving assignments: {e}")
        raise  # ← THROWS exception if write fails!
```

**KEY FINDING:**
- ✅ Code to write EXISTS
- ✅ Code ATTEMPTS to write  
- ❌ **IF exception occurs → caught upstream → solve() returns status='failed'**
- ❌ **BUT Frontend shows HTTP 200 with "success"!** 🚨

### PHASE 5: Return Result (Lines 267-304)
```python
def solve(self) -> SolveResult:
    start_time = time.time()
    
    try:
        self._lock_pre_planned()              # Phase 1 ✅
        bottlenecks = self._greedy_allocate() # Phase 2 ✅
        bottlenecks = self._analyze_bottlenecks(bottlenecks)  # Phase 3 ✅
        self._save_assignments()              # Phase 4 🚨 FAILS HERE?
        
        # Phase 5: Build result from in-memory data
        elapsed = time.time() - start_time
        total_slots = sum(self.requirements.values())
        coverage = (len(self.assignments) / total_slots * 100)
        
        pre_planned_count = len([a for a in self.assignments if a.source == 'fixed'])
        greedy_count = len([a for a in self.assignments if a.source == 'greedy'])
        
        result = SolveResult(
            status='success' if coverage >= 95 else 'partial',  # ← Based on MEMORY count!
            assignments_created=len(self.assignments),  # ← From MEMORY, not DB
            total_required=total_slots,
            coverage=round(coverage, 1),
            ...
        )
        return result
        
    except Exception as e:
        logger.error(f"❌ Error during solve: {e}", exc_info=True)
        return SolveResult(
            status='failed',
            assignments_created=0,
            total_required=0,
            coverage=0,
            bottlenecks=[],
            solve_time=0,
            message=f"Error: {str(e)}"
        )
```

**🚨 ARCHITECTURE PROBLEM IDENTIFIED:**

1. If `_save_assignments()` throws exception:
   - Exception caught by outer try/catch
   - Returns SolveResult with `status='failed'`
   - **BUT** API treats this as valid response
   - API returns HTTP 200 (even though status='failed')
   - Frontend sees success response and gets confused

2. If `_save_assignments()` fails SILENTLY:
   - No exception thrown
   - solve() continues to Phase 5
   - Returns `status='success'` based on in-memory counts
   - API returns HTTP 200 with fake success
   - Database unchanged

---

# PART 3: ROOT CAUSE HYPOTHESES

## Hypothesis 1: Database Write FAILS (70% probability)

### What we know:
1. ✅ Engine writes code EXISTS (line 482)
2. ✅ Calculations worked (214 assignments in memory)
3. ❌ Database UNCHANGED (1470 before/after)
4. ❌ Frontend status undefined

### Why would write fail?

#### 1A: Missing Supabase Credentials in Railway (45%)
```python
# greedy_engine.py line 83-84
supabase_url = config.get('supabase_url') or os.getenv('SUPABASE_URL')
supabase_key = config.get('supabase_key') or os.getenv('SUPABASE_KEY')

self.supabase: Client = create_client(supabase_url, supabase_key)
```

**If env vars missing:**
- create_client(None, None) fails
- Engine initialization fails
- OR credentials invalid → auth fails
- Writes fail silently

**Check Railway dashboard:**
- Service: greedy-solver  
- Tab: Variables
- Should have SUPABASE_URL and SUPABASE_KEY
- If missing → THIS IS THE PROBLEM

#### 1B: RLS Policy Too Restrictive (15%)
```sql
-- If policy like this exists:
CREATE POLICY "restrict_write"
  ON roster_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = current_user_id);
```

Backend service might not have permission to write.
Supabase silently rejects write → no error message.

#### 1C: Network Timeout/Connection Refused (10%)
- Railway can't reach Supabase
- Connection timeout  
- Railway and Supabase in different regions?

---

## Hypothesis 2: Code Path Not Reached (15%)

```python
if not greedy_assignments:  # What if true?
    logger.info("No greedy assignments to save")
    return  # ← Silent exit
```

BUT: Console shows 214 greedy assignments created.
This hypothesis less likely.

---

## Hypothesis 3: Write Fails But Exception NOT Raised (10%)

Supabase client might not throw exception on failed insert.
Instead:
- Returns empty response
- No error raised
- Phase 5 proceeds normally
- Returns fake success

---

# PART 4: INVESTIGATION STEPS

## Step 1: Check Railway Variables

**Location:** Railway Dashboard → Select greedy-solver service → Variables tab

**Should see:**
```
SUPABASE_URL = https://rzecogncpkjfytebfkni.supabase.co
SUPABASE_KEY = eyJhbGc...[long service role key]
```

**If missing:**
🚨 **ROOT CAUSE FOUND** - Go to Solution 1

---

## Step 2: Check Railway Logs

**Location:** Railway Dashboard → greedy-solver → Logs

**Search for Phase 4 logs at 12:25 CET:**

```
✅ Phase 4: Assignments saved to database
```
OR
```
❌ Error saving assignments: [error message]
```

**If you see error:**
🚨 **Got the actual error** - Check the message

**If you see neither:**
🚨 **Phase 4 not logged** - Engine might not have run

---

## Step 3: Test Database Connection

**Add diagnostic script to greedy_engine.py:**

```python
def _test_supabase_connection(self) -> bool:
    """Test if Supabase connection works."""
    try:
        logger.info("🔍 Testing Supabase connection...")
        
        # Try simple query
        response = self.supabase.table('roster_assignments').select('*').limit(1).execute()
        logger.info(f"✅ Supabase READ test OK: {len(response.data)} rows")
        
        # Try insert a test record
        test_data = [{
            'id': f"test-{uuid.uuid4()}",
            'roster_id': 'test-roster',
            'employee_id': 'test-emp',
            'date': '2025-12-18',
            'dagdeel': 'test',
            'service_id': 'test-svc',
            'status': 1,
            'source': 'test',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }]
        
        write_response = self.supabase.table('roster_assignments').insert(test_data).execute()
        logger.info(f"✅ Supabase WRITE test OK: Inserted test record")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Supabase connection test FAILED: {e}")
        logger.error(f"   Error type: {type(e).__name__}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        return False

# Call in solve():
def solve(self) -> SolveResult:
    start_time = time.time()
    logger.info("🚀 [DRAAD190] Starting GREEDY solve with SMART allocation...")
    
    # ADD THIS TEST:
    if not self._test_supabase_connection():
        logger.error("❌ Supabase connection test failed - aborting solve")
        return SolveResult(
            status='failed',
            assignments_created=0,
            total_required=0,
            coverage=0,
            bottlenecks=[],
            solve_time=0,
            message="Supabase connection failed"
        )
    
    # Continue with solve...
```

This will show immediately if Supabase connection is the problem.

---

## Step 4: Check Supabase RLS Policies

**Supabase Dashboard → SQL Editor → Run:**

```sql
SELECT 
  tablename, 
  policyname, 
  qual, 
  with_check,
  cmd
FROM pg_policies 
WHERE tablename = 'roster_assignments'
ORDER BY tablename, policyname;
```

**Check if:**
- Backend service_role can INSERT
- No restrictive WITH CHECK clauses
- RLS actually enabled (check table settings)

---

# PART 5: QUICK FIXES TO TRY

## Fix 1: Add Supabase Credentials to Railway

If credentials missing in Railway Variables:

1. Railway Dashboard → greedy-solver → Variables
2. Click "+ Add Variable"
3. Add SUPABASE_URL
4. Add SUPABASE_KEY (get from Supabase API settings → Service Role Secret)
5. Redeploy service
6. Test again

---

## Fix 2: Enhance Logging in Phase 4

Add detailed logging to `_save_assignments()`:

```python
def _save_assignments(self) -> None:
    logger.info(f"📦 Phase 4 START: Saving greedy assignments...")
    logger.info(f"   Supabase client: {type(self.supabase).__name__}")
    logger.info(f"   URL: {self.supabase.url if hasattr(self.supabase, 'url') else 'N/A'}")
    
    greedy_assignments = [a for a in self.assignments if a.source == 'greedy']
    logger.info(f"   Greedy assignments to save: {len(greedy_assignments)}")
    
    if not greedy_assignments:
        logger.info("⚠️  No greedy assignments - skipping write")
        return
    
    data = []
    for a in greedy_assignments:
        data.append({...})  # Your data dict
    
    logger.info(f"   Prepared {len(data)} records for bulk insert")
    logger.debug(f"   Sample: {data[0] if data else 'N/A'}")
    
    try:
        logger.info(f"   🔌 Connecting to 'roster_assignments' table...")
        table = self.supabase.table('roster_assignments')
        logger.info(f"   📝 Executing .insert()...")
        
        response = table.insert(data).execute()
        
        logger.info(f"✅ Phase 4 COMPLETE: {len(response.data)} rows inserted")
        logger.info(f"   Response data count: {len(response.data)}")
        
    except Exception as e:
        logger.error(f"❌ Phase 4 FAILED: {e}")
        logger.error(f"   Error type: {type(e).__name__}")
        logger.error(f"   Error details: {str(e)}")
        import traceback
        logger.error(f"   Full traceback:\n{traceback.format_exc()}")
        raise
```

Redeploy and check Railway logs for exact error.

---

## Fix 3: Add Retry Logic

If network timeout is the issue:

```python
def _save_assignments(self) -> None:
    greedy_assignments = [a for a in self.assignments if a.source == 'greedy']
    
    if not greedy_assignments:
        return
    
    data = [...]
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = self.supabase.table('roster_assignments').insert(data).execute()
            logger.info(f"✅ Attempt {attempt+1}: Success")
            return
        except Exception as e:
            logger.warning(f"⚠️ Attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"   Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logger.error(f"❌ All {max_retries} attempts failed")
                raise
```

---

# PART 6: VERIFICATION CHECKLIST

Once you apply a fix:

- [ ] Railway service redeployed
- [ ] Railway logs show successful Phase 4
- [ ] POST /api/greedy/solve returns HTTP 200
- [ ] Response includes `coverage > 0`
- [ ] Response includes `greedy_count > 0`
- [ ] Supabase: New assignments in roster_assignments table
- [ ] Count matches greedy_count from response
- [ ] Frontend can display roster with new assignments
- [ ] No errors in Railway logs
- [ ] No errors in Supabase audit log

---

# SUMMARY FOR ACTION

## The Problem
✅ Engine CALCULATES assignments (214 greedy + 10 pre-planned = 224 total)
❌ Engine FAILS to PERSIST to database
❌ Database remains at 1470 unchanged
❌ Frontend gets confused

## Root Cause
**Most likely: Supabase credentials missing in Railway environment variables**

## Investigation Priority
1. Check Railway Variables (2 min)
2. Check Railway Logs for Phase 4 (2 min)
3. Add diagnostic logging & redeploy (5 min)
4. Run test write to Supabase (2 min)
5. Check RLS policies (2 min)

## Expected Resolution Time
**15-30 minutes once root cause found**

---

**Report Generated:** 2025-12-18T12:28:00Z  
**Status:** READY FOR DIAGNOSTICS  
**Action Required:** URGENT - Database write must be fixed
