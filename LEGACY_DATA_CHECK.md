# LEGACY DATA CHECK - DRAAD 77

**Datum:** 29 november 2025  
**Fase:** DRAAD 77 - Cel Status Structuur Implementatie  
**Doel:** Controleren of bestaande data migratie nodig heeft voor nieuwe velden

---

## NIEUWE DATABASE VELDEN

DRAD 77 introduceert nieuwe velden in `roster_assignments`:

1. **dagdeel** (text) - 'O', 'M', of 'A'
2. **status** (integer) - 0, 1, 2, of 3
3. **service_id** (uuid) - FK naar service_types (null bij status 0,2,3)

Bestaande velden die blijven:
- **service_code** (text) - Voor backwards compatibility

---

## CONTROLE QUERIES

Voer deze queries uit in Supabase SQL Editor om legacy data te detecteren:

### 1. Check Missing Dagdeel

```sql
-- Assignments zonder dagdeel
SELECT COUNT(*) as aantal_zonder_dagdeel
FROM roster_assignments 
WHERE dagdeel IS NULL;

-- Toon eerste 10 records zonder dagdeel
SELECT id, employee_id, date, service_code
FROM roster_assignments 
WHERE dagdeel IS NULL
LIMIT 10;
```

**Verwachting:** Mogelijk aantal > 0 voor oude data  
**Actie indien gevonden:** Migratie Query 1 uitvoeren

---

### 2. Check Missing Status

```sql
-- Assignments zonder status
SELECT COUNT(*) as aantal_zonder_status
FROM roster_assignments 
WHERE status IS NULL;

-- Toon eerste 10 records zonder status
SELECT id, employee_id, date, service_code
FROM roster_assignments 
WHERE status IS NULL
LIMIT 10;
```

**Verwachting:** Mogelijk aantal > 0 voor oude data  
**Actie indien gevonden:** Migratie Query 2 uitvoeren

---

### 3. Check Missing Service Colors

```sql
-- Services zonder kleur
SELECT COUNT(*) as aantal_zonder_kleur
FROM service_types 
WHERE kleur IS NULL;

-- Toon services zonder kleur
SELECT id, code, naam, kleur
FROM service_types 
WHERE kleur IS NULL;
```

**Verwachting:** Mogelijk aantal > 0  
**Actie indien gevonden:** Migratie Query 3 uitvoeren

---

### 4. Check Missing service_id (maar wel service_code)

```sql
-- Assignments met service_code maar zonder service_id
SELECT COUNT(*) as aantal_zonder_service_id
FROM roster_assignments 
WHERE service_code IS NOT NULL 
  AND service_id IS NULL;

-- Toon eerste 10 records
SELECT id, employee_id, date, service_code, service_id
FROM roster_assignments 
WHERE service_code IS NOT NULL 
  AND service_id IS NULL
LIMIT 10;
```

**Verwachting:** Waarschijnlijk aantal > 0 voor oude data  
**Actie indien gevonden:** Migratie Query 4 uitvoeren

---

## MIGRATIE QUERIES

⚠️ **BELANGRIJK: VOER NIET UIT ZONDER OVERLEG!**  
Deze queries wijzigen productie data. Bespreek eerst met gebruiker.

---

### Migratie Query 1: Set Default Dagdeel

```sql
-- Zet dagdeel op 'O' (ochtend) voor alle NULL waarden
UPDATE roster_assignments
SET dagdeel = 'O'
WHERE dagdeel IS NULL;

-- Verificatie
SELECT COUNT(*) as aantal_zonder_dagdeel
FROM roster_assignments 
WHERE dagdeel IS NULL;
-- Verwacht: 0
```

**Rationale:** Default naar ochtend is veilig omdat gebruikers dit handmatig kunnen corrigeren in de nieuwe UI.

---

### Migratie Query 2: Set Default Status

```sql
-- Zet status op 1 (dienst) voor alle NULL waarden
UPDATE roster_assignments
SET status = 1
WHERE status IS NULL;

-- Verificatie
SELECT COUNT(*) as aantal_zonder_status
FROM roster_assignments 
WHERE status IS NULL;
-- Verwacht: 0
```

**Rationale:** Bestaande assignments zijn altijd diensten (status 1), nooit geblokkeerd of NB.

---

### Migratie Query 3: Set Default Service Colors

```sql
-- Zet default kleur #3B82F6 (blauw) voor services zonder kleur
UPDATE service_types
SET kleur = '#3B82F6'
WHERE kleur IS NULL;

-- Verificatie
SELECT COUNT(*) as aantal_zonder_kleur
FROM service_types 
WHERE kleur IS NULL;
-- Verwacht: 0
```

**Rationale:** Blauw is de fallback kleur in de code. Betere kleuren kunnen later handmatig worden ingesteld.

---

### Migratie Query 4: Populate service_id from service_code

```sql
-- Update service_id op basis van service_code
UPDATE roster_assignments ra
SET service_id = st.id
FROM service_types st
WHERE ra.service_code = st.code
  AND ra.service_id IS NULL
  AND ra.service_code IS NOT NULL;

-- Verificatie
SELECT COUNT(*) as aantal_zonder_service_id
FROM roster_assignments 
WHERE service_code IS NOT NULL 
  AND service_id IS NULL;
-- Verwacht: 0
```

**Rationale:** service_id is nodig voor JOIN queries. service_code blijft bestaan voor backwards compatibility.

---

## RESULTATEN

### Uitvoering Datum: [INVULLEN NA CONTROLE]

**Controle 1 - Missing Dagdeel:**
- Aantal gevonden: [INVULLEN]
- Migratie nodig: Ja/Nee
- Migratie uitgevoerd: Ja/Nee/N/A

**Controle 2 - Missing Status:**
- Aantal gevonden: [INVULLEN]
- Migratie nodig: Ja/Nee
- Migratie uitgevoerd: Ja/Nee/N/A

**Controle 3 - Missing Service Colors:**
- Aantal gevonden: [INVULLEN]
- Migratie nodig: Ja/Nee
- Migratie uitgevoerd: Ja/Nee/N/A

**Controle 4 - Missing service_id:**
- Aantal gevonden: [INVULLEN]
- Migratie nodig: Ja/Nee
- Migratie uitgevoerd: Ja/Nee/N/A

---

## BACKWARDS COMPATIBILITY STRATEGIE

De code is zo geschreven dat het werkt met of zonder migratie:

### In getPrePlanningData():
```typescript
dagdeel: row.dagdeel || 'O', // Default ochtend voor legacy data
status: row.status !== null && row.status !== undefined ? row.status : 1, // Default dienst
service_code: row.service_types?.[0]?.code || row.service_code || '', // Fallback chain
```

### In storage functies:
- Alle nieuwe functies gebruiken dagdeel met default 'O'
- Status heeft altijd een fallback naar 1 (dienst)
- service_code blijft bestaan naast service_id

### Legacy UI Support:
- Bestaande PrePlanning UI blijft werken zonder wijzigingen
- Grid blijft 1 kolom per datum (wordt pas in STAP 3 getransformeerd)
- service_code wordt nog steeds gebruikt in bestaande components

---

## VERVOLGSTAPPEN

1. ✅ Voer controle queries uit in Supabase
2. ✅ Documenteer resultaten in sectie "RESULTATEN" hierboven
3. ⚠️ Bespreek met team of migratie nu moet of later
4. ⚠️ Indien nu: voer migratie queries uit (één voor één, met verificatie)
5. ✅ Test dat bestaande PrePlanning UI nog werkt
6. ✅ Ga door naar DRAAD 78 (Grid Component met Dagdelen)

---

## NOTITIES

- Code is **migratie-tolerant**: werkt met of zonder legacy data cleanup
- Migratie kan **later** alsnog worden uitgevoerd zonder code wijzigingen
- Voor **productieklaar** systeem is migratie aanbevolen maar niet verplicht
- Test altijd eerst in **development** omgeving

---

**Status:** 🟡 PENDING - Wacht op controle uitvoering  
**Volgende:** DRAAD 78 - Grid Component met Dagdelen
