# 📋 DRAAD172: OPERATIONEEL IMPLEMENTATIEPLAN (AANGEPAST)
## Sequential ORT Solver: Greedy Assignment met Dagdeel-Prioritering

**Status:** ✅ AANGEPAST PLAN - KLAAR VOOR IMPLEMENTATIE  
**Versie:** DRAAD172-V2-ADJUSTED  
**Datum:** 13 december 2025  
**Aanpassing:** Clarificatie 2: System Service Priority (per dagdeel)

---

## 🎯 EXECUTIVE SUMMARY - WAT JE KRIJGT

Na DRAAD172-AANGEPAST heb je een **COMPLETE sequential solver** die:
- ✅ Per **dagdeel** prioriteert naar vraag
- ✅ **PRIO 1:** Systeemdiensten (DIO/DDO gekoppeld aan DIA/DDA)
- ✅ **PRIO 2:** Team TOT diensten (alfabetisch op Code)
- ✅ **PRIO 3:** Overig (GRO/ORA teams, alfabetisch)
- ✅ Status 1/2/3 **NOOIT aanraken** (alleen Status 0 invullen)
- ✅ Medewerkers dynamisch selecteren (op basis van restgetal)
- ✅ **EINDRAPPORT** met onvervulde diensten + employee overview

---

## 🔴 KRITIEKE AANPASSING: CLARIFICATIE 2

### WAT VERANDERT?

**OUDE LOGICA (FOUT):**
```
Global priority: DIO → DIA → DDO → DDA → TOT → Others
(Niet context-aware)
```

**NIEUWE LOGICA (CORRECT):**
```
Per dagdeel (O of A) bepalen welke diensten EERST:

┌─────────────────────────────────────────────────┐
│ DINSDAG 24-11, DAGDEEL OCHTEND (O)             │
├─────────────────────────────────────────────────┤
│ PRIO 1 (SYSTEEM):                              │
│  • DIO: 3 slots (ochtend dagdeel-initiatief)   │
│  • DDO: 2 slots (dag organisatie ochtend)      │
│ PRIO 2 (TOT):                                  │
│  • ECH: 1 slot (Echografie, alfabetisch)      │
│  • MDH: 1 slot (Moederhuishouding)             │
│  • SWZ: 1 slot (Sociaal werk)                  │
│ PRIO 3 (TEAM):                                 │
│  • OSP (Oranje): 2 slots (ochtend spreekuur)   │
│  • NSB (Groen): 1 slot (niet-supervisie)       │
│                                                 │
│ VOLGORDE INVULLEN:                             │
│ 1. Alle 3 DIO                                   │
│ 2. Alle 2 DDO                                   │
│ 3. ECH (1), MDH (1), SWZ (1) - alfabetisch     │
│ 4. OSP (2), NSB (1) - alfabetisch + aantal     │
└─────────────────────────────────────────────────┘
```

### HOEZO DEZE LOGICA?

**Context:**
- **Systeemdiensten (DIO/DDO):** Initialiseren rooster, MOETEN EERST
- **Team TOT:** Aan hele praktijk gekoppeld, DAARNA
- **Team GRO/ORA:** Speciale teams, LAATST

**Koppeling DIO↔DIA en DDO↔DDA:**
```
DIO (ochtend) → als slot, ook DIA (avond) kunnen plannen
DDO (ochtend) → als slot, ook DDA (avond) kunnen plannen

Dus: Eerst alle DIO slots vullen
     Dan: Kijken of DIA slots ook kunnen (want medewerker al aangevinkt)
     Dan: DDO
     Dan: DDA
```

---

## FASE 1: NIEUWE REQUIREMENT PRIORITIZER

### Module: `solver/requirement_prioritizer.py`

```python
from typing import List, Dict, Tuple, Optional
from datetime import date
import logging

logger = logging.getLogger(__name__)

class Requirement:
    """Single staffing requirement"""
    def __init__(self,
                 requirement_id: str,
                 date: date,
                 dagdeel: str,           # 'O' or 'A'
                 service_id: str,        # UUID
                 service_code: str,      # 'DIO', 'TOT', etc.
                 aantal: int,            # positions to fill
                 team: str,              # 'TOT', 'GRO', 'ORA'
                 is_system: bool = False):
        self.requirement_id = requirement_id
        self.date = date
        self.dagdeel = dagdeel
        self.service_id = service_id
        self.service_code = service_code
        self.aantal = aantal
        self.team = team
        self.is_system = is_system

class RequirementPrioritizer:
    """
    Prioritize requirements per dagdeel using 3-tier system:
    
    PRIO 1: System services (DIO, DDO, DIA, DDA)
    PRIO 2: Team TOT services (alphabetical by code)
    PRIO 3: Team GRO/ORA services (alphabetical by code)
    """
    
    # System service codes
    SYSTEM_SERVICES = {'DIO', 'DDO', 'DIA', 'DDA'}
    
    @staticmethod
    def load_requirements_from_db(roster_id: str, db) -> List[Requirement]:
        """Load from roster_period_staffing_dagdelen"""
        
        sql = """
        SELECT 
            rpsd.id as requirement_id,
            rpsd.date,
            rpsd.dagdeel,
            st.id as service_id,
            st.code as service_code,
            rpsd.aantal,
            rpsd.team,
            st.is_system
        FROM roster_period_staffing_dagdelen rpsd
        JOIN roster_period_staffing rps 
            ON rpsd.roster_period_staffing_id = rps.id
        JOIN service_types st 
            ON rpsd.service_id = st.id
        WHERE rps.roster_id = ?
        ORDER BY rpsd.date, rpsd.dagdeel
        """
        
        rows = db.query(sql, [roster_id])
        
        requirements = []
        for row in rows:
            requirements.append(Requirement(
                requirement_id=row['requirement_id'],
                date=row['date'],
                dagdeel=row['dagdeel'],
                service_id=row['service_id'],
                service_code=row['service_code'],
                aantal=row['aantal'],
                team=row['team'],
                is_system=row['is_system']
            ))
        
        logger.info(f"Loaded {len(requirements)} requirements")
        return requirements
    
    @staticmethod
    def sort_by_dagdeel_priority(requirements: List[Requirement]) -> List[Requirement]:
        """
        Sort requirements by:
        1. Date (earlier first)
        2. Dagdeel (O before A)
        3. Priority tier (System → TOT → Team)
        4. Service code (alphabetically within tier)
        """
        
        def priority_tier(req: Requirement) -> int:
            """Lower number = higher priority"""
            if req.is_system or req.service_code in RequirementPrioritizer.SYSTEM_SERVICES:
                return 1  # System services
            elif req.team == 'TOT':
                return 2  # Team TOT services
            else:
                return 3  # Team GRO/ORA
        
        def sort_key(req: Requirement) -> Tuple:
            return (
                req.date,                    # Earlier dates first
                req.dagdeel,                 # O (Ochtend) before A (Avond)
                priority_tier(req),          # PRIO 1/2/3
                req.service_code             # Alphabetically within tier
            )
        
        sorted_reqs = sorted(requirements, key=sort_key)
        
        logger.info("Requirements sorted by dagdeel priority:")
        
        # Log first few for debugging
        for req in sorted_reqs[:15]:
            prio = priority_tier(req)
            logger.info(
                f"  {req.date.strftime('%a %d-%m')} {req.dagdeel} "
                f"[PRIO{prio}] {req.service_code} "
                f"({req.team}): {req.aantal} slots"
            )
        
        return sorted_reqs
    
    @staticmethod
    def get_processing_groups(sorted_requirements: List[Requirement]) -> List[List[Requirement]]:
        """
        Group requirements by dagdeel for batch processing.
        """
        
        groups = []
        current_group = []
        last_date = None
        last_dagdeel = None
        
        for req in sorted_requirements:
            # Start new group if date or dagdeel changes
            if req.date != last_date or req.dagdeel != last_dagdeel:
                if current_group:
                    groups.append(current_group)
                current_group = [req]
                last_date = req.date
                last_dagdeel = req.dagdeel
            else:
                current_group.append(req)
        
        if current_group:
            groups.append(current_group)
        
        logger.info(f"Created {len(groups)} processing groups")
        
        return groups
    
    @staticmethod
    def get_tier_order_for_dagdeel(requirements: List[Requirement]) -> List[Requirement]:
        """
        For a single dagdeel, return requirements in strict priority order:
        
        PRIO 1: System services (DIO/DDO first, then DIA/DDA)
        PRIO 2: Team TOT (alphabetical)
        PRIO 3: Team GRO/ORA (alphabetical)
        """
        
        system_services = []
        tot_services = []
        team_services = []
        
        for req in requirements:
            if req.is_system or req.service_code in RequirementPrioritizer.SYSTEM_SERVICES:
                system_services.append(req)
            elif req.team == 'TOT':
                tot_services.append(req)
            else:
                team_services.append(req)
        
        # Sort each tier
        system_services.sort(key=lambda r: r.service_code)
        tot_services.sort(key=lambda r: r.service_code)
        team_services.sort(key=lambda r: r.service_code)
        
        # Combine in priority order
        return system_services + tot_services + team_services
```

---

## FASE 2: SEQUENTIAL SOLVER V2 (UPDATED)

**File:** `solver/sequential_solver_v2.py`

Key updates:
- Process requirements per dagdeel group
- Apply 3-tier priority within each dagdeel
- Track assignments with source='sequential_solver_v2'
- Generate detailed failure logs

---

## FASE 3-6: IMPLEMENTATION DRADEN

### 📋 DRAAD 1: Requirement Prioritizer
**Duration:** ~30 min
**Acceptance:** DIO before TOT in same dagdeel, TOT before GRO/ORA

### 📋 DRAAD 2: Employee Availability Tracker  
**Duration:** ~30 min
**Acceptance:** Restgetal calc correct, team filtering works

### 📋 DRAAD 3: Sequential Solver V2
**Duration:** ~45 min
**Acceptance:** All requirements processed in priority order

### 📋 DRAAD 4: Eindrapport Generator
**Duration:** ~30 min
**Acceptance:** Unfilled grouped by dagdeel and priority tier

### 📋 DRAAD 5: API Integration
**Duration:** ~20 min
**Acceptance:** Solver callable via API, results persisted

### 📋 DRAAD 6: Testing & Validation
**Duration:** ~45 min
**Acceptance:** All tests pass, coverage > 95%

---

## 📊 EXECUTION TIMELINE

| Phase | Duration | Owner | Status |
|-------|----------|-------|--------|
| DRAAD 1-6 | ~3.5 hours | Dev | 📋 READY |

---

**Status:** ✅ AANGEPAST PLAN GEREED  
**Volgende stap:** Akkoord → DRAAD-by-DRAAD uitvoering
