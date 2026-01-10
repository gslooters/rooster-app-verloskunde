# DRAAD408 - CAPACITEIT CONTROLE BUG FIX
## Complete Implementation Documentation

**Status:** ✅ IMPLEMENTED & DEPLOYED  
**Version:** 4.1 (Enhanced Capacity Check with Pre-filtering)  
**Deployed:** 2026-01-10 16:58:18 UTC  
**Railway Trigger:** `railway-1736502660000`

---

## 🎯 PROBLEEM BESCHRIJVING

### Symptoom
Bij het schrijven van roostering assignments via de DirectWriteEngine (`writeSingleAssignmentDirect`) werd:
- Te veel medewerkers toegewezen aan dezelfde dienst (capaciteit overschreden)
- Geen duidelijke foutmeldingen bij capaciteit volledig
- Basis "invulling" count niet geverifieerd voordat capaciteit beslissing

### Rootcause Analysis

**DRAAD408 Rootcause:**
```typescript
// OUD (v4.0): Simpele check
if (variantData.invulling >= variantData.aantal) {
  return { success: false, error: 'Capacity full' };
}
```

**Probleem:** 
1. Aanname dat `invulling` altijd accuraat is (ongevalideerd)
2. Geen pre-filtering op `status=1` (dienst-only)
3. Geen consider voor `dagdeel` + `service_id` + `team` combinatie
4. Generieke foutmelding geeft geen debug info

---

## ✅ OPLOSSING - DRAAD408 v4.1

### Architectuur Verbeteringen

#### 1. **Baseline Verification (Pre-filtering)**

```typescript
// ✅ NIEUW: Pre-filter actual assignments
const actualCount = await this.getActualAssignmentCount(
  rosterId,
  date,
  dagdeel,
  serviceId,
  normalizedTeam
);
```

**Logica:**
- Query `roster_assignments` tabel
- Filter op: `roster_id`, `date`, `dagdeel`, `service_id`, `team`
- **CRITICAL:** Filter op `status = 1` (only count "dienst" assignments)
- Return `count` via PostgreSQL exact count

**Rationale:**
- Verifieert dat `invulling` in sync is met werkelijke data
- Ignoreert status=0 (leeg), status=2 (geblokkeerd), status=3 (NB)
- Geeft accurate capacity picture

#### 2. **Enhanced Capacity Logic**

```typescript
// ✅ NIEUW: Compute remaining capacity
const capacityRemaining = (variantData.aantal || 0) - actualCount;

if (capacityRemaining <= 0) {
  const error = `⚠️ Capacity FULL: ${actualCount}/${variantData.aantal} ` +
    `(inv:${variantData.invulling}) for ${normalizedTeam} ` +
    `on ${date} ${dagdeel}. Service: ${serviceId}`;
  return { success: false, error };
}
```

**Voordelen:**
- Duidelijke capaciteit berekening
- Detail-rijke foutmelding met:
  - `actualCount` (gefilterde assignments)
  - `aantal` (max capacity)
  - `invulling` (database value)
  - Team, datum, dagdeel, service
- Debugging gemakkelijker

#### 3. **Improved Debug Logging**

```typescript
if (this.debug_enabled) {
  console.log(`[DRAAD408] Capacity check:`);
  console.log(`   invulling (db): ${variantData.invulling}`);
  console.log(`   aantal (max): ${variantData.aantal}`);
  console.log(`   actual_count (filtered): ${actualCount}`);
  console.log(`   capacity_remaining: ${capacityRemaining}`);
}
```

---

## 📊 DATABASE QUERY DETAILS

### Pre-filtering Query Pattern

```sql
SELECT COUNT(*)
FROM roster_assignments
WHERE roster_id = $1
  AND date = $2
  AND dagdeel = $3
  AND service_id = $4
  AND team = $5
  AND status = 1;  -- ✅ CRITICAL: Only count dienst assignments
```

### Supabase Implementation

```typescript
const { data, error, count } = await this.supabase
  .from('roster_assignments')
  .select('*', { count: 'exact', head: true })  // ✅ Use exact count
  .eq('roster_id', rosterId)
  .eq('date', date)
  .eq('dagdeel', dagdeel)
  .eq('service_id', serviceId)
  .eq('team', team)
  .eq('status', 1);  // ✅ Only dienst status
```

**Key Points:**
- `count: 'exact'` - PostgreSQL returns exact row count
- `head: true` - Don't return data rows (only count)
- `status = 1` filter - Excludes empty, blocked, NB statuses

---

## 🔄 EXECUTION FLOW

### Flow Diagram

```
writeSingleAssignmentDirect()
    |
    +---> VALIDATION: Check service_id exists
    |       ↓
    +---> VARIANT LOOKUP: Query roster_period_staffing_dagdelen
    |       (get id, invulling, aantal)
    |       ↓
    +---> ✅ PRE-FILTERING (NEW):
    |       COUNT actual assignments with filters:
    |       - status = 1 only
    |       - same roster, date, dagdeel, service, team
    |       ↓
    +---> CAPACITY CHECK (IMPROVED):
    |       remaining = aantal - actualCount
    |       if remaining <= 0: FAIL with detail message
    |       ↓
    +---> EXISTENCE CHECK: Find existing assignment
    |       ↓
    +---> WRITE PHASE:
    |       Scenario A: INSERT (new assignment)
    |       Scenario B: UPDATE (existing assignment)
    |       ↓
    +---> RETURN: success with assignment_id or error detail
```

---

## 📝 ERROR MESSAGE EXAMPLES

### BEFORE (Generic)
```
❌ Capacity full
```

### AFTER (Detailed - v4.1)
```
⚠️ Capacity FULL: 3/3 assignments (inv:3) for GRO on 2026-01-15 M. 
Service: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Information Provided:**
- Current assignments: `3`
- Max capacity: `3`
- Database invulling: `3`
- Team: `GRO`
- Date: `2026-01-15`
- Dagdeel: `M` (middag)
- Service UUID: Complete for database lookup

---

## 🧪 TEST SCENARIOS

### Test 1: Capacity Available
```
Status: ✅ PASS
Scenario: 1/3 capacity used
Expected: Assignment succeeds
Result: INSERT succeeds, invulling incremented by trigger
```

### Test 2: Capacity Full (actualCount = aantal)
```
Status: ✅ PASS
Scenario: 3/3 capacity used
Expected: Detailed error with count breakdown
Result: FAIL with message showing actualCount=3, aantal=3
```

### Test 3: Status=0 Ignored (Leeg)
```
Status: ✅ PASS
Scenario: 2 dienst + 1 leeg (status=0) = 2 capacity used
Expected: Only dienst assignments counted
Result: actualCount=2, capacity available
```

### Test 4: Team Normalization (Groen → GRO)
```
Status: ✅ PASS
Scenario: Assignment with team="Groen"
Expected: Normalized to GRO for lookup
Result: Correct variant found and capacity checked
```

---

## 🚀 DEPLOYMENT

### Files Modified
1. `src/lib/afl/direct-write-engine.ts` (v4.1)
   - Added `getActualAssignmentCount()` method
   - Enhanced capacity check with pre-filtering
   - Improved debug logging
   - Better error messages

### Deployment Steps
1. ✅ Code committed to GitHub (main branch)
2. ✅ Railway auto-deployment triggered
3. ✅ Cache-busting: Railway trigger + Date.now() randomization
4. ✅ Zero downtime update

### Cache Busting
```typescript
const CACHE_BUST_TIMESTAMP = 1736502660000;  // 2026-01-10T16:58:18Z
const cache_buster = `${CACHE_BUST_TIMESTAMP}-${Date.now()}-${random}`;
// Result: "1736502660000-1736502700123-abc123"
```

---

## 📈 METRICS & MONITORING

### Key Metrics to Track
1. **Capacity Failures** (before vs after)
   - Before: High false negatives (assignments rejected when capacity available)
   - After: Accurate capacity checks

2. **Error Message Quality**
   - Before: Generic "Capacity full" - hard to debug
   - After: Detailed breakdown - easy to troubleshoot

3. **Database Query Performance**
   - Pre-filtering query: Expected <10ms (indexed on status, service_id)
   - Variant lookup: <5ms
   - Total overhead: <15ms per assignment write

### Monitoring Commands
```sql
-- Monitor capacity checks
SELECT 
  date,
  dagdeel,
  service_id,
  team,
  COUNT(*) as actual_count,
  MAX(status) as status_range
FROM roster_assignments
WHERE status = 1
GROUP BY date, dagdeel, service_id, team;

-- Compare with staffing requirements
SELECT
  date,
  dagdeel,
  service_id,
  team,
  aantal as max_capacity,
  invulling as db_invulling
FROM roster_period_staffing_dagdelen
ORDER BY date, service_id;
```

---

## 🔧 TROUBLESHOOTING

### Issue: "Variant not found"
**Cause:** Service/team combination not in `roster_period_staffing_dagdelen`  
**Solution:** Verify staffing configuration for that service/team/date

### Issue: Capacity shows available but assignment fails
**Cause:** Race condition or concurrent writes  
**Solution:** Retry logic with exponential backoff (handled by solve-engine)

### Issue: actualCount ≠ invulling
**Cause:** Database trigger not firing or orphaned records  
**Solution:** Manual sync: `UPDATE roster_period_staffing_dagdelen SET invulling = (SELECT COUNT(*) FROM roster_assignments WHERE ...)`

---

## 📚 REFERENCES

- **DRAAD408:** Capacity check fix
- **DRAAD400:** Team-variant expansion logic
- **DRAAD399:** Staffing variant structure
- **Database:** `roster_period_staffing_dagdelen` + `roster_assignments`

---

## ✅ SIGN-OFF

**Implementation:** v4.1 Complete  
**Testing:** All scenarios pass  
**Deployment:** Live on Railway  
**Date:** 2026-01-10  
**Cache Buster:** `railway-1736502660000`
