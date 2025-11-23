# DRAAD45 - ROOT CAUSE ANALYSIS

**Datum**: 23 november 2025, 22:30 CET  
**Status**: 🔴 KRITISCH PROBLEEM GEVONDEN  
**Impact**: ALLE cellen tonen MAG_NIET, 0 (grijs)

---

## 🎯 EXECUTIVE SUMMARY

**PROBLEEM**: [DRAAD45] logs NIET aanwezig in console  
**ROOT CAUSE**: DienstId mismatch tussen frontend en database  
**SYMPTOOM**: Alle `getCelDataClient()` calls falen (geen match in `roster_period_staffing`)  
**RESULTAAT**: Alle cellen krijgen fallback `{status: 'MAG_NIET', aantal: 0}`

---

## 📊 ANALYSE DATA

### Console Output (Beschikbaar)

```
✅ Roster design opgehaald met periode data
🔄 Start laden weekdata voor roster: 9c4c01d4-3ff2-4790-a569-a4a25380da39
✅ Week 1: 56 parent records opgehaald
📊 Week 1: 504 dagdelen records gevonden
✅ Week 2: 56 parent records opgehaald
📊 Week 2: 504 dagdelen records gevonden
...
```

**PROBLEEM**: GEEN `[DRAAD45]` logs aanwezig!

**Verwacht** (indien code werkt):
```
[DRAAD45] Cel init - starting fetch: {...}
[DRAAD45] getCelDataClient START: {...}
[DRAAD45] ✅ roster_period_staffing found: {...}
[DRAAD45] ✅ SUCCESS - Cel data found: {...}
```

### Visual Output (Screenshot)

**Alle cellen**:
- Status: MAG (groen punt)
- Aantal: 0 (getoond als streepje)
- Kleur: Groene achtergrond

**Verwacht**: Variatie (rood/groen/grijs, aantallen 0-9)

---

## 🔍 CODE ANALYSE

### Layer 1: DagdeelCell Component ✅

**File**: `components/planning/week-dagdelen/DagdeelCell.tsx`

**Code**:
```typescript
useEffect(() => {
  async function fetchCelData() {
    console.log('[DRAAD45] Cel init - starting fetch:', { ... });
    
    const data = await getCelDataClient(
      rosterId,
      dienstId,    // ← HIER GAAT HET FOUT
      datum,
      dagdeelType,
      team
    );
    
    console.log('[DRAAD45] ✅ Cel data loaded:', { ... });
  }
  
  fetchCelData();
}, [rosterId, dienstId, datum, dagdeelType, team]);
```

**Verificatie**: Code ziet er CORRECT uit
- [x] Props ontvangen: rosterId, dienstId, datum, dagdeelType, team
- [x] getCelDataClient() aangeroepen
- [x] Console logging aanwezig
- [x] Error handling aanwezig

**MAAR**: Console logs verschijnen NIET!

---

### Layer 2: WeekTableBody Component ✅

**File**: `components/planning/week-dagdelen/WeekTableBody.tsx`

**Code**:
```typescript
<DagdeelCell
  rosterId={rosterId}              // ✅ 9c4c01d4-3ff2-4790-a569-a4a25380da39
  dienstId={dienst.dienstId}       // ⚠️ 'default-dienst' ← HIER PROBLEEM!
  dienstCode={dienst.dienstCode}   // ✅ 'CONS', 'POL', etc.
  team={teamCode}                  // ✅ 'GRO', 'ORA', 'TOT'
  datum={dag.datum}                // ✅ '2025-11-25'
  dagdeelType="O"                  // ✅ 'O', 'M', 'A'
  ...
/>
```

**Verificatie**: Props worden CORRECT doorgegeven
- [x] rosterId: UUID ✅
- [x] dienstId: `dienst.dienstId` ⚠️ VERKEERDE WAARDE
- [x] team: TeamDagdeel ✅
- [x] datum: ISO date ✅
- [x] dagdeelType: 'O'/'M'/'A' ✅

**PROBLEEM GEVONDEN**: `dienst.dienstId` = `'default-dienst'`

---

### Layer 3: WeekDagdelenClient Conversie ❌

**File**: `components/planning/week-dagdelen/WeekDagdelenClient.tsx`

**Code**:
```typescript
function convertToNewStructure(
  oldData: WeekDagdeelData,
  weekBoundary: WeekBoundary
): WeekDagdelenData {
  // ...
  
  // ❌ KRITIEKE FOUT: Hardcoded dienstId!
  const dienst: DienstDagdelenWeek = {
    dienstId: 'default-dienst',     // ← ROOT CAUSE!
    dienstCode: 'DAGDELEN',
    dienstNaam: 'Dagdelen Bezetting',
    volgorde: 1,
    teams: {
      groen: createTeamDagdelenWeek('GRO', oldData.days),
      oranje: createTeamDagdelenWeek('ORA', oldData.days),
      totaal: createTeamDagdelenWeek('TOT', oldData.days)
    }
  };
  
  return {
    context,
    diensten: [dienst],  // ← Alleen 1 fake dienst!
    totaalRecords: oldData.days.length * 3 * 3
  };
}
```

**ROOT CAUSE GEVONDEN**:
1. Conversie functie maakt **1 fake dienst** aan: `dienstId: 'default-dienst'`
2. Oude data structuur (`WeekDagdeelData`) bevat WEL echte diensten!
3. Conversie gooit alle dienst info weg en maakt generieke structuur

---

## 🗄️ DATABASE STRUCTUUR

### Tabel: roster_period_staffing

**Kolommen**:
```sql
CREATE TABLE roster_period_staffing (
  id UUID PRIMARY KEY,
  roster_id UUID NOT NULL,           -- ✅ 9c4c01d4-3ff2-4790-a569-a4a25380da39
  service_id VARCHAR NOT NULL,       -- ⚠️ 'CONS', 'POL', 'ECHO', etc.
  date DATE NOT NULL,                -- ✅ '2025-11-25'
  ...
);
```

### Tabel: roster_period_staffing_dagdelen

**Kolommen**:
```sql
CREATE TABLE roster_period_staffing_dagdelen (
  id UUID PRIMARY KEY,
  roster_period_staffing_id UUID NOT NULL,  -- FK naar parent
  dagdeel VARCHAR NOT NULL,                 -- 'ochtend', 'middag', 'avond'
  team VARCHAR NOT NULL,                    -- 'GRO', 'ORA', 'TOT'
  status VARCHAR NOT NULL,                  -- 'MOET', 'MAG', 'MAG_NIET'
  aantal INTEGER NOT NULL,                  -- 0-9
  ...
);
```

---

## 🔗 DATA FLOW ANALYSE

### STAP 1: Database Query in getCelDataClient()

```typescript
const { data: rpsData } = await supabase
  .from('roster_period_staffing')
  .select('id')
  .eq('roster_id', rosterId)          // ✅ MATCH
  .eq('service_id', dienstId)         // ❌ FAIL: 'default-dienst' != 'CONS'
  .eq('date', datum)                  // ✅ MATCH
  .maybeSingle();
```

**Resultaat**: `rpsData === null` (geen match)

**Logica**:
```typescript
if (!rpsData) {
  console.log('[DRAAD45] ⚠️  No roster_period_staffing match:', { ... });
  return { status: 'MAG_NIET', aantal: 0 };  // ← FALLBACK
}
```

**MAAR**: Deze console log verschijnt NIET!

**HYPOTHESE**: useEffect wordt NIET getriggered omdat component crasht VOOR mount

---

## 💥 WAAROM GEEN [DRAAD45] LOGS?

### Mogelijke Oorzaken

#### Hypothese 1: Component Mount Failure ❌

**Test**: Check browser console voor React errors  
**Resultaat**: GEEN React errors zichtbaar  
**Conclusie**: Component mount succesvol

#### Hypothese 2: Build Cache (Oude Code) ✅ WAARSCHIJNLIJK

**Probleem**: Railway build gebruikt OUDE versie van code  
**Symptoom**: 
- Deployment log: "✅ Ready in 62ms" (te snel voor rebuild)
- Geen TypeScript compilation errors
- Code wijzigingen niet zichtbaar

**Test**:
```bash
# Railway build cache check
2025-11-23T21:22:02.660726674Z [inf]   ✓ Ready in 62ms
```

**62ms** is TE SNEL voor Next.js rebuild met nieuwe code!

**Verwacht**: 5-10 seconden voor TypeScript compilation + Next.js build

#### Hypothese 3: Import Path Fout ❌

**Check**: Bestaat `lib/planning/getCelDataClient.ts`?  
**Resultaat**: JA, file bestaat  
**Conclusie**: Import werkt

---

## 🎯 CONCLUSIE

### Primaire Probleem: DienstId Mismatch

**ROOT CAUSE**:
```typescript
// WeekDagdelenClient.tsx conversie functie
const dienst: DienstDagdelenWeek = {
  dienstId: 'default-dienst',  // ← FOUT: Moet echte service_id zijn
  // ...
};
```

**Database verwacht**: `'CONS'`, `'POL'`, `'ECHO'`, etc.  
**Frontend stuurt**: `'default-dienst'`  
**Resultaat**: ALLE queries falen → fallback MAG_NIET, 0

### Secundaire Probleem: Build Cache

**Symptoom**: Nieuwe code niet gedeployed  
**Oorzaak**: Railway gebruikt cached build  
**Oplossing**: Force rebuild triggeren

---

## 🔧 OPLOSSING

### Quick Win: Fix Conversie Functie

**VOOR** (broken):
```typescript
const dienst: DienstDagdelenWeek = {
  dienstId: 'default-dienst',
  dienstCode: 'DAGDELEN',
  dienstNaam: 'Dagdelen Bezetting',
  // ...
};
```

**NA** (fixed):
```typescript
// Extract diensten uit oldData
const diensten: DienstDagdelenWeek[] = oldData.days
  .flatMap(day => Object.values(day.dagdelen))
  .flatMap(assignments => assignments.map(a => a.dienstId))  // ← Aanname: assignment heeft dienstId
  .filter((id, index, self) => self.indexOf(id) === index)  // Unique
  .map(dienstId => ({
    dienstId: dienstId,              // ← Echte service_id
    dienstCode: dienstId.toUpperCase(),
    dienstNaam: getDienstNaam(dienstId),
    volgorde: 1,
    teams: createTeamsForDienst(dienstId, oldData.days)
  }));
```

**PROBLEEM**: Oude data structuur (`WeekDagdeelData`) bevat GEEN dienstId!

**WORKAROUND**: Haal diensten op uit `initialWeekData` metadata

---

## 🚨 KRITIEKE ISSUES

### Issue 1: Data Structuur Incompatibiliteit

**Probleem**: `WeekDagdeelData` (oude) bevat geen service_id info  
**Impact**: Conversie kan geen correcte dienstId toewijzen  
**Severity**: BLOCKER

### Issue 2: Build Cache

**Probleem**: Railway deployt oude code  
**Impact**: Fixes niet zichtbaar  
**Severity**: HIGH

### Issue 3: Console Logs Missing

**Probleem**: [DRAAD45] logs verschijnen niet  
**Oorzaak**: useEffect niet triggered (oude code) OF alle queries falen stil  
**Impact**: Debugging onmogelijk  
**Severity**: HIGH

---

## 📋 ACTIEPUNTEN

### IMMEDIATE (NU)

1. **Check `initialWeekData` structuur**
   - Bevat deze wel/niet service_id info?
   - Zo ja: waar? (metadata? nested?)
   - Zo nee: alternatieve bron?

2. **Force Railway Rebuild**
   - Trigger nieuwe deployment
   - Verify build logs (moet > 5 sec zijn)
   - Check deployed code in browser (view source)

3. **Fallback: Bypass Conversie**
   - Gebruik DIRECTE database query op server-side
   - Skip frontend conversie functie
   - Server-side rendering met correcte data

### SHORT-TERM (DRAAD45.6)

1. **Refactor Data Pipeline**
   - Elimineer conversie functie
   - Server stuurt data in JUISTE structuur
   - Client rendert direct (geen transformatie)

2. **Add Service_Id Lookup**
   - Query `service_types` tabel voor dienst info
   - Map dienstCode → service_id
   - Cache in component state

---

## 🎬 VOLGENDE STAP

**PRIORITEIT 1**: Controleer `initialWeekData.days[0].dagdelen.ochtend[0]` structuur

**Vraag**: Bevat assignment object een `service_id` of `dienstId` veld?

**Als JA**: Fix conversie functie om dit te gebruiken  
**Als NEE**: Query service_types tabel op server-side

---

**STATUS**: 🔴 ROOT CAUSE GEVONDEN - WACHT OP DATA STRUCTUUR VERIFICATIE  
**BLOCKER**: Geen service_id in frontend data  
**NEXT**: Check database schema + server-side data fetch
