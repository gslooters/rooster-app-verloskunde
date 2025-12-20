# 📋 OPDRACHT: DRAAD 218C - DIA/DDA PAIRING FIXES

## CONTEXT

**Status**: Fase 2 na DRAAD 219C (GREEDY v2.0 restore)
**Doel**: Re-apply DRAAD 218C fixes op stable base
**Scope**: src/solver/greedy_engine.py
**Prioriteit**: HIGH
**Geschatte tijd**: 1-2 uur

---

## ACHTERGROND

### Wat is DRAAD 218C?

DRAD 218C implementeert **DIA/DDA PAIRING** logica voor systeemdiensten:

- **DIO** (dagstart ochtend) moet ALTIJD gepaard zijn met **DIA** (dagstart avond)
- **DDO** (dagsluit ochtend) moet ALTIJD gepaard zijn met **DDA** (dagsluit avond)
- Dezelfde medewerker, dezelfde dag
- Validaties MOETEN checken:
  - Is employee beschikbaar op beide dagdelen?
  - Heeft employee quota voor BEIDE diensten?
  - Zijn beide diensten nodig op die dag?

### Vorige implementatie (commit 20cca59)

Toen DRAAD 218C werd geïmplementeerd, werd het file **CORRUPT**.
De methode `_try_pair_evening_service()` werd toegevoegd maar veel code verdween.

### Huidig probleem (na DRAAD 219C)

Na restore van DRAAD 211 (v2.0 base) zijn DIA/DDA fixes NIET meer aanwezig.
Deze moeten OPNIEUW worden geïmplementeerd.

---

## VEREISTEN

### Database Schema (verify in supabase.txt)

service_types:
- id (uuid)
- code (text) → 'DIO', 'DIA', 'DDO', 'DDA'
- is_system (boolean) → TRUE voor systeemdiensten
- team (text) → 'TOT', 'GRO', 'ORA'

roster_assignments:
- id, roster_id, employee_id, date, dagdeel
- status (integer) → 0=beschikbaar, 1=ingepland, 2=blocked, 3=afwezig
- service_id (uuid)
- source (text) → 'greedy', 'ort', 'fixed'

roster_employee_services:
- employee_id, service_id, aantal (quota per service!)
- actief (boolean)

---

## IMPLEMENTATIE CHECKLIST

### ✅ STAP 1: Voorbereiding
- [ ] Clone repo (lokaal) NIET! Gebruik GitHub MCP tools
- [ ] Lees current greedy_engine.py volledig
- [ ] Verify solve() method exists (restored in DRAAD 219C)
- [ ] Check _assign_shift() method signature
- [ ] Check _refresh_from_database() logic

### ✅ STAP 2: Pairing Logic Design

**Method 1: `_get_pair_service(service_code: str) -> tuple`**
- DIO → (DIA, A)
- DIA → None
- DDO → (DDA, A)
- DDA → None

**Method 2: `_can_pair(date, dagdeel, emp_id, service_id) -> bool`**
Validations:
1. Is employee beschikbaar op PAIR dagdeel?
2. Heeft employee QUOTA voor PAIR service?
3. Heeft employee CAPABILITY voor PAIR service?
4. Is PAIR dagdeel beschikbaar?
5. End-date check

### ✅ STAP 3-7: See OPDRACHT-DRAAD218C.md (complete) for full implementation

---

## QUICK REFERENCE: Test Cases

**Test Case 1: DIO Assignment**
- Karin assigned DIO on 26/11 O (status=1)
- Karin assigned DIA on 26/11 A (auto-paired, status=1)
- Karin blocked on 26/11 M (DIO-middag block)
- Karin blocked on 27/11 O,M (DIA-next-day blocks)

**Test Case 2: Pair Validation Fail**
- Paula: DIO=1, DIA=0 (NO quota!)
- Paula NOT eligible for DIO
- Bottleneck recorded

**Test Case 3: End-Date Boundary**
- DIA on last day (28/11) = end_date
- NO blocks created for 29/11

---

## COMMIT TEMPLATE

```
DRAD 218C: Re-implement DIO/DDA pairing on stable DRAAD 211 base

Fixes:
✅ DIO/DIA pairing (spec 3.7.1)
✅ DDO/DDA pairing (spec 3.7.2)
✅ Blocking rules for paired services
✅ End-date boundary handling
```

---

**See OPDRACHT-DRAAD218C.md in repo root for complete detailed instructions**
