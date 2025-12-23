# DRAAD 348 - ROOT CAUSE FINAL ANALYSIS

**Datum:** 23 December 2025  
**Status:** 🔴 KRITIEK - ROOT CAUSE GEIDENTIFICEERD & KLAAR VOOR FIX  
**Auteur:** Analysis Deepdive met dataset validatie

---

## SITUATIE SAMENVATTING

### Symptomen
- **Karin:** DDO + DDA al pre-gepland (status=1, is_protected=TRUE) maar worden OPNIEUW door AFL ingepland
- **Resultaat:** Dubbel planning → 242 diensten i.p.v. 240
- **Gevolg:** Merel krijgt ook +2 onjuiste planningen

### Gegeven Informatie (Van jouw antwoorden)
```
✅ Protected assignments zijn ALTIJD status=1
✅ Protected assignments zitten in roster_assignments tabel
✅ Pre-planning invulling word NIET geregistreerd in roster_period_staffing_dagdelen.invulling
✅ Alle medewerkers zijn correct in teams (Groen, Oranje, Overig)
✅ Merel is GROEN team (dus geen fallback issue)
```

---

## 🎯 ECHTE ROOT CAUSE - TWEE ONTKOPPELDE DATAFLOWS

### Dataflow 1: OPGAVEN (roster_period_staffing_dagdelen)
```
RIJ: 2025-12-24 Ochtend, TOT, DDO, status=MOET, aantal=1
↓
Betekent: "1 DDO dienst MOET op deze datum/dagdeel/team worden ingevuld"
Invulling: 0 (NOOIT bijgewerkt!)
↓
afl-engine buildOpdracht(): 
  task.aantal = 1
  task.aantal_nog = 1  ← FOUT HIER!
```

### Dataflow 2: PLANNING (roster_assignments)
```
RIJ: Karin, 2025-12-24 Ochtend, DDO, status=1, is_protected=TRUE
↓
Betekent: "Karin krijgt DDO op deze datum/dagdeel (PRE-GEPLAND)"
↓
afl-engine.ts Phase 1: adjustCapacityForPrePlanning()
  - Zoekt protected assignment
  - Trek af van capaciteit: Karin DDO capaciteit -1 ✅
  - MAAR: task.aantal_nog in Dataflow 1 word NIET aangepast ❌
```

### Het Conflict
```
Solve Phase (fase 2):
  Task DDO: aantal_nog = 1  (nog 1 te doen)
  Karin DDO: capaciteit_beschikbaar = -1  (geen capaciteit meer)
  
Logica solve-engine:
  while (task.aantal_nog > 0)  ← TRUE (is 1)
    findCandidates()  ← Zoekt medewerkers met capaciteit > 0
    Karin heeft capaciteit -1  ← WORDT NIET GEVONDEN
    Merel heeft capaciteit > 0  ← WORDT GEVONDEN
    → Merel krijgt DDO!
    task.aantal_nog = 0
    
  Maar: De ECHTE DDO voor deze task is al bij Karin (protected)!
  Resultaat: ❌ DUBBEL PLANNING
```

---

## 📍 CODE LOCATIES & FIXES

### PRIMAIRE FOUT: afl-engine.ts regel ~130-150

**File:** `src/lib/afl/afl-engine.ts`  
**Functie:** `buildOpdracht()`

```typescript
// HUIDE CODE (FOUT):
const opdrachten = tasksRaw.map((row) => {
  return {
    id: row.id,
    aantal: row.aantal,  // ← FOUT: Niet aangepast voor pre-planning
    aantal_nog: row.aantal,  // ← FOUT: Moet aantal - invulling zijn
    ...
  };
});
```

**FIX NODIG:**
```typescript
const opdrachten = tasksRaw.map((row) => {
  // NEW: Spiegelen van invulling kolom
  const aantal_nog = Math.max(0, row.aantal - (row.invulling || 0));
  
  return {
    id: row.id,
    aantal: row.aantal,
    aantal_nog: aantal_nog,  // ← FIXED: Trek pre-planning af
    invulling: row.invulling || 0,  // ← NEW: Track wat al done is
    ...
  };
});
```

### SECUNDAIRE ISSUE: adjustCapacityForPrePlanning() logic

**File:** `src/lib/afl/afl-engine.ts`  
**Functie:** `adjustCapacityForPrePlanning()`

**Huidge logica:**
```typescript
const protectedAssignments = planning.filter(
  (p) => p.status === 1 && p.is_protected && p.service_id
);

for (const assignment of protectedAssignments) {
  // Trek 1x af van capaciteit
  capacity.aantal_beschikbaar -= 1;  // ← Werkt, maar onvolledig
}
```

**Probleem:** Deze functie trekt capaciteit af (goed), maar de ONDERLIGGENDE taak (aantal_nog) wordt NIET aangepast. Zie primaire fix hierboven.

### TERTIAIRE FOUT: Verification & Logging

**File:** `src/lib/afl/afl-engine.ts`  
**Lokatie:** Phase 1 validation

**Voeg toe:**
```typescript
// NEW: Validate aantal_nog matches pre-planning
const unmatched_preplanning = workbestand_planning.filter(
  (p) => p.status === 1 && p.is_protected
).filter((p) => {
  const task = workbestand_opdracht.find(
    (t) => t.date.getTime() === p.date.getTime()
          && t.dagdeel === p.dagdeel
          && t.service_id === p.service_id
  );
  return !task; // ← Task not found = pre-planning not accounted for
});

if (unmatched_preplanning.length > 0) {
  console.warn(
    `⚠️  ${unmatched_preplanning.length} protected assignments ` +
    `not matched to tasks (may cause duplication)`
  );
}
```

---

## 📊 DATAFLOW CORRECTIE DIAGRAM

### BEFORE (FOUT)
```
Roster Period         Roster Assignments      AFL Load
(Opgaven)             (Planning Slots)        (Workbenches)

DDO op 24/O:          Karin: DDO 24/O         Task:
  aantal = 1          (status=1,protected)      aantal = 1 ← FOUT!
  invulling = 0                                aantal_nog = 1 ← FOUT!
  (NOOIT GEBRUIKT)                            
                                              Capaciteit:
                                                Karin DDO = -1
                          ↓
                      Solve Loop:
                      Task.aantal_nog = 1  ← Zoekt 1 meer
                      Karin capaciteit = -1  ← Niet beschikbaar
                      → Merel krijgt DDO ❌ DUBBEL!
```

### AFTER (CORRECT)
```
Roster Period         Roster Assignments      AFL Load
(Opgaven)             (Planning Slots)        (Workbenches)

DDO op 24/O:          Karin: DDO 24/O         Task:
  aantal = 1          (status=1,protected)      aantal = 1
  invulling = 1 ← BIJGEWERKT!                 aantal_nog = 0 ← FIXED!
                                              
                                              Capaciteit:
                                                Karin DDO = -1
                          ↓
                      Solve Loop:
                      Task.aantal_nog = 0  ← AL DONE!
                      (skip deze taak)
                      ✅ CORRECT - Geen dubbel
```

---

## 🔍 WHY EARLIER FIXES DIDN'T WORK

| Fix | Wat deed het | Waarom onvoldoende |
|-----|--------------|-------------------|
| DRAAD 337 (sorting) | Fixed taak sortering | Heeft niets met pre-planning te maken |
| DRAAD 338 (service codes) | Populeerde service metadata | Capaciteit was issue, niet metadata |
| DRAAD 339 (logging) | Voegde debug logs toe | Maskeert fout, lost niet op |
| DRAAD 342 (team field) | Fixde team dataflow | Merel issue, niet kern Karin dubbel |
| adjustCapacityForPrePlanning() | Trekt capaciteit af | WERKT, maar incomplete zonder aantal_nog fix |

**Kern:** De fixes zagen `adjustCapacityForPrePlanning()` als voldoende, maar:
- ✅ Dit trekt capaciteit af (goed)
- ❌ MAAR: taak.aantal_nog word niet aangepast (fout)
- ❌ Solve kijkt naar aantal_nog, niet capaciteit!

---

## 📈 EXPECTED OUTCOME NA FIX

### AFLstatus NA CORRECTIE

**VOOR:**
- status=0: 1231 (beschikbare slots)
- status=1: 6 (pre-planning: Karin DDO/DDA + others)
- status=2: 4 (geblokt)
- status=3: 229 (niet beschikbaar)
- TOTAAL: 1470

**NA AFL (MOMENTEEL FOUT):**
- status=0: 823 (ongeassigned)
- status=1: 242 ← **FOUT: +2 DUBBEL** (6 pre + 234 new + 2 extra)
- status=2: 176
- status=3: 229
- TOTAAL: 1470

**NA AFL (NA FIX):**
- status=0: 823 (ongeassigned)
- status=1: 240 ← **CORRECT** (6 pre + 234 new, geen dubbel)
- status=2: 176
- status=3: 229
- TOTAAL: 1470

### Verificatie
```
VOOR aflstatus: 242 status=1
NA fix moet zijn: 240 status=1
Verschil: 2 (Karin's dubbel DDO + DDA)
```

---

## ❓ RESTERENDE VRAGEN

### Vraag 1: Waar komen de 4 diensten vandaan (230 CSV vs 234 dashboard)?
**Status:** Nog onderzoeken (waarschijnlijk latere update of ander rooster)
**Impact:** Niet kritiek voor deze fix

### Vraag 2: Waarom +2 extra (242 vs 240 verwacht)?
**Antwoord:** 
- Karin DDO dubbel = +1
- Karin DDA dubbel = +1
- Totaal = +2 ✅ KLOPT!

### Vraag 3: Hoe ziet pre-planning er uit in database?
**Antwoord:** roster_assignments met status=1 + is_protected=TRUE
**Impact:** Fix moet deze detecteren en antal_nog aanpassen

---

## 🛠️ IMPLEMENTATIE PLAN

### Stap 1: Voorbereiding
- [ ] Code review van beide aflage.ts en solve-engine.ts
- [ ] Branch aanmaken: `fix/DRAAD348-dubbel-planning`
- [ ] Test data klaarleggen: Karin DDO/DDA scenario

### Stap 2: Code Aanpassingen

**2a. afl-engine.ts - buildOpdracht()**
- Trek `invulling` af van `aantal` → `aantal_nog`
- Zorg dat `aantal_nog >= 0` (max 0)
- Log: hoeveel diensten al ingevuld

**2b. afl-engine.ts - adjustCapacityForPrePlanning()**
- Verbeter audit logging
- Voeg verification toe dat protected assignments gematcht zijn

**2c. afl-engine.ts - Phase 1 validation**
- Controleer: geen protected assignments gemist
- Controleer: aantal_nog klopt met protected assignments

### Stap 3: Testing
- [ ] Unit test: buildOpdracht() met pre-planning
- [ ] Integration test: Karin DDO scenario
- [ ] Regression test: Zorg dat andere fixes nog werken

### Stap 4: Deployment
- [ ] Merge naar main
- [ ] Deploy naar Railway
- [ ] Monitor AFLstatus: moet 240 zijn

### Stap 5: Verificatie
```
SQL check:
SELECT COUNT(*) FROM afl_execution_reports 
WHERE status=1 
AND roster_id='...';

Expected: 240
Before fix: 242
```

---

## 🔑 KEY INSIGHTS

1. **De fout zit in data model desalignment:**
   - `roster_period_staffing_dagdelen.invulling` = pre-planning count
   - Maar AFL load deze NOOIT!
   - Oplossing: Spiegelen deze waarde in `workbestand_opdracht.aantal_nog`

2. **adjustCapacityForPrePlanning() is CORRECT:**
   - Trek capaciteit af ✅
   - MAAR: onvoldoende zonder aantal_nog fix
   - Dit is secondary fix, primary is buildOpdracht()

3. **Solve Engine is correct:**
   - Respecteert `is_protected` ✅
   - Respecteert capaciteit ✅
   - MAAR: vertrouwt op `aantal_nog` uit Phase 1
   - Als Phase 1 fout is, Solve ook fout

4. **Merel +2 diensten:**
   - NIET Merel's team (is Groen, correct)
   - Cascade effect van Karin dubbel:
     - Taak zegt: "Nog 2 DDO/DDA nodig"
     - Karin capaciteit vol (pre-planning)
     - Fallback: Merel krijgt deze ❌

---

## ✅ CONCLUSION

**Root Cause:** `buildOpdracht()` initialiseert `aantal_nog` met volledige aantal, zonder `invulling` (pre-planning) af te trekken.

**Impact:** Solve ziet meer diensten te doen dan werkelijk nodig, wat leidt tot dubbel planning.

**Fix:** Trek `invulling` af in `buildOpdracht()` → `aantal_nog = aantal - invulling`

**Effort:** Low (1 regel codechange + validation)

**Risk:** Low (fix is additive, doesn't break existing logic)

**Timeline:** 1-2 uur implementation + testing

---

**Status:** 🟢 READY FOR IMPLEMENTATION
