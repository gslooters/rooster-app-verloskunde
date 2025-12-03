# DRAAD99B - Systeemdiensten Bescherming

## Overzicht

DRAD99B implementeert bescherming voor kritische systeemdiensten die gebruikt worden voor automatische dagblok blokkering (DRAAD99A). Deze diensten mogen niet verwijderd of gewijzigd worden omdat ze essentieel zijn voor de werking van het systeem.

**Status:** ✅ Geïmplementeerd  
**Datum:** 2024-12-03  
**Afhankelijkheden:** DRAAD99A (automatische blokkering trigger)

---

## Systeemdiensten

De volgende 4 diensten zijn gemarkeerd als systeemdienst:

| Code | Naam | Functie | Blokkeert |
|------|------|---------|----------|
| **DIO** | Dienst Inroosteren Ochtend | Blokkeert ochtend na trigger dienst | Ochtend volgende dag |
| **DDO** | Dienst Deler Out | Blokkeert middag na trigger dienst | Middag volgende dag |
| **DIA** | Dienst Inroosteren Avond | Blokkeert avond na trigger dienst | Avond volgende dag |
| **DDA** | Dienst Deler Avond | Blokkeert avond na trigger dienst | Avond volgende dag |

**Belangrijke eigenschappen:**
- `is_system = true` in database
- `blokkeert_volgdag = false` (ze blokkeren specifieke dagdelen, niet hele dagen)
- `actief = true` altijd
- Worden automatisch aangemaakt door DRAAD99A migratie

---

## Database Schema

### Nieuwe Kolom: `is_system`

```sql
ALTER TABLE service_types 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
```

**Type:** BOOLEAN  
**Default:** false  
**Nullable:** Nee  
**Beschrijving:** Markeert systeemdiensten die niet verwijderd of aangepast mogen worden

### Systeemdiensten Markeren

```sql
UPDATE service_types 
SET is_system = true 
WHERE code IN ('DIO', 'DDO', 'DIA', 'DDA');
```

### Database Triggers

#### 1. DELETE Bescherming

```sql
CREATE OR REPLACE FUNCTION prevent_system_service_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system = true THEN
        RAISE EXCEPTION 'Systeemdiensten kunnen niet verwijderd worden: %', OLD.code;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_system_delete
BEFORE DELETE ON service_types
FOR EACH ROW
EXECUTE FUNCTION prevent_system_service_delete();
```

**Werking:**
- Voorkomt DELETE operaties op rijen waar `is_system = true`
- Gooit exception met duidelijke foutmelding
- Laatste verdedigingslinie als frontend/backend checks falen

#### 2. Code Wijziging Bescherming

```sql
CREATE OR REPLACE FUNCTION prevent_system_service_code_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system = true AND NEW.code != OLD.code THEN
        RAISE EXCEPTION 'Code van systeemdiensten kan niet gewijzigd worden: %', OLD.code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_system_code_change
BEFORE UPDATE ON service_types
FOR EACH ROW
EXECUTE FUNCTION prevent_system_service_code_change();
```

**Werking:**
- Voorkomt UPDATE van `code` kolom voor systeemdiensten
- Andere velden (naam, kleur, etc.) mogen WEL gewijzigd worden
- Beschermt integriteit van automatische blokkering logica

---

## TypeScript Type Definitie

### Dienst Interface (lib/types/dienst.ts)

```typescript
export interface Dienst {
  // ... andere velden
  
  /**
   * Markering voor systeemdiensten die niet verwijderd of aangepast mogen worden
   * TRUE voor: DIO, DDO, DIA, DDA (automatische blokkering diensten)
   * Deze diensten worden gebruikt door de automatische dagblok blokkering
   */
  is_system?: boolean;
  
  /**
   * @deprecated Wordt vervangen door is_system in DRAAD99B
   * Gebruik is_system in plaats daarvan voor nieuwe code
   */
  system?: boolean;
}
```

**Backward Compatibility:**
- `system` veld blijft bestaan voor oude code
- Nieuwe code gebruikt `is_system`
- Beide velden worden ondersteund in database mapping

---

## Frontend Bescherming

### 1. Verwijder Knop Verbergen

**Locatie:** `app/services/types/page.tsx` (regel ~685)

```tsx
{!dienst.is_system ? (
  <>
    <button onClick={() => openModal(dienst)}>
      Bewerken
    </button>
    <button onClick={() => handleDelete(dienst)}>
      Verwijderen
    </button>
  </>
) : (
  <div className="text-center text-gray-400 py-2 border rounded">
    Systeemdienst - Niet bewerkbaar
  </div>
)}
```

**Effect:**
- DIO, DDO, DIA, DDA: Geen "Verwijderen" knop, alleen bericht
- Andere diensten: Normale "Bewerken" en "Verwijderen" knoppen

### 2. Code Veld Disabled

**Locatie:** `app/services/types/page.tsx` (regel ~565)

```tsx
<input 
  type="text" 
  value={formData.code}
  disabled={editingDienst?.is_system || submitting}
  // ... andere props
/>
```

**Effect:**
- Code veld is grijs en niet aanpasbaar bij bewerken van systeemdiensten
- Voorkomt onbedoelde wijzigingen van DIO/DDO/DIA/DDA codes

### 3. Toggle Tekst Correctie

**Locatie:** `app/services/types/page.tsx` (regel ~695)

**Voor:**
```tsx
🚫 Blokkeert volgende dag (bijv. na nachtdienst)
```

**Na:**
```tsx
🚫 Blokkeert volgende dagdeel (bijv. na nachtdienst)
```

**Reden:**
- Systeemdiensten blokkeren specifieke dagdelen, niet hele dagen
- DIO blokkeert alleen ochtend, DDO alleen middag, etc.
- Accuratere beschrijving van functionaliteit

### 4. Systeem Badge in UI

```tsx
{dienst.is_system && (
  <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-medium">
    SYSTEEM
  </span>
)}
```

**Effect:**
- Visuele indicatie dat dienst een systeemdienst is
- Helpt gebruikers begrijpen waarom bepaalde acties niet beschikbaar zijn

---

## Backend Bescherming

### canDeleteService Check

**Locatie:** `lib/services/diensten-storage.ts`

```typescript
export async function canDeleteService(code: string): Promise<{ canDelete: boolean; reason?: string }> {
  const service = await getServiceByCode(code);
  
  if (!service) {
    return {
      canDelete: false,
      reason: 'Dienst niet gevonden'
    };
  }
  
  // DRAAD99B: Check is_system vlag
  if (service.is_system) {
    return { 
      canDelete: false, 
      reason: 'Dit is een systeemdienst en kan niet verwijderd worden (DIO, DDO, DIA, DDA)' 
    };
  }
  
  // ... rest van checks
}
```

**Werking:**
- Wordt aangeroepen vóór elke delete operatie
- Controleert `is_system` vlag uit database
- Retourneert `canDelete: false` voor systeemdiensten
- Frontend toont `reason` aan gebruiker

### Database Mapping

**fromDatabase:**
```typescript
function fromDatabase(row: any): Dienst {
  return {
    // ... andere velden
    system: row.system ?? false,      // DEPRECATED
    is_system: row.is_system ?? false, // DRAAD99B
  };
}
```

**toDatabase:**
```typescript
function toDatabase(dienst: Partial<Dienst>) {
  return {
    // ... andere velden
    system: dienst.system,        // DEPRECATED
    is_system: dienst.is_system,  // DRAAD99B
  };
}
```

**Backward Compatibility:**
- Beide velden worden ge-mapped
- Oude code kan `system` blijven gebruiken
- Nieuwe code gebruikt `is_system`

---

## Installatie Instructies

### Stap 1: SQL Migratie Uitvoeren

**BELANGRIJK:** Jij moet de SQL handmatig uitvoeren in Supabase!

1. Open Supabase Dashboard
2. Ga naar SQL Editor
3. Open het bestand: `supabase/migrations/20241203_add_system_flag.sql`
4. Kopieer de volledige inhoud
5. Plak in Supabase SQL Editor
6. Klik "Run"
7. Controleer geen errors

**Verificatie Query:**
```sql
SELECT code, naam, is_system 
FROM service_types 
WHERE is_system = true 
ORDER BY code;
```

**Verwachte output:**
```
code | naam                        | is_system
-----+-----------------------------+----------
DDA  | Dienst Deler Avond          | true
DDO  | Dienst Deler Out            | true
DIA  | Dienst Inroosteren Avond    | true
DIO  | Dienst Inroosteren Ochtend  | true
```

### Stap 2: Code Deploy

Code is al ge-commit en ge-pushed naar GitHub:

```bash
✅ SQL migratie bestand aangemaakt
✅ Type definitie bijgewerkt
✅ Frontend bescherming geïmplementeerd
✅ Backend checks toegevoegd
✅ Cache-busting toegepast
✅ Documentatie geschreven
```

Railway zal automatisch deployen.

### Stap 3: Verificatie

Na SQL uitvoering + Railway deploy:

**Frontend Checks:**
1. Open `/services/types`
2. Zoek DIO, DDO, DIA, DDA diensten
3. Verifieer GEEN "Verwijderen" knop zichtbaar
4. Klik "Bewerken" op DIO
5. Verifieer Code veld is grijs/disabled
6. Verifieer toggle tekst: "Blokkeert volgende dagdeel"
7. Zoek andere dienst (bijv. ECH)
8. Verifieer WEL "Verwijderen" knop zichtbaar

**Database Checks:**
```sql
-- Check triggers bestaan
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'service_types';

-- Verwacht:
-- trg_prevent_system_delete
-- trg_prevent_system_code_change

-- Probeer systeemdienst te verwijderen (moet falen)
DELETE FROM service_types WHERE code = 'DIO';
-- Verwachte error: "Systeemdiensten kunnen niet verwijderd worden: DIO"

-- Probeer code te wijzigen (moet falen)
UPDATE service_types SET code = 'XXX' WHERE code = 'DIO';
-- Verwachte error: "Code van systeemdiensten kan niet gewijzigd worden: DIO"
```

---

## Test Scenario's

### Test 1: Frontend Delete Bescherming

**Stappen:**
1. Open `/services/types`
2. Zoek DIO dienst
3. Verifieer GEEN "Verwijderen" knop
4. Verifieer tekst "Systeemdienst - Niet bewerkbaar"

**Verwacht:** ✅ Geen delete knop, alleen bericht

---

### Test 2: Frontend Code Edit Bescherming

**Stappen:**
1. Open `/services/types`
2. Klik "Bewerken" op DDO
3. Bekijk Code veld
4. Probeer te typen in Code veld

**Verwacht:** ✅ Code veld is disabled (grijs), kan niet typen

---

### Test 3: Toggle Tekst Correctie

**Stappen:**
1. Open `/services/types`
2. Klik "Bewerken" op willekeurige dienst
3. Bekijk checkbox tekst onder "Actief"

**Verwacht:** ✅ Tekst is "🚫 Blokkeert volgende dagdeel (bijv. na nachtdienst)"

---

### Test 4: Backend canDeleteService

**Methode:** Browser console
```javascript
// In browser console op /services/types pagina
const response = await fetch('/api/diensten-aanpassen', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'DIO' })
});
console.log(await response.json());
```

**Verwacht:** 
```json
{
  "error": "Dit is een systeemdienst en kan niet verwijderd worden (DIO, DDO, DIA, DDA)"
}
```

---

### Test 5: Database Trigger DELETE

**Methode:** Supabase SQL Editor
```sql
DELETE FROM service_types WHERE code = 'DIA';
```

**Verwacht:** Error: "Systeemdiensten kunnen niet verwijderd worden: DIA"

---

### Test 6: Database Trigger UPDATE Code

**Methode:** Supabase SQL Editor
```sql
UPDATE service_types SET code = 'XXX' WHERE code = 'DDA';
```

**Verwacht:** Error: "Code van systeemdiensten kan niet gewijzigd worden: DDA"

---

### Test 7: Andere Velden WEL Wijzigen

**Methode:** Supabase SQL Editor
```sql
UPDATE service_types 
SET naam = 'Dienst Deler Avond (Test)', kleur = '#FF0000' 
WHERE code = 'DDA';
```

**Verwacht:** ✅ Update succesvol (naam en kleur mogen wel gewijzigd)

---

## Fouten & Oplossingen

### Error: "Column is_system does not exist"

**Oorzaak:** SQL migratie nog niet uitgevoerd  
**Oplossing:** Voer `20241203_add_system_flag.sql` uit in Supabase

---

### Error: "Function prevent_system_service_delete does not exist"

**Oorzaak:** Database triggers niet aangemaakt  
**Oplossing:** Voer volledige SQL migratie uit (bevat trigger functies)

---

### Verwijder knop nog zichtbaar voor DIO/DDO/DIA/DDA

**Mogelijke oorzaken:**
1. SQL migratie niet uitgevoerd (`is_system` nog niet true)
2. Browser cache (hard refresh met Ctrl+Shift+R)
3. Frontend code niet ge-deployed

**Oplossing:**
```sql
-- Check is_system waarde
SELECT code, is_system FROM service_types WHERE code IN ('DIO', 'DDO', 'DIA', 'DDA');

-- Als false, voer uit:
UPDATE service_types SET is_system = true WHERE code IN ('DIO', 'DDO', 'DIA', 'DDA');
```

---

### Code veld niet disabled bij bewerken

**Oorzaak:** Frontend gebruikt nog oude `dienst.system` i.p.v. `dienst.is_system`  
**Oplossing:** Check page.tsx regel 565, moet `editingDienst?.is_system` zijn

---

## Relatie met Andere DRADEN

### DRAAD99A: Automatische Blokkering Trigger

**Relatie:** DRAAD99B beschermt de diensten die DRAAD99A gebruikt

**DRAAD99A functie:**
- Detecteert diensten met `blokkeert_volgdag = true`
- Maakt automatisch DIO/DDO/DIA/DDA diensten aan
- Plaats deze diensten in volgende dagdelen

**DRAAD99B functie:**
- Voorkomt dat DIO/DDO/DIA/DDA verwijderd worden
- Voorkomt dat codes gewijzigd worden
- Beschermt integriteit van automatische blokkering

**Afhankelijkheid:**
- DRAAD99B vereist dat DRAAD99A migratie al gedraaid is
- Anders bestaan DIO/DDO/DIA/DDA diensten nog niet

---

## Toekomstige Uitbreidingen

### Mogelijke Verbeteringen

1. **Admin Override:**
   - Speciale "Admin Mode" om systeemdiensten toch te kunnen bewerken
   - Alleen voor superusers met speciale rechten

2. **Audit Logging:**
   - Log pogingen om systeemdiensten te verwijderen
   - Traceer wie wanneer probeerde te wijzigen

3. **Systeemdienst Configuratie:**
   - Maak lijst van systeemdiensten configureerbaar
   - Toevoegen/verwijderen via admin interface

4. **Meer Beschermde Velden:**
   - Ook `begintijd`, `eindtijd` beschermen voor systeemdiensten
   - Voorkom wijzigingen die automatische blokkering breken

---

## Samenvatting

✅ **is_system kolom** toegevoegd aan database  
✅ **Database triggers** beschermen tegen DELETE en code wijziging  
✅ **Frontend** verbergt verwijder knop en disabled code veld  
✅ **Backend** controleert is_system bij delete operaties  
✅ **Toggle tekst** gecorrigeerd naar "dagdeel" i.p.v. "dag"  
✅ **Backward compatible** met oude `system` veld  
✅ **Volledig gedocumenteerd** met test scenario's  

**Systeemdiensten (DIO, DDO, DIA, DDA) zijn nu volledig beschermd tegen ongewenste wijzigingen!**

---

## Commit History

```
f222e2c - DRAAD99B: Voeg is_system kolom en database bescherming toe
258c189 - DRAAD99B: Voeg is_system veld toe aan Dienst type
bb0f117 - DRAAD99B: Implementeer is_system bescherming in frontend
0e9eab9 - DRAAD99B: Voeg is_system ondersteuning toe aan diensten-storage
ee9330f - DRAAD99B: Cache-busting voor systeemdiensten bescherming
0ea20e7 - DRAAD99B: Railway deployment trigger
```

---

## Contact & Support

Voor vragen of problemen met systeemdiensten bescherming:

1. Check eerst deze documentatie
2. Verifieer SQL migratie is uitgevoerd
3. Test met bovenstaande test scenario's
4. Check Railway deployment logs
5. Controleer browser console voor errors

**Database migratie:** `supabase/migrations/20241203_add_system_flag.sql`  
**Railway dashboard:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f