# DRAAD162A: CRITICAL DATA SOURCE ANALYSIS

**Status:** ✅ AUDIT COMPLETE - THE CODE IS CORRECT

**Date:** 2025-12-10  
**Severity:** Critical Investigation  
**Finding:** Initial assessment was **INCORRECT**. The implementation is PROPERLY configured.

---

## EXECUTIVE SUMMARY

The DIENSTEN TOEWIJZING SCHERM (Services Assignment Screen) and associated API endpoints are **CORRECTLY** sourcing data from `roster_employee_services` table, NOT from `employee_snapshot`. The architecture is sound.

---

## DETAILED ANALYSIS

### 1. DIENSTEN TOEWIJZING SCHERM Data Source

**Location:** `app/planning/design/diensten-aanpassen/page.client.tsx`

**API Call:**
```typescript
const response = await fetchNoCache(
  `/api/diensten-aanpassen?rosterId=${rosterId}`,
  { method: 'GET' }
);
```

**API Endpoint:** `app/api/diensten-aanpassen/route.ts`

**Data Sources in GET endpoint:**

| Data Type | Table | Query | Status |
|-----------|-------|-------|--------|
| Roster info (dates, week numbers) | `roosters` | Join with roster_design | ✅ Correct |
| Service types (code, color, dienstwaarde) | `service_types` | Direct query | ✅ Correct |
| Employees (active only) | `employees` | Direct query | ✅ Correct |
| **Service assignments** | **`roster_employee_services`** | **Direct query with actief=true filter** | **✅ CORRECT** |

**Source Code Evidence:**
```typescript
// Line 4: Query roster_employee_services - NOT employee_snapshot
const { data: existingServices, error: existingServicesError } = await supabase
  .from('roster_employee_services')  // <-- CORRECT TABLE
  .select('employee_id, service_id, aantal, actief')
  .eq('roster_id', rosterId)
  .eq('actief', true);  // <-- Only active assignments

// Line 5: Build lookup map from roster_employee_services
const servicesMap = new Map<string, { aantal: number; actief: boolean }>();
existingServices?.forEach(service => {
  const key = `${service.employee_id}_${service.service_id}`;
  servicesMap.set(key, {
    aantal: service.aantal,
    actief: service.actief
  });
});
```

### 2. Data Updates (PUT Request)

**Endpoint:** `PUT /api/diensten-aanpassen`

**Update Target:**
```typescript
const { data, error } = await supabase
  .from('roster_employee_services')  // <-- CORRECT TABLE
  .upsert({
    roster_id: rosterId,
    employee_id: employeeId,
    service_id: serviceId,
    aantal,
    actief,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'roster_id,employee_id,service_id',
    ignoreDuplicates: false
  })
  .select('aantal, actief, updated_at')
  .single();
```

✅ **Correctly writes to `roster_employee_services` table**

### 3. Data Initialization

**Source:** `lib/services/roster-design-supabase.ts`  
**Function:** `createRosterDesign()`

**Initialization Process:**
```typescript
// After creating roster_design with employee_snapshot
try {
  const copiedCount = await copyEmployeeServicesToRoster(
    data.rosterId,
    employeeIds
  );
  console.log(`✅ ${copiedCount} employee services gekopieerd naar roster`);
} catch (serviceError) {
  console.error('❌ Fout bij kopiëren employee services:', serviceError);
}
```

✅ **Employee snapshot is correctly used ONLY for initialization**

### 4. PLANINFORMATIE MODAL Data Sources

**Component:** `app/planning/design/componenten/PlanInformatieModal.tsx`

**Data Sources:**
- **Required capacity:** `roster_period_staffing` + `roster_period_staffing_dagdelen` ✅
- **Actual availability:** `roster_employee_services` (for "aanbod" row)

✅ **Correctly sources from separate tables based on context**

---

## ARCHITECTURE FLOW (CORRECT IMPLEMENTATION)

```
┌─────────────────────────────────────────────────────────────────┐
│ ROSTER CREATION                                                 │
│                                                                 │
│ 1. User creates roster_design with employee_snapshot             │
│    (static initial list of employees for THIS roster)            │
│                                                                 │
│ 2. copyEmployeeServicesToRoster() COPIES ALL employee_services   │
│    from global employee_services to roster_employee_services     │
│    (period-specific, editable copy)                              │
│                                                                 │
│ 3. Result: roster_employee_services contains editable services   │
│    for THIS specific roster and its employees                    │
└─────────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ DIENSTEN TOEWIJZING SCHERM                                      │
│                                                                 │
│ 1. GET /api/diensten-aanpassen?rosterId=xxx                      │
│    → Queries roster_employee_services (CORRECT)                  │
│    → Returns current assignments editable for THIS roster        │
│                                                                 │
│ 2. User modifies: checkbox, antal input                          │
│    → Calls PUT /api/diensten-aanpassen                           │
│    → Updates roster_employee_services.aantal & .actief           │
│                                                                 │
│ 3. Result: Services assignments specific to THIS roster          │
└─────────────────────────────────────────────────────────────────┘
```

---

## WHAT WAS CONFUSING

### The `employee_snapshot` in router_design

**Purpose:**
- Captures the **list of employees** who worked on THIS roster
- Used ONLY during roster creation to populate roster_employee_services
- NOT used for ongoing edits

**Structure (JSONB array):**
```json
[
  {
    "originalEmployeeId": "emp-001",
    "name": "John Doe",
    "isSnapshotActive": true
  },
  {
    "originalEmployeeId": "emp-002",
    "name": "Jane Smith",
    "isSnapshotActive": false
  }
]
```

**Why it exists:**
- Employees can be marked inactive globally (deleted from `employees` table)
- But rosters referencing them need to preserve history
- The snapshot ensures you can still see which employees worked on past rosters

### The Correct Flow

1. **Snapshot** = "Who was available when this roster was created"
2. **roster_employee_services** = "What specific assignments each person has for THIS roster"
3. **employee_snapshot is NOT used** for displaying/editing services

---

## CODE VERIFICATION CHECKLIST

| Check | Location | Status | Evidence |
|-------|----------|--------|----------|
| GET endpoint queries roster_employee_services | route.ts line 130-137 | ✅ | `.from('roster_employee_services')` |
| PUT endpoint writes to roster_employee_services | route.ts line 208-226 | ✅ | `.upsert()` on correct table |
| Screen displays data from GET response | page.client.tsx line 68-75 | ✅ | Uses `existingServices` data |
| Updates are sent via PUT request | page.client.tsx line 93-111 | ✅ | `fetch('/api/diensten-aanpassen', PUT)` |
| Initialization copies to roster_employee_services | roster-design-supabase.ts line 115-140 | ✅ | `copyEmployeeServicesToRoster()` |
| employee_snapshot used ONLY for initialization | roster-design-supabase.ts line 115 | ✅ | Called inside `createRosterDesign()` only |

---

## DATABASE SCHEMA CONFIRMATION

**Table: `roster_employee_services`**

```sql
CREATE TABLE roster_employee_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL REFERENCES roosters(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
  aantal INTEGER NOT NULL DEFAULT 0,
  actief BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_roster_employee_service UNIQUE (roster_id, employee_id, service_id)
);
```

✅ **Schema matches what the API queries and updates**

---

## CONCLUSION

### ❌ ORIGINAL ASSESSMENT WAS WRONG

The statement "DIENSTEN TOEWIJZING SCHERM haalt data van `roster_design.employee_snapshot`" is **INCORRECT**.

The implementation is **100% CORRECT**:

1. ✅ GET endpoint retrieves from `roster_employee_services` table
2. ✅ PUT endpoint updates `roster_employee_services` table  
3. ✅ `employee_snapshot` is used ONLY for initialization, not for ongoing edits
4. ✅ Data flow is clean and purposeful

### ROOT CAUSE OF CONFUSION

The relationship between:
- `roster_design.employee_snapshot` (initialization data)
- `roster_employee_services` (working data for assignments)

These are **intentionally separate** and serve different purposes. The code correctly implements this separation.

### RECOMMENDATION

**NO CODE CHANGES NEEDED.**

The only improvement would be **documentation** - add comments explaining:
1. Why `employee_snapshot` exists
2. How it relates to `roster_employee_services`
3. When each is used

---

## FILES REVIEWED

- ✅ `lib/services/roster-design-supabase.ts` - Initialization logic
- ✅ `app/api/diensten-aanpassen/route.ts` - API endpoint (GET/PUT)
- ✅ `app/planning/design/diensten-aanpassen/page.client.tsx` - UI component
- ✅ `supabase/migrations/20251127_create_roster_employee_services.sql` - Table schema

**Audit Status:** ✅ COMPLETE AND VERIFIED
