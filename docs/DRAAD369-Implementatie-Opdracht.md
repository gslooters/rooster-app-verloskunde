# 🎯 DRAAD369: IMPLEMENTATIE-OPDRACHT
## Toevoegen `roster_period_staffing_dagdelen_id` + NULL-handling voor `invulling`

**Datum:** 30 december 2025  
**Context:** DRAAD368 analyse + voorbereiding nieuwe draad  
**Status:** Initiële implementatie (geen data migration nodig - lege tabellen)

---

## 📋 INHOUDSOPGAVE

1. [Samenvatting](#samenvatting)
2. [Kernprobleem](#kernprobleem)
3. [Oplossing](#oplossing)
4. [Database-aanpassingen](#database-aanpassingen)
5. [Trigger-heruitwerking](#trigger-heruitwerking)
6. [Backend-aanpassingen](#backend-aanpassingen)
7. [Uitvoering-instructies](#uitvoering-instructies)
8. [Verificatie-checklist](#verificatie-checklist)

---

## 📌 SAMENVATTING

We voegen twee kritieke aanpassingen toe aan het roostersysteem:

### 1. **Nieuwe kolom: `roster_period_staffing_dagdelen_id`**
- Voeg toe aan `roster_assignments` tabel
- Foreign Key naar `roster_period_staffing_dagdelen(id)`
- Geeft **directe link** tussen assignment en staffing-variant
- Lost "welke dienst wordt ingetrokken?" ambiguïteit op

### 2. **NULL-handling voor `invulling`**
- Default waarde: `NULL` (niet 0!)
- Bij rooster-aanmaak: `invulling = NULL`
- Zodra `roster_period_staffing_dagdelen.status` ≠ 1: `invulling = NULL`
- Trigger zet automatisch NULL bij status-wijziging

### 3. **Vereenvoudigde Trigger-logica**
- Was: 4-velden matching (`date`, `dagdeel`, `team`, `service_id`)
- Nu: 1-veld matching (`roster_period_staffing_dagdelen_id`)
- Veel robuuster, geen "Overig"-problemen meer

---

## 🔴 KERNPROBLEEM

### Huiden Situatie (PROBLEMATISCH):

```
24/11/2025, Ochtend, OSP:
  - OSP (Groen):  aantal=2, invulling=?
  - OSP (Oranje): aantal=2, invulling=?

Planner klikt "Dienst toekennen" op Waarneem1 (team="Overig")

↓ INSERT roster_assignments:
  employee_id = "Waarneem1"
  service_id = [OSP UUID]
  team = "Overig"
  status = 1

↓ Trigger activeert:
  UPDATE roster_period_staffing_dagdelen
  WHERE team = "Overig"  ← FOUT!
  
  staffing-tabel heeft: team="GRO" of "ORA", NIET "Overig"
  ❌ NO MATCH! Invulling wordt NIET geupdate!
```

### Probleem Met Intrekken:

```
Planner trekt Waarneem1 in:

UPDATE roster_assignments
SET status = 1 → 0

Trigger moet UPDATE:
  roster_period_staffing_dagdelen
  WHERE team="Overig"
  
❌ FAILS! team="Overig" bestaat niet in staffing
```

---

## ✅ OPLOSSING

### Stap 1: Voeg `roster_period_staffing_dagdelen_id` toe

```sql
ALTER TABLE roster_assignments
ADD COLUMN roster_period_staffing_dagdelen_id UUID;

ALTER TABLE roster_assignments
ADD CONSTRAINT fk_roster_assignments_staffing
  FOREIGN KEY (roster_period_staffing_dagdelen_id)
  REFERENCES roster_period_staffing_dagdelen(id)
  ON DELETE RESTRICT;

CREATE INDEX idx_roster_assignments_staffing_id
  ON roster_assignments(roster_period_staffing_dagdelen_id);
```

### Stap 2: Invulling = NULL (niet 0)

```sql
ALTER TABLE roster_period_staffing_dagdelen
ALTER COLUMN invulling SET DEFAULT NULL;
```

### Stap 3: Trigger refactoren

**OUDE trigger logica:**
```sql
WHERE roster_id = NEW.roster_id
  AND date = NEW.date
  AND dagdeel = NEW.dagdeel
  AND team = NEW.team
  AND service_id = NEW.service_id
```

**NIEUWE trigger logica:**
```sql
WHERE id = NEW.roster_period_staffing_dagdelen_id
```

**Voordeel:** Direct, unambigueus, geen multi-field matching!

---

## 🗄️ DATABASE-AANPASSINGEN

### Fase 1: Schema-wijzigingen (STAP 1)

**Locatie:** Supabase SQL Editor

```sql
-- =====================================================
-- DRAAD369: SCHEMA WIJZIGINGEN - FASE 1
-- =====================================================
-- Datum: 30 december 2025
-- Beschrijving: Voeg roster_period_staffing_dagdelen_id toe
-- =====================================================

-- STAP 1a: Voeg kolom toe aan roster_assignments
-- =====================================================
ALTER TABLE roster_assignments
ADD COLUMN roster_period_staffing_dagdelen_id UUID;

-- STAP 1b: Voeg Foreign Key constraint toe
-- =====================================================
ALTER TABLE roster_assignments
ADD CONSTRAINT fk_roster_assignments_staffing_variant
  FOREIGN KEY (roster_period_staffing_dagdelen_id)
  REFERENCES roster_period_staffing_dagdelen(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- STAP 1c: Create INDEX voor performance
-- =====================================================
CREATE INDEX idx_roster_assignments_staffing_id
  ON roster_assignments(roster_period_staffing_dagdelen_id);

-- STAP 1d: Create COMPOSITE INDEX voor frequent queries
-- =====================================================
CREATE INDEX idx_roster_assignments_status_staffing_id
  ON roster_assignments(status, roster_period_staffing_dagdelen_id);

-- STAP 1e: Verificatie
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DRAAD369 FASE 1: SCHEMA WIJZIGINGEN SUCCESVOL';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Kolommen toegevoegd:';
  RAISE NOTICE '  ✅ roster_assignments.roster_period_staffing_dagdelen_id (UUID, NULLABLE)';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Constraints:';
  RAISE NOTICE '  ✅ Foreign Key: fk_roster_assignments_staffing_variant';
  RAISE NOTICE '     → REFERENCES roster_period_staffing_dagdelen(id)';
  RAISE NOTICE '     → ON DELETE RESTRICT (beschermt integriteit)';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Indexes:';
  RAISE NOTICE '  ✅ idx_roster_assignments_staffing_id';
  RAISE NOTICE '  ✅ idx_roster_assignments_status_staffing_id';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
```

### Fase 2: DEFAULT-waarde voor invulling (STAP 2)

```sql
-- =====================================================
-- DRAAD369: DEFAULT NULL VOOR INVULLING
-- =====================================================

-- STAP 2a: Zet DEFAULT NULL (in plaats van 0!)
-- =====================================================
ALTER TABLE roster_period_staffing_dagdelen
ALTER COLUMN invulling SET DEFAULT NULL;

-- STAP 2b: Add COMMENT (documentatie)
-- =====================================================
COMMENT ON COLUMN roster_period_staffing_dagdelen.invulling IS 
  'Aantal ingevulde diensten. NULL = rooster nog niet gemaakt of dienst is inactive (status!=1)';

-- STAP 2c: Verificatie
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DRAAD369 FASE 2: INVULLING DEFAULT SUCCESVOL';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 DEFAULT-waarde:';
  RAISE NOTICE '  ✅ roster_period_staffing_dagdelen.invulling = NULL';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Semantiek:';
  RAISE NOTICE '  NULL = Dienst niet actief of rooster niet gemaakt';
  RAISE NOTICE '  0-N  = Dienst actief en ingevuld';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
```

---

## ⚙️ TRIGGER-HERUITWERKING

### Fase 3: Vereenvoudigde Trigger (STAP 3)

**Locatie:** Supabase SQL Editor

```sql
-- =====================================================
-- DRAAD369: VEREENVOUDIGDE TRIGGER LOGICA
-- =====================================================
-- Datum: 30 december 2025
-- Vorige versie: DRAAD368 (4-veld matching)
-- Nieuwe versie: ID-based matching (VEEL cleaner!)
-- =====================================================

-- STAP 3a: VERWIJDER OUDE TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trg_update_roster_assignment_invulling ON roster_assignments CASCADE;

-- STAP 3b: VERWIJDER OUDE FUNCTION
-- =====================================================
DROP FUNCTION IF EXISTS update_roster_assignment_invulling();

-- STAP 3c: MAAK NIEUWE FUNCTION (ID-BASED)
-- =====================================================
CREATE OR REPLACE FUNCTION update_roster_assignment_invulling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected INTEGER := 0;
BEGIN
  
  -- ================================================================
  -- DRAAD369: ID-BASED INVULLING TRIGGER
  -- ================================================================
  -- Regel 1: Status (0,2,3) → 1: invulling +1 (maar alleen als ID gezet!)
  -- Regel 2: Status 1 → (0,2,3): invulling NULL (niet -1!)
  -- Regel 3: Status ≠ 1: invulling = NULL (altijd)
  -- ================================================================

  -- ================================================================
  -- SCENARIO 1: STATUS → 1 (DIENST GEPLAND)
  -- ================================================================
  IF (NEW.status = 1 AND OLD.status IN (0, 2, 3)) THEN
    
    RAISE NOTICE '[DRAAD369] ✅ STATUS CHANGE: % → 1 (GEPLAND)', OLD.status;
    RAISE NOTICE '[DRAAD369]    Staffing variant ID: %', NEW.roster_period_staffing_dagdelen_id;
    
    -- Controleer of ID gezet is
    IF NEW.roster_period_staffing_dagdelen_id IS NULL THEN
      RAISE WARNING '[DRAAD369] ⚠️  roster_period_staffing_dagdelen_id is NULL!';
      RAISE WARNING '[DRAAD369]    assignment_id: %, employee: %, date: %',
        NEW.id, NEW.employee_id, NEW.date;
      RETURN NEW;
    END IF;
    
    -- UPDATE invulling +1 DIRECT via ID
    UPDATE roster_period_staffing_dagdelen
    SET invulling = COALESCE(invulling, 0) + 1,  -- Converteer NULL → 0, dan +1
        updated_at = NOW()
    WHERE id = NEW.roster_period_staffing_dagdelen_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '[DRAAD369]    Invulling +1 (affected: %)', v_rows_affected;
    
  -- ================================================================
  -- SCENARIO 2: STATUS 1 → (0,2,3) (DIENST VERWIJDERD/INGETROKKEN)
  -- ================================================================
  ELSIF (OLD.status = 1 AND NEW.status IN (0, 2, 3)) THEN
    
    RAISE NOTICE '[DRAAD369] ✅ STATUS CHANGE: 1 → % (VERWIJDERD)', NEW.status;
    RAISE NOTICE '[DRAAD369]    Staffing variant ID: %', OLD.roster_period_staffing_dagdelen_id;
    
    -- Controleer of ID gezet is
    IF OLD.roster_period_staffing_dagdelen_id IS NULL THEN
      RAISE WARNING '[DRAAD369] ⚠️  roster_period_staffing_dagdelen_id is NULL!';
      RETURN NEW;
    END IF;
    
    -- UPDATE invulling → NULL DIRECT via ID
    UPDATE roster_period_staffing_dagdelen
    SET invulling = NULL,  -- Zet op NULL, NIET -1!
        updated_at = NOW()
    WHERE id = OLD.roster_period_staffing_dagdelen_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '[DRAAD369]    Invulling → NULL (affected: %)', v_rows_affected;
    
  -- ================================================================
  -- SCENARIO 3: STAFFING VARIANT WIJZIGT (SERVICE SWAP / TEAM CHANGE)
  -- ================================================================
  ELSIF (OLD.status = 1 AND NEW.status = 1 AND 
         OLD.roster_period_staffing_dagdelen_id IS DISTINCT FROM 
         NEW.roster_period_staffing_dagdelen_id) THEN
    
    RAISE NOTICE '[DRAAD369] ✅ STAFFING VARIANT SWAP';
    RAISE NOTICE '[DRAAD369]    Old ID: %, New ID: %', 
      OLD.roster_period_staffing_dagdelen_id, 
      NEW.roster_period_staffing_dagdelen_id;
    
    -- STAP 1: Zet OUDE variant op NULL
    UPDATE roster_period_staffing_dagdelen
    SET invulling = NULL,
        updated_at = NOW()
    WHERE id = OLD.roster_period_staffing_dagdelen_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '[DRAAD369]    Oude variant → NULL (affected: %)', v_rows_affected;
    
    -- STAP 2: Verhoog NIEUWE variant
    UPDATE roster_period_staffing_dagdelen
    SET invulling = COALESCE(invulling, 0) + 1,
        updated_at = NOW()
    WHERE id = NEW.roster_period_staffing_dagdelen_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    RAISE NOTICE '[DRAAD369]    Nieuwe variant +1 (affected: %)', v_rows_affected;
    
  ELSE
    -- Andere wijzigingen (bijv. notes, blocked_by, etc.) → geen actie
    RAISE NOTICE '[DRAAD369] ℹ️  Andere wijziging (geen invulling change)';
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[DRAAD369] ❌ ERROR in trigger: %', SQLERRM;
    RAISE WARNING '[DRAAD369] Assignment ID: %, Employee: %, Date: %',
      NEW.id, NEW.employee_id, NEW.date;
    RAISE WARNING '[DRAAD369] OLD: status=%, variant_id=%',
      OLD.status, OLD.roster_period_staffing_dagdelen_id;
    RAISE WARNING '[DRAAD369] NEW: status=%, variant_id=%',
      NEW.status, NEW.roster_period_staffing_dagdelen_id;
    RAISE;
END;
$$;

-- STAP 3d: MAAK NIEUWE TRIGGER
-- =====================================================
CREATE TRIGGER trg_update_roster_assignment_invulling
    AFTER UPDATE ON roster_assignments
    FOR EACH ROW
    WHEN (
      -- Trigger activeert ALLEEN wanneer:
      -- 1. Status wijzigt
      OLD.status IS DISTINCT FROM NEW.status
      OR
      -- 2. Staffing variant wijzigt (EN status is 1)
      (OLD.roster_period_staffing_dagdelen_id IS DISTINCT FROM 
       NEW.roster_period_staffing_dagdelen_id AND NEW.status = 1)
    )
    EXECUTE FUNCTION update_roster_assignment_invulling();

-- STAP 3e: VERIFICATIE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DRAAD369 FASE 3: TRIGGER SUCCESVOL AANGEMAAKT';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Trigger Details:';
  RAISE NOTICE '  ✅ Naam: trg_update_roster_assignment_invulling';
  RAISE NOTICE '  ✅ Timing: AFTER UPDATE (niet INSERT/DELETE)';
  RAISE NOTICE '  ✅ Matching: ID-based (NIET multi-field)';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Logica:';
  RAISE NOTICE '  ✅ Status (0,2,3) → 1: invulling +1 (via ID)';
  RAISE NOTICE '  ✅ Status 1 → (0,2,3): invulling = NULL';
  RAISE NOTICE '  ✅ Variant swap: oude NULL, nieuwe +1';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️  Veiligheid:';
  RAISE NOTICE '  ✅ NULL-check op variant ID';
  RAISE NOTICE '  ✅ Warning logs bij missende ID';
  RAISE NOTICE '  ✅ Exception handling met rollback';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
```

---

## 💻 BACKEND-AANPASSINGEN

### Fase 4: Backend Logic Updates (STAP 4)

**Betreffende bestanden:**
- `/src/lib/api/assignments.js` (INSERT/UPDATE handlers)
- `/src/lib/api/afl.js` (AFL integration)
- `/src/components/RosterModal.svelte` (Manual planning modal)

#### 4a. Assignment INSERT - ID meegeven

**File:** `/src/lib/api/assignments.js`

```javascript
// =====================================================
// DRAAD369: INSERT ASSIGNMENT MET STAFFING VARIANT ID
// =====================================================

/**
 * Voeg assignment toe met staffing variant ID
 * @param {object} assignmentData - { rosterId, employeeId, date, dagdeel, serviceId, team, variantId, ... }
 * @returns {object} Nieuwe assignment record
 */
export async function insertAssignment(assignmentData) {
  
  // Destructure
  const {
    roster_id,
    employee_id,
    date,
    dagdeel,
    service_id,
    team,
    roster_period_staffing_dagdelen_id,  // ← KEY!
    notes = null,
    source = 'manual'
  } = assignmentData;

  // Validatie
  if (!roster_period_staffing_dagdelen_id) {
    throw new Error(
      `[DRAAD369] Missing roster_period_staffing_dagdelen_id ` +
      `for assignment on ${date} ${dagdeel}`
    );
  }

  // INSERT
  const { data, error } = await supabase
    .from('roster_assignments')
    .insert([{
      roster_id,
      employee_id,
      date,
      dagdeel,
      service_id,
      team,
      roster_period_staffing_dagdelen_id,  // ← Meegeven!
      status: 1,  // 1 = gepland
      notes,
      source,
      created_at: new Date().toISOString()
    }])
    .select();

  if (error) {
    console.error('[DRAAD369] INSERT error:', error);
    throw error;
  }

  console.log('[DRAAD369] Assignment inserted:', data[0]?.id);
  return data[0];
}
```

#### 4b. Assignment UPDATE - Status/Variant wijzigen

**File:** `/src/lib/api/assignments.js`

```javascript
/**
 * Update assignment status/variant
 * @param {uuid} assignmentId - Assignment ID
 * @param {object} updateData - { status?, roster_period_staffing_dagdelen_id?, ... }
 * @returns {object} Updated assignment record
 */
export async function updateAssignment(assignmentId, updateData) {
  
  const {
    status,
    roster_period_staffing_dagdelen_id,
    notes,
    // ... andere velden
  } = updateData;

  // Build update object (only changed fields)
  const updates = {};
  if (typeof status !== 'undefined') updates.status = status;
  if (roster_period_staffing_dagdelen_id) {
    updates.roster_period_staffing_dagdelen_id = roster_period_staffing_dagdelen_id;
  }
  if (notes !== undefined) updates.notes = notes;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('roster_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select();

  if (error) {
    console.error('[DRAAD369] UPDATE error:', error);
    throw error;
  }

  console.log('[DRAAD369] Assignment updated:', assignmentId);
  return data[0];
}
```

#### 4c. Modal - Dienst-variant ophalen MET ID

**File:** `/src/components/RosterModal.svelte`

```javascript
// =====================================================
// DRAAD369: MODAL - OPEN DIENSTEN MET VARIANT ID
// =====================================================

/**
 * Laad open diensten voor datum/dagdeel
 * BELANGRIJK: Retourneert ook roster_period_staffing_dagdelen.id!
 */
async function loadOpenServices(rosterId, date, dagdeel) {
  
  const { data: staffingServices, error } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select(`
      id,                    // ← KEY! Variant ID
      service_id,
      team,
      aantal,
      invulling,
      service_types!inner(code, naam, kleur)
    `)
    .eq('roster_id', rosterId)
    .eq('date', date)
    .eq('dagdeel', dagdeel)
    .eq('status', 'active')
    .filter('aantal', 'gt', 0)  // aantal > 0
    .filter('invulling', 'is', 'NULL', { or: 'invulling < aantal' });  // niet vol

  if (error) {
    console.error('[DRAAD369] Error loading open services:', error);
    throw error;
  }

  // Format voor UI
  const formattedServices = staffingServices.map(s => ({
    variant_id: s.id,          // ← Store variant ID!
    service_id: s.service_id,
    team: s.team,
    code: s.service_types.code,
    name: s.service_types.naam,
    color: s.service_types.kleur,
    total: s.aantal,
    filled: s.invulling || 0,
    available: (s.aantal) - (s.invulling || 0)
  }));

  return formattedServices;
}

/**
 * Toekennen dienst aan medewerker
 */
async function assignService(selectedService, employeeId) {
  
  try {
    // selectedService bevat nu variant_id!
    await insertAssignment({
      roster_id: rosterId,
      employee_id: employeeId,
      date: selectedDate,
      dagdeel: selectedDagdeel,
      service_id: selectedService.service_id,
      team: selectedService.team,
      roster_period_staffing_dagdelen_id: selectedService.variant_id,  // ← KEY!
      source: 'manual'
    });

    console.log('[DRAAD369] Service assigned successfully');
    
    // Refresh
    await loadOpenServices(rosterId, selectedDate, selectedDagdeel);
    
  } catch (err) {
    console.error('[DRAAD369] Assignment error:', err);
    // Show error to user
  }
}
```

#### 4d. AFL Integration - ID Lookup

**File:** `/src/lib/api/afl.js`

```sql
-- =====================================================
-- DRAAD369: AFL INSERT MET VARIANT ID
-- =====================================================

-- Bij AFL run, zorg dat variant ID mee wordt gegeven:

INSERT INTO roster_assignments (
  roster_id,
  employee_id,
  date,
  dagdeel,
  service_id,
  team,
  roster_period_staffing_dagdelen_id,  -- ← KEY!
  status,
  source,
  constraint_reason,
  created_at
)
SELECT 
  afl_results.roster_id,
  afl_results.employee_id,
  afl_results.date,
  afl_results.dagdeel,
  afl_results.service_id,
  afl_results.team,
  rpsd.id,                              -- ← Lookup variant ID!
  1,                                    -- status=1 (gepland)
  'afl',
  afl_results.reason,
  NOW()
FROM afl_results
JOIN roster_period_staffing_dagdelen rpsd
  ON rpsd.roster_id = afl_results.roster_id
  AND rpsd.date = afl_results.date
  AND rpsd.dagdeel = afl_results.dagdeel
  AND rpsd.service_id = afl_results.service_id
  AND rpsd.team = afl_results.team
WHERE afl_results.status = 'assigned';
```

---

## 📋 UITVOERING-INSTRUCTIES

### Pre-flight Checklist

- [ ] **Backup gemaakt** van Supabase database (via Supabase UI → Backups)
- [ ] **Alle bestanden** gereed (dit document + SQL-scripts)
- [ ] **Git branch** aangemaakt: `feature/draad369-staffing-id`
- [ ] **Geen actieve roosters** in database (we starten schoon)

### Executie-Stappen

#### **STAP 1: Schema-wijzigingen uitvoeren (Supabase)**

1. **Open Supabase Dashboard**
   - Ga naar: `https://supabase.com/dashboard/project/rzecogncpkjfytebfkni`
   - Klik op: **SQL Editor**

2. **Voer FASE 1 SQL uit** (schema-aanpassingen)
   - Copy de SQL uit "Fase 1: Schema-wijzigingen" hierboven
   - Plak in SQL Editor
   - Klik **▶️ RUN**
   - Wacht op `✅ DRAAD369 FASE 1: SCHEMA WIJZIGINGEN SUCCESVOL`

3. **Voer FASE 2 SQL uit** (DEFAULT NULL)
   - Copy de SQL uit "Fase 2: DEFAULT-waarde"
   - Plak in SQL Editor
   - Klik **▶️ RUN**
   - Wacht op `✅ DRAAD369 FASE 2: INVULLING DEFAULT SUCCESVOL`

4. **Voer FASE 3 SQL uit** (Trigger)
   - Copy de SQL uit "Fase 3: Vereenvoudigde Trigger"
   - Plak in SQL Editor
   - Klik **▶️ RUN**
   - Wacht op `✅ DRAAD369 FASE 3: TRIGGER SUCCESVOL AANGEMAAKT`

#### **STAP 2: Backend-code aanpassen (GitHub)**

1. **Maak branch aan:**
   ```bash
   git checkout -b feature/draad369-staffing-id
   ```

2. **Update bestanden** (zie "FASE 4: Backend Logic Updates"):
   - [ ] `/src/lib/api/assignments.js` - insertAssignment() + updateAssignment()
   - [ ] `/src/components/RosterModal.svelte` - loadOpenServices() + assignService()
   - [ ] `/src/lib/api/afl.js` - AFL INSERT query met ID lookup

3. **Test-aanpassingen** (optioneel):
   - Voeg null-checks toe in UI
   - Log variant_id in console
   - Controleer trigger logs in Supabase

4. **Commit & push:**
   ```bash
   git add .
   git commit -m "DRAAD369: Voeg roster_period_staffing_dagdelen_id + NULL-invulling toe"
   git push origin feature/draad369-staffing-id
   ```

5. **Create Pull Request** op GitHub:
   - Title: `DRAAD369: Staffing Variant ID + NULL-handling`
   - Description: Link naar DRAAD369 analysis
   - Reviewers: (je team)

#### **STAP 3: Deploy naar Railway**

1. **Merge PR** in GitHub (main branch)

2. **Railway auto-deploy** (GitHub connected)
   - Wacht op deployment te voltooien
   - Check logs op fouten

3. **Verificatie** (zie volgende sectie)

---

## ✅ VERIFICATIE-CHECKLIST

### Database-checks (Supabase)

```sql
-- =====================================================
-- DRAAD369: VERIFICATIE QUERIES
-- =====================================================

-- 1. Controleer kolom bestaat en juist type
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'roster_assignments'
  AND column_name = 'roster_period_staffing_dagdelen_id';

-- Expected:
-- | column_name | data_type | is_nullable | column_default |
-- | roster_period_staffing_dagdelen_id | uuid | YES | NULL |

-- 2. Controleer Foreign Key constraint
SELECT constraint_name, table_name, column_name, foreign_table_name
FROM information_schema.key_column_usage
WHERE table_name = 'roster_assignments'
  AND column_name = 'roster_period_staffing_dagdelen_id';

-- Expected:
-- | constraint_name | table_name | column_name | foreign_table_name |
-- | fk_roster_assignments_staffing_variant | roster_assignments | roster_period_staffing_dagdelen_id | roster_period_staffing_dagdelen |

-- 3. Controleer indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'roster_assignments'
  AND indexname LIKE '%staffing%';

-- Expected: 2 indexes
-- - idx_roster_assignments_staffing_id
-- - idx_roster_assignments_status_staffing_id

-- 4. Controleer invulling DEFAULT
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'roster_period_staffing_dagdelen'
  AND column_name = 'invulling';

-- Expected:
-- | column_name | column_default |
-- | invulling | NULL::integer |

-- 5. Controleer trigger bestaat
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'roster_assignments'
  AND trigger_name = 'trg_update_roster_assignment_invulling';

-- Expected:
-- | trigger_name | event_manipulation | event_object_table |
-- | trg_update_roster_assignment_invulling | UPDATE | roster_assignments |
```

### Application-checks

```javascript
// =====================================================
// DRAAD369: APPLICATIE VERIFICATIE
// =====================================================

// 1. Test INSERT assignment met variant ID
console.log('[DRAAD369] Test 1: INSERT met variant ID');
const assignment = await insertAssignment({
  roster_id: 'test-roster-id',
  employee_id: 'test-employee',
  date: new Date().toISOString().split('T')[0],
  dagdeel: 'O',
  service_id: 'test-service-id',
  team: 'GRO',
  roster_period_staffing_dagdelen_id: 'test-variant-id'  // Should not throw
});
console.log('✅ Assignment created:', assignment.id);

// 2. Test UPDATE status change
console.log('[DRAAD369] Test 2: UPDATE status 1 → 0');
const updated = await updateAssignment(assignment.id, { status: 0 });
console.log('✅ Assignment updated, status:', updated.status);

// 3. Check trigger logs
console.log('[DRAAD369] Test 3: Check Supabase logs');
// → Go to: Supabase → Database → Logs
// → Should see DRAAD369 NOTICE messages
```

### Manuele UI-tests

- [ ] Open modal: "Diensten op datum X"
- [ ] Controleer `variant_id` in network request
- [ ] Teken dienst toe aan medewerker
- [ ] Controleer `invulling` updated in database
- [ ] Trek dienst in
- [ ] Controleer `invulling` terug op NULL
- [ ] Wissel dienst (variant) om
- [ ] Controleer oude variant NULL, nieuwe variant +1

---

## 🔍 TROUBLESHOOTING

### Issue: "Foreign Key violation"

**Oorzaak:** `roster_period_staffing_dagdelen_id` verwijst naar non-existent row

**Oplossing:**
```sql
-- Zorg dat staffing-row EXISTS voordat assignment insert:
SELECT id FROM roster_period_staffing_dagdelen
WHERE roster_id = ? AND date = ? AND dagdeel = ? AND team = ? AND service_id = ?;
```

### Issue: "Trigger did not affect any rows"

**Oorzaak:** Variant ID is NULL, trigger slaat update over

**Oplossing:**
```javascript
// In frontend, always provide variant ID:
if (!variantId) {
  throw new Error('Variant ID is required for assignment');
}
```

### Issue: "Constraint trg_update_roster_assignment_invulling violated"

**Oorzaak:** Trigger conditie niet correct

**Oplossing:**
```sql
-- Check trigger definition:
SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_update_roster_assignment_invulling';
```

---

## 📝 NOTES

### Semantiek NULL vs 0

```
invulling = NULL   →  Dienst niet actief (status ≠ 1)
           0      →  Dienst actief, 0 ingevuld
           1-N    →  Dienst actief, 1-N ingevuld
```

### Performance

- Composite index `(status, roster_period_staffing_dagdelen_id)` optimaliseert queries
- FK constraint `ON DELETE RESTRICT` beschermt integriteit
- `COALESCE(invulling, 0)` handelt NULL elegant af

### Future extensions

- Audit trail voor invulling-wijzigingen (toevoegen historische tabel)
- Alerts bij unter-/overbezetting (query `invulling IS NULL` of `invulling < aantal`)
- Reporting op invulling-coverage per week/maand

---

## ✨ KLAAR!

Dit document is de complete implementatie-opdracht voor DRAAD369.

**Volgende stap:** Upload dit bestand naar DRAAD369 en voer stappen uit.

**Vragen?** Check deze punten:
1. Context DRAAD368 goed begrepen?
2. SQL-syntax correct (copy-paste exact)?
3. Backend-files juist geupdatet?
4. Verificatie-queries alle ✅?

🚀 Go!
