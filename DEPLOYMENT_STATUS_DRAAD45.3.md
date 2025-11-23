# DEPLOYMENT STATUS - DRAAD45.3

**Datum**: 23 november 2025, 22:07 CET  
**Prioriteit**: 🔥 CRITICAL FIX  
**Status**: ⏳ DEPLOYING

---

## 🎯 DOEL

Fix broken rooster view waar ALLE cellen identieke data toonden:
- ❌ VOOR: Groen, MAG status, aantal 0 voor ELKE cel
- ✅ NA: Elke cel toont unieke data uit database met correcte kleuren en aantallen

---

## 🔧 IMPLEMENTATIE - STAP 3

### Files Aangepast

#### 1. `lib/planning/getCelDataClient.ts` (NIEUW)

**Doel**: Client-side database lookup voor cel data

**Functionaliteit**:
- Query `roster_period_staffing` (match: roster_id + service_id + date)
- Query `roster_period_staffing_dagdelen` (match: rps.id + dagdeel + team)
- Return `{ status: DagdeelStatus, aantal: number }`
- Fallback: `{ status: 'MAG_NIET', aantal: 0 }` bij geen match
- Console logging: `[DRAAD45]` per query voor debugging

**Signature**:
```typescript
async function getCelDataClient(
  rosterId: string,
  dienstId: string,
  datum: string,
  dagdeel: 'O' | 'M' | 'A',
  team: 'GRO' | 'ORA' | 'TOT'
): Promise<CelData>
```

#### 2. `components/planning/week-dagdelen/DagdeelCell.tsx` (UPDATE)

**Wijzigingen**:

**State Management**:
```typescript
const [celData, setCelData] = useState<CelData & { loading: boolean }>({
  status: dagdeelWaarde.status,  // Initial fallback
  aantal: dagdeelWaarde.aantal,
  loading: true
});
```

**Data Fetch useEffect**:
```typescript
useEffect(() => {
  let cancelled = false;
  
  async function fetchCelData() {
    const data = await getCelDataClient(
      rosterId, dienstId, datum, dagdeelType, team
    );
    
    if (!cancelled) {
      setCelData({ ...data, loading: false });
      setAantal(data.aantal);
    }
  }
  
  fetchCelData();
  
  return () => { cancelled = true; };
}, [rosterId, dienstId, datum, dagdeelType, team]);
```

**Loading State**:
```typescript
if (celData.loading) {
  return (
    <td className="...bg-gray-100...">
      <Spinner size="sm" />
    </td>
  );
}
```

**Visual Rendering**:
- Gebruik `celData.status` ipv `dagdeelWaarde.status`
- Gebruik `celData.aantal` ipv `dagdeelWaarde.aantal`
- Rode cellen: `celData.status === 'MOET'`
- Groene cellen: `celData.status === 'MAG'`
- Grijze cellen: `celData.status === 'MAG_NIET'`

---

## 📊 DATAFLOW OVERZICHT

```
DagdeelCell Component Mount
         ↓
   useEffect triggered
         ↓
   getCelDataClient(
     rosterId,
     dienstId,    // service_id uit service_types
     datum,       // YYYY-MM-DD
     dagdeel,     // 'O'|'M'|'A'
     team         // 'GRO'|'ORA'|'TOT'
   )
         ↓
 Query roster_period_staffing
 WHERE roster_id = ? AND service_id = ? AND date = ?
         ↓
      Found? → YES
         ↓
 Query roster_period_staffing_dagdelen
 WHERE rps_id = ? AND dagdeel = ? AND team = ?
         ↓
      Found? → YES
         ↓
   Return { status, aantal }
         ↓
 setCelData({ status, aantal, loading: false })
         ↓
 Component Re-render met correcte data
         ↓
Visual: Rode/Groene/Grijze cel + aantal
```

**Bij geen match**:
- Return `{ status: 'MAG_NIET', aantal: 0 }`
- Visual: Grijs, disabled, "-"

---

## ✅ VERWACHT RESULTAAT

### Console Output

**Per cel tijdens render**:
```
[DRAAD45] Cel init - starting fetch: {
  rosterId: 'abc-123...',
  dienstId: 'CONS',
  datum: '2025-11-25',
  dagdeel: 'O',
  team: 'GRO'
}

[DRAAD45] getCelDataClient START: { ... }

[DRAAD45] ✅ roster_period_staffing found: {
  rpsId: 'xyz-789...'
}

[DRAAD45] ✅ SUCCESS - Cel data found: {
  datum: '2025-11-25',
  dagdeel: 'O',
  team: 'GRO',
  result: { status: 'MOET', aantal: 3 }
}

[DRAAD45] ✅ Cel data loaded: {
  datum: '2025-11-25',
  dagdeel: 'O',
  team: 'GRO',
  data: { status: 'MOET', aantal: 3 }
}
```

### Visual Verificatie

**Verwachte variatie**:

| Dag | Dagdeel | Team | Status | Aantal | Visual |
|-----|---------|------|--------|--------|--------|
| Ma | Ochtend | GRO | MOET | 3 | 🔴 Rood, "3" |
| Ma | Ochtend | ORA | MAG | 2 | 🟢 Groen, "2" |
| Ma | Middag | GRO | MAG_NIET | 0 | ⚪ Grijs, "-" |
| Di | Avond | TOT | MAG | 1 | 🟢 Groen, "1" |

**Checklist**:
- [ ] Rode cellen (MOET) zichtbaar
- [ ] Groene cellen (MAG) zichtbaar
- [ ] Grijze cellen (MAG_NIET) zichtbaar
- [ ] Aantallen variëren tussen cellen
- [ ] Verschillende teams tonen verschillende data
- [ ] Verschillende dagdelen tonen verschillende data
- [ ] Verschillende diensten tonen verschillende data
- [ ] Loading spinners tijdens fetch
- [ ] Geen console errors

---

## 🚨 BEKENDE ISSUES

### Performance Warning

**Probleem**: Veel database calls
- 21 cellen (7 dagen × 3 dagdelen) per team
- 3 teams (GRO, ORA, TOT)
- Meerdere diensten
- Totaal: **~63+ database queries per view**

**Impact**:
- Langere laadtijd (2-5 seconden)
- Veel Supabase API calls
- Mogelijk rate limiting bij veel gebruikers

**Mitigatie** (DRAAD46):
- Batch query implementatie
- Haal alle cel data op in 1-2 queries
- Caching laag (localStorage of SWR)
- Optimistic updates bij edit

---

## 🔗 DEPLOYMENT INFO

### Railway Deploy

**Project**: Rooster App Verloskunde  
**Service ID**: fdfbca06-6b41-4ea1-862f-ce48d659a92c  
**Environment**: Production  
**URL**: https://rooster-app-verloskunde-production.up.railway.app

**Deploy Trigger**: Commit f86ec6cd  
**Build Status**: ⏳ Building...  
**Expected Build Time**: 2-3 minuten

### Commits

1. `ecf2eb91` - Create getCelDataClient.ts (client-side utility)
2. `f19a7fd6` - Update DagdeelCell.tsx (database lookup)
3. `f86ec6cd` - Deployment trigger

---

## 🧪 TEST INSTRUCTIES

### Na Deployment

1. **Open Week Dagdelen View**
   - Navigeer naar Planning > Dagdelen
   - Selecteer een rooster + week

2. **Check Browser Console**
   ```
   Open DevTools (F12)
   → Console tab
   → Filter op "DRAAD45"
   → Verwacht: ~63 logs met cel data
   ```

3. **Verify Visual Variatie**
   - Zoek rode cellen (MOET status)
   - Zoek groene cellen (MAG status)
   - Zoek grijze cellen (MAG_NIET status)
   - Check dat aantallen variëren (0-9)

4. **Test Inline Editing**
   - Klik op cel met data
   - Wijzig aantal
   - Enter → moet opslaan
   - Check console voor save logs

5. **Check Loading States**
   - Hard refresh (Ctrl+Shift+R)
   - Zie spinners tijdens fetch
   - Spinners verdwijnen na load

---

## ❓ TROUBLESHOOTING

### Alle cellen blijven grijs

**Mogelijke oorzaken**:
- Database heeft geen data voor geselecteerde rooster/week
- service_id mismatch tussen service_types en roster_period_staffing
- date format mismatch (check YYYY-MM-DD)

**Debug**:
```javascript
// Check console output:
[DRAAD45] ⚠️ No roster_period_staffing match

// Verify in Supabase:
SELECT * FROM roster_period_staffing 
WHERE roster_id = 'xxx' 
AND service_id = 'CONS' 
AND date = '2025-11-25';
```

### Console errors "supabase is not defined"

**Oorzaak**: Env vars niet geladen

**Fix**:
1. Check Railway environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Redeploy indien ontbrekend

### Cellen laden zeer langzaam

**Oorzaak**: Veel database queries (known issue)

**Workaround**: Geduld (2-5 seconden)  
**Permanent Fix**: DRAAD46 batch queries

---

## 🚀 VOLGENDE STAPPEN

### DRAAD45 Resterende Stappen

- [x] STAP 1: Documentatie (OPDRACHT_DRAAD45_CELDATA_FIX_COMPLETE.md)
- [x] STAP 2: getCelData.ts utility (server-side)
- [x] STAP 3: DagdeelCell.tsx database lookup (client-side)
- [ ] STAP 4: Browser testing & verificatie
- [ ] STAP 5: Production monitoring

### DRAAD46: Performance Optimalisatie

**Batch Query Implementation**:
- Haal alle cel data op in 1 query
- Reduceer 63 queries naar 1-2 queries
- Implementeer caching laag
- Optimistic updates

**Target**: <1 seconde laadtijd

---

**DEPLOYMENT STATUS: DEPLOYING**  
**VERIFY NA: ~2-3 minuten**  
**RAILWAY URL**: https://rooster-app-verloskunde-production.up.railway.app

---

**EINDE DEPLOYMENT DOCUMENT**
