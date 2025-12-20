# ⚠️ DEPRECATED - backend/greedy-service

## Archivering Datum
2025-12-20 (DRAAD223)

## Reden
Deze directory bevatte de **oude lokale GREEDY service** die vervangen is door een dedicated Railway service na DRAAD217.

## Nieuwe Architectuur (DRAAD217)

Na DRAAD217 hebben we THREE Railway services:

1. **rooster-app-verloskunde** (Next.js + API routes)
   - Deployment: Railway automatic deploy from main branch
   - Endpoints: `/api/*` routes

2. **Solver2** (OR-Tools solver)
   - Directory: `/solver2`
   - Deployment: Railway service "Solver2"
   - Endpoint: Via `SOLVER2_URL` environment variable

3. **Greedy** (FastAPI greedy solver)
   - Deployment: SEPARATE Railway deployment
   - Endpoint: Via `GREEDY_SOLVER_URL` environment variable
   - **BELANGRIJK**: Gebruikt EIGEN interne engine, NIET files uit deze repo

## Wat Zat Hier

Deze directory bevatte:
- `greedy_solver_v2.py` - Oude GREEDY solver implementatie
- `solver_api.py` - FastAPI wrapper (importeerde greedy_solver_v2)
- `pairing_integration.py` - Pairing logica FASE 3
- `constraint_validator.py` - Constraint validatie
- Tests en documentatie

## Waarom Niet Meer Gebruikt

### Probleem Met Oude Setup
1. Dubbele codebases: `backend/greedy-service` EN Railway Greedy service
2. Import verwarring: Welke GREEDY engine wordt gebruikt?
3. Maintenance overhead: 2 plekken om GREEDY te updaten

### Nieuwe Setup (na DRAAD223 cleanup)

**Voor lokale ontwikkeling/testing:**
```python
api/greedy_solver_wrapper.py
└── imports: src/solver/greedy_engine.py
```

**Voor productie (Railway):**
```typescript
app/api/roster/solve-greedy/route.ts
└── calls: process.env.GREEDY_SOLVER_URL (Railway Greedy service)
```

**Railway Greedy Service:**
- Eigen deployment op Railway
- Eigen interne engine code
- Bereikbaar via GREEDY_SOLVER_URL
- **GEEN dependency op rooster-app-verloskunde repo**

## Actieve Files

Na DRAAD223 cleanup zijn dit de ENIGE actieve GREEDY files in repo:

### Productie Code
1. `src/solver/greedy_engine.py`
   - Core GREEDY engine
   - Gebruikt door wrapper

2. `api/greedy_solver_wrapper.py`
   - FastAPI wrapper voor lokale tests
   - Importeert `src/solver/greedy_engine.py`
   - **NIET gebruikt in productie** (alleen lokaal)

3. `app/api/roster/solve-greedy/route.ts`
   - Next.js API route
   - Roept Railway Greedy service aan via GREEDY_SOLVER_URL
   - **DIT is productie endpoint**

### Documentatie
- `RAILWAY_DEPLOY_217_GREEDY.txt` - Railway Greedy deployment docs
- `RAILWAY_DEPLOY_217_SOLVER2.txt` - Railway Solver2 deployment docs
- `.DRAAD223-CLEANUP-EXECUTION.md` - Deze cleanup

## Migratiepad

Als je code uit deze archive nodig hebt:

1. **Voor lokale GREEDY development:**
   - Gebruik `src/solver/greedy_engine.py`
   - Test via `api/greedy_solver_wrapper.py`

2. **Voor productie GREEDY updates:**
   - Update de Railway Greedy service direct
   - **NIET** via deze repo

3. **Voor algoritme wijzigingen:**
   - Update `src/solver/greedy_engine.py`
   - Sync naar Railway Greedy service indien nodig

## Rollback

Als je deze directory terug wilt:

```bash
# Restore from archive
cp -r archive/backend-greedy-service backend/greedy-service
git add backend/greedy-service
git commit -m "Restore backend/greedy-service from archive"
```

**Let op**: Dit lost NIET de import verwarring op - je krijgt weer dezelfde problemen.

## Related

- **DRAAD217**: Three-service Railway setup
- **DRAAD221**: Database schema fixes
- **DRAAD223**: Import cleanup
- **PR**: https://github.com/gslooters/rooster-app-verloskunde/pulls

---

**Status**: ⚠️ DEPRECATED sinds 2025-12-20  
**Replacement**: Railway Greedy service via GREEDY_SOLVER_URL  
**Archive**: `archive/backend-greedy-service/`
