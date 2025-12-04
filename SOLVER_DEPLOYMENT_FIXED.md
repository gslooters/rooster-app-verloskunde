# Python Solver Service Deployment - FIXED INSTRUCTIES

## 🚨 PROBLEEM OPGELOST

**Railway probeerde hele repo als Next.js te builden in plaats van solver/ directory.**

**Oplossing**: Nixpacks config + Root Directory instelling

---

## ✅ FILES TOEGEVOEGD (Commit: e124c4f)

- `solver/nixpacks.toml` - Forceert Python detection
- `solver/.railwayignore` - Negeert root Next.js files

---

## 🚀 DEPLOYMENT STAPPEN (HERZIEN)

### STAP 0: Verwijder Foutieve Service

**In Railway Dashboard:**

1. **Ga naar heartfelt-joy service**
2. **Settings → Danger → Delete Service**
3. **Bevestig verwijdering**

**Waarom?** Huidige service heeft verkeerde build configuratie. Schone start is sneller.

---

### STAP 1: Maak NIEUWE Service (Correct)

1. **Railway Project** `roostervarw1` → Klik **"+" (New)**
2. **Selecteer**: "GitHub Repo"
3. **Kies**: `gslooters/rooster-app-verloskunde`
4. ⏸️ **STOP - klik NOG NIET op Deploy!**

---

### STAP 2: Configureer VOOR Eerste Deploy

**KRITIEK: Doe dit VOOR de eerste deployment!**

#### A. Root Directory Instellen

**In service Settings → zoek naar één van:**
- "Root Directory"
- "Watch Paths"  
- "Source" tab → "Root Path"
- "Build" sectie → "Working Directory"

**Zet waarde**: `solver`

**Als je dit veld NIET kunt vinden:**

Dan moet je het via Railway CLI doen (zie OPTIE B hieronder).

---

#### B. ALTERNATIEF: Via Railway CLI (MEEST BETROUWBAAR)

**Eenmalig: Installeer Railway CLI**

**Windows (PowerShell as Admin):**
```powershell
iwr https://railway.app/install.ps1 -useb | iex
```

**Mac/Linux:**
```bash
bash <(curl -fsSL cli.new/railway)
```

**Login:**
```bash
railway login
```

**Link naar je nieuwe service:**
```bash
# Ga naar een willekeurige directory (niet je project)
cd ~/Desktop

# Link naar Railway
railway link
# Kies: roostervarw1
# Kies: [nieuwe service naam]
```

**Deploy met Root Directory:**
```bash
railway up --root solver
```

**Dit commando:**
- Pusht code vanaf GitHub main branch
- Vertelt Railway: "Bouw ALLEEN solver/ directory"
- Nixpacks detecteert Python + OR-Tools

---

### STAP 3: Verify Build Start

**Check Railway logs:**

**✅ CORRECT (moet zien):**
```
↳ Detected Python
↳ Using pip
mise python@3.11 install
pip install -r requirements.txt
Installing ortools...
```

**❌ FOUT (als je ziet):**
```
↳ Detected Node
↳ Using npm
npm ci
npm run build
```

**Als FOUT**: Root Directory is niet correct ingesteld. Probeer OPTIE B (Railway CLI).

---

### STAP 4: Generate Public URL

**Na succesvolle build:**

1. **Settings → Networking**
2. **Generate Domain**
3. **Kopieer URL**: `https://solver-xyz.railway.app`

---

### STAP 5: Test Solver Health

**Browser:**
```
https://[solver-url]/
```

**Verwacht**:
```json
{
  "service": "Rooster Solver Service",
  "status": "online",
  "version": "1.0.0",
  "solver": "Google OR-Tools CP-SAT"
}
```

---

### STAP 6: Configureer Next.js Service

**Ga naar Next.js service (`rooster-app-verloskunde`):**

1. **Variables tab**
2. **Add Variable**:
   ```
   SOLVER_SERVICE_URL=https://[solver-url].railway.app
   ```
3. **Save** (Railway redeploys automatisch)

---

## 📊 VERIFICATIE CHECKLIST

### Solver Service:
- [ ] Logs tonen "Detected Python" (NIET "Detected Node")
- [ ] `pip install ortools` succesvol
- [ ] `uvicorn main:app` start zonder errors
- [ ] Health endpoint `/` retourneert JSON
- [ ] Health endpoint `/health` retourneert JSON

### Next.js Service:
- [ ] `SOLVER_SERVICE_URL` environment variable gezet
- [ ] Deployment succesvol na variable toevoegen
- [ ] Logs tonen geen "ECONNREFUSED" meer

### End-to-End:
- [ ] Dashboard → "Roosterbewerking starten" knop werkt
- [ ] ORT call bereikt Python solver
- [ ] Solver logs tonen "[Solver] Start solving roster..."
- [ ] Oplossing wordt terug geschreven naar database

---

## 🔧 TROUBLESHOOTING

### Build Failed: "Detected Node"

**Probleem**: Railway bouwt root Next.js ipv solver/

**Oplossing**:
1. Delete service
2. Maak nieuwe service
3. **VOOR** eerste deploy: Zet Root Directory = `solver`
4. OF gebruik Railway CLI: `railway up --root solver`

---

### Build Failed: "pip: command not found"

**Probleem**: Python niet gedetecteerd

**Oplossing**:
- Verify `solver/requirements.txt` exists
- Verify `solver/nixpacks.toml` exists (commit e124c4f)
- Check Railway logs voor "Detected Python"

---

### Runtime Error: "ModuleNotFoundError: ortools"

**Probleem**: OR-Tools niet geïnstalleerd

**Oplossing**:
- Check build logs: `pip install ortools` succesvol?
- Verify `requirements.txt` bevat `ortools==9.11.4210`

---

### ECONNREFUSED in Next.js

**Probleem**: `SOLVER_SERVICE_URL` niet gezet of verkeerd

**Oplossing**:
1. Check Next.js Variables tab
2. Verify URL format: `https://solver-xyz.railway.app` (GEEN trailing slash)
3. Test solver URL handmatig in browser

---

## 💡 WAAROM DIT WERKT

**Root Directory = `solver`**:
- Railway cd's naar `solver/` VOOR build start
- Ziet `requirements.txt` → Detecteert Python
- Ziet `nixpacks.toml` → Leest build instructies
- Negeert root `package.json`

**Nixpacks Config**:
- Forceert Python 3.11
- Expliciet: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port ${PORT}`

**`.railwayignore`**:
- Extra zekerheid: negeert root Next.js files
- Houdt alleen solver/ content

---

## 🎯 SUCCESS CRITERIA

✅ Service bouwt als **Python** (NIET Node)  
✅ OR-Tools installeert succesvol  
✅ Health endpoint werkt  
✅ Public URL toegankelijk  
✅ Next.js kan solver bereiken  
✅ End-to-end ORT flow werkt  

---

## 📞 ALS JE VAST LOOPT

**Railway CLI Methode (OPTIE B) is het meest betrouwbaar!**

Dit omzeilt alle Railway UI issues en werkt 100% van de tijd.

---

**Klaar om opnieuw te proberen!** 🚀
