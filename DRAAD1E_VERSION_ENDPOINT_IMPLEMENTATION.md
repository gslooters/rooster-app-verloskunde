# DRAAD1E - DEPLOYMENT VERSION VERIFICATIE ENDPOINT

**Datum:** 23 november 2025, 12:04 CET  
**Status:** ✅ GEÏMPLEMENTEERD  
**Commits:** 
- `3f35c311` - Version endpoint
- `cf4e0ff5` - Cache-bust bestand
- `b2bdc486` - Railway trigger
- `293ef6d7` - Global cache-bust update

---

## 🎯 DOEL

Los het **deployment verificatie probleem** op:
- **Probleem:** We weten niet welke code versie daadwerkelijk draait op Railway
- **Symptoom:** Fixes lijken gecommit, maar gedrag blijft hetzelfde
- **Oorzaak:** Mogelijk "stuck deployment" of cache issues
- **Oplossing:** Version endpoint die exact toont welke commit actief is

---

## 🔧 WAT IS GEÏMPLEMENTEERD

### 1. Version Endpoint
**Bestand:** `app/api/version/route.ts`  
**URL:** `https://your-app.railway.app/api/version`

**Response Format:**
```json
{
  "commit": "293ef6d778064d3d5e653c3ffee7b28a2728b66a",
  "shortCommit": "293ef6d7",
  "buildTime": "2025-11-23T11:04:17Z",
  "requestTime": "2025-11-23T12:05:00Z",
  "environment": "production",
  "platform": "railway",
  "nodeVersion": "v20.x.x",
  "nextVersion": "14.2.18",
  "expectedCommit": "63ea49ad",
  "isExpectedVersion": true,
  "railwayService": "rooster-app-verloskunde",
  "railwayEnvironment": "production",
  "supabaseConfigured": true,
  "cacheBustTime": 1732357535000,
  "cacheControl": "no-store, no-cache, must-revalidate"
}
```

### 2. Anti-Cache Headers
**Toegevoegd:**
```typescript
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

**Waarom:** Voorkomt dat browser/CDN oude responses cached

### 3. Railway Environment Variables Gebruikt
- `RAILWAY_GIT_COMMIT_SHA` - Volledige commit hash
- `RAILWAY_SERVICE_NAME` - Service naam
- `RAILWAY_ENVIRONMENT_NAME` - Environment (production/staging)
- `NODE_ENV` - Node environment

### 4. Validatie Logic
```typescript
const EXPECTED_COMMIT = '63ea49ad'; // Update bij elke deployment
const isExpectedVersion = shortCommit.startsWith(EXPECTED_COMMIT);
```

**Als `isExpectedVersion = false` → Deployment stuck!**

---

## 📊 GEBRUIK

### Stap 1: Wacht op Railway Deployment
1. Check Railway dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Kijk naar "Deployments" sectie
3. Wacht tot status = "SUCCESS" (groen vinkje)
4. Klik op deployment voor logs
5. Check laatste log regel: "Ready in XXms"

### Stap 2: Test Version Endpoint
**URL:** https://rooster-app-verloskunde-production.up.railway.app/api/version

**Via Browser:**
```
1. Open URL in nieuwe incognito window
2. Hard refresh (Ctrl+Shift+R of Cmd+Shift+R)
3. Check JSON response
```

**Via cURL:**
```bash
curl -H "Cache-Control: no-cache" \
     https://rooster-app-verloskunde-production.up.railway.app/api/version
```

**Via JavaScript:**
```javascript
fetch('/api/version', { 
  cache: 'no-store' 
})
  .then(r => r.json())
  .then(data => {
    console.log('🔍 Version Info:', data);
    console.log('✅ Correct version?', data.isExpectedVersion);
    console.log('💻 Commit:', data.shortCommit);
  });
```

### Stap 3: Interpreteer Response

**✅ DEPLOYMENT CORRECT:**
```json
{
  "shortCommit": "293ef6d7",
  "isExpectedVersion": true,
  "buildTime": "2025-11-23T11:04:17Z" (recente tijd)
}
```

**❌ STUCK DEPLOYMENT:**
```json
{
  "shortCommit": "63ea49ad", (oude commit!)
  "isExpectedVersion": false,
  "buildTime": "2025-11-22T20:00:00Z" (gisteren!)
}
```

**⚠️ CACHE PROBLEEM:**
```json
{
  "requestTime": "2025-11-23T12:05:00Z",
  "buildTime": "2025-11-23T11:04:17Z",
  "cacheBustTime": 1732357535000 (oud nummer)
}
```
→ Hard refresh browser!

---

## 🔍 VERIFICATIE CHECKLIST

### Railway Dashboard
- [ ] Nieuwe deployment gestart (binnen 1 minuut na commit)
- [ ] Build logs tonen geen errors
- [ ] Status = "SUCCESS"
- [ ] Timestamp deployment komt overeen met commit tijd
- [ ] "Ready in XXms" bericht verschijnt

### Version Endpoint
- [ ] `/api/version` bereikbaar (200 status)
- [ ] `commit` field bevat SHA `293ef6d7...`
- [ ] `isExpectedVersion` = `true`
- [ ] `buildTime` is recente timestamp (laatste 10 minuten)
- [ ] `environment` = `"production"`
- [ ] `supabaseConfigured` = `true`

### Health Check
- [ ] `/api/health` nog steeds werkend
- [ ] Response bevat `status: "healthy"`
- [ ] Database connectie OK

### Browser Testing
- [ ] Incognito/private window gebruikt
- [ ] Hard refresh gedaan (Shift+F5)
- [ ] Browser DevTools Network tab: geen 304 responses
- [ ] Response headers bevatten `Cache-Control: no-store`

---

## 🚫 BEKENDE VALKUILEN

### 1. Browser Cache
**Symptoom:** `commit` field toont oude SHA  
**Oplossing:**
```
1. Open DevTools (F12)
2. Network tab
3. Disable cache (checkbox bovenaan)
4. Hard refresh (Ctrl+Shift+R)
5. Of: Incognito window
```

### 2. Railway Build Vertraging
**Symptoom:** Commit zichtbaar op GitHub, maar niet op Railway  
**Oplossing:**
```
1. Check Railway dashboard
2. Kijk naar "Last updated" tijd
3. Als > 5 minuten geleden → mogelijk stuck
4. Trigger handmatige redeploy via Railway UI
```

### 3. Environment Variables Ontbreken
**Symptoom:** `commit: "unknown"` in response  
**Oplossing:**
```
1. Railway dashboard → Variables tab
2. Check RAILWAY_GIT_COMMIT_SHA is beschikbaar
3. Railway stelt dit automatisch in, geen actie nodig
4. Als ontbreekt → Railway support contacteren
```

### 4. EXPECTED_COMMIT Out of Date
**Symptoom:** `isExpectedVersion: false` maar deployment is correct  
**Oplossing:**
```typescript
// Update in app/api/version/route.ts
const EXPECTED_COMMIT = '293ef6d7'; // Update naar nieuwe SHA
```

---

## 🚀 TOEKOMSTIG GEBRUIK

### Bij Elke Deployment

**1. Voor commit:**
- Update `EXPECTED_COMMIT` in `route.ts` naar nieuwe SHA (optioneel)

**2. Na commit:**
```bash
# Wacht 2-3 minuten
# Test version endpoint
curl https://your-app.railway.app/api/version | jq '.isExpectedVersion'
# Verwacht: true
```

**3. Bij problemen:**
```bash
# Check welke commit draait
curl https://your-app.railway.app/api/version | jq '.shortCommit'

# Vergelijk met GitHub laatste commit
git log -1 --format=%h

# Als niet gelijk → stuck deployment!
```

### Dashboard Widget (Toekomstig)

Voeg toe aan admin dashboard:
```tsx
function DeploymentStatus() {
  const [version, setVersion] = useState(null);
  
  useEffect(() => {
    fetch('/api/version')
      .then(r => r.json())
      .then(setVersion);
  }, []);
  
  return (
    <div className="deployment-status">
      <h3>💻 Deployment Info</h3>
      <p>Commit: {version?.shortCommit}</p>
      <p>Status: {version?.isExpectedVersion ? '✅ Current' : '❌ Outdated'}</p>
      <p>Built: {version?.buildTime}</p>
    </div>
  );
}
```

---

## 🛡️ SECURITY OVERWEGINGEN

### Wat is Veilig Te Delen
✅ Commit SHA (openbaar op GitHub)  
✅ Build timestamp  
✅ Environment naam  
✅ Node/Next.js versies  

### Wat NIET Te Delen
❌ Database credentials  
❌ API keys  
❌ User data  
❌ Internal IP addresses  

Version endpoint bevat **geen gevoelige data**. Alle info is al publiek via GitHub of algemeen bekend.

---

## 🔗 GERELATEERDE COMMITS

| Commit | Bestand | Beschrijving |
|--------|---------|-------------|
| `3f35c311` | `app/api/version/route.ts` | Version endpoint implementatie |
| `cf4e0ff5` | `.cachebust-draad1e-version-endpoint` | Cache-bust file |
| `b2bdc486` | `.railway-trigger-draad1e-verification` | Railway trigger |
| `293ef6d7` | `.cachebust` | Global cache-bust update |

---

## 📝 VOLGENDE STAPPEN

### Direct (NU)
1. ✅ Version endpoint geïmplementeerd
2. ✅ Cache-busting bestanden aangemaakt
3. ✅ Railway trigger ingesteld
4. ⏳ **WACHTEN:** Railway build (2-3 minuten)
5. 🔍 **TESTEN:** `/api/version` endpoint

### Na Verificatie (Als Werkt)
- 📊 Test datum scherm bouwen (DRAAD1E Fase 3)
- 🔧 Fix "Diensten per Dagdeel" placeholder
- 📦 Deploy overige fixes (zondag bug, 8-dagen bug)

### Als Niet Werkt (Nuclear Option)
- 💣 Railway "Redeploy from Source"
- 🧹 Complete cache wipe
- 🔄 Fresh start deployment

---

## ✅ SUCCESS CRITERIA

**Deployment geslaagd als:**
1. `/api/version` bereikbaar
2. `commit` = `293ef6d7...`
3. `isExpectedVersion` = `true`
4. `buildTime` is recente timestamp
5. Response in < 500ms
6. Geen console errors

**Volgende fase starten als:**
- Alle success criteria voldaan
- Railway logs tonen geen warnings
- Health check blijft groen

---

**Geïmplementeerd door:** AI Assistant (Claude via Perplexity)  
**Code review:** Govard Slooters  
**Status:** ⏳ AWAITING RAILWAY DEPLOYMENT  
**Verwachte live tijd:** 23 november 2025, 12:07 CET  

---

**END OF DOCUMENT**
