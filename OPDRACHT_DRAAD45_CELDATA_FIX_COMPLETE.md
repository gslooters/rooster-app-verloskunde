# OPDRACHT DRAAD45 - CELDATA FIX COMPLETE

**Datum**: 23 november 2025  
**Draad**: DRAAD45.1  
**Prioriteit**: 🔥 CRITICAL - Rooster view volledig broken

---

## 📋 PROBLEEM ANALYSE

### Huidige Situatie (BROKEN)

Alle cellen tonen identieke data:
- ✅ Groen, MAG status, aantal 0
- Geen variatie tussen diensten/teams/dagdelen
- Data wordt opgehaald maar niet correct per cel gematcht

### Root Cause

DRAAD44 implementatie **incomplete**:

1. **Props toegevoegd maar niet gebruikt:**
   ```typescript
   // ✅ Props zijn ER (DagdeelCell.tsx)
   rosterId: string;
   dienstId: string;
   dagdeelType: 'O' | 'M' | 'A';
   
   // ❌ MAAR: Geen database lookup in component
   // ❌ MAAR: useEffect logt alleen, doet niks
   ```

2. **Conversie functie stuurt dummy data:**
   ```typescript
   // WeekDagdelenClient.tsx: convertToNewStructure()
   // → Hardcoded fallbacks voor ALLE cellen:
   status: mapStatusToNew(assignment?.status),  // → altijd MAG
   aantal: assignment?.aantal || 0,             // → altijd 0
   ```

3. **Geen server-side database query:**
   - `page.tsx` haalt wel data op via `getWeekDagdeelData()`
   - Maar die data bevat geen per-cel details
   - Client converteert naar generieke structuur

---

## 🎯 OPLOSSING: COMPLETE DATA PIPELINE

### Architectuur Overview

```
Server (page.tsx)
    ↓
    Haal RAW rooster data op (geen conversie)
    Query: roster_period_staffing + roster_period_staffing_dagdelen
    ↓
Client (DagdeelCell.tsx)
    ↓
    Per cel: getCelData(rosterId, dienstId, datum, dagdeel, team)
    Match via join keys
    Return {status, aantal} of fallback
    ↓
Rendering
    Visual: rood/groen/grijs op basis status
    Aantal: 0-9 of '-'
```
---

## 🚀 IMPLEMENTATIE PLAN - STAP VOOR STAP

### STAP 1: Utility Functie - getCelData()

**File**: `lib/planning/getCelData.ts` (NIEUW)

**Doel**: Centrale functie voor cel data lookup

**Logica**:
```typescript
export async function getCelData(
  rosterId: string,
  dienstId: string,  // service_id uit service_types
  datum: string,      // YYYY-MM-DD
  dagdeel: 'O' | 'M' | 'A',
  team: 'GRO' | 'ORA' | 'TOT'
): Promise<{ status: DagdeelStatus; aantal: number }> {
  
  // 1. Find roster_period_staffing record
  const { data: rpsData } = await supabase
    .from('roster_period_staffing')
    .select('id')
    .eq('roster_id', rosterId)
    .eq('service_id', dienstId)
    .eq('date', datum)
    .single();
  
  if (!rpsData) {
    // Geen match → fallback
    return { status: 'MAG_NIET', aantal: 0 };
  }
  
  // 2. Find roster_period_staffing_dagdelen record
  const dagdeelMap = { 'O': 'ochtend', 'M': 'middag', 'A': 'avond' };
  const dagdeelStr = dagdeelMap[dagdeel];
  
  const { data: dagdeelData } = await supabase
    .from('roster_period_staffing_dagdelen')
    .select('status, aantal')
    .eq('roster_period_staffing_id', rpsData.id)
    .eq('dagdeel', dagdeelStr)
    .eq('team', team)
    .single();
  
  if (!dagdeelData) {
    // Team/dagdeel combinatie bestaat niet → fallback
    return { status: 'MAG_NIET', aantal: 0 };
  }
  
  // 3. Return actual data
  return {
    status: dagdeelData.status as DagdeelStatus,
    aantal: dagdeelData.aantal
  };
}
```

**Console logging**:
```typescript
console.log('[DRAAD45] getCelData:', {
  input: { rosterId, dienstId, datum, dagdeel, team },
  rpsFound: !!rpsData,
  dagdeelFound: !!dagdeelData,
  result: { status, aantal }
});
```

---

### STAP 2: Server Data Fetch - Geen Conversie

**File**: `app/planning/design/week-dagdelen/[rosterId]/[weekNummer]/page.tsx`

**Change**: Remove conversiefunctie, stuur RAW data

**Voor**:
```typescript
// Oude manier: conversie op server
const convertedData = convertToNewStructure(rawData);
```

**Na**:
```typescript
// Nieuwe manier: RAW data, client doet lookup
const weekData = await getWeekDagdeelData(rosterId, weekNummer);
// weekData bevat alleen context + basale structuur
// Geen pre-populated dagdeelWaarden
```

---

### STAP 3: DagdeelCell - Database Lookup

**File**: `components/planning/week-dagdelen/DagdeelCell.tsx`

**Change**: Implement getCelData call in useEffect

**Voor**:
```typescript
useEffect(() => {
  // Alleen logging, geen data fetch
  console.log('Cell Init:', { datum, dagdeel, team });
}, []);
```

**Na**:
```typescript
const [celData, setCelData] = useState<{
  status: DagdeelStatus;
  aantal: number;
  loading: boolean;
}>({
  status: dagdeelWaarde.status,  // Initial fallback
  aantal: dagdeelWaarde.aantal,
  loading: true
});

useEffect(() => {
  let cancelled = false;
  
  async function fetchCelData() {
    try {
      const data = await getCelData(
        rosterId,
        dienstId,
        datum,
        dagdeelType,
        team
      );
      
      if (!cancelled) {
        setCelData({
          ...data,
          loading: false
        });
        
        console.log('[DRAAD45] Cel data loaded:', {
          datum,
          dagdeel: dagdeelType,
          team,
          data
        });
      }
    } catch (error) {
      console.error('[DRAAD45] Cel data fetch failed:', error);
      if (!cancelled) {
        setCelData({
          status: 'MAG_NIET',
          aantal: 0,
          loading: false
        });
      }
    }
  }
  
  fetchCelData();
  
  return () => {
    cancelled = true;
  };
}, [rosterId, dienstId, datum, dagdeelType, team]);
```

**Rendering Update**:
```typescript
// Gebruik celData ipv dagdeelWaarde
<StatusDot status={celData.status} />
<span>{celData.aantal === 0 ? '-' : celData.aantal}</span>
```

---

### STAP 4: Loading State per Cel

**Visual feedback tijdens data fetch**:

```typescript
if (celData.loading) {
  return (
    <td className="px-2 py-1.5 text-center border border-gray-200 bg-gray-100">
      <Spinner size="sm" />
    </td>
  );
}
```

---

### STAP 5: Error Handling & Fallback

**Strategie**:

1. **Geen match in roster_period_staffing**:
   - Return: `{ status: 'MAG_NIET', aantal: 0 }`
   - Visual: Grijs, disabled
   - Console: Warning met missing key info

2. **Geen match in dagdelen tabel**:
   - Return: `{ status: 'MAG_NIET', aantal: 0 }`
   - Console: Info dat team/dagdeel combinatie niet bestaat

3. **Network error**:
   - Fallback naar prop data
   - Show error icon
   - Allow retry

---

## ✅ VERIFICATIE CRITERIA

### Console Output

**Per cel tijdens render**:
```
[DRAAD45] getCelData: {
  input: { rosterId: 'abc-123', dienstId: 'service-1', datum: '2025-11-25', dagdeel: 'O', team: 'GRO' },
  rpsFound: true,
  dagdeelFound: true,
  result: { status: 'MOET', aantal: 3 }
}

[DRAAD45] Cel data loaded: {
  datum: '2025-11-25',
  dagdeel: 'O',
  team: 'GRO',
  data: { status: 'MOET', aantal: 3 }
}
```

### Visual Verification

**Verwacht resultaat**:

| Dag | Dagdeel | Team | Status | Aantal | Visual |
|-----|---------|------|--------|--------|--------|
| Ma | Ochtend | GRO | MOET | 3 | 🔴 Rood, "3" |
| Ma | Ochtend | ORA | MAG | 2 | 🟢 Groen, "2" |
| Ma | Middag | GRO | MAG_NIET | 0 | ⚪ Grijs, "-" |
| Di | Avond | TOT | MAG | 1 | 🟢 Groen, "1" |

**Variatie checklist**:
- [ ] Rode cellen (MOET) zichtbaar
- [ ] Groene cellen (MAG) zichtbaar
- [ ] Grijze cellen (MAG_NIET) zichtbaar
- [ ] Aantallen variëren (0-9)
- [ ] Verschillende teams tonen verschillende data
- [ ] Verschillende dagdelen tonen verschillende data
- [ ] Verschillende diensten tonen verschillende data

---

## 🔧 IMPLEMENTATIE VOLGORDE

**Voer stappen uit in EXACTE volgorde**:

1. ✅ **STAP 1 UITGEVOERD** - Dit document aangemaakt
2. ⏳ **STAP 2** - Maak `lib/planning/getCelData.ts`
3. ⏳ **STAP 3** - Update `DagdeelCell.tsx` met data fetch
4. ⏳ **STAP 4** - Test in browser
5. ⏳ **STAP 5** - Deploy naar Railway

---

## 🚨 KRITIEKE WAARSCHUWINGEN

### Performance

- **21 cellen per team × 3 teams × aantal diensten = VEEL database calls**
- **Mitigatie**: 
  - Gebruik React.memo() voor DagdeelCell
  - Implementeer batch query in toekomst (DRAAD46)
  - Caching op cel niveau (localStorage of SWR)

### Race Conditions

- **useEffect cleanup** om stale updates te voorkomen
- **Loading state** om flicker te minimaliseren

### Database Schema

- **Verificeer foreign keys**: roster_period_staffing_id moet valid zijn
- **Verificeer enums**: status moet 'MOET'|'MAG'|'MAG_NIET'|'AANGEPAST' zijn
- **Verificeer team codes**: GRO/ORA/TOT spelling consistent

---

## 📊 SUCCESS METRICS

**VOOR FIX**:
- ❌ 100% cellen identiek (groen, MAG, 0)
- ❌ Geen variatie
- ❌ Props unused

**NA FIX**:
- ✅ Elke cel toont unieke data uit database
- ✅ Rode/groene/grijze cellen zichtbaar
- ✅ Aantallen variëren
- ✅ Console logs tonen correcte matches
- ✅ Fallback werkt bij ontbrekende data

---

## 🎬 VOLGENDE STAPPEN

**Na deze DRAAD45**:

- **DRAAD46**: Performance optimalisatie (batch queries)
- **DRAAD47**: Caching layer (localStorage/SWR)
- **DRAAD48**: Optimistic updates (bij edit)

---

**EINDE OPDRACHT DOCUMENT**

START bij STAP 2: Maak getCelData.ts utility functie
