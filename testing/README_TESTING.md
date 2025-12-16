# 🧪 GREEDY SERVICE TESTING - COMPLETE DOCUMENTATION

**Project:** Rooster Verloskunde  
**Phase:** DRAAD 194 FASE 2 - OPTIE C  
**Date:** 16 December 2025  
**Status:** ✅ READY FOR EXECUTION

---

## 📑 DOCUMENTATION FILES

All testing files are in the `testing/` directory:

```
testing/
├─ README_TESTING.md                    → This file (Index)
├─ GREEDY_TEST_SUITE.html              → Interactive HTML tests
├─ GREEDY_TESTEN_UITVOERING.md         → Dutch execution guide
├─ STAP3_TEST_PLAN.md                   → Detailed test procedures
└─ STAP3_TEST_REPORT_TEMPLATE.md       → Report template for recording
```

---

## 🚀 QUICK START (5 MINUTES)

### Option 1: Interactive Test Suite (EASIEST) ✅ RECOMMENDED

**This is what we built for you - fastest way to test!**

```
1. Download: testing/GREEDY_TEST_SUITE.html
2. Open in browser (Chrome/Firefox/Safari/Edge)
3. Click: "RUN ALL TESTS" button
4. Wait: ~30 seconds
5. See: All results instantly
```

**Direct Link:**
```
https://raw.githubusercontent.com/gslooters/rooster-app-verloskunde/main/testing/GREEDY_TEST_SUITE.html
```

### Option 2: Swagger UI (BUILT-IN)

```
Go to: https://greedy-production.up.railway.app/docs
• Try endpoints interactively
• See auto-generated API docs
• Test requests live
```

### Option 3: Browser Console (ADVANCED)

```
F12 → Console → Copy-paste code samples
See: GREEDY_TESTEN_UITVOERING.md (Methode C)
```

---

## 📊 TEST SUMMARY

### What Gets Tested

| Test | What | Time | Result |
|------|------|------|--------|
| Health Check | Service online? | 1-2 min | ✅ |
| Valid Request | Good data accepted? | 2-3 min | ✅ |
| Invalid UUID | Bad UUID rejected? | 2-3 min | ✅ |
| Bad Date Format | Wrong date rejected? | 2-3 min | ✅ |
| Bad Date Range | Inverted dates rejected? | 2-3 min | ✅ |

**Total Time:** ~15-20 minutes

### Success Criteria

```
✅ All 5 tests pass
✅ Response times reasonable (< 1 sec each)
✅ Error messages clear
✅ No HTTP 500 errors
✅ Service stable (no crashes)

If all green: GO to STAP 4
If any red: Debug & retest
```

---

## 📋 WHICH DOCUMENT TO USE?

### IF: You want to test NOW, fastest way
**THEN:** Use `GREEDY_TEST_SUITE.html`
• 3 minutes to open & run all tests
• Beautiful interactive interface
• All results in one place

### IF: You prefer step-by-step instructions in Dutch
**THEN:** Read `GREEDY_TESTEN_UITVOERING.md`
• 3 methods explained clearly
• Expected results for each
• Troubleshooting guide

### IF: You want detailed technical test procedures
**THEN:** Read `STAP3_TEST_PLAN.md`
• Test scenarios with exact payloads
• Expected responses
• Postman collection
• Success criteria per test

### IF: You need to record results officially
**THEN:** Use `STAP3_TEST_REPORT_TEMPLATE.md`
• Fill in: test results
• Sign off: approval
• Track: metrics
• Make decision: GO/NO-GO

---

## 📝 EXECUTION WORKFLOW

### Step 1: Preparation (2 minutes)

```
[ ] Check browser works (Chrome/Firefox/Safari/Edge latest version)
[ ] Internet connection active
[ ] Not behind restrictive firewall
```

### Step 2: Choose Testing Method (1 minute)

```
Pick ONE:
[ ] A - Interactive HTML suite (fastest)
[ ] B - Swagger UI (visual)
[ ] C - Browser console (technical)
```

### Step 3: Run Tests (15-20 minutes)

```
Execute all tests in chosen method
Record results
Note any issues
```

### Step 4: Evaluate (5 minutes)

```
[ ] All tests passed?
[ ] Response times acceptable?
[ ] Error handling working?
[ ] No critical issues?
```

### Step 5: Report (5 minutes)

```
[ ] Fill in test report
[ ] Sign off
[ ] Make GO/NO-GO decision
[ ] Plan next step
```

**Total Time: ~30-45 minutes**

---

## 🌟 EXPECTED RESULTS CHEAT SHEET

### Test 1: Health Check

```
Status: 200 OK
Time: < 500ms
Response includes:
  - service: "greedy-rostering-engine"
  - status: "ready"
  - endpoints: [list]
```

### Test 2: Valid Request

```
Status: 200 OK
Valid: true
Message: "Request is valid"
```

### Tests 3-5: Error Cases

```
Status: 200 OK
Valid: false
Message: [Specific error]
Example: "Invalid roster_id: 'INVALID' (not valid UUID)"
```

---

## 🚘 TROUBLESHOOTING QUICK FIX

### Service not responding

```
✅ Try: Refresh page (F5)
✅ Try: Wait 30 seconds
✅ Check: https://railway.app (service running?)
✅ Contact: DevOps if still down
```

### Tests timing out

```
✅ Try: Check internet speed
✅ Try: Try from different network
✅ Check: Service logs on Railway
```

### Validation always fails

```
✅ Check: UUID format (must be valid UUID)
✅ Check: Date format (must be YYYY-MM-DD)
✅ Check: Copied data correctly (no typos)
```

---

## 📀 FILES AT A GLANCE

### GREEDY_TEST_SUITE.html

```
What: Interactive HTML interface for testing
When: Use this first (fastest!)
How: Open in browser, click buttons
Time: 10-15 minutes
Skill: Zero technical knowledge needed
```

### GREEDY_TESTEN_UITVOERING.md

```
What: Step-by-step testing guide in Dutch
When: Use if you prefer written instructions
How: Read sections, follow steps
Time: 20-30 minutes
Skill: Beginner (browser basics needed)
Language: 100% Dutch
```

### STAP3_TEST_PLAN.md

```
What: Technical test procedures & specifications
When: Use for detailed testing
How: Run each test scenario
Time: 30-40 minutes
Skill: Intermediate (can read JSON)
Includes: Postman collection, exact payloads
```

### STAP3_TEST_REPORT_TEMPLATE.md

```
What: Official test results form
When: Use after running tests to record results
How: Fill in fields with test data
Time: 10-15 minutes
Skill: Simple form filling
Output: Official GO/NO-GO decision
```

### README_TESTING.md

```
What: This file - documentation index
When: Read first to understand what to do
How: Navigate to appropriate document
Time: 5 minutes
Skill: Just reading
```

---

## 📁 DOCUMENT FLOW DIAGRAM

```
    START HERE
        |
        v
   README_TESTING.md (this file)
        |
        +---- Choose method ----+
        |                       |
        v                       v
  Want fast?            Want detailed?
        |                    |
        v                    v
  GREEDY_TEST_        STAP3_TEST_
  SUITE.html          PLAN.md
        |                    |
        +---- Run tests -----+
             |
             v
        Got results?
        |
        +---- Record results ----+
             |
             v
        STAP3_TEST_
        REPORT_TEMPLATE.md
             |
             v
        GO/NO-GO Decision
             |
        +----+----+
        |         |
       GO        NO-GO
        |         |
        v         v
    STAP 4   Debug & Retry
  (Frontend)
```

---

## 🌏 ENVIRONMENT CHECK

Before you start, verify:

```
[ ] Browser: Chrome, Firefox, Safari, or Edge (recent version)
[ ] JavaScript: Enabled (should be by default)
[ ] Network: Internet connection working
[ ] Access: Can reach external HTTPS URLs
[ ] Time: You have 30-45 minutes available
[ ] Focus: Can concentrate without interruptions
```

---

## 🐛 TECH STACK (FYI)

What's being tested:

```
Frontend:
• HTML (Interactive test suite)
• JavaScript (Fetch API, console)
• Browser console (DevTools)

Backend:
• FastAPI (Python)
• Railway deployment
• Supabase database connection
• GREEDY solver algorithm
• Constraint validation (HC1-HC6)

Tools:
• Browser (any modern)
• Swagger/OpenAPI
• Postman (optional)
```

---

## ✅ SUCCESS = GO/NO-GO DECISION

### GO (Proceed to STAP 4)

```
Requirements:
✓ All 5 tests PASS
✓ Response times acceptable (< 1s each)
✓ No HTTP 500 errors
✓ Error handling working
✓ Service stable

Result:
🎉 Start STAP 4: Frontend Integration
   • Add buttons to dashboard
   • Integrate GREEDY service
   • Test user workflow
```

### NO-GO (Debug & Retest)

```
Issues:
❌ One or more tests FAIL
❌ Timeouts (> 2 sec)
❌ HTTP 500 errors
❌ Crashes or instability

Action:
🚿 Debug the problem
🚿 Check Railway logs
🚿 Verify Supabase
🚿 Rerun tests
```

---

## 📞 CONTACT & SUPPORT

### If tests fail

```
1. Check this README first
2. Review troubleshooting section
3. Check Railway dashboard: https://railway.app
4. Review logs in Railway
5. Contact DevOps team
```

### Questions about testing

```
1. Dutch? See: GREEDY_TESTEN_UITVOERING.md
2. Technical? See: STAP3_TEST_PLAN.md
3. Recording? See: STAP3_TEST_REPORT_TEMPLATE.md
4. Confused? Start with: GREEDY_TEST_SUITE.html
```

---

## 📎 NEXT STEPS AFTER GO

```
When all tests pass (GO):

1. Record results in test report
2. Get stakeholder sign-off
3. Move to STAP 4: Frontend Integration
   • Estimated duration: 1 day
   • Activities: UI changes, endpoint integration
   • Deliverable: Working dashboard with buttons
4. Full user testing with real roster data
5. Soft launch to production
```

---

## 📈 METRICS & REPORTING

### Key Metrics to Track

```
Performance:
• Health check response time (target: < 500ms)
• Validation response time (target: < 500ms)
• Error handling speed (target: < 200ms)
• Average response time (target: < 300ms)

Reliability:
• Test pass rate (target: 100%)
• No crashes (target: 0 crashes)
• No HTTP 500 errors (target: 0 errors)

Quality:
• Error message clarity (target: all clear)
• Constraint validation (target: all HC1-HC6 ready)
```

### Reporting

```
Use: STAP3_TEST_REPORT_TEMPLATE.md
Output: Official GO/NO-GO decision
Sign-off: Project Manager + DevOps
```

---

## 📄 DOCUMENT VERSIONS

```
Version 1.0:
• Released: 16 December 2025
• Status: Ready for use
• Content: Complete testing suite
• Files: 5 documents
• Languages: Dutch + English
```

---

## 📚 RELATED DOCUMENTATION

Other relevant documents:

```
main/ directory:
  • src/solver/greedy_engine.py (Implementation)
  • src/solver/greedy_api.py (API endpoints)
  • src/solver/constraint_checker.py (Constraints)
  • src/solver/test_greedy_engine.py (Unit tests)

```

---

## 🌟 FINAL CHECKLIST

Before you start testing:

```
Preparation:
[ ] Read this README (5 min)
[ ] Choose testing method (1 min)
[ ] Verify environment (2 min)

Execution:
[ ] Run tests (15-20 min)
[ ] Record results (5 min)
[ ] Make decision (2 min)

Closing:
[ ] Fill test report (5 min)
[ ] Get sign-off (5 min)
[ ] Plan STAP 4 (2 min)

Total: 40-50 minutes
```

---

## 🚀 LET'S GO!

**Ready to start testing?**

### Quick Path (Fastest)

```
1. Download: GREEDY_TEST_SUITE.html
2. Open in browser
3. Click: "RUN ALL TESTS"
4. See: Results in 30 seconds
5. Done!
```

### Detailed Path (Most Control)

```
1. Read: GREEDY_TESTEN_UITVOERING.md
2. Follow: Step-by-step instructions
3. Run: Individual tests
4. Record: Each result
5. Report: Official test report
```

---

**Document Version:** 1.0  
**Status:** Ready for Use  
**Updated:** 16 December 2025  
**Language:** English + Dutch (in linked documents)

---

**Good luck testing! 🚀🙋**

Questions? Check the troubleshooting section or your specific document.
