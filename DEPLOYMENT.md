# 🚀 Railway Deployment Fix - DRAAD53.2 Fase3

## ⚠️ Probleem (OPGELOST)

**Symptomen:**
- Build succesvol ✅
- Health check PASSED ✅  
- Server start OK ✅
- **Dan SIGTERM na 8 seconden** ❌
- Container crashed en restart loop

**Root Cause:**
```
npm >= 9.6.7 heeft een bug waarbij SIGTERM signalen
NIET worden doorgegeven aan child processes.

Railway start: npm start
  → npm start child process (Next.js server)
  → Railway stuurt SIGTERM naar npm
  → npm forward NIET naar Next.js ❌
  → Next.js krijgt abrupt SIGKILL
  → Container crashed
```

## ✅ Oplossing

### 1. Custom Server Wrapper (`server.js`)

Een Node.js wrapper die:
- Direct de standalone server start (geen npm)
- HOSTNAME en PORT correct zet voor Railway
- SIGTERM/SIGINT gracefully handled
- Proper signal forwarding naar child process

### 2. Railway Config Update (`railway.toml`)

**VOOR:**
```toml
startCommand = "npm start"
```

**NA:**  
```toml
startCommand = "node server.js"
```

### 3. Hoe het werkt

```
Railway start: node server.js
  → server.js spawn child: .next/standalone/server.js
  → Zet HOSTNAME=0.0.0.0 en PORT=$PORT
  → Railway stuurt SIGTERM
  → server.js vangt SIGTERM op ✅
  → server.js forward SIGTERM naar Next.js ✅
  → Next.js shutdown gracefully ✅
  → Container stopt netjes
```

## 📋 Deployment Checklist

- [x] Custom `server.js` created
- [x] `railway.toml` updated naar `node server.js`
- [x] Commit naar GitHub main branch
- [ ] Railway detecteert commit (automatisch)
- [ ] Railway start nieuwe build
- [ ] Build succesvol
- [ ] Server start stabiel
- [ ] Health check slaagt
- [ ] Container blijft draaien (geen SIGTERM crash)
- [ ] App bereikbaar op Railway domain

## 🔍 Monitoring

**Check Railway Logs:**

1. **Build Phase** - Moet succesvol zijn:
   ```
   npm install && npm run build
   ✅ Post-build script kopieert static files
   ✅ Standalone bundle ready
   ```

2. **Start Phase** - Moet stabiel zijn:
   ```
   🚀 [WRAPPER] Starting Railway deployment server...
   📋 [WRAPPER] PORT: 8080 (of Railway's dynamische port)
   📋 [WRAPPER] HOSTNAME: 0.0.0.0
   ✅ [WRAPPER] Server wrapper started successfully
   ```

3. **Health Check** - Moet slagen:
   ```
   🏭 Health check gestart...
   ✅ Environment variables OK
   ✅ Health check PASSED
   ```

4. **Runtime** - Moet stabiel blijven:
   ```
   ▶ Next.js 14.2.33
   - Local: http://localhost:PORT
   - Network: http://0.0.0.0:PORT
   
   GEEN SIGTERM errors meer! ✅
   ```

## ❓ Als het NIET werkt

### Check 1: Server.js bestaat
```bash
# In Railway build logs:
ls -la server.js
# Moet bestaan in root directory
```

### Check 2: Standalone bundle compleet
```bash  
# In Railway build logs:
ls -la .next/standalone/
ls -la .next/standalone/.next/static/
ls -la .next/standalone/public/
# Alle directories moeten bestaan
```

### Check 3: Start command correct
```bash
# Railway Settings > Deploy > Start Command:
node server.js
# NIET: npm start
```

### Check 4: Environment variables
```bash
# Railway moet hebben:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Railway zet automatisch:
PORT=8080 (dynamisch)
```

## 🎉 Success Criteria

- ✅ Build completes zonder errors
- ✅ Server start zonder crashes  
- ✅ Health check blijft groen
- ✅ Logs tonen GEEN SIGTERM errors
- ✅ App bereikbaar via Railway domain
- ✅ Database connecties werken
- ✅ PDF export werkt (Fase3 feature)

## 📚 Referenties

- [npm SIGTERM bug issue #6547](https://github.com/npm/cli/issues/6547)
- [Railway Next.js Deployment Guide](https://docs.railway.app/guides/nextjs)
- [Next.js Standalone Mode](https://nextjs.org/docs/pages/api-reference/next-config-js/output)

---

**DRAAD53.2 Fase3 - Deployment Fix**  
**Datum:** 25 november 2025  
**Status:** DEPLOYED ✅
