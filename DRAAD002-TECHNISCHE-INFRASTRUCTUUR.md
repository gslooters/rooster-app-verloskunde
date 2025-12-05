# DRAAD 002: Technische Infrastructuur Documentatie

## Versie & Datum
- **Versie**: 2.5 (DRAAD105)
- **Datum**: 5 december 2025
- **Laatste update**: Commit 3391a89 - Railway deploy trigger

---

## 📋 OVERZICHT VAN DE TOTALE APPLICATIE

De Rooster App Verloskunde bestaat uit **TWEE MODULES** die samen een volledige roosterplanningoplossing vormen:

### Module 1: rooster-app-verloskunde (Frontend + Backend)
- **Locatie**: Root van repository
- **Functie**: Volledige Next.js webapplicatie voor gebruikersinteractie
- **Verantwoordelijk voor**: UI, UX, planning interface, database interactie

### Module 2: Solver (Python Optimalisatie Service)  
- **Locatie**: `/solver` subdirectory in dezelfde repository
- **Functie**: Google OR-Tools CP-SAT solver voor roosteroptimalisatie
- **Verantwoordelijk voor**: Complexe constraint-based scheduling

**BELANGRIJK**: Tot voor kort stond alles in één module. De solver is recent afgesplitst maar zit nog in dezelfde GitHub repository. Voor code aanpassingen is het cruciaal om te weten welke module je moet aanpassen!

---

## 🏗️ MODULE 1: ROOSTER-APP-VERLOSKUNDE

### Technologie Stack

#### Frontend Framework
- **Next.js 14.2.33** (App Router)
  - Server-side rendering (SSR)
  - Static site generation (SSG)
  - API routes
  - File-based routing
- **React 18.3.1**
- **TypeScript 5.x** (Strict mode enabled)

#### Styling & UI
- **Tailwind CSS 3.4.1**
  - Utility-first CSS framework
  - Responsive design
  - Custom design system
- **Lucide React 0.548.0** (Icons)
- **React Hot Toast 2.4.1** (Notifications)

#### State Management & Data
- **Zustand 5.0.8** (Lightweight state management)
- **date-fns 4.1.0** + date-fns-tz 3.2.0 (Date/tijd manipulatie met timezone support)
- **Supabase Client 2.78.0**
  - @supabase/supabase-js
  - @supabase/auth-helpers-nextjs 0.10.0

#### PDF & Export
- **jsPDF 2.5.1** (PDF generation)
- **jsPDF-AutoTable 3.8.2** (Tables in PDF)
- **html2canvas 1.4.1** (Screenshot capture)
- **xlsx 0.18.5** (Excel export)

### Project Structuur

```
rooster-app-verloskunde/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── _components/              # Gedeelde componenten
│   │   │   └── TeamSelector.tsx      # Team scope selectie
│   │   ├── api/                      # API routes
│   │   │   └── health/              # Health check endpoints
│   │   ├── planning/                 # Planning modules
│   │   │   ├── period-staffing/     # Diensten per dagdeel ⭐ ACTIEF
│   │   │   └── design/
│   │   │       └── dashboard/        # Dashboard rooster ontwerp
│   │   ├── diensten-per-dag/        # REDIRECT → planning/period-staffing
│   │   ├── services/
│   │   │   └── schedule-rules/       # Hoofdinterface planregels
│   │   ├── employees/               # Medewerkerbeheer
│   │   ├── current-roster/          # Huidig actief rooster
│   │   └── reports/                 # Rapportages
│   └── lib/                         # Shared libraries
│       ├── types/                   # TypeScript definities
│       │   ├── daytype-staffing.ts  # Bezetting types (met team scope)
│       │   └── week-dagdelen.ts     # Week dagdelen types
│       ├── services/                # Data access layer
│       │   └── daytype-staffing-storage.ts  # Storage logica
│       └── export/                  # Export functionaliteit
│           └── daytype-staffing-export.ts   # CSV/PDF exports
│
├── supabase/
│   └── migrations/                  # Database migraties
│       ├── create_roster_period_staffing.sql
│       ├── 20251127_create_roster_employee_services.sql
│       ├── 20241203_add_system_flag.sql
│       ├── 20241203_trigger_roster_auto_blocking.sql
│       └── 20241205_remove_5_constraint_types.sql
│
├── public/                          # Statische assets
├── .next/                           # Next.js build output (standalone)
├── node_modules/                    # Dependencies
│
├── package.json                     # NPM dependencies & scripts
├── tsconfig.json                    # TypeScript configuratie
├── next.config.js                   # Next.js configuratie ⭐ BELANGRIJK
├── tailwind.config.ts               # Tailwind CSS config
├── .env.example                     # Environment variables template
├── .eslintrc.json                   # Linting regels
│
└── solver/                          # ⭐ MODULE 2 (zie hieronder)
```

### Configuratie Bestanden (KRITISCH)

#### 1. next.config.js
```javascript
const nextConfig = {
  // 🔥 Force unique build met millisecond precision
  generateBuildId: async () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `build-${timestamp}-${random}`;
  },
  
  // 🔥 Disable ALL Next.js caching
  env: {
    NEXT_DISABLE_SWC_CACHE: '1',
    NEXT_PRIVATE_DISABLE_CACHE: 'true',
    FORCE_REBUILD_TIMESTAMP: Date.now().toString(),
  },
  
  // Performance
  swcMinify: true,
  compress: true,
  
  // 🔥 Output voor Railway deployment
  output: 'standalone',
  
  // Webpack cache disabled in production
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};
```

**Waarom deze config?**
- **Unieke build IDs**: Voorkomt caching problemen
- **Standalone output**: Railway vereist dit voor correcte deployment
- **Cache disabled**: Consistent gedrag tussen builds

#### 2. tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["*"]
    },
    "incremental": false,  // 🔥 Cache disabled
    // ... rest van config
  }
}
```

**Pad aliasing**: `@/` verwijst naar project root, bijvoorbeeld:
- `@/lib/types` → `./lib/types`
- `@/app/components` → `./app/components`

#### 3. package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build --no-lint && node scripts/postbuild.js",
    "start": "HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node .next/standalone/server.js",
    "lint": "next lint"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Build proces**:
1. `next build --no-lint` - Bouwt applicatie zonder linting
2. `node scripts/postbuild.js` - Post-build script (cachebust enz.)
3. Standalone output in `.next/standalone/`

**Start command**:
- Railway gebruikt: `HOSTNAME=0.0.0.0 PORT=${PORT:-3000} node .next/standalone/server.js`
- Bindt aan alle interfaces (0.0.0.0)
- Gebruikt Railway's dynamische PORT variabele

### Environment Variables

```bash
# Supabase Configuration (VERPLICHT)
NEXT_PUBLIC_SUPABASE_URL=https://rzecogncpkjfytebfkni.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Solver Service (TOEKOMSTIG)
SOLVER_SERVICE_URL=https://solver-xyz.railway.app
# Lokaal: SOLVER_SERVICE_URL=http://localhost:8000
# Railway internal: http://rooster-solver.railway.internal:8000

# Application
NEXT_PUBLIC_APP_URL=https://rooster-app-verloskunde-production.up.railway.app
NODE_ENV=production
```

### Data Flow (Huidige Status)

```
Browser (Client)
    ↓
Next.js App (Railway)
    ↓
Supabase PostgreSQL
    ↓
Data Storage & Retrieval
```

**Toekomstige Flow (met Solver):**
```
Browser (Client)
    ↓
Next.js App (Railway)
    ├→ Supabase PostgreSQL (data CRUD)
    └→ Python Solver Service (optimalisatie)
          ↓
       OR-Tools CP-SAT
          ↓
       Optimaal Rooster
```

---

## 🏗️ MODULE 2: SOLVER (Python OR-Tools Service)

### Locatie & Context
- **Directory**: `/solver` (subdirectory in main repository)
- **Status**: RECENT AFGESPLITST - was eerder geïntegreerd in main app
- **Deployment**: Aparte Railway service (toekomstig)
- **Communicatie**: Via REST API (FastAPI)

### Technologie Stack

#### Core Framework
- **FastAPI 0.115.0** (Modern async web framework)
- **Uvicorn 0.32.0** (ASGI server met standard extras)
- **Pydantic 2.9.2** (Data validation)

#### Optimalisatie Engine
- **Google OR-Tools 9.11.4210**
  - CP-SAT Solver
  - Constraint Programming
  - Integer Linear Programming

#### Utilities
- **python-dateutil 2.9.0** (Date/tijd manipulatie)

### Project Structuur

```
solver/
├── main.py                    # 🔥 FastAPI applicatie & API endpoints
├── models.py                  # Pydantic data models (request/response)
├── solver_engine.py           # 🔥 OR-Tools CP-SAT solver logica
├── requirements.txt           # Python dependencies
├── nixpacks.toml              # Railway build configuratie
├── .dockerignore              # Docker build exclusions
├── .railwayignore             # Railway deployment exclusions
├── README.md                  # Solver documentatie
├── DEPLOY.md                  # Deployment instructies
└── docker/                    # Docker configuratie (optioneel)
```

### Belangrijkste Bestanden

#### 1. main.py (FastAPI App)
```python
from fastapi import FastAPI, HTTPException
from models import SolveRequest, SolveResponse
from solver_engine import RosterSolver

app = FastAPI(
    title="Rooster Solver API",
    version="1.0.0",
    description="OR-Tools CP-SAT solver voor roosteroptimalisatie"
)

@app.get("/")
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "solver"}

@app.post("/api/v1/solve-schedule")
async def solve_schedule(request: SolveRequest) -> SolveResponse:
    solver = RosterSolver(request)
    result = solver.solve()
    return result
```

**Key endpoints**:
- `GET /` - Health check
- `GET /health` - Health check (alias)
- `POST /api/v1/solve-schedule` - Hoofdfunctie: rooster optimalisatie

#### 2. solver_engine.py (OR-Tools Logica)
Bevat `RosterSolver` class met:
- Variabelen definitie (medewerker × dag × dagdeel × dienst)
- Constraint implementatie (CORE 3):
  1. Max werkdagen per week
  2. Structureel NBH (Niet Beschikbaar Houden)
  3. Service bevoegdheid (welke diensten mag medewerker draaien)
- Objective function (optimalisatie doel)
- Solution extraction

#### 3. models.py (Data Models)
```python
from pydantic import BaseModel
from typing import List, Optional, Dict

class RosterEmployee(BaseModel):
    id: str
    name: str
    team: str
    max_days_per_week: int
    services: List[str]  # Bevoegde diensten
    # ... meer fields

class DayConstraint(BaseModel):
    date: str
    employee_id: str
    dagdeel: str  # "ochtend", "middag", "nacht"
    reason: str
    # ...

class SolveRequest(BaseModel):
    employees: List[RosterEmployee]
    days: List[str]  # ISO dates
    dagdelen: List[str]
    services: List[str]
    constraints: List[DayConstraint]
    nbh_patterns: Dict  # Structurele NBH patronen
    timeout_seconds: int = 30
    # ...

class Assignment(BaseModel):
    employee_id: str
    date: str
    dagdeel: str
    service_id: str

class SolveResponse(BaseModel):
    status: str  # "OPTIMAL", "FEASIBLE", "INFEASIBLE"
    assignments: List[Assignment]
    solve_time: float
    objective_value: int
    message: Optional[str]
```

### Solver Configuratie

#### nixpacks.toml (Railway Build)
```toml
[phases.setup]
nixPkgs = ["python310", "poetry"]

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"
```

**Build proces**:
1. Railway detecteert Python project via `requirements.txt`
2. Nixpacks installeert Python 3.10
3. `pip install -r requirements.txt`
4. Start met uvicorn op dynamische PORT

### Solver Performance

**Complexity**: O(medewerkers × dagen × dagdelen × diensten)

**Voorbeeld scenario**:
- 13 medewerkers
- 35 dagen (5 weken)
- 3 dagdelen (ochtend, middag, nacht)
- 9 diensten
- **= ~12,285 variabelen**

**Timeouts**:
- Default: 30 seconden
- Max: 300 seconden (5 minuten)
- Configureerbaar per request

**Solution Status**:
- `OPTIMAL`: Beste oplossing gevonden binnen tijd
- `FEASIBLE`: Geldige oplossing maar mogelijk niet optimaal
- `INFEASIBLE`: Geen geldige oplossing mogelijk (te strikte constraints)

### CORE 3 Constraints (Huidige Implementatie)

#### 1. Max Werkdagen Per Week
```python
for employee in employees:
    for week in weeks:
        model.Add(
            sum(assigned[e, day, _, _] 
                for day in week) <= employee.max_days_per_week
        )
```

#### 2. Structureel NBH (Niet Beschikbaar Houden)
```python
for employee, day, dagdeel in nbh_patterns:
    model.Add(
        sum(assigned[employee, day, dagdeel, service] 
            for service in services) == 0
    )
```

#### 3. Service Bevoegdheid
```python
for employee, day, dagdeel, service in all_combinations:
    if service not in employee.authorized_services:
        model.Add(assigned[employee, day, dagdeel, service] == 0)
```

---

## 🗄️ DATABASE STRUCTUUR (SUPABASE POSTGRESQL)

### Overzicht
- **Database**: Supabase PostgreSQL 15.x
- **Project URL**: `https://rzecogncpkjfytebfkni.supabase.co`
- **Authenticatie**: Row Level Security (RLS) enabled
- **Migraties**: SQL files in `supabase/migrations/`

### Belangrijkste Tabellen

#### 1. employees (Medewerkers)
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voornaam TEXT NOT NULL,
    achternaam TEXT NOT NULL,
    team TEXT CHECK (team IN ('groen', 'oranje')),
    dienstverband TEXT CHECK (dienstverband IN ('ZZP', 'Loondienst')),
    max_diensten_per_week INTEGER DEFAULT 5,
    actief BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. services (Diensten)
```sql
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    naam TEXT NOT NULL,
    kleur TEXT,  -- Hex color code
    volgorde INTEGER,
    actief BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. roster_employee_services (Medewerker ↔ Dienst Bevoegdheden)
```sql
CREATE TABLE roster_employee_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    aantal INTEGER DEFAULT 0,  -- Voor distributie tracking
    actief BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, service_id)
);
```

**DRAAD105**: Nieuwe tabel voor tracking van dienstverdeling:
- `aantal`: Hoeveel keer medewerker deze dienst al gedraaid heeft
- `actief`: Of deze combinatie geldig is
- Gebruikt door solver voor eerlijke distributie

#### 4. roster_design_unavailability (NBH - Niet Beschikbaar)
```sql
CREATE TABLE roster_design_unavailability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roster_design_id UUID NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    datum DATE NOT NULL,
    dagdeel TEXT CHECK (dagdeel IN ('ochtend', 'middag', 'nacht')),
    reden TEXT,
    is_system BOOLEAN DEFAULT false,  -- DRAAD 103: Automatisch vs handmatig
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**DRAAD 103**: System flag toegevoegd:
- `is_system = false`: Handmatig ingevoerd door planner
- `is_system = true`: Automatisch gegenereerd (bijv. door auto-blocking)

#### 5. planning_constraints (Planregels)
```sql
CREATE TABLE planning_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN (
        'consecutiverest',
        'maxconsecutivework',
        'periodrest',
        'maxhoursperweek',
        'specificdayoff',
        'teamdagblokrules',
        'servicebevoegdheid'
    )),
    name TEXT NOT NULL,
    description TEXT,
    parameters JSONB,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**DRAAD 103**: 5 constraint types VERWIJDERD:
- ~~availability~~ (vervangen door NBH tabel)
- ~~teamdagblokrules~~ (obsolete)
- ~~fairnessbalance~~ (niet geïmplementeerd)
- ~~workloadmax~~ (vervangen door max_diensten_per_week)
- ~~minserviceperperiod~~ (niet gebruikt)

**Behouden**: 7 constraint types voor toekomstige solver implementatie

#### 6. roster_period_staffing (Bezettingsregels per Dienst)
```sql
CREATE TABLE roster_period_staffing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES services(id),
    dagtype TEXT,  -- bijv. "maandag", "dinsdag"
    dagdeel TEXT CHECK (dagdeel IN ('ochtend', 'middag', 'nacht')),
    min_bezetting INTEGER DEFAULT 0,
    max_bezetting INTEGER DEFAULT 99,
    team_scope TEXT CHECK (team_scope IN ('total', 'groen', 'oranje', 'both')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_id, dagtype, dagdeel)
);
```

**Team Scope Feature (v2.1)**:
- `total`: Bezetting geldt voor hele praktijk
- `groen`: Alleen Team Groen
- `oranje`: Alleen Team Oranje
- `both`: Beide teams afzonderlijk

### Database Triggers

#### Auto-Blocking Trigger (DRAAD 103)
```sql
CREATE OR REPLACE FUNCTION auto_block_next_day()
RETURNS TRIGGER AS $$
BEGIN
    -- Bij nachtdienst: automatisch NBH volgende dag (system flag)
    IF NEW.dagdeel = 'nacht' THEN
        INSERT INTO roster_design_unavailability (
            roster_design_id, employee_id, datum, dagdeel, 
            reden, is_system
        ) VALUES (
            NEW.roster_design_id, NEW.employee_id, 
            NEW.datum + INTERVAL '1 day', 'ochtend',
            'Auto-blocking na nachtdienst', true
        ) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_block_after_night
AFTER INSERT OR UPDATE ON roster_assignments
FOR EACH ROW EXECUTE FUNCTION auto_block_next_day();
```

---

## 🚀 DEPLOYMENT INFRASTRUCTUUR

### Railway.app (Production Environment)

#### Service 1: Next.js App (Hoofd Applicatie)
**Project Details**:
- Project ID: `90165889-1a50-4236-aefe-b1e1ae44dc7f`
- Service ID: `fdfbca06-6b41-4ea1-862f-ce48d659a92c`
- Environment ID: `9d349f27-4c49-497e-a3f1-d7e50bffc49f`
- **Live URL**: https://rooster-app-verloskunde-production.up.railway.app

**Deployment Trigger**:
- Automatisch via GitHub webhook op push naar `main` branch
- Railway detecteert Next.js via `package.json`
- Build command: `npm run build`
- Start command: `npm run start`

**Build Proces**:
1. GitHub push detected
2. Railway pulls latest code
3. `npm install` - Dependencies installeren
4. `npm run build` - Next.js build (standalone mode)
5. Deploy `.next/standalone/` naar production
6. Start server met `node .next/standalone/server.js`
7. Health check op `PORT` (dynamisch)
8. Traffic routing naar nieuwe deployment
9. **Gemiddelde build tijd**: 2-3 minuten

**Environment Variables** (Railway Settings):
```bash
NODE_ENV=production
PORT=<dynamisch_door_railway>
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_key>
NEXT_PUBLIC_APP_URL=https://rooster-app-verloskunde-production.up.railway.app
```

#### Service 2: Python Solver (TOEKOMSTIG - Nog niet gedeployed)
**Planned Configuration**:
- Aparte Railway service in zelfde project
- Root directory: `/solver`
- Build: Nixpacks detecteert Python via `requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `GET /health`

**Communicatie tussen services**:
```
Optie A: Public URL (Simpel)
Next.js → SOLVER_SERVICE_URL=https://solver-xyz.railway.app → Python Solver

Optie B: Internal Networking (Sneller)
Next.js → SOLVER_SERVICE_URL=http://solver.railway.internal:8000 → Python Solver
```

### Build Optimalisatie & Cache-Busting

**Probleem**: Railway/Next.js caching kan leiden tot oude versies in productie

**Oplossing**: Multi-layer cache-busting strategie

#### 1. Cachebust Bestanden
```
.cachebust
.cachebust-draad[XX]
.railway-trigger
.railway-trigger-draad[XX]
```

Deze bestanden triggeren rebuild zonder code wijzigingen:
- Bevatten timestamp
- Force Railway om nieuwe build te starten
- Updated bij elke deployment

#### 2. Next.js Build ID
```javascript
generateBuildId: async () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `build-${timestamp}-${random}`;
}
```

#### 3. Version Endpoint
```typescript
// /api/version/route.ts
export async function GET() {
  return Response.json({
    version: process.env.npm_package_version,
    buildId: process.env.BUILD_ID,
    timestamp: Date.now()
  });
}
```

### Deployment Workflow

#### Normale Code Update:
```bash
# 1. Code wijzigingen maken
git add .
git commit -m "DRAAD[X]: Beschrijving wijziging"

# 2. Push naar GitHub
git push origin main

# 3. Railway detecteert automatisch
# - Webhook triggers binnen ~30 seconden
# - Build start automatisch
# - Deployment na succesvolle build (2-3 min)

# 4. Verificatie
# - Check Railway dashboard voor build logs
# - Test live URL
# - Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
```

#### Force Rebuild (zonder code wijziging):
```bash
# Update cachebust file
echo "$(date +%s)" > .railway-trigger

git add .railway-trigger
git commit -m "Force rebuild"
git push origin main
```

### Monitoring & Logging

**Railway Dashboard**: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

**Available Logs**:
- Build logs (install, compile, deploy)
- Runtime logs (console.log, errors)
- Request logs
- Resource usage (CPU, RAM, Network)

**Key Metrics**:
- Build success rate
- Deployment time
- Response time (p50, p95, p99)
- Error rate

---

## 🔄 COMMUNICATIE TUSSEN MODULES (TOEKOMST)

### API Contract: Next.js ↔ Solver

#### Request: POST /api/v1/solve-schedule
```json
{
  "employees": [
    {
      "id": "uuid-123",
      "name": "Jan Jansen",
      "team": "groen",
      "max_days_per_week": 5,
      "services": ["uuid-dienst-1", "uuid-dienst-2"],
      "dienstverband": "Loondienst"
    }
  ],
  "days": ["2025-01-01", "2025-01-02", "2025-01-03"],
  "dagdelen": ["ochtend", "middag", "nacht"],
  "services": [
    {"id": "uuid-dienst-1", "code": "D1", "name": "Dienst 1"}
  ],
  "constraints": [
    {
      "employee_id": "uuid-123",
      "date": "2025-01-02",
      "dagdeel": "ochtend",
      "reason": "Verlof"
    }
  ],
  "nbh_patterns": {
    "uuid-123": {
      "monday": ["middag"],
      "friday": ["nacht"]
    }
  },
  "staffing_requirements": {
    "2025-01-01": {
      "ochtend": {
        "uuid-dienst-1": {"min": 2, "max": 4}
      }
    }
  },
  "timeout_seconds": 30
}
```

#### Response: Succesvol
```json
{
  "status": "OPTIMAL",
  "assignments": [
    {
      "employee_id": "uuid-123",
      "date": "2025-01-01",
      "dagdeel": "ochtend",
      "service_id": "uuid-dienst-1"
    }
  ],
  "solve_time": 12.5,
  "objective_value": 450,
  "message": "Optimal solution found"
}
```

#### Response: Infeasible
```json
{
  "status": "INFEASIBLE",
  "assignments": [],
  "solve_time": 5.2,
  "objective_value": 0,
  "message": "No feasible solution: NBH conflicts with staffing requirements"
}
```

### Integration Flow

```
1. User klikt "Genereer Rooster" in Next.js UI
   ↓
2. Next.js verzamelt data uit Supabase:
   - Employees met bevoegdheden
   - Diensten
   - NBH periodes
   - Bezettingsregels
   - Planregels (constraints)
   ↓
3. Next.js maakt SolveRequest JSON
   ↓
4. POST naar SOLVER_SERVICE_URL/api/v1/solve-schedule
   ↓
5. Solver (Python) ontvangt request
   ↓
6. OR-Tools CP-SAT solver draait (max 30s timeout)
   ↓
7. Solver retourneert SolveResponse
   ↓
8. Next.js ontvangt assignments
   ↓
9. Next.js schrijft assignments naar Supabase
   ↓
10. UI toont gegenereerd rooster
```

### Error Handling

**Timeout** (>30s):
```typescript
try {
  const response = await fetch(SOLVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(35000) // 35s client timeout
  });
} catch (error) {
  if (error.name === 'AbortError') {
    return { error: 'Solver timeout - try smaller period' };
  }
  throw error;
}
```

**INFEASIBLE**:
```typescript
if (response.status === 'INFEASIBLE') {
  return {
    error: 'Geen rooster mogelijk',
    suggestions: [
      'Verlaag min bezetting',
      'Verminder NBH periodes',
      'Verhoog max werkdagen'
    ]
  };
}
```

---

## 📝 BELANGRIJKE COMMANDO'S & WORKFLOWS

### Development (Lokaal)

```bash
# Next.js App
cd /
npm install
npm run dev  # http://localhost:3000

# Python Solver (parallel in andere terminal)
cd solver
pip install -r requirements.txt
uvicorn main:app --reload --port 8000  # http://localhost:8000
```

### GitHub Commits (Best Practices)

```bash
# Format: [DRAAD/ISSUE] - Beschrijving
git commit -m "DRAAD105: Implementeer roster_employee_services met aantal tracking"

# Multi-file commit
git add file1.ts file2.ts
git commit -m "DRAAD103: Verwijder 5 constraint types - TypeScript + SQL updates"

# Hotfix
git commit -m "HOTFIX: Fix TypeScript import error in WeekDagdelenClient"

# Force rebuild
echo "$(date +%s)" > .railway-trigger
git add .railway-trigger
git commit -m "Railway: Force rebuild"
git push origin main
```

### Railway CLI (Optioneel)

```bash
# Link project
railway link 90165889-1a50-4236-aefe-b1e1ae44dc7f

# Logs streamen
railway logs

# Manual deployment (niet aanbevolen - gebruik GitHub)
railway up

# Environment variables
railway variables
railway variables set KEY=value
```

### Database Migraties (Supabase)

```bash
# Nieuwe migratie
# 1. Maak SQL file: supabase/migrations/YYYYMMDD_description.sql

# 2. Kopieer SQL naar Supabase SQL Editor

# 3. Run in Supabase dashboard
# (Auto-commit optie AAN laten)

# 4. Commit SQL file naar Git
git add supabase/migrations/YYYYMMDD_description.sql
git commit -m "DRAAD[X]: Database migration - beschrijving"
git push origin main
```

---

## 🐛 TROUBLESHOOTING GUIDE

### Probleem: Code wijzigingen niet zichtbaar in productie

**Diagnose**:
```bash
# 1. Check Railway deployment logs
# https://railway.com/project/.../deployments

# 2. Check build was succesvol
# Laatste deployment status = SUCCESS?

# 3. Check browser cache
# Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
```

**Oplossing**:
```bash
# A. Force rebuild
echo "$(date +%s)" > .railway-trigger
git add .railway-trigger
git commit -m "Force rebuild"
git push

# B. Browser cache clearen
# Chrome: DevTools → Network → Disable cache (checkbox)
# Incognito mode voor clean test
```

### Probleem: Build faalt op Railway

**Mogelijke oorzaken**:
1. **TypeScript errors**: Check Railway logs voor compile errors
2. **Missing dependencies**: Vergeten `npm install` na nieuwe package
3. **Environment variables**: Ontbrekende NEXT_PUBLIC_ variabelen
4. **Memory limit**: Next.js build kan veel geheugen gebruiken

**Fix TypeScript errors**:
```bash
# Lokaal testen voor push
npm run build

# Type errors fixen
npm run lint
```

**Fix dependencies**:
```bash
# Vergeet niet package.json te committen
git add package.json package-lock.json
git commit -m "Update dependencies"
```

### Probleem: Supabase connection errors

**Check**:
1. Environment variables correct ingesteld in Railway?
2. Supabase project online?
3. RLS policies correct?

**Debug**:
```typescript
// In code tijdelijk loggen
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Connection test:', await supabase.from('employees').select('count'));
```

### Probleem: Solver timeout (toekomstig)

**Oorzaken**:
- Te complexe probleem (te veel variabelen)
- Te strikte constraints
- Server overbelast

**Oplossingen**:
```typescript
// Verhoog timeout
const request = {
  ...data,
  timeout_seconds: 60  // was 30
};

// Reduceer complexiteit
const request = {
  ...data,
  days: days.slice(0, 7)  // 1 week ipv 5 weken
};
```

---

## 📚 REFERENTIES & LINKS

### Documentatie
- **Next.js Docs**: https://nextjs.org/docs
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs
- **OR-Tools Primer**: https://github.com/d-krupke/cpsat-primer
- **FastAPI Docs**: https://fastapi.tiangolo.com

### Live URLs
- **Production App**: https://rooster-app-verloskunde-production.up.railway.app
- **Railway Dashboard**: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Supabase Project**: https://supabase.com/dashboard/project/rzecogncpkjfytebfkni
- **GitHub Repo**: https://github.com/gslooters/rooster-app-verloskunde

### Key Files
- `README.md` - Algemene project info & changelog
- `ROUTE_MAPPING.md` - Complete route overzicht
- `DEPLOYMENT-FIX-DRAAD97A.md` - Solver deployment details
- `solver/README.md` - Solver specifieke documentatie
- `solver/DEPLOY.md` - Solver deployment guide

---

## 🎯 QUICK REFERENCE: CODE AANPASSEN

### Voor Next.js App wijzigingen:

1. **Identificeer correct bestand**:
   - URL `/planning/period-staffing` → `src/app/planning/period-staffing/page.tsx`
   - Check `ROUTE_MAPPING.md` bij twijfel

2. **Maak wijzigingen**:
   - Edit TypeScript/React code
   - Test lokaal met `npm run dev`

3. **Commit & Deploy**:
   ```bash
   git add [files]
   git commit -m "DRAAD[X]: Beschrijving"
   git push origin main
   ```

4. **Verifieer**:
   - Railway build succesvol?
   - Hard refresh browser
   - Test functionaliteit

### Voor Solver wijzigingen (toekomstig):

1. **Edit Python code**:
   - `solver/main.py` - API endpoints
   - `solver/solver_engine.py` - OR-Tools logica
   - `solver/models.py` - Data models

2. **Test lokaal**:
   ```bash
   cd solver
   uvicorn main:app --reload
   ```

3. **Commit & Deploy**:
   ```bash
   git add solver/
   git commit -m "SOLVER: Beschrijving"
   git push origin main
   ```

Railway zal automatisch beide services detecteren en de juiste builden.

---

## ✅ SAMENVATTING

Deze infrastructuur bestaat uit:

1. **Next.js App (MODULE 1)** - Frontend/Backend in één
   - TypeScript + React + Next.js 14
   - Supabase PostgreSQL voor data
   - Railway deployment (automatisch via GitHub)
   - Live op: rooster-app-verloskunde-production.up.railway.app

2. **Python Solver (MODULE 2)** - Optimalisatie service
   - FastAPI + OR-Tools CP-SAT
   - Aparte service in `/solver` directory
   - Nog niet gedeployed (TOEKOMSTIG)
   - Zal communiceren via REST API

**Belangrijk voor code wijzigingen**:
- Voor UI/UX/planning → Edit Next.js app (root)
- Voor optimalisatie/constraints → Edit solver (solver/)
- Beide zitten in DEZELFDE GitHub repository
- Railway zal beide automatisch detecteren en correct builden

**Deployment is AUTOMATISCH**:
- Push naar main → Railway bouwt → Live binnen 2-3 minuten
- Geen handmatige stappen nodig
- Check Railway logs bij problemen

Deze documentatie is up-to-date met DRAAD105 (5 december 2025).
