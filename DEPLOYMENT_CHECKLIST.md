# 📝 DEPLOYMENT CHECKLIST - DRAAD162B

## ✅ Completed Fixes

- [x] TypeScript type error fixed (DagdeelChange interface)
- [x] Cache-busting applied (package.json version timestamp)
- [x] Railway redeployment trigger updated
- [x] Type validation script created
- [x] Deployment documentation written

---

## 🚀 Pre-Deployment Verification

### Local Checks
- [ ] Run `node scripts/validate-types.js` → Should pass
- [ ] Run `npm ci` → Should use new timestamp
- [ ] Run `npm run build` → TypeScript errors should be gone
- [ ] Verify `.next/standalone/server.js` exists

### Git Status
- [x] All changes committed to `main`
- [x] GitHub shows commits: 3589969..., 171d00b..., a87171d..., d91eb11..., 0b1d19a...

### Railway Status
- [ ] Railway dashboard shows new deployment trigger
- [ ] Build starts automatically after git push
- [ ] Build log shows `npm ci` with fresh dependencies
- [ ] Build completes without TypeScript errors
- [ ] Server starts with health check passing

---

## 📄 Build Steps Expected

```
1. [inf] scheduling build on Metal builder
2. [inf] uploading snapshot
3. [inf] fetched snapshot
4. [inf] unpacking archive
5. [inf] using build driver railpack-v0.15.1
6. [inf] Detected Node
7. [inf] Using npm package manager
8. [inf] npm ci
   ✅ Should use package.json version: 0.1.2-draad162b.1733998080000
9. [inf] npm run build
   ✅ Should compile WITHOUT TypeScript errors
   ⚠ Supabase warnings are OK (non-blocking)
10. [inf] Build completed successfully
11. [inf] Starting server
    HOSTNAME=0.0.0.0 PORT=$PORT node .next/standalone/server.js
```

---

## 🔍 Health Checks (After Deploy)

- [ ] Navigate to `https://rooster-app-verloskunde.up.railway.app` (or your Railway URL)
- [ ] Verify page loads without errors
- [ ] Check browser console for errors
- [ ] Open DevTools Network tab
  - [ ] All API calls to Supabase should be OK
  - [ ] Real-time WebSocket connection should establish
- [ ] Try the rooster functionality:
  - [ ] Load a rooster
  - [ ] Edit a dagdeel
  - [ ] Verify modal updates show fresh data

---

## 📁 Files Modified

| File | Change | Commit |
|------|--------|--------|
| `src/lib/hooks/useRealtimeDagdeelSync.ts` | Made `old` nullable in interface | 3589969 |
| `package.json` | Updated version + timestamp | 171d00b |
| `railway.toml` | Updated deployment trigger | a87171d |
| `scripts/validate-types.js` | New validation script | d91eb11 |
| `DEPLOYMENT_FIX_DRAAD162B.md` | Fix documentation | 0b1d19a |

---

## 📚 Rollback Plan (If Needed)

If deployment fails after these changes:

1. Check Railway logs for exact error
2. Revert to previous commit:
   ```
   git revert 0b1d19adf4974874a65e81320e5489c3bb1d244c
   ```
3. Railway will redeploy from reverted code

---

## 📑 Sign-Off

- **Fixed by:** AI Assistant (DRAAD162B Context)
- **Date:** 2025-12-12T12:49:39Z
- **Status:** 🔈 Ready for Deployment
- **Next Steps:** Monitor Railway dashboard for automatic redeployment

---

**Use this checklist to verify the deployment is working correctly!**
