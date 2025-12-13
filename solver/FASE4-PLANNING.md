# FASE 4: Testing & Optimization - Planning Document

**Status**: 🟢 **READY TO EXECUTE**  
**Baseline**: FASE 1+2+3 verified and operational  
**Date**: 2025-12-13T13:20:00Z

---

## 📊 **FASE 4 OVERVIEW**

FASE 4 consists of 6 comprehensive testing and optimization activities:

1. 📋 **Load Testing** - Concurrent request handling
2. ⏱️ **Performance Benchmarking** - Speed analysis across scenarios
3. 🚫 **Error Scenario Testing** - Failure handling and resilience
4. 🗑️ **Database Optimization** - Query performance analysis
5. 🔄 **Fallback Mechanism Verification** - Sequential->CP-SAT routing
6. 📊 **Production Monitoring Setup** - Logging and alerting

**Total Estimated Time**: 3-5 hours (all 6 tasks)

---

## 📋 **TASK 1: LOAD TESTING**

### Objective
Verify that the service handles multiple concurrent requests without crashes, timeouts, or data corruption.

### Test Plan

**Scenario 1: Low Load (Baseline)**
- Requests: 5 concurrent
- Duration: 30 seconds
- Payload: Real roster data (medium size)
- Expected: All succeed, <5s per request

**Scenario 2: Medium Load**
- Requests: 10 concurrent
- Duration: 60 seconds
- Payload: Varied roster sizes (3-5 week rosters)
- Expected: All succeed, <10s per request

**Scenario 3: High Load**
- Requests: 20 concurrent
- Duration: 60 seconds
- Payload: Large rosters (5 weeks, 15+ employees)
- Expected: >80% succeed, <30s per request

**Scenario 4: Stress Test**
- Requests: 50 concurrent
- Duration: 30 seconds
- Payload: Maximum roster complexity
- Expected: Service remains responsive, graceful degradation

### Test Execution
```python
# Tool: Python requests + threading
# Script: load_test.py (to be created)

for scenario in [low, medium, high, stress]:
    results = run_concurrent_requests(
        url=SOLVER_URL,
        num_workers=scenario.workers,
        duration=scenario.duration,
        payloads=scenario.payloads
    )
    analyze_results(results, scenario.expected)
```

### Success Criteria
- ✅ No 502 or 503 errors
- ✅ No request timeouts
- ✅ Thread pool handles load
- ✅ Memory stable (no leaks)
- ✅ CPU usage reasonable (<80%)

### Deliverables
- Load test script
- Results report with graphs
- Concurrent request capacity analysis

---

## ⏱️ **TASK 2: PERFORMANCE BENCHMARKING**

### Objective
Measure solver speed across different roster sizes and characteristics.

### Test Scenarios

**Scenario A: Small Roster**
- Employees: 6
- Services: 4 (DIO, DDO, DIA, DDA)
- Period: 2 weeks
- Staffing: 60% of slots
- Expected time: <2 seconds

**Scenario B: Medium Roster**
- Employees: 12
- Services: 6 (+ GRO/ORA variants)
- Period: 5 weeks
- Staffing: 70% of slots
- Expected time: 2-5 seconds

**Scenario C: Large Roster**
- Employees: 20
- Services: 8
- Period: 5 weeks
- Staffing: 80% of slots
- Expected time: 5-15 seconds

**Scenario D: Maximum Complexity**
- Employees: 25
- Services: 12 (with all constraints)
- Period: 5 weeks
- Staffing: 90% of slots
- Expected time: 15-30 seconds

### Measurement Points
```
Timings to measure:
  - Total solve time
  - Data loading time
  - Priority sorting time
  - Assignment loop time
  - Response building time
  - Fallback triggering time (if applicable)

Memory:
  - Peak memory usage
  - Memory growth during solve
  - Cleanup after solve

CPU:
  - CPU usage during solve
  - Thread pool utilization
  - Context switches
```

### Test Execution
```python
import time
import psutil

for scenario in [small, medium, large, maximum]:
    mem_before = psutil.virtual_memory().used
    cpu_before = psutil.cpu_percent(interval=0.1)
    
    start = time.time()
    response = solver.solve(scenario.data)
    elapsed = time.time() - start
    
    mem_after = psutil.virtual_memory().used
    cpu_after = psutil.cpu_percent(interval=0.1)
    
    report_metrics(scenario, elapsed, mem_after-mem_before, cpu_after-cpu_before)
```

### Success Criteria
- ✅ All scenarios complete within expected time
- ✅ Memory usage stays under 500MB
- ✅ CPU spike <80% during solve
- ✅ Response time degradation is linear
- ✅ No memory leaks (memory returned after solve)

### Deliverables
- Benchmark suite
- Performance baseline document
- Graphs: Time vs roster size
- Graphs: Memory vs roster size
- Optimization recommendations

---

## 🚫 **TASK 3: ERROR SCENARIO TESTING**

### Objective
Verify graceful degradation and error handling in failure conditions.

### Test Scenarios

**Scenario 1: Invalid Input**
- Missing required field
- Invalid data type
- Empty roster
- Expected: Clear error message, HTTP 400

**Scenario 2: Database Disconnection**
- Supabase unavailable during load
- Network timeout
- Connection refused
- Expected: Fallback to CP-SAT or error message

**Scenario 3: Solver Timeout**
- Long-running solve (>timeout)
- Many conflicting requirements
- Expected: Graceful timeout, return best solution

**Scenario 4: Memory Pressure**
- Large roster causing high memory
- System running low on RAM
- Expected: No crash, slower response or error

**Scenario 5: Concurrent Failures**
- Multiple requests fail simultaneously
- Sequential solver crashes
- CP-SAT fallback also fails
- Expected: Service stays up, errors reported

**Scenario 6: Malformed Data**
- Corrupt JSON in request
- Invalid date formats
- Circular references
- Expected: Validation error, 422 Unprocessable Entity

### Test Execution
```python
# Inject failures and verify handling

with mock.patch('supabase.create_client', side_effect=Exception("Connection failed")):
    response = POST /api/v1/solve-schedule
    assert response.status == ERROR
    assert "fallback" in logs or "CP-SAT" in logs
```

### Success Criteria
- ✅ All errors handled gracefully
- ✅ No unhandled exceptions
- ✅ Clear error messages returned
- ✅ Service stays responsive
- ✅ Fallback mechanisms activate
- ✅ No data corruption

### Deliverables
- Error scenario test suite
- Error handling report
- Recommended error messages
- Monitoring alerts needed

---

## 🗑️ **TASK 4: DATABASE OPTIMIZATION**

### Objective
Identify and optimize slow database queries.

### Analysis Points

**Query Performance**
```sql
-- Measure execution time for:
SELECT * FROM roster_period_staffing_dagdelen WHERE ...
SELECT * FROM roster_employee_services WHERE ...
SELECT * FROM roster_assignments WHERE ...
SELECT * FROM employees WHERE ...
```

**N+1 Query Detection**
- Are queries repeated unnecessarily?
- Can batch queries be used?
- Are results cached?

**Index Analysis**
- Are queries using indexes?
- Missing indexes?
- Overly broad queries?

### Measurements
```
For each query:
  - Number of executions per solve
  - Average time per execution
  - Peak time
  - Total time (sum of all executions)
  - Index usage
  - Row count returned
```

### Test Execution
```python
# Add query logging
with query_profiler():
    response = solver.solve(data)
    
# Generate report
queries = profiler.get_slowest_queries(n=10)
for query in queries:
    print(f"{query.statement}: {query.time}ms (x{query.count})")
```

### Success Criteria
- ✅ Average query time <100ms
- ✅ No N+1 queries detected
- ✅ Database time <30% of total solve time
- ✅ All queries using appropriate indexes
- ✅ Batch queries where applicable

### Deliverables
- Database query profile
- Slow query identification
- Index optimization recommendations
- Batch query opportunities
- Caching recommendations

---

## 🔄 **TASK 5: FALLBACK MECHANISM VERIFICATION**

### Objective
Verify that fallback from Sequential to CP-SAT works correctly.

### Test Scenarios

**Scenario 1: Sequential Success (No Fallback)**
- Normal roster
- Expected: Uses SequentialSolverV2, completes <5s
- Verify: No CP-SAT invoked

**Scenario 2: Sequential Timeout**
- Inject delay in Sequential solver
- Expected: Times out, logs "Sequential failed"
- Verify: Falls back to CP-SAT

**Scenario 3: Sequential Exception**
- Inject exception in SequentialSolverV2
- Expected: Catches exception, logs error
- Verify: Falls back to CP-SAT

**Scenario 4: CP-SAT Success After Sequential Failure**
- Both solvers invoked
- Expected: Returns CP-SAT solution
- Verify: Response quality acceptable

**Scenario 5: Both Solvers Fail**
- Both Sequential and CP-SAT fail
- Expected: Returns ERROR status with clear message
- Verify: Service doesn't crash

### Test Execution
```python
# Mock failures and verify fallback

with mock.patch.object(SequentialSolverV2, 'solve', side_effect=Exception()):
    response = POST /api/v1/solve-schedule
    assert "fallback" in logs
    assert response.solver_used == "CP-SAT"  # Fallback used
    assert response.status != "ERROR"
```

### Success Criteria
- ✅ Fallback triggers on Sequential error
- ✅ CP-SAT invoked only when necessary
- ✅ Environment variable override works
- ✅ Clear logs showing fallback decision
- ✅ Response quality maintained
- ✅ No cascading failures

### Deliverables
- Fallback mechanism test suite
- Fallback decision logs
- Recommendations for fallback tuning
- Monitoring metrics for fallback usage

---

## 📊 **TASK 6: PRODUCTION MONITORING SETUP**

### Objective
Implement comprehensive logging and monitoring for production visibility.

### Monitoring Metrics

**Solver Metrics**
```
- Requests per minute
- Average solve time
- P50, P95, P99 latency
- Success rate (%)
- Fallback rate (Sequential->CP-SAT %)
- Error rate (%)
```

**Performance Metrics**
```
- Memory usage (peak, average)
- CPU usage (peak, average)
- Thread pool utilization
- Database query time
- Response time distribution
```

**Business Metrics**
```
- Assignments created per solve
- Fill percentage (assignments/total slots)
- Unassigned requirements count
- Service utilization by type
```

**Health Metrics**
```
- Service availability (%)
- Health check status
- Container restarts
- Out-of-memory errors
- Connection timeouts
```

### Logging Strategy

**Levels**
- INFO: Solver started, solver completed, version info
- DEBUG: Data loading, sorting, assignment details
- WARNING: Slow queries, high memory usage, partial failures
- ERROR: Solver crashes, database errors, unhandled exceptions

**Fields Per Log Entry**
```json
{
  "timestamp": "2025-12-13T13:20:00Z",
  "level": "INFO",
  "component": "SequentialSolverV2",
  "roster_id": "w1-w5-2026",
  "event": "solve_completed",
  "solve_time_ms": 2500,
  "assignments_created": 42,
  "failures": 0,
  "solver_used": "sequential"
}
```

### Alerting Rules

```
ALERT: High Error Rate
  if: error_rate > 5% in 5 minutes
  action: Page on-call engineer

ALERT: Slow Responses
  if: p99_latency > 30 seconds for 10 minutes
  action: Investigate database/solver performance

ALERT: Service Down
  if: health check fails 3 times
  action: Page on-call, restart service

ALERT: High Memory Usage
  if: memory > 700MB
  action: Check for memory leak, restart if needed

ALERT: Frequent Fallbacks
  if: fallback_rate > 10% in 1 hour
  action: Investigate Sequential solver issues
```

### Dashboards

**Real-time Dashboard**
- Current requests (active count)
- Success rate (gauge)
- P50/P95/P99 latency (gauge)
- Memory/CPU usage (graphs)

**24-Hour Trends**
- Requests per minute (line graph)
- Error rate (line graph)
- Avg solve time (line graph)
- Fallback rate (line graph)

**Solver Comparison**
- Sequential vs CP-SAT usage
- Sequential success rate
- Fallback frequency
- Quality comparison

### Test Execution
```python
# Verify logging
with logging_capture():
    response = solver.solve(data)
    
logs = get_logs()
assert any("SequentialSolverV2" in log for log in logs)
assert any("assignments_created" in log for log in logs)
```

### Success Criteria
- ✅ All metric points logged
- ✅ No sensitive data in logs
- ✅ Structured logging format (JSON)
- ✅ Alerting rules effective
- ✅ Dashboards show useful information
- ✅ Log retention policy defined

### Deliverables
- Logging configuration
- Monitoring dashboard setup
- Alert rules and thresholds
- Dashboard screenshots
- Runbook for common issues

---

## 📊 **EXECUTION PLAN**

### Week 1: Foundation (2-3 hours)
- 📋 Task 1: Load Testing
- ⏱️ Task 2: Performance Benchmarking
- 🚫 Task 3: Error Scenarios

### Week 2: Optimization (2-3 hours)
- 🗑️ Task 4: Database Optimization
- 🔄 Task 5: Fallback Verification
- 📊 Task 6: Monitoring Setup

### Daily Cycle
1. Run tests
2. Collect results
3. Analyze findings
4. Document recommendations
5. Create tracking issues for improvements

---

## 📋 **SUCCESS CRITERIA SUMMARY**

| Task | Critical Criteria | Target |
|------|-------------------|--------|
| Load Testing | No 502 errors, thread pool stable | 20 concurrent |
| Performance | Solve time <5s for typical roster | <2000ms P95 |
| Error Handling | All errors caught, service stays up | 100% resilient |
| Database | No N+1 queries, avg <100ms | <30% of solve time |
| Fallback | CP-SAT used only on Sequential fail | <1% fallback rate |
| Monitoring | All metrics logged, alerts working | 100% coverage |

---

## 🚀 **NEXT STEPS**

**Immediate (Next Hour)**
- Review this FASE 4 plan
- Approve test scenarios
- Allocate resources

**First Day**
- Create test scripts
- Set up test data
- Begin Task 1 (Load Testing)

**First Week**
- Complete Tasks 1-3
- Generate reports
- Identify quick wins

**Second Week**
- Complete Tasks 4-6
- Implement recommendations
- Deploy monitoring

---

## ✅ **READY TO PROCEED**

Baseline (FASE 1+2+3) verified and operational.  
All prerequisites for FASE 4 satisfied.  
Ready to execute comprehensive testing suite.

**Approval**: Proceed with FASE 4? [YES/NO]
