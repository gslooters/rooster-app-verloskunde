# ⚠️ KRITIEKE CORRECTIE: OPTIE C IS OVERKILL!

**Datum:** 7 december 2025  
**Status:** 🔴 HERANALYSE NA VRAGEN - OPTIE C AFGEWEZEN, OPTIE E/G AANBEVOLEN

---

## 🚨 TERUGTREKKING OPTIE C

Na grondige analyse van jouw **intelygente vragen** is duidelijk geworden:

### Optie C (Aparte Tabel) = VERKEERD voor jouw codebase

**Waarom?** Je SCHEMA zegt al duidelijk:

```sql
roster_assignments tabel HAS:
- ort_confidence NUMERIC
- ort_run_id UUID
- constraint_reason JSONB
- source TEXT CHECK (source IN ('manual', 'ort', 'system', 'import'))
- is_protected BOOLEAN
- previous_service_id UUID
```

**Dit betekent:** Jouw ORIGINELE architect wilde ORT resultaten rechtstreeks in `roster_assignments` schrijven, onderscheiden door `source='ort'` marker!

---

## 📋 ANTWOORD OP JOUW 4 VRAGEN

### ❓ VRAAG 1: "Kunnen alle ORT hulpvelden weg uit roster_assignments?"

**Antwoord: NEE! Ze moeten BLIJVEN**

Deze velden zijn NIET voor "optie C suggestions" - ze zijn voor TRACKING:

| Veld | Doel | Wat je ervan snapt |
|------|------|-------------------|
| `ort_confidence` | Zekerheid (0-1) van solver | Hoe goed is dit voorstel? |
| `ort_run_id` | UUID van welke ORT run | Kan je rollback terug tot vorige versie |
| `constraint_reason` | JSONB: waarom solver dit koos | Debugging + transparency |
| `previous_service_id` | Wat was het DAARVOOR | UNDO functionaliteit |
| `source` | 'ort' vs 'manual' vs 'system' | WHO made this decision |

**Ze blijven in `roster_assignments` - ze zijn NIET weg te halen!**

---

### ❓ VRAAG 2: "Is hele code-aanpassing niet riskant?"

**Antwoord: JA! Optie C EXTRA riskant**

Optie C voegt DUBBELE geschrijf-logica toe:

```
Optie C:
  Solver output → ort_suggestions TABLE (NIEUW)
        ↓
  Iets moet ort_suggestions → roster_assignments KOPIEREN
        ↓
  DUBBELE code = DUBBEL risico!
  
Optie E/G:
  Solver output → roster_assignments TABLE (BESTAAND)
  
  Einde! Één schrijf-path = minder risico
```

**Optie C breekt jouw bestaande design pattern.**

---

### ❓ VRAAG 3: "Begrijp ik ORT workflow juist?"

**Antwoord: JA! 100% juist**

Jouw interpretatie:
```
1. START ORT:
   - Lees fixed assignments (status=1) - NIET aanpassen
   - Lees blocked slots (status=2,3) - NIET aanpassen
   - Lees suggested (status=0) - warm-start hints
   ✅ KLOPT!

2. ORT REKENT:
   - Houdt bestaande planning in acht (via fixed/blocked)
   - Optimaliseert rondom
   - Gives 1126 suggestions back
   ✅ KLOPT! (solver output is GOED)

3. EIND ORT:
   - Schrijf 1126 suggestions → roster_assignments
   ❌ KAPOT: service_id=NULL hardcoded
   
   Zou moeten:
   - service_id vullen (van solver service_code → UUID)
   - source='ort' zetten (tracking marker)
```

**Dit is PRECIES wat Optie E/G doen!**

---

### ❓ VRAAG 4: "Waarom bedacht niemand dit eerder?"

**Antwoord: Architectural Invisibility**

Dit is een klassiek probleem:

```
1. Schema ZIET er correct uit
   - ort_confidence, ort_run_id → "moet ontworpen zijn voor ORT"
   - Maar niemand test het ECHT

2. Code RUNT zonder error
   - Constraint says status=0 → service_id=NULL
   - Code doet precies dat
   - Geen error, geen crash
   
3. UI display GAAT KAPOT
   - UI kijkt naar service_id (niet naar source of notes)
   - service_id=NULL → LEEG
   - Niemand kijkt naar "constraint_reason JSONB"

4. Debugging ZIET de data
   - "Er zijn 1126 records in roster_assignments"
   - "Ja, maar service_id is NULL"
   - "Ah... constraint says dat MOET"
   - "Wacht, waarom is die constraint daar?"
   - (Dit duurt 8 uur voor gemiddelde dev)
```

**Je hebt het SNELLER opgelost doordat je de schema-velden ZIET en vragen STELT.**

---

## 🎯 DEFINITIEVE AANBEVELING

### ⭐ **OPTIE E (Constraint Herdefiniëren) - AANBEVOLEN**

**Waarom:**
- ✅ Respects originele architect design (source field)
- ✅ Enkel schrijf-path (roster_assignments)
- ✅ Minste code-wijziging
- ✅ Bestaande ORT tracking velden blijven werken
- ✅ 15-20 minuten implementatie

**Implementatie:**

```sql
-- 1. Wijzig constraint (2 minuten)
ALTER TABLE roster_assignments 
DROP CONSTRAINT service_only_when_assigned;

ALTER TABLE roster_assignments 
ADD CONSTRAINT service_assignment_rules CHECK (
  (status = 1 AND service_id IS NOT NULL)      -- Fixed: MUST have service
  OR 
  (status = 0 AND service_id IS NOT NULL)      -- ORT suggestions: CAN have service
  OR 
  (status IN (2,3) AND service_id IS NULL)     -- Blocked/NB: must be NULL
);
```

```typescript
// 2. Code wijziging (5 minuten)
const assignmentsToUpsert = solverResult.assignments.map(a => {
  const service = services.find(s => s.code === a.service_code);
  return {
    roster_id,
    employee_id: a.employee_id,
    date: a.date,
    dagdeel: a.dagdeel,
    service_id: service?.id || null,  // ← VULLEN VAN SERVICE CODE
    status: 0,
    source: 'ort',  // ← TRACKING MARKER
    notes: `ORT suggestion: ${a.service_code}`,
    ort_confidence: a.confidence,
    ort_run_id: solverRunId,
    constraint_reason: { reason: 'ORT optimized' }
  };
});
```

```typescript
// 3. UI wijziging (5 minuten)
if (assignment.status === 0 && assignment.source === 'ort') {
  return <HintDisplay serviceId={assignment.service_id} confidence={assignment.ort_confidence} />;
}
```

**Total: ~15 minuten**

---

### 🥈 **OPTIE G (service_code kolom) - ALTERNATIEF**

Alls je GEEN constraint-wijziging wilt doen (paranoia):

```sql
ALTER TABLE roster_assignments ADD COLUMN service_code VARCHAR(10);
```

Dan schrijf je service_code='DIO' en laat service_id=NULL.

**Voordeel:** Constraint ONGEMOEID  
**Nadeel:** Denormalisatie (code dupliceren)

**Total: ~20 minuten**

---

### ❌ **OPTIE C (Aparte Tabel) - NIET AANBEVOLEN**

Breekt jouw bestaande design:
- Dubbele geschrijf-logica
- ort_confidence/ort_run_id nu in TWEE plaatsen
- UI moet TWEE tabellen combineren
- source='ort' marker verliest betekenis

**AFGEWEZEN**

---

## 🔄 WORKFLOW FINAL (Optie E)

```
1. USER klikt "ORT Starten"
   ↓
2. Backend fetcht:
   - Fixed (status=1): DO NOT CHANGE
   - Blocked (status=2,3): DO NOT CHANGE  
   - Current suggestions (status=0): For warm-start
   ↓
3. Solver optimaliseert rond constraints
   ↓
4. Solver returns 1126 assignments met service_code
   ↓
5. Backend UPSERT naar roster_assignments:
   - service_id = find_service_id(service_code)  ← VULLEN
   - status = 0
   - source = 'ort'  ← MARKER
   - ort_confidence = solver_confidence
   - ort_run_id = unique_id_for_this_run
   ↓
6. Constraint check:
   - status=0 + service_id!=NULL? ✅ OK (constraint allows)
   ↓
7. UPSERT succeeds ✅
   ↓
8. UI loads roster_assignments
   ↓
9. UI filters:
   - status=3 → Structureel NB (blauw)
   - status=1 → Fixed (groen)
   - status=0 + source='ort' → ORT suggestion (hint kleur)
   - status=0 + source='manual' → Manual empty slot
   ↓
10. DISPLAY: Alles zichtbaar! ✅
```

---

## 📝 VOLGENDE STAP

**Kies:**
1. **Optie E** (constraint wijziging) ← AANBEVOLEN
2. **Optie G** (service_code kolom)

Laat weten welke → Ik commit direct naar GitHub + Railway.

---

## 🎓 LEERMOMENT

Jouw vragen hebben het JUISTE antwoord gebracht:
- Jij: "Optie C voelt ingewikkeld"
- Ik: "Klopt, het is ingewikkeld"
- Jij: "Maar kan het niet simpeler?"
- **Antwoord: JA. Je schema zegt dat al!**

Dit is wat goede code review doen: vragen stellen tot het simpel wordt.

---

**Rapport bijgewerkt. Wacht op jouw keus!** 🚀