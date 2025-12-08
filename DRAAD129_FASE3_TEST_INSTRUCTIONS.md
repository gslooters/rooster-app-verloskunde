# 🧪 DRAAD129 FASE 3: TEST SOLVER - ORT VERIFICATION

**Status**: ✅ Ready to test  
**Expected**: All batches succeed, 1133 assignments inserted  
**Time**: ~5 minutes  

---

## 📍 CURRENT STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| **Railway Build** | ✅ SUCCESS | STAP 2 deployed |
| **SQL Migration** | ✅ SUCCESS | STAP 3 executed |
| **ORT Function** | ✅ READY | Batch processing active |
| **Test** | 🚀 NOW | Verify everything works |

---

## 🧪 TEST METHOD 1: cURL (Recommended)

Akhir bash command untuk test:

```bash
curl -X POST https://rooster-app-verloskunde.up.railway.app/api/roster/solve \
  -H "Content-Type: application/json" \
  -d '{"roster_id": "38845696-e314-4735-ae00-3080bd40dc43"}'
```

**Run in**: Terminal / Command Prompt / PowerShell

**Expected Response** (HTTP 200 - SUCCESS):
```json
{
  "success": true,
  "roster_id": "38845696-e314-4735-ae00-3080bd40dc43",
  "solver_result": {
    "status": "feasible",
    "assignments": [...1133 items...],
    "total_assignments": 1133,
    "fill_percentage": 83,
    "solve_time_seconds": 0.58
  },
  "draad129": {
    "status": "DIAGNOSTIC_PHASE_COMPLETE",
    "batch_processing": "STAP2 IMPLEMENTED - All batches processed successfully",
    "execution_timestamp": "2025-12-08T10:XX:XX.XXXZ",
    "execution_ms": 1733667XXX,
    "cache_busting": "DRAAD129-1733667XXX-XXXXX"
  },
  "draad127": {
    "status": "IMPLEMENTED",
    "deduplication": "Duplicate assignments filtered before UPSERT"
  },
  ...
}
```

---

## 🧪 TEST METHOD 2: Postman

### Setup
1. Open Postman
2. Click "+ New" → "Request"
3. Name: "Test DRAAD129 ORT Solver"

### Configuration
**METHOD**: POST  
**URL**: `https://rooster-app-verloskunde.up.railway.app/api/roster/solve`

**Headers**:
```
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "roster_id": "38845696-e314-4735-ae00-3080bd40dc43"
}
```

### Execute
1. Click **"Send"** button
2. Wait for response (~10-30 seconds)
3. Check Status: Should be **200 OK** (green)

---

## 📊 PARSE RESPONSE: What to Look For

### 1️⃣ Check HTTP Status
```
✅ 200 OK = SUCCESS
❌ 500 Internal Server Error = FAILURE
```

### 2️⃣ Check Response Body: success field
```json
{
  "success": true  // ✅ Good
  "success": false // ❌ Bad
}
```

### 3️⃣ Check Solver Status
```json
{
  "solver_result": {
    "status": "feasible"  // ✅ Good (or "optimal")
    "status": "infeasible" // ⚠️ No solution found
  }
}
```

### 4️⃣ Check Total Assignments
```json
{
  "solver_result": {
    "total_assignments": 1133  // ✅ Good (or ~1100-1133)
    "total_assignments": 0     // ❌ Nothing inserted
  }
}
```

### 5️⃣ Check DRAAD129 Info
```json
{
  "draad129": {
    "batch_processing": "STAP2 IMPLEMENTED - All batches processed successfully"
    // ✅ All batches succeeded
  }
}
```

---

## 🔍 CONSOLE LOGS: What Should Appear

Check Railway logs at: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

### Expected Logs (in order)

#### PHASE 1: Data Fetch
```
[Solver API] Start solve voor roster 38845696-e314-4735-ae00-3080bd40dc43
[Solver API] Roster gevonden: ...
[Solver API] Data verzameld: X medewerkers, Y diensten, Z bevoegdheden
```

#### PHASE 2: Solver Call
```
[Solver API] Solver request voorbereid, aanroepen http://solver:8000/api/v1/solve-schedule...
[Solver API] Solver voltooid: status=feasible, assignments=1133, tijd=0.58s
```

#### PHASE 3: DRAAD129 Diagnostic
```
[DRAAD129] === DIAGNOSTIC PHASE: Analyzing solver output for duplicates ===
[DRAAD129] Raw solver assignments: 1133 total
[DRAAD129] Execution timestamp: 2025-12-08T10:XX:XX.XXXZ | 1733667XXX
[DRAAD129] Cache busting: DRAAD129-1733667XXX-XXXXX
[DRAAD129] Sample 0: emp=EMP001, date=2025-11-24, dagdeel=O, service=mapped
[DRAAD129] Sample 1: emp=EMP002, date=2025-11-25, dagdeel=M, service=mapped
[DRAAD129] ✅ No duplicates found in raw solver output
[DRAAD129] Unique keys in solver output: 1133 / 1133
```

#### PHASE 4: DRAAD129-STAP2 Batch Processing
```
[DRAAD129-STAP2] === BATCH PROCESSING PHASE ===
[DRAAD129-STAP2] Configuration: BATCH_SIZE=50, TOTAL_ASSIGNMENTS=1133, TOTAL_BATCHES=23
[DRAAD129-STAP2] Batch 0/22: processing 50 assignments (0-49)...
[DRAAD129-STAP2] ✅ Batch 0 OK: 50 assignments inserted (total: 50)
[DRAAD129-STAP2] Batch 1/22: processing 50 assignments (50-99)...
[DRAAD129-STAP2] ✅ Batch 1 OK: 50 assignments inserted (total: 100)
[DRAAD129-STAP2] Batch 2/22: processing 50 assignments (100-149)...
[DRAAD129-STAP2] ✅ Batch 2 OK: 50 assignments inserted (total: 150)
... (repeats 23 times total)
[DRAAD129-STAP2] ✅ ALL BATCHES SUCCEEDED: 1133 total assignments inserted
```

#### PHASE 5: Status Update
```
[DRAAD118A] Roster status updated: draft → in_progress
[Solver API] Voltooid in 15234ms
```

---

## ✅ SUCCESS CRITERIA

Test is **SUCCESSFUL** if ALL these are true:

- [ ] **HTTP Status**: 200 OK (green)
- [ ] **Response.success**: true
- [ ] **solver_result.status**: "feasible" or "optimal"
- [ ] **total_assignments**: 1133 (or ~1100-1133)
- [ ] **Console logs show**: `[DRAAD129]` diagnostic phase
- [ ] **Console logs show**: `[DRAAD129-STAP2]` batch processing
- [ ] **All batches**: `✅ Batch X OK` (23 batches total)
- [ ] **Final message**: `✅ ALL BATCHES SUCCEEDED: 1133 total`
- [ ] **No errors**: No red 🔴 error messages in logs
- [ ] **Database**: Assignments inserted in roster_assignments table

---

## ❌ TROUBLESHOOTING

### Problem: HTTP 500 Error

**Response shows**:
```json
{
  "error": "[DRAAD129-STAP2] Batch UPSERT failed after X/1133 assignments",
  "details": {
    "batchErrors": [
      {"batchNum": 5, "error": "...", "assignmentCount": 50}
    ],
    "totalProcessed": 250,
    "failedBatches": 1,
    "totalBatches": 23
  }
}
```

**Solution**:
1. Note which batch failed (e.g., Batch 5)
2. Check Railway logs for error message
3. Possible causes:
   - SQL function issue (re-run STAP 3 migration)
   - Data type mismatch in assignment data
   - Foreign key constraint violation
4. Check Supabase:
   ```sql
   -- Verify function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'upsert_ort_assignments';
   ```

### Problem: Batches partially succeed

**Example**: Batch 0-5 OK, Batch 6 failed, Batch 7+ never tried

**Meaning**: Batch isolation is working! Problem is in that specific batch.

**Solution**:
1. Identify which batch number failed
2. That batch contains 50 assignments starting at index (batchNum × 50)
3. Debug that specific batch of assignments

### Problem: No console logs appear

**Cause**: Might be cached version or old container

**Solution**:
1. Hard refresh Railway: Go to Deployments, restart the service
2. Clear browser cache: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. Wait 30 seconds for Railway to boot new container
4. Retry test

### Problem: SQL Function error

**Response shows**: SQL syntax error or type mismatch

**Solution**:
1. Verify STAP 3 migration executed successfully
2. Check Supabase SQL Editor for function:
   ```sql
   SELECT routine_name, data_type 
   FROM information_schema.routines 
   WHERE routine_name = 'upsert_ort_assignments';
   ```
3. If missing, re-run the entire STAP 3 SQL migration

---

## 📊 VERIFY IN DATABASE

After successful test, verify data was inserted:

**In Supabase SQL Editor**:
```sql
-- Count assignments for this roster
SELECT COUNT(*) as total_assignments
FROM roster_assignments
WHERE roster_id = '38845696-e314-4735-ae00-3080bd40dc43'
AND source = 'ort';  -- Only ORT suggestions

-- Expected result: ~1133 rows
```

```sql
-- Check for duplicates (should be none)
SELECT roster_id, employee_id, date, dagdeel, COUNT(*)
FROM roster_assignments
WHERE roster_id = '38845696-e314-4735-ae00-3080bd40dc43'
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1;

-- Expected result: 0 rows (no duplicates!)
```

```sql
-- Check assignment sources
SELECT source, COUNT(*) as count
FROM roster_assignments
WHERE roster_id = '38845696-e314-4735-ae00-3080bd40dc43'
GROUP BY source;

-- Expected result:
-- source | count
-- ort    | ~1133
-- manual | X (existing manual assignments)
```

---

## ⏱️ EXPECTED TIMING

```
Request sent: 0s
Solver running: 0-1s (Python solver)
TypeScript processing: 1-2s (mapping, dedup)
Batch loop: 2-15s (23 × 0.5s per batch = ~11.5s)
Database updates: 15-20s (timing varies)
Total response time: 15-25 seconds
```

If taking >30s, might be solver timeout - check logs.

---

## 🎯 NEXT STEPS AFTER SUCCESS

If test PASSES ✅:
1. Log indicates all 1133 assignments inserted
2. Database shows no duplicates
3. Create commit: "DRAAD129: FASE 3 VERIFICATION COMPLETE"
4. Move to DRAAD130 (next optimization phase)

If test FAILS ❌:
1. Check error message in response
2. Check batch number that failed
3. Review troubleshooting section
4. Fix root cause
5. Retry test

---

## 🔗 USEFUL LINKS

- **Railway Logs**: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Supabase Dashboard**: https://app.supabase.com/project/rzecogncpkjfytebfkni
- **Solver Service**: http://localhost:8000 (local) or via Railway
- **API Endpoint**: https://rooster-app-verloskunde.up.railway.app/api/roster/solve

---

**Status**: 🚀 Ready to test  
**Confidence**: ⭐⭐⭐⭐⭐ (All layers working)  
**Expected Result**: ✅ ALL BATCHES SUCCEEDED
