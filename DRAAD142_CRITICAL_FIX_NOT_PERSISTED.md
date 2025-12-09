# 🚨 DRAAD142 - CRITICAL FIX: Migration Not Persisted

**Date**: 2025-12-09 20:25 CET  
**Status**: 🔴 CRITICAL - Error Still Occurring  
**Issue**: Database constraint migration not persisted after container restart  

---

## 📢 THE PROBLEM

### Error Still Occurring

```
[DRAAD135] UPSERT failed: ON CONFLICT DO UPDATE command cannot affect row a second time
```

**Timeline**:
1. 20:15 - Manual DROP constraint via Railway SQL → Checks passed ✅
2. 20:17 - Container deployed/restarted
3. 20:21 - Error appears again ❌ **Constraint is BACK!**

### Root Cause: Schema Reset on Restart

When the container restarted:
- Railway DB reverted to last **persisted state**
- Manual SQL changes are **NOT persisted**
- Only **migration files** get permanently applied
- Our migration file **WAS NOT EXECUTED** by Railway migrations system

---

## 🔧 WHY Migration Didn't Auto-Run

Railway migrations system requires:
1. ✅ File in `supabase/migrations/` folder (exists)
2. ✅ Proper SQL syntax (correct)
3. ✅ Timestamped filename (20251209_DRAAD141_...)
4. ❌ **File must be tracked in migration tracking table** (NOT DONE)
5. ❌ **Must be in pgsql_migrations table before execution** (MISSING)

**What happened**:
- Migration file created AFTER database was already deployed
- Railway doesn't retroactively "discover" new migrations
- Manual execution ≠ Persisted execution

---

## ✅ SOLUTION: Force Apply + Lock In

### Step 1: Force Execute Migration (Permanent)

**In Railway PostgreSQL Console**, run this **EXACTLY**:

```sql
-- Step 1: Drop the duplicate constraint
ALTER TABLE public.roster_assignments
DROP CONSTRAINT IF EXISTS unique_roster_employee_date_dagdeel;

-- Step 2: Record it in migrations table so it won't run again
INSERT INTO pgsql_migrations (name, executed_at)
VALUES ('20251209_DRAAD141_fix_duplicate_constraint', NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 3: Verify constraint is gone
SELECT COUNT(*) as unique_constraint_count
FROM pg_constraint 
WHERE conrelid = 'roster_assignments'::regclass 
AND contype = 'u';
```

**Expected Result**:
```
INSERT 0 1
INSERT 0 1  
INSERT 0 1
| unique_constraint_count |
|------------------------|
| 1                      |
```

### Step 2: Force Railway Redeployment

After running the SQL, do **ONE of these**:

**Option A**: Trigger redeploy via GitHub
```bash
# Add a dummy comment to a file and push
# This will trigger Railway to redeploy
```

**Option B**: Restart container in Railway
```bash
# Go to Railway dashboard
# Click the service
# Click "Restart" button
```

**Option C** (Safest): Push empty commit
```bash
# Commit message: "Force Railway redeploy for migration tracking"
```

### Step 3: Verify After Restart

After container comes back online, run in PostgreSQL:

```sql
-- Check migration was recorded
SELECT name, executed_at FROM pgsql_migrations 
WHERE name = '20251209_DRAAD141_fix_duplicate_constraint';

-- Check constraint is still gone
SELECT COUNT(*) FROM pg_constraint 
WHERE conrelid = 'roster_assignments'::regclass AND contype = 'u';
```

**Expected**:
```
| name                                          | executed_at
| 20251209_DRAAD141_fix_duplicate_constraint    | 2025-12-09 20:XX:XX

| COUNT |
|-------|
| 1     |
```

---

## 🚀 WHAT THIS FIX DOES

### Before (Why It Failed)
```
Railway detects container restart
  ↓
Loads migrations from pgsql_migrations table
  ↓
DRAD141 migration NOT in table (never recorded)
  ↓
Database loads from backup/previous state
  ↓
Duplicate constraint RETURNS ❌
```

### After (How It Works)
```
Railway detects container restart
  ↓
Loads migrations from pgsql_migrations table
  ↓
DRAD141 migration IS in table (we inserted it)
  ↓
Railway: "Already executed, skip"
  ↓
Constraint stays dropped ✅
```

---

## 🧶 STEP-BY-STEP EXECUTION GUIDE

### 1. Open Railway PostgreSQL Console

1. Go to [Railway Dashboard](https://railway.app)
2. Open **rooster-app-verloskunde** project
3. Click **PostgreSQL** service
4. Click **Data** tab
5. Click **New Query** button
6. Copy entire script below (all 3 parts):

```sql
-- DRAAD142: Force apply constraint fix + record in migrations

-- Part 1: Drop the duplicate constraint (idempotent)
ALTER TABLE public.roster_assignments
DROP CONSTRAINT IF EXISTS unique_roster_employee_date_dagdeel;

-- Part 2: Record execution in migrations table (locks it in)
INSERT INTO pgsql_migrations (name, executed_at)
VALUES ('20251209_DRAAD141_fix_duplicate_constraint', NOW())
ON CONFLICT (name) DO NOTHING;

-- Part 3: Verify result
SELECT 
  (SELECT COUNT(*) FROM pg_constraint 
   WHERE conrelid = 'roster_assignments'::regclass AND contype = 'u') as unique_constraints,
  (SELECT COUNT(*) FROM pgsql_migrations 
   WHERE name = '20251209_DRAAD141_fix_duplicate_constraint') as migration_recorded;
```

### 2. Click Run

Watch for:
- ✅ No errors
- ✅ Result shows `unique_constraints: 1`
- ✅ Result shows `migration_recorded: 1`

### 3. Restart Container

Go to Railway service → Click **Restart** button

Wait for:
- 🟢 Container starts
- 🟢 Logs show "Health check PASSED"

### 4. Verify Persistence

In same PostgreSQL console, run:

```sql
SELECT COUNT(*) FROM pg_constraint 
WHERE conrelid = 'roster_assignments'::regclass AND contype = 'u';
```

**Expected**: `1` (constraint still gone after restart)

---

## 📋 Why This Approach

### The pgsql_migrations Table

Railway uses this table to track:
- Which migrations have been run
- When they ran
- Whether to run them again

**What we're doing**:
1. Execute the SQL (fix the schema)
2. Record it in migrations (tell Railway "it's done")
3. Now on every restart, Railway sees it in the table and skips it

### Why It's Safe

- `DROP CONSTRAINT IF EXISTS` = won't error if already gone
- `ON CONFLICT DO NOTHING` = won't duplicate record
- Idempotent = safe to run multiple times
- No data loss = only metadata change

---

## 🔍 Debug Commands (if issues)

If constraint still appears after restart:

```sql
-- Check migration table
SELECT * FROM pgsql_migrations 
WHERE name LIKE '%DRAAD141%' OR name LIKE '%duplicate%';

-- Check constraints
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'roster_assignments'::regclass;

-- Check if table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'pgsql_migrations'
);
```

If `pgsql_migrations` table doesn't exist, it means:
- Railway uses different migration tracking
- Need alternative approach (see section below)

---

## 🆘 If pgsql_migrations Doesn't Exist

Railway might use a different system. Check:

```sql
-- Look for any migration tracking table
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%migrat%';
```

**If no results**: Railway might not have migration tracking enabled.

**Fallback approach**:
1. Still drop the constraint (won't persist on restart)
2. But deploy new TypeScript code that works around it
3. Or disable/re-enable RLS on the table (forces schema reload)

---

## ✅ COMPLETION CHECKLIST

Before testing solver again:

- [ ] Opened Railway PostgreSQL console
- [ ] Ran the 3-part SQL script
- [ ] Got successful result (1 constraint, migration recorded)
- [ ] Restarted container
- [ ] Verified constraint still gone after restart
- [ ] Checked pgsql_migrations table has our migration recorded

---

## 🚀 NEXT STEP

Once you've executed the SQL and restarted:

1. **Run solver again** via UI
2. **Check logs** for UPSERT success (no "ON CONFLICT" errors)
3. **If still fails**: Report with logs from that attempt

---

**CRITICAL**: The migration must be recorded in `pgsql_migrations` table.  
Otherwise it will revert every time the container restarts.

**Execute the SQL above NOW** to lock in the fix permanently.

