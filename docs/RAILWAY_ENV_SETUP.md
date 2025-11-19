# Railway Environment Variables Setup Guide

## 🎯 Probleem

De week detail pagina toont "Geen Data" omdat de server-side code geen toegang heeft tot Supabase.

**Root Cause**: Server-side code gebruikt `NEXT_PUBLIC_*` environment variables die niet werken in server context.

## ✅ Oplossing

Voeg **server-side** environment variables toe aan Railway (zonder `NEXT_PUBLIC_` prefix).

---

## 📋 Stap-voor-Stap Instructies

### STAP 1: Open Railway Dashboard

1. Ga naar: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Log in met je Railway account
3. Selecteer het project: **rooster-app-verloskunde**

### STAP 2: Navigeer naar Service Variables

1. Klik op je service in de lijst (rooster-app-verloskunde-production)
2. Klik op **"Variables"** tab in het linker menu
3. Je ziet nu de bestaande environment variables

### STAP 3: Voeg Server-Side Variables Toe

**BELANGRIJK**: Kopieer de EXACTE waarden van je bestaande `NEXT_PUBLIC_*` variables.

#### Huidige Variables (Client-Side):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://rzecogncpkjfytebfkni.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Nieuwe Variables Toevoegen (Server-Side):

1. Klik op **"+ New Variable"** knop
2. Voeg toe:
   ```
   Variable Name: SUPABASE_URL
   Value: https://rzecogncpkjfytebfkni.supabase.co
   ```
3. Klik op **"+ New Variable"** knop (opnieuw)
4. Voeg toe:
   ```
   Variable Name: SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**LET OP**:
- Gebruik EXACT dezelfde waarden als `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Maar ZONDER het `NEXT_PUBLIC_` prefix
- De waarden blijven identiek, alleen de namen veranderen

### STAP 4: Review Staged Changes

Na het toevoegen van de variables:

1. Railway toont een **"Staged Changes"** banner bovenaan
2. Je ziet:
   ```
   + SUPABASE_URL
   + SUPABASE_ANON_KEY
   ```
3. Klik op **"Deploy"** om de changes toe te passen

### STAP 5: Wacht op Deployment

1. Railway start automatisch een nieuwe deployment
2. De deployment status wordt getoond in de dashboard
3. Wacht tot status **"Success"** is (groen vinkje)
4. Dit duurt ongeveer 1-2 minuten

---

## 🔍 Verificatie

### Check 1: Environment Variables

Controleer of de variables correct zijn toegevoegd:

1. Ga naar **Variables** tab
2. Je moet nu **4** environment variables zien:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL` (client-side)
   - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side)
   - ✅ `SUPABASE_URL` (server-side) **NIEUW**
   - ✅ `SUPABASE_ANON_KEY` (server-side) **NIEUW**

### Check 2: Deployment Logs

Controleer de deployment logs:

1. Klik op **"Deployments"** tab
2. Klik op de laatste deployment (groene status)
3. Klik op **"View Logs"**
4. Zoek naar:
   ```
   ✅ Server-side Supabase client initialized
      URL: https://rzecogncpkjfytebfkni.supabase.co
      Key: eyJhbGciOiJIUzI1NiIs...
   ```

### Check 3: Week Detail Pagina

Test de week detail pagina:

1. Open de app: https://rooster-app-verloskunde-production.up.railway.app
2. Klik op **"Dashboard"**
3. Klik op een week (bijv. Week 48)
4. De pagina moet nu data tonen in plaats van "Geen Data"

### Check 4: Browser Console Logs

Open browser console (F12) en zoek naar:

**VERWACHT** (met `[SERVER]` prefix):
```javascript
🔍 [SERVER] Fetching week 48/2025 data: 2025-11-24 to 2025-11-30
🔍 [SERVER] Roster ID: 9c4c01d4-3ff2-4790-a569-a4a25380da39
✅ [SERVER] Roster found: { id: '...', start: '...', end: '...' }
✅ [SERVER] Fetched 7 period records
✅ [SERVER] Total dagdelen records: 504
✅ [SERVER] Built 7 days with dagdelen data
✅ [SERVER] Returning week dagdelen data: { ... }
```

**NIET VERWACHT** (geen `[SERVER]` logs = environment variables NIET werkend):
```javascript
📊 Week 48: 504 dagdelen records gevonden
📊 Week 49: 504 dagdelen records gevonden
```

---

## 🚨 Troubleshooting

### Probleem: "Geen Data" blijft verschijnen

**Oplossing 1**: Controleer environment variable namen
- Moeten EXACT zijn: `SUPABASE_URL` en `SUPABASE_ANON_KEY`
- GEEN `NEXT_PUBLIC_` prefix
- GEEN typfouten

**Oplossing 2**: Controleer environment variable waarden
- Moeten IDENTIEK zijn aan `NEXT_PUBLIC_*` waarden
- Kopieer/plak om typfouten te voorkomen

**Oplossing 3**: Force redeploy
1. Ga naar **Deployments** tab
2. Klik op laatste deployment
3. Klik op **"..."** (options)
4. Klik op **"Redeploy"**

### Probleem: Deployment faalt

**Oplossing**: Check build logs
1. Ga naar **Deployments** tab
2. Klik op failed deployment (rode status)
3. Klik op **"Build Logs"** tab
4. Zoek naar errors

### Probleem: Geen `[SERVER]` logs in console

**Diagnose**: Server-side code wordt niet uitgevoerd

**Oplossing**:
1. Controleer of environment variables correct zijn
2. Controleer Railway logs (niet browser console)
3. Redeploy de applicatie

---

## 📊 Environment Variables Overview

| Variable | Gebruik | Waar | Verplicht |
|----------|---------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side (browser) | Frontend components | ✅ Ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side (browser) | Frontend components | ✅ Ja |
| `SUPABASE_URL` | Server-side (API, SSR) | Server Components, API routes | ✅ Ja |
| `SUPABASE_ANON_KEY` | Server-side (API, SSR) | Server Components, API routes | ✅ Ja |

**Waarom twee sets?**
- Next.js maakt onderscheid tussen client-side en server-side code
- `NEXT_PUBLIC_*` variables worden gebundeld in frontend JavaScript (zichtbaar voor gebruikers)
- Server-side variables blijven privé en worden NOOIT naar de browser gestuurd
- Voor Supabase gebruiken we dezelfde waarden omdat we dezelfde database benaderen

---

## ✅ Checklist

Voor deployment:
- [ ] `SUPABASE_URL` toegevoegd aan Railway
- [ ] `SUPABASE_ANON_KEY` toegevoegd aan Railway
- [ ] Waarden gekopieerd van `NEXT_PUBLIC_*` variables
- [ ] Staged changes deployed
- [ ] Deployment success status (groen)
- [ ] Deployment logs tonen "Server-side Supabase client initialized"
- [ ] Week detail pagina toont data
- [ ] Browser console toont `[SERVER]` logs

---

## 📖 Referenties

- [Railway Variables Documentation](https://docs.railway.com/guides/variables)
- [Railway Deployment Logs](https://docs.railway.com/guides/logs)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Supabase Server-Side Client](https://supabase.com/docs/guides/auth/server-side-rendering)

---

**Laatste Update**: 19 november 2025
**Status**: Production Ready ✅
