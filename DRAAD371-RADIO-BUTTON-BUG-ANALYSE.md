# 🔴 DRAAD 371 - RADIO BUTTON SELECTIE BUG
**Status**: DIEPGAANDE ANALYSE - Waarom Fix NIET werkt  
**Datum**: 31 december 2025, 01:10 CET  
**Niveau**: CRITICAL BLOCKER - USER CANNOT SELECT VARIANT

---

## 📸 USER SYMPTOMEN

**Image 1 - Andrea B (Dinsdag Middag)**:
- Services listed: "MSP [Groen]" en "MSP [Oranje]"  
- User wil "Groen" aanwijzen  
- **MAAR**: Radiobutton van "Oranje" is GESELECTEERD (blauwe cirkel)  
- User kan "Groen" NIET aanwijzen - alleen "Oranje" gaat aan/uit  

**Image 3 - Paula Heslenveld (Dinsdag Middag)**:
- Scroll bar zichtbaar (veel services)  
- "Leeg (verwijder dienst)" is GESELECTEERD (blauwe cirkel)  
- Services tonen correct, maar WAARSCHIJNLIJK hetzelfde radio button probleem  

**Root Problem**: 
- User klikt op "Groen" radio button  
- Maar "Oranje" radio button blijft checked  
- OF vice versa: "Oranje" klikt aan/uit maar "Groen" NIET responsief  

---

## 🔍 CODE ANALYSE - WAAR GAAT HET FOUT?

### ONTDEKKING #1: Radio Button Selection Logic

**DienstSelectieModal.tsx - regel 139-142**:
```typescript
function handleServiceSelect(serviceId: string) {
  setSelectedServiceId(serviceId);
  setSelectedStatus(1); // Dienst = status 1
}
```

**Problem**: `handleServiceSelect` is NIET volledig.

Het wijzigt:
1. ✅ `selectedServiceId` → de service UUID
2. ✅ `selectedStatus` → 1 (dienst mode)

**MAAR**: De radio button `checked` conditional check op regel 253:
```typescript
checked={selectedServiceId === service.id && selectedStatus === 1}
```

**Dit werkt THEORETISCH**, want:
- Wanneer user klikt op "Groen" (service.id = ABC123, team_variant = GRO)
- `setSelectedServiceId('ABC123')` wordt uitgevoerd
- `setSelectedStatus(1)` wordt uitgevoerd
- Radio button conditional: `'ABC123' === 'ABC123' && 1 === 1` → TRUE
- Button rendert als CHECKED ✅

**ECHTER**: Er is een DIEPERE BUG!

---

### ONTDEKKING #2: Service Key Problem - VARIANT_ID NOT UNIQUE KEY

**DienstSelectieModal.tsx - regel 238-249**:
```typescript
{[...availableServices]
  .sort((a, b) => {
    // Sort by code first, then by team variant
    const codeCompare = a.code.localeCompare(b.code, 'nl');
    if (codeCompare !== 0) return codeCompare;
    // If code is the same, sort by team variant
    return (a.team_variant || '').localeCompare(b.team_variant || '', 'nl');
  })
  .map(service => (
  <label
    key={`${service.id}-${service.variant_id}`}  // ⚠️ KEY PROBLEEM
    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
  >
    <input
      type="radio"
      name="dienst"
      value={service.id}  // ❌ VALUE IS ALLEEN service.id
      checked={selectedServiceId === service.id && selectedStatus === 1}  // ❌ PROBLEM HERE
      onChange={() => handleServiceSelect(service.id)}  // ❌ PROBLEM HERE
      className="w-4 h-4 text-blue-600"
      disabled={readOnly || isSaving}
    />
```

**KRITIEKE FOUT**:

WANNEER er **MEERDERE SERVICES DEZELFDE CODE** zijn (bv. MSP met GRO en ORA):n

```
Service 1: id='ABC123', code='MSP', team_variant='GRO', variant_id='VAR-GRO-001'
Service 2: id='ABC123', code='MSP', team_variant='ORA', variant_id='VAR-ORA-002'
```

**PROBLEM**: Beide services hebben `id='ABC123'` !

- Radio button 1: `checked={selectedServiceId === 'ABC123' && selectedStatus === 1}`
- Radio button 2: `checked={selectedServiceId === 'ABC123' && selectedStatus === 1}`
- **BEIDE buttons render als CHECKED gleichzeitig** ❌

Dit is **ILLEGAL in HTML Radio Button Group** - radio buttons met `name="dienst"` moeten slechts ÉÉN checked hebben!

---

### ONTDEKKING #3: SQL Query levert DUPLICATE IDS terug

**Vraag**: Waar komt dit dubbele ID vandaan?

**Antwoord**: Uit `getServicesForEmployeeFiltered()` query!

Laat me het exemplaar controleren. De query levert waarschijnlijk:
```sql
SELECT 
  ros.id,              -- ⚠️ Variant ID van roster_period_staffing_dagdelen
  st.code,             -- Service code
  st.naam,             -- Service name
  res.team_variant,    -- Team variant label
  ros.variant_id       -- Variant ID (voor database tracking)
FROM ...
```

**MAAR** in de TypeScript interface `ServiceTypeWithTimes`:

```typescript
interface ServiceTypeWithTimes {
  id: string;           // Dit is VARIANT_ID van roster_period_staffing_dagdelen!
  code: string;
  naam: string;
  team_variant?: string;  // GRO | ORA | TOT
  variant_id?: string;    // DUPLICATE: Hetzelfde als 'id'
}
```

Als de database query MEERDERE rijen teruggeeft voor DEZELFDE SERVICE met VERSCHILLENDE VARIANTS:

```
[
  {
    id: 'STAFF-DAG-001',      // roster_period_staffing_dagdelen record ID
    code: 'MSP',
    naam: 'Middag Spreekuur',
    team_variant: 'GRO',
    variant_id: 'VARIANT-GRO'   // Same content as id?
  },
  {
    id: 'STAFF-DAG-002',      // Different dagdeel record!
    code: 'MSP',
    naam: 'Middag Spreekuur',
    team_variant: 'ORA',
    variant_id: 'VARIANT-ORA'   // Different variant
  }
]
```

**DAN**: Twee services met ANDERE id's maar DEZELFDE code → CORRECT behavior

**MAAR IF**:
```
[
  {
    id: 'SERVICE-UUID-ABC123',      // ← Service ID (same!)
    code: 'MSP',
    naam: 'Middag Spreekuur',
    team_variant: 'GRO',
    variant_id: 'VARIANT-GRO'
  },
  {
    id: 'SERVICE-UUID-ABC123',      // ← SAME Service ID (!)
    code: 'MSP',
    naam: 'Middag Spreekuur',
    team_variant: 'ORA',
    variant_id: 'VARIANT-ORA'
  }
]
```

**THEN**: Both radio buttons will check when user selects service.id = 'ABC123' ❌

---

## 🎯 ROOT CAUSE - WAARVOOR WERKT DE FIX NIET?

### De "Fix" van DRAAD 401 was ONVOLLEDIG:

**DRAAD 401 claimt**:
1. ✅ Modal interface ontvangt `variantId` parameter
2. ✅ Modal handleSave verzamelt `variant_id` van service
3. ✅ Parent handler passed `variantId` door
4. ✅ Database slaat `variantId` op

**ECHTER**:

De fix address NIET het **RADIO BUTTON SELECTION PROBLEM**:

**Problem**: Radio button `checked` condition is gebaseerd op `service.id` ALONE

```typescript
checked={selectedServiceId === service.id && selectedStatus === 1}
```

**Solution**: Radio button `checked` moet gebaseerd zijn op `variant_id` (de unieke identifier voor elke variant):

```typescript
checked={selectedServiceId === service.id && selectedVariantId === service.variant_id && selectedStatus === 1}
```

**EN**: `onChange` handler moet BEIDE id's opslaan:

```typescript
function handleServiceSelect(serviceId: string, variantId?: string) {
  setSelectedServiceId(serviceId);
  setSelectedVariantId(variantId || null);  // ⭐ NEW STATE
  setSelectedStatus(1);
}
```

---

## 🔴 DRIE APARTE FOUTEN GEDETECTEERD

### FOUT A: Modal State Incompleet

**Bestand**: `DienstSelectieModal.tsx`  
**Regel**: 70-73  
**Code**:
```typescript
const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
const [selectedStatus, setSelectedStatus] = useState<CellStatus>(0);
```

**Missing**:
```typescript
const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);  // ⭐ MISSING
```

**Impact**: No way to distinguish between variants when radio buttons have same `service.id`

---

### FOUT B: Radio Button Selection Handler INCOMPLETE

**Bestand**: `DienstSelectieModal.tsx`  
**Regel**: 139-142  
**Code**:
```typescript
function handleServiceSelect(serviceId: string) {
  setSelectedServiceId(serviceId);
  setSelectedStatus(1);
}
```

**Should be**:
```typescript
function handleServiceSelect(serviceId: string, variantId?: string) {
  setSelectedServiceId(serviceId);
  setSelectedVariantId(variantId || null);  // ⭐ NEW
  setSelectedStatus(1);
}
```

**Impact**: User can't properly select variant when multiple variants of same service exist

---

### FOUT C: Radio Button Checked Condition WRONG

**Bestand**: `DienstSelectieModal.tsx`  
**Regel**: 253-254  
**Code**:
```typescript
checked={selectedServiceId === service.id && selectedStatus === 1}
changed={() => handleServiceSelect(service.id)}
```

**Should be**:
```typescript
checked={selectedServiceId === service.id && selectedVariantId === (service.variant_id || null) && selectedStatus === 1}
changed={() => handleServiceSelect(service.id, service.variant_id)}
```

**Impact**: Radio button selection logic doesn't account for variant differentiation

---

### FOUT D: handleSave STILL Missing variantId for Status 0/2/3

**Bestand**: `DienstSelectieModal.tsx`  
**Regel**: 161-167  
**Code**:
```typescript
function handleSave() {
  if (selectedStatus === 1) {
    // ... variantId is collected
    const variantId = selectedService?.variant_id || null;
    onSave(selectedServiceId, 1, variantId);  // ✅ CORRECT
  } else if (selectedStatus === 0) {
    onSave(null, 0);  // ❌ MISSING variantId
  } else if (selectedStatus === 2) {
    onSave(null, 2);  // ❌ MISSING variantId
  } else if (selectedStatus === 3) {
    onSave(null, 3);  // ❌ MISSING variantId
  }
}
```

**Should be**:
```typescript
function handleSave() {
  if (selectedStatus === 1) {
    const selectedService = availableServices.find(s => s.id === selectedServiceId);
    const variantId = selectedService?.variant_id || null;
    onSave(selectedServiceId, 1, variantId);  // ✅ Has variantId
  } else if (selectedStatus === 0) {
    onSave(null, 0, null);  // ⭐ ADD variantId parameter
  } else if (selectedStatus === 2) {
    onSave(null, 2, null);  // ⭐ ADD variantId parameter
  } else if (selectedStatus === 3) {
    onSave(null, 3, null);  // ⭐ ADD variantId parameter
  }
}
```

---

## 📊 ROOT CAUSE SUMMARY

| Issue | Type | Severity | Why Previous Fix Failed |
|-------|------|----------|------------------------|
| Missing `selectedVariantId` state | Architecture | 🔴 CRITICAL | No state to track variant distinction |
| `handleServiceSelect` doesn't pass variantId | Logic | 🔴 CRITICAL | Can't capture which variant selected |
| Radio `checked` ignores variantId | UI Logic | 🔴 CRITICAL | Both variants appear checked simultaneously |
| Status 0/2/3 missing variantId in onSave | Data Flow | 🟡 MEDIUM | Delete operations don't trigger DB cascade |
| Cache-busting template literal | Deployment | 🟡 MEDIUM | Browser serves stale code |

---

## 🤔 WAAROM WERKT DE FIX NIET?

**"Ik heb al variant_id doorgegeven in handleSave!"**

Ja, MAAR:

1. **Variant_id collection werkt ALLEEN voor status 1**
   ```typescript
   const selectedService = availableServices.find(s => s.id === selectedServiceId);  // ✅
   const variantId = selectedService?.variant_id || null;  // ✅
   onSave(selectedServiceId, 1, variantId);  // ✅ Status 1 OK
   ```

2. **Status 0/2/3 NIET voorgegeven** (seperate issue, al gerapporteerd in DRAAD 370)

3. **MAAR GROTER PROBLEEM**: User CANNOT SELECT DIFFERENT VARIANT in eerste plaats!
   - Radio button selection logic is broken
   - User klikt op "Groen"
   - "Oranje" button blijft checked
   - User kan nooit "Groen" gesture naar opslaan

**Dit is een SELECT PROBLEM, niet een SAVE problem!**

---

## 🎬 VOLGENDE STAP - DRAAD 402 (DRIE FIXES NODIG)

### Fix #1: Add selectedVariantId State
```typescript
const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
```

### Fix #2: Update handleServiceSelect
```typescript
function handleServiceSelect(serviceId: string, variantId?: string) {
  setSelectedServiceId(serviceId);
  setSelectedVariantId(variantId || null);
  setSelectedStatus(1);
}
```

### Fix #3: Update Radio Button Logic  
```typescript
checked={selectedServiceId === service.id && selectedVariantId === (service.variant_id || null) && selectedStatus === 1}
changed={() => handleServiceSelect(service.id, service.variant_id)}
```

### Fix #4: Status 0/2/3 Pass variantId
```typescript
onSave(null, 0, null);  // Add null for variantId
onSave(null, 2, null);
onSave(null, 3, null);
```

### Fix #5: Cache-Busting Hardcode
Replace template literal with actual timestamp

**Geschatte duurtijd**: 20 minuten
**Complexiteit**: HIGH - stelt variant architecture openbaar
**Prioriteit**: 🔴 BLOCKER

---

## 📋 WAAROM DRAAD 401 INCOMPLEET WAS

DRAARD 401 claimt: "Fix voor Variant-ID dataflow"

Maar wat het ECHT deed:
1. ✅ Added variant_id parameter to modal interface
2. ✅ Added variant_id collection in handleSave (status 1 only)
3. ✅ Added variant_id passing to parent
4. ✅ Added variant_id saving to database

**What it MISSED**:
1. ❌ State management for distinguishing between variants
2. ❌ Radio button selection logic for multiple variants
3. ❌ UI layer properly reflecting variant selection
4. ❌ Status 0/2/3 variant_id passing
5. ❌ Cache-busting implementation

**Dit is waarom de fix NIET werkt**: Het address alleen de DATABASE LAYER (hooray!) maar NIET de UI INTERACTION LAYER!

---

## ❓ VRAGEN VOOR USER

1. **Database Query**: Levert `getServicesForEmployeeFiltered()` ECHT multiple records met hetzelfde service.id maar verschillende team_variants?
   - Antwoord zal bepalen of mijn diagnose correct is

2. **Expected Behavior**: Moeten "MSP [Groen]" en "MSP [Oranje]" aparte radio button opties zijn?
   - JA (current UI toon beide als afzonderlijke entries) → My fix is correct
   - NEE (moet maar 1 MSP tonen met variant dropdown) → Architecture change needed

3. **Variants per Employee/Date/Dagdeel**: Hoe veel variants kunnen er zijn voor 1 employee/date/dagdeel combo?
   - 1 (alle diensten uniek) → Architecture is fine
   - Meerdere (MSP-GRO + MSP-ORA voor dezelfde slot) → Need variant selector logic

---

**RAPPORT AFGEROND - 31 DEC 2025, 01:10 CET**
**STATUS**: ❌ GEEN FIXES APPLIED - ALLEEN ANALYSE