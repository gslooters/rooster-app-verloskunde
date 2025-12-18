# 🔧 DRAAD 209: STAP 2 - ENVIRONMENT VARIABLES TOEVOEGEN

**Datum:** 18 December 2025, 18:45 CET  
**Status:** ⏳ IN UITVOERING  
**Doel:** GREEDY endpoint configuratie in main app

---

## 📋 SAMENVATTING STAP 2

**Wat je moet doen:**
1. Ga naar Railway → `rooster-app-verloskunde` service
2. Tab: Variables
3. Voeg 9 environment variables toe
4. Save → Auto redeploy
5. Verify → Frontend kan GREEDY bereiken

**Tijd:** ~5 minuten  
**Moeilijkheid:** Makkelijk (alleen copy-paste)  

---

## 🎯 ENVIRONMENT VARIABLES TOEVOEGEN

### Stap 1: Railway Console Openen

**URL:**
```
https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
```

**In de console:**
1. Zie je 3 services
2. Klik op: **`rooster-app-verloskunde`** (main app)
3. Ga naar tab: **Variables**

---

### Stap 2: Voeg 9 Variabelen Toe

#### **GROEP 1: Backend Configuration (Server-side)**

**Variabele 1: GREEDY_ENDPOINT**
```
Naam: GREEDY_ENDPOINT
Waarde: https://greedy-production.up.railway.app/api/greedy/solve
Type: Public
```

**Variabele 2: GREEDY_TIMEOUT**
```
Naam: GREEDY_TIMEOUT
Waarde: 30000
Type: Public
Eenheid: milliseconds
```

---

#### **GROEP 2: Frontend Configuration (Browser-side)**

**Variabele 3: REACT_APP_GREEDY_ENDPOINT**
```
Naam: REACT_APP_GREEDY_ENDPOINT
Waarde: https://greedy-production.up.railway.app
Type: Public
```

**Variabele 4: REACT_APP_GREEDY_HEALTH**
```
Naam: REACT_APP_GREEDY_HEALTH
Waarde: https://greedy-production.up.railway.app/api/greedy/health
Type: Public
```

**Variabele 5: REACT_APP_GREEDY_HC_TIMEOUT**
```
Naam: REACT_APP_GREEDY_HC_TIMEOUT
Waarde: 3000
Type: Public
Opm: Health check timeout (milliseconds)
```

**Variabele 6: REACT_APP_GREEDY_TIMEOUT**
```
Naam: REACT_APP_GREEDY_TIMEOUT
Waarde: 30000
Type: Public
Opm: Solve timeout (milliseconds)
```

**Variabele 7: REACT_APP_GREEDY_RETRY_DELAY**
```
Naam: REACT_APP_GREEDY_RETRY_DELAY
Waarde: 1000
Type: Public
Opm: Milliseconds tussen retries
```

**Variabele 8: REACT_APP_GREEDY_MAX_RETRIES**
```
Naam: REACT_APP_GREEDY_MAX_RETRIES
Waarde: 2
Type: Public
Opm: Aantal retry pogingen
```

---

#### **GROEP 3: Feature Flags**

**Variabele 9: REACT_APP_GREEDY_HEALTH_CHECK**
```
Naam: REACT_APP_GREEDY_HEALTH_CHECK
Waarde: true
Type: Public
Opm: Enable health checks voor GREEDY
```

**Optionele Variabele 10: REACT_APP_GREEDY_OFFLINE_MODE**
```
Naam: REACT_APP_GREEDY_OFFLINE_MODE
Waarde: false
Type: Public
Opm: Enable offline fallback (experimenteel)
```

---

## 🎨 HOE TOEVOEGEN IN RAILWAY UI

### Per Variabele:

1. **Klik** het `+` icoon naast "Service Variables"
2. **Vul in:**
   ```
   Variable Name: [NAAM]
   Value: [WAARDE]
   Type: Public
   ```
3. **Klik** "Save"
4. **Herhaal** voor elke variabele

### Screenshot Indicatie:
```
Railway Console
│
├─ rooster-app-verloskunde (service)
│  ├─ Deployments
│  ├─ Variables  ← JE BENT HIER
│  └─ Metrics
│
└─ [New Variable +]  ← KLIK HIER
   ├─ Variable Name: [input field]
   ├─ Value: [input field]
   └─ Type: [Public/Private]
```

---

## ✅ CHECKLIST: VARIABELEN TOEVOEGEN

### Frontend Variabelen (6 totaal)
- [ ] `REACT_APP_GREEDY_ENDPOINT`
- [ ] `REACT_APP_GREEDY_HEALTH`
- [ ] `REACT_APP_GREEDY_HC_TIMEOUT`
- [ ] `REACT_APP_GREEDY_TIMEOUT`
- [ ] `REACT_APP_GREEDY_RETRY_DELAY`
- [ ] `REACT_APP_GREEDY_MAX_RETRIES`

### Backend Variabelen (2 totaal)
- [ ] `GREEDY_ENDPOINT`
- [ ] `GREEDY_TIMEOUT`

### Feature Flags (1 totaal)
- [ ] `REACT_APP_GREEDY_HEALTH_CHECK`

---

## 🔄 WHAT HAPPENS NEXT

### Automatisch:
```
1. Variabelen opgeslagen in Railway
2. Railway detecteert verandering
3. Service auto-redeployed
4. Nieuwe env vars beschikbaar in app
5. Frontend kan GREEDY bereiken
```

### Hoe Lang?
```
- Variables saved: Direct
- Redeploy started: <5 sec
- Deployment complete: ~1-2 min
- Status: Watch Deployments tab
```

---

## 🧪 VERIFICATIE NA TOEVOEGEN

### Verificatie 1: Railway UI Check
```
1. Variables tab → Zie alle 9 variabelen
2. Deployments tab → Zie groene checkmark (deployed)
3. Logs tab → Geen errors
```

### Verificatie 2: Frontend Logs Check
```
1. Open app: https://rooster-app-verloskunde-{domain}.railway.app
2. Browser DevTools → Console
3. Zoek naar: "GREEDY_ENDPOINT loaded" of vergelijkbaar
```

### Verificatie 3: API Connectivity Test
```
// In browser console:
fetch('https://greedy-production.up.railway.app/api/greedy/health')
  .then(r => r.json())
  .then(d => console.log('✅ GREEDY connected:', d))
  .catch(e => console.log('❌ Error:', e))
```

Expected:
```
✅ GREEDY connected: {"status":"ok","solver":"greedy",...}
```

---

## 📊 VARIABELEN OVERZICHT

| Naam | Waarde | Type | Groep | Purpose |
|------|--------|------|-------|----------|
| `GREEDY_ENDPOINT` | https://greedy-production.up.railway.app/api/greedy/solve | Public | Backend | Solve API URL |
| `GREEDY_TIMEOUT` | 30000 | Public | Backend | Solve timeout (ms) |
| `REACT_APP_GREEDY_ENDPOINT` | https://greedy-production.up.railway.app | Public | Frontend | Service base URL |
| `REACT_APP_GREEDY_HEALTH` | https://greedy-production.up.railway.app/api/greedy/health | Public | Frontend | Health check URL |
| `REACT_APP_GREEDY_HC_TIMEOUT` | 3000 | Public | Frontend | Health check timeout |
| `REACT_APP_GREEDY_TIMEOUT` | 30000 | Public | Frontend | Solve timeout |
| `REACT_APP_GREEDY_RETRY_DELAY` | 1000 | Public | Frontend | Retry delay (ms) |
| `REACT_APP_GREEDY_MAX_RETRIES` | 2 | Public | Frontend | Max retries |
| `REACT_APP_GREEDY_HEALTH_CHECK` | true | Public | Feature | Enable health checks |

---

## 🚨 TROUBLESHOOTING

### Probleem: Variabelen zichtbaar maar app werkt niet

**Oorzaken:**
1. Service nog niet helemaal redeployed
2. Browser cache
3. GREEDY service down

**Oplossingen:**
1. Wacht 2 minuten, refresh browser
2. Ctrl+F5 (hard refresh)
3. Check GREEDY health: https://greedy-production.up.railway.app/api/greedy/health

### Probleem: "Cannot read property 'REACT_APP_GREEDY_ENDPOINT' of undefined"

**Oorzaak:** Env vars nog niet geladen

**Oplossing:**
1. Wacht op redeploy
2. Check Deployments tab (green checkmark?)
3. Refresh app

### Probleem: "Network error connecting to GREEDY"

**Oorzaak:** GREEDY service niet bereikbaar

**Oplossing:**
1. Check GREEDY health: https://greedy-production.up.railway.app/api/greedy/health
2. Check GREEDY service on Railway
3. Check network connectivity

---

## ⏭️ VOLGENDE STAP (STAP 3)

**STAP 3: Verify Database Writes**
- Zorg dat GREEDY assignments correct in Supabase gaan
- Test solve endpoint met echte data
- Verify rooster_assignments table updates

---

## 📝 NOTITIES

### Variable Naming Convention
- `REACT_APP_*` = Frontend accessible (build-time)
- Zonder prefix = Backend only (runtime)

### Timeout Values
- Health check: 3 sec (fast feedback)
- Solve: 30 sec (generous for complex rosters)
- Retry delay: 1 sec (minimal wait)

### URL Convention
- Service: base URL (`https://greedy-production.up.railway.app`)
- Solve: full endpoint (`/api/greedy/solve`)
- Health: health endpoint (`/api/greedy/health`)

---

**Document:** DRAAD 209 STAP 2 - Environment Variables Guide  
**Status:** READY TO EXECUTE  
**Geschat Tijdsbesteed:** 5 minuten  
**Moeilijkheidsgraad:** ⭐ Makkelijk
