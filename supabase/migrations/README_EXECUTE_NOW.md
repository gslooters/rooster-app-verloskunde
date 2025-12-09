# 🚨 PRIORITEIT: Database Migrations Status

**Laatste Update**: 2025-12-09  
**Status**: DRAAD141 Constraint Fix Applied  

---

## 📋 Active Migrations Queue

### ✅ DRAAD141: Fix Duplicate UNIQUE Constraint (2025-12-09)

**Status**: APPLIED (Ready for deployment)  
**File**: `20251209_DRAAD141_fix_duplicate_constraint.sql`  
**Impact**: Fixes DRAAD135 UPSERT "ON CONFLICT" error  
**Action**: Auto-runs on next Railway deployment

**What it does**:
- Drops duplicate constraint: `unique_roster_employee_date_dagdeel`
- Keeps primary constraint: `roster_assignments_unique_key`
- Resolves Supabase upsert() ambiguity

**Related**:
- See: `DRAAD141_CONSTRAINT_FIX_ANALYSIS.md`
- See: `DRAAD142_NEXT_STEPS.md` (testing guide)

**Verification** (After deployment):
```sql
SELECT COUNT(*) FROM pg_constraint 
WHERE conrelid = 'roster_assignments'::regclass AND contype = 'u';
-- Expected: 1
```

---

### 🟡 Previous Migrations (Reference)

These migrations are already applied in production:

#### ✅ 2025-11-15: Fix employee_services RLS
**Status**: Applied  
**Details**: Fixed row-level security policies for INSERT/UPDATE/DELETE  

#### ✅ Earlier migrations (2024-12-03 onwards)
**Status**: All applied  
**Details**: System flags, triggers, constraints, table structures  

---

## 🚀 Deployment Notes

### For Railway Auto-Deployment

Migrations are automatically applied when you push to `main` branch:

1. ✅ Migration file committed to `supabase/migrations/`
2. ✅ Railway detects change via GitHub webhook
3. ✅ Railway runs Supabase migrations in order
4. ✅ New schema deployed to production

**No manual action needed** - Just push to main!

### Manual Testing (if needed)

If you want to test locally before pushing:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <PROJECT_ID>

# Pull current schema
supabase db pull

# Push migrations (runs on local instance)
supabase db push
```

---

## ✅ Migration Verification Checklist

### After DRAAD141 Deployment

**In Railway PostgreSQL Console**:

- [ ] Run constraint count query (expect: 1)
- [ ] Run constraint name query (expect: roster_assignments_unique_key)
- [ ] Verify no `unique_roster_employee_date_dagdeel` constraint

**In Application**:

- [ ] Test POST /api/roster/solve endpoint
- [ ] Check for "ON CONFLICT" errors in logs (should NOT exist)
- [ ] Verify assignments were inserted/updated correctly

**Related Documentation**:
- See `DRAAD142_NEXT_STEPS.md` for detailed verification steps

---

## 📊 Schema Timeline

```
2024-12-03    → Initial setup (system flags, triggers)
2025-11-15    → RLS fixes for employee_services
2025-11-17    → Created roster_period_staffing_dagdelen
2025-11-27    → Created roster_employee_services
2025-12-08    → DRAAD129/130: UPSERT functions
2025-12-09    → DRAAD141: Fix duplicate constraint ← YOU ARE HERE
2025-12-09    → DRAAD142: Verification (next thread)
```

---

## 🔧 If Migration Fails

### Common Issues

**Issue**: Migration doesn't appear in pg_migrations

```sql
SELECT name, executed_at FROM pgsql_migrations 
WHERE name LIKE '%DRAAD141%';
```

If empty:
1. Check Railway deploy logs
2. Verify GitHub commit was pushed
3. Manually run migration in PostgreSQL console

**Issue**: Constraint still shows up after migration

```sql
SELECT conname FROM pg_constraint 
WHERE conrelid = 'roster_assignments'::regclass;
```

If `unique_roster_employee_date_dagdeel` still exists:
1. Migration may not have run
2. Try running SQL manually:
   ```sql
   ALTER TABLE public.roster_assignments
     DROP CONSTRAINT IF EXISTS unique_roster_employee_date_dagdeel;
   ```

**Issue**: Solver UPSERT still fails

See `DRAAD142_NEXT_STEPS.md` debugging section

---

## 📚 Related Documentation

### DRAAD141 (Constraint Fix)
- **Analysis**: `DRAAD141_CONSTRAINT_FIX_ANALYSIS.md`
- **Migration**: `20251209_DRAAD141_fix_duplicate_constraint.sql`
- **Related Issue**: "ON CONFLICT DO UPDATE command cannot affect row a second time"
- **Root Cause**: Duplicate UNIQUE constraints with identical columns

### DRAAD135 (UPSERT Implementation)
- **Code**: `app/api/roster/solve/route.ts`
- **Method**: Supabase `.upsert()` with `onConflict` parameter
- **Issue Fixed By**: DRAAD141 constraint cleanup

### DRAAD140 (Analysis That Led to Fix)
- **File**: `DRAAD140_ANALYSE_DRAAD135_UPSERT_CODE.md`
- **Analysis**: Deep dive into constraint mismatch
- **Finding**: Two identical UNIQUE constraints

### DRAAD142 (Next Steps)
- **File**: `DRAAD142_NEXT_STEPS.md`
- **Purpose**: Verification and testing after deployment
- **Owner**: Next thread

---

## ✅ Current Status

| Component | Status | Details |
|-----------|--------|----------|
| DRAAD141 Migration | ✅ Ready | Created and committed |
| GitHub Push | ✅ Complete | Pushed to main |
| Railway Deploy | ⏳ Pending | Will run on next push |
| Verification | ⏳ Pending | DRAAD142 thread |
| Fix Complete | ⏳ Pending | After verification |

---

## 🎯 Next Steps

1. **Wait for Railway deployment** (automatic via webhook)
2. **Open DRAAD142 thread** for testing
3. **Run verification queries** (see `DRAAD142_NEXT_STEPS.md`)
4. **Test solver UPSERT** with POST /api/roster/solve
5. **Confirm data integrity** in database

---

**Questions?** See documentation files listed above.  
**Issues?** Check the debugging section in this file.

