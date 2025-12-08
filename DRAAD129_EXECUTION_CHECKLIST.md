# ✅ DRAAD129 EXECUTION CHECKLIST

## 📅 BEFORE YOU START
- [ ] Read `DRAAD129_FINAL_STATUS_REPORT.md`
- [ ] Review `DRAAD129_STAP2_DEPLOYMENT_SUMMARY.md`
- [ ] Understand the 3-layer solution (TypeScript, Batch, SQL)
- [ ] Have Supabase dashboard open
- [ ] Have Railway dashboard open

---

## 🔿 PHASE 1: WAIT FOR RAILWAY BUILD (Automatic)

**Timeline**: ~5-10 minutes

### Monitor Build Progress
- [ ] Open: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- [ ] Check: "Deployments" tab
- [ ] Look for latest deployment (should be started ~08:54 UTC)
- [ ] Wait for status: "Deploy Successful" (green checkmark)

### What's Being Built
- Next.js app with STAP 2 batch processing
- TypeScript compilation
- DRAAD129 diagnostic logging
- Cache-busting optimizations

### Success Indicators
- ✅ Build completes without errors
- ✅ Status shows "Deploy Successful"
- ✅ Timestamp shows recent (within last 15 min)
- ✅ No error messages

### If Build Fails
1. Click on failed deployment
2. Check "Build Logs" tab
3. Look for TypeScript or syntax errors
4. Contact Railway support if unclear

---

## 📋 PHASE 2: EXECUTE SQL MIGRATION (Manual)

**Timeline**: ~5 minutes  
**Prerequisite**: Railway build must complete first

### Step 1: Open Supabase SQL Editor
- [ ] Go to: https://app.supabase.com/project/rzecogncpkjfytebfkni/sql/new
- [ ] Or manually:
  1. Supabase dashboard
  2. Left menu: "SQL Editor"
  3. Click "+" New Query

### Step 2: Copy Migration SQL
- [ ] Open file: `supabase/migrations/20251208_DRAAD129_STAP3_fix_upsert_ort_assignments.sql`
- [ ] Select all content (Ctrl+A)
- [ ] Copy (Ctrl+C)

### Step 3: Paste into Supabase
- [ ] In Supabase SQL editor, click in query area
- [ ] Paste (Ctrl+V)
- [ ] You should see the SQL function creation code

### Step 4: Execute Migration
- [ ] Click blue "RUN" button (top right)
- [ ] Wait for completion (~5 seconds)

### Step 5: Verify Success
- [ ] Look for message: "Query completed successfully" (green)
- [ ] Or: "Function upsert_ort_assignments created"
- [ ] No red error messages

### If Execution Fails
1. Check error message
2. Common issues:
   - **Syntax error**: Check DISTINCT ON syntax
   - **Type error**: Check UUID casting
   - **Permission error**: User must have function creation rights
3. If unclear, copy error message and troubleshoot

### Verification Query (Optional)
To verify function was created:
```sql
-- Check if function exists
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_name = 'upsert_ort_assignments'
AND routine_schema = 'public';
```

---

## 🔍 PHASE 3: TEST SOLVER (Verification)

**Timeline**: ~5 minutes  
**Prerequisite**: Both Railway AND SQL migration must complete

### Option A: Using cURL (Command Line)
```bash
curl -X POST https://rooster-app-verloskunde.up.railway.app/api/roster/solve \
  -H "Content-Type: application/json" \
  -d '{"roster_id": "38845696-e314-4735-ae00-3080bd40dc43"}'
```

### Option B: Using Postman
1. Create new POST request
2. URL: `https://rooster-app-verloskunde.up.railway.app/api/roster/solve`
3. Body (JSON):
   ```json
   {"roster_id": "38845696-e314-4735-ae00-3080bd40dc43"}
   ```
4. Click "Send"

### Option C: Using Next.js Server (Local)
If testing locally:
```bash
cd rooster-app-verloskunde
npm run dev
# Then POST to http://localhost:3000/api/roster/solve
```

### What to Expect in Response

**Success Response** (HTTP 200):
```json
{
  "success": true,
  "roster_id": "38845696-...",
  "solver_result": {
    "status": "feasible",
    "assignments": [...],
    "total_assignments": 1133
  },
  "draad129": {
    "status": "DIAGNOSTIC_PHASE_COMPLETE",
    "batch_processing": "STAP2 IMPLEMENTED - All batches processed successfully"
  },
  ...
}
```

**Error Response** (HTTP 500):
```json
{
  "error": "[DRAAD129-STAP2] Batch UPSERT failed after X/1133 assignments",
  "details": {
    "batchErrors": [...],
    "totalProcessed": X,
    "totalAssignments": 1133,
    "failedBatches": 1,
    "totalBatches": 23
  }
}
```

### What to Check in Console Logs

1. **DRAAD129 Diagnostic Logs** (Should see):
   ```
   [DRAAD129] === DIAGNOSTIC PHASE: Analyzing solver output for duplicates ===
   [DRAAD129] Raw solver assignments: 1133 total
   [DRAAD129] Sample 0: emp=..., date=..., dagdeel=...
   [DRAAD129] Unique keys in solver output: 1133 / 1133
   ```
   
   or if duplicates found:
   ```
   [DRAAD129] 🚨 DUPLICATES FOUND: 5 duplicate keys detected
   [DRAAD129] Duplicate #1: key='emp5|2025-12-01|A' appears 2 times
   ```

2. **DRAAD129-STAP2 Batch Processing Logs** (Should see):
   ```
   [DRAAD129-STAP2] === BATCH PROCESSING PHASE ===
   [DRAAD129-STAP2] Configuration: BATCH_SIZE=50, TOTAL_ASSIGNMENTS=1133, TOTAL_BATCHES=23
   [DRAAD129-STAP2] Batch 0/22: processing 50 assignments (0-49)...
   [DRAAD129-STAP2] ✅ Batch 0 OK: 50 assignments inserted (total: 50)
   [DRAAD129-STAP2] Batch 1/22: processing 50 assignments (50-99)...
   [DRAAD129-STAP2] ✅ Batch 1 OK: 50 assignments inserted (total: 100)
   ...
   [DRAAD129-STAP2] ✅ ALL BATCHES SUCCEEDED: 1128 total assignments inserted
   ```

### Success Checklist
- [ ] Response is HTTP 200 (success)
- [ ] `solver_result.status` is "feasible" or "optimal"
- [ ] `total_assignments` is around 1133 (or less after dedup)
- [ ] Console shows `[DRAAD129]` diagnostic logs
- [ ] Console shows `[DRAAD129-STAP2]` batch logs
- [ ] All batches show `✅ Batch X OK`
- [ ] Final message: `✅ ALL BATCHES SUCCEEDED`
- [ ] No errors in database

### Troubleshooting Test Failures

**If HTTP 500 error:**
1. Check which batch(es) failed
2. Look for error message in response
3. Common errors:
   - `[DRAAD129-STAP2] Batch X FAILED: ...`
   - Check batch error message
   - Verify SQL migration executed

**If batches partially succeed:**
1. Some batches OK, some failed = batch isolation working
2. Identify which batch failed
3. That batch might have bad data
4. Use batch number to isolate problem assignment

**If no logs appear:**
1. Might be cached version
2. Hard refresh browser (Ctrl+Shift+R)
3. Check Railway was fully deployed
4. Check Supabase logs

**If SQL errors in batches:**
1. Might be DISTINCT ON syntax issue
2. Check SQL migration executed correctly
3. Verify function exists in Supabase
4. Re-run STAP 3 migration if needed

---

## 📐 DOCUMENTATION TO READ

In order:
1. **This file** - Quick checklist
2. `DRAAD129_FINAL_STATUS_REPORT.md` - Complete details
3. `DRAAD129_STAP2_DEPLOYMENT_SUMMARY.md` - Implementation details
4. `DRAAD129_STAP2_COMPLETE.txt` - Cache busting info

---

## 💋 POST-DEPLOYMENT TASKS

- [ ] Save Railway build artifacts
- [ ] Document any issues encountered
- [ ] Update team on successful deployment
- [ ] Archive DRAAD128 debugging logs
- [ ] Prepare for next phase (DRAAD130+)

---

## 💆 HANDOFF NOTES

For next person taking over:

1. **Current Status**: All code deployed to GitHub, awaiting verification
2. **What's Done**:
   - STAP 1: Diagnostic logging (✅)
   - STAP 2: Batch processing (✅)
   - STAP 3: SQL migration (✅)
3. **Next**: Execute STAP 3 SQL, then test
4. **Success Criteria**: All batches succeed, 1133 assignments inserted
5. **Escalation**: If issues, check batch error messages

---

## ⏳ ESTIMATED TIMELINE

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Wait for Railway | 5-10 min | ⏳ In progress |
| 2 | Execute SQL migration | 5 min | ⏹️ Waiting |
| 3 | Test solver | 5 min | ⏹️ Waiting |
| **Total** | **All phases** | **~20 min** | 🚀 |

---

**Status**: Ready for execution  
**Time**: 2025-12-08 08:55:35 UTC  
**Next**: Monitor Railway build, execute SQL migration
