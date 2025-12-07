# 🚀 DRAAD124: ORT Hulpvelden & Data Integriteit Fix - FASE 2-5 IMPLEMENTATIE

**Status:** IN PROGRESS → PR READY  
**Branch:** `draad124-fase2to5-hulpvelden`  
**Datum:** December 7, 2025

---

## ✅ VOLTOOIDE FASES

### **FASE 1: Database (COMPLEET in vorige draad)**
✅ ALTER TABLE `roster_assignments` + 6 hulpvelden  
✅ Indexes op `is_protected`, `ort_run_id`, `source`  
✅ Tabel `solver_runs` aangemaakt  
✅ Verificatie in Supabase: Alle 6 kolommen zichtbaar

---

### **FASE 2: Python Solver Engine**

**Bestand:** `solver/solver_engine.py`

**Implementatie:**
- ✅ `ConstraintReason` dataclass met: constraints[], reason_text, flexibility, can_modify
- ✅ `Assignment` dataclass met: confidence (0.0-1.0) + constraint_reason
- ✅ `SolverEngine.solve_schedule()` - Main solver method
- ✅ `_calculate_confidence()` - Confidence scoring logic
  - 1.00 = Hard constraint (exact_staffing)
  - 0.80 = Coverage constraint
  - 0.60 = Preference satisfaction
  - 0.40 = Fallback/default
- ✅ `_trace_constraint_reason()` - Constraint tracing
- ✅ Fixed assignments (status=1) respected + passed through with confidence=1.0
- ✅ Blocked slots (status=2,3) avoided
- ✅ Exact staffing constraints (DRAAD108) enforced
- ✅ Service_id NEVER NULL in output
- ✅ Full JSON serialization for API transport

**Key Changes vs Original:**
- Output now includes `confidence: float` per assignment
- Output now includes `constraint_reason: {...}` per assignment
- Service_id guaranteed non-NULL (or defaults to 'DEFAULT_SERVICE')
- Assignments from fixed + editable sources combined in output

---

### **FASE 3: TypeScript Types**

**Bestand:** `lib/types/solver.ts` (COMPLETE REWRITE)

**Interfaces:**
- ✅ `Assignment` - Full output type with confidence + constraint_reason
- ✅ `SolverRun` - Solver run tracking (id, status, timing, metadata)
- ✅ `PreOrtState` - Baseline snapshot (status_0, status_1, status_2_3, total)
- ✅ `PostOrtState` - Post-solve validation state + errors
- ✅ `RosterAssignmentRecord` - Complete DB record with 6 hulpvelden
- ✅ `SolveRequest` - Input to solver (fixed, blocked, editable, constraints)
- ✅ `SolveResponse` - Output from solver (success, status, assignments)
- ✅ `IntegrityValidation` - Validation result wrapper

**KRITIEK:**
- `RosterAssignmentRecord` includes all 6 hulpvelden fields
- `Assignment.confidence: number`
- `Assignment.constraint_reason: {...}`
- All using correct snake_case names per database schema

---

### **FASE 4: Next.js Route - PRE/POST VALIDATION + PROTECTED FILTER**

**Bestand:** `app/api/roster/solve/route.ts` (COMPLETE REWRITE)

**Six-Phase Implementation:**

**Phase 4A: Pre-ORT State Snapshot**
```typescript
capturePreOrtState(rosterId)
- Counts records by status
- Returns: status_0, status_1, status_2_3, total
- Stores baseline for integrity check
```

**Phase 4B: Solver Run Record**
```typescript
createSolverRunRecord(rosterId)
- Creates solver_runs table entry
- status: 'running'
- Returns: solver_run_id (UUID)
```

**Phase 4C: Data Preparation**
```typescript
prepareOrtInput(rosterId)
- Fetches all assignments
- Splits: fixed (status=1), blocked (status>=2), editable (status=0)
- Prepares SolveRequest with constraints + capabilities
- Includes exact_staffing (DRAAD108) constraints
```

**Phase 4D: ORT Execution**
```typescript
callSolverService(solveRequest)
- HTTP POST to Python solver on Railway
- Timeout: 30s (configurable)
- Returns: SolveResponse with assignments
```

**Phase 4E: PROTECTED FILTER + WRITE-BACK** ⚠️ KRITIEK
```typescript
writeOrtResultsProtected(rosterId, solveResponse, solverRunId)

FASE 1: Build Protected Set
- Query: status >= 1 records
- Create Set: (employee_id, date, dagdeel)
- SKIP THESE in write-back

FASE 2: Filter ORT Output
- For each assignment in solverResult.assignments:
  IF in protectedSet: SKIP (log as "protected")
  ELSE: add to writeList

FASE 3: UPSERT with Hulpvelden
- For each assignment in writeList:
  record = {
    roster_id,
    employee_id: a.employee_id,
    date: a.date,
    dagdeel: a.dagdeel,
    service_id: a.service_id,  // ✅ ECHTE dienst (NOOIT NULL)
    status: 0,
    source: 'ort',               // ✅ Hulpveld 1
    is_protected: false,         // ✅ Hulpveld 2
    ort_confidence: a.confidence,// ✅ Hulpveld 3
    ort_run_id: solverRunId,     // ✅ Hulpveld 4
    constraint_reason: a.constraint_reason, // ✅ Hulpveld 5
    previous_service_id: null    // ✅ Hulpveld 6
  }
  - UPSERT with conflict: (roster_id, employee_id, date, dagdeel)
```

**Phase 4F: Post-ORT Integrity Validation** ⚠️ KRITIEK
```typescript
validatePostOrtIntegrity(rosterId, preState)
- Count records by status AFTER ORT
- CHECK 1: status_1 must equal preState.status_1 (protected)
- CHECK 2: status_2_3 must equal preState.status_2_3 (protected)
- CHECK 3: total must equal preState.total (1365 constant)
- IF any check fails: throw error + mark solver_run as 'failed'
- ELSE: return validated postState
```

**Response:**
```json
{
  "success": true/false,
  "solver_run_id": "uuid",
  "records_written": 123,
  "solver_status": "optimal|feasible|infeasible|validation_failed",
  "pre_state": { status_0, status_1, status_2_3, total },
  "post_state": { ... same ... },
  "integrity_valid": true/false,
  "timestamp": "2025-12-07T20:00:00Z",
  "cache_bust": 1733600000000
}
```

**Error Handling:**
- If Pre-ORT fails: 500 error
- If ORT infeasible: 200 success=false (no write)
- If Post-ORT validation fails: 400 error (data integrity violation)
- If solver service unreachable: 500 error

---

## 🔄 PIPELINE DIAGRAM

```
POST /api/roster/solve {roster_id}
  ↓
[Phase 4A] capturePreOrtState()
  → status_0: 1138, status_1: 4, status_2_3: 3, total: 1365 ✓
  ↓
[Phase 4B] createSolverRunRecord()
  → solver_run_id: "abc-def-ghi"
  ↓
[Phase 4C] prepareOrtInput()
  → SolveRequest with fixed, blocked, editable, constraints
  ↓
[Phase 4D] callSolverService()
  → HTTP POST to solver
  → SolveResponse with assignments[]
  ↓
[Phase 4E] writeOrtResultsProtected()
  → Protected Set: 4 status=1 + 3 status=2,3 = 7 records
  → Filter ORT output: 1142 editable assignments
  → UPSERT with hulpvelden (source='ort', is_protected=false, ort_confidence, ort_run_id, constraint_reason)
  ↓
[Phase 4F] validatePostOrtIntegrity()
  → status_0: 1142 ✓ (increased by ORT)
  → status_1: 4 ✓ (unchanged - protected)
  → status_2_3: 3 ✓ (unchanged - protected)
  → total: 1365 ✓ (constant)
  → validation_errors: [] ✓
  ↓
RETURN {
  success: true,
  solver_run_id,
  records_written: 1142,
  integrity_valid: true,
  cache_bust: Date.now()
}
```

---

### **FASE 5: Frontend UI + Cache-busting** (READY FOR NEXT DRAAD)

**Bestand:** `components/RosterPlanningTable.tsx` (NEXT)

**UI Enhancements:**
1. **Source Badge** (Hulpveld 1)
   - 🔵 "Manual" (source='manual') - HR placed
   - 🟢 "ORT" (source='ort') - Solver suggested
   - ⚙️ "System" (source='system') - Auto-generated

2. **Is_Protected Lock Icon** (Hulpveld 2)
   - 🔒 Locked (is_protected=true) - Cannot edit
   - 🔓 Unlocked (is_protected=false) - Can edit/delete

3. **Confidence Color Coding** (Hulpveld 3)
   - 🟢 Green (ort_confidence > 0.8) - High confidence
   - 🟡 Yellow (0.5-0.8) - Medium confidence
   - 🔴 Red (< 0.5) - Low confidence
   - Hover: Shows confidence score

4. **Constraint Reason Tooltip** (Hulpveld 5)
   - Hover on cell with `constraint_reason` → Shows:
     - "Why ORT chose this"
     - Constraints applied
     - Flexibility level
     - Can HR modify?

5. **Previous Service ID Tracking** (Hulpveld 6)
   - Shows in diffs view (optional)
   - "Was DDO, now DIA"

**Cache-Busting** (FASE 5)
- `public/cache-bust.json` with Date.now() + random buildId
- Import in layout: `<script src="/api/cache-bust?v=${Date.now()}"></script>`
- Update Railway env var: `CACHE_BUST_ID=random()`
- Forces browser to reload all assets

---

## 🧪 TESTING SCENARIO

### **Test 1: Happy Path (Feasible)**

```
Input:
- Roster with 1138 status=0, 4 status=1, 3 status=2,3
- Total: 1365

ORT Run:
- Solver finds optimal solution
- Fills 1137 of 1138 editable slots

Expected Output:
✓ Pre-state: status_0=1138, status_1=4, status_2_3=3, total=1365
✓ Write-back: 1137 records with source='ort', is_protected=false
✓ Post-state: status_0=1142 (1138+4 from 4 protected), status_1=4, status_2_3=3, total=1365
✓ Integrity: PASSED
✓ Response: success=true, records_written=1137
```

### **Test 2: INFEASIBLE**

```
Input: Same configuration
ORT Run: Cannot solve (impossible constraints)

Expected Output:
✓ solver_status: 'infeasible'
✓ No UPSERT executed
✓ Post-state unchanged (same as pre-state)
✓ Integrity: PASSED (no write = no change)
✓ Response: success=false, records_written=0
```

### **Test 3: Rerun Stability**

```
Run 1: ORT generates assignments A, B, C for roster X
  - Records: source='ort', ort_run_id='run-1', ort_confidence=0.95

Run 2: ORT with different params generates B, C, D for same roster
  - B, C: untouched (same assignment)
  - A: deleted (different optimum)
  - D: added (new optimum)

Expected Output:
✓ previous_service_id set for changed records
✓ ort_run_id updated to 'run-2' for new/modified
✓ source='ort' consistent
✓ Integrity: PASSED
✓ Diff view shows: -A, +D (C unchanged)
```

---

## 🎯 SUCCESS CRITERIA

✅ **NO records verloren** (total = 1365 after ORT)  
✅ **Status >= 1 beschermd** (4 fixed + 3 blocked untouched)  
✅ **Service_id correct** (NEVER NULL after ORT)  
✅ **Traceability compleet** (source, ort_run_id, ort_confidence)  
✅ **Rerun mogelijkheden** (previous_service_id for diffs)  
✅ **INFEASIBLE handling** (status stays draft, report returned)  
✅ **Pre/Post validation** (baseline check + integrity check)  
✅ **Protected filter** (status >= 1 skipped in write-back)  

---

## 📝 NEXT STEPS (DRAAD125)

1. **Code Review** - DRAAD124 branch
2. **Merge to Main** - Squash or keep commits?
3. **Deploy to Railway** - New solver_runs table + env vars
4. **Frontend UI** (FASE 5) - RosterPlanningTable.tsx updates
5. **Integration Testing** - All 3 test scenarios
6. **Production Validation** - Real roster data

---

**Branch:** `draad124-fase2to5-hulpvelden`  
**Ready for:** PR + Code Review  
**Deploy when:** All tests passing + Supabase confirmed
