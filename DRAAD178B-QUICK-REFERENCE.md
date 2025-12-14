# 📑 DRAAD178B - QUICK REFERENCE GUIDE

**Use this for FAST execution of the fixes.**

---

## 🔍 GREP COMMAND (Find all files to fix)

```bash
grep -rn "from('roster_period_staffing')" --include="*.ts" --include="*.tsx" app lib components
```

**Expected output**: ~5-10 matches in frontend files

---

## 💫 FILE 1: CRITICAL - `lib/planning/weekDagdelenData.ts`

### FIND THIS BLOCK:

```typescript
const { data: rpsData, error } = await supabase
  .from('roster_period_staffing')
  .select('id, date, roster_period_staffing_dagdelen(...)')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate);
```

### REPLACE WITH:

```typescript
const { data: dagdelenData, error } = await supabase
  .from('roster_period_staffing_dagdelen')
  .select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date, service_id, dagdeel, team');
```

### ADD AFTER:

```typescript
// Group by date + service_id for week structure
const weekData = new Map<string, typeof dagdelenData>();

if (dagdelenData && dagdelenData.length > 0) {
  dagdelenData.forEach(record => {
    const key = `${record.date}|${record.service_id}`;
    if (!weekData.has(key)) {
      weekData.set(key, []);
    }
    weekData.get(key)?.push(record);
  });
}

return Object.fromEntries(weekData);
```

---

## 💫 FILE 2: CRITICAL - Week Page Component

**Most likely**: `app/planning/design/week-dagdelen/page-[weekIndex].tsx`

### FIND:
```typescript
.from('roster_period_staffing')
```

### REPLACE:
```typescript
.from('roster_period_staffing_dagdelen')
```

### UPDATE SELECT:
```typescript
// OLD
.select('id, date, roster_period_staffing_dagdelen(...)')

// NEW
.select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling')
```

---

## 💫 FILE 3: SECONDARY - Dashboard Client

**Location**: `app/planning/design/dagdelen-dashboard/DagdelenDashboardClient.tsx`

### FIND:
```typescript
.from('roster_period_staffing')
```

### REPLACE:
```typescript
.from('roster_period_staffing_dagdelen')
```

---

## 💫 FILE 4: SECONDARY - PDF Route

**Location**: `app/api/planning/service-allocation-pdf/route.ts`

### CHECK:
- [ ] Does it use `.from('roster_period_staffing')`?
- [ ] If YES: Replace with `.from('roster_period_staffing_dagdelen')`
- [ ] If NO: Leave as is

---

## 💫 FILE 5: SECONDARY - Storage Utility

**Location**: `lib/services/preplanning-storage.ts`

### CHECK:
- [ ] Does it use `.from('roster_period_staffing')`?
- [ ] If YES: Replace with `.from('roster_period_staffing_dagdelen')`
- [ ] If NO: Leave as is

---

## ✅ TESTING LOCALLY

```bash
# 1. Build check
npm run build

# Expected: No TypeScript errors
# Expected: No missing field warnings

# 2. Type check
npm run type-check

# Expected: All types resolve
```

---

## 💫 GIT COMMIT MESSAGE

```
🔧 DRAAD178B: Frontend repair - denormalized dagdelen queries

Fixes 404 errors in dashboard week data loading.

Changes:
- Fixed weekDagdelenData.ts to query denormalized table
- Updated all components to use roster_period_staffing_dagdelen
- Added denormalized field selection
- Added grouping logic for week structure
- Removed parent table joins

Result:
- Dashboard loads without 404
- Week data displays correctly
- Services visible in roster

Closes: 404 dashboard bug
```

---

## 🚀 DEPLOYMENT

```bash
# 1. Commit
git add .
git commit -m "🔧 DRAAD178B: Frontend repair - denormalized dagdelen queries"

# 2. Push (Railway auto-deploys)
git push origin main

# 3. Wait ~5 min for Railway deployment
# 4. Verify at: https://rooster.app (or your Railway domain)
```

---

## ✅ VERIFICATION CHECKLIST

**In browser, at dashboard:**

- [ ] Open DevTools Console (F12 → Console tab)
- [ ] Check for 404 errors: **SHOULD BE NONE**
- [ ] Check for SQL errors: **SHOULD BE NONE**
- [ ] Load week 1: **Should show services, NOT "0 records"**
- [ ] Load week 2-5: **All should show data**
- [ ] Click a service: **Modal should open**
- [ ] Check network tab: **All requests should be 200 OK**

---

## 💫 TROUBLESHOOTING

**If still getting 404:**
```
1. Check grep output - did you find all occurrences?
2. Are there other files not in this list?
3. Check for typos in table name
4. Verify denormalized fields exist in database
```

**If TypeScript errors:**
```
1. Check if ALL denormalized fields are selected
2. Verify field names match database schema
3. Check if types are imported correctly
4. Run: npm install (in case types out of sync)
```

**If still "0 records":**
```
1. Check network tab - is query returning data?
2. Check database - are dagdelen records there?
3. Check date range filter - is it correct?
4. Verify rosterId is being passed correctly
```

---

## 🔗 REFERENCE SCHEMA

**Table**: `roster_period_staffing_dagdelen`

```sql
CREATE TABLE roster_period_staffing_dagdelen (
  id UUID PRIMARY KEY,
  roster_id UUID NOT NULL,              -- Parent roster ID
  service_id UUID NOT NULL,             -- Service code
  date DATE NOT NULL,                   -- Shift date
  dagdeel VARCHAR(50),                  -- Day part (ochtend, middag, nacht)
  team VARCHAR(100),                    -- Team name
  status VARCHAR(50),                   -- Record status
  aantal INTEGER,                       -- Count
  invulling VARCHAR(255),               -- Fill description
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  -- Other denormalized fields...
);
```

**Key denormalized fields to include in SELECT:**
```sql
id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at
```

---

## 🌟 QUICK SUMMARY

**What's broken:**
- Frontend queries old parent table → 404 error

**What needs fixing:**
- Update 5 files to query denormalized table
- ~15 minutes of code changes
- One grep command to find all occurrences

**Expected result after fix:**
- Dashboard loads without errors
- Week data displays correctly
- Services visible in rooster

---

**Time estimate**: 30-45 minutes total  
**Difficulty**: Intermediate  
**Risk**: Low (just updating queries)  

Good luck! 🙋
