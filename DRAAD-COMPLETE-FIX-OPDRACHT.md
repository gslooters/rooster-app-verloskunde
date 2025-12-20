# 🎯 DRAAD - COMPLETE FIX OPDRACHT VOOR GREEDY BASELINE VERIFICATION

**Versie**: 1.0  
**Status**: KLAAR VOOR NIEUWE DRAAD  
**Prioriteit**: KRITIEK - Dit blokkeert alle rooster planning  
**Geschat werk**: 2-3 uur inclusief testing  

---

## SAMENVATTING VAN HET PROBLEEM

### Symptoom
GREEDY algoritme faalt met:
```
Loaded 1470 existing assignments
Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status
Final quota 242 shifts remaining
```

### Root Cause
1. **Status veld type mismatch**: Supabase geeft STRING "0","1" maar code verwacht INTEGER 0,1
2. **Quota initialization broken**: 99.5% van records geskipped door type check
3. **Baseline verification faalt**: Pre-planning (status=1) niet herkend

### Impact
- ❌ Pre-geplande assignments (status=1) niet afgetrokken van quota
- ❌ Quota mathematica breekt: 246 - 4 ≠ 242 wanneer 1463 skipped
- ❌ GREEDY planten zonder correcte baseline
- ❌ Mogelijke data corruption

---

## DATABASE BASELINE - WAT VERWACHT WORDT

### Tabel: `roster_assignments` (1470 records per rooster)

```
| Status | Betekenis | Aantal Verwacht | serviceid | Service ID Match |
|--------|-----------|-----------------|-----------|------------------|
| 0      | Beschikbaar | ~1246         | NULL      | N/A              |
| 1      | Pre-gepland | ~4            | GEVULD    | ✓ Match demand   |
| 2      | Geblokkeerd | ~3            | NULL      | N/A              |
| 3      | Onbeschikbaar | ~217       | NULL      | N/A              |
| TOTAAL | -         | 1470            | -         | -                |
```

### Quota berekening (moet correct zijn):
```
Initiaal beschikbare shifts = alle status 0 slots
Minimaal: 1470 - 4 (pre-gepland) - 217 (onbeschikbaar) = ~1249 beschikbaar
Na DIO/DDA blokkering: ~1249 - ~3 = ~1246 voor toewijzing
```

---

## TYPE CONVERSIE ISSUE - ALLE LOCATIES

### Issue 1: Supabase INTEGER → Python STRING

**Waar**: `_load_planning()` in greedy_engine.py

**Probleem**:
```python
# Huidig (FOUT):
for row in result.data:
    assignment = Assignment(
        status=row["status"],  # ← Kan STRING zijn!
    )
    if assignment.status in [1, 2]:  # ← "1" in [1, 2] = False!
```

**Fix**:
```python
# Nieuw (CORRECT):
for row in result.data:
    # Ensure status is integer
    status_value = row.get("status")
    if isinstance(status_value, str):
        try:
            status_value = int(status_value)
        except (ValueError, TypeError):
            logger.warning(f"[DRAAD-TYPEFIX] Invalid status value: {status_value}")
            status_value = 3  # Default to unavailable
    
    assignment = Assignment(
        status=status_value,  # ← Guaranteed INTEGER
    )
```

### Issue 2: Quota initialization (HIDDEN CODE)

**Waar**: Log toont `"Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status"`  
Maar deze message is NIET in greedy_engine.py!

**Moet gevonden worden in**:
- `backend/greedy-service/src/main.py`
- `backend/greedy-service/src/solver/__init__.py`
- Wrapper class dat GreedyRosteringEngine initialized
- API endpoint dat GREEDY aanroept

**Probleem**: Dezelfde type check gebeurt waarschijnlijk:
```python
# Pseudocode (HIDDEN):
for assignment in assignments:
    if assignment["status"] in [1, 2]:  # ← Type mismatch!
        quota -= 1
```

**Fix**: Dezelfde type conversie toepassen

### Issue 3: Baseline Verification Logging

**Waar**: `_verify_baseline_blocked_slots()` in greedy_engine.py

**Huidig** (werkt OK omdat == gebruikt):
```python
if assignment.status == 0:  # ← "0" == 0 = False (but "0" == "0" = True)
elif assignment.status == 1:  # ← "1" == 1 = False
```

**Betere fix** (robust):
```python
status_int = int(assignment.status) if isinstance(assignment.status, str) else assignment.status
if status_int == 0:
    available_count += 1
elif status_int == 1:
    pre_planned_count += 1
```

---

## WORKFLOW FIX

### STAP 1: Vind alle type checks (1-2 uur)

**Zoeken naar**:
```
status in [0, 1, 2, 3]
status in [1, 2]
status > 0
status == 0
status == 1
status == 2
status == 3
```

**Bestanden om door te gaan:**
1. `backend/greedy-service/src/solver/greedy_engine.py` ✓ Geanalyseerd
2. `backend/rooster-solver/src/solver_engine.py` (old solver)
3. `backend/greedy-service/src/main.py` (HIDDEN QUOTA CODE)
4. `app/api/roster/solve/route.ts` (frontend API handler)
5. Alle bestanden met `status` queries naar Supabase

**Checklist**:
- [ ] Alle status checks gelokaliseerd
- [ ] Type conversie punten geïdentificeerd
- [ ] Loggers voor DEBUG output ingesteld

### STAP 2: Implementeer type conversie fix (30-45 min)

**Voor ELKE type check:**

```python
# TEMPLATE FIX:

def _safe_int(value, default=0):
    """Safely convert value to integer, with fallback"""
    if value is None:
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"[DRAAD-TYPEFIX] Cannot convert '{value}' to int, using {default}")
            return default
    return default

# TOEPASSING:
status = _safe_int(row["status"])
if status in [1, 2]:  # ← Now guaranteed INTEGER comparison
    quota -= 1
```

**Of inline**:
```python
status = int(assignment.status) if isinstance(assignment.status, str) else assignment.status
if status == 1:
    # process
```

### STAP 3: Add Baseline Logging (15-30 min)

**Toevoegen aan _verify_baseline_blocked_slots():**

```python
def _verify_baseline_blocked_slots(self):
    """Verify baseline with detailed logging"""
    logger.info("[DRAAD-BASELINE-FIX] === BASELINE VERIFICATION START ===")
    
    baseline_counts = {"0": 0, "1": 0, "2": 0, "3": 0}
    status_types = {"0": "", "1": "", "2": "", "3": ""}
    
    for key, assignment in self.werkbestand_planning.items():
        # CRITICAL: Log status type and value
        status_raw = assignment.status
        status_type = type(status_raw).__name__
        status_int = int(status_raw) if isinstance(status_raw, str) else status_raw
        
        logger.debug(f"[BASELINE] Status raw={status_raw} type={status_type} int={status_int}")
        
        baseline_counts[str(status_int)] = baseline_counts.get(str(status_int), 0) + 1
        status_types[str(status_int)] = status_type
    
    # Log summary
    logger.info(f"[BASELINE] Status 0 (beschikbaar): {baseline_counts['0']}")
    logger.info(f"[BASELINE] Status 1 (pre-gepland): {baseline_counts['1']}")
    logger.info(f"[BASELINE] Status 2 (geblokkeerd): {baseline_counts['2']}")
    logger.info(f"[BASELINE] Status 3 (onbeschikbaar): {baseline_counts['3']}")
    logger.info(f"[BASELINE] Type info: {status_types}")
    logger.info("[DRAAD-BASELINE-FIX] === BASELINE VERIFICATION COMPLETE ===")
```

### STAP 4: Test Baseline (30-45 min)

**Voor test rooster adc8c657-f40e-4f12-8313-1625c3376869:**

```python
# Test script (toevoegen aan main.py of test file):
def test_baseline():
    """Test baseline verification"""
    from backend.greedy_service.src.solver.greedy_engine import GreedyRosteringEngine
    
    engine = GreedyRosteringEngine(db_client)
    
    # Load planning
    engine.roster_id = "adc8c657-f40e-4f12-8313-1625c3376869"
    engine._load_planning()
    
    # Verify baseline
    engine._verify_baseline_blocked_slots()
    
    # Expected output in logs:
    # [BASELINE] Status 0 (beschikbaar): ~1246
    # [BASELINE] Status 1 (pre-gepland): 4
    # [BASELINE] Status 2 (geblokkeerd): 3
    # [BASELINE] Status 3 (onbeschikbaar): 217
    # [BASELINE] Type info: {'0': 'int', '1': 'int', '2': 'int', '3': 'int'}
```

**Expected log output VOOR FIX:**
```
Skipped 3 NULL serviceid, 0 no capability, 1463 wrong status
```

**Expected log output NA FIX:**
```
[BASELINE] Status 0 (beschikbaar): 1246
[BASELINE] Status 1 (pre-gepland): 4
[BASELINE] Status 2 (geblokkeerd): 3
[BASELINE] Status 3 (onbeschikbaar): 217
[BASELINE] Type info: {'0': 'int', '1': 'int', '2': 'int', '3': 'int'}
```

### STAP 5: Deploy & Monitor (15 min)

```bash
# In Railway terminal:
git add .
git commit -m "DRAAD-FINAL-FIX: Type conversion for status field + baseline logging"
git push

# Monitor logs:
railway logs -f greedy-service

# Should show:
# [DRAAD-BASELINE-FIX] === BASELINE VERIFICATION START ===
# [BASELINE] Status 0 (beschikbaar): 1246
# [BASELINE] Status 1 (pre-gepland): 4
# [BASELINE] Status 2 (geblokkeerd): 3
# [BASELINE] Status 3 (onbeschikbaar): 217
# [DRAAD-BASELINE-FIX] === BASELINE VERIFICATION COMPLETE ===
```

### STAP 6: Test Rooster Planning (30-45 min)

```
Klikt: "Roosters Bewerking Starten"
Expected: 
  ✓ GREEDY algoritme start
  ✓ 227 diensten geplanned
  ✓ Status update in database
  ✓ Geen "Unknown solver status" errors
```

---

## BESTANDEN OM TE WIJZIGEN

### PRIMARY (MUST FIX)

1. **backend/greedy-service/src/solver/greedy_engine.py**
   - [ ] Line ~250: `_load_planning()` - Add type conversion
   - [ ] Line ~420: `_verify_baseline_blocked_slots()` - Add detailed logging
   - [ ] Line ~100: Add `_safe_int()` helper function

2. **backend/greedy-service/src/main.py** (FIND HIDDEN CODE)
   - [ ] Find where "Skipped... wrong status" is logged
   - [ ] Apply same type conversion fix
   - [ ] Add type logging

### SECONDARY (SHOULD FIX)

3. **backend/rooster-solver/src/solver_engine.py**
   - [ ] Audit all status comparisons
   - [ ] Apply type conversion if needed

4. **app/api/roster/solve/route.ts**
   - [ ] Check response parsing from GREEDY service
   - [ ] Verify status field handling

---

## VALIDATION CHECKLIST

### Code Quality
- [ ] Alle type conversions geïmplementeerd
- [ ] Logging toegevoegd voor DEBUG
- [ ] Error handling voor invalid status values
- [ ] No hardcoded values
- [ ] Comments over complex type logic

### Testing
- [ ] Baseline logs tonen correct status verdeling
- [ ] Pre-geplande assignments herkend (status=1)
- [ ] Quota berekening correct (1246 beschikbaar)
- [ ] Rooster planning compleet zonder errors
- [ ] Database updates correct (status fields INTEGER)

### Regression
- [ ] Geen breaking changes in function signatures
- [ ] Backward compatible met andere code
- [ ] Logging level niet excessive (DEBUG vs INFO)

---

## DEBUGGING HINTS

### Als baseline logs nog steeds fout tonen:

```python
# Add this at startup:
import logging
logging.basicConfig(level=logging.DEBUG)

# Extra debug:
logger.debug(f"Raw status value: {repr(row['status'])}")
logger.debug(f"Status type: {type(row['status'])}")
logger.debug(f"Status bytes: {str(row['status']).encode('utf-8')}")
```

### Als Supabase geeft STRING terug:

Meerdere mogelijke oorzaken:
1. Postgrest JSON encoder settings
2. Python client library version
3. Supabase schema type drift

Fix:
```python
# Force schema validation:
result = db.table("roster_assignments").select(
    "id::text as id, "
    "status::integer as status, "  # ← Force type casting in SQL
    "..."
).execute()
```

---

## COMMIT MESSAGE

```
DRAAD-FINAL-FIX: Type conversion for status field + comprehensive baseline verification

CRITICAL FIX:
- Add safe integer conversion for status field (STRING → INTEGER)
- Status can be '0','1','2','3' from Supabase, must be 0,1,2,3 for logic
- 99.5% of records were skipped due to type mismatch

BASELINE VERIFICATION:
- Enhanced _verify_baseline_blocked_slots() with detailed logging
- Log status type information for debugging
- Validate expected baseline: 1246 available, 4 pre-planned, 3 blocked, 217 unavailable

IMPACT:
- Resolves "Skipped 1463 wrong status" issue
- Fixes quota calculation (246 - 4 = 242 available)
- Pre-planning now correctly recognized
- GREEDY algorithm can proceed with correct baseline

Testing:
- Baseline logging shows correct status distribution
- Type conversion working for all status comparisons
- Database updates preserving INTEGER type

Fixes: All 20 previous rooster planning failures
```

---

## NEXT STEPS VOOR NIEUWE DRAAD

1. Download deze file
2. Start nieuwe draad
3. Upload dit bestand als instructie
4. Voer FIX uit in volgende volgorde:
   - STAP 1: Vind alle code locaties
   - STAP 2: Implementeer type conversie
   - STAP 3: Voeg logging toe
   - STAP 4-6: Test en deploy
5. Monitor logs op Railway
6. Test rooster planning end-to-end

---

**Einde Opdracht**

Deze fix zou alle 20 vorige failures moeten oplossen en GREEDY baseline-correct kunnen starten.
