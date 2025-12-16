# 🧪 STAP 3 TEST PLAN - GREEDY SERVICE DEPLOYMENT

**Datum:** 16 December 2025  
**Status:** ✅ READY FOR EXECUTION  
**DRAAD:** 194 FASE 2 - OPTIE C  
**Testing Method:** Browser-based (NO TERMINAL REQUIRED)

---

## 📋 QUICK START

### Option A: Use Interactive HTML Test Suite (RECOMMENDED)

```
1. Download file: testing/GREEDY_TEST_SUITE.html
2. Open in browser (Chrome, Firefox, Safari, Edge)
3. Click buttons to run tests
4. See results immediately
```

**Link:** https://raw.githubusercontent.com/gslooters/rooster-app-verloskunde/main/testing/GREEDY_TEST_SUITE.html

### Option B: Use Swagger UI (Built-in)

```
1. Go to: https://greedy-production.up.railway.app/docs
2. Try endpoints interactively
3. View response + timing
```

### Option C: Use Postman (GUI)

```
1. Download: https://www.postman.com/downloads/
2. Import collection (see below)
3. Run tests
```

---

## ✅ TEST 1: HEALTH CHECK

**Purpose:** Verify service is online and responding

### Manual Test (Browser Console)

```javascript
fetch('https://greedy-production.up.railway.app/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Expected Response

```json
{
  "service": "greedy-rostering-engine",
  "version": "1.0.0",
  "solver_type": "GREEDY",
  "draad": "DRAAD 194 FASE 2",
  "endpoints": {
    "solve": "POST /api/greedy/solve",
    "health": "GET /api/greedy/health",
    "validate": "POST /api/greedy/validate",
    "docs": "GET /docs",
    "redoc": "GET /redoc"
  },
  "performance": {
    "solve_time": "2-5 seconds",
    "coverage": "98%+",
    "algorithm": "DRAAD 190 Smart Greedy Allocation"
  },
  "status": "ready"
}
```

### ✅ SUCCESS CRITERIA

- [x] HTTP Status: 200 OK
- [x] Response contains `"status": "ready"`
- [x] Response time: < 500ms
- [x] All endpoints listed

---

## ✅ TEST 2: VALIDATION TEST - VALID REQUEST

**Purpose:** Verify request validation accepts valid data

### Browser Console

```javascript
const data = {
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "max_shifts_per_employee": 8
};

fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))
```

### Expected Response

```json
{
  "valid": true,
  "message": "Request is valid",
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "period": "2025-01-01 to 2025-01-31"
}
```

### ✅ SUCCESS CRITERIA

- [x] HTTP Status: 200 OK
- [x] `"valid": true`
- [x] Response time: < 500ms
- [x] Message is helpful

---

## ✅ TEST 3: ERROR HANDLING - INVALID UUID

**Purpose:** Verify bad UUID is rejected with 400 error

### Browser Console

```javascript
const data = {
  "roster_id": "INVALID_UUID_NOT_VALID",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
};

fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))
```

### Expected Response

```json
{
  "valid": false,
  "message": "Invalid roster_id: 'INVALID_UUID_NOT_VALID' (not valid UUID)",
  "error": "Invalid roster_id: 'INVALID_UUID_NOT_VALID' (not valid UUID)"
}
```

### ✅ SUCCESS CRITERIA

- [x] HTTP Status: 200 OK (validation endpoint always returns 200)
- [x] `"valid": false`
- [x] Error message is clear and specific
- [x] Mentions UUID format

---

## ✅ TEST 4: ERROR HANDLING - BAD DATE FORMAT

**Purpose:** Verify invalid date format is rejected

### Browser Console

```javascript
const data = {
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "01-01-2025",  // Wrong format (not YYYY-MM-DD)
  "end_date": "2025-01-31"
};

fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))
```

### Expected Response

```json
{
  "valid": false,
  "message": "Invalid start_date: '01-01-2025' (expected YYYY-MM-DD)",
  "error": "Invalid start_date: '01-01-2025' (expected YYYY-MM-DD)"
}
```

### ✅ SUCCESS CRITERIA

- [x] `"valid": false`
- [x] Error mentions "YYYY-MM-DD" format
- [x] Clear error message

---

## ✅ TEST 5: ERROR HANDLING - INVERTED DATE RANGE

**Purpose:** Verify date range validation

### Browser Console

```javascript
const data = {
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-12-31",  // After end_date
  "end_date": "2025-01-01"      // Before start_date
};

fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))
```

### Expected Response

```json
{
  "valid": false,
  "message": "Invalid date range: start_date (2025-12-31) must be before end_date (2025-01-01)",
  "error": "Invalid date range: start_date (2025-12-31) must be before end_date (2025-01-01)"
}
```

### ✅ SUCCESS CRITERIA

- [x] `"valid": false`
- [x] Error mentions date ordering
- [x] Clear message

---

## ✅ TEST 6: PERFORMANCE TEST

**Purpose:** Verify solver completes in < 5 seconds

### Browser Console

```javascript
const data = {
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "max_shifts_per_employee": 8
};

const start = performance.now();
fetch('https://greedy-production.up.railway.app/api/greedy/solve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => {
  const elapsed = performance.now() - start;
  console.log('Elapsed:', elapsed.toFixed(0), 'ms');
  console.log('Solver time:', d.solve_time, 's');
  console.log('Coverage:', d.coverage, '%');
  console.log('Status:', d.status);
  console.log(d);
})
```

### Expected Response (Example)

```json
{
  "status": "success",
  "assignments_created": 224,
  "total_required": 228,
  "coverage": 98.2,
  "pre_planned_count": 10,
  "greedy_count": 214,
  "solve_time": 3.24,
  "bottlenecks": [],
  "message": "DRAAD 190 SMART GREEDY: 98.2% coverage in 3.24s",
  "solver_type": "GREEDY",
  "timestamp": "2025-12-16T19:30:45.123456Z"
}
```

### ✅ SUCCESS CRITERIA

- [x] HTTP Status: 200 OK
- [x] `"status": "success"` or `"partial"`
- [x] Network time: < 5000ms
- [x] `solve_time` < 5 seconds
- [x] Coverage: >= 95% (for success status)
- [x] Has assignments_created > 0

---

## 🚀 USING THE INTERACTIVE TEST SUITE

### Step-by-Step

1. **Open the test file:**
   - Download from: `testing/GREEDY_TEST_SUITE.html`
   - Or use raw link:
     ```
     https://raw.githubusercontent.com/gslooters/rooster-app-verloskunde/main/testing/GREEDY_TEST_SUITE.html
     ```
   - Save to desktop
   - Double-click to open in browser

2. **Run tests:**
   - Click "🔴 RUN ALL TESTS" for complete test suite
   - Or run individual tests

3. **View results:**
   - Left panel shows test output
   - Right panel shows summary + timeline
   - Green = Pass, Red = Fail

---

## 📊 TEST EXECUTION LOG TEMPLATE

```
╔══════════════════════════════════════════════════════════╗
║ GREEDY SERVICE - TEST EXECUTION LOG                      ║
║ Date: 16 December 2025                                   ║
║ Tester: [Your Name]                                      ║
╚══════════════════════════════════════════════════════════╝

 TEST 1: HEALTH CHECK
 ├─ Endpoint: https://greedy-production.up.railway.app/health
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Response Time: ___ ms
 ├─ HTTP Status: 200
 └─ Notes: ___________________________________

 TEST 2: VALID REQUEST
 ├─ Endpoint: /api/greedy/validate
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Valid: true/false
 └─ Notes: ___________________________________

 TEST 3: INVALID UUID
 ├─ Endpoint: /api/greedy/validate
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Error Caught: Yes/No
 └─ Notes: ___________________________________

 TEST 4: BAD DATE FORMAT
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Error Caught: Yes/No
 └─ Notes: ___________________________________

 TEST 5: BAD DATE RANGE
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Error Caught: Yes/No
 └─ Notes: ___________________________________

 TEST 6: PERFORMANCE
 ├─ Status: ✅ PASS / ❌ FAIL
 ├─ Solve Time: ___ seconds
 ├─ Coverage: ____%
 ├─ Under 5 sec: Yes/No
 └─ Notes: ___________________________________

 OVERALL STATUS: ✅ ALL TESTS PASS / ⚠️ SOME FAILURES
 READY FOR STAP 4: ✅ YES / ❌ NO

 Signature: _________________ Date: ________________
```

---

## 🔗 POSTMAN COLLECTION

### Import into Postman

```json
{
  "info": {
    "name": "GREEDY Service Tests",
    "description": "Test suite for DRAAD 194 FASE 2"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "https://greedy-production.up.railway.app/health"
      }
    },
    {
      "name": "Validate Valid",
      "request": {
        "method": "POST",
        "url": "https://greedy-production.up.railway.app/api/greedy/validate",
        "body": {
          "raw": "{\n  \"roster_id\": \"550e8400-e29b-41d4-a716-446655440000\",\n  \"start_date\": \"2025-01-01\",\n  \"end_date\": \"2025-01-31\"\n}"
        }
      }
    },
    {
      "name": "Validate Invalid UUID",
      "request": {
        "method": "POST",
        "url": "https://greedy-production.up.railway.app/api/greedy/validate",
        "body": {
          "raw": "{\n  \"roster_id\": \"INVALID\",\n  \"start_date\": \"2025-01-01\",\n  \"end_date\": \"2025-01-31\"\n}"
        }
      }
    }
  ]
}
```

---

## 📋 GO/NO-GO CHECKLIST

### Before Running Tests

- [ ] Service endpoint reachable: https://greedy-production.up.railway.app
- [ ] Have valid UUID for testing (or use provided one)
- [ ] Browser with modern JavaScript support
- [ ] Internet connection

### Test Execution

- [ ] TEST 1: Health Check ✅ PASS
- [ ] TEST 2: Valid Request ✅ PASS
- [ ] TEST 3: Invalid UUID Error ✅ PASS
- [ ] TEST 4: Bad Date Error ✅ PASS
- [ ] TEST 5: Bad Range Error ✅ PASS
- [ ] TEST 6: Performance ✅ PASS

### Go/No-Go Decision

- [ ] All 6 tests passing
- [ ] No unexpected errors
- [ ] Performance < 5 seconds
- [ ] Error handling working
- [ ] Ready for STAP 4

**Decision: ✅ GO / ❌ NO-GO**

---

## 🐛 TROUBLESHOOTING

### Issue: Service not responding

**Solution:**
```
1. Check Railway logs: https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Verify service is running (green status)
3. Check environment variables (SUPABASE_URL, SUPABASE_KEY)
4. Restart service if needed
```

### Issue: CORS error

**Solution:**
```
This is expected behavior in browser.
CORS is properly configured on the server.
If you see actual CORS errors, check:
- Service is deployed
- Health endpoint works
```

### Issue: Timeout (> 5 seconds)

**Solution:**
```
1. Check if database is responding
2. Verify Supabase connection
3. Check network latency (may be location-based)
4. Review Railway service logs
```

### Issue: 500 Server Error

**Solution:**
```
1. Check Railway logs for error
2. Verify data in Supabase
3. Check environment variables
4. Contact dev team with error details
```

---

## ✅ SUCCESS CRITERIA SUMMARY

```
✅ Service Online
   └─ Health check responds in < 500ms

✅ Validation Works
   └─ Valid requests accepted
   └─ Invalid requests rejected with clear errors

✅ Error Handling
   └─ Invalid UUID caught
   └─ Bad date format caught
   └─ Bad date range caught
   └─ All errors < 200ms response

✅ Performance
   └─ Solve time < 5 seconds
   └─ Coverage > 95%
   └─ Response properly formatted

✅ Integration
   └─ Ready for STAP 4 (Frontend integration)
   └─ All dependencies working
   └─ Logging comprehensive
```

---

## 📞 NEXT STEPS

1. **Run the test suite** (30-45 minutes total)
2. **Record results** in go/no-go checklist
3. **If all green:** Proceed to STAP 4
4. **If any red:** Debug + retest

---

**Document Version:** 1.0  
**Status:** READY FOR USE  
**Last Updated:** 16 December 2025
