# DRAAD186: Supabase Environment Variable Fix Report

**Date**: 2025-12-15T20:00:50Z  
**Status**: ✅ DEPLOYED  
**Issue**: Rooster creation failed with `net::ERR_NAME_NOT_RESOLVED` on `placeholder.supabase.co`

---

## Problem Analysis

### Root Cause

The frontend application was falling back to placeholder URL `https://placeholder.supabase.co` instead of using the correct Supabase project URL `https://rzecogncpkjfytebfkni.supabase.co`.

**Evidence**:
- Console errors showed all API calls to `placeholder.supabase.co` failing
- `lib/supabase.ts` had hardcoded fallback: `'https://placeholder.supabase.co'`
- Environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were not being injected at build time

### Why This Happened

```typescript
// BEFORE (BROKEN):
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
```

The fallback values were used because:
1. Railway environment variables not passed to build process
2. `.env.local` didn't have hardcoded credentials (security best practice)
3. No error warnings when env vars were missing

### Impact

- **Wizard Phase 1 FAILS**: `createRooster()` → Supabase API unreachable
- **User sees**: "Kon rooster niet aanmaken. Probeer opnieuw."
- **Database**: Completely inaccessible from frontend
- **Status**: CRITICAL - No roosters can be created

---

## Solution Implemented

### Commit History

| Commit | File | Change |
|--------|------|--------|
| `0f9f301` | `lib/supabase.ts` | ✅ Removed fallback URLs, added error logging |
| `d7cea82` | `.env.local` | ✅ Added environment variable instructions |
| `f5ce438` | `.railway-deployment-trigger-draad186-supabase-fix` | ✅ Cache-bust trigger |
| `d306900` | `package.json` | ✅ Version bumped to `0.1.5-draad186` |

### Changes Made

#### 1. **lib/supabase.ts** (CRITICAL)

```diff
- const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
- const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

+ const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
+ const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

+ // Error handling for missing environment variables
+ if (!supabaseUrl) {
+   console.error('❌ CRITICAL: NEXT_PUBLIC_SUPABASE_URL is not defined!')
+ }
```

**Why**: 
- Forces explicit error if env vars missing
- No silent fallback to broken placeholder URL
- Proper error messages for debugging

#### 2. **.env.local** (DOCUMENTATION)

```diff
  # Cache-busting timestamp for Railway deployment
- # Updated: 2025-12-14T16:05:26Z
+ # Updated: 2025-12-15T20:00:22Z - DRAAD186 Supabase Fix

+ # IMPORTANT: In production (Railway), these MUST be set in environment variables:
+ # NEXT_PUBLIC_SUPABASE_URL=https://rzecogncpkjfytebfkni.supabase.co
+ # NEXT_PUBLIC_SUPABASE_ANON_KEY=(your-anon-key)
```

**Why**: 
- Clarifies where credentials should come from
- Documents expected Supabase project URL

#### 3. **package.json** (VERSION)

```json
"version": "0.1.5-draad186.supabase-env-fix.1734278442000"
```

**Why**:
- Triggers new build in Railway
- Forces cache invalidation
- Traceable version for debugging

---

## Expected Behavior After Fix

### Build Process

1. Railway detects new commit
2. Pulls `NEXT_PUBLIC_SUPABASE_URL` from environment variables
3. Injects into build as `process.env.NEXT_PUBLIC_SUPABASE_URL`
4. `supabase.ts` uses actual URL instead of placeholder
5. Frontend API calls succeed

### Runtime Behavior

**Before Fix**:
```
❌ Supabase error bij aanmaken rooster: Object
❌ Fout bij aanmaken rooster: Object
XHR URL: placeholder.supabase.co/rest/v1/roosters
```

**After Fix**:
```
✅ Rooster successfully created: <uuid>
✅ Design initialized
✅ Period employee staffing configured
✅ Roster assignments created: 1155 records
✅ Database verification passed
```

---

## Verification Steps

### Step 1: Check Build Log
Navigate to Railway → rooster-app-verloskunde service → Deployments

**Look for**:
```
Build successful
Deploy successful
Image size: [...]
```

### Step 2: Check Console for Errors
Open browser DevTools → Console tab

**Expected**:
- ❌ NO "placeholder.supabase.co" errors
- ❌ NO "ERR_NAME_NOT_RESOLVED" messages

**Instead**: Silent initialization (env vars properly injected)

### Step 3: Test Rooster Creation

1. Navigate to `/planning/rooster-ontwerpen`
2. Click "Nieuw rooster aanmaken"
3. Select period: "Week 48-52, 2025" 
4. Continue through wizard
5. Click "Ja, aanmaken" on final confirmation

**Expected Outcome**:
- ✅ Progress bar advances through all 6 phases
- ✅ "Rooster succesvol aangemaakt!" message
- ✅ Redirect to design dashboard
- ✅ Roster data fully loaded

### Step 4: Check Database
Supabase Dashboard → roosters table

**Verify**:
- ✅ New roster record present
- ✅ `start_date`: 2025-11-24
- ✅ `end_date`: 2025-12-28
- ✅ `status`: 'draft'
- ✅ `created_at`: timestamp near test time

---

## Environment Variable Setup (Railway)

### Required Variables

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rzecogncpkjfytebfkni.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase Dashboard → Settings → API → Anon Key |

### How to Set in Railway

1. Go to Railway Project Settings
2. Select `rooster-app-verloskunde` service
3. Navigate to "Variables" tab
4. Add/update:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Redeploy service (triggers new build)

---

## Rollback Plan (if needed)

If issues occur:

```bash
# Revert to previous commit
git revert d306900  # package.json version update
git revert f5ce438  # deployment trigger
git revert d7cea82  # .env.local
git revert 0f9f301  # lib/supabase.ts

# Push changes
git push

# Railway auto-redeploys on new commit
```

---

## Related Threads

- **DRAAD175**: Rooster Solver Service (FASE 2 + 3) - Backend OK ✅
- **DRAAD122**: UPSERT pattern for roster assignments - Data OK ✅
- **DRAAD69**: Roster assignments initialization - Logic OK ✅

---

## Summary

**Problem**: Frontend couldn't connect to Supabase (placeholder URL)
**Solution**: Remove fallback, require proper environment variables
**Status**: ✅ DEPLOYED & READY FOR TESTING
**Next Step**: Verify rooster creation wizard works end-to-end

---

**Last Updated**: 2025-12-15T20:00:50Z  
**Fixed By**: Automated Deployment System  
**Verified By**: (Pending manual test)
