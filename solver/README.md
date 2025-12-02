# Rooster Solver Microservice

**Google OR-Tools CP-SAT solver voor automatische roosterplanning verloskundigen**

## Overzicht

Deze Python FastAPI microservice genereert automatisch roosters voor verloskundigen gebruikmakend van Google OR-Tools CP-SAT constraint programming solver.

### Fase 1 - Proof of Concept

**Status:** In ontwikkeling  
**Versie:** 1.0.0-fase1  
**Target:** 10 medewerkers, 1 week, 6 basis constraints, <10s solve time

## Architectuur

```
Next.js App (rooster-app-verloskunde)
  ↓ POST /api/roster/solve
  ↓
Next.js API Route
  ↓ Fetch data from Supabase
  ↓ Transform to ORT input
  ↓ HTTP POST
  ↓
Python Solver Service (deze service)
  ↓ CP-SAT Solve
  ↓ JSON Response
  ↓
Next.js API Route
  ↓ Write to Supabase
  ↓
Rooster updated (status: draft → in_progress)
```

## Technologie Stack

- **Framework:** FastAPI 0.109
- **Solver:** Google OR-Tools 9.8
- **Python:** 3.11
- **Deployment:** Railway.app (Docker)
- **Protocol:** REST API (JSON)

## API Endpoints

### `GET /health`
Health check voor Railway monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-02T23:10:00Z",
  "service": "rooster-solver",
  "version": "1.0.0-fase1"
}
```

### `GET /version`
Version en capabilities informatie.

**Response:**
```json
{
  "version": "1.0.0-fase1",
  "or_tools_version": "9.8.0",
  "phase": "Fase 1 - Proof of Concept",
  "capabilities": [
    "6 basis constraints",
    "10 medewerkers",
    "1 week planning",
    "<10s solve time"
  ]
}
```

### `POST /api/v1/solve-schedule`
Hoofdendpoint: Los roosterplanning op.

**Request Body:** Zie `models.py` → `SolveRequest`  
**Response:** Zie `models.py` → `SolveResponse`

## Fase 1 Constraints

| # | Constraint | Priority | Type |
|---|------------|----------|------|
| 1 | Bevoegdheden respecteren | 1 | Hard |
| 2 | Beschikbaarheid (NBH) | 1 | Hard |
| 3 | Pre-planning niet overschrijven | 1 | Hard |
| 4 | Eén dienst per dagdeel | 1 | Hard |
| 5 | Max werkdagen per week | 2 | Soft |
| 6 | ZZP minimalisatie | 3 | Objective |

## Rapportage (Level 2 + 3)

### Level 2: Gedetailleerde Knelpunten
Voor elk probleem:
- Employee ID + naam
- Datum + dagdeel
- Service ID
- Constraint type
- Severity (critical/warning/info)

### Level 3: Prescriptive Suggesties
Concrete, actionable adviezen:
- "Verhoog max_werkdagen van medewerker X met 1"
- "Plan medewerker Y ook in voor dienst Z"
- "Overweeg ZZP-er inzetten op datum D"

## Development

### Lokaal Draaien

```bash
cd solver
pip install -r requirements.txt
python main.py
```

Service draait op: `http://localhost:8000`

### Docker Build

```bash
docker build -t rooster-solver .
docker run -p 8000:8000 rooster-solver
```

### Railway Deployment

1. Push naar GitHub main branch
2. Railway auto-deploy triggered
3. Check health: `https://[railway-url]/health`

## Testing

```bash
# Health check
curl https://[railway-url]/health

# Version check
curl https://[railway-url]/version

# Solve (example)
curl -X POST https://[railway-url]/api/v1/solve-schedule \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

## Logging

All logs naar stdout (voor Railway logging):
- INFO: Normale flow events
- WARNING: Constraint violations, timeouts
- ERROR: Exceptions, solver failures

## Configuratie

**Environment Variables:**
- `PORT`: Server port (default: 8000)
- `LOG_LEVEL`: Logging level (default: INFO)

## Volgende Stappen (Fase 2+)

- [ ] Meer constraints (totaal 15+)
- [ ] Multi-week support
- [ ] Nachtdienst regels
- [ ] Team totaal regels
- [ ] Performance optimalisatie (>50 medewerkers)
- [ ] Database integratie (direct Supabase)
- [ ] Caching layer
- [ ] WebSocket voor real-time progress

## Support

**Repository:** https://github.com/gslooters/rooster-app-verloskunde  
**Railway:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

---

**Ontwikkeld voor:** Rooster App Verloskunde  
**Draad:** 97A  
**Datum:** 2 december 2025
