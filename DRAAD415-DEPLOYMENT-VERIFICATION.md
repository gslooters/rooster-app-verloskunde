# DRAAD415 - Deployment Verificatie Instructies

## 📦 Deployment Details

**Datum:** 14 januari 2026, 16:14 CET  
**Issue:** AFL-scherm toont HTTP 404 bij laden ontbrekende diensten  
**Commits:**
- `c1917f593c99` - Route.ts update met DRAAD415 marker
- `1c6ba665828f` - Railway deployment trigger

**Wijzigingen:**
1. ✅ Enhanced `src/app/api/afl/missing-services/route.ts`
2. ✅ DRAAD415 runtime verification marker toegevoegd
3. ✅ Startup logging voor Railway zichtbaarheid
4. ✅ Cache-bust timestamp: 2026-01-14T16:13:00Z
5. ✅ Railway deployment trigger file aangemaakt

---

## 🔍 Verificatie Stap 1: Railway Build Logs

### Na Git Push - Controleer Railway Build Start

**Railway Dashboard:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

**Verwacht in Build Logs:**
```
Starting build...
Detected Next.js application
Running: npm run build
Building production bundle...
Compiling /api/afl/missing-services/route.ts
✅ Compiled successfully
```

**LET OP:** Zoek naar:
- ✅ `Compiling /api/afl/missing-services` - Route wordt gebuild
- ❌ GEEN errors over missing modules
- ❌ GEEN TypeScript compilation errors

---

## 🚀 Verificatie Stap 2: Railway Runtime Logs

### Na Deployment - Controleer Application Startup

**Verwachte Log Output bij Start:**

```
================================================================================
🚀 [DRAAD415] MISSING SERVICES API ROUTE LOADED
📍 [DRAAD415] Route path: /api/afl/missing-services
⏰ [DRAAD415] Load timestamp: 2026-01-14T16:14:...
🔖 [DRAAD415] Marker: DRAAD415-MISSING-SERVICES-1737018852...
🏗️  [DRAAD415] Runtime: nodejs
🔄 [DRAAD415] Dynamic: force-dynamic
================================================================================

[MISSING-SERVICES] ✅ Missing services route loaded at: 2026-01-14T16:14:...
```

### Verificatie Checklist:

- [ ] 🚀 DRAAD415 header zichtbaar in logs
- [ ] 🔖 Unieke marker ID getoond
- [ ] ⏰ Correcte timestamp (matches deployment tijd)
- [ ] 🏗️ Runtime = nodejs
- [ ] 🔄 Dynamic = force-dynamic

**Als NIET zichtbaar:**
- Route is niet geladen in build output
- Next.js heeft route uitgesloten
- Mogelijke oorzaak: Build cache niet cleared

---

## 🧪 Verificatie Stap 3: API Endpoint Test

### Direct API Test via cURL of Postman

**Endpoint:** `https://[railway-domain]/api/afl/missing-services`

**Test 1: POST Request**

```bash
curl -X POST https://rooster-app-verloskunde-production.up.railway.app/api/afl/missing-services \
  -H "Content-Type: application/json" \
  -d '{
    "roster_id": "649ec528-a842-4c55-a416-e1b7574cb596"
  }'
```

**Verwacht Response:**
```json
{
  "success": true,
  "roster_id": "649ec528-a842-4c55-a416-e1b7574cb596",
  "total_missing": 7,
  "missing_services": [
    {
      "date": "2026-02-03",
      "dagdeel": "M",
      "team": "A",
      "dienst_code": "DIA",
      "ontbrekend_aantal": 2
    }
  ],
  "grouped_by_date": {
    "2026-02-03": {
      "date": "2026-02-03",
      "date_formatted": "Dinsdag 3 februari 2026",
      "total_missing": 7,
      "services": [...]
    }
  }
}
```

**Status Codes:**
- ✅ `200 OK` - Route werkt correct
- ❌ `404 Not Found` - Route niet geladen in build
- ❌ `400 Bad Request` - roster_id ontbreekt
- ❌ `500 Internal Server Error` - Database/Supabase fout

**Test 2: GET Request (Fallback)**

```bash
curl "https://rooster-app-verloskunde-production.up.railway.app/api/afl/missing-services?roster_id=649ec528-a842-4c55-a416-e1b7574cb596"
```

---

## 🖥️ Verificatie Stap 4: Frontend UI Test

### In Browser - Test AFL Rapport Modal

**Stappen:**
1. Open applicatie in browser
2. Maak of open een rooster (Week 6 t/m Week 10)
3. Voer AFL-pijplijn uit
4. Wacht tot AFL-execution compleet is
5. Klik op "Rapport" knop
6. **CONTROLEER:**

**Verwacht in AFL Report Modal:**

```
📋 Detailoverzicht Ontbrekende Diensten

📅 Dinsdag 3 februari 2026              [7 diensten]
  🌅 Ochtend | Team A | DIA | 2 nodig
  🌆 Avond   | Team B | DIO | 3 nodig
  ...
```

**OF indien geen ontbrekende diensten:**

```
📋 Detailoverzicht Ontbrekende Diensten

✅ Alle diensten zijn ingevuld!
Geen nog in te vullen diensten - het rooster is compleet.
```

**NIET verwacht (= FOUT):**

```
📋 Detailoverzicht Ontbrekende Diensten

❌ Fout bij laden
HTTP 404: [foutmelding]
```

### Browser Console Logs

**Open Developer Tools → Console**

**Verwacht:**
```javascript
[AFL-REPORT] Fetching missing services for roster: 649ec528-a842...
[AFL-REPORT] Missing services loaded: 7
```

**NIET verwacht:**
```javascript
[AFL-REPORT] Error fetching missing services: HTTP 404:
Failed to load resource: the server responded with a status of 404
```

---

## 📊 Verificatie Stap 5: Railway Log Monitoring

### Real-time Request Logging

**Na Frontend Test - Controleer Railway Logs:**

**Verwacht bij API Call:**

```
================================================================================
[MISSING-SERVICES] 📋 Missing services request started
[MISSING-SERVICES] 🔄 Cache ID: 1737018852-4523
[MISSING-SERVICES] 🕐 Timestamp: 2026-01-14T16:15:35.234Z
[DRAAD415] 🔖 Route is active and responding
[MISSING-SERVICES] 📥 Received roster_id: 649ec528-a842...
[MISSING-SERVICES] 🔍 Starting query for roster: 649ec528-a842...
[MISSING-SERVICES] 🔍 Executing direct database query...
[MISSING-SERVICES] ✅ Direct query successful - got 35 records
[MISSING-SERVICES] 📊 Filtered to 7 rows with ontbrekend > 0
[MISSING-SERVICES] ✅ Data sorted - 7 records total
[MISSING-SERVICES] ✅ Grouped into 3 dates
[MISSING-SERVICES] 📊 Total missing: 7
================================================================================
```

---

## ✅ Success Criteria

### Deployment is Succesvol als:

1. ✅ Railway startup logs tonen DRAAD415 markers
2. ✅ API endpoint test returns 200 OK met data
3. ✅ Frontend toont detail sectie (geen 404 error)
4. ✅ Browser console toont "Missing services loaded: X"
5. ✅ Railway request logs tonen database query success

### Deployment Faalt als:

1. ❌ Geen DRAAD415 markers in startup logs
2. ❌ API endpoint test returns 404
3. ❌ Frontend toont "Fout bij laden HTTP 404"
4. ❌ Browser console toont fetch error
5. ❌ Railway logs tonen GEEN request logging

---

## 🔧 Troubleshooting

### Scenario 1: Route Nog Steeds 404

**Diagnose:**
```bash
# Controleer Railway build output
railway logs --deployment [deployment-id] | grep "missing-services"

# Controleer Next.js build manifest
# In Railway shell:
cat .next/build-manifest.json | grep "missing-services"
```

**Oplossing A: Force Cache Clear**
```bash
# In Railway dashboard:
1. Settings → Clear Build Cache
2. Redeploy from branch
```

**Oplossing B: Alternatieve Route**
```typescript
// Voeg toe aan src/app/api/afl/route.ts:
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  if (action === 'missing-services') {
    // Kopieer logica van missing-services/route.ts
  }
}

// Frontend update:
const url = `/api/afl?action=missing-services&roster_id=${rosterId}`;
```

### Scenario 2: Route Werkt maar Data Leeg

**Diagnose:**
- Controleer Railway logs voor database query errors
- Test Supabase credentials
- Controleer roster_id geldigheid

**Oplossing:**
```sql
-- Test query in Supabase SQL Editor:
SELECT 
  date, dagdeel, team, aantal, invulling,
  service_types.code
FROM roster_period_staffing_dagdelen
JOIN service_types ON service_types.id = service_id
WHERE roster_id = '649ec528-a842-4c55-a416-e1b7574cb596'
  AND service_id IS NOT NULL
  AND (aantal - COALESCE(invulling, 0)) > 0;
```

### Scenario 3: Frontend Toont Niet de Data

**Diagnose:**
- Open Browser DevTools → Network tab
- Zoek naar `/api/afl/missing-services` request
- Controleer response body

**Mogelijke Oorzaken:**
- Frontend code cached (hard refresh: Ctrl+Shift+R)
- Response format mismatch
- React state update issue

---

## 📅 Rollback Plan

### Als Deployment Faalt:

**Optie 1: Revert Commits**
```bash
git revert 1c6ba665828f5a57d9bfaacc325928f580db4a52
git revert c1917f593c9944e8fe2c5155714d2ff31fc2ea63
git push origin main
```

**Optie 2: Railway Redeploy Previous Build**
```
1. Railway Dashboard → Deployments
2. Find previous successful deployment (commit 7f776938)
3. Click "Redeploy"
```

**Optie 3: Temporary Workaround in Frontend**
```typescript
// In AflReportModal.tsx:
const missingServices = null; // Disable feature temporarily
setErrorMissing('Feature tijdelijk uitgeschakeld');
```

---

## 📝 Post-Deployment Checklist

- [ ] Railway build completed zonder errors
- [ ] DRAAD415 markers zichtbaar in startup logs
- [ ] API endpoint test succesvol (200 OK)
- [ ] Frontend toont detail sectie correct
- [ ] Geen 404 errors in browser console
- [ ] Railway request logs tonen database queries
- [ ] PDF export werkt correct
- [ ] Print functionaliteit werkt
- [ ] Verschillende roosters getest
- [ ] Edge cases getest (0 missing, veel missing)

---

## 📨 Rapportage Template

**Na Verificatie - Stuur Update:**

```
DRAAD415 Deployment Verificatie
================================

Status: ✅ SUCCES / ❌ GEFAALD

Timestamp: [datum/tijd]
Deployment ID: [railway deployment id]
Commit: 1c6ba665828f5a57d9bfaacc325928f580db4a52

Verificatie Resultaten:
- Railway Build: ✅/❌
- Startup Logs: ✅/❌  
- API Test: ✅/❌ [response code]
- Frontend UI: ✅/❌
- Request Logs: ✅/❌

Opmerkingen:
[eventuele issues of waarnemingen]

Volgende Stappen:
[wat te doen als gefaald, of afsluiting als geslaagd]
```

---

## 🎉 Success!

Als alle verificatie stappen slagen:

1. ✅ Issue DRAAD415 is opgelost
2. ✅ AFL-rapport toont ontbrekende diensten detail
3. ✅ PDF export werkt correct
4. ✅ Gebruikers kunnen nu volledige planning info zien

**Close Issue en Documenteer in CHANGELOG**

---

**Verificatie uitgevoerd door:** _______________________  
**Datum:** _______________________  
**Resultaat:** ✅ GESLAAGD / ❌ GEFAALD  
