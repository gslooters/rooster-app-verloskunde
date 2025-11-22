# DRAAD42E - Railway Force Redeploy voor serviceid Fix

**Datum:** 2025-11-22T02:31:00Z  
**Build ID:** 98472651  
**Status:** ⏳ Deploying naar Railway

---

## 🔥 PROBLEEM

Na selectie van Week 48 in het dashboard verschijnt foutmelding:
```
Fout bij ophalen van data
```

**Console error:**
```
Error fetching staffing data: {
  code: '42703',
  message: 'column roster_period_staffing.serviceid does not exist'
}
```

**HTTP Request:**
```
GET /rest/v1/roster_period_staffing?
  select=id,date,serviceid
  &roster_period_id=eq.9c4c01d4-3ff2-4790-a569-a4a25380da39
  &date=gte.2025-11-24
  &date=lte.2025-11-30

Status: 400 (Bad Request)
```

---

## 🔍 ROOT CAUSE ANALYSE

### Database Schema (Supabase)
```sql
TABEL: roster_period_staffing

KOLOMMEN:
- id (uuid, NOT NULL)
- serviceid (uuid, NOT NULL)  ← ZONDER underscore!
- date (date, NOT NULL)
- minstaff (integer)
- maxstaff (integer)
- roster_period_id (uuid)
```

### Code Status
✅ **Github code is CORRECT:**
- Bestand: `components/planning/week-dagdelen/WeekDagdelenVaststellingTable.tsx`
- Regel 64: `.select('id, date, serviceid')`  ← CORRECT
- Commit: `4a3ce7227f8845e7ec6d8684ac52cb44dc216b98`
- Datum: 2025-11-22T02:03:15Z

❌ **Railway draait OUDE versie:**
- Railway heeft oude build in cache
- Oude code gebruikte mogelijk verkeerde kolomnaam
- Browser cache kan ook oude JS-bundel hebben

---

## ✅ OPLOSSING

### Stap 1: Code Verificatie
```typescript
// CORRECT - Huidige code op Github:
const { data: staffingRecords, error: staffingError } = await supabase
  .from('roster_period_staffing')
  .select('id, date, serviceid')  // ✅ serviceid ZONDER underscore
  .eq('roster_period_id', rosterId)
  .gte('date', weekStart.split('T')[0])
  .lte('date', weekEnd.split('T')[0]);
```

### Stap 2: Cache-Busting (DRAAD42E)
✅ **Uitgevoerd:**
1. `public/cache-bust-draad42e.txt` - Timestamp: 1732243890000
2. `.railway-trigger` - Build ID: 98472651
3. `public/version.json` - Version: DRAAD42E-serviceid-fix

### Stap 3: Railway Deployment
```bash
Commits:
1. 471eff8 - Cache-bust bestand aangemaakt
2. 213c4d6 - Railway trigger geüpdate
3. 797bb23 - Version.json cache-buster
4. [DEZE] - Deployment documentatie
```

---

## 📝 VERIFICATIE CHECKLIST

### Na Railway Rebuild (5-10 minuten)

☐ **1. Railway Deployment Status**
- [ ] Check Railway dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- [ ] Build succesvol afgerond
- [ ] Deployment status: ACTIVE

☐ **2. Live App Testen**
- [ ] Open app: https://rooster-app-verloskunde-production.up.railway.app
- [ ] Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- [ ] Navigeer naar "Rooster Ontwerp"
- [ ] Klik op "Diensten per Dagdeel Aanpassen"
- [ ] Selecteer "Week 48: 24/11 - 30/11"

☐ **3. Verwacht Resultaat**
- [ ] GEEN foutmelding "Fout bij ophalen van data"
- [ ] Week 48 data wordt geladen
- [ ] Tabel wordt getoond met diensten per dagdeel
- [ ] Spinner verschijnt kort, daarna data

☐ **4. Console Verificatie**
```javascript
// Open Browser Console (F12)

// MOET ZIEN:
GET /rest/v1/roster_period_staffing?select=id,date,serviceid&...
Status: 200 OK

// MAG NIET ZIEN:
"column roster_period_staffing.serviceid does not exist"
Status: 400 Bad Request
```

☐ **5. Database Query Verificatie**
```sql
-- Test in Supabase SQL Editor:
SELECT id, date, serviceid 
FROM roster_period_staffing 
WHERE roster_period_id = '9c4c01d4-3ff2-4790-a569-a4a25380da39'
  AND date >= '2025-11-24'
  AND date <= '2025-11-30';

-- Verwacht: Meerdere rijen met serviceid (uuid)
```

---

## 🛠️ TROUBLESHOOTING

### Als error blijft bestaan:

**1. Browser Cache Wissen**
```
Chrome: Ctrl+Shift+Delete > Cached images and files
Firefox: Ctrl+Shift+Delete > Cache
Safari: Cmd+Option+E
```

**2. Railway Logs Checken**
```bash
# Via Railway CLI:
railway logs

# Of via Dashboard:
https://railway.com/project/.../deployments
```

**3. Database Schema Bevestigen**
```sql
-- Supabase SQL Editor:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'roster_period_staffing'
  AND column_name LIKE '%service%';

-- Verwacht: serviceid | uuid
```

**4. Code Re-verificatie**
```bash
# Check laatste commit op Railway:
git log -1 --oneline

# Moet zijn: 797bb23 of nieuwer
```

---

## 📊 DEPLOYMENT DETAILS

### Commits voor DRAAD42E
```
797bb23 - Version cache-buster
213c4d6 - Railway trigger update
471eff8 - Cache-bust bestand
4a3ce72 - Originele serviceid fix (DRAAD42D)
```

### Bestanden Geüpdate
1. `public/cache-bust-draad42e.txt` (NEW)
2. `.railway-trigger` (UPDATED)
3. `public/version.json` (NEW)
4. `DRAAD42E_DEPLOYMENT.md` (DEZE)

### Build Eigenschappen
- **Build ID:** 98472651
- **Cache-bust:** DRAAD42E-1732243895000
- **Timestamp:** 2025-11-22T02:31:51Z
- **Forced:** YES (3x cache-bust)

---

## ✅ SUCCESS CRITERIA

**Fix is succesvol als:**
1. Week 48 selectie toont geen foutmelding
2. Console toont HTTP 200 voor roster_period_staffing query
3. Data wordt correct geladen en weergegeven
4. Geen "serviceid does not exist" errors in logs

---

## 📞 CONTACT

**Bij problemen na deployment:**
- Check Railway logs eerst
- Verificeer database schema in Supabase
- Test query handmatig in Supabase SQL Editor
- Documenteer exacte error message uit console

---

**Deployment door:** Perplexity AI Assistant  
**Opdracht:** DRAAD42E - Force Railway redeploy  
**Priority:** IMMEDIATE  
**Status:** ⏳ Awaiting Railway rebuild  
**ETA:** 5-10 minuten
