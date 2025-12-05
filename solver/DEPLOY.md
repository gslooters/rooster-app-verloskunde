# Deployment Instructies - Rooster Solver Service

## Railway.app Deployment

### Stap 1: Nieuwe Service Aanmaken

1. Ga naar Railway project: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Klik op "New Service"
3. Selecteer "GitHub Repo" → `gslooters/rooster-app-verloskunde`
4. Service naam: `rooster-solver`

### Stap 2: Build Configuratie

**Belangrijke instellingen:**

- **Root Directory:** `solver`
- **Build Method:** Dockerfile (auto-detect)
- **Dockerfile Path:** `Dockerfile` (🔥 MOET in solver/ root staan, niet in submap!)
- **Start Command:** (LEEG LATEN - CMD uit Dockerfile wordt gebruikt)

**⚠️ KRITIEK (DRAAD111 fixes):**
- Dockerfile MOET `solver/Dockerfile` zijn (niet `solver/docker/Dockerfile`)
- Railway met `root_dir=solver` zoekt naar `Dockerfile` relatief aan die root
- `railway.json` in `solver/` directory voorkomt conflict met root `railway.toml`
- **NOOIT `.railwayignore` gebruiken die Dockerfile blokkeert!**

### Stap 3: Environment Variables

Zet de volgende environment variables in Railway:

```bash
PORT=8000
LOG_LEVEL=INFO
```

### Stap 4: Health Check

- **Health Check Path:** `/health`
- **Health Check Timeout:** 100 seconds
- **Restart Policy:** ON_FAILURE
- **Max Retries:** 10

### Stap 5: Deploy

1. Push code naar GitHub main branch
2. Railway auto-deploy wordt getriggerd
3. Bekijk logs in Railway dashboard
4. Wacht op "Deployment successful"

### Stap 6: Verificatie

**Health check:**
```bash
curl https://[railway-url]/health
```

Verwachte response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T20:55:00Z",
  "service": "rooster-solver",
  "version": "1.1.0-DRAAD108"
}
```

**Version check:**
```bash
curl https://[railway-url]/version
```

### Stap 7: Next.js Integratie

Update environment variable in Next.js service:

```bash
SOLVER_SERVICE_URL=https://[railway-solver-url]
```

**Let op:** Gebruik de interne Railway URL voor snellere communicatie:
```bash
SOLVER_SERVICE_URL=http://rooster-solver.railway.internal:8000
```

---

## Troubleshooting

### Build Fails

**Probleem:** "Could not find a version that satisfies the requirement ortools"

**Oplossing:** Check Python versie (moet 3.11 zijn):
```dockerfile
FROM python:3.11-slim
```

### Service Crash bij Startup

**Probleem:** Container start niet

**Debug:**
1. Check Railway logs voor Python tracebacks
2. Verifieer dat Dockerfile op correcte locatie staat: `solver/Dockerfile`
3. Check dat `railway.json` in `solver/` directory staat
4. **VERIFIEER dat `.railwayignore` Dockerfile NIET blokkeert!**
5. Test lokaal met Docker:
   ```bash
   cd solver/
   docker build -t solver .
   docker run -p 8000:8000 solver
   ```

### "Dockerfile does not exist" Error

**Probleem:** Railway kan Dockerfile niet vinden (DRAAD111 root cause)

**Mogelijke oorzaken:**
1. Dockerfile staat in verkeerde directory (moet `solver/Dockerfile` zijn)
2. **`.railwayignore` bevat "Dockerfile" ignore regel**
3. `railway.json` heeft verkeerd `dockerfilePath`

**Oplossing:**
1. Verifieer `solver/Dockerfile` bestaat:
   ```bash
   ls -la solver/Dockerfile
   ```
2. **Check `.railwayignore` - mag GEEN "Dockerfile" bevatten!**
3. Check `solver/railway.json`:
   ```json
   {
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "Dockerfile"
     }
   }
   ```
4. Railway Settings → Start Command moet LEEG zijn

### "executable hostname=0.0.0.0 not found" Error

**Probleem:** Railway probeert verkeerd startcommando uit te voeren

**Oplossing (DRAAD111 fix):**
- Verifieer dat `solver/railway.json` bestaat
- Check dat `dockerfilePath` in railway.json correct is: `"Dockerfile"`
- Zorg dat Railway Settings → Start Command LEEG is
- Dockerfile CMD wordt dan automatisch gebruikt

### Dockerfile wordt niet gevonden

**Probleem:** Railway zegt "skipping Dockerfile... not rooted at valid path"

**Oplossing:**
- Dockerfile MOET in `solver/Dockerfile` staan (niet in submap)
- Railway root directory is ingesteld op `solver`
- Dockerfile path in `railway.json` moet `"Dockerfile"` zijn (relatief)

### Timeout Issues

**Probleem:** Solver timeout na 30s

**Oplossing:** Verhoog timeout in solver request:
```typescript
timeout_seconds: 60
```

En update Railway health check timeout naar 100s.

### CORS Errors

**Probleem:** CORS errors vanuit Next.js

**Oplossing:** Check CORS configuratie in `main.py`:
```python
allow_origins=["https://your-nextjs-app.railway.app"]
```

---

## Performance Tuning

### Railway Resources

**Huidige config:**
- Memory: 512MB (starter)
- CPU: Shared

**Voor productie (>10 medewerkers):**
- Memory: 1GB+
- CPU: Dedicated

### OR-Tools Tuning

In `solver_engine.py`:

```python
solver.parameters.max_time_in_seconds = 30
solver.parameters.num_search_workers = 4  # Parallel search
solver.parameters.log_search_progress = False  # Disable verbose logging
```

---

## Monitoring

### Railway Metrics

- CPU usage
- Memory usage
- Request rate
- Response time

### Custom Logging

All logs naar Railway stdout:
```python
logger.info(f"Solve completed: {status}")
```

Bekijk in Railway dashboard → Deployments → Logs

---

## Rollback

Als deployment faalt:

1. Railway dashboard → Deployments
2. Selecteer vorige werkende deployment
3. Klik "Redeploy"

Of via GitHub:
```bash
git revert HEAD
git push origin main
```

---

## DRAAD111 - Lessons Learned

### Root Cause 1: Dockerfile Locatie

**Probleem:**
- Dockerfile stond in `solver/docker/Dockerfile` (te diep genest)
- Railway met `root_dir=solver` zoekt naar `solver/Dockerfile`
- Railway logs: "skipping Dockerfile... not rooted at valid path"

**Oplossing:**
- Dockerfile verplaatst naar `solver/Dockerfile`
- `railway.json` aangemaakt in `solver/` met correcte config
- Dit voorkomt conflict met root `railway.toml` (Next.js config)

### Root Cause 2: .railwayignore Blokkade (🔥 KRITIEK)

**Probleem:**
- `solver/.railwayignore` bevatte regel: `Dockerfile`
- Dit blokkeerde Railway om Dockerfile te detecteren
- Railway error: "Dockerfile does not exist" (letterlijk waar!)
- Ignore files hebben VOORRANG boven railway.json configuratie

**Oplossing:**
- `.railwayignore` VOLLEDIG VERWIJDERD
- Dockerfile nu zichtbaar voor Railway
- Railway kan nu Dockerfile detecteren en gebruiken

**⚠️ WARNING:**
Gebruik NOOIT `.railwayignore` met "Dockerfile" ignore regel als je Dockerfile deployment wilt!
Ignore files hebben absolute voorrang - Railway controleert ze VOOR alles.

### Configuratie Scheiding

**Monorepo Setup:**
```
rooster-app-verloskunde/
├── railway.toml          ← Next.js app configuratie
└── solver/
    ├── railway.json      ← Solver service configuratie
    ├── Dockerfile        ← MOET HIER staan!
    ├── main.py
    └── requirements.txt
```

**Belangrijk:**
- Elke service heeft eigen configuratie
- Root `railway.toml` geldt NIET voor Solver service
- Solver leest `solver/railway.json` voor eigen config
- **GEEN `.railwayignore` die essentiële files blokkeert!**

### Key Takeaways

1. **Railway Root Directory is relatief**
   - `root_dir=solver` → zoekt `Dockerfile` in die directory
   - NIET in submappen zoals `docker/`

2. **Ignore Files Hebben Voorrang**
   - `.railwayignore` wordt EERST gecontroleerd
   - Ignored files zijn ONZICHTBAAR voor Railway
   - Zelfs als `railway.json` ze specificeert!

3. **Configuratie Prioriteit**
   - `.railwayignore` > `railway.json` > `railway.toml`
   - Service-specific `railway.json` > root `railway.toml`
   - Start Command in Settings > Dockerfile CMD
   - Laat Start Command LEEG om Dockerfile CMD te gebruiken

4. **Debug Log Signalen**
   - "skipping Dockerfile" → verkeerde locatie OF ignored
   - "not rooted at valid path" → file te diep genest
   - "Dockerfile does not exist" → check .railwayignore EERST!
   - "executable not found" → vaak verkeerde startcommand config

### Preventie Checklist

Voor nieuwe Railway deployments:

- [ ] Dockerfile in correcte locatie (service root directory)
- [ ] railway.json in service directory (als monorepo)
- [ ] **Check .railwayignore - mag GEEN essentiële files blokkeren**
- [ ] Start Command in Railway Settings is LEEG (gebruik Dockerfile CMD)
- [ ] Test lokaal met Docker build eerst
- [ ] Check Railway logs voor "skipping" of "ignored" berichten

---

**Status:** Production Ready  
**Fase:** DRAAD108 - Exacte bezetting  
**Datum:** 5 december 2025  
**Fixes:**  
- DRAAD111-1: Dockerfile locatie probleem opgelost  
- DRAAD111-2: .railwayignore blokkade verwijderd (🔥 KRITIEK)