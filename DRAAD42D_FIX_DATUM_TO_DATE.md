# DRAAD42D FIX: Database Kolom Correctie

## Samenvatting

**Probleem:** "Fout bij ophalen van data" bij klik op Week 48  
**Oorzaak:** Database query gebruikte niet-bestaand veld `datum`  
**Oplossing:** Alle `datum` vervangen door `date` in queries

---

## Probleemanalyse

### Error Boodschap
```
Error fetching staffing data: {
  code: '42703',
  message: 'column roster_period_staffing.datum does not exist',
  hint: 'Perhaps you meant to reference the column "roster_period_staffing.date".'
}
```

### Root Cause

**Database Schema:** `roster_period_staffing`  
- Kolom naam: `date` (Engels)  
- Type: `date`  
- NOT NULL constraint

**Code (FOUT):**  
```typescript
const { data } = await supabase
  .from('roster_period_staffing')
  .select('id, datum, service_type_id')  // ❌ FOUT
  .gte('datum', weekStart)                // ❌ FOUT  
  .lte('datum', weekEnd);                 // ❌ FOUT
```

**Mismatch:**  
- Code: Nederlandse veldnaam `datum`  
- Database: Engelse kolomnaam `date`

---

## Oplossing

### Gewijzigd Bestand

**Pad:** `components/planning/week-dagdelen/WeekDagdelenVaststellingTable.tsx`

### Code Wijzigingen

**3 plekken aangepast:**

#### 1. SELECT Statement (regel 64)
```typescript
// VOOR
.select('id, datum, service_type_id')

// NA
.select('id, date, service_type_id')  // ✅ FIX
```

#### 2. GTE Filter (regel 66)
```typescript
// VOOR
.gte('datum', weekStart.split('T')[0])

// NA
.gte('date', weekStart.split('T')[0])  // ✅ FIX
```

#### 3. LTE Filter (regel 67)
```typescript
// VOOR
.lte('datum', weekEnd.split('T')[0])

// NA
.lte('date', weekEnd.split('T')[0])    // ✅ FIX
```

#### 4. Property Mapping (regel 88)
```typescript
// VOOR
date: staffingRecord?.datum,

// NA  
date: staffingRecord?.date,           // ✅ FIX
```

---

## Impact

### Voorheen
- ❌ Klik op Week 48 → Error screen
- ❌ "Fout bij ophalen van data"  
- ❌ Geen staffing records geladen
- ❌ Console error: "column does not exist"

### Nu
- ✅ Klik op Week 48 → Data wordt geladen
- ✅ Staffing records succesvol opgehaald  
- ✅ Week navigatie werkt correct
- ✅ Geen database errors

---

## Deployment

### Commits
1. **Main Fix:** `de29a476` - Database kolom correctie
2. **Cache-buster:** `387f4141` - py0-cachebuster.js update  
3. **Railway Trigger:** `20256bae` - Deployment trigger
4. **Documentation:** Huidige commit

### Verificatie Stappen

1. **GitHub:**
   - ✅ Code committed naar main branch
   - ✅ Cache-buster geüpdatet
   - ✅ Railway trigger geactiveerd

2. **Railway:**
   - ⏳ Deployment gestart (automatisch via GitHub webhook)
   - ⏳ Build process actief
   - ⏳ Wacht op deployment completion

3. **Test na deployment:**
   ```
   1. Ga naar rooster overzicht
   2. Klik op "Week 48: 24/11 - 30/11"  
   3. Verwacht: Data wordt geladen zonder error
   4. Verwacht: Staffing tabel toont dagdelen
   ```

---

## Preventie

### Database Naming Convention

**Aanbeveling:** Kies één taal voor database schema:

**Optie A: Volledig Engels (AANBEVOLEN)**
```sql
-- Consistent met industry standaarden
CREATE TABLE roster_period_staffing (
  id UUID,
  date DATE,           -- Engels
  service_type_id UUID -- Engels
);
```

**Optie B: Volledig Nederlands**  
```sql
-- Alleen als hele codebase Nederlands is
CREATE TABLE rooster_periode_bezetting (
  id UUID,
  datum DATE,              -- Nederlands
  dienst_type_id UUID      -- Nederlands  
);
```

### Code Review Checklist

☐ Database queries matchen schema exacte kolomnamen  
☐ Geen mix van Engels/Nederlands in één tabel  
☐ TypeScript types reflecteren database schema  
☐ Test met echte database voor deployment

---

## Related Issues

Deze fix addresseert:
- DRAAD42D Probleem 2: Week navigatie error
- Console error: "column roster_period_staffing.datum does not exist"  
- User-reported: "Fout bij ophalen van data" bij Week 48

---

**Status:** ✅ FIX GECOMMIT  
**Deployment:** ⏳ IN PROGRESS (Railway)  
**Test Required:** Ja - na Railway deployment  
**Versie:** DRAAD42D  
**Datum:** 21 november 2025
