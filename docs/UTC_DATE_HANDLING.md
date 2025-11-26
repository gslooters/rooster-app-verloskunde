# UTC Date Handling in Rooster App

**Datum**: 26 november 2025  
**Probleem opgelost**: Week 47-52 2025 periode toonde "23 nov" i.p.v. "24 nov" door timezone-gevoelige date parsing

---

## Het Probleem

Date strings zoals `'YYYY-MM-DD'` zijn timezone-gevoelig wanneer geparsed met `new Date()`.

Voorbeeld:
```javascript
// ❌ FOUT - timezone-afhankelijk
const date = new Date('2025-11-24'); 
// In Amsterdam (UTC+1): 2025-11-23T23:00:00.000Z ← FOUT! Dag verschuiving!
// In UTC: 2025-11-24T00:00:00.000Z
// In Curaçao (UTC-4): 2025-11-24T04:00:00.000Z

// ✅ CORRECT - UTC gegarandeerd
const date = parseUTCDate('2025-11-24');
// Overal: 2025-11-24T00:00:00.000Z ✓
```

Dit veroorzaakte:
- Periode "Week 47-52 2025" toonde "23 nov - 27 dec 2025" i.p.v. "24 nov - 28 dec 2025"
- Weeknummers klopten niet bij jaarovergangen
- Inconsistent gedrag tussen timezones

---

## De Oplossing

Alle date parsing gebruikt nu UTC utilities uit `lib/utils/date-utc.ts`.

---

## Regels voor Date Handling

### ✅ DO (gebruik deze functies)

```typescript
import { 
  parseUTCDate,
  toUTCDateString,
  addUTCDays,
  getUTCWeekNumber,
  getUTCMonday,
  getUTCSunday,
  formatUTCDate
} from '@/lib/utils/date-utc';

// Parse string naar Date object
const date = parseUTCDate('2025-11-24');

// Date object naar string
const dateStr = toUTCDateString(date); // '2025-11-24'

// Dagen toevoegen/aftrekken
const nextWeek = addUTCDays(date, 7);

// Week berekeningen
const { week, year } = getUTCWeekNumber(date); // { week: 48, year: 2025 }
const monday = getUTCMonday(date);
const sunday = getUTCSunday(date);

// Display formatting (locale-aware maar UTC-based)
const formatted = formatUTCDate(date, 'nl-NL'); // '24 november 2025'
```

### ❌ DON'T (vermijd deze patronen)

```javascript
// ❌ WRONG - timezone issues
const date = new Date('2025-11-24');

// ❌ WRONG - local timezone methods
date.getDate()      // Use: date.getUTCDate()
date.getMonth()     // Use: date.getUTCMonth()
date.getDay()       // Use: date.getUTCDay()
date.setDate()      // Use: addUTCDays()

// ❌ WRONG - string conversie
date.toISOString().split('T')[0]  // Use: toUTCDateString(date)
```

---

## Geconverteerde Bestanden (FASE 1-5)

### ✅ FASE 1: UTC Utilities (COMPLEET)
- `lib/utils/date-utc.ts` ← **NIEUW** - Core UTC functies

### ✅ FASE 2: Core Planning Logic (COMPLEET)
- `lib/planning/storage.ts` - Periode generatie en formattting
- `lib/utils/roster-date-helpers.ts` - 35-dagen rooster berekeningen
- `lib/planning/dates.ts` - Basis date operaties
- `lib/date-utils.ts` - Utility wrappers (gemigreerd)
- `lib/utils/date-helpers.ts` - Weekdag/week helpers

### ✅ FASE 3: Database Layer (SAMPLE)
- `lib/services/roster-design-supabase.ts` - Date handling bij DB conversie

### ✅ FASE 4: UI Components (SAMPLE)
- `app/planning/design/page.client.tsx` - Week display en date formatting

### ✅ FASE 5: Export Layer (SAMPLE)
- `lib/export/pdf.ts` - PDF datum formatting

---

## Resterende Werk (voor volgende sessie)

Deze bestanden volgen **hetzelfde patroon** als de samples:

### Database Layer (~4 bestanden)
- `lib/services/roosters-supabase.ts`
- `lib/services/preplanning-storage.ts`
- `lib/services/period-day-staffing-storage.ts`
- `lib/services/daytype-staffing-storage.ts`

### UI Components (~48 bestanden)
Alle component bestanden in:
- `app/planning/**/*.tsx`
- `components/planning/**/*.tsx`

Zoek naar:
- `new Date(stringVar)` → vervang door `parseUTCDate(stringVar)`
- `.getDay()`, `.getDate()`, `.getMonth()` → vervang door UTC variants
- `.toISOString().split('T')[0]` → vervang door `toUTCDateString()`

### Export Layer (~4 bestanden)
- `lib/export/excel.ts`
- `lib/export/pdf-export-classic.ts`
- `lib/pdf/service-allocation-generator.ts`
- `components/planning/export/*`

---

## Blueprint voor Completion

Voor elk resterend bestand:

1. **Import UTC utilities**
   ```typescript
   import { parseUTCDate, toUTCDateString, addUTCDays } from '@/lib/utils/date-utc';
   ```

2. **Vervang `new Date(string)` met `parseUTCDate(string)`**
   ```typescript
   // VOOR:
   const date = new Date(dateString);
   
   // NA:
   const date = parseUTCDate(dateString);
   ```

3. **Vervang local methods met UTC methods**
   ```typescript
   // VOOR:
   date.getDate()
   date.setDate(date.getDate() + 7)
   
   // NA:
   date.getUTCDate()
   addUTCDays(date, 7)
   ```

4. **Vervang string conversies met `toUTCDateString()`**
   ```typescript
   // VOOR:
   date.toISOString().split('T')[0]
   
   // NA:
   toUTCDateString(date)
   ```

5. **Test visueel** - controleer datums in UI
6. **Commit atomically** - één bestand per commit

**Geschatte effort**: 2-3 uur voor alle resterende bestanden  
**Risico niveau**: **LOW** (core is gefixed, rest is repetitief)

---

## Testen

Test deze scenario's na volledige migratie:

### ✓ Timezone Tests
- [ ] Test in NL timezone (UTC+1 winter, UTC+2 zomer)
- [ ] Test in UTC timezone
- [ ] Test in Curaçao timezone (UTC-4)
- [ ] Alle drie tonen identieke datums

### ✓ Edge Case Tests
- [ ] Jaarovergang (week 52 2025 → week 1 2026)
- [ ] DST transitions (maart/oktober)
- [ ] Week 1 berekening (eerste week met donderdag)
- [ ] Maandag detectie (start van rooster periodes)

### ✓ Functional Tests
- [ ] Nieuwe 5-weken periode aanmaken
- [ ] Week 47-52 2025 toont "24 nov" (niet "23 nov")
- [ ] Weeknummers correct in dashboard
- [ ] PDF export toont correcte datums
- [ ] Excel export toont correcte datums

---

## Bug Status

### ✅ OPGELOST
**Week 47-52 2025 display bug**
- **Voor**: "23 nov - 27 dec 2025" 
- **Na**: "24 nov - 28 dec 2025" ✓

**Oorzaak**: `new Date('2025-11-24')` interpreteerde als local midnight, wat in UTC timezone resulteerde in 23 nov 23:00 (vorige dag).

**Oplossing**: `parseUTCDate('2025-11-24')` forceert UTC midnight: `2025-11-24T00:00:00.000Z`

---

## References

- [MDN: Date.UTC()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC)
- [ISO 8601 Week Numbers](https://en.wikipedia.org/wiki/ISO_week_date)
- [Execution Plan: DRAAD57_UTC_CONVERSION_EXECUTION_PLAN.md](../DRAAD57_UTC_CONVERSION_EXECUTION_PLAN.md)

---

**Last updated**: 26 november 2025  
**Status**: Core conversion complete (FASE 1-5) ✓