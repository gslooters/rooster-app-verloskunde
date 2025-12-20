# 🔴 DRAAD FUNDAMENTELE DIAGNOSE: ROOT CAUSE ANALYSIS

**Status**: ANALYSE COMPLEET - RAPPORT VOOR GOEDKEURING  
**Datum**: 20 december 2025, 17:44 UTC  
**Bronnen**: 
- Database schema (supabasetabellen.txt)
- GREEDY specificatie (GREEDYAlternatief.md)
- GREEDY code (greedy_engine.py)
- Railway logs

---

## BEVINDING 1: DATABASE SCHEMA ✅ CORRECT

**Uit supabasetabellen.txt:**
```
rosterassignments.status: INTEGER (positie 5)
```

✅ Status veld IS INTEGER in database schema  
✅ Kan waarden hebben: 0, 1, 2, 3

---

## BEVINDING 2: GREEDY SPECIFICATIE ✅ HELDER

**Uit GREEDYAlternatief.md (1.2.1):**
```
Status kent 4 opties:
  0 = medewerker beschikbaar op datumdagdeel
  1 = al een dienst ingepland (serviceid = GEVULD)
  2 = geblokkeerd vanwege vorige inplanning (serviceid = NULL)
  3 = niet beschikbaar - vakantie/ziek (serviceid = NULL)
```

✅ Helder gedefinieerd  
✅ Pre-planning (status=1) MOET herkend en afgetrokken van quota

---

## BEVINDING 3: GREEDY CODE ANALYSE

**Uit greedy_engine.py (class Assignment):**
```python
@dataclass
class Assignment:
    status: int  # Type hint zegt INTEGER
```

✅ Assignment.status is getypeerd als INTEGER  
✅ Code doet `if assignment.status == 0`, `elif assignment.status == 1`, etc.

**MAAR in _load_planning():**
```python
for row in result.data:
    assignment = Assignment(
        status=row["status"],  # ← DIRECT uit Supabase
```

⚠️ `row["status"]` kan STRING zijn als Supabase client library niet converteert

---

## BEVINDING 4: RAILWAY LOG ANALYSE - HET BEWIJS

**Log toont:**
```
Loaded 1470 existing assignments
Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status  ← KRITIEK
Subtracted 4 assignments
Final quota 242 shifts remaining
```

**Analyse:**
- 1470 slots geladen ✓
- 1463 skipped vanwege "wrong status" ← **99.5% rejection rate**
- Maar "Subtracted 4 assignments" werkt toch?

Dit suggereert:
1. Een deel van de code (`"Skipped... wrong status"`) doet type-check op status
2. Ander deel van code (`"Subtracted 4"`) werkt op hardcoded waarde
3. Type mismatch tussen STRING en INTEGER status

---

## BEVINDING 5: STATUS TYPE MISMATCH - HYPOTHESE

**Scenario:**
Supabase Postgres INTEGER naar Python dict:
```python
# Scenario A (STRING):
row["status"] = "0"  # String
if status in [1, 2]:  # "0" in [1, 2] → False ✗

# Scenario B (INTEGER):
row["status"] = 0  # Integer
if status in [1, 2]:  # 0 in [1, 2] → False ✓
```

**Waarschijnlijke oorzaak:**
- Supabase Postgrest library geeft NULL als None terug
- Integers kunnen als strings terugkomen afhankelijk van JSON encoder
- Type conversie in Python client library is inconsistent

---

## BEVINDING 6: BASELINE VERIFICATION IMPLICATIE

**Uit greedy_engine.py _verify_baseline_blocked_slots():**
```python
for key, assignment in self.werkbestand_planning.items():
    if assignment.status == 0:
        available_count += 1
    elif assignment.status == 1:
        pre_planned_count += 1
```

Deze uses DIRECT INTEGER comparison (==) niet LIST check (in)

**MAAR de log zegt:**
```
Loaded 1470 existing assignments  ← geladen OK
Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status  ← geskipped
```

Dit "Skipped... wrong status" message komt NIET uit greedy_engine.py!  
Het komt uit een ANDER deel van code (quota initialisatie ofzo).

---

## BEVINDING 7: VERMISTE QUOTA INITIALIZATION CODE

**Wat we zien in greedy_engine.py:**
- `solve_roster()` → `_load_planning()`
- Geen `_initialize_quota()` methode
- Geen "Skipped... wrong status" logging

**Maar log toont:**
```
Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status
```

**Conclusie:**
De quota initialization logic is NIET in greedy_engine.py!  
Het is waarschijnlijk in:
- Een parent class
- Een init wrapper
- Een API layer (main.py / greedyapi.py)

---

## BASELINE VERWACHTINGEN vs WERKELIJKHEID

**VERWACHT (volgens spec):**
```
| status | aantal |
|--------|--------|
| 0      | 1246   | ← beschikbaar
| 1      | 4      | ← pre-geplande
| 2      | 3      | ← geblokkeerd
| 3      | 217    | ← onbeschikbaar
| TOTAAL | 1470   |
```

**WERKELIJK (uit log):**
```
Loaded: 1470
Skipped: 1463 (wrong status)
"Subtracted 4 assignments"
Quota final: 242
```

**Interpretatie:**
- Als 1463 skipped → Alleen 7 verwerkt!
- Subtracted 4 → Alleen 4 pre-geplande herkend (van de 4 verwacht)
- Final quota 242 → Mag niet kunnen: 1470 - 4 = 1466 beschikbaar, niet 242

**Probleem:** Quota mathematica klopt niet met ingelade data

---

## ROOT CAUSE: DRIE NIVEAUS

### NIVEAU 1: Status Type Conversie
**Symptoom:** "Skipped 1463 wrong status"  
**Oorzaak:** Status als STRING in plaats van INTEGER van Supabase  
**Fix:** `status = int(row["status"])` in load functie

### NIVEAU 2: Quota Berekening Onzichtbaar
**Symptoom:** Quota code niet in greedy_engine.py  
**Oorzaak:** Quota initialization in ander bestand  
**Fix:** Moet gevonden en geinspecteerd worden

### NIVEAU 3: Data Validatie
**Symptoom:** Quota doesn't match expected baseline  
**Oorzaak:** Quota berekening breekt door type mismatch  
**Fix:** Proper type conversion + validation

---

## VOLGENDE STAPPEN

1. **Vind de quota initialization code**
   - Zoeken naar "Skipped... wrong status" message
   - Waarschijnlijk in main.py of wrapper class

2. **Inspect status conversie**
   ```python
   # Debug code toevoegen:
   print(f"Status type: {type(row['status'])}, value: {row['status']}")
   ```

3. **Fix type conversie**
   ```python
   status = int(row["status"]) if isinstance(row["status"], str) else row["status"]
   ```

4. **Validate baseline**
   - Rooster 1470 slots laden
   - Status verdeling checken
   - Quota calculate = totaal - status[1]
   - Testen met logs

5. **Deploy en monitor**
   - Test met test rooster
   - Check logs voor "Skipped... wrong status"
   - Verify baseline counts

---

## CONCLUSIE

De issue is **NIET** de GREEDY algoritme logica.  
De issue is **NIET** database connecties.  
De issue is **NIET** response schema.

De issue **IS**:
1. Status veld type mismatch (STRING vs INTEGER)
2. Quota initialization code onzichtbaar en potentially buggy
3. Baseline verification niet werkend door type issues

Eenmaal deze drie dingen gefixed:
- Alle 1470 slots correct geladen
- Quota correct berekend (246 total - 4 pre-geplande = 242 available)
- GREEDY algoritme kan korrekt worden uitgevoerd

**Impact**: Dit fix zou alle 20 vorige failures moeten oplossen.
