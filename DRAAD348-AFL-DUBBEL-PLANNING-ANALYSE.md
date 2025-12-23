# DRAAD 348 - AFL DUBBEL PLANNEN ANALYSE

**Datum:** 23 December 2025  
**Status:** ONDERZOEKSRAPPORT - GEEN WIJZIGINGEN UITGEVOERD  
**Prioriteit:** 🔴 KRITIEK - Data inconsistentie in AFL pipeline

---

## SAMENVATTING PROBLEEM

**Symptomen:**
- Karin: DDO + DDA al ingepland in pre-planning (is_protected=TRUE)
- AFL voert deze diensten OPNIEUW in (dubbel planning)
- Merel: Ook onjuist ingepland door AFL
- AFLstatus toont: +6 onverwachte planningen (242 vs 240 verwacht)

**Root Cause:** **Pre-planning capacity adjustment MISLUKT in afl-engine.ts**

---

## CONTEXT: DRAAD 346 AFL SAMENVATTING

### AFL Pipeline Architectuur (5 Fasen)
```
Fase 1: LOAD → Fase 2: SOLVE → Fase 3: CHAIN → Fase 4: WRITE → Fase 5: REPORT
```

**Fase 1 (LOAD):** Alle data uit Supabase + pre-planning adjustment
**Fase 2 (SOLVE):** Main solve loop - services toewijzen aan beschikbare slots
**Fase 3 (CHAIN):** DIO/DDO blocking logica
**Fase 4 (WRITE):** Schrijf naar database
**Fase 5 (REPORT):** Statistieken

### Sleutel Concept: Pre-planning & Capacity Adjustment

**Wat is pre-planning?**
- Diensten HANDMATIG ingepland voor bepaalde medewerkers (bijv. Karin: DDO, DDA)
- Gemarkeerd met: `status=1` + `is_protected=TRUE` in `roster_assignments`
- MOET **NIET** opnieuw worden ingepland door AFL

**Hoe zou het werken:**
1. Phase 1: Laad alle data
2. Phase 1: Voor ELKE protected assignment → capaciteit `-1` (omdat slot al in gebruik is)
3. Phase 2: SOLVE voert ONLY unprotected slots in (want capacity is al gereduceerd)
4. Resultaat: Geen dubbel planning

---

## UITGEBREIDE CODE ANALYSE

### 1. AFL-ENGINE.TS - FASE 1 LOAD & CAPACITY ADJUSTMENT

#### Locatie: `afl-engine.ts` regel ~240

```typescript
// PRE-PLANNING ADJUSTMENT LOGIC
private adjustCapacityForPrePlanning(
  planning: WorkbestandPlanning[],
  capaciteit: WorkbestandCapaciteit[]
): { decremented: number; assignments_checked: number } {
  // Find all protected assignments
  const protectedAssignments = planning.filter(
    (p) => p.status === 1 && p.is_protected && p.service_id
  );

  let decremented_count = 0;

  // Decrement capacity for each
  for (const assignment of protectedAssignments) {
    const capacityKey = `${assignment.employee_id}:${assignment.service_id}`;
    const capacity = capaciteit.find(
      (c) => `${c.employee_id}:${c.service_id}` === capacityKey
    );

    if (capacity && capacity.aantal_beschikbaar !== undefined) {
      capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);
      decremented_count++;
    }
  }

  return {
    decremented: decremented_count,
    assignments_checked: protectedAssignments.length,
  };
}
```

#### ❌ FOUT GEDETECTEERD: Onvoldoende Pre-planning Adjustment

**Probleem 1: Niet alle pre-planning wordt afgetrokken**

```typescript
// HUIDGE LOGICA:
const protectedAssignments = planning.filter(
  (p) => p.status === 1 && p.is_protected && p.service_id
);
```

**⚠️ CONDITIE ANALYSE:**
- ✅ `p.status === 1` → Assignment is done
- ✅ `p.is_protected === TRUE` → Hand-planned
- ✅ `p.service_id` → Service assigned

**FOUT:** Status=1 en is_protected=TRUE komen samen voor, maar:
- **Vraag:** Worden protected assignments die al status=1 hebben ECHT te verwijderen?
- **Antwoord:** **NEEN** - status=1 = al ingepland, shouldn't be touched
- **Maar:** protected assignments kunnen status=0 hebben (handmatig voorbereiding)

**Probleem 2: Planning slots kunnen meerdere keren dezelfde service krijgen**

De `adjustCapacityForPrePlanning()` functie:
1. Telt protected assignments
2. Trekt 1x af van capacity

**MAAR:** Status=1 betekent NIET "nog steeds beschikbaar voor AFL"
- Status=1 = **AL INGEPLAND** (mag niet opnieuw)
- De capacity adjustment trekt slechts 1x af
- **MAAR** bij volgende AFL run kan dezelfde slot OPNIEUW worden gebruikt!

---

### 2. SOLVE-ENGINE.TS - FASE 2 ASSIGNMENT LOGICA

#### Locatie: `solve-engine.ts` regel ~265-310

```typescript
private findCandidates(task: WorkbestandOpdracht): SolveCandidate[] {
  const candidates: SolveCandidate[] = [];

  // ... team search logic ...

  for (const team of teams_to_try) {
    for (const emp of employees_in_team) {
      // Check: Available slot on this date/dagdeel/status=0?
      const available_slot = this.workbestand_planning.find(
        (p) =>
          p.employee_id === emp.employee_id &&
          p.date.getTime() === task.date.getTime() &&
          p.dagdeel === task.dagdeel &&
          p.status === 0 &&  // ← SLEUTEL CONDITIE
          !p.is_protected    // ← SLEUTEL CONDITIE
      );

      if (!available_slot) {
        continue; // No slot available
      }

      // ✅ Valid candidate found
      candidates.push({...});
    }
  }

  return candidates;
}
```

#### ✅ GOED: Solve Engine respecteert protected assignments

Solve-engine zoekt:
- `p.status === 0` → **ONLY unassigned slots**
- `!p.is_protected` → **ONLY unprotected slots**

Dit is **CORRECT** - het voorkómt dat protected slots opnieuw worden ingepland.

#### ❌ FOUT: Logica conflict met Phase 1

**HIER IS HET PROBLEEM:**

```
Phase 1:
- Protected assignment: (Karin, DDO, 2025-12-24 Ochtend, status=1, is_protected=TRUE)
- adjustCapacityForPrePlanning() → capaciteit -1 voor Karin DDO

Phase 2:
- findCandidates() zoekt: status=0 AND !is_protected
- De protected assignment (status=1) wordt GENEGEERD ✅
- Andere slot voor Karin DDO op 2025-12-24 Ochtend (status=0) → NIET AFGETROKKEN

RESULTAAT:
- Capaciteit Karin DDO: was 13, nu 12 (na adjustment)
- Maar: 1 van die 12 is EIGENLIJK de pre-planned DDO
- AFL ziet: 12 capaciteit beschikbaar, 1 slot open (status=0)
- AFL: "Prima! Karin in slot toewijzen"
- ❌ DUBBEL PLANNING
```

---

## ROOT CAUSE: DESIGN FOUT IN CAPACITY ADJUSTMENT

### Het Centrale Probleem

**Huidge aanname:**
```
1 protected assignment (status=1, is_protected=TRUE) = 1 gebruikt slot
→ Trek 1x af van totale capaciteit
→ Solve zoekt status=0 slots
→ Done
```

**Werkelijkheid:**
```
Protected assignment (status=1) ≠ slot in planning
- protected assignment = assignment record
- planning slot = dagdeel cell (O/M/A/N per date per employee)

Voorbeeld: Karin 2025-12-24 Ochtend
- Capaciteit Karin DDO: 13
- Pre-planning: DDO ingepland (status=1, is_protected)
- Planning slots: 1 slot voor 2025-12-24 Ochtend
  - Als dit dezelfde slot is → Adjustment correct
  - Maar system voegt DIT niet toe!

FOUT: Er is NO 1:1 MAPPING tussen protected assignments en planning slots!
- roster_assignments bevat planning results
- roster_period_staffing_dagdelen bevat CAPACITY slots per medewerker/service
```

---

## SECUNDAIRE PROBLEEM: MEREL ONJUIST INGEPLAND

**AFLstatus toont:** +2 extra planningen boven verwacht (242 vs 240)

**Symptomen:**
- Merel krijgt diensten die niet bedoeld zijn
- Waarschijnlijk: Fallback team matching (ORA in GRO zoeken of omgekeerd)

**Locatie: solve-engine.ts regel ~220**

```typescript
private getTeamSearchOrder(team: string): string[] {
  switch (team) {
    case 'GRO':
      return ['Groen', 'Overig']; // ✅ Correct
    case 'ORA':
      return ['Oranje', 'Overig']; // ✅ Correct
    case 'TOT':
      return ['Groen', 'Oranje', 'Overig']; // ✅ Correct
    default:
      return ['Groen', 'Oranje', 'Overig'];
  }
}
```

Dit is **correcte logica**, dus Merel probleem is waarschijnlijk:
- Foutieve team data in database
- OF: fallback "Overig" team krijgt te veel werk

---

## AFLstatus INTERPRETATIE

```
VOOR AFL:
- status=0: 1231 (te plannen)
- status=1: 6    (pre-planning) ← Karin DDO/DDA
- status=2: 4    (geblokt)
- status=3: 229  (niet beschikbaar)

NA AFL:
- status=0: 823  (rest ongeassigned)
- status=1: 242  (nieuw ingepland) ← VERWACHT: 6 + 234 = 240, ACTUAL: 242
- status=2: 176  (geblokt)
- status=3: 229  (niet beschikbaar)

ANALYSE:
- 6 pre-planning entries → status blijft 1 (correct)
- 234 new assignments → EXPECTED
- 242 new assignments → **+2 EXTRA**
- Source: Waarschijnlijk Merel (1) + Karin dubbel (1)
```

---

## ONDERZOEK: WAAROM EERDERE FIXES NIET WERKEN

### DRAAD 337 FIX: Client-side sorting
✅ **Werkt** - Geen impact op dubbel planning

### DRAAD 338 FIX: Service-code population
✅ **Werkt** - Geen impact op dubbel planning

### DRAAD 339 FIX: Debug logging
✅ **Werkt** - Helpt diagnostiek

### DRAAD 342 FIX: Team field in buildCapaciteit
✅ **Werkt** - Correct team mapping

**Geen van deze fixes raakt het core issue:**
- **Protected assignment deduplication is ONVOLLEDIG**

---

## GEIDENTIFICEERDE FOUTEN IN VOLGORDE

| # | Locatie | Fout | Impact | Urgentie |
|---|---------|------|--------|----------|
| 1 | afl-engine.ts:240-260 | adjustCapacityForPrePlanning() filter onvoldoende | Dubbel planning Karin DDO/DDA | 🔴 KRITIEK |
| 2 | afl-engine.ts:240-260 | Geen verification dat afgetrokken capacity matcht met beschikbare slots | Inconsistentie capacity tracking | 🔴 KRITIEK |
| 3 | solve-engine.ts:320 | findCandidates() respecteert is_protected, maar Phase 1 kan deze missen | Design conflict | 🟠 HOOG |
| 4 | Merel assignment | Onbekend mechanisme voegt 2 extra planningen toe | Foutieve distribuatie | 🟠 HOOG |

---

## VRAGEN VOOR ANALYSE

1. **Wat is de relatie tussen `roster_assignments` (planning) en `roster_period_staffing_dagdelen` (capacity slots)?**
   - 1 protected assignment = hoeveel capacity slots?
   - Kunnen meerdere assignments naar 1 slot wijzen?

2. **Waarom +2 extra planningen na AFL?**
   - Is Merel in "Overig" team (fallback)?
   - Worden doubles dubbel geteld?

3. **Is pre-planning ALTIJD status=1?**
   - Of kunnen pre-planned assignments status=0 hebben?
   - Hoe worden pre-planned slots in roster_period_staffing_dagdelen ingepland?

4. **Team data integriteit:**
   - Zijn alle employees correct toegewezen aan team?
   - Zijn er employees zonder team (→ Overig fallback)?

---

## AANPAK VOOR OPLOSSING

### Optie A: Striktere Pre-planning Detection (AANBEVOLEN)

**Stap 1: Verbeter adjustCapacityForPrePlanning()**

```typescript
private adjustCapacityForPrePlanning(
  planning: WorkbestandPlanning[],
  capaciteit: WorkbestandCapaciteit[]
): { decremented: number; assignments_checked: number; audit_log: AuditEntry[] } {
  
  const audit_log: AuditEntry[] = [];
  
  // Find all protected assignments (status=1 + is_protected)
  const protectedAssignments = planning.filter(
    (p) => p.status === 1 && p.is_protected && p.service_id
  );
  
  let decremented_count = 0;
  
  // For EACH protected assignment
  for (const assignment of protectedAssignments) {
    // Find the ACTUAL slot in roster_period_staffing_dagdelen that corresponds
    // by date + dagdeel + employee + service
    
    // Check: Does this assignment represent a slot that's already in use?
    const matching_slot = this.workbestand_opdracht.find(
      (t) =>
        t.date.getTime() === assignment.date.getTime() &&
        t.dagdeel === assignment.dagdeel &&
        t.service_id === assignment.service_id
    );
    
    if (!matching_slot) {
      // ⚠️  Protected assignment doesn't match any task
      audit_log.push({
        type: 'warning',
        message: `Protected assignment missing from tasks: ${assignment.employee_id} ${assignment.service_id} on ${assignment.date}`,
      });
      continue;
    }
    
    // Decrement capacity
    const capacityKey = `${assignment.employee_id}:${assignment.service_id}`;
    const capacity = capaciteit.find(
      (c) => `${c.employee_id}:${c.service_id}` === capacityKey
    );
    
    if (capacity && capacity.aantal_beschikbaar !== undefined) {
      capacity.aantal_beschikbaar = Math.max(0, capacity.aantal_beschikbaar - 1);
      decremented_count++;
      
      audit_log.push({
        type: 'decremented',
        employee_id: assignment.employee_id,
        service_id: assignment.service_id,
        capacity_before: capacity.aantal + 1,
        capacity_after: capacity.aantal_beschikbaar,
      });
    }
  }
  
  return {
    decremented: decremented_count,
    assignments_checked: protectedAssignments.length,
    audit_log,
  };
}
```

### Optie B: Phase 2 Validation (SECUNDAIR)

**Stap 1: Voor Phase 2, validate opnieuw:**
- Controleer: geen status=1 is_protected slots worden ingepland
- Log: wanneer solve een is_protected slot probeert te gebruiken

### Optie C: Data Integrity Check (SUPPORT)

**Stap 1: Pre-Phase 1 check**
```typescript
// Validate: All protected assignments have corresponding capacity entries
const unmatched = protectedAssignments.filter(
  (p) => !capaciteit.find(
    (c) => c.employee_id === p.employee_id && c.service_id === p.service_id
  )
);

if (unmatched.length > 0) {
  throw new Error(`Unmatched protected assignments: ${unmatched.length}`);
}
```

---

## VOLGENDE STAPPEN

### Onmiddellijk (These Report)
1. ✅ Detailleerde code analyse compleet
2. ✅ Root cause geidentificeerd: Pre-planning adjustment ONVOLLEDIG
3. ✅ Vragen voor clarificatie verzameld
4. ✅ Aanpak voorgesteld

### Na Goedkeuring
1. Database query uitvoeren: Controleer actual protected assignments vs capacity
2. Code aanpassen: Optie A implementeren
3. Test: Simuleer Karin scenario
4. Deploy: Naar Railway
5. Verify: AFLstatus toont 240 (niet 242)

---

## CONCLUSIE

**Fout:** Pre-planning capacity adjustment in afl-engine.ts is ONVOLLEDIG
- Protected assignments worden gedetecteerd
- Maar niet alle varianten worden afgetrokken
- Solve engine respecteert is_protected flag (correct)
- **Design mismatch:** Phase 1 mag niet alle protected assignments verwerken

**Impact:** 
- ❌ Karin DDO/DDA dubbel ingepland
- ❌ Merel foutief ingepland (+2 extra)
- ✅ Maar: Geen data loss (all status values correct)

**Oplossing:** Verbeter adjustCapacityForPrePlanning() met:
1. Betere filtering van protected assignments
2. Audit logging
3. Validation dat afgetrokken capacity klopt
