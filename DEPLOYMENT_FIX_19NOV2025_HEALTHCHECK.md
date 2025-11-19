# Deployment Fix: Railway Healthcheck Probleem Opgelost (19 nov 2025)

## Probleem
Railway healthcheck faalde continu met "service unavailable" ondanks succesvolle build.

## Root Cause Analyse

### 1. Network Binding Probleem
- Next.js standalone server.js luisterde standaard op `localhost` (127.0.0.1)
- Railway healthcheck probeert verbinding te maken via container netwerk
- Container netwerk vereist binding op `0.0.0.0` (alle interfaces)

### 2. Healthcheck Path
- Railway checkte `/` wat een complexe React page is
- Betere optie: dedicated `/api/health` endpoint

## Geïmplementeerde Fixes

### Fix 1: HOSTNAME Environment Variable
**File:** `package.json`
```json
{
  "scripts": {
    "start": "HOSTNAME=0.0.0.0 node .next/standalone/server.js"
  }
}
```

**Waarom dit werkt:**
- Next.js standalone `server.js` ondersteunt `HOSTNAME` environment variable
- `0.0.0.0` betekent: luister op alle netwerk interfaces
- Railway kan nu de container bereiken via interne netwerk routing

### Fix 2: Dedicated Health Endpoint
**File:** `app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'rooster-app-verloskunde'
    },
    { status: 200 }
  );
}
```

**Voordelen:**
- Simpele endpoint, geen complex rendering
- Snelle response time
- Railway best practice

### Fix 3: Postbuild Script Blijft Bestaan
**File:** `scripts/postbuild.js`
- Kopieert `.next/static` naar standalone
- Kopieert `public` folder naar standalone
- Noodzakelijk voor static assets in standalone mode

## Railway Configuratie

### Vereiste Instellingen in Railway Dashboard:

1. **Service Settings → Healthcheck Path**
   ```
   /api/health
   ```

2. **Service Settings → Healthcheck Timeout**  
   Laat op default (300 seconden) of verhoog indien nodig

3. **Environment Variables**  
   Railway injecteert automatisch:
   - `PORT` → wordt gebruikt door Next.js standalone
   - Geen extra configuratie nodig!

## Deployment Workflow

1. **Build Process:**
   ```bash
   npm ci                                    # Install dependencies
   npm run build                             # Build + postbuild script
   ```

2. **Build Output:**
   ```
   .next/standalone/
   ├── server.js                            # Main server
   ├── .next/
   │   └── static/                          # Static assets (gekopieerd)
   └── public/                              # Public files (gekopieerd)
   ```

3. **Start Process:**
   ```bash
   HOSTNAME=0.0.0.0 node .next/standalone/server.js
   ```

4. **Railway Healthcheck:**
   - Railway stuurt GET request naar `/api/health`
   - Verwacht 200 OK response
   - Bij success → deployment wordt actief
   - Bij failure → deployment faalt

## Verificatie

Na deployment succesvol is:

### Test Health Endpoint
```bash
curl https://jouw-app.railway.app/api/health
```

Verwachte response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T23:30:00.000Z",
  "service": "rooster-app-verloskunde"
}
```

### Test Root Page
```bash
curl https://jouw-app.railway.app/
```

Moet de homepage tonen.

## Technische Details

### Waarom HOSTNAME=0.0.0.0?

- **Container Networking:** Docker/Railway containers hebben intern netwerk
- **127.0.0.1 (localhost):** Alleen bereikbaar BINNEN container zelf
- **0.0.0.0:** Bereikbaar via container netwerk interface
- Railway healthcheck komt VIA container netwerk, niet localhost

### Next.js Standalone Mode

Next.js documentatie:
> "If your project needs to listen to a specific port or hostname, you can define PORT or HOSTNAME environment variables before running server.js"

Bron: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output

## Fouten die NIET werkten

❌ Custom `server.js` in root → Conflicteert met standalone mode  
❌ Alleen `PORT` variable → Server luistert nog steeds op localhost  
❌ Healthcheck op `/` → Te complex, langzame response  
❌ Middleware toevoegen → Niet nodig voor network binding  

## Commits

1. `14d432cf` - fix(railway): Update start command met HOSTNAME=0.0.0.0
2. `f2f5f8f3` - feat(railway): Voeg /api/health endpoint toe

## Next Steps

✅ Configureer Railway healthcheck path naar `/api/health`  
✅ Monitor deployment logs  
✅ Verifieer dat app bereikbaar is  
✅ Test alle functionaliteiten  

## Support

Als deployment nog steeds faalt:
1. Check Railway logs voor error messages
2. Verifieer dat healthcheck path correct is ingesteld
3. Test `/api/health` endpoint handmatig
4. Controleer environment variables in Railway
