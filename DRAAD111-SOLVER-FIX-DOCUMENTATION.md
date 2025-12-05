# DRAAD111 SOLVER - Dockerfile JSON CMD Fix Documentatie

**Datum:** 5 december 2025, 20:58 CET  
**Prioriteit:** KRITIEK  
**Status:** GEÏMPLEMENTEERD

---

## 🔥 PROBLEEM BESCHRIJVING

### Symptomen

**Solver Service Railway Logs:**
```
[inf] Container failed to start
[inf] The executable `hostname=0.0.0.0` could not be found.
```

### Context

- ✅ **Build succesvol:** Dockerfile bouwt correct, alle dependencies geïnstalleerd
- ✅ **Image gepusht:** Container image succesvol naar Railway registry
- ❌ **Container start faalt:** Kan uvicorn niet starten

### Error Analyse

Railway probeert `hostname=0.0.0.0` uit te voeren als een **executable/programma** in plaats van het te gebruiken als een argument voor `uvicorn`.

---

## 🔍 ROOT CAUSE ANALYSE

### Originele Dockerfile CMD

```dockerfile
# Shell form - PROBLEMATISCH
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### Waarom Dit Faalt

**Shell Form vs JSON Exec Form:**

| Aspect | Shell Form | JSON Exec Form |
|--------|-----------|----------------|
| **Syntax** | `CMD command arg1 arg2` | `CMD ["command", "arg1", "arg2"]` |
| **Shell** | Start `/bin/sh -c` | Direct execution |
| **Env vars** | Indirect expansion | Needs `sh -c` wrapper |
| **Signalen** | Incorrect doorgegeven | Correct doorgegeven |
| **Parsing** | Kan args verkeerd interpreteren | Expliciete args array |

### Het Specifieke Probleem

Bij **shell form**:
1. Docker/Railway start: `/bin/sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"`
2. Shell probeert command te parsen
3. Interpretatie gaat mis: `hostname=0.0.0.0` wordt gezien als apart commando
4. Probeert `hostname=0.0.0.0` uit te voeren als executable
5. 💥 **Error:** "executable not found"

### Railway's Waarschuwing

Railway build logs toonden al:
```
[wrn] JSONArgsRecommended: JSON arguments recommended for CMD 
      to prevent unintended behavior related to OS signals (line 42)
```

We hadden deze waarschuwing eerder moeten zien!

---

## ✅ OPLOSSING

### Geüpdatete Dockerfile CMD

```dockerfile
# JSON exec form met sh -c wrapper - CORRECT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### Waarom Dit Werkt

**Stap-voor-stap uitvoering:**

1. 🐚 **Docker/Railway start:** `["sh", "-c", "..."]`
2. 🐚 **Exec form:** Direct execution van `sh` met args `["-c", "uvicorn..."]`
3. 🐚 **sh -c:** Shell expansion van `${PORT:-8000}`
4. 🐚 **Result:** `uvicorn main:app --host 0.0.0.0 --port 8000`
5. ✅ **Uvicorn start:** Correct met alle argumenten

### Voordelen JSON Exec Form

✅ **Geen shell interpretatie issues**  
✅ **Environment variables werken via sh -c**  
✅ **OS signalen (SIGTERM/SIGINT) correct doorgegeven**  
✅ **Railway best practice**  
✅ **Betrouwbare container start**  

---

## 🛠️ IMPLEMENTATIE

### Uitgevoerde Stappen

1. **Dockerfile geüpdatet**
   ```bash
   Commit: ee1c5c3
   File: solver/docker/Dockerfile
   Change: CMD naar JSON exec form met sh -c
   ```

2. **Cache-busting geïmplementeerd**
   - `.cachebust-draad111-solver-json-cmd`
   - `.railway-trigger-draad111-solver-fix`
   - `.railway-cache-bust.json` updated
   
3. **Documentatie toegevoegd**
   - Dit bestand: `DRAAD111-SOLVER-FIX-DOCUMENTATION.md`

### Code Diff

```diff
  # Dockerfile voor Python FastAPI Solver Service
- # Voor LOKALE DEVELOPMENT - Railway gebruikt Nixpacks!
+ # Voor Railway Deployment met Dockerfile builder
  
  FROM python:3.11-slim
  
  # ... (rest unchanged)
  
- # Use uvicorn with PORT variable
- CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
+ # 🔥 CRITICAL: Use JSON exec form with sh -c for environment variable expansion
+ # This prevents "hostname=0.0.0.0 executable not found" errors
+ # Railway best practice: JSON args recommended for CMD
+ CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### Deployment Trigger

```
Timestamp: 1733431073000
Random: 982471
Datum: 2025-12-05T20:58 CET
```

Railway webhook automatisch getriggerd voor nieuwe deployment.

---

## 📊 VERIFICATIE

### Check Solver Service Deployment

1. **Railway Dashboard:**
   - Ga naar Solver service
   - Check deployment logs
   - Zoek naar: `Application startup complete`
   - Verwacht: **GEEN "hostname=0.0.0.0 could not be found" errors**

2. **Container Startup Log:**
   ```
   Expected:
   [inf] Starting container
   [inf] INFO:     Started server process [1]
   [inf] INFO:     Waiting for application startup.
   [inf] INFO:     Application startup complete.
   [inf] INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

3. **Health Check:**
   ```bash
   curl https://[solver-url]/health
   ```
   Verwacht:
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-12-05T...",
     "service": "rooster-solver",
     "version": "..."
   }
   ```

4. **Version Check:**
   ```bash
   curl https://[solver-url]/version
   ```

5. **Test Solve Endpoint:**
   ```bash
   curl -X POST https://[solver-url]/solve \
     -H "Content-Type: application/json" \
     -d '{...test data...}'
   ```

### Troubleshooting Nieuwe Issues

**Als container nog steeds niet start:**
- Check Railway logs voor nieuwe error messages
- Verify PORT environment variable is beschikbaar
- Check of uvicorn geïnstalleerd is (should be via requirements.txt)
- Test lokaal: `docker build -f solver/docker/Dockerfile -t solver .`

**Als uvicorn start maar crashes:**
- Check main.py syntax errors
- Check Python dependencies in requirements.txt
- Check import errors in application code

---

## 📝 BELANGRIJKE LESSEN

### Docker Best Practices

1. **✅ Gebruik JSON exec form voor CMD**
   ```dockerfile
   # GOED
   CMD ["sh", "-c", "command $VAR"]
   
   # VERMIJD (tenzij je expliciet shell wilt)
   CMD command $VAR
   ```

2. **✅ Let op build warnings**
   - Railway waarschuwde al: `JSONArgsRecommended`
   - Negeer warnings niet!

3. **✅ Environment variable expansion**
   - JSON exec form + `sh -c` = reliable expansion
   - Pure JSON zonder sh -c = geen expansion

### Railway Deployment

1. **Dockerfile vs Nixpacks**
   - Dockerfile: Expliciete controle, meer configuratie
   - Nixpacks: Automatische detectie, minder configuratie
   - **Voor Solver: Dockerfile werkt NU correct!**

2. **Start Command Override**
   - Check altijd Railway service settings
   - Empty = gebruik Dockerfile CMD
   - Override = moet correct syntax hebben

3. **Container vs Build Failures**
   - Build failure = dependencies/syntax errors
   - Container failure = runtime/startup errors
   - **Ons geval: Container failure door CMD syntax**

---

## 🚀 RESULTAAT

### Voor Fix (DRAAD111 - Fase 1)

❌ Railway.json conflict:  
- Beide services probeerden verkeerde configuratie  
- Rooster-app FAILED (requirements.txt niet gevonden)  
- Solver FAILED (uvicorn niet gevonden)

**Fix:** railway.json verwijderd → ✅ Rooster-app WERKT

### Voor Fix (DRAAD111 - Fase 2)

✅ Rooster-app: ONLINE & WERKEND  
❌ Solver: BUILD SUCCESS maar CONTAINER START FAILED  
- Error: "hostname=0.0.0.0 executable not found"

**Fix:** Dockerfile CMD naar JSON exec form → ✅ Solver VERWACHT WERKEND

### Na Complete Fix (DRAAD111)

✅ Rooster-app: ONLINE & WERKEND  
✅ Solver: BUILD + START SUCCESS (verwacht)  
✅ Beide services deployen onafhankelijk  
✅ Geen configuratie conflicts meer  
✅ Production-ready setup

---

## 🔗 GERELATEERDE DOCUMENTATIE

- [DRAAD111-FIX-DOCUMENTATION.md](DRAAD111-FIX-DOCUMENTATION.md) - Railway.json conflict fix (Fase 1)
- [solver/docker/Dockerfile](solver/docker/Dockerfile) - Geüpdatete Dockerfile
- [Docker CMD Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Railway Dockerfile Guide](https://docs.railway.com/guides/dockerfiles)

---

**Auteur:** AI Assistant (via MCP GitHub tools)  
**Datum:** 5 december 2025, 20:58 CET  
**Draad:** 111 - Solver Fix (Fase 2)  
**Status:** ✅ OPGELOST (verwacht)
