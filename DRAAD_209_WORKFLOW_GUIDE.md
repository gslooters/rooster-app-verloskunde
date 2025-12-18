# 🚀 DRAAD 209: ONE-CLICK WORKFLOW GUIDE

## GREEDY API Live Testing via GitHub Actions

**Datum:** 18 December 2025, 18:35 CET  
**Status:** ✅ **PRODUCTION READY**  
**Methode:** 100% via GitHub (geen lokale terminal nodig)

---

## 📋 SNEL START (3 STAPPEN)

### Stap 1: Open GitHub Actions
Ga naar:
```
https://github.com/gslooters/rooster-app-verloskunde/actions
```

### Stap 2: Selecteer Workflow
Klik op: **"DRAAD 209 - GREEDY Live API Test"**

### Stap 3: Run Workflow
1. Klik knop: **"Run workflow"** (dropdown in rechter hoek)
2. Optioneel: wijzig inputs (verbose, save_results)
3. Klik knop: **"Run workflow"** (groene knop)
4. Wacht ~30 seconden op resultaten

---

## ✅ HET WERKT PRECIES ZOALS JIJ VROEG

✅ **Alles via GitHub** - geen terminal  
✅ **One-Click** - gewoon op knop klikken  
✅ **Live Testing** - connect direct met production GREEDY service  
✅ **Volledig Automatisch** - Python tests draaien, resultaten opgeslagen

---

## 🎯 WAT DOET DE WORKFLOW?

### Tests Uitgevoerd

| # | Test | Endpoint | Method | Controleert |
|---|------|----------|--------|-------------|
| 1 | **Health** | `/api/greedy/health` | GET | Service status ✅ |
| 2 | **Root** | `/` | GET | Service info (version, endpoints) |
| 3 | **Validate** | `/api/greedy/validate` | POST | Payload validation |
| 4 | **Docs** | `/docs` | GET | API documentation |

### Output Gegenereerd

```
✅ Console Log: Alle test details
✅ Artifact: DRAAD_209_TEST_RESULTS.json (downloadable)
✅ Job Summary: Mooi geformateerd rapport in UI
✅ Exit Code: 0 (success) of 1 (failure)
```

---

## 📸 SCREENSHOTS - HIERO KLIK JE

### Screenshot 1: Actions Page
```
https://github.com/gslooters/rooster-app-verloskunde/actions

[Linkerzijde]
- Workflow "DRAAD 209 - GREEDY Live API Test"
  ← KLIK HIER
```

### Screenshot 2: Workflow Selected
```
[Rechts bovenkant]
"Run workflow ▼" (dropdown button)
                  ← KLIK HIER
```

### Screenshot 3: Options Dialog
```
Optional inputs:
- Verbose: true/false
- Save results: true/false

[Groene knop] "Run workflow"
              ← KLIK HIER
```

### Screenshot 4: Workflow Running
```
Wacht terwijl:
  🟡 greedy-api-test running
  
~30 seconden later:
  ✅ greedy-api-test completed
```

### Screenshot 5: Results
```
Klik op "greedy-api-test" job:
  - Logs: Alle test output
  - Artifacts: DRAAD_209_TEST_RESULTS.json (download)
  - Summary: Nice formatted report
```

---

## 🔧 WORKFLOW CONFIGURATIE

### Bestand Locatie
```
.github/workflows/draad-209-greedy-live-test.yml
```

### Triggersmogelijkheden

#### Handmatig (Altijd beschikbaar)
```
GitHub Actions UI → "Run workflow" knop
```

#### Geautomatiseerd (Elke dag 09:00 UTC)
```yaml
schedule:
  - cron: '0 9 * * *'
```

---

## 📊 WORKFLOW STAPPEN EXPLAINED

```
1. 📥 Checkout Repository
   ↓
2. 🐍 Setup Python 3.11
   ↓
3. 📦 Install Dependencies (requests)
   ↓
4. ℹ️ Display Environment Info
   ↓
5. 🧪 Run GREEDY API Tests
   ├─ Test 1: Health Endpoint
   ├─ Test 2: Root Endpoint
   ├─ Test 3: Validate Endpoint
   └─ Test 4: Docs Endpoint
   ↓
6. 📊 Display Results Summary
   ↓
7. 📤 Upload Artifact (JSON results)
   ↓
8. 📝 Create Job Summary
   ↓
9. ✅ Success or ❌ Fail
```

---

## 🎯 OUTPUT VOORBEELDEN

### Console Output
```
=======================================
DRAAD 209: GREEDY API LIVE TEST
=======================================

[1/4] Testing Health Endpoint...
  Status: ✅ PASS

[2/4] Testing Root Endpoint...
  Status: ✅ PASS

[3/4] Testing Validate Endpoint...
  Status: ✅ PASS

[4/4] Testing Docs Endpoint...
  Status: ✅ PASS

=======================================
TEST SUMMARY
=======================================
Total Tests: 4
Passed: 4
Failed: 0
Success Rate: 100.0%
Duration: 0:00:05.234567
=======================================
```

### JSON Results File
```json
{
  "test_suite": "DRAAD 209: GREEDY API Integration",
  "execution_date": "2025-12-18T18:35:00.123456",
  "results": [
    {
      "test": "Test 1: Health Endpoint",
      "url": "https://greedy-production.up.railway.app/api/greedy/health",
      "method": "GET",
      "status_code": 200,
      "passed": true,
      "response": {
        "status": "ok",
        "solver": "greedy",
        "timestamp": "2025-12-18T17:28:02.140898Z"
      }
    }
    // ... meer tests
  ],
  "summary": {
    "total_tests": 4,
    "passed": 4,
    "failed": 0,
    "success_rate": "100.0%"
  }
}
```

---

## 🛠️ TROUBLESHOOTING

### Probleem: "Run workflow" knop niet zichtbaar
**Oplossing:**
1. Refresh pagina (F5)
2. Check: Je bent op `main` branch
3. Check: Workflow bestand is gecommit

### Probleem: Workflow faalt met error
**Controleer:**
1. GREEDY service is online: https://greedy-production.up.railway.app
2. Health endpoint werkt: https://greedy-production.up.railway.app/api/greedy/health
3. Railway project is niet down

### Probleem: JSON artifact niet gedownload
**Oplossing:**
1. Ga naar Job → "Artifacts" tab
2. Download: `greedy-test-results-{run_number}`
3. File: `DRAAD_209_TEST_RESULTS.json`

---

## 📈 MONITORING

### Real-time Monitoring tijdens Test

1. **GitHub Actions Log**
   - Live updates terwijl tests draaien
   - Click "greedy-api-test" job
   - Scroll down tot step "Run GREEDY API Tests"

2. **Railway Logs** (parallel)
   - Open Railway → greedy service → Logs
   - Zie requests binnenkomen terwijl tests draaien
   - Mooie correlatie!

---

## 🔄 SCHEDULED RUNS (Optioneel)

### Daily Monitoring
Workflow is ingesteld om **elke dag om 09:00 UTC** automatisch te draaien.

**Om uit te schakelen:**
Edit `.github/workflows/draad-209-greedy-live-test.yml`:
```yaml
# Commenteer uit:
# schedule:
#   - cron: '0 9 * * *'
```

**Om aan te passen:**
Vers van cron syntax (POSIX):
```yaml
cron: '0 14 * * MON-FRI'  # Elke werkdag 14:00 UTC
cron: '0 */6 * * *'       # Elke 6 uur
cron: '0 0 * * 0'         # Elke zondag 00:00
```

---

## 💾 RESULTS HANDLING

### Download Results
1. Ga naar Actions → Workflow run
2. Scroll down → "Artifacts" section
3. Download: `greedy-test-results-{number}`
4. Extract: `DRAAD_209_TEST_RESULTS.json`

### Retention Policy
- Test results: **30 dagen**
- Test scripts: **7 dagen**

---

## 🎓 VERVOLG STAPPEN

### Stap 1: Test nu
→ Klik "Run workflow" en bekijk resultaten

### Stap 2: Voeg env vars toe
→ Main app environment variables configureren

### Stap 3: Test database writes
→ Zorg dat GREEDY assignments correct in DB gaan

### Stap 4: Integration complete
→ Frontend buttons toevoegen en testen

---

## 📞 NEED HELP?

Kijk in de volgende files:
- `tests/test_greedy_api_live.py` - Test script source
- `tests/DRAAD_209_GREEDY_INTEGRATION_TEST.md` - Test documentation
- `.github/workflows/draad-209-greedy-live-test.yml` - Workflow source

---

## ✨ SUMMARY

| Wat | Details |
|-----|----------|
| **Workflow Bestand** | `.github/workflows/draad-209-greedy-live-test.yml` |
| **URL** | https://github.com/gslooters/rooster-app-verloskunde/actions |
| **Klik Op** | "DRAAD 209 - GREEDY Live API Test" |
| **Dan Klik** | "Run workflow" |
| **Wacht** | ~30 seconden |
| **Resultaat** | ✅ Test Report + JSON Artifact |
| **Terminal Nodig?** | ❌ NOPE! 100% GitHub |

---

**Klaar?** 🚀 
→ Ga naar: https://github.com/gslooters/rooster-app-verloskunde/actions  
→ Klik op workflow  
→ Klik "Run workflow"  
→ Enjoy! ✨

---

**Document:** DRAAD 209 Workflow Guide  
**Status:** ✅ PRODUCTION READY  
**Laatst bijgewerkt:** 18 December 2025, 18:35 CET
