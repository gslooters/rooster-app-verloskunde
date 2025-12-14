# 🔴 DRAAD178B - FRONTEND REPAIR OPDRACHT

**Status**: ❌ URGENT - BLOCKING BUG  
**Datum**: 2025-12-14  
**Prioriteit**: 🔴 CRITICAL  
**Scope**: Frontend Dashboard - Week Data Loading

---

## 📋 PROBLEEM SAMENVATTING

**Frontend maakt nog steeds query's naar VERWIJDERDE parent tabel:**

```
❌ Query: .from('roster_period_staffing')
❌ Error: Failed to load resource: 404 NOT FOUND
❌ Impact: Dashboard toont "0 dagdelen records" voor alle weken
❌ Root Cause: Frontend niet aangepast na DRAAD176 (database denormalisering)
```

**FASE 1-4 (DRAAD178A) was ALLEEN voor API endpoint**, niet voor Frontend!

---

## 🎯 DOELSTELLING

Update alle Frontend bestanden om:
1. **Directe dagdelen queries** te gebruiken (GEEN parent joins)
2. **Denormaliseerde data** correct op te halen
3. **Weekdata correct te laden** in dashboard
4. **404 errors te elimineren**

---

## 🔍 GETROFFEN BESTANDEN

### KRITIEK (MOET REPAREREN) 🔴

#### 1. `lib/planning/weekDagdelenData.ts` ⚠️ HOOFD PROBLEEM

**Huidge Code:**
```typescript
// ❌ FOUT: Vraagt parent tabel op
const { data: rpsData, error } = await supabase
  .from('roster_period_staffing')  // ← BESTAAT NIET MEER!
  .select('id, date, roster_period_staffing_dagdelen(...)')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate);
```

**Nieuwe Code (DIRECT dagdelen):**
```typescript
// ✅ CORRECT: Direct uit denormaliseerde dagdelen tabel
const { data: dagdelenData, error } = await supabase
  .from('roster_period_staffing_dagdelen')
  .select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at')
  .eq('roster_id', rosterId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date, service_id, dagdeel, team');

// Group door date + service_id combo voor week structure
const grouped = new Map<string, any[]>();
dagdelenData?.forEach(record => {
  const key = `${record.date}|${record.service_id}`;
  if (!grouped.has(key)) {
    grouped.set(key, []);
  }
  grouped.get(key)?.push(record);
});
```

**Bestand**: `lib/planning/weekDagdelenData.ts`  
**Acties**:
- [ ] Find & Replace: `from('roster_period_staffing')` → `from('roster_period_staffing_dagdelen')`
- [ ] Update `.select()` clause met dagdelen fields
- [ ] Add grouping logica per `date|service_id`
- [ ] Remove parent table joins

---

#### 2. `app/planning/design/week-dagdelen/page-[weekIndex].tsx` (of gelijkwaardig)

**Symptoom**: "Error fetching staffing data" in console

**Oplossing**:
- [ ] Check ALL `.from('roster_period_staffing')` queries
- [ ] Replace met `from('roster_period_staffing_dagdelen')`
- [ ] Verify denormalized fields (roster_id, service_id, date) present

---

#### 3. `app/planning/design/dagdelen-dashboard/DagdelenDashboardClient.tsx`

**Acties**:
- [ ] Search: `roster_period_staffing` (parent query)
- [ ] If found: Replace met dagdelen direct query
- [ ] Update grouping logica

---

### SECUNDAIR (CONTROLEREN) 🟡

#### 4. `app/api/planning/service-allocation-pdf/route.ts`

**Status**: ⚠️ Controleer of ook parent table queries gebruikt

**Acties**:
- [ ] Check line by line voor `roster_period_staffing` references
- [ ] If parent query: Update naar dagdelen
- [ ] If already correct: Mark as OK

---

#### 5. `lib/services/preplanning-storage.ts`

**Acties**:
- [ ] Search: `roster_period_staffing`
- [ ] If parent queries: Replace met dagdelen

---

#### 6. `components/planning/week-dagdelen/WeekDagdelenVaststellingTable.tsx`

**Acties**:
- [ ] Check data loading hooks
- [ ] Verify uses correct supabase table

---

## 🔧 TECHNISCHE INSTRUCTIE

### Stap 1: Scan alle frontend files

```bash
# Search across codebase for parent table references
grep -r "from('roster_period_staffing')" --include="*.ts" --include="*.tsx" .
```

**Expected matches**: ~5-10 files met client-side queries

### Stap 2: Per bestand:

**Bestand**: `lib/planning/weekDagdelenData.ts`

**Find:**
```typescript
.from('roster_period_staffing')
```

**Replace:**
```typescript
.from('roster_period_staffing_dagdelen')
```

**Select clause Update:**
```typescript
// OLD
.select('id, date, roster_period_staffing_dagdelen(...)')

// NEW
.select('id, roster_id, service_id, date, dagdeel, team, status, aantal, invulling, updated_at, created_at')
```

**Grouping logica toevoegen:**
```typescript
// After fetching data
const groupedByDateService = new Map<string, RosterPeriodStaffingDagdeel[]>();

dagdelenData?.forEach(record => {
  const key = `${record.date}|${record.service_id}`;
  if (!groupedByDateService.has(key)) {
    groupedByDateService.set(key, []);
  }
  groupedByDateService.get(key)?.push(record);
});

return groupedByDateService;
```

### Stap 3: Test per file

**Na update**:
1. TypeScript compile check: `npm run build`
2. No errors expected
3. No warnings about missing fields

### Stap 4: Deployment

1. Commit: `🔧 DRAAD178B: Frontend repair - denormalisered dagdelen queries`
2. Railway auto-deploy
3. Check dashboard loads without 404 errors
4. Verify weeks show services (not empty)

---

## ✅ VERIFICATIE CHECKLIST

**Frontend Fixes**:
- [ ] `weekDagdelenData.ts` - Queries parent table REMOVED
- [ ] `weekDagdelenData.ts` - Direct dagdelen query ADDED
- [ ] `weekDagdelenData.ts` - Denormalized fields selected
- [ ] `weekDagdelenData.ts` - Grouping logica ADDED
- [ ] All other files checked for parent queries
- [ ] TypeScript compilation: NO ERRORS
- [ ] No console warnings about missing fields

**Dashboard Testing**:
- [ ] Load dashboard WITHOUT 404 errors
- [ ] Week 1 shows services (not "0 records")
- [ ] Week 2-5 show services
- [ ] Service cells clickable
- [ ] Modal opens for service details
- [ ] No console errors

**Git**:
- [ ] Commit message clear
- [ ] Files properly updated
- [ ] Build passes

---

## 🚀 VOLGENDE STAP

1. **Read this file nauwkeurig**
2. **Scan alle frontend bestanden** (zie hierboven)
3. **Update KRITIEKE bestanden** (1-3)
4. **Controleer SECUNDAIRE bestanden** (4-6)
5. **Test lokaal** (build + dashboard)
6. **Deploy naar Railway**
7. **Verify dashboard loads** (no 404, services visible)

---

## 📝 OPMERKING

**FASE 1-4 (DRAAD178A)** was ALLEEN voor:
- ✅ `app/api/planinformatie-periode/route.ts` (API endpoint)
- ✅ Cache-busting files
- ✅ Railway deployment

**FASE 5 (DRAAD178B - DEZE DRAAD)** is voor:
- ❌ Frontend components (client-side queries)
- ❌ Week data loading
- ❌ Dashboard display

FRONTEND WAS NIET AANGEPAST NA DATABASE DENORMALISERING!

---

**Document Status**: READY FOR EXECUTION  
**Estimated Time**: 30-45 minuten  
**Expertise Level**: Intermediate TypeScript + Supabase  

Gebruik deze file als COMPLETE INSTRUCTIE voor de DRAAD178B repair in de volgende thread.
