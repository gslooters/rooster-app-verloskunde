# 🚨 DRAAD186: RAILWAY DEPLOYMENT - MANUAL SETUP REQUIRED

**Status**: 🔴 DEPLOYMENT BLOCKED - Environment Variables Not Set

**Date**: 2025-12-15T20:04:00Z  
**Issue**: Build failing because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` not injected at build time

---

## ⚠️ PROBLEM SUMMARY

Railway build process:
1. ✗ Environment variables NOT available during `npm run build`
2. ✗ Next.js requires `NEXT_PUBLIC_*` at build time
3. ✗ Fallback placeholder URL causes build failure
4. ✗ Error: `supabaseUrl is required`

---

## ✅ SOLUTION: Set Environment Variables in Railway

### Step 1: Access Railway Service Environment

1. Go to [Railway Project](https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f)
2. Click `rooster-app-verloskunde` service
3. Navigate to **"Variables"** tab (left sidebar)

### Step 2: Add Required Environment Variables

**Copy-paste these exactly:**

#### Variable 1: Supabase URL
```
Name:  NEXT_PUBLIC_SUPABASE_URL
Value: https://rzecogncpkjfytebfkni.supabase.co
```

#### Variable 2: Supabase Anon Key
```
Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [GET FROM SUPABASE DASHBOARD]
```

### Step 3: Find Your Supabase Anon Key

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/rzecogncpkjfytebfkni)
2. Navigate to **Settings** → **API**
3. Copy the **Anon Public** key (NOT the service role key)
4. Paste into Railway `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable

### Step 4: Trigger Rebuild

1. In Railway service, click **"Redeploy"** button
2. Wait for build to complete
3. Check logs for success message

---

## 🔍 VERIFICATION CHECKLIST

### In Railway Logs (after rebuild)

✅ Should see:
```
[inf] > rooster-app-final@0.1.5 build
[inf] > next build --no-lint
[inf] Creating an optimized production build ...
[inf] ✓ Compiled successfully
```

❌ Should NOT see:
```
❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is not defined!
 Error: supabaseUrl is required.
```

### In Application

1. Navigate to `/planning/rooster-ontwerpen`
2. Click "Nieuw rooster aanmaken"
3. Complete wizard → Should succeed
4. Check Supabase dashboard for new roster record

---

## 📋 TECHNICAL DETAILS

### How It Works

1. **railway.toml**: Specifies `command = "npm ci && npm run build"`
2. **Dockerfile**: Uses `ARG` and `ENV` to capture build args
3. **.env.production**: Template for Next.js build process
4. **lib/supabase.ts**: No fallback → error if vars missing

### Build Flow

```
Railway Environment Variables
        ↓
   npm ci (install)
        ↓
   npm run build (uses NEXT_PUBLIC_* from env)
        ↓
   Next.js embeds Supabase URL in compiled code
        ↓
   .next/standalone ready for deployment
```

---

## 🆘 TROUBLESHOOTING

### Build still fails with same error

**Issue**: Variables set but build still fails  
**Solution**:
1. Delete old build: Railway → Deployments → Delete failed builds
2. Redeploy: Click "Redeploy" button
3. Wait 30 seconds for fresh build

### Build succeeds but app crashes at runtime

**Issue**: App starts but endpoints 404  
**Solution**:
1. Check browser console for errors
2. Verify env vars in Railway dashboard
3. Check that anon key is correct (not service role key)

### Cannot find Supabase credentials

**Issue**: Lost Supabase project URL or key  
**Solution**:
1. Go to Supabase dashboard
2. Project list → Find `rzecogncpkjfytebfkni`
3. Settings → API → Copy Anon Public key

---

## 📝 COMMITS INCLUDED

| File | Change | Reason |
|------|--------|--------|
| `Dockerfile` | Added `ARG` for build variables | Pass env to Docker build |
| `railway.toml` | Simplified config | Let Railway inject env vars |
| `.env.production` | New file with template | Next.js build-time vars |
| `lib/supabase.ts` | No fallback URL | Force error if missing |
| `package.json` | Version bump | Cache invalidation |

---

## ✅ COMPLETION CHECKLIST

Before considering this DRAAD complete:

- [ ] NEXT_PUBLIC_SUPABASE_URL set in Railway
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY set in Railway
- [ ] Build successful (no errors in Railway logs)
- [ ] App deployed and running
- [ ] Rooster creation wizard works end-to-end
- [ ] New roster appears in Supabase dashboard
- [ ] No console errors in browser DevTools

---

**🎯 NEXT STEP**: Go to Railway dashboard and add the environment variables, then redeploy.

**Questions?** Check Railway logs at: https://railway.app/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
