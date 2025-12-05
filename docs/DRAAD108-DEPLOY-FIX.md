# DRAAD108-DEPLOY: Railway.json Dockerfile Fix

**Datum**: 2025-12-05  
**Tijd**: 20:09-20:11 CET  
**Status**: ✅ GEÏMPLEMENTEERD  
**Priority**: CRITICAL - Deployment blocker  

---

## 🚨 PROBLEEM

### Symptoom
Railway deployment faalde met error:
```
[err] failed to read Dockerfile at 'Dockerfile'
```

### Root Cause Analysis

**railway.json forceerde verkeerde builder**:
```json
{
  "build": {
    "builder": "NIXPACKS"  // ❌ FOUT
  }
}
```

**Gevolg**:
- Railway zoekt Dockerfile in repository root (`/Dockerfile`)
- Dockerfile staat echter in `solver/docker/Dockerfile`
- Build faalt omdat bestand niet gevonden wordt

**Log bewijs**:
```
[dbg] skipping 'Dockerfile' at 'solver/docker/Dockerfile' 
      as it is not rooted at a valid path (root_dir=, fileOpts={acceptChildOfRepoRoot:false})
[err] failed to read Dockerfile at 'Dockerfile'
```

### Waarom Railway.json Settings Overruled

Railway Dashboard settings werden **GENEGEERD** omdat:
1. `railway.json` in repository root bestaat
2. Railway geeft **voorrang aan railway.json** boven UI settings
3. `railway.json` specificeerde `"builder": "NIXPACKS"`
4. Nixpacks verwacht Dockerfile in root, niet in subdirectory

---

## ✅ OPLOSSING

### Stap 1: railway.json Aangepast

**VOOR** (fout):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"  // ❌
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "trigger": 1733180662
}
```

**NA** (correct):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",  // ✅ Geforceerd naar Dockerfile
    "dockerfilePath": "solver/docker/Dockerfile"  // ✅ Correct pad
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "trigger": 1733426986  // ✅ Nieuwe timestamp
}
```

### Stap 2: Cache-Busting

**Twee cache-bust bestanden geüpdatet**:

1. **`.railway-deploy-trigger`**:
   - Nieuwe timestamp: `2025-12-05T20:10:15+01:00`
   - Trigger ID: `87392`
   - Reden gedocumenteerd

2. **`cachebust.txt`**:
   - Nieuwe timestamp: `1733427022`
   - Build trigger: `DRAAD108-DEPLOY`

### Stap 3: Railway Settings (al correct)

**In Railway Dashboard**:
- Root Directory: `/solver` ✅
- Dockerfile Path: `/solver/docker/Dockerfile` ✅ (nu gerespecteerd)

---

## 📋 COMMITS

| SHA | Commit Message | Timestamp |
|-----|----------------|----------|
| `39098188` | **railway.json fix** - NIXPACKS → DOCKERFILE | 19:09:34Z |
| `37041cdb` | Force Railway rebuild trigger | 19:10:11Z |
| `39e308e6` | Cache-bust na railway.json fix | 19:11:30Z |

**GitHub Links**:
- [Commit 39098188](https://github.com/gslooters/rooster-app-verloskunde/commit/39098188fa3c71e09c51a9bfcb83a906f7b1ca88)
- [Commit 37041cdb](https://github.com/gslooters/rooster-app-verloskunde/commit/37041cdb1d7c67069438fa8f43c81a60700df036)
- [Commit 39e308e6](https://github.com/gslooters/rooster-app-verloskunde/commit/39e308e69f53e04ae61b0023023339575415793b)

---

## 🔍 VERIFICATIE

### Verwachte Railway Build Flow

```
1. Railway detecteert nieuwe commits op main branch ✅
2. Leest railway.json:
   - builder: "DOCKERFILE" ✅
   - dockerfilePath: "solver/docker/Dockerfile" ✅
3. Vindt Dockerfile op correct pad ✅
4. Root Directory: solver/ (voor build context) ✅
5. Dockerfile uitvoeren:
   - Stage 1: Python 3.11-slim base
   - Copy solver/ bestanden
   - pip install -r requirements.txt
   - Copy main.py, models.py, solver_engine.py
   - Start FastAPI met uvicorn
6. Container start op poort 8000 ✅
7. Health check: GET /health → 200 OK ✅
```

### Test Endpoints

**Na succesvolle deployment**:

```bash
# Health check
curl https://solver-production-3a53.up.railway.app/health

# Verwacht:
{
  "status": "healthy",
  "timestamp": "2025-12-05T19:15:00.000Z",
  "ortools_available": true
}

# Version check
curl https://solver-production-3a53.up.railway.app/version

# Verwacht:
{
  "version": "1.1.0-DRAAD108",
  "or_tools_version": "9.11.4210",
  "phase": "DRAAD108-implementation",
  "capabilities": [
    "constraint_7_exact_staffing",
    "constraint_8_system_service_exclusivity"
  ]
}
```

### Verificatie Checklist

- [ ] Railway build start zonder "failed to read Dockerfile" error
- [ ] Dockerfile gevonden op `solver/docker/Dockerfile`
- [ ] Python dependencies installeren succesvol
- [ ] OR-Tools 9.11+ geïnstalleerd
- [ ] Container start op poort 8000
- [ ] `/health` endpoint reageert met 200 OK
- [ ] `/version` toont `1.1.0-DRAAD108`
- [ ] Solver service status: RUNNING (groen in Railway)

---

## 💡 LESSONS LEARNED

### Prioriteit van Configuratie

**Railway configuration hierarchy**:
1. **`railway.json` in repository** (hoogste prioriteit) ✅
2. `railway.toml` in repository
3. Railway Dashboard UI settings (laagste prioriteit)

**Implicatie**: Als `railway.json` bestaat, worden UI settings overschreven!

### Best Practice

**Voor Dockerfile-based deployments**:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "path/to/Dockerfile"  // Vanaf repo root
  }
}
```

**Voor Nixpacks deployments**:
```json
{
  "build": {
    "builder": "NIXPACKS"
  }
}
```

### Debug Tips

**Bij Dockerfile errors**:
1. Check eerst of `railway.json` bestaat
2. Verifieer `builder` setting in railway.json
3. Zorg dat `dockerfilePath` absoluut is (vanaf repo root)
4. Test Dockerfile lokaal: `docker build -f path/to/Dockerfile .`

---

## 📚 REFERENCES

- [Railway Configuration Docs](https://docs.railway.app/deploy/config-as-code)
- [Dockerfile Builder Docs](https://docs.railway.app/deploy/builds#dockerfile)
- [DRAAD002 Technical Infrastructure](../DRAAD002-technische-infrastructuur.md)
- [Solver Dockerfile](../solver/docker/Dockerfile)

---

## 🎯 NEXT STEPS

1. **Monitor Railway deployment** (3-5 minuten)
2. **Verify endpoints** (`/health`, `/version`)
3. **Test solver API** (`POST /api/v1/solve-schedule`)
4. **Update monitoring**: Verwacht versie 1.1.0-DRAAD108

---

**Status Update Verwacht**: 2025-12-05 20:15 CET  
**Success Criteria**: Solver draait met DRAAD108 code en alle 8 constraints actief  
