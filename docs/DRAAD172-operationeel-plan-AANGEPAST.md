# DRAAD172 - Operationeel Plan (AANGEPAST)

**Datum**: 13 december 2025
**Status**: LIVE EXECUTION
**Versie**: 1.0

---

## 1. Doelstelling

**Primair doel**: Bouwen en valideren van een comprehensive test suite voor de **5-weken rooster** solving workflow, gekoppeld aan **LIVE Supabase-data**, met focus op:

- ✅ Live integration testing (echte database)
- ✅ CP-SAT solver validation op production-achtige schaal
- ✅ Performance metrics en bottleneck detection
- ✅ Constraint violation reporting
- ✅ Cache-busting en Railway deployment
- ✅ End-to-end documentation

---

## 2. Scope

### 2.1 Wat IS onderdeel van DRAAD172

1. **Live Integration Test** (`test_live_5week_roster_draad172.py`)
   - Supabase data fetcher met graceful fallback naar mock data
   - Verbinding naar live rooster database
   - Real employee, service, en constraint data
   - CP-SAT solver execution op 5-weken periode
   - Performance logging

2. **Cache-Busting & Deployment**
   - `.cache-bust-draad172` marker file
   - `solver/.cache-bust-draad172` versie
   - Railway trigger configuratie
   - Deployment naar Solver2 service

3. **Documentation**
   - Dit operationeel plan (AANGEPAST)
   - EXECUTION-LOG met commit history, test results, metrics
   - GitHub commits en PR workflow

4. **Kwaliteitsborging**
   - Syntax validatie van alle nieuwe Python code
   - Test execution via pytest
   - Logging van solve times, coverage, violations

### 2.2 Wat NIET onderdeel van DRAAD172

- Refactoring van bestaande solver code (DRAAD167, DRAAD170 afgerond)
- UI/UX wijzigingen in rooster-app-verloskunde
- Database schema migrations (Supabase database is al correct)
- Machine learning of optimization algoritme improvements

---

## 3. Mapping naar Bestaande DRAAD-Issues

| DRAAD | Fase | Status | Relatie tot DRAAD172 |
|-------|------|--------|----------------------|
| DRAAD117 | Schema setup | ✅ DONE | Supabase tables beschikbaar |
| DRAAD131 | Status enum fix | ✅ DONE | Assignment status='1' (ingepland) beschikbaar |
| DRAAD166 | OR-Tools interface | ✅ DONE | CP-SAT solver engine operationeel |
| DRAAD167 | Fase 1,2,3 | ✅ DONE | Sequential solver fully tested |
| DRAAD170 | Fase 1,2,3 | ✅ DONE | Constraint system validated |
| DRAAD168 | Fase 1 | ✅ DONE | Basic solver execution OK |
| **DRAAD172** | **LIVE integration** | 🔄 IN PROGRESS | **THIS IS NOW** |
| DRAAD173 | Production ready | 📋 PLANNED | Depends on DRAAD172 ✓ |

---

## 4. Technische Stack

### Backend (Solver2)
```
┌─────────────────────────────────────────┐
│ CP-SAT Solver (Google OR-Tools)         │
│ - solver_engine.py (sequential)         │
│ - models.py (data structures)           │
│ - test_live_5week_roster_draad172.py   │ ← NEW
└─────────────────────────────────────────┘
         ↓ (REST API)
┌─────────────────────────────────────────┐
│ main.py (FastAPI)                       │
│ - /solve endpoint                       │
│ - /status endpoint                      │
└─────────────────────────────────────────┘
         ↓ (SQL)
┌─────────────────────────────────────────┐
│ Supabase PostgreSQL                     │
│ - roosters, employees, services         │
│ - roster_assignments, constraints       │
│ - solver_runs, constraint_violations    │
└─────────────────────────────────────────┘
```

### Frontend (rooster-app-verloskunde)
```
┌─────────────────────────────────────────┐
│ React/Next.js UI                        │
│ - Rooster visualization                 │
│ - Manual planning interface             │
└─────────────────────────────────────────┘
         ↓ (HTTP)
┌─────────────────────────────────────────┐
│ Solver2 Service (Railway)               │
│ - /solve POST endpoint                  │
│ - /test/live POST endpoint ← NEW        │
└─────────────────────────────────────────┘
```

---

## 5. Test-Strategie

### 5.1 Live Integration Test

**Bestandsnaam**: `solver/test_live_5week_roster_draad172.py`

**Test Flow**:
```python
1. Instantiate SupabaseLiveDataFetcher()
   ↓
2. fetch_active_roster()  → Get current roster
   ↓
3. fetch_employees()      → Get employees
   fetch_services()       → Get services
   fetch_roster_employee_services() → Get bevoegdheden
   fetch_exact_staffing() → Get constraints
   ↓
4. Build solver models (Employee, Service, etc.)
   ↓
5. RosterSolver.solve()   → Execute CP-SAT
   ↓
6. Verify:
   - Status (OPTIMAL, FEASIBLE, etc.)
   - solve_time_seconds >= 0
   - total_slots > 0
   - fill_percentage >= 50%
   ↓
7. Log execution report JSON
```

**Graceful Fallback**:
- Als Supabase niet bereikbaar → Mock data
- Mock data: 3-5 employees, 3 services, 5 weeks
- Geen test-failures door connectie issues

### 5.2 Test Markers

```bash
# Run live tests only
pytest solver/ -m live_integration

# Run DRAAD172 tests
pytest solver/ -m draad172

# Run all tests
pytest solver/ -v
```

---

## 6. Performance Metrics

### 6.1 Metrics Captured

| Metriek | Eenheid | Doelwaarde | Formule |
|---------|---------|------------|----------|
| **solve_time_seconds** | sec | < 30s | clock time |
| **fill_percentage** | % | > 60% | assignments / total_slots |
| **constraint_violations** | count | < 10 hard | violations.count() |
| **coverage_rate** | % | > 80% | met_exact_staffing / total_required |
| **employees_count** | count | 3-10 | len(employees) |
| **services_count** | count | 3-5 | len(services) |
| **total_variables** | count | info | variables created in model |
| **total_constraints** | count | info | constraints added to model |

### 6.2 Bottleneck Detection

Wanneer `status == INFEASIBLE`:
1. Check exact_staffing requirements
2. Check employee availability
3. Check service expertise (bevoegdheden)
4. Log capacity gaps per service/dagdeel
5. Generate recommendations

---

## 7. Execution Plan

### 7.1 Phase A: Implementation (NOW)

```
✅ DONE:
1. Create test_live_5week_roster_draad172.py
   - SupabaseLiveDataFetcher class
   - Live data fetch methods
   - Mock data fallback
   - Solver execution wrapper

2. Create cache-bust files
   - .cache-bust-draad172 (root)
   - solver/.cache-bust-draad172 (solver dir)

3. Create documentation
   - docs/DRAAD172-operationeel-plan-AANGEPAST.md (THIS)
   - docs/DRAAD172-EXECUTION-LOG.md (NEXT)
```

### 7.2 Phase B: Validation (NEXT)

```
📋 TODO:
1. Run live test locally (if Supabase available)
2. Run live test on Railway (Solver2 service)
3. Validate test coverage
4. Review test output and metrics
```

### 7.3 Phase C: Deployment

```
📋 TODO:
1. Create PR from main
2. Add description with links to docs
3. Wait for automated checks
4. Merge to main
5. Tag: git tag draad172-v1.0
6. Deploy to Railway (Solver2 + Frontend)
```

---

## 8. Communicatie & Status

### 8.1 Progress Tracking

Status wordt bijgehouden in:
- ✅ `.DRAAD172-ACTIVE` marker (created after Phase A)
- ✅ Commits in GitHub (linked to test file)
- ✅ EXECUTION-LOG.md (updated after Phase B)
- ✅ PR description (Phase C)

### 8.2 Key Contacts

- **Solver Development**: [Your GitHub account]
- **Supabase Database**: [DB credentials in Railway ENV]
- **Frontend Integration**: rooster-app-verloskunde maintainers

---

## 9. Risico's & Mitigatie

| Risico | Impact | Waarschijnlijkheid | Mitigatie |
|--------|--------|-------------------|----------|
| Supabase connectie fails | MEDIUM | LAAG | Mock data fallback |
| Solver times out | MEDIUM | LAAG | 30s timeout, graceful handling |
| Infeasible solution | MEDIUM | GEMIDDELD | Bottleneck detection, logging |
| Cache-bust fails | LOW | LAAG | Manual Railway restart fallback |
| Test fails locally | MEDIUM | GEMIDDELD | Run on Railway first, then PR |

---

## 10. Volgende Stappen

1. ✅ **Phase A COMPLETE**: Code committed to GitHub
2. 🔄 **Phase B TODO**: Run tests and capture metrics
3. 📋 **Phase C TODO**: PR → Merge → Tag → Deploy
4. 📋 **DRAAD173**: Production readiness validation

---

## 11. Referenties

- [DRAAD167 Fase 1-3 README](solver/DRAAD167-FASE3-README.md)
- [DRAAD170 Fase 1-3 README](solver/DRAAD170-FASE123-DEPLOYMENT-SUMMARY.md)
- [Solver Engine](solver/solver_engine.py)
- [Models](solver/models.py)
- [Supabase Database Schema](https://supabase.com)
- [Google OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver)

---

**Document Status**: ACTIVE
**Last Updated**: 2025-12-13 09:55:00 CET
**Next Review**: After Phase B completion
