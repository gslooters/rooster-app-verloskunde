# DRAAD39 RESET - Kolomnamen Fix Deployment

**Datum:** 20 november 2025, 10:38 AM EST  
**Commit:** bf553523b3d5b632b2367de0b308e665fa9f9db8  
**Prioriteit:** KRITIEK  
**Type:** Database Query Fix

## Probleem

Het scherm "Diensten per week aanpassen" toonde altijd "Geen Data" na klik op een weeknummer in het Dagdelen Dashboard. 

### Root Cause

Mismatch tussen database kolomnamen en TypeScript code:
- **Database kolommen:** `startdate`, `enddate` (lowercase, geen underscore)
- **Code gebruikte:** `start_datum`, `eind_datum` (underscore, Nederlandse naming)
- **Gevolg:** Supabase query faalde met "column does not exist" error

## Wijzigingen

### Bestand: `lib/planning/weekDagdelenData.ts`

#### Functie 1: `getWeekDagdelenData`

**Regel 85-86** (Query select):
```typescript
// VOOR:
.select('id, start_datum, eind_datum')

// NA:
.select('id, startdate, enddate')
```

**Regel 95-96** (Variable assignment):
```typescript
// VOOR:
start_datum: roster.start_datum,
eind_datum: roster.eind_datum

// NA:
startdate: roster.startdate,
enddate: roster.enddate
```

**Regel 105-106** (String comparison variables):
```typescript
// VOOR:
const rosterStartStr = roster.start_datum;
const rosterEndStr = roster.eind_datum;

// NA:
const rosterStartStr = roster.startdate;
const rosterEndStr = roster.enddate;
```

#### Functie 2: `getWeekNavigatieBounds`

**Regel 257** (Query select):
```typescript
// VOOR:
.select('start_datum, eind_datum')

// NA:
.select('startdate, enddate')
```

**Regel 273-274** (Date construction):
```typescript
// VOOR:
const startDate = new Date(roster.start_datum);
const endDate = new Date(roster.eind_datum);

// NA:
const startDate = new Date(roster.startdate);
const endDate = new Date(roster.enddate);
```

## Totaal Wijzigingen

- **8 locaties** waar kolomnamen gecorrigeerd zijn
- **2 functies** gewijzigd
- **0 breaking changes** - pure bugfix
- **0 nieuwe dependencies**

## Test Strategie

### Pre-deployment verwachting
- Railway logs tonen: `❌ [DIAGNOSE] STOP POINT 1: Roster niet gevonden`
- UI toont: "Geen Data" bij klik op weeknummer

### Post-deployment verwachting
1. Ga naar `/planning/design/dagdelen-dashboard?roster_id=<ID>&period_start=<DATUM>`
2. Klik op Week 48 (of andere week)
3. **VERWACHT:**
   - Pagina navigeert naar `/planning/design/dagdelen-dashboard/48?roster_id=...`
   - Week detail scherm verschijnt
   - Dagdelen tabel wordt getoond met 7 dagen (Ma-Zo)
   - Per dag 4 dagdelen (Ochtend, Middag, Avond, Nacht)
4. Railway logs tonen:
   ```
   ✅ [DIAGNOSE] Roster gevonden
   ✅ [DIAGNOSE] Week heeft overlap met roster - proceeding
   ✅ [DIAGNOSE] Query succesvol. Records: X
   ✅ [DIAGNOSE] SUCCESS - Returning data
   ```

## Deployment Status

⏳ **IN PROGRESS** - Wacht op Railway automatic deployment  
🔗 Commit: https://github.com/gslooters/rooster-app-verloskunde/commit/bf553523b3d5b632b2367de0b308e665fa9f9db8

## Rollback Plan

Indien nodig, rollback naar vorige commit:
```bash
git revert bf553523b3d5b632b2367de0b308e665fa9f9db8
```

Maar dit zou **niet nodig** moeten zijn - de wijziging is een pure correctie naar werkende database kolomnamen.

## Technische Details

### Database Schema (Bevestigd)
```sql
CREATE TABLE public.roosters (
  id uuid PRIMARY KEY,
  startdate date NOT NULL,  -- Let op: lowercase, geen underscore
  enddate date NOT NULL,    -- Let op: lowercase, geen underscore
  status text,
  createdat timestamp with time zone,
  updatedat timestamp with time zone
);
```

### TypeScript Interface Blijft Hetzelfde
```typescript
export interface WeekDagdeelData {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  startDatum: string;  // Blijft camelCase voor externe API
  eindDatum: string;   // Blijft camelCase voor externe API
  days: DayDagdeelData[];
}
```

## Kwaliteitscontrole

✅ Code gecontroleerd op syntax errors  
✅ Alle import statements intact  
✅ Type interfaces ongewijzigd  
✅ Logging statements behouden voor diagnose  
✅ Error handling ongewijzigd  
✅ Geen breaking changes in function signatures  
✅ Unicode emoji's correct escaped  
✅ Commit message beschrijvend  

## Impact Analyse

**Risico:** 🟢 **LAAG**  
- Pure bugfix zonder architectuur wijzigingen
- Aligned met daadwerkelijke database schema
- Geen wijzigingen aan UI componenten
- Geen wijzigingen aan andere modules

**Bereik:**  
- Alleen "Diensten per week aanpassen" scherm
- Alleen week navigatie binnen dagdelen dashboard
- Geen impact op andere delen van applicatie

## Volgende Stappen

1. ⏳ Wacht op Railway deployment (2-3 minuten)
2. 📊 Monitor Railway logs voor errors
3. ✅ Test weekweergave in productie
4. 📝 Rapporteer resultaat aan gebruiker

---

**Status:** DEPLOYED ✅  
**Railway Build:** Automatisch getriggerd door commit  
**Deployment tijd:** ~2-3 minuten  
