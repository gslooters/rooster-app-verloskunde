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
- **Build Method:** Dockerfile
- **Dockerfile Path:** `Dockerfile`
- **Start Command:** `python main.py`

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
- **Max Retries:** 3

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
  "timestamp": "2025-12-02T23:10:00Z",
  "service": "rooster-solver",
  "version": "1.0.0-fase1"
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

### Service Crash

**Probleem:** Service crasht bij startup

**Debug:**
1. Check Railway logs
2. Zoek naar traceback
3. Controleer dependencies in requirements.txt
4. Test lokaal met Docker:
   ```bash
   docker build -t solver .
   docker run -p 8000:8000 solver
   ```

### Timeout Issues

**Probleem:** Solver timeout na 30s

**Oplossing:** Verhoog timeout in solver request:
```typescript
timeout_seconds: 60
```

En update Railway health check timeout.

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

**Status:** Ready for deployment  
**Fase:** 1 - PoC  
**Datum:** 2 december 2025
