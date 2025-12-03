# 🏁 DRAAD 99A - Automatische Blokkering Implementatie

**Datum:** 3 december 2025  
**Status:** ✅ VOLTOOID  
**Implementatie:** PostgreSQL Trigger Function

---

## 📊 Overzicht

De automatische blokkeringlogica is geïmplementeerd via een **PostgreSQL trigger** die automatisch reageert op INSERT, UPDATE en DELETE operaties in de `roster_assignments` tabel.

### Kern Functionaliteit

| Event | Actie |
|-------|-------|
| **INSERT** | Bij status 0→1: Blokkeer benodigde dagdelen (status 0→2) |
| **UPDATE** | Bij dienst wijziging: Deblokkeer oude dienst, blokkeer nieuwe dienst |
| **DELETE** | Deblokkeer alle geblokkeerde dagdelen van deze dienst |

---

## 🛠️ Technische Details

### Trigger Functie

```sql
CREATE TRIGGER trg_roster_assignment_auto_blocking
    AFTER INSERT OR UPDATE OR DELETE ON roster_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trg_roster_assignment_status_management();
```

### Blokkeerlogica

| Dienst | Type | Tijd | Dagdeel | Blokkeert |
|--------|------|------|---------|------------|
| **DIO** | Dagdienst | 09:00-18:00 | O | M van **zelfde dag** |
| **DDO** | Dagdienst | 09:00-18:00 | O | M van **zelfde dag** |
| **DIA** | Nachtdienst | 18:00-09:00 | A | O+M van **volgende dag** |
| **DDA** | Nachtdienst | 18:00-09:00 | A | O+M van **volgende dag** |

### ⚠️ Kritieke Bescherming

**Status 3 (structureel NB) wordt NOOIT overschreven!**

```sql
WHERE roster_assignments.status = 0  -- Alleen status 0 mag naar 2!
```

---

## 🧪 Test Scenario's

### Test 1: Basis Blokkering (DIO)

**Scenario:**
```sql
-- 1. Plan DIO op 10 dec O
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status, service_id)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-10', 'O', 1, '<DIO_service_uuid>');

-- 2. Verwacht resultaat: M van 10 dec automatisch status 2
SELECT * FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-10' 
  AND dagdeel = 'M';
-- Moet status = 2 tonen
```

### Test 2: Dienstwisseling

**Scenario:**
```sql
-- 1. Plan DIO op 10 dec O (M wordt geblokkeerd)
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status, service_id)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-10', 'O', 1, '<DIO_service_uuid>');

-- 2. Wijzig naar ECH (niet-blokkerende dienst)
UPDATE roster_assignments
SET service_id = '<ECH_service_uuid>'
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-10' 
  AND dagdeel = 'O';

-- 3. Verwacht: M van 10 dec terug naar status 0
SELECT * FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-10' 
  AND dagdeel = 'M';
-- Moet status = 0 tonen
```

### Test 3: Status 3 Bescherming (❗ KRITIEK)

**Scenario:**
```sql
-- 1. Stel M van 11 dec in op status 3 (structureel NB)
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-11', 'M', 3);

-- 2. Plan DIO op 11 dec O (zou normaal M blokkeren)
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status, service_id)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-11', 'O', 1, '<DIO_service_uuid>');

-- 3. Verwacht: M van 11 dec blijft status 3 (NIET overschreven naar 2)
SELECT * FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-11' 
  AND dagdeel = 'M';
-- Moet status = 3 tonen!
```

### Test 4: Nachtdienst (DIA)

**Scenario:**
```sql
-- 1. Plan DIA op 12 dec A
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status, service_id)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-12', 'A', 1, '<DIA_service_uuid>');

-- 2. Verwacht: O+M van 13 dec automatisch status 2
SELECT * FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-13' 
  AND dagdeel IN ('O', 'M');
-- Beide moeten status = 2 tonen
```

### Test 5: Verwijderen Dienst

**Scenario:**
```sql
-- 1. Plan DIA op 12 dec A (O+M van 13 dec geblokkeerd)
INSERT INTO roster_assignments 
    (roster_id, employee_id, date, dagdeel, status, service_id)
VALUES 
    ('<roster_uuid>', 'EMP001', '2025-12-12', 'A', 1, '<DIA_service_uuid>');

-- 2. Verwijder DIA van 12 dec A
DELETE FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-12' 
  AND dagdeel = 'A';

-- 3. Verwacht: O+M van 13 dec automatisch terug naar status 0
SELECT * FROM roster_assignments 
WHERE employee_id = 'EMP001' 
  AND date = '2025-12-13' 
  AND dagdeel IN ('O', 'M');
-- Beide moeten status = 0 tonen
```

---

## 📝 Verificatie Query's

### Toon Alle Blokkades

```sql
SELECT 
    e.voornaam || ' ' || e.achternaam as medewerker,
    ra.date as datum,
    ra.dagdeel,
    CASE ra.status 
        WHEN 0 THEN 'Beschikbaar'
        WHEN 1 THEN 'Ingepland: ' || st.code
        WHEN 2 THEN 'Geblokkeerd'
        WHEN 3 THEN 'Structureel NB'
    END as status,
    CASE 
        WHEN ra.blocked_by_date IS NOT NULL 
        THEN 'Door ' || st2.code || ' op ' || ra.blocked_by_date || ' ' || ra.blocked_by_dagdeel
        ELSE NULL
    END as reden_blokkering
FROM roster_assignments ra
LEFT JOIN employees e ON ra.employee_id = e.id
LEFT JOIN service_types st ON ra.service_id = st.id
LEFT JOIN service_types st2 ON ra.blocked_by_service_id = st2.id
WHERE ra.status IN (2, 3)
ORDER BY ra.date, e.achternaam, ra.dagdeel;
```

### Check Service Types met Blokkering

```sql
SELECT 
    code,
    naam,
    begintijd,
    eindtijd,
    blokkeert_volgdag
FROM service_types
WHERE blokkeert_volgdag = true
ORDER BY code;
```

---

## 🚦 Status Codes

| Status | Betekenis | Automatisch? |
|--------|-----------|-------------|
| **0** | Beschikbaar voor inplanning | Ja/Handmatig |
| **1** | Ingepland (service_id gevuld) | Handmatig |
| **2** | Geblokkeerd door vorige dienst | **Automatisch** (via trigger) |
| **3** | Structureel niet beschikbaar | Handmatig |

---

## ✅ Succescriteria

De trigger is succesvol als:

- ✅ DIO op O blokkeert automatisch M van zelfde dag
- ✅ DIA op A blokkeert automatisch O+M van volgende dag  
- ✅ Dienstwisseling DIO→ECH deblokkeert automatisch M
- ✅ Status 3 wordt NOOIT automatisch overschreven
- ✅ Alleen status 0 kan automatisch naar status 2

---

## 📦 Bestanden

- **Trigger SQL:** `supabase/migrations/20241203_trigger_roster_auto_blocking.sql`
- **Functie uit vorige sessie:** `get_blocked_dagdelen_info()` (reeds in database)
- **Database kolommen:** `blocked_by_date`, `blocked_by_dagdeel`, `blocked_by_service_id` (reeds aanwezig)

---

## 📌 Implementatie Details

### Fase 1: Database (VOLTOOID)
- ✅ Kolommen toegevoegd (`blocked_by_*`)
- ✅ Unique constraint toegevoegd
- ✅ Functie `get_blocked_dagdelen_info()` aangemaakt

### Fase 2: Trigger (VOLTOOID - DEZE DRAAD)
- ✅ Trigger functie `trg_roster_assignment_status_management()` aangemaakt
- ✅ Trigger `trg_roster_assignment_auto_blocking` geactiveerd
- ✅ Alle scenario's gedekt (INSERT, UPDATE, DELETE)

### Fase 3: Frontend/Backend (NIET NODIG)
**De trigger werkt volledig automatisch!**

- Bestaande code hoeft NIET aangepast te worden
- API endpoints werken gewoon door
- Frontend hoeft geen extra validatie te doen
- Database regelt alles automatisch

---

## ⚠️ Belangrijke Aandachtspunten

1. **Status 3 Bescherming**
   - Structureel niet beschikbaar moet altijd handmatig blijven
   - Trigger heeft WHERE clause: `WHERE status = 0`

2. **7-dagen Werkweek**
   - Wachtdiensten lopen ook in weekend
   - Geen "skip weekend" logica in blokkering

3. **Deblokkering bij Cascade**
   - Als dienst A blokkeert dag B
   - En dienst A wordt verwijderd
   - Moet dag B automatisch gedeblokeerd worden
   - Check: `blocked_by_service_id` voor correcte deblokkering

4. **Race Conditions**
   - Gebruikt UPSERT met ON CONFLICT
   - Voorkomt dubbele assignments

---

## 🔗 Gerelateerde Draads

- **DRAAD 98**: Database structuur aanpassingen
- **DRAAD 99**: Trigger implementatie (deze draad)
- **Volgende:** Geen frontend/backend aanpassingen nodig!

---

**✅ IMPLEMENTATIE COMPLEET!**  
De automatische blokkering werkt nu volledig automatisch via database triggers.
