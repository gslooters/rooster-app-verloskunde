# Rooster Solver Service

Python FastAPI service voor het optimaliseren van verloskundige roosters met Google OR-Tools CP-SAT.

## ⚠️ BELANGRIJKE DEPLOYMENT INFORMATIE (DRAAD111)

### Railway Configuratie - Dockerfile Locatie

**KRITIEK: Dockerfile MOET in solver/ root staan!**

✅ **CORRECT:** `solver/Dockerfile`  
❌ **FOUT:** `solver/docker/Dockerfile` (te diep genest)

**Waarom?**
- Railway met `root_dir=solver` zoekt naar `Dockerfile` relatief aan die root
- Als Dockerfile in submap staat: "skipping Dockerfile... not rooted at valid path"
- Railway valt terug op verkeerde configuratie
- Result: "hostname=0.0.0.0 executable not found" errors

**DRAAD111 Fix:**
- Dockerfile verplaatst naar `solver/Dockerfile`
- `railway.json` aangemaakt in `solver/` directory
- Dit voorkomt conflict met root `railway.toml` (Next.js config)

**Zie:** [DEPLOY.md](DEPLOY.md) voor gedetailleerde instructies en lessons learned.

## Features (DRAAD108 - Exacte Bezetting)

✅ **8 Constraint Types:**
1. Bevoegdheden (roster_employee_services)
2. Beschikbaarheid (structureel NBH)
3A. Fixed assignments (status 1)
3B. Blocked slots (status 2, 3)
4. Een dienst per dagdeel
5. Max werkdagen per week
6. ZZP minimalisatie
7. **Exacte bezetting realiseren** (DRAAD108)
8. **Systeemdienst exclusiviteit** (DIO XOR DDO, DIA XOR DDA)

✅ **REST API:**
- POST /api/v1/solve-schedule - Optimize schedule
- GET /health - Health check
- GET /version - Service version & capabilities

✅ **Production ready:**
- Docker containerization
- Health checks
- Error handling
- CORS configured
- Railway deployment

## Tech Stack

- **Python:** 3.11
- **Framework:** FastAPI 0.115.0
- **Solver:** Google OR-Tools 9.11
- **Deployment:** Railway (Dockerfile)

## API Endpoints

### POST /api/v1/solve-schedule

Optimize a schedule based on constraints.

**Request:**
```json
{
  "roster_id": "roster-2025-01",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "employees": [
    {
      "id": 1,
      "name": "Anna de Vries",
      "employment_type": "loondienst",
      "max_workdays_per_week": 5
    }
  ],
  "services": [
    {
      "id": 101,
      "code": "DIO",
      "name": "Dienst Ochtendspreekuur",
      "part_of_day": "ochtend"
    }
  ],
  "roster_employee_services": [
    {
      "employee_id": 1,
      "service_id": 101,
      "aantal": 10,
      "actief": true
    }
  ],
  "exact_staffing": [
    {
      "service_id": 101,
      "date": "2025-01-15",
      "part_of_day": "ochtend",
      "team": "TOT",
      "aantal": 2,
      "is_system_service": true
    }
  ],
  "fixed_assignments": [],
  "blocked_slots": [],
  "timeout_seconds": 30
}
```

**Response:**
```json
{
  "status": "OPTIMAL",
  "assignments": [
    {
      "employee_id": 1,
      "employee_name": "Anna de Vries",
      "service_id": 101,
      "service_code": "DIO",
      "date": "2025-01-15",
      "part_of_day": "ochtend"
    }
  ],
  "statistics": {
    "total_assignments": 248,
    "total_slots": 372,
    "fill_percentage": 66.7,
    "solve_time_seconds": 4.2
  },
  "violations": []
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T21:00:00Z",
  "service": "rooster-solver",
  "version": "1.1.0-DRAAD108"
}
```

### GET /version

Service version and capabilities.

**Response:**
```json
{
  "version": "1.1.0-DRAAD108",
  "or_tools_version": "9.11.4210",
  "phase": "DRAAD108-implementation",
  "capabilities": [
    "constraint_1_bevoegdheden",
    "constraint_2_beschikbaarheid",
    "constraint_3a_fixed_assignments",
    "constraint_3b_blocked_slots",
    "constraint_4_een_dienst_per_dagdeel",
    "constraint_5_max_werkdagen",
    "constraint_6_zzp_minimalisatie",
    "constraint_7_exact_staffing",
    "constraint_8_system_service_exclusivity"
  ]
}
```

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
docker build -t rooster-solver .
```

**Let op:** Dockerfile staat nu in `solver/Dockerfile` (niet in docker/ submap).

### Run

```bash
docker run -p 8000:8000 rooster-solver
```

## Railway Deployment

**Zie:** [DEPLOY.md](DEPLOY.md) voor gedetailleerde instructies en DRAAD111 lessons learned.

**Quick setup:**

1. Railway project: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. New Service → GitHub Repo → `gslooters/rooster-app-verloskunde`
3. Root Directory: `solver`
4. Build Method: **Dockerfile** (auto-detect)
5. Dockerfile Path: `Dockerfile` (⚠️ MOET in solver/ root staan!)
6. Start Command: **(LEEG LATEN - CMD uit Dockerfile wordt gebruikt)**
7. Environment variables: `PORT=8000`
8. Deploy!

**Railway configuratie:**
- `solver/railway.json` - Service-specific config
- `solver/Dockerfile` - Build instructions + start command
- Health check: `/health` endpoint

## Project Structure

```
solver/
├── Dockerfile              # 🔥 Railway deployment (MOET hier staan!)
├── railway.json           # Railway service configuratie
├── main.py                # FastAPI application
├── models.py              # Pydantic models
├── solver_engine.py       # OR-Tools constraint solver
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── DEPLOY.md              # Deployment instructions
└── docker/                # (leeg na DRAAD111 cleanup)
```

## Dependencies

- `fastapi==0.115.0` - Web framework
- `uvicorn[standard]==0.32.0` - ASGI server
- `pydantic==2.9.2` - Data validation
- `ortools==9.11.4210` - Constraint solver
- `python-dateutil==2.9.0` - Date utilities

## Development Roadmap

### ✅ Fase 1 - PoC (Completed)
- Basic constraint solving
- REST API
- Docker deployment
- Railway integration

### ✅ DRAAD105 - Bevoegdheden (Completed)
- `roster_employee_services` met `aantal` en `actief` velden
- Constraint 1: Employee service capabilities

### ✅ DRAAD106 - Status Semantiek (Completed)
- Fixed assignments (status 1)
- Blocked slots (status 2, 3)
- Constraints 3A + 3B

### ✅ DRAAD108 - Exacte Bezetting (Completed)
- Constraint 7: Exact staffing requirements
- Constraint 8: System service exclusivity (DIO XOR DDO, DIA XOR DDA)
- Team filtering (TOT/GRO/ORA)

### ✅ DRAAD111 - Deployment Fix (Completed)
- Dockerfile locatie probleem opgelost
- Railway.json configuratie toegevoegd
- DEPLOY.md updated met lessons learned

### 📅 Fase 2 - Geplande Features
- [ ] Multi-week scheduling
- [ ] Employee preferences integration
- [ ] Shift swap optimization
- [ ] Historical data analysis
- [ ] Performance monitoring
- [ ] Advanced constraint types

## Support

**Issues?** Check:

1. [DEPLOY.md](DEPLOY.md) - Deployment guide + DRAAD111 troubleshooting
2. Railway logs in dashboard
3. Health endpoint: `curl https://[solver-url]/health`
4. Version endpoint: `curl https://[solver-url]/version`

**Common issues:**
- "executable not found" → Zie DEPLOY.md DRAAD111 sectie
- "Dockerfile not found" → Verify `solver/Dockerfile` exists
- Build fails → Check Railway logs voor Python errors

---

**Status:** Production Ready (DRAAD108)  
**Version:** 1.1.0-DRAAD108  
**Last Updated:** 5 december 2025  
**Fix:** DRAAD111 - Dockerfile locatie probleem opgelost