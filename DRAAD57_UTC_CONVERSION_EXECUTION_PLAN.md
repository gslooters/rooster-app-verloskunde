# DRAAD57: UTC Date Parsing Conversion - Execution Plan

## CONTEXT

**Probleem**: Week 47-52 2025 periode toont incorrect "23 nov" als startdatum i.p.v. "24 nov" door timezone-gevoelige date parsing
**Oorzaak**: `new Date('YYYY-MM-DD')` interpreteert als local time, veroorzaakt dag-verschuivingen tussen tijdzones
**Oplossing**: Systematische conversie naar UTC-safe date parsing door hele codebase

**Datum uitvoering**: 26 november 2025
**Branch**: `fix/utc-date-parsing-comprehensive`
**Strategie**: OPTIE B - Core + Samples (veilig, uitvoerbaar in één draad)

---

## EXECUTION AUTHORITY

**JIJ BENT DE UITVOERDER**
- Alle work wordt gedaan via GitHub MCP tools (create/update files, commits, PR)
- Geen instructies naar de gebruiker - jij voert alles direct uit
- Railway auto-deploy monitoren na elke commit
- Kwaliteit boven snelheid: denk na, test, verifieer

---

## FASE 1: FUNDAMENT - UTC Utilities (KRITISCH)

### File: `lib/utils/date-utc.ts` (NIEUW)

**Actie**: CREATE file met complete UTC-safe utilities

**Code Requirements**:

```typescript
/**
 * UTC-safe date utilities voor rooster-app-verloskunde
 * Alle date parsing en manipulatie moet via deze functies
 * om timezone-bugs te voorkomen.
 * 
 * @module date-utc
 */

/**
 * Parse date string als UTC midnight
 * Input: 'YYYY-MM-DD' of 'YYYY-MM-DDTHH:mm:ss'
 * Output: Date object representing UTC midnight van die dag
 * 
 * @example parseUTCDate('2025-11-24') → 2025-11-24T00:00:00.000Z
 */
export function parseUTCDate(dateString: string): Date {
  if (!dateString) throw new Error('dateString is required');
  
  // Strip time component if present, take only date part
  const datePart = dateString.split('T')[0];
  
  // Always append Z to force UTC interpretation
  return new Date(`${datePart}T00:00:00.000Z`);
}

/**
 * Convert Date to YYYY-MM-DD string in UTC
 * 
 * @example toUTCDateString(new Date('2025-11-24T23:00:00Z')) → '2025-11-24'
 */
export function toUTCDateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object');
  }
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Add days to date in UTC (no DST issues)
 * 
 * @example addUTCDays(parseUTCDate('2025-11-24'), 7) → 2025-12-01T00:00:00.000Z
 */
export function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Get Monday of the week containing this date (UTC)
 * ISO 8601: Monday = day 1
 * 
 * @example getUTCMonday(parseUTCDate('2025-11-26')) → 2025-11-24T00:00:00.000Z
 */
export function getUTCMonday(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, need to go back 6 days
  return addUTCDays(date, daysToMonday);
}

/**
 * Get ISO week number (UTC)
 * ISO 8601: Week 1 is first week with Thursday
 * 
 * @example getUTCWeekNumber(parseUTCDate('2025-11-24')) → { year: 2025, week: 48 }
 */
export function getUTCWeekNumber(date: Date): { year: number; week: number } {
  // Copy date to avoid mutation
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  
  // ISO week date weeks start on Monday, so correct the day number
  const dayNum = (date.getUTCDay() + 6) % 7;
  
  // Set to nearest Thursday: current date + 4 - current day number
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  
  // Get first day of year
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  
  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    year: target.getUTCFullYear(),
    week: weekNum
  };
}

/**
 * Get Sunday of the week containing this date (UTC)
 * 
 * @example getUTCSunday(parseUTCDate('2025-11-24')) → 2025-11-30T00:00:00.000Z
 */
export function getUTCSunday(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return addUTCDays(date, daysToSunday);
}

/**
 * Format date for display (locale-aware but UTC-based)
 * 
 * @example formatUTCDate(parseUTCDate('2025-11-24'), 'nl-NL') → '24 november 2025'
 */
export function formatUTCDate(date: Date, locale: string = 'nl-NL', options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
}

/**
 * Check if two dates are the same day (UTC)
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Get start of month (UTC)
 */
export function getUTCStartOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Get end of month (UTC)
 */
export function getUTCEndOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/**
 * Diff between two dates in days (UTC)
 */
export function getUTCDaysDiff(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
  const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((utc2 - utc1) / msPerDay);
}
```

**Commit**: `feat: add UTC-safe date utilities for timezone-independent date handling`

**Verificatie**: 
- File bestaat in repo
- TypeScript compileert zonder errors
- Exports zijn beschikbaar

---

## FASE 2: CORE PLANNING LOGIC (KRITISCH)

### 2.1 File: `lib/planning/storage.ts`

**Actie**: UPDATE - vervang alle date parsing door UTC utilities

**Zoek en vervang patronen**:

1. **Import toevoegen** (bovenaan file):
```typescript
import { parseUTCDate, toUTCDateString, addUTCDays, getUTCMonday } from '@/lib/utils/date-utc';
```

2. **generateFiveWeekPeriods functie**:
```typescript
// VOOR (FOUT):
const startDate = new Date(options.startDate);

// NA (CORRECT):
const startDate = parseUTCDate(options.startDate);
```

3. **Alle date berekeningen**:
```typescript
// VOOR:
const monday = new Date(start);
monday.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));

// NA:
const monday = getUTCMonday(start);
```

4. **Alle date → string conversies**:
```typescript
// VOOR:
startDate: start.toISOString().split('T')[0],

// NA:
startDate: toUTCDateString(start),
```

**Critical sections**:
- `generateFiveWeekPeriods()` - period generation
- `getActivePeriod()` - current period detection
- Alle date comparisons gebruiken UTC methods

**Commit**: `fix(storage): convert to UTC-safe date parsing`

**Verificatie**:
- Geen `new Date(stringVar)` zonder parseUTCDate
- Geen `.getDay()`, `.setDate()` - alleen UTC variants
- Geen `.toISOString().split('T')[0]` - gebruik toUTCDateString

---

### 2.2 File: `lib/utils/roster-date-helpers.ts`

**Actie**: UPDATE - alle weekberekeningen naar UTC

**Zoek en vervang patronen**:

1. **Import**:
```typescript
import { parseUTCDate, getUTCWeekNumber, getUTCMonday, getUTCSunday } from './date-utc';
```

2. **Week calculation functions**:
```typescript
// VOOR:
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ...
}

// NA:
export function getWeekNumber(date: Date): number {
  return getUTCWeekNumber(date).week;
}

export function getWeekYear(date: Date): number {
  return getUTCWeekNumber(date).year;
}
```

3. **Monday/Sunday functions**:
```typescript
// Vervang door direct gebruik van getUTCMonday, getUTCSunday
export function getMonday(date: Date): Date {
  return getUTCMonday(date);
}
```

**Commit**: `fix(roster-date-helpers): convert week calculations to UTC`

---

### 2.3 File: `lib/planning/dates.ts`

**Actie**: UPDATE - date operaties naar UTC

**Critical functions**:
- Date parsing van strings
- Date arithmetic (add/subtract days)
- Date comparisons

**Pattern**:
```typescript
// VOOR:
const date = new Date(dateString);
date.setDate(date.getDate() + days);

// NA:
const date = parseUTCDate(dateString);
const result = addUTCDays(date, days);
```

**Commit**: `fix(dates): convert date operations to UTC-safe methods`

---

### 2.4 File: `lib/date-utils.ts`

**Actie**: UPDATE of DEPRECATE - migreer naar date-utc.ts

**Strategie**:
- Als functies dupliceren date-utc.ts: deprecate en redirect
- Als functies uniek zijn: converteer naar UTC

**Pattern voor redirect**:
```typescript
/**
 * @deprecated Use parseUTCDate from @/lib/utils/date-utc instead
 */
export function parseDate(dateString: string): Date {
  return parseUTCDate(dateString);
}
```

**Commit**: `fix(date-utils): migrate to UTC-safe date utilities`

---

### 2.5 File: `lib/utils/date-helpers.ts`

**Actie**: UPDATE - helper functies naar UTC

**Focus op**:
- Format functies
- Comparison functies  
- Validation functies

**Commit**: `fix(date-helpers): convert helper functions to UTC`

---

## FASE 3: DATABASE LAYER (SAMPLE)

### 3.1 File: `lib/services/roster-design-supabase.ts`

**Actie**: UPDATE - 1-2 representative functies als voorbeeld

**Pattern**:
```typescript
// Bij ophalen uit DB:
const periods = data.map(row => ({
  ...row,
  startDate: parseUTCDate(row.start_date),
  endDate: parseUTCDate(row.end_date)
}));

// Bij opslaan naar DB:
await supabase.insert({
  start_date: toUTCDateString(period.startDate),
  end_date: toUTCDateString(period.endDate)
});
```

**Commit**: `fix(roster-design-supabase): add UTC date parsing examples`

---

## FASE 4: UI COMPONENTS (SAMPLE)

### 4.1 File: `app/planning/design/page.client.tsx`

**Actie**: UPDATE - date display en input handling

**Pattern**:
```typescript
// Display:
<div>{formatUTCDate(period.startDate, 'nl-NL')}</div>

// Input parsing:
const handleDateChange = (value: string) => {
  const date = parseUTCDate(value);
  // ...
};

// Form value:
<input 
  type="date" 
  value={toUTCDateString(selectedDate)}
  onChange={e => handleDateChange(e.target.value)}
/>
```

**Commit**: `fix(page.client): convert date display to UTC formatting`

---

### 4.2 File: `app/planning/_components/AvailabilityPopup.tsx`

**Actie**: UPDATE - date input/output

**Focus**: Form handling, date range selection

**Commit**: `fix(AvailabilityPopup): convert to UTC date handling`

---

## FASE 5: EXPORT LAYER (SAMPLE)

### 5.1 File: `lib/export/pdf.ts`

**Actie**: UPDATE - date formatting in exports

**Pattern**:
```typescript
// Date formatting voor PDF:
const formattedDate = formatUTCDate(date, 'nl-NL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});
```

**Commit**: `fix(pdf-export): use UTC date formatting`

---

## FASE 6: DOCUMENTATION

### 6.1 File: `docs/UTC_DATE_HANDLING.md` (NIEUW)

**Actie**: CREATE comprehensive documentation

**Content**:
```markdown
# UTC Date Handling in Rooster App

## Problem
Date strings like 'YYYY-MM-DD' are timezone-sensitive when parsed with `new Date()`.
This causes date shifts when app runs in different timezones.

## Solution
All date parsing uses UTC utilities from `lib/utils/date-utc.ts`.

## Rules

### ✅ DO
- Parse: `parseUTCDate('2025-11-24')`
- Format: `toUTCDateString(date)`
- Add days: `addUTCDays(date, 7)`
- Get week: `getUTCWeekNumber(date)`
- Display: `formatUTCDate(date, 'nl-NL')`

### ❌ DON'T
- `new Date('2025-11-24')` ← WRONG
- `date.getDate()` ← Use `date.getUTCDate()`
- `date.setDate()` ← Use `addUTCDays()`
- `.toISOString().split('T')[0]` ← Use `toUTCDateString()`

## Remaining Work
Files not yet converted:
[List remaining files from FASE 3-5]

## Testing
- Test across timezones (NL, UTC, Curaçao)
- Test year transitions (week 52 → 1)
- Test DST transitions
```

**Commit**: `docs: add UTC date handling guidelines`

---

### 6.2 File: `DRAAD57_COMPLETION_REPORT.md` (NIEUW)

**Actie**: CREATE execution report

**Content**:
```markdown
# DRAAD57 Completion Report

## Execution Date
[Auto-fill current date]

## Status
✅ FASE 1: UTC Utilities - COMPLETE
✅ FASE 2: Core Planning Logic - COMPLETE (5/5 files)
✅ FASE 3: Database Layer - SAMPLE (1/5 files converted)
✅ FASE 4: UI Components - SAMPLE (2/50+ files converted)
✅ FASE 5: Export Layer - SAMPLE (1/5 files converted)
✅ FASE 6: Documentation - COMPLETE

## Files Modified
[List all modified files with commit SHAs]

## Bug Status
✅ Week 47-52 2025 display bug - RESOLVED
- Before: Shows "23 nov - 27 dec 2025"
- After: Shows "24 nov - 28 dec 2025"

## Testing Results
- [x] Period generation: Correct dates in UTC
- [x] Week numbers: Correct across year boundary
- [x] UI display: Correct formatting in NL locale
- [ ] Full regression test (pending)

## Remaining Work (for next session)
### Database Layer (4 files)
- lib/services/roosters-supabase.ts
- lib/services/preplanning-storage.ts
- lib/services/period-day-staffing-storage.ts
- lib/services/daytype-staffing-storage.ts

### UI Components (~48 files)
[List files from search results]

### Export Layer (4 files)
- lib/export/excel.ts
- lib/export/pdf-export-classic.ts
- lib/pdf/service-allocation-generator.ts
- components/planning/export/*

## Blueprint for Completion
Each remaining file follows same pattern:
1. Import UTC utilities
2. Replace `new Date(string)` with `parseUTCDate(string)`
3. Replace local methods with UTC methods
4. Replace string conversions with `toUTCDateString()`
5. Test visually
6. Commit atomically

Estimated effort: 2-3 hours for remaining files
Risk level: LOW (core is fixed, rest is repetitive)
```

**Commit**: `docs: add DRAAD57 completion report`

---

## POST-EXECUTION CHECKLIST

Na alle commits, verifieer:

- [ ] Branch `fix/utc-date-parsing-comprehensive` exists
- [ ] Alle commits zijn pushed
- [ ] Railway deployment succeeded
- [ ] Manually test: Create new 5-week period
- [ ] Verify: Week 47-52 2025 shows "24 nov" (not "23 nov")
- [ ] Verify: Week numbers correct in dashboard
- [ ] No TypeScript errors in build

---

## ROLLBACK PLAN

Als er kritieke bugs zijn:
1. Identify problematic commit
2. Revert specific commit: `git revert <sha>`
3. Push revert
4. Document issue in DRAAD57_COMPLETION_REPORT.md

---

## SUCCESS CRITERIA

### Minimum (MUST HAVE):
✅ FASE 1 complete - UTC utilities exist
✅ FASE 2 complete - Core planning logic is UTC-safe
✅ Week 47-52 2025 bug is resolved
✅ Period generation produces correct dates
✅ Documentation exists for remaining work

### Nice to Have:
✅ FASE 3-5 samples demonstrate pattern
✅ Comprehensive documentation
✅ Clear blueprint for completion

---

## EXECUTION NOTES

**Duration estimate**: 90-120 minutes
**Tool calls estimate**: 25-35 calls
**Risk level**: MEDIUM (but mitigated by incremental approach)

**Critical points**:
- After FASE 2.1 (storage.ts): STOP and verify period generation
- If any file breaks functionality: PAUSE, analyze, fix before continuing
- Monitor Railway deployments: auto-deploy after each push

**Communication**:
- Report progress after each FASE
- Report any issues immediately
- Provide clear status at end

---

## START COMMAND

When you read this file in next thread, simply execute:
"Execute DRAAD57_UTC_CONVERSION_EXECUTION_PLAN.md - OPTIE B"

Then proceed systematically through all phases.

---

**END OF EXECUTION PLAN**
