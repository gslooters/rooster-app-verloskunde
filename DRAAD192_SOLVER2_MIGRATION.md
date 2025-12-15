# DRAAD192: Solver2 Endpoint Migration

**Status:** 🔄 IN PROGRESS  
**Date:** 2025-12-15  
**Branch:** `fix/solver2-migration`  
**Target:** Railway deployment with Solver2 integration  

## Overview

Migrates the roster solver from local `SOLVER_SERVICE_URL` to external **Solver2** API endpoint with robust timeout handling and retry logic.

### Key Changes

- ✅ **Phase 1:** Code analysis completed - identified `/api/roster/solve` as primary endpoint
- ✅ **Phase 2:** Frontend fix implemented - updated `app/api/roster/solve/route.ts`
- 🔄 **Phase 3:** Backend proxy ready (solve route already forwarding)
- 🔄 **Phase 4:** Railway deployment pending

## Technical Details

### Timeout Configuration

```typescript
const SOLVER_TIMEOUT = 120000; // 120 seconds minimum
const SOLVER_RETRY_ATTEMPTS = 3;
const SOLVER_RETRY_DELAY_MS = 1000; // Exponential backoff
```

### Retry Logic

1. **Attempt 1:** Immediate (0ms)
2. **Attempt 2:** After 1000ms delay
3. **Attempt 3:** After 2000ms delay
4. **Failure:** Return 504 Gateway Timeout after all retries exhausted

### Request Format

```json
{
  "roster_id": "string",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "employees": [...],
  "services": [...],
  "roster_employee_services": [...],
  "fixed_assignments": [...],
  "blocked_slots": [...],
  "suggested_assignments": [...],
  "exact_staffing": [...],
  "timeout_seconds": 120
}
```

## Environment Variables

### Required for Railway Deployment

```bash
# Solver2 endpoint
SOLVER2_URL=https://solver2.example.com

# Existing variables (maintain)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Setup Instructions

1. **Get Solver2 Endpoint URL**
   - Contact Solver2 service provider
   - Confirm endpoint: `https://solver2.example.com/api/v1/solve-schedule`
   - Test endpoint accessibility from Railway environment

2. **Set Railway Variables**
   ```bash
   railway variable:set SOLVER2_URL https://solver2.example.com
   ```

3. **Verify Configuration**
   ```bash
   railway variable:get SOLVER2_URL
   ```

## Success Criteria

✅ **Deployment Success:**
- [ ] No timeout errors in Railway logs
- [ ] Solver2 API receiving requests correctly
- [ ] Status progression: 0 → 1 → 3 (roster items)
- [ ] Fill percentage: ≥95% coverage
- [ ] Response time: <10s for typical rosters

✅ **Error Handling:**
- [ ] Timeouts trigger retry logic automatically
- [ ] After 3 retries, return 504 with detailed error
- [ ] All errors logged with DRAAD192 prefix
- [ ] No silent failures

✅ **Data Integrity:**
- [ ] All 1470 roster items process without constraint violations
- [ ] Status codes maintained (0, 1, 2, 3)
- [ ] Service assignments created with correct IDs
- [ ] No duplicate records

## Testing Procedures

### Local Test

```bash
# 1. Set local Solver2 URL (test endpoint)
SETSOLVER2_URL=http://localhost:8000

# 2. Start solver locally
# docker run -p 8000:8000 solver2-service

# 3. Test endpoint
curl -X POST http://localhost:3000/api/roster/solve \
  -H "Content-Type: application/json" \
  -d '{"roster_id": "test-roster"}'
```

### Railway Production Test

```bash
# 1. Deploy feature branch
railway deploy --ref=fix/solver2-migration

# 2. Monitor logs
railway logs -f

# 3. Trigger solve
curl -X POST https://rooster-app.railway.app/api/roster/solve \
  -H "Content-Type: application/json" \
  -d '{"roster_id": "<actual-roster-id>"}'

# 4. Check for DRAAD192 logs
railway logs --filter "DRAAD192"
```

## Logging Output Expected

```
[DRAAD192] Solver2 migration active
[DRAAD192] Cache bust: DRAAD192-...
[DRAAD192] Solver endpoint: https://solver2.example.com
[DRAAD192] Timeout: 120000ms (120s)
[DRAAD192] Aanroepen Solver2...
[DRAAD192] Solver2 call attempt 1/3
[DRAAD192] URL: https://solver2.example.com/api/v1/solve-schedule
[DRAAD192] Solver2 response received
[DRAAD192] Roster status updated: draft → in_progress
```

## Rollback Procedure

**If Solver2 migration fails:**

1. **Switch back to main branch**
   ```bash
   railway deploy --ref=main
   ```

2. **Revert environment variable**
   ```bash
   railway variable:unset SOLVER2_URL
   railway variable:set SOLVER_SERVICE_URL <old-value>
   ```

3. **Verify logs return to old solver endpoint**
   ```bash
   railway logs --filter "Solver API"
   ```

## Known Limitations

- Maximum timeout: 120 seconds (API Gateway limit)
- Retry backoff: Fixed exponential (cannot exceed timeout)
- No request caching (each roster solve is fresh)
- No load balancing across multiple Solver2 instances (single endpoint)

## Future Enhancements

- [ ] Support multiple Solver2 endpoints with load balancing
- [ ] Implement request caching for identical rosters
- [ ] Add metrics/telemetry for solver performance
- [ ] Implement adaptive timeout based on roster size
- [ ] Add circuit breaker pattern for failing endpoints

## Files Changed

- ✅ `app/api/roster/solve/route.ts` - Updated with Solver2 endpoint
- ✅ `DRAAD192_SOLVER2_MIGRATION.md` - This file

## Related Issues

- Previous solver: `SOLVER_SERVICE_URL` environment
- Greedy solver: `GREEDY_SOLVER_URL` environment
- ORT solver: Replaced by Solver2

## Contact & Support

For issues or questions:
1. Check Railway logs: `railway logs -f`
2. Review error codes in response
3. Verify Solver2 endpoint is accessible
4. Check `SOLVER2_URL` environment variable is set

---

**Last Updated:** 2025-12-15  
**Version:** DRAAD192  
**Author:** Auto-generated via MCP tools
