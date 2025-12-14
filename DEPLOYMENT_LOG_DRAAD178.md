# DRAAD178-BUGFIX: Deployment Log

**Date:** 2025-12-14T18:07:00Z
**Status:** ✅ DEPLOYED
**Severity:** 🔴 BLOCKING BUGS - Both prevent user interaction

---

## Fixes Applied

### FIX 1: Missing .single() in getRosterById()
**File:** `lib/services/roosters-supabase.ts`
**Line:** 52-62
**Problem:** Query returned multiple rows instead of single row → 406 error in Dashboard
**Solution:** Added `.single()` to ensure single-row result
**Impact:** Dashboard now loads successfully

```typescript
// BEFORE
const { data, error } = await supabase
  .from('roosters')
  .select('*')
  .eq('id', id);
  // Missing .single() - returns array

// AFTER
const { data, error } = await supabase
  .from('roosters')
  .select('*')
  .eq('id', id)
  .single();  // ✅ Added - returns single object
```

### FIX 2: Wrong Foreign Key in getCelData()
**File:** `lib/planning/getCelData.ts`
**Line:** 64-76
**Problem:** Query used wrong FK (`roster_period_staffing_id`) → Empty Diensten modal
**Solution:** Direct query to `roster_period_staffing_dagdelen` using:
  - `roster_id` (instead of roster_period_staffing.id)
  - `service_id` (instead of service_id from parent)
  - `date` (instead of date from parent)
**Impact:** Diensten modal now displays data correctly

```typescript
// BEFORE
const { data: rpsData } = await supabase
  .from('roster_period_staffing')
  .select('id')
  .eq('roster_id', rosterId)
  .eq('service_id', dienstId)
  .eq('date', datum)
  .maybeSingle();

const { data: dagdeelData } = await supabase
  .from('roster_period_staffing_dagdelen')
  .select('status, aantal')
  .eq('roster_period_staffing_id', rpsData.id)  // ❌ WRONG FK
  .eq('dagdeel', dagdeelStr)
  .eq('team', team)
  .maybeSingle();

// AFTER
const { data: dagdeelData } = await supabase
  .from('roster_period_staffing_dagdelen')
  .select('status, aantal')
  .eq('roster_id', rosterId)              // ✅ Direct columns
  .eq('service_id', dienstId)
  .eq('date', datum)
  .eq('dagdeel', dagdeelStr)
  .eq('team', team)
  .maybeSingle();
```

---

## Cache Busting
✅ Added: `public/cache-bust-draad178.json` with timestamp and random hash

---

## Verification Checklist

- [x] Both fixes pushed to main branch
- [x] Git commits verified:
  - Commit 1: `ebf6639b` - Add .single() to getRosterById
  - Commit 2: `6efeaad5` - Fix getCelData wrong FK
  - Commit 3: `2f2ecf31` - Add cache-buster
- [ ] Deploy to Railway
- [ ] Test Dashboard loads (verify getRosterById fix)
- [ ] Test Diensten modal shows data (verify getCelData fix)
- [ ] Verify both services work together

---

## Deployment Steps

1. ✅ Code fixes committed to main
2. ✅ Cache buster created
3. ⏳ Deploy to Railway (trigger via webhook)
4. ⏳ Smoke test on staging
5. ⏳ Production deployment

---

## Related Issues
- FOUT 1: Dashboard 406 error in Supabase
- FOUT 2: Diensten modal empty - Wrong FK in getCelData.ts

## Related Services
- `rooster-app-verloskunde` (main app)
- Railway deployment pipeline
- Supabase database schema (no changes needed)
