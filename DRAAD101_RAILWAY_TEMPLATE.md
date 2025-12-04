# DRAAD101 - Railway FastAPI Template Setup

## 🎯 DOEL

Migratie van Next.js standalone naar Railway FastAPI Template architectuur voor betrouwbare deployment.

---

## 🛠️ ARCHITECTUUR

### Vorige Situatie (GEFAALD)
- Next.js standalone deployment
- Nixpacks auto-detection problemen
- 3+ uur debugging zonder succes
- Non-functional solver service

### Nieuwe Situatie (Railway Template)
```
Railway FastAPI Template
├── main.py                  # FastAPI backend (entry point)
├── requirements.txt         # Python dependencies
├── nixpacks.toml            # Railway build config
├── out/                     # Next.js static export
│   ├── index.html
│   ├── _next/
│   └── ...
└── app/                     # Next.js source (build input)
    └── ...
```

---

## 🔧 FASE 1 - CODE VOORBEREIDING ✅

### Wat is gedaan:

1. **✅ FastAPI Backend Gecreëerd**
   - `main.py` - Entry point met static file serving
   - Health check endpoint: `/health`
   - Version endpoint: `/api/version`
   - Static file serving voor Next.js output

2. **✅ Python Dependencies**
   - `requirements.txt` met FastAPI, Uvicorn
   - OR-Tools voor toekomstige solver integratie
   - Supabase compatible libraries

3. **✅ Next.js Static Export**
   - `next.config.js` - Geüpdatet naar `output: 'export'`
   - `package.json` - Build scripts aangepast
   - Images unoptimized (required voor static export)

4. **✅ Railway Configuration**
   - `nixpacks.toml` - Dual runtime (Python + Node.js)
   - `.railwayignore` - Python files NIET meer negeren
   - Build process: npm build → Next.js static export

### Files Aangemaakt/Aangepast:

```bash
Aangemaakt:
- main.py
- requirements.txt  
- nixpacks.toml
- DRAAD101_RAILWAY_TEMPLATE.md

Aangepast:
- next.config.js (standalone → export)
- package.json (nieuwe scripts)
- .railwayignore (Python toegestaan)
```

---

## 📄 BUILD PROCESS

### Railway Build Flow:

```
1. Railway detecteert nixpacks.toml
2. Install phase:
   - npm ci (Node.js dependencies)
   - pip install -r requirements.txt (Python dependencies)
3. Build phase:
   - npm run build (Next.js static export → out/ directory)
4. Start:
   - uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Lokaal Testen:

```bash
# Install dependencies
npm ci
pip install -r requirements.txt

# Build frontend
npm run build

# Start backend
uvicorn main:app --reload

# Browser: http://localhost:8000
```

---

## 📦 DEPLOYMENT STRATEGIE

### Fase 2 - Railway Service Setup (VOLGENDE)

1. **Nieuwe Railway Service Creëren**
   - Railway dashboard → New Service
   - Connect GitHub repo
   - Select branch: `draad101-railway-template`

2. **Environment Variables**
   ```
   PORT=8000
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   ```

3. **Deploy & Test**
   - Railway auto-detect via nixpacks.toml
   - Verify build succeeds
   - Test endpoints:
     - /health
     - /api/version  
     - / (Next.js app)

### Fase 3 - Cutover (LATER)

1. Verify nieuwe service werkt 100%
2. Update domain naar nieuwe service
3. Delete oude non-functional service

---

## ✅ PRE-DEPLOYMENT CHECKLIST

- [x] main.py gecreëerd
- [x] requirements.txt gecreëerd  
- [x] nixpacks.toml geconfigureerd
- [x] next.config.js geüpdatet
- [x] package.json scripts aangepast
- [x] .railwayignore gefixed
- [ ] Railway service setup (Fase 2)
- [ ] Test deployment
- [ ] Production cutover (Fase 3)

---

## 📝 TECHNISCHE DETAILS

### FastAPI Endpoints:

```python
GET  /health          # Health check
GET  /api/version     # Version info
GET  /*               # Next.js static files (fallback)
```

### Next.js Export:

- Output directory: `out/`
- Mode: Static HTML export
- Images: Unoptimized (required for export)
- Trailing slashes: Enabled

### Runtime Stack:

- **Python**: 3.11 (FastAPI backend)
- **Node.js**: 20 (Next.js build only)
- **Server**: Uvicorn (ASGI)

---

## 🔥 WAAROM DIT WERKT

1. **Proven Template**: Railway FastAPI Template is battle-tested
2. **Dual Runtime**: Nixpacks handles Python + Node.js seamlessly
3. **Static Frontend**: Next.js export = zero runtime issues
4. **Simple Stack**: FastAPI serves static files perfectly
5. **No Auto-detect Chaos**: Explicit nixpacks.toml = predictable builds

---

## 🚀 VOLGENDE STAPPEN

Fase 2 start in volgende draad:
- Railway service aanmaken
- Branch deployment configureren
- Test build & deployment
- Verify all endpoints

---

**DRAAD101 FASE1 STATUS: ✅ COMPLETE**

Code prep klaar. Ready voor Railway deployment.
