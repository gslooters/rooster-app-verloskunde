# 🚀 DRAAD 402 - OPERATIVE FIXES OPDRACHT
**Status**: READY FOR EXECUTION  
**Datum**: 31 december 2025, 01:20 CET  
**Prioriteit**: 🔴 BLOCKER - CRITICAL  
**Scope**: DienstSelectieModal + parent handler + cache-busting

---

## 📋 CONTEXT CORRECTION

### Wat ik FOUT had begrepen:
❌ Dacht: `service.id` is de Key voor radio button selection
❌ Dacht: Multiple variants hebben DEZELFDE `service_id`

### Wat de REALITEIT is:
✅ **`roster_period_staffing_dagdelen.id`** is de UNIEKE key!
✅ Dit is de variant identifier die moet worden gebruikt voor radio button selection
✅ `service_id` is ALLEEN nodig voor code/beschrijving weergave
✅ MEERDERE records in `roster_period_staffing_dagdelen` kunnen DEZELFDE `service_id` hebben (maar met VERSCHILLENDE `id`)

### Modalen Logic:

**Modal 1: Normal Mode (Gefilterde diensten)**
- Haalt diensten uit `roster_period_staffing_dagdelen` met `status='MAG'`
- Combinatie: `service_id` + `team` (team variant)
- Medewerker mag deze diensten werken (uit `roster_employee_services`)
- **Key voor radio selection**: `roster_period_staffing_dagdelen.id` (UNIEKE identifier)

**Modal 2: "Toon alle diensten" Mode**
- Haalt ALLE diensten voor dagdeel (3 teams × 9 services = 27 opties)
- Voor planners in bijzondere situaties
- **Key voor radio selection**: HETZELFDE - `roster_period_staffing_dagdelen.id`

---

## 🔍 GESTELDE DIAGNOSTISCHE VRAGEN - ANTWOORDEN VERWERKT

### Vraag 1: ✅ ANSWERED
**"Is getServicesForEmployeeFiltered() teruggegeven van MEERDERE records met DEZELFDE service.id?"**

**ANTWOORD**: JA - Maar we moeten `roster_period_staffing_dagdelen.id` gebruiken als KEY, niet `service_id`!

**Consequentie voor code**:
```typescript
interface ServiceTypeWithTimes {
  id: string;              // ⭐ Dit is: roster_period_staffing_dagdelen.id (UNIEKE KEY!)
  service_id: string;      // ← Dit is: service_types.id (voor code/beschrijving)
  code: string;            // Service code (uit service_types)
  naam: string;            // Service naam (uit service_types)
  team_variant?: string;   // Team (GRO/ORA/TOT)
  variant_id?: string;     // Alias/same as id (voor backwards compat)
}
```

**Dit VERANDERT alles**: De radio button selection moet `id` (=roster_period_staffing_dagdelen.id) gebruiken, NIET `service_id`!

### Vraag 2: ✅ ANSWERED
**"Moeten 'MSP [Groen]' en 'MSP [Oranje]' aparte radio button opties zijn?"**

**ANTWOORD**: JA - Beide zijn APARTE `roster_period_staffing_dagdelen` records
- Record 1: id='UUID-001', service_id='SERVICE-ABC', team='GRO'
- Record 2: id='UUID-002', service_id='SERVICE-ABC', team='ORA'
- **Radio buttons**: Beide MOETEN APARTE buttons zijn (ik had gelijk!)

### Vraag 3: ✅ ANSWERED
**"Hoeveel service variants kunnen er zijn voor 1 employee/date/dagdeel?"**

**ANTWOORD**: 
- **Mode 1 (Gefilterd)**: Varies (afhankelijk van bevoegdheden + planning)
- **Mode 2 (All)**: Max 27 (3 teams × 9 service types)

---

## 🔧 FIXES NODIG (5 KRITIEKE CHANGES)

### FIX #1: Modal State - Add selectedVariantId

**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: Na regel 70 (na `selectedStatus` state)

**CURRENT**:
```typescript
const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
const [selectedStatus, setSelectedStatus] = useState<CellStatus>(0);
```

**FIX**:
```typescript
const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);  // ⭐ NEW - roster_period_staffing_dagdelen.id
const [selectedStatus, setSelectedStatus] = useState<CellStatus>(0);
```

**Reden**: Nodig om UNIEKE variant (roster_period_staffing_dagdelen record) te tracken, niet alleen service_id

---

### FIX #2: handleServiceSelect Function

**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 139-142

**CURRENT**:
```typescript
function handleServiceSelect(serviceId: string) {
  setSelectedServiceId(serviceId);
  setSelectedStatus(1);
}
```

**FIX**:
```typescript
function handleServiceSelect(variantId: string, serviceId: string) {  // ⭐ variantId FIRST param
  setSelectedVariantId(variantId);  // ⭐ Set variant (roster_period_staffing_dagdelen.id)
  setSelectedServiceId(serviceId);   // Set service (service_types.id)
  setSelectedStatus(1);
}
```

**Reden**: Must capture BOTH the unique variant ID (for database) AND the service ID (for display)

---

### FIX #3: Radio Button Selection Logic

**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 235-260 (in services map/render)

**CURRENT**:
```typescript
{[...availableServices]
  .sort((a, b) => { ... })
  .map(service => (
  <label key={`${service.id}-${service.variant_id}`}>
    <input
      type="radio"
      name="dienst"
      value={service.id}  // ❌ Should be service.id (roster_period_staffing_dagdelen.id)
      checked={selectedServiceId === service.id && selectedStatus === 1}  // ❌ WRONG LOGIC
      onChange={() => handleServiceSelect(service.id)}  // ❌ Missing variantId param
    />
```

**FIX**:
```typescript
{[...availableServices]
  .sort((a, b) => { ... })
  .map(service => (
  <label key={service.id}>  // ⭐ Key is roster_period_staffing_dagdelen.id (UNIEKE)
    <input
      type="radio"
      name="dienst"
      value={service.id}  // ✅ CORRECT: roster_period_staffing_dagdelen.id
      checked={selectedVariantId === service.id && selectedStatus === 1}  // ⭐ Check VARIANT_ID not service_id
      onChange={() => handleServiceSelect(service.id, service.service_id)}  // ⭐ Pass both IDs
    />
```

**Reden**: Radio button selection must use the UNIQUE identifier (roster_period_staffing_dagdelen.id), not service_id

---

### FIX #4: handleSave() - Add variantId for Status 0/2/3

**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 166-172

**CURRENT**:
```typescript
function handleSave() {
  if (selectedStatus === 1) {
    const selectedService = availableServices.find(s => s.id === selectedServiceId);
    const variantId = selectedService?.variant_id || null;
    onSave(selectedServiceId, 1, variantId);
  } else if (selectedStatus === 0) {
    onSave(null, 0);  // ❌ Missing variantId
  } else if (selectedStatus === 2) {
    onSave(null, 2);  // ❌ Missing variantId
  } else if (selectedStatus === 3) {
    onSave(null, 3);  // ❌ Missing variantId
  }
}
```

**FIX**:
```typescript
function handleSave() {
  if (selectedStatus === 1) {
    // ✅ Status 1: User selected a service
    if (!selectedServiceId || !selectedVariantId) {
      alert('Selecteer een dienst');
      return;
    }
    // Get variant_id from selected service (roster_period_staffing_dagdelen.id)
    const variantId = selectedVariantId;  // Use stored selectedVariantId
    onSave(selectedServiceId, 1, variantId);  // ✅ HAS variantId
  } else if (selectedStatus === 0) {
    // ✅ Status 0: Delete (Leeg)
    // Pass selectedVariantId so trigger can decrement invulling
    onSave(null, 0, selectedVariantId);  // ⭐ Add variantId for DB trigger
  } else if (selectedStatus === 2) {
    // ✅ Status 2: Blocked (Blokkade)
    onSave(null, 2, selectedVariantId);  // ⭐ Add variantId
  } else if (selectedStatus === 3) {
    // ✅ Status 3: NB (Niet Beschikbaar)
    onSave(null, 3, selectedVariantId);  // ⭐ Add variantId
  }
}
```

**Reden**: Delete operations NEED variantId to trigger DB cascade (decrement invulling counter)

---

### FIX #5: Cache-Busting - Hardcode Timestamp

**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 11 (in header comment)

**CURRENT**:
```typescript
* Cache: ${Date.now()}
```

**FIX**:
```typescript
* Cache: 2025-12-31T01:20:00Z  // ⭐ Actual hardcoded timestamp
```

**Reden**: Template literal NOT evaluated in comments. Must hardcode actual timestamp for each commit.

---

### FIX #6: Parent Handler Reset Selected State on Modal Close

**Bestand**: `app/planning/design/preplanning/client.tsx`  
**In**: Modal close callback (regel ~375)

**CURRENT**:
```typescript
<DienstSelectieModal
  isOpen={modalOpen}
  cellData={selectedCell}
  onClose={() => {
    setModalOpen(false);
    setSelectedCell(null);
  }}
```

**FIX** (if needed):
```typescript
// Modal close should reset state
// This might already be correct, but verify that selectedVariantId resets on modal open
```

---

## 📊 CHANGE SUMMARY

| FIX | File | Lines | Changes | Severity |
|-----|------|-------|---------|----------|
| #1 | Modal.tsx | 70 | Add `selectedVariantId` state | 🔴 CRITICAL |
| #2 | Modal.tsx | 139-142 | Update `handleServiceSelect` signature | 🔴 CRITICAL |
| #3 | Modal.tsx | 235-260 | Fix radio button logic (use variant ID) | 🔴 CRITICAL |
| #4 | Modal.tsx | 166-172 | Add variantId for status 0/2/3 | 🟡 MEDIUM |
| #5 | Modal.tsx | 11 | Hardcode cache-busting timestamp | 🟡 MEDIUM |
| #6 | Modal.tsx | (verify) | Ensure state reset on modal lifecycle | 🟢 LOW |

---

## ✅ VERIFICATION CHECKLIST

After implementing fixes, verify:

- [ ] **Fix #1**: `selectedVariantId` state declared and visible in component
- [ ] **Fix #2**: `handleServiceSelect` accepts `variantId` parameter
- [ ] **Fix #3**: Radio button `checked` logic uses `selectedVariantId === service.id`
- [ ] **Fix #3**: Radio button `onChange` passes BOTH ids: `handleServiceSelect(service.id, service.service_id)`
- [ ] **Fix #4**: Status 0 calls `onSave(null, 0, selectedVariantId)`
- [ ] **Fix #4**: Status 2 calls `onSave(null, 2, selectedVariantId)`
- [ ] **Fix #4**: Status 3 calls `onSave(null, 3, selectedVariantId)`
- [ ] **Fix #5**: Timestamp is hardcoded (not template literal)
- [ ] **User Testing**: User can select "MSP [Groen]" AND "MSP [Oranje]" independently
- [ ] **User Testing**: Only ONE radio button checked at a time
- [ ] **Database**: variantId is saved to `roster_assignments.roster_period_staffing_dagdelen_id`
- [ ] **Database**: Delete operations trigger invulling counter decrement
- [ ] **Cache**: New deployment clears browser cache

---

## 🚀 DEPLOYMENT STEPS

1. **Create Branch**: `git checkout -b DRAAD402-FIXES`
2. **Apply Fix #1-6** to `DienstSelectieModal.tsx`
3. **Commit**: `git commit -m "DRAAD402: Fix radio button variant selection + cache-busting"`
4. **Push**: `git push origin DRAAD402-FIXES`
5. **Railway**: Deploys automatically
6. **Verify**: Test in browser (clear cache: Ctrl+Shift+Del)

---

## 📝 IMPLEMENTATION NOTES

### Key Insight
The confusion arose because:
- `getServicesForEmployeeFiltered()` returns records with SAME `service_id` but DIFFERENT `id` (roster_period_staffing_dagdelen.id)
- Radio button selection needs the UNIQUE identifier (`id`), not the service type (`service_id`)
- Display still uses `service_id` for code/name/description

### UI Behavior After Fix
```
Modal shows:
[ ] ECH [Praktijk] (Echo)           id='VAR-001', service_id='SERVICE-ABC'
[o] MSP [Groen] (Middag spreekuur)  id='VAR-002', service_id='SERVICE-DEF'  ← CHECKED
[ ] MSP [Oranje] (Middag spreekuur) id='VAR-003', service_id='SERVICE-DEF'  ← DIFFERENT id!
[ ] DIO (Dienst Ochtend Middag)     id='VAR-004', service_id='SERVICE-GHI'
```

Both MSP variants have SAME service_id but DIFFERENT id → Radio buttons now work correctly!

---

## ⚠️ WARNINGS

1. **State Reset**: Ensure `selectedVariantId` is reset when modal reopens for new cell
2. **Backwards Compat**: If `variant_id` is used elsewhere, update references
3. **Database**: Verify `roster_period_staffing_dagdelen_id` field exists in `roster_assignments`
4. **Trigger**: Verify Supabase trigger uses `roster_period_staffing_dagdelen.id` for invulling decrement

---

**OPDRACHT READY FOR EXECUTION**

Estimated Time: 25-30 minutes
Complexity: MEDIUM
Risk Level: LOW (isolated component changes)
Test Coverage: HIGH (radio button selection is immediately testable)

---

**Created**: 31 DEC 2025, 01:20 CET
**Next Step**: Execute fixes in DRAAD 402 thread