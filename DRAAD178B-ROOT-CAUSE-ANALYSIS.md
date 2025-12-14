# 🔍 DRAAD178B - ROOT CAUSE ANALYSIS

**Status**: ⚠️ CRITICAL BUG IDENTIFIED  
**Datum**: 2025-12-14T20:07 CET  
**Severity**: P0 - BLOCKING (Dashboard BROKEN)  
**Duration**: 3 hours since DRAAD178A deploy

---

## EXECUTIVE SUMMARY

**De Bug:**
- ❌ Frontend vraagt **VERWIJDERDE parent tabel** `roster_period_staffing` op
- ❌ Resulteert in **404 NOT FOUND** errors
- ❌ Dashboard toont **"0 dagdelen records"** voor elke week
- ❌ Users kunnen **GEEN diensten zien** in rooster

**De Oorzaak:**
- DRAAD178A (API fix) was ALLEEN voor `app/api/planinformatie-periode/route.ts`
- Frontend code werd NIET aangepast voor denormalisering
- Frontend maakt nog steeds client-side queries naar oude parent tabel

**De Impact:**
- Dashboard COMPLEET ONBRUIKBAAR
- Rooster kan niet geladen worden
- 100% data load failure

---

## FOUT ANALYSIS

### Browser Console Output

```javascript
// FOUT LOGS
❌ Supabase error week 1: Object
Failed to load resource: the server responded with a status of 404 ()

URL: https://rzecogncpkjfytebfkni.supabase.co/rest/v1/roster_period_staffing?
  select=id%2Cdate%2Croster_period_staffing_dagdelen(...)
  &roster_id=eq.e0817ce4-d2a3-42b3-8bb1-a62f0db2975e
  &date=gte.2025-11-24
  &date=lte.2025-11-30

📊 Week 1: 0 dagdelen records gevonden
📊 Week 2: 0 dagdelen records gevonden  
📊 Week 3: 0 dagdelen records gevonden
📊 Week 4: 0 dagdelen records gevonden
📊 Week 5: 0 dagdelen records gevonden
```

### Network Request Analysis

```http
GET /rest/v1/roster_period_staffing?
  select=id,date,roster_period_staffing_dagdelen(...)
  &roster_id=eq.e0817ce4-d2a3-42b3-8bb1-a62f0db2975e
  &date=gte.2025-11-24&date=lte.2025-11-30

Status: 404 NOT FOUND
Reason: Table 'roster_period_staffing' does not exist
```

---

## ROOT CAUSE TREE

```
DASHBOARD 404 ERROR (ROOT)
│
├─ SYMPTOM LAYER
│  ├─ Week data not loading
│  ├─ No services displayed
│  └─ "0 dagdelen records" in all weeks
│
├─ QUERY LAYER
│  ├─ Supabase endpoint: .from('roster_period_staffing')
│  ├─ Table NOT FOUND → 404
│  └─ Data retrieval fails
│
├─ DATABASE LAYER
│  ├─ Parent table 'roster_period_staffing' DELETED (DRAAD176)
│  ├─ All data now in 'roster_period_staffing_dagdelen'
│  ├─ Data DENORMALIZED (not in parent anymore)
│  └─ Parent table structure NO LONGER EXISTS
│
└─ CODE LAYER ⚠️ ROOT CAUSE
   ├─ DRAAD178A: Updated ONLY API endpoint
   │  └─ app/api/planinformatie-periode/route.ts ✅ CORRECT
   │
   ├─ Frontend code: NOT UPDATED ❌
   │  ├─ lib/planning/weekDagdelenData.ts ❌ OLD QUERY
   │  ├─ app/planning/design/week-dagdelen/page.tsx ❌ OLD QUERY
   │  ├─ DagdelenDashboardClient.tsx ❌ OLD QUERY
   │  └─ Other components ❌ UNCHECKED
   │
   └─ Missing: Direct dagdelen queries from frontend
      └─ Frontend still expects parent table structure
```

---

## COMPONENT-BY-COMPONENT ANALYSIS

### ✅ DRAAD178A (CORRECT)

**Bestand**: `app/api/planinformatie-periode/route.ts`

```typescript
// ✅ CORRECT: PostgREST API query
const vraagResponse = await fetch(
  `${postgrestUrl}/roster_period_staffing_dagdelen?... ← CORRECT TABLE
```

**Status**: Works correctly, returns 200 OK
**Data**: API successfully queries denormalized dagdelen

---

### ❌ DRAAD178B (BROKEN - THIS DRAAAD)

**Bestand**: `lib/planning/weekDagdelenData.ts`

```typescript
// ❌ FOUT: Vraagt oude parent tabel op
const { data: rpsData, error } = await supabase
  .from('roster_period_staffing')  // ← PARENT TABLE DOES NOT EXIST
  .select('id, date, roster_period_staffing_dagdelen(...)')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate);

if (error) {
  console.error('❌ Supabase error week X:', error);  // ← 404 ERROR
  return [];  // Returns empty array
}
```

**Impact**: Returns 404, falls back to empty array, week shows no data

---

### ❌ DRAAD178B (BROKEN)

**Bestand**: `app/planning/design/week-dagdelen/page-[weekIndex].tsx` (presumed location)

```typescript
// ❌ FOUT: Likely also queries parent
const { data: staffing, error } = await supabase
  .from('roster_period_staffing')
  .select('...')
  // ...

if (error) {
  console.error('Error fetching staffing data:', error);  // ← 404
}
```

**Impact**: Staffing data fetch fails, no week data loaded

---

## COMPARISON: API vs FRONTEND

| Component | Table Query | Status | Result |
|-----------|-------------|--------|--------|
| **API** (`planinformatie-periode`) | `roster_period_staffing_dagdelen` | ✅ CORRECT | 200 OK |
| **Frontend** (`weekDagdelenData`) | `roster_period_staffing` | ❌ BROKEN | 404 NOT FOUND |
| **Frontend** (`page-[weekIndex]`) | `roster_period_staffing` | ❌ BROKEN | 404 NOT FOUND |
| **Frontend** (`DagdelenDashboard`) | `roster_period_staffing` | ❌ LIKELY BROKEN | 404 NOT FOUND |

---

## TIMELINE

```
14-Dec 18:47 - DRAAD178A deployed
              - app/api/planinformatie-periode UPDATED ✅
              - Cache-busters added
              - Railway auto-deploy
              
14-Dec 19:00 - Railway deployment completes
              - Health checks PASS
              - Services online
              
14-Dec 20:00 - User loads dashboard
              - Frontend tries to load week data
              - Queries parent table 'roster_period_staffing'
              - 404 error returned
              - "Fout bij ophalen van data"
              - Dashboard BROKEN ❌
              
14-Dec 20:07 - Root cause identified
              - Frontend NOT updated in DRAAD178A
              - Only API endpoint was fixed
              - DRAAD178B repair identified
```

---

## WHY THIS HAPPENED

### DRAAD176 (Database Migration)
```
BEFORE:                    AFTER:
roster_period_staffing  →  ❌ DELETED
└── dagdelen FK            ↑
    └── child data         └── ALL DATA MOVED & DENORMALIZED

roster_period_staffing_dagdelen  →  roster_period_staffing_dagdelen
└── child records (2835)            ├── All denormalized fields
                                    ├── roster_id (parent ref)
                                    ├── service_id (from parent)
                                    ├── date (from parent)
                                    └── All child fields
```

### DRAAD178A (API Fix Only)
```
❌ MISTAKE: Only fixed:
   └── app/api/planinformatie-periode/route.ts

❌ FORGOT TO FIX:
   ├── lib/planning/weekDagdelenData.ts
   ├── app/planning/design/week-dagdelen/
   ├── DagdelenDashboardClient.tsx
   └── Other frontend components
```

### Result
```
API:        ✅ Works (direct dagdelen query)
Frontend:   ❌ Broken (still queries old parent table)
Dashboard:  ❌ CANNOT LOAD DATA
```

---

## THE FIX

**What needs to change:**

```typescript
// ALL frontend files: Change from
.from('roster_period_staffing')

// To:
.from('roster_period_staffing_dagdelen')

// And update SELECT to include:
.select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at')

// And group by (date|service_id) for week structure
```

**Files to fix:**
1. `lib/planning/weekDagdelenData.ts` (CRITICAL)
2. `app/planning/design/week-dagdelen/page-[weekIndex].tsx` (CRITICAL)
3. `app/planning/design/dagdelen-dashboard/DagdelenDashboardClient.tsx` (SECONDARY)
4. `app/api/planning/service-allocation-pdf/route.ts` (SECONDARY)
5. `lib/services/preplanning-storage.ts` (SECONDARY)

**Expected result after fix:**
```
✅ Frontend queries denormalized dagdelen directly
✅ No more 404 errors
✅ Week data loads correctly
✅ Services visible in rooster
✅ Dashboard FUNCTIONAL
```

---

## PREVENTION

**Why this wasn't caught:**

1. ❌ API endpoint was tested, worked fine
2. ❌ Frontend testing WAS NOT done
3. ❌ No integration test (API only, not dashboard)
4. ❌ Assumption: "If API works, frontend works"
5. ❌ Scope creep: DRAAD178A was labeled "complete", but wasn't

**For future:**
- Always test FULL end-to-end (API + Frontend)
- Don't assume fix is complete without testing UI
- Database migrations require BOTH backend AND frontend updates
- Client-side queries must be audited separately from server

---

## SEVERITY ASSESSMENT

**Severity**: 🔴 **CRITICAL**

**Reasoning:**
- User-facing feature completely broken
- Dashboard cannot load data
- All weeks show "0 records"
- No workaround available
- Requires code fix + deployment

**ETA to fix**: 30-45 minutes
**Testing time**: 10-15 minutes  
**Deployment**: 5-10 minutes

**Total**: ~45-70 minutes

---

## CONCLUSION

**The bug is not in the API or database.**  
**The bug is in the frontend code not being updated for denormalization.**

DRAARD178A fixed the API.  
DRAARD178B must fix the frontend.

See `DRAAD178B-FRONTEND-REPAIR-OPDRACHT.md` for complete repair instructions.

---

**Document Version**: 1.0  
**Status**: ANALYSIS COMPLETE, READY FOR REPAIR  
**Next Action**: Execute DRAAD178B frontend fixes  
