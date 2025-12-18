# 🔧 DRAAD 209: STAP 2 - ENVIRONMENT VARIABLES DEPLOYMENT

**Status:** ✅ **READY TO EXECUTE**  
**Datum:** 18 December 2025, 18:45 CET  
**Doel:** 9 Environment Variables toevoegen aan main app in Railway

---

## 📋 DOCUMENTATIE BESTANDEN VOOR STAP 2

### 1. **DRAAD_209_STAP2_ENV_VARS_GUIDE.md** (Uitgebreid)
- 7200+ characters
- Gedetailleerde stap-voor-stap guide
- Troubleshooting section
- Monitoring tips
- Verificatie procedures

### 2. **DRAAD_209_STAP2_QUICK_REFERENCE.txt** (Snel)
- Copy-paste ready values
- Quick lookup table
- Common mistakes section
- Single-block reference

### 3. **DRAAD_209_STAP2_EXECUTE.md** (Praktisch)
- Walkthrough met screenshots
- Alles wat je moet doen
- Step-by-step procedures
- Verification checks

### 4. **DRAAD_209_STAP2_RAPPORT.txt** (Overzicht)
- Complete STAP 2 summary
- Quick reference table
- Troubleshooting guide
- Ready to execute checklist

---

## 🎯 9 ENVIRONMENT VARIABLES

### Backend (2)
```
GREEDY_ENDPOINT = https://greedy-production.up.railway.app/api/greedy/solve
GREEDY_TIMEOUT = 30000
```

### Frontend (6)
```
REACT_APP_GREEDY_ENDPOINT = https://greedy-production.up.railway.app
REACT_APP_GREEDY_HEALTH = https://greedy-production.up.railway.app/api/greedy/health
REACT_APP_GREEDY_HC_TIMEOUT = 3000
REACT_APP_GREEDY_TIMEOUT = 30000
REACT_APP_GREEDY_RETRY_DELAY = 1000
REACT_APP_GREEDY_MAX_RETRIES = 2
```

### Feature Flags (1)
```
REACT_APP_GREEDY_HEALTH_CHECK = true
```

---

## 🚀 HOE TE STARTEN

### Optie 1: Snel (3 minuten)
**Lees:** `DRAAD_209_STAP2_QUICK_REFERENCE.txt`
- Copy-paste values
- Voeg direct toe in Railway

### Optie 2: Voorzichtig (5-7 minuten)
**Lees:** `DRAAD_209_STAP2_EXECUTE.md`
- Stap-voor-stap walkthrough
- Screenshots indicaties
- Verificatie checks

### Optie 3: Uitgebreid (10 minuten)
**Lees:** `DRAAD_209_STAP2_ENV_VARS_GUIDE.md`
- Complete guide
- Troubleshooting
- Best practices

---

## 🔗 RAILWAY DIRECT LINK

```
https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
```

Stappen:
1. Klik link
2. Selecteer: rooster-app-verloskunde
3. Tab: Variables
4. Voeg 9 variabelen toe
5. Wacht op redeploy (1-2 min)
6. ✅ DONE!

---

## ⏱️ TIMING

| Activiteit | Duur |
|-----------|------|
| Open Railway | 30 sec |
| Navigate | 30 sec |
| Add variables | 3-4 min |
| Auto-redeploy | 1-2 min |
| Verification | 1 min |
| **TOTAL** | **~6 min** |

---

## ✅ SUCCESS CRITERIA

STAP 2 is voltooid wanneer:

- ✅ Alle 9 variabelen toegevoegd en zichtbaar
- ✅ Railway Deployments tab toont 🟢 Green
- ✅ Deployment is "live"
- ✅ Geen errors in Railway logs
- ✅ Browser hard refresh werkt
- ✅ process.env vars geladen in DevTools
- ✅ GREEDY health endpoint antwoordt

---

## 📊 DOCUMENT MAP

```
DRAAD_209_STAP2/
├── DRAAD_209_STAP2_ENV_VARS_GUIDE.md          (Uitgebreid - 7.2 KB)
├── DRAAD_209_STAP2_QUICK_REFERENCE.txt        (Snel - 6.9 KB)
├── DRAAD_209_STAP2_EXECUTE.md                 (Praktisch - 6.5 KB)
├── DRAAD_209_STAP2_RAPPORT.txt                (Overzicht - 7.1 KB)
└── DRAAD_209_STAP2_SUMMARY.md                 (Dit bestand)
```

---

## 🔄 WORKFLOW NA TOEVOEGEN

```
Variabelen saved
    ↓
Railway detecteert verandering
    ↓
Automatisch redeploy gestart
    ↓
Docker image gebuild met env vars
    ↓
Service restarted
    ↓
🟢 Green Checkmark = READY
```

---

## 🎉 VOLGENDE STAP

Zodra STAP 2 voltooid (env vars deployed & verified):

**STAP 3: Database Writes Verification**
- Test solve endpoint met echte roster data
- Verify Supabase rooster_assignments updates
- Confirm GREEDY integration working end-to-end

---

**Status:** ✅ READY TO EXECUTE  
**Last Updated:** 18 December 2025, 18:45 CET  
**Total Docs:** 5 files  
**Total Size:** 35+ KB  
**Difficulty:** ⭐ Easy (copy-paste)
