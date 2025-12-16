# DRAAD 195: GREEDY Deployment Verification Checklist

**Service**: GREEDY Railway Service  
**Deploy Date**: 2025-12-16T15:40:25Z  
**Previous Status**: ❌ FAILING (postgrest-py==0.13.0 doesn't exist)  
**Expected Status After Deploy**: ✅ RUNNING  

---

## Phase 1: Build Verification (T+0 to T+45s)

### Step 1: Railway Build Started
- [ ] Railway webhook received (check Railway UI logs)
- [ ] Build log shows: "Detected Dockerfile.greedy"
- [ ] Base image pulled: python:3.11-slim

### Step 2: Dependency Installation
- [ ] Build log shows: "Collecting fastapi==0.104.1"
- [ ] Build log shows: "Collecting supabase==2.4.0" (NOT 2.3.5)
- [ ] Build log shows: "Collecting pydantic==2.8.0" (NOT 2.5.0)
- [ ] ✅ **CRITICAL**: NO error about "postgrest-py==0.13.0"
- [ ] Build log shows: "Successfully installed"

### Step 3: Docker Image Build
- [ ] Build log shows: "Building stage 2 (runtime)"
- [ ] COPY commands succeed
- [ ] Image created successfully
- [ ] No layer cache errors

### Step 4: Container Registry
- [ ] Image pushed to railway.app registry
- [ ] Build completes with status: SUCCESS
- [ ] Build time: < 2 minutes

---

## Phase 2: Service Health (T+45s to T+70s)

### Step 5: Container Startup
- [ ] Container starts (Railway logs: "Starting container")
- [ ] Python process begins: `python -m uvicorn src.main_greedy:app`
- [ ] No startup errors in logs
- [ ] Service listens on port 3001

### Step 6: Health Check
- [ ] Healthcheck triggered: `curl -f http://localhost:3001/api/greedy/health`
- [ ] Health check returns: HTTP 200 OK
- [ ] Response time: < 200ms
- [ ] Railway dashboard shows: ✅ HEALTHY

### Step 7: Environment Variables
- [ ] PYTHONUNBUFFERED=1 set
- [ ] PYTHONDONTWRITEBYTECODE=1 set
- [ ] PORT=3001 set
- [ ] HOST=0.0.0.0 set

### Step 8: Service Status
- [ ] Railway shows: "Greedy Service: DEPLOYED"
- [ ] Status indicator: GREEN
- [ ] Uptime: Increasing (no crashes)

---

## Phase 3: Connectivity Verification (T+70s onwards)

### Step 9: Database Connection
```bash
# From GREEDY container, verify Supabase connection
```
- [ ] Connection to Supabase succeeds
- [ ] Can query: `SELECT COUNT(*) FROM solver_runs;`
- [ ] Can read: employees table
- [ ] Can read: service_types table
- [ ] Can read: roster_assignments table
- [ ] Response times: < 500ms

### Step 10: Service Endpoints
- [ ] GET /api/greedy/health → 200 OK
- [ ] GET /api/greedy/status → 200 OK
- [ ] Response headers correct
- [ ] CORS headers present (if configured)

### Step 11: Log Analysis
- [ ] Application logs showing: "Uvicorn running on 0.0.0.0:3001"
- [ ] No ERROR level logs
- [ ] No stack traces
- [ ] Connection pooling working
- [ ] Request latency normal

---

## Phase 4: Integration Verification (T+120s onwards)

### Step 12: Three-Service Check
```
Service 1: rooster-app-verloskunde
Service 2: Solver2  
Service 3: greedy (THIS ONE)
```
- [ ] All 3 services show RUNNING on Railway
- [ ] All 3 have HEALTHY health checks
- [ ] Cross-service communication works

### Step 13: Database Schema Access
- [ ] Can access employees table (from greedy service)
- [ ] Can access service_types table
- [ ] Can access roster_assignments table
- [ ] Can access solver_runs table (for results storage)
- [ ] Can access planning_constraints table
- [ ] 176 tables total accessible

### Step 14: Performance Baseline
- [ ] Health check response: < 100ms
- [ ] Database query: < 500ms
- [ ] Memory usage: < 512MB
- [ ] CPU usage: < 50% (idle)
- [ ] No memory leaks

---

## Phase 5: Functional Testing (T+180s onwards)

### Step 15: Basic Solver Test
```python
# From rooster-app, call greedy service
GET /api/greedy/solve
POST /api/greedy/optimize
```
- [ ] Endpoint accepts requests
- [ ] Can submit optimization job
- [ ] Returns job ID (UUID)
- [ ] Status tracking works

### Step 16: Data Persistence
- [ ] Solver results saved to solver_runs table
- [ ] Results retrievable
- [ ] Metadata complete
- [ ] Timestamps correct

### Step 17: Error Handling
- [ ] Invalid requests return 400
- [ ] Database errors return 500 (with logging)
- [ ] Validation errors descriptive
- [ ] No unhandled exceptions

---

## Phase 6: Long-term Stability (T+24h onwards)

### Step 18: Uptime Monitoring
- [ ] Service uptime: > 99.5% over 24 hours
- [ ] No unexpected restarts
- [ ] No container crashes
- [ ] Health checks always passing

### Step 19: Resource Stability
- [ ] Memory usage stable (not increasing)
- [ ] CPU usage normal
- [ ] Database connections stable
- [ ] No connection pool exhaustion

### Step 20: Log Cleanliness
- [ ] No ERROR logs accumulating
- [ ] No WARNING logs indicating problems
- [ ] Rotation working (no log bloat)
- [ ] Debug info captured when needed

---

## FAILURE DIAGNOSTICS

### If Build Fails
```
❌ Build error about "postgrest-py==0.13.0"
   → requirements-greedy.txt not updated
   → Clear Railway cache and retry
   → Check git commit pushed successfully

❌ Build error about "can't find supabase 2.4.0"
   → PyPI temporarily down?
   → Wait 5 minutes and retry
   → Check internet connectivity

❌ Build error about "pydantic"
   → Python version incompatibility
   → Check Dockerfile.greedy Python version
   → Must be Python 3.11+
```

### If Health Check Fails
```
❌ Health check timeout
   → Application not starting
   → Check logs: uvicorn error?
   → Is port 3001 available?
   → Check environment variables

❌ Health check returns 500
   → Application error
   → Check Supabase connection string
   → Check database credentials
   → Verify network connectivity

❌ Health check returns 404
   → Endpoint path wrong
   → Check src/main_greedy.py
   → Verify route: /api/greedy/health
```

### If Database Connection Fails
```
❌ "Connection refused"
   → Supabase credentials wrong
   → Check environment variables
   → Verify .env.production

❌ "Authentication failed"
   → API key invalid/expired
   → Rotate Supabase key
   → Restart service

❌ "Connection timeout"
   → Network connectivity issue
   → Check Railway -> Supabase network
   → Verify firewall rules
```

---

## QUICK HEALTH CHECK COMMAND

```bash
# SSH into Railway and test
curl -v http://localhost:3001/api/greedy/health

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: application/json
# {
#   "status": "healthy",
#   "timestamp": "2025-12-16T15:45:00Z",
#   "service": "greedy",
#   "version": "1.0"
# }
```

---

## ROLLBACK PROCEDURE

If deployment fails and needs rollback:

```bash
# 1. Revert to previous commit
git revert 175c50c2ab0ad7cf8276db525daa846066be5e13

# 2. Force push to trigger rebuild
git push --force-with-lease

# 3. Railway automatically rebuilds
# 4. Monitor health check
# 5. Verify service recovers
```

**Time to rollback**: < 5 minutes  
**Data loss risk**: NONE (read-only optimization)

---

## SIGN-OFF CHECKLIST

**Deployment Engineer**:
- [ ] All Phase 1 checks passed
- [ ] All Phase 2 checks passed
- [ ] All Phase 3 checks passed

**QA/Validation**:
- [ ] All Phase 4 checks passed
- [ ] All Phase 5 checks passed
- [ ] No critical issues found

**Operations**:
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] On-call aware of deployment
- [ ] Runbook available

**Final Approval**:
- [ ] Ready for production
- [ ] All stakeholders notified
- [ ] No blockers

---

**Deployment Status**: 🚀 READY TO DEPLOY

**Expected Outcome**: GREEDY service running successfully on Railway with health checks passing and database connectivity confirmed.

**Post-Deployment Monitoring**: 24/7 automated checks + daily manual verification for first week.

---

*Document Generated: 2025-12-16T15:40:25Z*  
*Part of DRAAD 195: GREEDY Railway Deployment Fix*  
*Repository: gslooters/rooster-app-verloskunde*
