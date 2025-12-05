# Rooster Solver Service

Python FastAPI service voor het optimaliseren van verloskundige roosters met Google OR-Tools CP-SAT.

## ⚠️ BELANGRIJKE DEPLOYMENT INFORMATIE

### Railway Configuratie

**GEBRUIK ALLEEN DOCKERFILE - GEEN NIXPACKS!**

❌ **NIET doen:** nixpacks.toml toevoegen  
✅ **WEL doen:** Dockerfile gebruiken (zoals nu)

**Waarom?**
- Railway gebruikt nixpacks.toml voor START command (als aanwezig)
- Dockerfile CMD wordt dan GENEGEERD
- Result: "hostname=0.0.0.0 executable not found" errors
- We hadden 12 mislukte deployments door dit conflict!

**Zie:** [DRAAD111-FINAL-NIXPACKS-REMOVAL.md](../DRAAD111-FINAL-NIXPACKS-REMOVAL.md)

## Features (Fase 1 - PoC)

✅ **Basis constraint solving:**
- Min/max shifts per medewerker
- Gelijke verdeling van diensten
- Basic feasibility checks

✅ **REST API:**
- POST /solve - Optimize schedule
- GET /health - Health check
- GET /version - Service version

✅ **Production ready:**
- Docker containerization
- Health checks
- Error handling
- CORS configured

## Tech Stack

- **Python:** 3.11
- **Framework:** FastAPI
- **Solver:** Google OR-Tools CP-SAT
- **Deployment:** Railway (Dockerfile)

## API Endpoints

### POST /solve

Optimize a schedule based on constraints.

**Request:**
```json
{
  "employees": [
    {"id": "emp1", "name": "Anna"},
    {"id": "emp2", "name": "Bert"}
  ],
  "period": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31"
  },
  "constraints": {
    "min_shifts_per_employee": 10,
    "max_shifts_per_employee": 15,
    "required_coverage": {"2025-01-01": 2}
  },
  "timeout_seconds": 30
}
```

**Response:**
```json
{
  "status": "OPTIMAL",
  "assignments": [
    {"employee_id": "emp1", "date": "2025-01-01", "shift_type": "day"},
    {"employee_id": "emp2", "date": "2025-01-01", "shift_type": "night"}
  ],
  "statistics": {
    "total_shifts": 62,
    "solve_time_seconds": 2.4
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T21:21:30Z",
  "service": "rooster-solver",
  "version": "1.0.0-fase1"
}
```

### GET /version

Service version information.

## Local Development

### Requirements

- Python 3.11+
- pip

### Setup

```bash
cd solver/
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run

```bash
uvicorn main:app --reload --port 8000
```

API beschikbaar op: http://localhost:8000

### Test

```bash
curl http://localhost:8000/health
curl http://localhost:8000/version
```

## Docker

### Build

```bash
cd solver/
docker build -f docker/Dockerfile -t rooster-solver .
```

### Run

```bash
docker run -p 8000:8000 rooster-solver
```

## Railway Deployment

**Zie:** [DEPLOY.md](DEPLOY.md) voor gedetailleerde instructies.

**Quick setup:**

1. Railway project: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. New Service → GitHub Repo → `gslooters/rooster-app-verloskunde`
3. Root Directory: `solver`
4. Build Method: **Dockerfile** (⚠️ KRITIEK: geen nixpacks!)
5. Environment variables: `PORT=8000`
6. Deploy!

**Railway gebruikt automatisch:**
- `solver/docker/Dockerfile` voor build
- Dockerfile `CMD` voor container start
- Health check op `/health`

## Project Structure

```
solver/
├── docker/
│   └── Dockerfile          # Railway deployment config
├── main.py                 # FastAPI application
├── models.py               # Pydantic models
├── solver_engine.py        # OR-Tools constraint solver
├── requirements.txt        # Python dependencies
├── README.md               # This file
└── DEPLOY.md               # Deployment instructions
```

## Dependencies

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation
- `ortools` - Constraint solver
- `python-dotenv` - Environment variables

## Next Steps (Fase 2)

📅 **Geplande features:**

- [ ] Complex constraint types (consecutive shifts, preferences)
- [ ] Multi-week scheduling
- [ ] Employee preferences integration
- [ ] Shift swap optimization
- [ ] Historical data analysis
- [ ] Performance monitoring

## Support

**Issues?** Check:

1. [DEPLOY.md](DEPLOY.md) - Deployment guide
2. [DRAAD111-FINAL-NIXPACKS-REMOVAL.md](../DRAAD111-FINAL-NIXPACKS-REMOVAL.md) - Common issues
3. Railway logs in dashboard
4. Health endpoint: `curl https://[solver-url]/health`

---

**Status:** Production Ready (Fase 1)  
**Version:** 1.0.0-fase1  
**Last Updated:** 5 december 2025
