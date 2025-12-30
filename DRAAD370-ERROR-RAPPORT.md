# 🔴 DRAAD 370 - KRITIEKE FOUTANALYSE
**Status**: FOUTEN BEVESTIGD  
**Datum**: 31 december 2025, 00:58 CET  
**Niveau**: BLOCKER - Roostering NIET WERKEND

---

## SAMENVATTING

**De vorige commit (`9e0d245f`) **CLAIMT** fix voor Variant-ID dataflow, maar:**

### ❌ FOUT #1: Modal geeft Variant-ID NIET door
**Bewijs**: Afbeelding 1 + 2 (user screenshots)  
- Modal toont services met team-labels ✅  
- Gebruiker selecteert "MSP [Groen]" ✅  
- Klikt "Opslaan" ✅  
- **MAAR**: variant_id wordt NIET doorgegeven aan parent ❌  

### ❌ FOUT #2: Cache-busting ontbreekt  
**Bewijs**: Railway build logs (paste-4.txt)  
- Commit `9e0d245f` claimt: `Cache: ${Date.now()}`  
- **ECHTER**: In actuele code staat dit NIET geïmplementeerd  
- JavaScript `${Date.now()}` is TEMPLATE LITERAL SYNTAX - moet HARDCODED zijn  
- Result: Alle deployments hetzelfde cache-key = NO REFRESH ❌  

---

## GEDETAILLEERDE ANALYSE

### Probleem #1: Modal Interface

**Verwacht (DRAAD401 spec)**:
```typescript
interface DienstSelectieModalProps {
  onSave: (serviceId: string | null, status: CellStatus, variantId?: string | null) => void;
}
```

**Werkelijk (huidge code, `DienstSelectieModal.tsx` regel 46)**:
```typescript
interface DienstSelectieModalProps {
  // ... andere props ...
  onSave: (serviceId: string | null, status: CellStatus, variantId?: string | null) => void;
}
```

✅ **Interface CORRECT** - `variantId` parameter AANWEZIG

---

### Probleem #2: Modal handleSave()

**Verwacht (DRAAD401 spec)**:
```typescript
// handleSave in DienstSelectieModal
function handleSave() {
  if (selectedStatus === 1) {
    // ✅ Variant ID extraction
    const selectedService = availableServices.find(s => s.id === selectedServiceId);
    const variantId = selectedService?.variant_id || null;
    
    onSave(selectedServiceId, 1, variantId);  // ✅ VARIANT_ID doorgeven
  }
  // ...
}
```

**Werkelijk (DienstSelectieModal.tsx regel 154-166)**:
```typescript
function handleSave() {
  if (selectedStatus === 1) {
    if (!selectedServiceId) {
      alert('Selecteer een dienst');
      return;
    }
    // ✅ DRAAD399: Verzamel variant_id van geselecteerde service
    const selectedService = availableServices.find(s => s.id === selectedServiceId);
    const variantId = selectedService?.variant_id || null;
    
    onSave(selectedServiceId, 1, variantId); // Geef variantId door
  } else if (selectedStatus === 0) {
    onSave(null, 0);  // ⚠️ FOUT: variantId NIET doorgegeven
  } else if (selectedStatus === 2) {
    onSave(null, 2);  // ⚠️ FOUT: variantId NIET doorgegeven
  } else if (selectedStatus === 3) {
    onSave(null, 3);  // ⚠️ FOUT: variantId NIET doorgegeven
  }
}
```

**🔴 GEDETECTEERDE FOUT #1**: Bij status 0/2/3 moet `onSave(null, status)` zijn:
- ✅ Status 1: `onSave(selectedServiceId, 1, variantId)` ✓
- ❌ Status 0: `onSave(null, 0)` - **variant_id MIST**
- ❌ Status 2: `onSave(null, 2)` - **variant_id MIST**
- ❌ Status 3: `onSave(null, 3)` - **variant_id MIST**

**Gevolg**: Bij delete (status 0) wordt variantId NIET doorgegeven → Database trigger NIET geactiveerd → `invulling` counter decrements NIET

---

### Probleem #3: Parent Handler

**Verwacht (DRAAD401 spec)**:
```typescript
const handleModalSave = useCallback(
  async (serviceId: string | null, status: CellStatus, variantId?: string | null) => {
    // ...
    const result = await updateAssignmentStatus(
      rosterId,
      selectedCell.employeeId,
      selectedCell.date,
      selectedCell.dagdeel,
      status,
      serviceId,
      startDate,
      variantId  // ✅ DOORGEVEN
    );
  }
)
```

**Werkelijk (client.tsx regel 180-200)**:
```typescript
const handleModalSave = useCallback(
  async (serviceId: string | null, status: CellStatus, variantId?: string | null) => {
    // ...
    const result = await updateAssignmentStatus(
      rosterId,
      selectedCell.employeeId,
      selectedCell.date,
      selectedCell.dagdeel,
      status,
      serviceId,
      startDate, // DRAAD 89: Roster start date voor periode check
      variantId  // DRAAD399: Doorvoeren variant ID
    );
  }
)
```

✅ **Parent Handler CORRECT** - variantId wordt DOORGEGEVEN

---

### Probleem #4: Storage Functie

**Verwacht (DRAAD401 spec)**:
```typescript
export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null,
  rosterStartDate?: string,
  variantId?: string | null  // ✅ PARAMETER
): Promise<{ success: boolean; warnings: string[] }> {
  // ...
  const { error } = await supabase
    .from('roster_assignments')
    .upsert({
      // ...
      roster_period_staffing_dagdelen_id: variantId || null,  // ✅ OPSLAAN
      // ...
    });
}
```

**Werkelijk (preplanning-storage.ts regel 177-220)**:
```typescript
export async function updateAssignmentStatus(
  rosterId: string,
  employeeId: string,
  date: string,
  dagdeel: Dagdeel,
  status: CellStatus,
  serviceId: string | null,
  rosterStartDate?: string,
  variantId?: string | null  // ✅ PARAMETER AANWEZIG
): Promise<{ success: boolean; warnings: string[] }> {
  // ...
  const { error } = await supabase
    .from('roster_assignments')
    .upsert({
      // ...
      roster_period_staffing_dagdelen_id: variantId || null,  // ✅ OPSLAAN
      // ...
    });
}
```

✅ **Storage Functie CORRECT** - variantId wordt OPGESLAGEN

---

## 🔍 ROOT CAUSE ANALYSE

### Chain Analysis (Modal → Storage)

```
┌─────────────────────────────────────┐
│ DienstSelectieModal.handleSave()    │
│ Status 0 (Delete):                  │
│ onSave(null, 0)  ❌ variantId MIST  │
└─────────────────────────────────────┘
        │
        ▼ callback (NO variantId)
┌─────────────────────────────────────┐
│ client.handleModalSave()            │
│ (variantId?: undefined)             │
│ await updateAssignmentStatus(       │
│   ..., variantId  ← undefined       │
│ )                                   │
└─────────────────────────────────────┘
        │
        ▼ undefined parameter
┌─────────────────────────────────────┐
│ updateAssignmentStatus()            │
│ roster_period_staffing_dagdelen_id: │
│   undefined || null → NULL ✅       │
│ Database save: NULL ❌              │
└─────────────────────────────────────┘
        │
        ▼ NULL in database
┌─────────────────────────────────────┐
│ Supabase Trigger (NIET GEACTIVEERD) │
│ WHERE id = NULL → NO MATCH          │
│ invulling counter NIET DECREMENTED  │
└─────────────────────────────────────┘
```

**🔴 CONCLUSIE**: Modal geeft variantId NIET door bij status 0/2/3

---

### Problem #2: Cache-Busting

**Commit bericht zegt**:
```
Cache: ${Date.now()}
```

**What that means**:
- `${Date.now()}` = JavaScript template literal SYNTAX
- Dit MOET hardcoded zijn als actual timestamp
- NIET als string literal

**What's actually in the code**:
```typescript
// preplanning-storage.ts (regel 8)
/**
 * Cache: ${Date.now()}
 */
```

**🔴 PROBLEEM**: Dit is hardcoded als TEMPLATE LITERAL STRING, niet als VARIABLE

**Gevolg voor Railway**:
```
Build 1 (23:40): Cache: ${Date.now()} ← Template literal string
Build 2 (23:42): Cache: ${Date.now()} ← EXACT dezelfde string
Build 3 (23:46): Cache: ${Date.now()} ← EXACT dezelfde string

Result: Browser cache werkt NIET - oude code blijft cached
```

---

## 🚨 KRITIEKE IMPACT

| Component | Status | Impact |
|-----------|--------|--------|
| Modal Interface | ✅ OK | `variantId` parameter aanwezig |
| Modal handleSave (Dienst) | ✅ OK | Status 1: variantId doorgegeven |
| Modal handleSave (Delete) | 🔴 FOUT | Status 0: variantId MIST |
| Parent Handler | ✅ OK | Doorgegeven parameter |
| Storage Functie | ✅ OK | Opgeslagen in DB |
| Cache-Busting | 🔴 FOUT | Template literal → NO CACHE REFRESH |
| **User Experience** | 🔴 BROKEN | Delete werkt niet + browser cache stale |

---

## 🎯 FOUTEN SAMENVATTING

### FOUT #1: Delete Status (0) geeft variantId NIET door
**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 161-162  
**Code**:
```typescript
} else if (selectedStatus === 0) {
  onSave(null, 0);  // ❌ variantId niet meegegeven
```
**Fix**: `onSave(null, 0, null);`

### FOUT #2: Blocked Status (2) geeft variantId NIET door
**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 163-164  
**Code**:
```typescript
} else if (selectedStatus === 2) {
  onSave(null, 2);  // ❌ variantId niet meegegeven
```
**Fix**: `onSave(null, 2, null);`

### FOUT #3: NB Status (3) geeft variantId NIET door
**Bestand**: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`  
**Regel**: 165-167  
**Code**:
```typescript
} else {
  onSave(null, 3);  // ❌ variantId niet meegegeven
}
```
**Fix**: `onSave(null, 3, null);`

### FOUT #4: Cache-Busting niet hardcoded
**Bestand**: `lib/services/preplanning-storage.ts`  
**Regel**: 8  
**Code**:
```typescript
* Cache: ${Date.now()}  // ❌ Template literal, niet geëvalueerd
```
**Fix**: `* Cache: 2025-12-31T00:55:32Z` (actual timestamp)

---

## 🔬 VERKLARING VAN USER SCREENSHOTS

### Image 1: Fleur Verlos - Dienst wijzigen Modal
**Wat zien we**:
- Services tonen met team labels: "DIO [Groen]", "DIO [Oranje]" ✅
- User selecteert service ✅
- Modal state CORRECT

**Echter**:
- Als user op "Opslaan" klikt na **selecteren dienst**:
  - Modal stuurt: `onSave(serviceId, 1, variantId)` ✅ WERKT
- Als user op "Leeg (verwijder dienst)" klikt:
  - Modal stuurt: `onSave(null, 0)` ❌ GEEN VARIANT_ID
  - Database krijgt: `roster_period_staffing_dagdelen_id = null`
  - **Trigger NIET geactiveerd** → invulling counter decrements NIET

### Image 2: Heike Verbiezen - Modal met ander team
**Wat zien we**:
- Services zonder team labels (ander team) ✅
- Scroll bar rechts (veel services) ✅
- "Leeg (verwijder dienst)" button ✅

**Echter**:
- Dezelfde FOUT #1-3 van toepassing
- Services tonen correct, maar **delete flow GEBROKEN**

### Image 3: Railway Deployments
**Wat zien we**:
- Deployment successful ✅
- DRAAD401-FASE2 commit in ACTIVE status ✅
- Eerdere commits in REMOVED/HISTORY ✅

**Echter**:
- Build logs tonen **GEEN actuele keywords** in browser cache
- `[CACHE-BUST] DRAAD401` AFWEZIG van logs
- `Cache: ${Date.now()}` is NIET geëvalueerd (template literal)

---

## 📋 VERIFICATIE CHECKLIST

| Check | Result | Details |
|-------|--------|----------|
| Modal interface variantId param? | ✅ | Aanwezig in DienstSelectieModalProps |
| Modal handleSave status 1 (dienst)? | ✅ | variantId doorgegeven |
| Modal handleSave status 0 (delete)? | 🔴 | variantId MIST |
| Modal handleSave status 2 (blocked)? | 🔴 | variantId MIST |
| Modal handleSave status 3 (NB)? | 🔴 | variantId MIST |
| Parent accepts variantId? | ✅ | Parameter doorgegeven |
| Parent passes to storage? | ✅ | Doorgegeven aan updateAssignmentStatus |
| Storage saves to DB? | ✅ | roster_period_staffing_dagdelen_id opgeslagen |
| Cache-busting hardcoded? | 🔴 | Template literal, niet geëvalueerd |
| Browser cache invalidated? | 🔴 | NO REFRESH (stale cache) |

---

## 🎬 VOLGENDE STAP: DRAAD 402

Moet TWEE fixes uitvoeren:

### Fix #1: Modal Status 0/2/3 variant_id doorgeven
Bestand: `DienstSelectieModal.tsx` regel 161-167

### Fix #2: Cache-busting hardcoded timestamp
Bestand: `preplanning-storage.ts` regel 8

**Geschat duurtijd**: 10 minuten  
**Prioriteit**: KRITIEK - BLOCKER

---

**RAPPORT AFGEROND - 31 DEC 2025, 00:58 CET**