# DRAAD95E - Bugfix: Column Name Mismatch

## Status: ✅ GEFIXED

**Datum:** 2 december 2025, 00:19 CET  
**Type:** Database Column Name Mismatch  
**Severity:** Critical (500 Server Error)  
**Vorige DRAAD:** DRAAD95D - Rooster-specifieke Planregels UI Implementatie  

---

## ❌ Probleem

### Error Details

**Console Error:**
```javascript
Error fetching roster planning constraints: {
  code: '42703',
  message: 'column roster_planning_constraints.rosterid does not exist',
  hint: 'Perhaps you meant to reference the column "roster_planning_constraints.roster_id".'
}
```

**HTTP Status:** 500 Internal Server Error  
**API Endpoint:** `GET /api/roster-planning-constraints?roosterid=2acb0850-0bb8-49c4-8dae-b2f418d01442`  
**Database Error Code:** 42703 (Undefined Column)  

### Symptoom

- Nieuw rooster aangemaakt: ✅ Succesvol (9 regels gekopieerd naar `roster_planning_constraints`)
- Dashboard geopend: ✅ Werkt
- Knop "Planregels aanpassen" geklikt: ✅ Modal opent
- Modal fetch data: ❌ **FOUT: "Fout bij ophalen planregels"**
- Modal toont: Rode error banner met "Fout bij ophalen planregels"

### Screenshot

![Modal Error](../image.jpg)

Modal toont:
- Header: "Planregels voor dit rooster"
- Statistieken: "0 actieve regels | 0 totale regels | 0 aangepast"
- Error banner (rood): "Fout: Fout bij ophalen planregels"

---

## 🔍 Root Cause Analyse

### Database Schema

**Correcte tabel naam:** `roster_planning_constraints` (✅ gefixed in DRAAD95C)  
**Correcte kolom naam:** `roster_id` (met underscore)  

```sql
CREATE TABLE roster_planning_constraints (
  id uuid PRIMARY KEY,
  roster_id uuid NOT NULL,  -- ✅ CORRECT: met underscore
  baseconstraintid uuid,
  naam text,
  type text,
  ...
);
```

### Code Mismatch (2 Locaties)

#### **Locatie 1: Database Query**

**Bestand:** `lib/db/rosterPlanningConstraints.ts`  
**Functie:** `getRosterPlanningConstraintsByRoosterId()`  
**Regel:** 15  

```typescript
// ❌ FOUT (voor fix):
.eq('rosterid', roosterId)  // Database kolom 'rosterid' bestaat niet

// ✅ CORRECT (na fix):
.eq('roster_id', roosterId)  // Database kolom 'roster_id' bestaat wel
```

#### **Locatie 2: Database Insert**

**Bestand:** `lib/db/rosterPlanningConstraints.ts`  
**Functie:** `createAdHocRosterPlanningConstraint()`  
**Regel:** 143  

```typescript
// ❌ FOUT (voor fix):
rosterid: roosterId,  // Verkeerde veld naam in insert

// ✅ CORRECT (na fix):
roster_id: roosterId,  // Juiste veld naam in insert
```

#### **Locatie 3: TypeScript Interface**

**Bestand:** `lib/types/planning-constraint.ts`  
**Interface:** `RosterPlanningConstraint`  
**Regel:** 40  

```typescript
// ❌ FOUT (voor fix):
export interface RosterPlanningConstraint {
  id: string;
  rosterid: string;  // Niet consistent met database
  ...
}

// ✅ CORRECT (na fix):
export interface RosterPlanningConstraint {
  id: string;
  roster_id: string;  // Consistent met database
  ...
}
```

### Waarom Dit Nu Pas Opvalt

1. **DRAAD95C** (Dec 1) - Fixed tabel naam `roster_planning_constraints`
2. **DRAAD95C** - Maar kolom naam `rosterid` bleef verkeerd
3. **DRAAD95D** (Dec 2, 00:02) - UI geïmplementeerd die deze functie gebruikt
4. **Eerste gebruik** (Dec 2, 00:12) - Modal geopend → API call → Database error
5. Functie werd **nooit eerder aangeroepen** in productie

---

## ✅ Oplossing

### Wijzigingen (3 Commits)

#### **Commit 1: Database Queries Fix**

**SHA:** 8d1fa6ecb69ee3de81e8cc1baa9386f03a08379f  
**Bestand:** `lib/db/rosterPlanningConstraints.ts`  
**Wijzigingen:**
- Regel 15: `.eq('roster_id', roosterId)` (was `rosterid`)
- Regel 143: `roster_id: roosterId` (was `rosterid`)
- Comment toegevoegd: `// DRAAD95E: Fixed rosterid -> roster_id`

#### **Commit 2: TypeScript Interface Fix**

**SHA:** 10e1ac5e41c527eafeb23ba96264ebb63227d302  
**Bestand:** `lib/types/planning-constraint.ts`  
**Wijzigingen:**
- Regel 40: `roster_id: string;` (was `rosterid: string;`)
- Comment toegevoegd: `// DRAAD95E: Fixed rosterid -> roster_id`
- Header comment: `// DRAAD95E: Column name fix rosterid -> roster_id`

#### **Commit 3: Cache-bust Railway**

**SHA:** cd8553f3e37090446a7b33e160b53b31873e83dc  
**Bestand:** `railway.bust.js`  
**Wijzigingen:**
- Timestamp: 1733098748000 (Dec 2, 2025 00:19 CET)
- Random: Math.floor(Math.random() * 100000)
- Comment: `// DRAAD95E - Column Name Bugfix rosterid -> roster_id`

---

## 📦 Impact Analyse

### Geteste Scenario's (VOOR fix)

**Scenario 1: Nieuw Rooster Aanmaken**
- ✅ Rooster create: WERKT
- ✅ Auto-copy trigger: WERKT (9 regels gekopieerd)
- ✅ Database insert: WERKT
- Database controle:
  ```sql
  SELECT COUNT(*) FROM roster_planning_constraints 
  WHERE roster_id = '2acb0850-0bb8-49c4-8dae-b2f418d01442';
  -- Result: 9 ✅
  ```

**Scenario 2: Modal Openen (FOUT)**
- ✅ Dashboard laden: WERKT
- ✅ Knop klikken: WERKT (modal opent)
- ❌ **Fetch rules:** FAALT (500 error)
- ❌ **Modal data:** Toont error "Fout bij ophalen planregels"
- Console error:
  ```
  GET /api/roster-planning-constraints?roosterid=xxx
  Failed to load resource: the server responded with a status of 500
  ```

### Verwachte Fix Resultaat (NA deployment)

**Scenario 3: Modal Openen (GEFIXED)**
- ✅ Dashboard laden: WERKT
- ✅ Knop klikken: WERKT
- ✅ **Fetch rules:** WERKT (200 OK)
- ✅ **Modal data:** Toont 9 regels (5 vast + 4 actief)
- ✅ **Statistieken:** "9 actieve regels | 9 totale regels | 0 aangepast"
- ✅ **Groepering:** Vaste regels (5) + Actieve regels (4)

---

## 🧪 Testing Plan (NA Railway Deployment)

### Test 1: Bestaand Rooster (ID: 2acb0850-0bb8-49c4-8dae-b2f418d01442)

1. Open Dashboard Rooster Ontwerp
2. Klik "Planregels aanpassen"
3. **Verwacht:**
   - ✅ Modal opent zonder error
   - ✅ Header: "Planregels voor dit rooster"
   - ✅ Statistieken: "9 actieve regels | 9 totale regels | 0 aangepast"
   - ✅ Sectie "Vaste regels": 5 regels met lock icon
   - ✅ Sectie "Actieve regels": 4 regels met groene border
   - ✅ Geen error banner

### Test 2: Override Maken

1. Selecteer actieve regel (bijv: "Maximaal 3 nachtdiensten per week")
2. Klik "Aanpassen" knop
3. Wijzig parameter: `max_count: 3` → `4`
4. Klik "Opslaan"
5. **Verwacht:**
   - ✅ Toast notification: "Regel succesvol bijgewerkt"
   - ✅ Regel krijgt oranje border
   - ✅ Badge wijzigt: "Standaard" → "Aangepast"
   - ✅ "Terugzetten" knop verschijnt
   - ✅ Database: `is_override = true`

### Test 3: Ad-hoc Regel Toevoegen

1. Klik "Ad-hoc regel toevoegen"
2. Vul in:
   - Naam: "Test regel vakantie"
   - Type: "Max. aaneengesloten werk"
   - Parameters: `{"max": 6}`
   - Priority: P3 (Normaal)
   - Team: Groen
   - Actief: Ja
3. Klik "Toevoegen"
4. **Verwacht:**
   - ✅ Toast notification: "Ad-hoc regel succesvol toegevoegd"
   - ✅ Nieuwe sectie "Periode-specifieke regels": 1 regel
   - ✅ Paarse border + "Periode-specifiek" badge
   - ✅ "Verwijderen" knop zichtbaar
   - ✅ Database: `base_constraint_id = null`

### Test 4: Reset Override

1. Selecteer override regel uit Test 2
2. Klik "Terugzetten" knop
3. Bevestig dialog
4. **Verwacht:**
   - ✅ Toast notification: "Regel succesvol teruggezet naar origineel"
   - ✅ Border wijzigt: oranje → groen
   - ✅ Badge wijzigt: "Aangepast" → "Standaard"
   - ✅ "Terugzetten" knop verdwijnt
   - ✅ Database: `is_override = false`, parameters terug naar origineel

---

## 📄 Database Verificatie

### VOOR Bugfix

```sql
-- Rooster bestaat met 9 regels
SELECT COUNT(*) FROM roster_planning_constraints 
WHERE roster_id = '2acb0850-0bb8-49c4-8dae-b2f418d01442';
-- Result: 9 ✅

-- Maar query met 'rosterid' faalt
SELECT * FROM roster_planning_constraints 
WHERE rosterid = '2acb0850-0bb8-49c4-8dae-b2f418d01442';
-- ERROR: column "rosterid" does not exist ❌
```

### NA Bugfix

```sql
-- Query met 'roster_id' werkt
SELECT * FROM roster_planning_constraints 
WHERE roster_id = '2acb0850-0bb8-49c4-8dae-b2f418d01442'
ORDER BY priority ASC, naam ASC;
-- Result: 9 rows ✅

-- Verwachte verdeling:
SELECT 
  CASE WHEN baseconstraintid IS NULL THEN 'Ad-hoc' ELSE 'Gekopieerd' END as type,
  COUNT(*) as aantal
FROM roster_planning_constraints 
WHERE roster_id = '2acb0050-0bb8-49c4-8dae-b2f418d01442'
GROUP BY type;
-- Result:
--   type       | aantal
--   -----------+-------
--   Gekopieerd |   9
--   Ad-hoc     |   0
```

---

## 🔗 Gerelateerde Issues

### Preventie: Waarom Was Dit Niet Eerder Gevonden?

1. **Database trigger werkt correct**
   - `copy_planning_constraints_to_roster()` gebruikt `roster_id` (correct)
   - Auto-copy bij nieuw rooster werkt perfect
   - 9 regels succesvol gekopieerd

2. **Helper functie nooit aangeroepen**
   - `getRosterPlanningConstraintsByRoosterId()` was nieuw in DRAAD95D
   - Geen andere code gebruikt deze functie
   - Geen unit tests voor database helpers

3. **Type mismatch niet gedetecteerd**
   - TypeScript interface had `rosterid` (verkeerd)
   - Database heeft `roster_id` (correct)
   - Runtime error pas bij eerste API call

### Preventieve Maatregelen (Toekomst)

1. **Database Schema Validatie**
   - Voeg schema check toe in CI/CD
   - Vergelijk TypeScript interfaces met database schema
   - Tool: `supabase db diff` of custom validator

2. **Integration Tests**
   - Test alle API routes met echte database
   - Verifieer CRUD operaties werken
   - Catch column name mismatches vroeg

3. **Code Review Checklist**
   - Verifieer kolom namen matchen database schema
   - Check snake_case (database) vs camelCase (TypeScript)
   - Controleer `lib/types` interfaces

---

## 📊 Deployment Status

**Railway Deployment:** 🟡 In Progress  
**Cache-bust Timestamp:** 1733098748000 (Dec 2, 2025 00:19 CET)  
**Expected Completion:** ~2-3 minuten  

**Verificatie Steps:**
1. Check Railway dashboard: deployment status groen
2. Open app URL
3. Navigate naar bestaand rooster dashboard
4. Klik "Planregels aanpassen"
5. Verifieer: 9 regels laden zonder error

---

## ✅ Success Criteria

- [x] Database queries gebruiken `roster_id` (niet `rosterid`)
- [x] TypeScript interface gebruikt `roster_id` (niet `rosterid`)
- [x] Code gecommit naar main branch
- [x] Railway deployment getriggerd
- [ ] Modal laadt regels zonder 500 error (NA deployment)
- [ ] Toast notifications werken (NA deployment)
- [ ] Override maken/resetten werkt (NA deployment)
- [ ] Ad-hoc regels toevoegen werkt (NA deployment)

---

## 📝 Commit History (3 commits)

```
cd8553f3 - DRAAD95E: Cache-bust voor bugfix deployment
10e1ac5e - DRAAD95E: Fix TypeScript interface rosterid -> roster_id
8d1fa6ec - DRAAD95E: Fix column name rosterid -> roster_id in queries
```

---

## 📝 Lessons Learned

1. **Database schema consistency is critical**
   - Always use exact column names from schema
   - snake_case in database = snake_case in queries
   - TypeScript interfaces should match 1:1

2. **Test new features immediately**
   - DRAAD95D geïmplementeerd maar niet getest met echte data
   - Eerste test was in productie door gebruiker
   - Better: test scenarios in development eerst

3. **Column naming conventions**
   - PostgreSQL: snake_case (roster_id)
   - TypeScript: Meestal camelCase (rosterId) MAAR
   - Supabase queries: gebruik exact database naam (roster_id)
   - **Never translate** database column names in queries

---

## 🚀 Volgende Stappen

### Onmiddellijk (NU)
1. ✅ Monitor Railway deployment (2-3 min)
2. ⏳ Test modal met bestaand rooster (zie Testing Plan)
3. ⏳ Verifieer alle 4 test scenarios werken
4. ⏳ Rapporteer resultaat

### Kort Termijn (Deze Week)
1. Voeg integration tests toe voor API routes
2. Valideer alle andere database helpers op column name mismatches
3. Update development guide met naming conventions

### Lang Termijn (Volgende Sprint)
1. Implement schema validation in CI/CD
2. Add TypeScript to Database schema comparison tool
3. Write comprehensive API integration tests

---

## 📊 Status Update

**Fix Status:** ✅ COMPLEET  
**Deployment Status:** 🟡 IN PROGRESS  
**Testing Status:** ⏳ PENDING (wacht op Railway deployment)  

**Volgende DRAAD:** DRAAD95F (indien nieuwe bugs) of DRAAD96 (volgende feature)  

---

*Gegenereerd: 2 december 2025, 00:19 CET*  
*Auteur: AI Assistant (via GitHub MCP tools)*  
*Repository: gslooters/rooster-app-verloskunde*  
*Bug Severity: CRITICAL (❌ 500 error) → FIXED (✅)*
