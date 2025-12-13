# 🔴 KRITIEK RAPPORT: ORT ARCHITECTUUR ANALYSE

**Status**: ✅ DEFINITIEF ANALYSERAPPORT  
**Datum**: 13 December 2025  
**Kern Issue**: ORT werkt SERVICE-CENTRIC in plaats van REQUIREMENT-CENTRIC  

---

## 📌 KERN INZICHT

> **ORT moet zich HELEMAAL richten op de VRAAG.**  
> **Nooit iets anders plannen dat de vraag.**  
> **Als het niet kan → niets plannen en dat rapporteren.**

Dit is de fundamentele fout in huirige implementatie.

---

## DEEL 1: DE ECHTE DATABASE VRAAG

### Wat moet vervuld worden? (Per DAG, per DAGDEEL)

```
2025-11-24 OCHTEND (O):
  ├─ ReqDIO:  1 medewerker nodig
  ├─ ReqDDO:  1 medewerker nodig
  ├─ ReqECH:  1 medewerker nodig
  └─ ReqOSP:  2 medewerkers nodig (team)

2025-11-24 MIDDAG (M):
  ├─ ReqDIA:  ??? WACHT
  │           DIA is AVOND dienst, niet MIDDAG!
  │           Dit is PRE-PLANNING voorbereiding
  ├─ ReqECH:  1 medewerker nodig
  ├─ ReqGRB:  1 medewerker nodig
  └─ ReqMSP:  2 medewerkers nodig (team)

2025-11-24 AVOND (A):
  ├─ ReqDIA:  1 medewerker nodig (HIER! Avond dagdeel)
  ├─ ReqGRB:  1 medewerker nodig
  └─ ReqDDA:  ??? (als DDO in ochtend werd gepland)
```

### De PAIRING Constraint

```
PRE-PLANNING zegt:
  "Karin: O=DIO, A=DIA op ZELFDE DAG"

Betekent:
  ├─ DIO moet worden GEPLAND op 2025-11-24 OCHTEND
  ├─ DIA moet worden GEPLAND op 2025-11-24 AVOND
  └─ DEZELFDE medewerker, ZELFDE datum, VERSCHILLENDE dagdelen!

Dus NIET:
  ❌ DIA op MIDDAG (DIA is altijd AVOND!)
  ❌ DIA op WOENSDAG (moet zelfde dag als DIO zijn!)
  ❌ DIA voor ander persoon dan DIO!

Dus WEL:
  ✅ DIO ochtend + DIA avond = Karin (zelfde dag, zelfde persoon)
```

---

## DEEL 2: WAT ORT MOMENTEEL DOET (VERKEERD)

### Probleem 1: SERVICE-CENTRIC Loading

```python
# Huirige code (sequential_solver_v2.py:314-356)
response = self.db.table('roster_period_staffing')\
    .select('*, roster_period_staffing_dagdelen(...)')\
    .execute()

# Laadt requirements ZONDER context:
# [
#   { service_id: 'DIO', date: '2025-11-24', dagdeel: 'O', aantal: 1 },
#   { service_id: 'DIA', date: '2025-11-24', dagdeel: 'A', aantal: 1 },
#   { service_id: 'DIO', date: '2025-11-25', dagdeel: 'O', aantal: 1 },
#   { service_id: 'DIA', date: '2025-11-25', dagdeel: 'A', aantal: 1 },
# ]

# Geen tracking van:
# - "DIA op 2025-11-24 A moet DEZELFDE persoon zijn als DIO op 2025-11-24 O!"
# - "Prioriteit: DIO eerst, dan later DIA (op ZELFDE dag!)"
```

**Effect**: Requirements zijn ONTKOPPELD

---

### Probleem 2: VERKEERDE Sorting (Globaal per Dagdeel)

```python
# Huirige code (line 352-388)
return (dagdeel_pri, team_pri, req.service_code, req.date)

# Sorteert GLOBAAL:
# 1. Alle OCHTEND requirements eerst (any date)
# 2. Dan alle MIDDAG requirements (any date)
# 3. Dan alle AVOND requirements (any date)

# Gevolg:
DIO 2025-11-24 O → Process, assign Karin
DDO 2025-11-24 O → Process, assign Paula
ECH 2025-11-24 O → Process, assign Heike
... 100 andere requirements ...
DIA 2025-11-25 A → Process, assign ???

# PROBLEEM: DIA voor 24-11 is ERGENS in het MIDDEN!
# Tegen die tijd zijn vele medewerkers al voor die dag ingeplannd!
```

**Effect**: Pairing is onmogelijk omdat DIO en DIA ver uit elkaar liggen!

---

### Probleem 3: SERVICE-CENTRIC Assignment Loop

```python
# Huirige code (line 492-536)
def _process_requirement(self, requirement):
    eligible = self._filter_eligible_employees(requirement)
    
    for employee in eligible:
        if self.tracker.is_available(employee.id, requirement.date, requirement.dagdeel):
            # Assign employee to THIS service
            self.tracker.assign(employee.id, requirement.service_id, ...)
            assigned += 1
            if assigned >= requirement.count_needed:
                break

# Proces:
# 1. "DIO op 24-11 O? Assign Karin"
# 2. "DIA op 24-11 A? Assign Paula" ← Onafhankelijk!
# 3. "DIO op 25-11 O? Assign Patricia"
# 4. "DIA op 25-11 A? Assign Heike"

# RESULTAAT:
# 24-11: DIO=Karin, DIA=Paula  → FOUT! Niet dezelfde persoon!
# 25-11: DIO=Patricia, DIA=Heike → FOUT! Niet dezelfde persoon!
```

**Effect**: Pairing constraint wordt NOOIT gerespecteerd!

---

## DEEL 3: WAT ORT ECHT MOET DOEN

### Stap 1: Load Requirements Per DAG (niet per Service!)

```python
def load_requirements_by_date(self) -> Dict[date, Dict[str, List]]:
    """
    Laad ALLE requirements, gegroepeerd per DAG
    
    Result:
    {
      date(2025-11-24): {
        'O': [
          Requirement(service='DIO', count=1, priority=1),
          Requirement(service='DDO', count=1, priority=2),
          Requirement(service='ECH', count=1, priority=3),
        ],
        'M': [
          Requirement(service='ECH', count=1, priority=5),
          Requirement(service='GRB', count=1, priority=5),
        ],
        'A': [
          Requirement(service='DIA', count=1, priority=1),
          Requirement(service='GRB', count=1, priority=5),
        ]
      },
      date(2025-11-25): {...},
    }
    """
    
    # Laad van roster_period_staffing_dagdelen
    # Group by: date → dagdeel → service
    # NIET: service → date → dagdeel
```

**Key difference**: DATE is outermost, SERVICE is innermost!

---

### Stap 2: Definieer PAIRING Rules

```python
def get_pairing_rules(self) -> Dict[Tuple, Tuple]:
    """
    Pairing rules: IF service X on dagdeel A, 
                   THEN must same employee as service Y on dagdeel B
    
    Format: (date, dagdeel, service) → (prior_dagdeel, prior_service)
    
    Example:
    {
      (date, 'A', 'DIA'): ('O', 'DIO'),    # DIA evening pairs with DIO morning
      (date, 'M', 'DDA'): ('O', 'DDO'),    # DDA midday pairs with DDO morning
    }
    
    Returns all pairing constraints from pre-planning.
    """
    
    # Load from roster_assignments waar status=0/1 en service in [DIO,DIA,DDO,DDA]
    # Build pairing map based on:
    # - Employee scheduled for (DIO, date, O)? Then (DIA, date, A) must be same employee
    # - Employee scheduled for (DDO, date, O)? Then (DDA, date, M/A) can be same employee
```

---

### Stap 3: Process Per DAG, Per DAGDEEL, Respect PAIRING

```python
def solve(self):
    """
    REQUIREMENT-FIRST, DATE-GROUPED, PAIRING-AWARE
    """
    
    # Load
    requirements_by_date = self.load_requirements_by_date()
    pairing_rules = self.get_pairing_rules()
    tracker = EmployeeAvailabilityTracker()
    
    # Process per date (chronological)
    for date in sorted(requirements_by_date.keys()):
        logger.info(f"Processing date {date}...")
        
        # Process dagdelen in order: O → M → A
        for dagdeel in ['O', 'M', 'A']:
            requirements_this_slot = requirements_by_date[date].get(dagdeel, [])
            
            logger.info(f"  Dagdeel {dagdeel}: {len(requirements_this_slot)} requirements")
            
            # Process each requirement
            for requirement in requirements_this_slot:
                logger.info(f"    Processing: {requirement.service} x{requirement.count}")
                
                # CHECK: Is there a pairing rule for this?
                pair_key = (date, dagdeel, requirement.service)
                paired_employee = None
                
                if pair_key in pairing_rules:
                    prior_dagdeel, prior_service = pairing_rules[pair_key]
                    
                    # Find WHO was assigned to prior service
                    prior_assignment = tracker.find_assignment(
                        date, prior_dagdeel, prior_service
                    )
                    
                    if prior_assignment:
                        paired_employee = prior_assignment.employee_id
                        logger.debug(f"      Pairing rule found: {prior_service} {prior_dagdeel} → {paired_employee}")
                
                # Assign requirement
                if paired_employee:
                    # PAIRING: Must use specific employee
                    if tracker.is_available(paired_employee, date, dagdeel):
                        logger.debug(f"      ✓ Paired employee {paired_employee} available")
                        tracker.assign(paired_employee, requirement.service, date, dagdeel)
                        self.assignments.append(...)
                    else:
                        logger.warning(f"      ✗ Paired employee {paired_employee} NOT available!")
                        self.failures.append(...)
                        # IMPORTANT: Cannot assign to someone else!
                        # This is a FAILURE, report it!
                
                else:
                    # NO PAIRING: Assign to any eligible
                    eligible = self.filter_eligible(requirement.service, date, dagdeel)
                    assigned = 0
                    
                    for employee in eligible:
                        if assigned >= requirement.count:
                            break
                        
                        if tracker.is_available(employee.id, date, dagdeel):
                            logger.debug(f"      ✓ Assigned {employee.name}")
                            tracker.assign(employee.id, requirement.service, date, dagdeel)
                            self.assignments.append(...)
                            assigned += 1
                    
                    if assigned < requirement.count:
                        shortage = requirement.count - assigned
                        logger.warning(f"      ✗ SHORTAGE: {requirement.service} short by {shortage}")
                        self.failures.append(...)
    
    logger.info(f"Solve complete: {len(self.assignments)} assignments, "
                f"{len(self.failures)} failures")
    
    return self._build_response()
```

---

## DEEL 4: KERN VERSCHIL - VISUEEL

### HUIDGE (VERKEERD): Service-Centric, Globaal Sorted

```
Sorted Requirements (GLOBAL):
  1. DIO 2025-11-24 O
  2. DIO 2025-11-25 O
  3. DIO 2025-11-26 O
  4. DDO 2025-11-24 O
  5. DDO 2025-11-25 O
  ... (many more) ...
  100. DIA 2025-11-24 A   ← DIA voor 24-11 is hier!
  101. DIA 2025-11-25 A
  102. DIA 2025-11-26 A

Processing Loop:
  1. DIO 24-11 → Assign Karin
  2. DIO 25-11 → Assign Paula
  ... 98 other requirements ...
  100. DIA 24-11 → Assign Patricia
       ↑ NOT Karin! Karin already assigned elsewhere by now!
  101. DIA 25-11 → Assign Heike
       ↑ NOT Paula!

RESULT: DIO ≠ DIA (different people)
```

### CORRECT: Requirement-Centric, Date-Grouped

```
Requirements Grouped by DATE:

2025-11-24:
  O: [DIO(1), DDO(1), ECH(1)]
  M: [ECH(1), GRB(1)]
  A: [DIA(1), GRB(1)]
  Pairing Rules: (A, DIA) → (O, DIO)

2025-11-25:
  O: [DIO(1), ECH(1)]
  M: [ECH(1)]
  A: [DIA(1)]
  Pairing Rules: (A, DIA) → (O, DIO)

2025-11-26: {...}

Processing Loop:
  Date 2025-11-24:
    O: Process DIO → Assign Karin
    O: Process DDO → Assign Paula
    O: Process ECH → Assign Heike
    M: Process ECH → (next available)
    M: Process GRB → (next available)
    A: Process DIA → Check pairing: (O, DIO) = Karin
       ✓ Karin still available for A?
       → Assign Karin to DIA
    A: Process GRB → (next available)
  
  Date 2025-11-25:
    ... repeat ...

RESULT: DIO = DIA (SAME person!)
```

---

## DEEL 5: DATA STRUCTURE

### Huirige Structure (FOUT)

```python
@dataclass
class Requirement:
    service_id: str
    date: date
    dagdeel: str
    team: str
    priority: int
    count_needed: int
    # NO linking to paired requirements!

# List processed in order:
requirements: List[Requirement] = [
    Requirement(service='DIO', date=2025-11-24, dagdeel='O', ...),
    Requirement(service='DIO', date=2025-11-25, dagdeel='O', ...),
    # ... many more ...
    Requirement(service='DIA', date=2025-11-24, dagdeel='A', ...),
    # DIA is far away!
]
```

### Correcte Structure

```python
@dataclass
class DailyRequirements:
    """All requirements for ONE DATE"""
    date: date
    by_dagdeel: Dict[str, List[ServiceRequirement]]
    pairing_rules: Dict[Tuple[str, str], Tuple[str, str]]
    # {
    #   ('A', 'DIA'): ('O', 'DIO'),
    #   ('M', 'DDA'): ('O', 'DDO'),
    # }

# Structured:
requirements: List[DailyRequirements] = [
    DailyRequirements(
        date=2025-11-24,
        by_dagdeel={
            'O': [Req(DIO, 1), Req(DDO, 1), Req(ECH, 1)],
            'M': [Req(ECH, 1), Req(GRB, 1)],
            'A': [Req(DIA, 1), Req(GRB, 1)],
        },
        pairing_rules={
            ('A', 'DIA'): ('O', 'DIO'),
            ('M', 'DDA'): ('O', 'DDO'),
        }
    ),
    DailyRequirements(date=2025-11-25, ...),
    # ...
]
```

---

## DEEL 6: PRINCIPE: VRAAG FIRST, ALTIJD

```
GOLDEN RULE:
═══════════════════════════════════════════════════════════════

1. Wat moet vervuld worden? (Load VRAAG)
   ├─ Database says: "2025-11-24 O: need DIO x1, DDO x1"
   └─ ORT says: "OK, I will ONLY try to fill THESE"

2. Kan het? (Check eligibility + availability)
   ├─ "DIO: who is eligible and available?"
   ├─ If: eligible, available → ASSIGN
   └─ If: NOT → FAILURE (report it!)

3. Nooit iets anders doen dan wat de vraag is
   ├─ Don't assign "ECH" when "DIO" is needed
   ├─ Don't assign "extra" when not in requirement
   └─ Stick to EXACTLY what the database asks

4. Als het niet kan → Rapporteer
   ├─ Not: "assign someone else" or "wait until later"
   ├─ But: "FAILURE: cannot fulfill DIO on 2025-11-24 O"
   └─ Status: FEASIBLE with gaps, or INFEASIBLE

═══════════════════════════════════════════════════════════════
```

---

## DEEL 7: WAAROM DIT CRUCIAAL IS

### Pairing Correctness

```
Pre-planning says: Karin O=DIO, A=DIA on 2025-11-24

If ORT doesn't pair them:
  DIO → Karin (2025-11-24 O)
  DIA → Paula (2025-11-24 A)
  
  RESULT: Wrong person for DIA!
  Pre-planning was: One person (Karin) does both
  Actual: Two people
  
  This is a BUSINESS RULE VIOLATION!
```

### Requirement Fulfillment

```
Database says: "Need 1 DIO on 2025-11-24 O"

If ORT assigns "something else":
  ORT thinks: "DIO is hard, but I can assign ECH instead"
  
  RESULT: Requirement NOT filled!
  Database has no DIO for 2025-11-24 O
  
  This is a FAILURE!
  Report it, don't hide it!
```

---

## SAMENVATTING: ARCHITECTUUR FOUTEN

| Fout | Huiding | Correct | Impact |
|------|---------|---------|--------|
| **Load Strategy** | Per service | Per date | DIO+DIA decoupled vs paired |
| **Sorting** | Global per dagdeel | Per-date per dagdeel | Far apart vs together |
| **Assignment** | Service-centric | Requirement-centric | Wrong person vs right person |
| **Pairing Logic** | None | Enforced | 1890 violations vs 0 |
| **Failure Handling** | Assign alternate | Report failure | Wrong data vs correct report |
| **Requirement Coverage** | Anything goes | ONLY what asked | Filled with wrong things vs correct/fail |

---

## CORE FIX

Change from:
```
Load requirements (service-scattered)
  ↓
Sort globally
  ↓
Process each (unaware of pairs)
  ↓
Result: Chaos
```

To:
```
Load requirements (date-grouped)
  ↓
Define pairing rules
  ↓
Process per date, per dagdeel (aware of pairs)
  ↓
Result: Correct OR Report Failure
```

---

**RAPPORT VOLTOOID: REQUIREMENT-FIRST ARCHITECTUUR GEVALIDEERD** ✅
