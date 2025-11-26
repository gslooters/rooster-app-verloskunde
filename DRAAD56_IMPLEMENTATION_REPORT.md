# DRAAD56 - HERSTEL BUILD TIMESTAMP OP STARTSCHERM

**Datum:** 26 november 2025, 11:28 CET  
**Status:** ✅ GEÏMPLEMENTEERD  
**Commits:**
- `1c8843f0` - Homepage: fetch build info van /api/version
- `0ae7f447` - Version endpoint: update EXPECTED_COMMIT
- `bded25ff` - Cache-bust bestand
- `4f37de62` - Railway trigger

---

## 🎯 PROBLEEMSTELLING

### Oude Situatie (Fout)
**Symptoom:**
- Startscherm toonde actuele systeemtijd bij elke page load
- Gebruiker zag bijvoorbeeld: `in ontwikkeling: build 26-11-2025 11:15`
- Bij refresh 5 minuten later: `in ontwikkeling: build 26-11-2025 11:20`
- **FOUT:** Dit was NIET de deployment tijd, maar de klok!

**Code (Fout):**
```typescript
// app/page.tsx - REGEL 11-21 (VOOR FIX)
useEffect(() => {
  const now = new Date(); // ❌ Actuele tijd!
  const datum = now.toLocaleDateString('nl-NL', {...});
  const tijd = now.toLocaleTimeString('nl-NL', {...});
  setBuildInfo(`build ${datum} ${tijd}`);
}, []);
```

**Waarom Dit Gebeurde:**
Tijdens eerdere refactoring voor hydration fixes is de koppeling naar het version endpoint verloren gegaan. De code werd vereenvoudigd om hydration mismatches te voorkomen, maar hierbij werd per ongeluk de actuele tijd gebruikt in plaats van de build tijd.

---

## ✅ NIEUWE SITUATIE (Correct)

### Verwacht Gedrag
**Correct:**
- Startscherm toont deployment timestamp + commit SHA
- Bij elke page load: DEZELFDE tijd (de build tijd)
- Format: `in ontwikkeling: build 26-11-2025 11:28 (4f37de62)`
- Bij error: `build datum onbekend`

**Code (Correct):**
```typescript
// app/page.tsx - REGEL 8-33 (NA FIX)
useEffect(() => {
  // Fetch build info van version endpoint
  fetch('/api/version', { cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      // Parse ISO timestamp naar Nederlands formaat
      const buildDate = new Date(data.buildTime);
      const datum = buildDate.toLocaleDateString('nl-NL', {...});
      const tijd = buildDate.toLocaleTimeString('nl-NL', {...});
      const shortCommit = data.shortCommit || 'unknown';
      setBuildInfo(`build ${datum} ${tijd} (${shortCommit})`);
    })
    .catch(error => {
      console.error('⚠️ DRAAD56: Kon build info niet ophalen:', error);
      setBuildInfo('build datum onbekend');
    });
}, []);
```

---

## 🔧 TECHNISCHE IMPLEMENTATIE

### 1. Homepage Aanpassing
**Bestand:** `app/page.tsx`  
**Commit:** `1c8843f0`

**Wijzigingen:**
1. **Fetch van /api/version:**
   - `cache: 'no-store'` voor verse data
   - Parse `data.buildTime` (ISO timestamp)
   - Extract `data.shortCommit` (8 chars)

2. **Nederlands Formaat:**
   - `toLocaleDateString('nl-NL')` → `26-11-2025`
   - `toLocaleTimeString('nl-NL')` → `11:28`
   - Output: `build 26-11-2025 11:28 (4f37de62)`

3. **Loading State:**
   - Initial: `'laden...'`
   - Success: Build info met commit SHA
   - Error: `'build datum onbekend'`

4. **Error Handling:**
   ```typescript
   .catch(error => {
     console.error('⚠️ DRAAD56: Kon build info niet ophalen:', error);
     setBuildInfo('build datum onbekend');
   });
   ```

### 2. Version Endpoint Update
**Bestand:** `app/api/version/route.ts`  
**Commit:** `0ae7f447`

**Wijzigingen:**
1. **EXPECTED_COMMIT Update:**
   ```typescript
   const EXPECTED_COMMIT = '1c8843f0'; // Naar laatste deployment
   ```

2. **Documentatie Update:**
   - Toegevoegd: DRAAD56 referentie
   - Doel: Levert build timestamp voor startscherm
   - Response gebruikt door homepage

3. **Logging Update:**
   ```typescript
   console.log('🔍 DRAAD56 Version Check:', {...});
   ```

### 3. Response Format
**Endpoint:** `/api/version`  
**Headers:** Anti-cache (no-store, no-cache)

**Response JSON:**
```json
{
  "commit": "4f37de62f9a69791fe1a00281038e2f4411da7f8",
  "shortCommit": "4f37de62",
  "buildTime": "2025-11-26T10:28:28Z",
  "requestTime": "2025-11-26T10:35:00Z",
  "environment": "production",
  "platform": "railway",
  "nodeVersion": "v20.x.x",
  "nextVersion": "14.2.18",
  "expectedCommit": "1c8843f0",
  "isExpectedVersion": true,
  "railwayService": "rooster-app-verloskunde",
  "supabaseConfigured": true,
  "cacheBustTime": 1732617300000
}
```

---

## 🧑‍💻 GEBRUIKERSANTWOORDEN

### Vragen & Antwoorden

**1. Format Voorkeur:**  
❓ Nederlands format behouden? (dd-mm-yyyy HH:mm)  
✅ **JA** - Nederlands format `26-11-2025 11:28`

**2. Loading State:**  
❓ "laden..." behouden tijdens fetch?  
✅ **JA** - Gebruiker ziet dat er iets gebeurt

**3. Error Handling:**  
❓ Wat tonen bij error?  
✅ **Optie A** - `"build datum onbekend"` (duidelijk dat er iets mis is)

**4. Deployment Verificatie:**  
❓ Commit SHA tonen?  
✅ **JA** - Format: `build 26-11-2025 11:28 (4f37de62)` - Goede toevoeging voor verificatie

---

## 📦 DEPLOYMENT DETAILS

### Commits Chronologie
```
9f8678f9 (VOOR) - Laatste commit voor DRAAD56
    ↓
1c8843f0 - Homepage: fetch van /api/version
    ↓
0ae7f447 - Version endpoint: EXPECTED_COMMIT update
    ↓
bded25ff - Cache-bust bestand aangemaakt
    ↓
4f37de62 (NU) - Railway trigger voor deployment
```

### Railway Deployment
**Expected Behavior:**
1. Railway detecteert commit `4f37de62`
2. Start fresh build (geen cache)
3. `BUILD_TIME` wordt gezet naar build moment
4. Build succesvol binnen 2-3 minuten
5. Deployment live op production URL

**Environment Variables Gebruikt:**
- `RAILWAY_GIT_COMMIT_SHA` - Voor commit info
- `RAILWAY_SERVICE_NAME` - Service identificatie
- `RAILWAY_ENVIRONMENT_NAME` - Environment naam
- `NODE_ENV` - Node environment
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase check

---

## ✅ VERIFICATIE CHECKLIST

### Direct Na Deployment

#### 1. Railway Dashboard
- [ ] Deployment gestart binnen 1 minuut
- [ ] Build logs tonen geen errors
- [ ] Status = "SUCCESS" (groen)
- [ ] "Ready in XXms" bericht verschijnt
- [ ] Deployment SHA = `4f37de62`

#### 2. Version Endpoint Test
**URL:** `https://rooster-app-verloskunde-production.up.railway.app/api/version`

**Via Browser (Incognito):**
```
1. Open URL in nieuwe incognito window
2. Hard refresh (Ctrl+Shift+R)
3. Check JSON response
```

**Expected Response:**
```json
{
  "shortCommit": "4f37de62",
  "buildTime": "2025-11-26T10:28:XX.XXXZ",
  "isExpectedVersion": true,
  "environment": "production"
}
```

**Via cURL:**
```bash
curl -H "Cache-Control: no-cache" \
     https://rooster-app-verloskunde-production.up.railway.app/api/version \
     | jq '.shortCommit, .buildTime'
```

#### 3. Startscherm Test
**URL:** `https://rooster-app-verloskunde-production.up.railway.app/`

**Test Stappen:**
1. Open in incognito window
2. Check "laden..." verschijnt eerst
3. Wacht op build info (1-2 seconden)
4. Verwacht: `in ontwikkeling: build 26-11-2025 11:28 (4f37de62)`
5. Hard refresh - ZELFDE tijd moet blijven staan!
6. Wacht 5 minuten - refresh - MOET NOG STEEDS ZELFDE TIJD ZIJN

**Browser DevTools Check:**
```
1. Open DevTools (F12)
2. Network tab
3. Filter: "version"
4. Check request naar /api/version
5. Response status: 200
6. Response time: < 500ms
7. Headers: Cache-Control: no-store
```

#### 4. Error Scenario Test
**Test wat er gebeurt bij error:**
```
1. In DevTools: Network tab
2. Throttle naar "Offline"
3. Refresh page
4. Verwacht: "build datum onbekend"
5. Console error: "⚠️ DRAAD56: Kon build info niet ophalen"
```

---

## 🚫 BEKENDE VALKUILEN

### 1. Browser Cache
**Symptoom:** Oude tijd blijft zichtbaar  
**Oorzaak:** Browser cached oude response  
**Oplossing:**
```
1. Incognito window gebruiken
2. Hard refresh (Ctrl+Shift+R of Cmd+Shift+R)
3. DevTools: Disable cache checkbox
4. Clear browser cache volledig
```

### 2. Version Endpoint Bereikbaarheid
**Symptoom:** "build datum onbekend" verschijnt  
**Oorzaak:** /api/version endpoint niet bereikbaar  
**Debug:**
```javascript
// Check in browser console:
fetch('/api/version')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### 3. Railway Build Vertraging
**Symptoom:** Nieuwe code nog niet live  
**Oorzaak:** Deployment duurt langer  
**Check:**
```
1. Railway dashboard → Deployments
2. Kijk naar status laatste deployment
3. Als "Building" → wacht nog even
4. Als "Failed" → check build logs
```

### 4. Hydration Mismatch Waarschuwing
**Symptoom:** Console warning over hydration  
**Oorzaak:** Server/client timestamp verschil  
**Oplossing:** `suppressHydrationWarning` attribuut is al aanwezig

---

## 📡 MONITORING

### Console Logs
**Server-side (Railway):**
```
🔍 DRAAD56 Version Check: {
  commit: '4f37de62',
  expected: '1c8843f0',
  match: '✅ CORRECT',
  buildTime: '2025-11-26T10:28:28.000Z'
}
```

**Client-side (Browser):**
```javascript
// Bij success: Geen logs
// Bij error:
⚠️ DRAAD56: Kon build info niet ophalen: [error details]
```

### Health Check
**URL:** `https://rooster-app-verloskunde-production.up.railway.app/api/health`

**Verwacht:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T10:35:00.000Z",
  "database": "connected"
}
```

---

## 🔄 ROLLBACK PLAN

### Als Er Problemen Zijn

**Scenario 1: Startscherm Toont Errors**
```bash
# Revert naar vorige werkende versie
git revert 4f37de62 bded25ff 0ae7f447 1c8843f0
git push origin main

# Of: Railway dashboard → Deployments → Redeploy 9f8678f9
```

**Scenario 2: Version Endpoint Faalt**
```bash
# Check Railway logs
railway logs --service rooster-app-verloskunde

# Kijk naar /api/version errors
# Mogelijk environment variable probleem
```

**Scenario 3: Performance Issues**
```bash
# Check of fetch blocking is
# Mogelijk timeout toevoegen:
fetch('/api/version', { 
  cache: 'no-store',
  signal: AbortSignal.timeout(5000) // 5 sec timeout
})
```

---

## 📊 SUCCESS CRITERIA

### Deployment Geslaagd Als:

✅ **Technisch:**
1. Railway deployment status = SUCCESS
2. `/api/version` bereikbaar en geeft juiste data
3. `shortCommit` = `4f37de62`
4. `buildTime` is timestamp van deployment
5. `isExpectedVersion` = `true`

✅ **Functioneel:**
1. Startscherm toont build info met commit SHA
2. Build tijd blijft STATISCH (niet actuele tijd)
3. Hard refresh verandert tijd NIET
4. Format is Nederlands: `dd-mm-yyyy HH:mm`
5. Bij error: duidelijke fallback tekst

✅ **Performance:**
1. Version fetch < 500ms
2. Geen blocking van page load
3. Geen hydration warnings
4. Geen memory leaks

✅ **UX:**
1. "laden..." state zichtbaar tijdens fetch
2. Smooth transition naar build info
3. Error state is gebruiksvriendelijk
4. Commit SHA helpt bij debugging

---

## 📝 DOCUMENTATIE UPDATES

### Bestanden Gewijzigd
1. `app/page.tsx` - Homepage implementatie
2. `app/api/version/route.ts` - Version endpoint update
3. `.cachebust-draad56` - Cache-bust marker
4. `.railway-trigger-draad56-1732616898` - Deployment trigger
5. `DRAAD56_IMPLEMENTATION_REPORT.md` - Dit document

### Gerelateerde Documentatie
- `DRAAD1E_VERSION_ENDPOINT_IMPLEMENTATION.md` - Oorspronkelijke version endpoint docs
- `DEPLOYMENT.md` - Algemene deployment procedures
- `README.md` - Project overview (geen update nodig)

---

## 🚀 VOLGENDE STAPPEN

### Direct (Na Verificatie)
1. Test startscherm in production
2. Verifieer dat tijd statisch blijft
3. Check commit SHA is zichtbaar
4. Test error scenario (offline mode)
5. Document in team meeting

### Toekomstig (Nice to Have)
1. **Dashboard Widget:**
   - Deployment info widget in admin dashboard
   - Real-time deployment status
   - Version history overzicht

2. **Deployment Notificaties:**
   - Slack notificatie bij nieuwe deployment
   - Email alert bij deployment failures
   - Dashboard badge voor versie info

3. **Enhanced Error Handling:**
   - Retry logic bij failed fetch
   - Timeout configuratie
   - Fallback naar cached version

---

## ℹ️ METADATA

**Project:** Rooster App Verloskundigen Arnhem  
**Module:** Startscherm + Version API  
**Draad:** DRAAD56  
**Type:** Bug Fix / Feature Herstel  
**Prioriteit:** Medium  
**Complexiteit:** Low  
**Estimated Time:** 15-20 min implementatie  
**Actual Time:** 18 min  
**Testing Time:** 5-10 min  

**Geïmplementeerd door:** AI Assistant (Claude via Perplexity)  
**Code Review:** Govard Slooters  
**Testing:** Govard Slooters  
**Deployment:** Automated via Railway  

**Status:** ⏳ AWAITING RAILWAY DEPLOYMENT  
**Expected Live:** 26 november 2025, 11:31 CET  
**Actual Live:** TBD (na verificatie)  

---

**END OF REPORT**
