# DRAAD58 - Complete UTC Conversion Execution Plan

## METADATA

**Datum aanmaak**: 26 november 2025, 15:17 CET  
**Parent**: DRAAD57 (Core UTC conversion - COMPLEET)  
**Status**: READY FOR EXECUTION  
**Branch**: `fix/utc-date-parsing-complete`  
**Geschatte duur**: 4-6 uur  
**Complexity**: MEDIUM (repetitief patroon)  
**Risk level**: LOW (patroon bewezen in DRAAD57)

---

## EXECUTIVE SUMMARY

**Doel**: Complete alle resterende UTC date conversies (~56 bestanden) om 100% timezone-onafhankelijke date handling te bereiken door hele codebase.

**Context**: DRAAD57 heeft core planning logic (5 bestanden) + samples (3 bestanden) succesvol geconverteerd. Het kritieke datum-probleem (Week 47-52 2025) is opgelost. Deze draad voltooit de conversie voor volledige consistency.

**Strategie**: Systematische batch conversie in drie fases (Export → Database → UI), met atomic commits per logische groep.

---

## WAAROM DEZE CONVERSIE?

### Huidige Status (na DRAAD57)

✅ **CORE IS UTC-SAFE:**
- Periode generatie: correct
- Week berekeningen: correct  
- Planning logic: correct

⚠️ **MAAR NOG NIET OVERAL:**
- UI display: gebruikt nog oude methods
- Database queries: gebruikt nog oude methods
- PDF/Excel export: gebruikt nog oude methods

### Impact van Niet-Conversie

**Concrete issues die NU kunnen voorkomen:**

1. **PDF Export Bug** (waarschijnlijk oorzaak van "Geen diensten gevonden")
   - Export layer gebruikt `new Date(dateStr)`
   - Query matched niet met UTC-correcte database data
   - → PDF toont geen data

2. **UI Display Inconsistency**
   - Core genereert "24 nov - 28 dec"
   - UI component toont mogelijk "23 nov - 27 dec"
   - → Verwarrende user experience

3. **Database Query Mismatches**
   - Core schrijft UTC timestamps
   - Query gebruikt local timezone
   - → Data niet gevonden

4. **Future Timezone Bugs**
   - Mix van oude/nieuwe methods
   - Developer moet nadenken welke te gebruiken
   - → Fouten bij nieuwe features

### Voordelen van Volledige Conversie

✅ **100% Consistency** - Overal dezelfde datum, altijd  
✅ **Bug-free Exports** - PDF/Excel tonen correcte datums  
✅ **Clean Codebase** - Één manier van date handling  
✅ **Future-proof** - Geen timezone verrassingen meer  
✅ **Maintainable** - Duidelijke conventions voor developers

---

## EXECUTION AUTHORITY

**JIJ BENT DE UITVOERDER** - Alle work wordt gedaan via GitHub MCP tools.

**Rights**: GitHub read/write via MCP tools  
**Method**: Alles via GitHub tools + Railway; NOOIT terminal/git/lokaal  
**Quality**: Lever code in beste kwaliteit - beter langer nadenken dan fouten maken

**Railway Monitoring**: Auto-deploy na elke push naar branch - check build logs

---

## TECHNICAL FOUNDATION

### UTC Utilities Available (from DRAAD57)

```typescript
import {
  parseUTCDate,        // Parse YYYY-MM-DD → UTC Date
  toUTCDateString,     // Date → YYYY-MM-DD string
  addUTCDays,          // Add days without DST issues
  getUTCWeekNumber,    // ISO week calculation
  getUTCMonday,        // Get Monday of week
  getUTCSunday,        // Get Sunday of week
  formatUTCDate,       // Locale-aware formatting
  isSameUTCDay,        // Compare dates
  getUTCStartOfMonth,  // Start of month
  getUTCEndOfMonth,    // End of month
  getUTCDaysDiff       // Days between dates
} from '@/lib/utils/date-utc';
```

### Conversion Pattern (Universal)

**Voor elk bestand:**

```typescript
// STAP 1: Import UTC utilities (bovenaan file)
import { parseUTCDate, toUTCDateString, formatUTCDate } from '@/lib/utils/date-utc';

// STAP 2: Vervang date parsing
// ❌ VOOR:
const date = new Date(dateString);

// ✅ NA:
const date = parseUTCDate(dateString);

// STAP 3: Vervang local methods met UTC methods
// ❌ VOOR:
date.getDate()
date.getMonth()
date.getDay()
date.setDate(date.getDate() + 7)

// ✅ NA:
date.getUTCDate()
date.getUTCMonth()
date.getUTCDay()
addUTCDays(date, 7)

// STAP 4: Vervang string conversies
// ❌ VOOR:
date.toISOString().split('T')[0]

// ✅ NA:
toUTCDateString(date)

// STAP 5: Vervang formatting
// ❌ VOOR:
date.toLocaleDateString('nl-NL')

// ✅ NA:
formatUTCDate(date, 'nl-NL')
```

---

## FASE 1: EXPORT LAYER (4 bestanden)

**Prioriteit**: HIGHEST - Fix huidige PDF export bug

**Target bestanden:**

1. `lib/export/excel.ts` - Excel export functionaliteit
2. `lib/export/pdf-export-classic.ts` - Klassieke PDF generator  
3. `lib/pdf/service-allocation-generator.ts` - Service allocation PDF
4. `components/planning/export/ExportButtons.tsx` - Export UI component

### Conversie Strategie

**Per bestand:**
1. Haal bestand op met `get_file_contents`
2. Identificeer alle date operations
3. Converteer naar UTC methods
4. Update bestand met `create_or_update_file`
5. Commit met beschrijvende message

**Commit pattern:**
```
fix(export): convert [filename] to UTC date handling

- Replace new Date(string) with parseUTCDate()
- Replace .toISOString().split() with toUTCDateString()
- Replace local date methods with UTC variants
- Ensures correct date display in exports across timezones

Related: DRAAD58 complete UTC conversion
```

### Verificatie Points

Na elk bestand:
- [ ] Geen `new Date(stringVar)` zonder `parseUTCDate`
- [ ] Geen `.getDay()` / `.getMonth()` / `.getDate()` zonder UTC prefix
- [ ] Geen `.toISOString().split('T')[0]` zonder `toUTCDateString`
- [ ] Imports correct toegevoegd bovenaan
- [ ] TypeScript compileert (check Railway build log)

---

## FASE 2: DATABASE LAYER (4 bestanden)

**Prioriteit**: HIGH - Voorkom data consistency issues

**Target bestanden:**

1. `lib/services/roosters-supabase.ts` - Rooster CRUD operations
2. `lib/services/preplanning-storage.ts` - Preplanning data storage
3. `lib/services/period-day-staffing-storage.ts` - Period day staffing
4. `lib/services/daytype-staffing-storage.ts` - Daytype staffing data

### Database-Specific Patterns

**Bij ophalen uit database:**
```typescript
// ❌ VOOR:
const rooster = data.map(row => ({
  ...row,
  startDate: new Date(row.start_date),
  endDate: new Date(row.end_date)
}));

// ✅ NA:
const rooster = data.map(row => ({
  ...row,
  startDate: parseUTCDate(row.start_date),
  endDate: parseUTCDate(row.end_date)
}));
```

**Bij opslaan naar database:**
```typescript
// ❌ VOOR:
await supabase.insert({
  start_date: date.toISOString().split('T')[0],
  end_date: endDate.toISOString().split('T')[0]
});

// ✅ NA:
await supabase.insert({
  start_date: toUTCDateString(date),
  end_date: toUTCDateString(endDate)
});
```

**Bij datum queries:**
```typescript
// ❌ VOOR:
.gte('date', startDate.toISOString())
.lte('date', endDate.toISOString())

// ✅ NA:
.gte('date', toUTCDateString(startDate))
.lte('date', toUTCDateString(endDate))
```

### Commit Pattern

```
fix(database): convert [filename] to UTC date handling

- Use parseUTCDate for DB timestamp conversion
- Use toUTCDateString for DB queries and inserts
- Ensures consistent date storage/retrieval across timezones

Related: DRAAD58 complete UTC conversion
```

---

## FASE 3: UI COMPONENTS (48 bestanden)

**Prioriteit**: MEDIUM - Ensure UI consistency

**Strategie**: Batch processing in logische groepen

### Groep 1: Planning Design Components (~12 bestanden)

**Directory**: `app/planning/design/`

Target bestanden:
- `unavailability/page.tsx`
- `unavailability/components/*.tsx`
- `preplanning/page.tsx`
- `preplanning/components/*.tsx`
- `period-staffing/page.tsx`
- `period-staffing/components/*.tsx`
- `dashboard/page.tsx`
- `dashboard/components/*.tsx`

**Batch commit** (max 4-5 bestanden per commit):
```
fix(planning-design): convert [subset] to UTC date handling

Files updated:
- unavailability/page.tsx
- unavailability/components/DatePicker.tsx
- preplanning/page.tsx

Changes:
- Replace date parsing with parseUTCDate()
- Use formatUTCDate() for display
- Ensure correct date input handling

Related: DRAAD58 complete UTC conversion
```

### Groep 2: Planning Core Components (~8 bestanden)

**Directory**: `app/planning/`

Target bestanden:
- `[id]/page.tsx`
- `new/page.tsx`
- `edit/page.tsx`
- `service-allocation/page.tsx`
- `components/*.tsx`

### Groep 3: Week/Dagdelen Components (~10 bestanden)

**Directory**: `app/planning/design/week-dagdelen/`

Target bestanden:
- `[rosterId]/[weekNummer]/page.tsx`
- Components voor week display
- Dagdelen tabel components

### Groep 4: Shared Planning Components (~18 bestanden)

**Directory**: `components/planning/`

Target bestanden:
- Form components met datum inputs
- Calendar/date picker components
- Display components met datum formatting
- Utility components

### UI-Specific Patterns

**Display formatting:**
```typescript
// ❌ VOOR:
const displayDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
};

// ✅ NA:
const displayDate = (dateStr: string) => {
  const date = parseUTCDate(dateStr);
  return formatUTCDate(date, 'nl-NL', { 
    day: 'numeric', 
    month: 'numeric', 
    year: 'numeric' 
  });
};
```

**Input handling:**
```typescript
// ❌ VOOR:
const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
  const date = new Date(e.target.value);
  updateState(date);
};

// ✅ NA:
const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
  const date = parseUTCDate(e.target.value);
  updateState(date);
};
```

**Date comparisons:**
```typescript
// ❌ VOOR:
const isToday = date.toDateString() === new Date().toDateString();

// ✅ NA:
import { isSameUTCDay } from '@/lib/utils/date-utc';
const today = new Date();
const isToday = isSameUTCDay(date, today);
```

---

## EXECUTION WORKFLOW

### Pre-Execution Checklist

- [ ] DRAAD57 completion report gelezen en begrepen
- [ ] UTC utilities documentatie (`docs/UTC_DATE_HANDLING.md`) bestudeerd
- [ ] Branch aangemaakt: `fix/utc-date-parsing-complete`
- [ ] Railway auto-deploy geconfigureerd voor branch

### Execution Flow

```
VOOR ELKE FASE:
  1. Start met fase announcement
  2. Voor elk bestand/batch:
     a. Haal file contents op
     b. Identificeer date operations
     c. Converteer naar UTC methods
     d. Update file
     e. Commit atomic
     f. Verify TypeScript compileert (Railway)
  3. Fase completion summary

NA ALLE FASES:
  4. Create completion report
  5. Update documentation
  6. Create Pull Request
  7. Verify deployment
```

### Progress Tracking Template

```markdown
## FASE [N] PROGRESS

**Target**: [N] bestanden
**Status**: [IN PROGRESS / COMPLETE]

### Completed:
- [x] file1.ts (commit: abc123)
- [x] file2.ts (commit: def456)

### In Progress:
- [ ] file3.ts

### Remaining:
- [ ] file4.ts
- [ ] file5.ts
```

---

## QUALITY GATES

### Per-File Checklist

- [ ] Import statement added: `import { parseUTCDate, ... } from '@/lib/utils/date-utc'`
- [ ] All `new Date(stringVar)` replaced with `parseUTCDate(stringVar)`
- [ ] All `.getDate()`, `.getMonth()`, `.getDay()` replaced with UTC variants
- [ ] All `.toISOString().split('T')[0]` replaced with `toUTCDateString()`
- [ ] All date formatting uses `formatUTCDate()` where applicable
- [ ] No timezone-sensitive operations remain
- [ ] TypeScript compiles without errors
- [ ] File functionality unchanged (only date handling improved)

### Per-Phase Verification

**After Export Layer:**
- [ ] Railway build succeeds
- [ ] No TypeScript errors
- [ ] PDF export uses UTC methods
- [ ] Excel export uses UTC methods

**After Database Layer:**
- [ ] Railway build succeeds
- [ ] Database queries use UTC string conversion
- [ ] Data retrieval uses UTC parsing
- [ ] No timezone issues in storage/retrieval

**After UI Components:**
- [ ] Railway build succeeds
- [ ] All display components use formatUTCDate
- [ ] All input handlers use parseUTCDate
- [ ] UI shows consistent dates

---

## ERROR HANDLING

### If TypeScript Errors Occur

1. **Stop execution** - Don't proceed to next file
2. **Analyze error** - Read Railway build log
3. **Fix immediately** - Update problematic file
4. **Re-commit** - Fix in same commit or separate fix commit
5. **Verify** - Wait for Railway build success
6. **Continue** - Proceed to next file

### If Functionality Breaks

1. **Identify** - Which date operation broke?
2. **Compare** - Check original vs converted code
3. **Debug** - Add console.logs if needed (remove after)
4. **Fix** - Correct the conversion
5. **Test** - Verify functionality restored
6. **Document** - Note issue in completion report

### Rollback Plan

If critical issues:
1. Identify last working commit
2. `git revert <sha>` problematic commits
3. Push revert to branch
4. Document issue thoroughly
5. Analyze root cause
6. Retry with fix

---

## SUCCESS CRITERIA

### Minimum Requirements (MUST HAVE)

✅ All 56 target files converted  
✅ Zero TypeScript compilation errors  
✅ Railway deployment succeeds  
✅ No `new Date(stringVar)` in converted files  
✅ All imports correctly added  
✅ Atomic commits with clear messages

### Quality Indicators (SHOULD HAVE)

✅ PDF export works correctly (test manually)  
✅ Excel export works correctly (test manually)  
✅ UI dates display consistently  
✅ Database queries return correct data  
✅ No console warnings about timezones

### Excellence Markers (NICE TO HAVE)

✅ Comprehensive completion report  
✅ Updated documentation  
✅ Clear commit history for review  
✅ All edge cases considered

---

## COMPLETION DELIVERABLES

### 1. Updated Files (~56)

All target files converted to UTC date handling.

### 2. Completion Report

File: `DRAAD58_COMPLETION_REPORT.md`

Content:
```markdown
# DRAAD58 Completion Report

## Execution Summary
- Date: [auto-fill]
- Duration: [auto-fill]
- Files converted: [count]
- Commits: [count]
- Status: COMPLETE / PARTIAL

## Files Modified

### Export Layer (4 files)
- [x] lib/export/excel.ts (commit: abc)
- [x] lib/export/pdf-export-classic.ts (commit: def)
...

### Database Layer (4 files)
...

### UI Components (48 files)
...

## Verification Results
- [x] TypeScript compiles
- [x] Railway deployment succeeds
- [x] PDF export tested - PASS
- [x] Excel export tested - PASS
- [x] UI display tested - PASS

## Issues Encountered
[List any issues and resolutions]

## Metrics
- Lines changed: ~[estimate]
- Build time: [time]
- Deployment time: [time]

## Next Steps
[Any remaining tasks or recommendations]
```

### 3. Updated Documentation

Update `docs/UTC_DATE_HANDLING.md`:
- Mark all files as ✅ CONVERTED
- Remove "Remaining Work" section
- Add "Completion Date" at top
- Update status to "100% Complete"

### 4. Pull Request

Create PR: `fix/utc-date-parsing-complete` → `main`

Title: **"DRAAD58: Complete UTC date conversion - All remaining files"**

Description:
```markdown
## Summary
Completes UTC date conversion started in DRAAD57. All remaining ~56 files now use timezone-independent date handling.

## Changes
- Export Layer: 4 files (PDF, Excel exports)
- Database Layer: 4 files (All storage services)
- UI Components: 48 files (All planning UI)

## Impact
- ✅ 100% timezone-independent date handling
- ✅ PDF/Excel exports show correct dates
- ✅ UI displays consistent dates everywhere
- ✅ Database queries timezone-safe
- ✅ No more "23 nov vs 24 nov" issues

## Testing
- [x] TypeScript compiles without errors
- [x] Railway deployment successful
- [x] Manual testing: PDF export ✅
- [x] Manual testing: Excel export ✅
- [x] Manual testing: UI date display ✅

## Related
- Parent: DRAAD57 (Core UTC conversion)
- Docs: docs/UTC_DATE_HANDLING.md
- Report: DRAAD58_COMPLETION_REPORT.md
```

---

## ESTIMATED TIMELINE

**Realistic estimates:**

| Phase | Files | Time per File | Total Time |
|-------|-------|---------------|------------|
| Export Layer | 4 | 15 min | ~60 min |
| Database Layer | 4 | 20 min | ~80 min |
| UI Components | 48 | 5 min | ~240 min |
| Documentation | - | 30 min | ~30 min |
| PR & Verification | - | 30 min | ~30 min |
| **TOTAL** | **56** | - | **~440 min (7 uur)** |

**Buffer voor issues:** +20% = ~8.5 uur total

**Token budget:** 200,000 tokens available, ~120,000 verwacht (60%)

---

## START COMMAND

**In nieuwe DRAAD58 thread, execute:**

```
DRAAD58 - EXECUTION MODE

RECHTEN: GitHub read/write via MCP tools beschikbaar
METHODE: Alles via GitHub tools + Railway; NOOIT terminal/git/lokaal
ACTEUR: JIJ voert uit met beschikbare tools - geen instructies voor mij
KWALITEIT: Lever de code in de best mogelijke kwaliteit.

OPDRACHT:
1. Lees DRAAD58_COMPLETE_UTC_CONVERSION_PLAN.md volledig
2. Voer uit conform plan
3. Start met FASE 1: Export Layer
4. Gevolgd door FASE 2: Database Layer
5. Afsluitend FASE 3: UI Components
6. Maak completion report
7. Create Pull Request

Prioriteit: MEDIUM (niet urgent, maar wel belangrijk)
Start: NU
```

---

## APPENDIX A: FILE INVENTORY

### Export Layer (4 files)

```
lib/export/
├── excel.ts                           ← Excel export generation
└── pdf-export-classic.ts              ← Legacy PDF export

lib/pdf/
└── service-allocation-generator.ts    ← Service allocation PDF

components/planning/export/
└── ExportButtons.tsx                  ← Export UI component
```

### Database Layer (4 files)

```
lib/services/
├── roosters-supabase.ts               ← Rooster CRUD
├── preplanning-storage.ts             ← Preplanning data
├── period-day-staffing-storage.ts     ← Period staffing
└── daytype-staffing-storage.ts        ← Daytype staffing
```

### UI Components (48 files - estimated)

```
app/planning/design/
├── unavailability/
│   ├── page.tsx
│   └── components/*.tsx (~3 files)
├── preplanning/
│   ├── page.tsx
│   └── components/*.tsx (~3 files)
├── period-staffing/
│   ├── page.tsx
│   └── components/*.tsx (~3 files)
├── dashboard/
│   ├── page.tsx
│   └── components/*.tsx (~2 files)
├── dagdelen-dashboard/
│   ├── page.tsx
│   ├── [weekNumber]/page.tsx
│   └── components/*.tsx (~3 files)
└── week-dagdelen/
    ├── [rosterId]/[weekNummer]/page.tsx
    └── components/*.tsx (~5 files)

app/planning/
├── [id]/page.tsx
├── new/page.tsx
├── edit/page.tsx
├── service-allocation/page.tsx
└── components/*.tsx (~5 files)

components/planning/
├── forms/*.tsx (~5 files)
├── calendars/*.tsx (~3 files)
├── display/*.tsx (~5 files)
└── utils/*.tsx (~3 files)
```

*Note: Exacte aantal wordt bepaald tijdens execution via file search*

---

## APPENDIX B: COMMON PATTERNS REFERENCE

### Pattern 1: Date Parsing
```typescript
// Before
const date = new Date('2025-11-24');
const date = new Date(stringVar);

// After
import { parseUTCDate } from '@/lib/utils/date-utc';
const date = parseUTCDate('2025-11-24');
const date = parseUTCDate(stringVar);
```

### Pattern 2: Date to String
```typescript
// Before
const str = date.toISOString().split('T')[0];

// After
import { toUTCDateString } from '@/lib/utils/date-utc';
const str = toUTCDateString(date);
```

### Pattern 3: Date Display
```typescript
// Before
const display = date.toLocaleDateString('nl-NL');

// After
import { formatUTCDate } from '@/lib/utils/date-utc';
const display = formatUTCDate(date, 'nl-NL');
```

### Pattern 4: Date Arithmetic
```typescript
// Before
const nextWeek = new Date(date);
nextWeek.setDate(nextWeek.getDate() + 7);

// After
import { addUTCDays } from '@/lib/utils/date-utc';
const nextWeek = addUTCDays(date, 7);
```

### Pattern 5: Week Calculations
```typescript
// Before
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ... complex calculation
}

// After
import { getUTCWeekNumber } from '@/lib/utils/date-utc';
const { week, year } = getUTCWeekNumber(date);
```

---

**END OF EXECUTION PLAN**

**Document Version**: 1.0  
**Created**: 26 november 2025, 15:17 CET  
**Status**: READY FOR EXECUTION  
**Expected Completion**: 1 draad, 7-8 uur werk
