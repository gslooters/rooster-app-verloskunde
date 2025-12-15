# DRAAD 185: GREEDY Rostering Engine Implementation

**Status:** 🟢 PHASE 1 COMPLETE  
**Date:** 2025-12-15  
**Last Updated:** 2025-12-15 17:20 CET  

---

## 📋 Overview

DRAAD 185 implements the **GREEDY Rostering Engine** - a fast, transparent scheduling algorithm for shift allocation.

### Key Metrics

| Metric | Target | Status |
|--------|--------|--------|
| **Solve Time** | 2-5 seconds | ✅ Expected |
| **Coverage** | 98%+ | ✅ Expected |
| **Constraint Violations** | <10 | ✅ Expected |
| **HTTP Response** | 200 OK | ✅ Implemented |

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│ Next.js Frontend (Vercel)                           │
├─────────────────────────────────────────────────────┤
│ app/api/roster/solve-greedy/route.ts                │
│ (Next.js API Route)                                 │
└──────────────┬──────────────────────────────────────┘
               │ POST /api/roster/solve-greedy
               │ {roster_id, start_date, end_date}
               ↓
┌──────────────────────────────────────────────────────┐
│ Python GREEDY Service (Railway)                     │
├──────────────────────────────────────────────────────┤
│ api/greedy_solver_wrapper.py (FastAPI)              │
│ /api/v1/solve-greedy                                │
│ ├─ GreedyRosteringEngine                            │
│ ├─ HardConstraintChecker (HC1-HC6)                  │
│ └─ Database operations (Supabase)                   │
└──────────────┬───────────────────────────────────────┘
               │ Returns SolveResult
               │ {status, coverage, assignments, bottlenecks}
               ↓
┌──────────────────────────────────────────────────────┐
│ Supabase PostgreSQL Database                        │
├──────────────────────────────────────────────────────┤
│ ├─ roster_assignments (assignments written)         │
│ ├─ roster_employee_services (capabilities)          │
│ ├─ period_employee_staffing (targets)               │
│ ├─ roster_period_staffing_dagdelen (requirements)   │
│ └─ solver_runs (metadata)                           │
└──────────────────────────────────────────────────────┘
```

### 5-Phase Algorithm

1. **Phase 1: Lock Pre-Planned**
   - Validate fixed assignments
   - Preserve with HC constraints
   - Load into memory

2. **Phase 2: Greedy Allocate**
   - Iterate through date/dagdeel/service slots
   - Find eligible employees (HC1-HC6 validated)
   - Assign by fairness (fewest shifts first)
   - Detect bottlenecks (shortages)

3. **Phase 3: Analyze Bottlenecks**
   - Diagnose unfilled slots
   - Suggest solutions (train, reduce requirement)
   - Document reasons

4. **Phase 4: Save to Database**
   - Bulk insert greedy assignments
   - Update solver_runs metadata
   - Set roster status to in_progress

5. **Phase 5: Return Result**
   - Format response with metrics
   - Include coverage percentage
   - Provide bottleneck details

---

## 🔧 Implementation Files

### Core Solver Engine

**File:** `src/solver/greedy_engine.py` (21.6 KB)  
**Lines:** 600+  
**Components:**
- `Employee` dataclass
- `ServiceType` dataclass
- `RosteringRequirement` dataclass
- `GreedyRosteringEngine` class
  - `solve()` - Main 5-phase algorithm
  - `_lock_pre_planned()` - Phase 1
  - `_greedy_allocate()` - Phase 2
  - `_analyze_bottlenecks()` - Phase 3
  - `_save_assignments()` - Phase 4

### Constraint Checker

**File:** `src/solver/constraint_checker.py` (11.5 KB)  
**Lines:** 400+  
**Constraints Implemented:**
- HC1: Employee capable for service
- HC2: No overlapping shifts
- HC3: Respect blackout dates
- HC4: Max shifts per employee
- HC5: Max per specific service
- HC6: Team-aware assignment logic

**Features:**
- Caching for performance
- Type hints throughout
- Clear error logging

### FastAPI Wrapper

**File:** `api/greedy_solver_wrapper.py` (5.6 KB)  
**Endpoint:** `POST /api/v1/solve-greedy`  
**Features:**
- Request validation
- GreedyRosteringEngine instantiation
- Solver execution
- Result formatting
- Error handling

### Next.js Integration

**File:** `app/api/roster/solve-greedy/route.ts` (6.8 KB)  
**Endpoint:** `POST /api/router/solve-greedy`  
**Features:**
- Client-side API handler
- Roster validation
- Solver service call
- Metadata persistence
- Status updates

### Testing

**File:** `tests/test_greedy_api_integration.py` (7.7 KB)  
**Test Classes:**
- `TestHealthCheck`
- `TestSolveGreedyEndpoint`
- `TestResponseFormat`
- `TestPerformance`

**Test Counts:** 10+ test cases

### Configuration

**File:** `requirements.txt`  
**Dependencies:**
- fastapi==0.104.1
- uvicorn[standard]==0.24.0
- pydantic==2.5.0
- supabase==2.4.0
- pytest==7.4.3

**File:** `Dockerfile.greedy`  
**Purpose:** Container image for Railway deployment

---

## 🚀 Deployment (Railway.com)

### Prerequisites

1. Python service created on Railway
2. Environment variables configured:
   - `SUPABASE_URL` - Database URL
   - `SUPABASE_KEY` - API key
   - `PORT` - Service port (default: 5000)

### Build & Deploy

```bash
# Local test
cd .
pip install -r requirements.txt
python -m api.greedy_solver_wrapper

# Railway deployment
# 1. Configure in Railway dashboard
# 2. Set Dockerfile: Dockerfile.greedy
# 3. Set start command: python -m api.greedy_solver_wrapper
# 4. Deploy
```

### Service Configuration

```yaml
Service: GREEDY Solver
Dockerfile: Dockerfile.greedy
Port: 5000
Environment:
  SUPABASE_URL: ${{ SUPABASE_URL }}
  SUPABASE_KEY: ${{ SUPABASE_KEY }}
  PORT: 5000
Health Check: /health
```

---

## 📊 Database Schema

### Tables Used

| Table | Purpose | Read/Write |
|-------|---------|------------|
| `employees` | Employee master data | Read |
| `service_types` | Service definitions | Read |
| `roster_assignments` | All assignments | Read/Write |
| `roster_employee_services` | Employee capabilities | Read |
| `period_employee_staffing` | Shift targets per employee | Read |
| `roster_period_staffing_dagdelen` | Requirements per slot | Read |
| `solver_runs` | Solver execution metadata | Write |
| `roosters` | Roster status | Read/Update |

### Fields Referenced

**employees**
- `id` (text) - Employee ID
- `voornaam`, `achternaam` - Name
- `team` - Team (GRO, ORA, TOT)
- `dienstverband` - Employment type
- `structureel_nbh` - Structure data

**roster_assignments**
- `id`, `roster_id`, `employee_id` - Keys
- `date`, `dagdeel` - When
- `service_id` - What
- `status` - Assignment status (0-3)
- `source` - "fixed" or "greedy"
- `ort_run_id` - Solver run ID

**solver_runs**
- `id`, `roster_id` - Keys
- `status` - Solve result
- `solve_time_seconds` - Duration
- `coverage_rate` - Success rate
- `total_assignments` - Count
- `constraint_violations` - Issues
- `metadata` - Additional info

---

## ✅ Test Coverage

### Unit Tests

File: `src/solver/test_greedy_engine.py` (17.2 KB)  
Test Cases: 10+

```bash
pytest src/solver/test_greedy_engine.py -v
```

### Integration Tests

File: `tests/test_greedy_api_integration.py`  
Test Cases: 10+

```bash
pytest tests/test_greedy_api_integration.py -v
```

### Test with Live Data

```bash
# Set environment
export SUPABASE_URL=xxx
export SUPABASE_KEY=xxx

# Run integration tests
pytest tests/test_greedy_api_integration.py::TestSolveGreedyEndpoint::test_solve_greedy_success -v
```

---

## 🔐 Hard Constraints (HC1-HC6)

### HC1: Employee Capability

**Rule:** Employee must be trained for service  
**Check:** `roster_employee_services` where actief=true  
**Failure:** Skip employee, try next

### HC2: No Overlapping Shifts

**Rule:** Employee can't work same date/dagdeel twice  
**Check:** In-memory assignments list  
**Failure:** Skip employee, try next

### HC3: Blackout Dates

**Rule:** Respect employee unavailability  
**Check:** `roster_assignments` where status=3 (unavailable)  
**Failure:** Skip employee, try next

### HC4: Max Shifts per Employee

**Rule:** Don't exceed target from `period_employee_staffing.target_shifts`  
**Default:** 8 shifts
**Check:** Current count vs. target  
**Failure:** Skip employee, try next

### HC5: Max per Specific Service

**Rule:** Don't exceed `roster_employee_services.aantal` for service  
**Check:** Service-specific limit  
**Failure:** Skip employee, try next

### HC6: Team Logic

**Rule:** Team-aware assignments  
- GRO services → GRO employees (strict)
- ORA services → ORA employees (strict)
- TOT services → any employee (flexible)

**Check:** service_types.team vs employees.team  
**Failure:** Skip employee (or allow based on config)

---

## 📈 Performance Targets

### Expected Performance

```
Metric                  Target      Notes
─────────────────────────────────────────────────────
Solve Time             2-5 sec     From button click to response
Coverage              98%+        Assignments/total slots
Database Calls        ~5          Batch queries in load phase
Constraint Violations <10         Mostly HC3 (blackout)
HTTP Response         200 OK      All constraints satisfied
```

### Optimization Techniques

1. **Batch Loading** - Single DB query per table
2. **In-Memory Processing** - No DB access in greedy loop
3. **Caching** - Constraint checker caches
4. **Fairness Scoring** - Prefer employees with fewer shifts
5. **Bulk Insert** - Single INSERT for all greedy assignments

---

## 🐛 Known Limitations

### Current Constraints

1. **Greedy Algorithm**
   - May not find optimal solution
   - Order-dependent (date iteration affects results)
   - Deterministic but not globally optimal

2. **Team Logic (HC6)**
   - Currently strict matching for GRO/ORA
   - Could be relaxed with fallback rules
   - TOT services allow any team

3. **Fairness Scoring**
   - Simple `1 / (shifts_count + 1)` formula
   - Doesn't weight by employee preferences
   - Doesn't consider service specialization

4. **Bottleneck Analysis**
   - Generic suggestions ("train more", "reduce requirement")
   - Doesn't analyze specific constraint failures
   - Could be improved with detailed diagnostics

### Future Enhancements

- [ ] Weighted fairness scoring (preferences, specialization)
- [ ] Intelligent constraint relaxation (if time permits)
- [ ] Multi-pass algorithm (first pass strict, second pass relaxed)
- [ ] Machine learning for pattern recognition
- [ ] Parallel processing for large rosters

---

## 📚 Documentation

### Key Files

- **DRAAD 178:** `src/solver/GREEDY_ENGINE_README.md` - Architecture overview
- **DRAAD 185 Plan:** `DRAAD-185-EXECUTION-PLAN.md` - Detailed implementation guide
- **This File:** `DRAAD185_GREEDY_IMPLEMENTATION.md` - Current implementation status

### API Documentation

#### Endpoint: POST /api/v1/solve-greedy

**Request:**
```json
{
  "roster_id": "755efc3d-bcd2-4dfc-bc2e-278f3ba4ea58",
  "start_date": "2025-11-24",
  "end_date": "2025-12-28"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "assignments_created": 224,
  "total_required": 228,
  "coverage": 98.2,
  "solve_time": 3.2,
  "bottlenecks": [
    {
      "date": "2025-12-01",
      "dagdeel": "A",
      "service_id": "uuid-1",
      "need": 2,
      "assigned": 1,
      "shortage": 1,
      "reason": "No capable employees available",
      "suggestion": "Train 1 more employee for this service"
    }
  ],
  "pre_planned_count": 50,
  "greedy_count": 174,
  "message": "GREEDY solver: 98.2% coverage in 3.2s"
}
```

---

## 🎯 Next Steps

### Phase 2: Frontend Integration
- [ ] Add "🤖 Automatisch Invullen" button to preplanning page
- [ ] Wire button to `/api/router/solve-greedy`
- [ ] Show solve progress and results
- [ ] Display coverage percentage and bottlenecks

### Phase 3: Production Testing
- [ ] Deploy to Railway
- [ ] Test with live rooster data
- [ ] Monitor performance metrics
- [ ] Verify solver_runs metadata

### Phase 4: Monitoring & Optimization
- [ ] Set up performance dashboards
- [ ] Monitor constraint violations
- [ ] Analyze bottleneck patterns
- [ ] Optimize based on actual usage

---

## 📞 Support & Questions

**DRAAD 185 Contact:** AI Assistant  
**Repository:** https://github.com/gslooters/rooster-app-verloskunde  
**Database:** Supabase (rzecogncpkjfytebfkni)

---

**Last Updated:** 2025-12-15 17:20 CET  
**DRAAD 185 Status:** Phase 1 Complete ✅
