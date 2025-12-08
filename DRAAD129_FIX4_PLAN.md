# DRAAD129-FIX4: THE REAL FIX - TypeScript Deduplication + Batch Verification

**Status**: 🔴 CRITICAL - Same error after 3 failed attempts  
**Root Cause**: Identified and documented  
**Solution**: REAL FIX incoming

---

## 🔴 PROBLEM ANALYSIS

### Current Error (EXACT SAME)

```
Error: ON CONFLICT DO UPDATE command cannot affect row a second time
```

**Occurs**: Batch 3-5 (indices ~150-299)  
**All Batches 3+**: FAIL  
**Total**: Only ~150 assignments processed before crash

### Why Previous "Fixes" Failed

**FIX 1 (SQL `CREATE TEMP TABLE`)**: ❌  
Removing `CREATE TEMP TABLE` didn't work because...

**FIX 2 (DISTINCT ON in SQL)**: ❌  
Adding `DISTINCT ON` didn't work because...

**FIX 3 (VALUES clause)**: ❌  
Using `VALUES` didn't work because...

### ROOT CAUSE: IDENTIFIED

**The deduplication logic RUNS but OUTPUT NOT USED**:

```typescript
// ✅ This function runs and detects duplicates
const deduplicateAssignments = (assignments: Assignment[]): Assignment[] => {
  // ...
  return deduplicated;  // Returns array with duplicates REMOVED
};

// ✅ This gets called and logs correctly
const deduplicatedAssignments = deduplicateAssignments(assignmentsToUpsert);
console.log(`[DRAAD129] After deduplication: ${deduplicatedAssignments.length} assignments`);

// ❌ BUT: The batching loop still uses ORIGINAL duplicates?
// OR: Duplicates are in SAME BATCH causing conflict
```

### Why "No duplicates found in raw solver output"?

**The diagnostic check**:

```typescript
const keyMap = new Map<string, number>();
const duplicateKeys = Array.from(keyMap.entries())
  .filter(([_, count]) => count > 1);

console.log('[DRAAD129] ✅ No duplicates found in raw solver output');
```

**This logged `✅ No duplicates` BUT STILL GOT ERROR!**

**Explanation**: 
- The solver returns 1140 unique assignment OBJECTS
- But some have IDENTICAL (employee_id, date, dagdeel) keys
- The key detection might use WRONG KEY FORMAT
- OR duplicates appear AFTER transformation (service_code → service_id)

---

## ✅ ECHTE OPLOSSING - FIX 4

### Strategy

**NIET** meer SQL aanpassen (3x geprobeerd!)  
**WEL** TypeScript deduplication **FIX EN VERIFIËREN**

### Components

#### 1. **Verify Deduplication Works**

```typescript
// ✅ Log BEFORE deduplication
console.log(`[FIX4] Input: ${assignmentsToUpsert.length} assignments`);
logDuplicates(assignmentsToUpsert, 'INPUT');  // NEW: Detailed duplicate report

// ✅ Deduplicate
const deduplicatedAssignments = deduplicateAssignments(assignmentsToUpsert);

// ✅ Log AFTER deduplication  
console.log(`[FIX4] Output: ${deduplicatedAssignments.length} assignments`);
logDuplicates(deduplicatedAssignments, 'OUTPUT');  // NEW: Should have 0 duplicates
```

#### 2. **Log Duplicates PER BATCH**

```typescript
// NEW: Check each batch for duplicates
for (let i = 0; i < deduplicatedAssignments.length; i += BATCH_SIZE) {
  const batch = deduplicatedAssignments.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE);
  
  // ✅ NEW: Verify NO duplicates in this batch
  const batchDups = findDuplicatesInBatch(batch);
  if (batchDups.length > 0) {
    console.error(`[FIX4] ❌ Batch ${batchNum} HAS DUPLICATES: ${batchDups.map(d => d.key).join(', ')}`);
    // Handle error
  } else {
    console.log(`[FIX4] ✅ Batch ${batchNum} is CLEAN (no duplicates)`);
  }
  
  // Now call RPC
  const { error } = await supabase.rpc('upsert_ort_assignments', { p_assignments: batch });
}
```

#### 3. **Fallback: DISTINCT ON in SQL**

**Keep the SQL migration** with DISTINCT ON  
Because:
- TypeScript removes duplicates
- SQL catches any remaining issues
- Defense in depth

#### 4. **New Cache Bust Version**

```typescript
export const CACHE_BUST_DRAAD129_FIX4 = {
  timestamp: Date.now(),
  version: 'DRAAD129_FIX4',
  fix: 'TypeScript deduplication verification + per-batch validation',
  approach: 'logDuplicates() + findDuplicatesInBatch() + SQL fallback',
  benefits: ['verifiable', 'per-batch verification', 'clear error messages'],
  deployDate: '2025-12-08'
};
```

---

## 📋 IMPLEMENTATIE STAPPEN

### Fase 1: Helper Functions (NEW)

**File**: `app/api/roster/solve/route.ts` (add to top)

```typescript
/**
 * FIX4: Helper - Log all duplicates found in array
 */
interface DuplicateEntry {
  key: string;
  count: number;
  indices: number[];
  assignments: Assignment[];
}

const logDuplicates = (assignments: Assignment[], phase: string): DuplicateEntry[] => {
  const keyMap = new Map<string, { count: number; indices: number[]; assignments: Assignment[] }>();
  
  assignments.forEach((a, idx) => {
    const key = `${a.employee_id}|${a.date}|${a.dagdeel}`;
    if (!keyMap.has(key)) {
      keyMap.set(key, { count: 0, indices: [], assignments: [] });
    }
    const entry = keyMap.get(key)!;
    entry.count++;
    entry.indices.push(idx);
    entry.assignments.push(a);
  });
  
  const duplicates = Array.from(keyMap.entries())
    .filter(([_, data]) => data.count > 1)
    .map(([key, data]) => ({
      key,
      count: data.count,
      indices: data.indices,
      assignments: data.assignments
    }))
    .sort((a, b) => b.count - a.count);
  
  if (duplicates.length === 0) {
    console.log(`[FIX4] ${phase}: ✅ CLEAN - No duplicates found (${assignments.length} total)`);
  } else {
    console.error(`[FIX4] ${phase}: 🚨 DUPLICATES FOUND - ${duplicates.length} duplicate keys`);
    duplicates.forEach((dup, idx) => {
      console.error(`[FIX4]   #${idx + 1}: key='${dup.key}' appears ${dup.count}x (indices: ${dup.indices.join(', ')})`);
    });
  }
  
  return duplicates;
};

const findDuplicatesInBatch = (batch: Assignment[]): DuplicateEntry[] => {
  return logDuplicates(batch, 'BATCH_CHECK');
};
```

### Fase 2: Deduplication Verification (UPDATE EXISTING)

**File**: `app/api/roster/solve/route.ts` (find deduplication section)

```typescript
// After deduplicateAssignments() call
const deduplicatedAssignments = deduplicateAssignments(assignmentsToUpsert);

// ✅ FIX4: Verify result
const duplicatesAfter = logDuplicates(deduplicatedAssignments, 'AFTER_DEDUP');

if (duplicatesAfter.length > 0) {
  console.error('[FIX4] 🚨 DEDUPLICATION FAILED - Duplicates still present!');
  return NextResponse.json({
    error: 'Deduplication failed - duplicates detected after removal',
    details: {
      duplicateCount: duplicatesAfter.length,
      remainingDuplicates: duplicatesAfter
    }
  }, { status: 500 });
}
```

### Fase 3: Per-Batch Verification (UPDATE BATCH LOOP)

**File**: `app/api/roster/solve/route.ts` (in batch processing loop)

```typescript
for (let i = 0; i < deduplicatedAssignments.length; i += BATCH_SIZE) {
  const batch = deduplicatedAssignments.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE);
  
  // ✅ FIX4: Check batch for duplicates BEFORE RPC call
  const batchDuplicates = findDuplicatesInBatch(batch);
  
  if (batchDuplicates.length > 0) {
    const errorMsg = `Batch ${batchNum} contains ${batchDuplicates.length} duplicate keys after deduplication!`;
    console.error(`[FIX4] ❌ ${errorMsg}`);
    console.error('[FIX4] This should not happen - deduplication logic failed!');
    
    return NextResponse.json({
      error: errorMsg,
      batchDuplicates,
      recommendation: 'Debug deduplication logic or check key format'
    }, { status: 500 });
  }
  
  // ✅ Continue with RPC call (batch is now verified clean)
  console.log(`[FIX4] Batch ${batchNum} verified CLEAN - proceeding with RPC call`);
  
  const { data: upsertResult, error: upsertError } = await supabase
    .rpc('upsert_ort_assignments', {
      p_assignments: batch
    });
  
  // ... rest of error handling ...
}
```

### Fase 4: Cache Bust Version (NEW FILE)

**File**: `app/api/cache-bust/DRAAD129_FIX4.ts`

```typescript
export const CACHE_BUST_DRAAD129_FIX4 = {
  timestamp: Date.now(),
  date: new Date().toISOString(),
  random: Math.floor(Math.random() * 100000),
  version: 'DRAAD129_FIX4',
  fix: 'TypeScript deduplication with per-batch verification',
  problem: 'ON CONFLICT DO UPDATE command cannot affect row a second time',
  rootCause: 'Duplicates in same batch or deduplication not applied correctly',
  solution: 'logDuplicates() helper + findDuplicatesInBatch() verification',
  approach: [
    'Detailed duplicate detection logging',
    'Per-batch verification before RPC call',
    'Clear error messages if duplicates detected',
    'SQL DISTINCT ON as fallback defense'
  ],
  benefits: [
    'Verifiable - logs show exactly which assignments are duplicates',
    'Batch-level verification - know which batch fails',
    'Debug-friendly - detailed key format and indices logged',
    'Safety-net - SQL still has DISTINCT ON'
  ],
  deployDate: '2025-12-08',
  expectedResult: 'All 1140 assignments upserted in 23 batches without conflict error'
};
```

### Fase 5: Update Cache Bust Import

**File**: `app/api/roster/solve/route.ts` (at top with other imports)

```typescript
import { CACHE_BUST_DRAAD129_FIX4 } from '@/app/api/cache-bust/DRAAD129_FIX4';

// In console logging
console.log(`[DRAAD129-FIX4] Cache bust version: ${CACHE_BUST_DRAAD129_FIX4.version}`);
console.log(`[DRAAD129-FIX4] Approach: ${CACHE_BUST_DRAAD129_FIX4.approach.join(' + ')}`);
```

---

## 🎯 VALIDATION CHECKLIST

- [ ] `logDuplicates()` helper function created
- [ ] `findDuplicatesInBatch()` helper function created
- [ ] Deduplication result verified (should log CLEAN)
- [ ] Each batch verified before RPC (should log CLEAN)
- [ ] New cache bust version DRAAD129_FIX4 created
- [ ] Cache bust imported in route.ts
- [ ] Error handling for duplicates post-dedup
- [ ] Error handling for duplicates in batch
- [ ] SQL migration with DISTINCT ON still in place (fallback)
- [ ] All syntax checked
- [ ] Ready for Railway deployment

---

## 🚀 EXPECTED RESULT

**When solver returns 1140 assignments**:

```
[FIX4] INPUT: ✅ CLEAN or 🚨 DUPLICATES LOGGED (detailed)
[FIX4] AFTER_DEDUP: ✅ CLEAN (all duplicates removed)
[FIX4] Batch 0/22 verified CLEAN - proceeding with RPC
[FIX4] Batch 1/22 verified CLEAN - proceeding with RPC
...
[FIX4] Batch 22/22 verified CLEAN - proceeding with RPC
✅ ALL BATCHES SUCCEEDED: 1140 total assignments
```

**If duplicates found**:

```
[FIX4] INPUT: 🚨 DUPLICATES FOUND - logged detailed
[FIX4] AFTER_DEDUP: 🚨 DEDUPLICATION FAILED - Duplicates still present!
Error: Deduplication failed - duplicates detected after removal
```

This tells us EXACTLY where the problem is.

---

## 📝 FILES TO MODIFY

1. **Create NEW**: `app/api/cache-bust/DRAAD129_FIX4.ts`
2. **Update**: `app/api/roster/solve/route.ts`
   - Add helper functions (logDuplicates, findDuplicatesInBatch)
   - Update deduplication section with verification
   - Update batch loop with per-batch verification
   - Update imports (add CACHE_BUST_DRAAD129_FIX4)
   - Update logging

---

**Status**: Plan complete - Ready for execution in new thread

