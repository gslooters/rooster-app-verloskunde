# DRAAD42E - Verificatie Checklist

**Deployment Status:** ⏳ IN PROGRESS  
**Timestamp:** 2025-11-22T02:33:00Z  
**Build ID:** 98472651

---

## 🚀 DEPLOYMENT OVERZICHT

### Commits Gepusht
```
✅ 7cb46ff - Deployment documentatie
✅ 797bb23 - Version.json cache-buster  
✅ 213c4d6 - Railway trigger update
✅ 471eff8 - Cache-bust bestand
```

### Bestanden Geüpdate
✅ `public/cache-bust-draad42e.txt`  
✅ `.railway-trigger` (Build ID: 98472651)  
✅ `public/version.json`  
✅ `DRAAD42E_DEPLOYMENT.md`  
✅ `DRAAD42E_VERIFICATION_CHECKLIST.md` (DEZE)

---

## ⌛ WACHT OP RAILWAY REBUILD

### Verwacht Gedrag
Railway detecteert automatisch nieuwe commits en start rebuild:
1. **Initializing** (0-30 sec)
2. **Building** (1-3 min)
3. **Deploying** (30-60 sec)  
4. **Active** (deployment live)

### Check Deployment Status
**Railway Dashboard:**  
https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f/service/fdfbca06-6b41-4ea1-862f-ce48d659a92c

**Live App URL:**  
https://rooster-app-verloskunde-production.up.railway.app

---

## ✅ VERIFICATIE STAPPEN (NA REBUILD)

### 🟢 Stap 1: Railway Dashboard Check
```
☐ Open Railway project dashboard
☐ Ga naar "Deployments" tab
☐ Zoek deployment met commit 7cb46ff of nieuwer
☐ Status moet "Active" zijn (groene stip)
☐ Geen rode "Failed" of "Crashed" status
```

### 🌐 Stap 2: Live App Test
```
☐ Open: https://rooster-app-verloskunde-production.up.railway.app
☐ Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
☐ Wacht tot app volledig geladen is
☐ Check dat homepage correct wordt weergegeven
```

### 📊 Stap 3: Week 48 Selectie Test
```
☐ Navigeer naar "Rooster Ontwerp"
☐ Klik op "Diensten per Dagdeel Aanpassen: Periode Week 48 - Week 52"
☐ Klik op "Week 48: 24/11 - 30/11"
☐ Verwacht: Spinner verschijnt kort
☐ Verwacht: Data wordt geladen (GEEN foutmelding)
☐ Verwacht: Tabel met dagdelen wordt getoond
```

### 🔍 Stap 4: Console Verificatie
```
☐ Open Browser Console (F12)
☐ Klik opnieuw op Week 48
☐ Check Network tab voor Supabase request:

   MOET ZIEN:
   ✅ GET /rest/v1/roster_period_staffing?select=id,date,serviceid&...
   ✅ Status: 200 OK
   ✅ Response: JSON array met staffing data

   MAG NIET ZIEN:
   ❌ Error: "column roster_period_staffing.serviceid does not exist"
   ❌ Status: 400 Bad Request
```

### 📝 Stap 5: Data Validatie
```
☐ Week 48 tabel toont correct:
   - Kolomkoppen: Ma, Di, Wo, Do, Vr, Za, Zo
   - Rijen voor elk service type
   - Dagdelen: Ochtend, Middag, Avond
   - Status indicators (MAG/MOET/NIET)
☐ Geen lege cellen waar data verwacht wordt
☐ Knoppen werken (opslaan, annuleren, etc.)
```

---

## 📊 SUCCES CRITERIA

### 🎯 Primaire Criteria
- [ ] Week 48 selectie werkt zonder foutmelding
- [ ] Supabase query retourneert HTTP 200
- [ ] Data wordt correct geladen en weergegeven
- [ ] Console toont GEEN "serviceid does not exist" error

### 🎯 Secundaire Criteria  
- [ ] Andere weken (49-52) werken ook correct
- [ ] Navigatie tussen weken werkt smooth
- [ ] Data persisteert na refresh
- [ ] Geen console warnings of errors

---

## 🔧 TROUBLESHOOTING

### 🔴 Als Fout Blijft Bestaan

**1. Browser Cache Wissen**
```bash
# Chrome/Edge:
Ctrl+Shift+Delete > "Cached images and files" > Clear

# Firefox:
Ctrl+Shift+Delete > "Cache" > Clear Now

# Safari:
Cmd+Option+E
```

**2. Railway Deployment Check**
```
1. Open Railway dashboard
2. Check "Deployments" tab
3. Zoek laatste deployment (commit 7cb46ff)
4. Klik op deployment > View Logs
5. Check voor build errors
```

**3. Database Schema Verify**
```sql
-- In Supabase SQL Editor:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roster_period_staffing'
  AND column_name LIKE '%service%';

-- Verwacht resultaat:
-- serviceid | uuid | NO
```

**4. Manual Query Test**
```sql
-- Test query direct in Supabase:
SELECT id, date, serviceid
FROM roster_period_staffing
WHERE roster_period_id = '9c4c01d4-3ff2-4790-a569-a4a25380da39'
  AND date >= '2025-11-24'
  AND date <= '2025-11-30';

-- Als dit werkt maar app niet:
-- -> Railway gebruikt nog oude code
-- -> Check deployment commit SHA
```

**5. Force Redeploy**
```bash
# Als alles faalt, nog een keer forceren:
# Update .railway-trigger met nieuw random nummer
# En push opnieuw
```

---

## 📞 SUPPORT INFO

### Relevante Links
- **Github Repo:** https://github.com/gslooters/rooster-app-verloskunde
- **Railway Project:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Live App:** https://rooster-app-verloskunde-production.up.railway.app
- **Supabase Dashboard:** (login vereist)

### Database Info
```
Tabel: roster_period_staffing
Kolommen: id, serviceid, date, minstaff, maxstaff, roster_period_id
Gefixt bestand: components/planning/week-dagdelen/WeekDagdelenVaststellingTable.tsx
Commit met fix: 4a3ce72 (DRAAD42D)
```

### Console Error (Oud - Moet Verdwenen Zijn)
```javascript
Error fetching staffing data: {
  code: '42703',
  details: null,
  hint: 'Perhaps you meant to reference the column "roster_period_staffing.service_id".',
  message: 'column roster_period_staffing.serviceid does not exist'
}
```

---

## 📅 TIJDLIJN

```
02:31:09 - Cache-bust bestand aangemaakt
02:31:34 - Railway trigger geüpdate  
02:31:51 - Version.json toegevoegd
02:32:43 - Deployment documentatie
02:33:00 - Verificatie checklist (DEZE)
02:33:00 - ⏳ Wachten op Railway rebuild...

[VERWACHT]
02:38:00 - ✅ Railway deployment actief
02:40:00 - ✅ App getest en geverifieerd
```

---

## ✅ COMPLETION

Vul in na succesvolle verificatie:

```
Geverifieerd door: _______________
Datum/Tijd: _______________  
Week 48 werkt: [ ] JA  [ ] NEE
Console errors: [ ] GEEN  [ ] WEL
Deployment SHA: _______________

Opmerkingen:
__________________________________________
__________________________________________
__________________________________________
```

---

**Status:** ⏳ Awaiting Railway rebuild completion  
**Next Action:** Wacht 5-10 minuten en volg verificatie stappen  
**Priority:** HIGH  
**Assignee:** Development Team
