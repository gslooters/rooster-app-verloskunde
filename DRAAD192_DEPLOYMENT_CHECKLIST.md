# DRAAD192: Railway Deployment Checklist

**Version:** DRAAD192  
**Date:** 2025-12-15  
**Status:** 🔄 Ready for Deployment  

## Pre-Deployment Verification

### Code Changes

- [x] Branch created: `fix/solver2-migration`
- [x] File updated: `app/api/roster/solve/route.ts`
- [x] Timeout configured: 120 seconds
- [x] Retry logic: 3 attempts with exponential backoff
- [x] Error handling: Comprehensive with detailed logging
- [x] Documentation: DRAAD192_SOLVER2_MIGRATION.md
- [x] No syntax errors in TypeScript
- [x] Type compatibility maintained

### Code Quality Checks

```typescript
// ✅ Verified patterns:
- AbortSignal.timeout(120000) implemented
- Retry loop with exponential backoff
- Error catching and logging
- Response format backward compatible
- Database operations maintained
- Status progression unchanged
```

### Environment Variables Required

**Must be set in Railway dashboard before deployment:**

```bash
SOLVER2_URL=https://solver2-api.example.com
```

**Existing variables (verify present):**

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Railway Deployment Steps

### Step 1: Connect Feature Branch

```bash
# From Railway dashboard or CLI:
railway connect
railway env:pull  # Verify existing vars loaded
```

### Step 2: Set Solver2 Environment Variable

```bash
# Set in Railway dashboard:
# Settings > Environment > Add Variable
# Name: SOLVER2_URL
# Value: https://solver2-api.example.com

# OR via CLI:
railway variable:set SOLVER2_URL https://solver2-api.example.com
```

### Step 3: Deploy Feature Branch

```bash
# Option A: Direct deployment
railway deploy --ref=fix/solver2-migration

# Option B: Push and Railway auto-deploys
git push origin fix/solver2-migration
# Railway webhook triggers automatic deployment
```

### Step 4: Monitor Deployment

```bash
railway logs -f

# Watch for these patterns:
# ✅ [DRAAD192] Solver2 migration active
# ✅ [DRAAD192] Solver endpoint: https://solver2-api.example.com
# ✅ [DRAAD192] Solver2 response received
# ❌ ERROR patterns = rollback needed
```

### Step 5: Verify Deployment Success

```bash
# Check deployment status
railway status

# Verify logs show Solver2 integration
railway logs --filter "DRAAD192" -n 50

# Look for:
# - No timeout errors
# - Successful Solver2 calls
# - Status updates working
```

## Post-Deployment Testing

### Test 1: Health Check

```bash
# Call any roster endpoint to verify system responsive
curl -X GET https://rooster-app.railway.app/api/roster/[test-id]
```

### Test 2: Solve Endpoint Test

```bash
# Trigger actual solver
curl -X POST https://rooster-app.railway.app/api/roster/solve \
  -H "Content-Type: application/json" \
  -d '{"roster_id": "[valid-roster-uuid]"}'

# Expected response:
# {
#   "success": true,
#   "roster_id": "...",
#   "solver_result": {
#     "status": "optimal",
#     "assignments": [...],
#     "total_assignments": 1470,
#     "fill_percentage": 98.5
#   },
#   "draad192": {
#     "status": "IMPLEMENTED",
#     "solver_endpoint": "https://solver2-api.example.com",
#     "timeout_ms": 120000
#   }
# }
```

### Test 3: Timeout Handling

```bash
# Monitor logs for timeout scenarios
railway logs --filter "timeout" -f

# Expected behavior on 2-minute delay:
# [DRAAD192] Solver2 call attempt 1/3
# [DRAAD192] 🜄 Solver2 TIMEOUT after 120000ms
# [DRAAD192] Retrying in 1000ms...
# [DRAAD192] Solver2 call attempt 2/3
# [DRAAD192] 🜄 Solver2 TIMEOUT after 120000ms
# [DRAAD192] Retrying in 2000ms...
# [DRAAD192] Solver2 call attempt 3/3
# [DRAAD192] 🜄 Solver2 TIMEOUT after 120000ms
# [DRAAD192] ❌ Solver2 failed after retries: Solver2 timeout after 3 attempts
# Response: 504 Gateway Timeout
```

### Test 4: Database Integrity

```bash
# Verify roster assignments updated correctly
# Connect to Supabase dashboard:
# - Check roster_assignments table
# - Verify status progression: 0 → 1 (items with service_id)
# - Confirm no duplicates
# - Check updated_at timestamps
# - Verify source='solver2' in assignments
```

## Success Criteria

### ✅ Deployment Success

```
✅ Deployment completed without errors
✅ SOLVER2_URL environment variable set
✅ Application started successfully
✅ Logs show [DRAAD192] prefix messages
```

### ✅ Integration Success

```
✅ Solver2 endpoint receives POST requests
✅ Requests include all required fields
✅ Responses parsed correctly
✅ No timeout errors for normal rosters (<30 seconds)
```

### ✅ Data Integrity

```
✅ All 1470 roster items process without errors
✅ Status codes maintained (0, 1, 2, 3)
✅ Service IDs correctly assigned
✅ No duplicate records created
✅ Updated timestamps correct
```

### ✅ Error Handling

```
✅ Timeouts trigger retry logic
✅ After 3 retries, return 504 with detail
✅ All errors logged with DRAAD192 prefix
✅ Silent failures prevented
```

## Monitoring Dashboard

### Key Metrics to Watch

```
Endpoint: /api/roster/solve
Method: POST

Metrics:
- Request count: Should see increased volume
- Response time: Target <10s for typical rosters
- Error rate: Should remain <1% for valid requests
- 504 errors: Only on timeout scenarios
- DRAAD192 logs: All solve requests logged
```

### Log Patterns to Monitor

**Good Logs:**
```
[DRAAD192] Solver2 migration active
[DRAAD192] Solver endpoint: https://solver2-api.example.com
[DRAAD192] Solver2 response received
[DRAAD192] Roster status updated: draft → in_progress
```

**Bad Logs:**
```
[DRAAD192] Solver2 failed after retries
[DRAAD192] undefined (check SOLVER2_URL not set)
[DRAAD192] ECONNREFUSED (Solver2 endpoint unreachable)
[DRAAD192] TIMEOUT (repeated 3 times)
```

## Troubleshooting Guide

### Issue: "SOLVER2_URL not defined"

**Solution:**
1. Go to Railway dashboard
2. Project > Settings > Environment
3. Add variable: `SOLVER2_URL = https://solver2-api.example.com`
4. Redeploy application

### Issue: "Connection refused to Solver2"

**Solution:**
1. Verify Solver2 endpoint URL is correct
2. Check Solver2 service is running
3. Verify network connectivity from Railway
4. Test endpoint manually: `curl https://solver2-api.example.com/health`

### Issue: "All timeouts after retries"

**Solution:**
1. Increase `SOLVER_TIMEOUT` in code (currently 120s)
2. Check Solver2 service performance
3. Monitor Solver2 logs for bottlenecks
4. Consider implementing request queuing

### Issue: "Database constraint violations"

**Solution:**
1. Review DRAAD155 logic in code
2. Verify empty slots exist: `SELECT * FROM roster_assignments WHERE status=0`
3. Check for duplicate assignments
4. Clear invalid data and retry

### Issue: "Roster status not updating"

**Solution:**
1. Check Supabase connection
2. Verify roster record exists
3. Check logs for UPDATE errors
4. Review database permissions

## Rollback Procedure

**If deployment fails:**

```bash
# Step 1: Identify issue in logs
railway logs --filter "ERROR" -n 100

# Step 2: Revert to main branch
railway deploy --ref=main

# Step 3: Unset problematic variable (if applicable)
railway variable:unset SOLVER2_URL

# Step 4: Verify rollback successful
railway logs --filter "Solver API"
# Should see old solver endpoint messages

# Step 5: Fix issue and retry
# Update code, commit, push to fix/solver2-migration
# Railway auto-redeploys
```

## Next Steps After Successful Deployment

1. **Monitor for 24 hours**
   - Watch error rates
   - Check solver performance
   - Verify all rosters solve correctly

2. **Create Pull Request**
   - PR from `fix/solver2-migration` to `main`
   - Include performance metrics
   - Reference DRAAD192 in description

3. **Merge and Finalize**
   - Merge PR to main
   - Delete feature branch
   - Document in release notes

4. **Archive Old Solver**
   - Keep SOLVER_SERVICE_URL fallback for 1 week
   - Monitor for any regressions
   - Remove after stability confirmed

## Sign-Off

**Deployment Ready:** ✅ Yes  
**Code Review:** ✅ Passed  
**Tests Passing:** ✅ Yes  
**Documentation:** ✅ Complete  
**Ready for Production:** ✅ Yes  

---

**Last Updated:** 2025-12-15  
**Version:** DRAAD192  
**Prepared by:** Auto-deployment system
