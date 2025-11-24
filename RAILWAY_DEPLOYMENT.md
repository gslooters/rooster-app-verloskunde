# 🚂 Railway Deployment Guide - Rooster App

## ✅ DEPLOYMENT DRAAD49 - CRITICAL FIXES

**Timestamp:** 2025-11-24T17:15:00Z  
**Status:** Ready for deployment

---

## 🔴 KRITIEKE FIXES TOEGEPAST

### 1. ✅ `middleware.ts` Toegevoegd (MISSING FILE!)
**Probleem:** Supabase Auth Helpers in Next.js 13+ vereisen `middleware.ts`  
**Oplossing:** Middleware toegevoegd met:
- Automatic token refresh
- Protected routes handling
- Session synchronization
- Redirect logic voor login/dashboard

**Locatie:** `/middleware.ts` (root level)

### 2. ✅ `package.json` Geoptimaliseerd
**Problemen:**
- Build script had `--no-lint` flag die build kon blokkeren
- Node version was `>=20.0.0` (te breed voor Railway)

**Oplossingen:**
```json
{
  "scripts": {
    "build": "next build && node scripts/postbuild.js"
  },
  "engines": {
    "node": "20.x",
    "npm": ">=10.0.0"
  }
}
```

### 3. ✅ `scripts/postbuild.js` Versterkt
**Toegevoegd:**
- Comprehensive error handling met exit codes
- Detailed logging voor debugging
- Verification van standalone build
- Railway-compatible error messages

### 4. ✅ Cache-Busting Verified
**Bestaande config in `next.config.js` is correct:**
- `generateBuildId()` met millisecond precision
- Webpack cache disabled in production
- ISR memory cache = 0

---

## 🚀 RAILWAY DEPLOYMENT CHECKLIST

### Pre-Deployment

- [x] **middleware.ts** bestaat (KRITIEK!)
- [x] **package.json** heeft exacte Node versie `20.x`
- [x] **scripts/postbuild.js** heeft error handling
- [x] **next.config.js** heeft `output: 'standalone'`
- [ ] **Environment variabelen** ingesteld in Railway dashboard

### Environment Variabelen (VERPLICHT!)

Ga naar Railway dashboard → Service → Variables tab en stel in:

```bash
# Supabase Configuration (VERPLICHT)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Optional: Server-side fallbacks
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Node Environment
NODE_ENV=production
```

⚠️ **ZONDER deze variabelen start de app NIET!**

### Railway Service Settings

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

**Region:** `eu-west` (Amsterdam - closest to NL)

**Health Check Path:** `/api/health`

---

## 📊 DEPLOYMENT MONITORING

### Build Logs Checklist

Kijk naar deze log entries voor success:

✅ **Stage 1: Install**
```
Node version: v20.x.x
```

✅ **Stage 2: Build**
```
✓ Creating an optimized production build
✓ Compiled successfully
```

✅ **Stage 3: Post-Build**
```
📦 [POSTBUILD] Starting post-build copy operations...
✅ [POSTBUILD] Static files copied successfully
✅ [POSTBUILD] Public files copied successfully
✅ [POSTBUILD] Server.js verified
🎉 [POSTBUILD] Post-build operations completed successfully!
```

✅ **Stage 4: Start**
```
Server listening on 0.0.0.0:3000
```

### Common Errors & Solutions

#### ❌ Error: "Module not found: middleware.ts"
**Oplossing:** Dit bestand moet nu aanwezig zijn na DRAAD49 fix

#### ❌ Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Oplossing:** Stel environment variabelen in via Railway dashboard

#### ❌ Error: "Static files not found"
**Oplossing:** Postbuild script moet runnen - check build logs

#### ❌ Error: "EADDRINUSE"
**Oplossing:** Gebruik `HOSTNAME=0.0.0.0` in start command

---

## 🔍 VERIFICATION STEPS

### 1. Check Deployment Status
```bash
# Via Railway CLI (optional)
railway status
```

### 2. Test Health Endpoint
```bash
curl https://your-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T17:15:00.000Z",
  "uptime": 123.456,
  "version": "0.1.0",
  "environment": "production"
}
```

### 3. Test Login Flow
```bash
# Navigate to app
https://your-app.railway.app/login

# Should:
# ✅ Show login page
# ✅ After login, redirect to /dashboard
# ✅ Protected routes require auth
```

### 4. Check Middleware
```bash
# Open browser DevTools → Network tab
# Navigate between pages
# Should see cookies being set/refreshed
```

---

## 📈 DEPLOYMENT HISTORY

### DRAAD49 (Current) - 2025-11-24
**Changes:**
- ✅ Added missing `middleware.ts`
- ✅ Fixed `package.json` build script
- ✅ Enhanced `postbuild.js` with error handling
- ✅ Verified cache-busting configuration

**Expected Result:** **BUILD SUCCESS** ✅

### DRAAD48 (Previous) - 2025-11-24
**Changes:**
- Cache-busting attempts
- Multiple deployment triggers

**Result:** Build failures due to missing middleware

---

## 🆘 TROUBLESHOOTING

### Railway Logs Not Showing?
```bash
# Via Railway CLI
railway logs

# Via Dashboard
https://railway.com/project/[project-id]/service/[service-id]
→ Deployments tab → Click on deployment → View logs
```

### Build Stuck?
1. Check Railway status page: https://status.railway.app/
2. Cancel deployment en retry
3. Check build timeout (default 10 min)

### Runtime Errors?
1. Check environment variabelen
2. Verify Supabase connection
3. Check middleware logs in Railway console

---

## 📞 SUPPORT

**Railway Documentation:**  
https://docs.railway.app/

**Next.js Standalone Mode:**  
https://nextjs.org/docs/app/api-reference/next-config-js/output

**Supabase Auth Helpers:**  
https://supabase.com/docs/guides/auth/auth-helpers/nextjs

---

## ✨ SUCCESS CRITERIA

✅ Build completes without errors  
✅ Server starts on 0.0.0.0:3000  
✅ Health check returns 200 OK  
✅ Login flow werkt correct  
✅ Protected routes redirecten naar login  
✅ Static assets laden (CSS/JS)  
✅ Supabase auth tokens refreshen automatisch  

---

**Deployment Status:** 🟢 **READY FOR PRODUCTION**

**Next Steps:**
1. Monitor Railway deployment logs
2. Test alle critical paths
3. Verify Supabase connectivity
4. Check performance metrics

---

_Generated for DRAAD49 deployment - 2025-11-24_
