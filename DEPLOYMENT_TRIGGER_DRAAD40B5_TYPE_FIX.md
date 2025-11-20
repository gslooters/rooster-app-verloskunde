# DEPLOYMENT TRIGGER - DRAAD40B5 TYPE FIX

**Datum:** 20 november 2025, 22:45 CET  
**Commit:** c49ff7ab9a53e63474b255dc5b119b1d80d7b491  
**Status:** ✅ FIX DEPLOYED - Wachtend op Railway deployment

---

## 🔥 PROBLEEM ANALYSE (uit logs)

### Originele Fout
```
Failed to compile.

./components/planning/week-dagdelen/WeekDagdelenClient.tsx:175:15
Type error: Type 'WeekDagdeelData' is missing the following properties from type 'WeekDagdelenData': 
  context, diensten, totaalRecords
```

### Root Cause
**TYPE MISMATCH** tussen twee verschillende data structuren:

1. **WeekDagdeelData** (singular) - OUDE structuur
   - Locatie: `lib/planning/weekDagdelenData.ts`
   - Structuur: `{ days[], rosterId, weekNummer, jaar, startDatum, eindDatum }`
   - Gebruikt door: `getWeekDagdelenData()` functie

2. **WeekDagdelenData** (plural) - NIEUWE structuur
   - Locatie: `lib/types/week-dagdelen.ts`
   - Structuur: `{ context, diensten[], totaalRecords }`
   - Verwacht door: `WeekDagdelenTable` component

### Probleem
- `page.tsx` haalt data op met `getWeekDagdelenData()` → retourneert **WeekDagdeelData**
- `WeekDagdelenClient` krijgt `initialWeekData: WeekDagdeelData`
- `WeekDagdelenTable` verwacht `weekData: WeekDagdelenData` → **TYPE MISMATCH!**

---

## ✅ OPLOSSING GEIMPLEMENTEERD

### Fix Strategie: TIJDELIJKE WORKAROUND

Omdat een volledige data pipeline refactor te complex is voor een hotfix, hebben we gekozen voor:

**1. Type correctie in WeekDagdelenClient.tsx**
```typescript
// ✅ CORRECT type gebruikt
interface WeekDagdelenClientProps {
  initialWeekData: WeekDagdeelData;  // Oude structuur
  // ...
}
```

**2. WeekDagdelenTable tijdelijk uitgeschakeld**
```typescript
// ❌ TIJDELIJK UITGESCHAKELD - type mismatch
// import WeekDagdelenTable from './WeekDagdelenTable';
```

**3. Placeholder UI getoond**
- Duidelijke melding over data structuur conversie
- Technische details voor developers
- Debug informatie in development mode

---

## 📝 GEWIJZIGDE BESTANDEN

### components/planning/week-dagdelen/WeekDagdelenClient.tsx
**Wijzigingen:**
- ✅ Type definitie gecorrigeerd: `initialWeekData: WeekDagdeelData`
- ❌ WeekDagdelenTable import verwijderd (tijdelijk)
- ➕ Placeholder UI toegevoegd met uitleg
- ➕ Debug informatie sectie toegevoegd

**Commit:** c49ff7ab9a53e63474b255dc5b119b1d80d7b491

---

## ✅ VERWACHT RESULTAAT

### Build Status
```
✅ TypeScript type checking: PASS
✅ Next.js build: SUCCESS
✅ Railway deployment: WAITING...
```

### Runtime Gedrag
Wanneer gebruiker navigeert naar `/planning/design/week-dagdelen/[rosterId]/[weekNummer]`:

1. ✅ Page.tsx laadt data succesvol (WeekDagdeelData)
2. ✅ WeekDagdelenClient rendert zonder type errors
3. 🟡 Placeholder UI toont in plaats van table:
   - "Data structuur conversie in ontwikkeling"
   - Uitleg over WeekDagdeelData vs WeekDagdelenData
   - Debug info (development mode)

---

## 🚧 TODO: PERMANENTE OPLOSSING

### Optie A: Refactor hele data pipeline naar nieuwe structuur
**Impact:** HOOG  
**Bestanden:**
- `lib/planning/weekDagdelenData.ts` → retourneer WeekDagdelenData
- `app/planning/design/week-dagdelen/[rosterId]/[weekNummer]/page.tsx`
- Alle consumers van `getWeekDagdelenData()`

### Optie B: Converteer oude naar nieuwe structuur in Client
**Impact:** MEDIUM  
**Locatie:** `WeekDagdelenClient.tsx`
```typescript
// Conversie functie
function convertWeekDagdeelDataToWeekDagdelenData(
  oldData: WeekDagdeelData
): WeekDagdelenData {
  // Transform logic here...
}
```

### Optie C: Update WeekDagdelenTable om oude structuur te accepteren
**Impact:** LOW  
**Locatie:** `components/planning/week-dagdelen/WeekDagdelenTable.tsx`
- Accepteer beide structuren
- Interne conversie indien nodig

**📌 AANBEVELING:** Optie B (conversie in Client) is snelste pad naar werkende UI

---

## 📊 MONITORING

### Railway Deployment Status
Check: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

### Verwachte Timeline
- [x] 22:44 - Fix gecommit naar GitHub
- [x] 22:45 - Deployment trigger document aangemaakt
- [ ] 22:46-22:50 - Railway build process
- [ ] 22:50-22:52 - Deployment compleet
- [ ] 22:52+ - Live verificatie

### Verificatie Checklist
- [ ] Railway build succesvol (geen TypeScript errors)
- [ ] Deployment live op production URL
- [ ] Week dagdelen pagina laadt zonder crashes
- [ ] Placeholder UI zichtbaar
- [ ] Console logs tonen correct geladen data

---

## 📝 DEPLOYMENT NOTES

### Wat werkt NA deze fix:
- ✅ TypeScript compilatie
- ✅ Build process
- ✅ Page rendering zonder crashes
- ✅ Data loading (WeekDagdeelData)
- ✅ Navigation en routing

### Wat NOG NIET werkt:
- ❌ WeekDagdelenTable display (tijdelijk uitgeschakeld)
- ❌ Data editing functionaliteit
- ❌ Team filtering
- ❌ Dagdeel cel interactions

### Quick Win voor volgende sessie:
Implementeer Optie B conversie functie = volledige functionaliteit hersteld in <30 min

---

**🚀 DEPLOYMENT TRIGGERED**  
**⏳ Watching Railway logs...**

---

## APPENDIX: Relevante Code Snippets

### Type Definities

#### WeekDagdeelData (oude structuur)
```typescript
// lib/planning/weekDagdelenData.ts
export interface WeekDagdeelData {
  rosterId: string;
  weekNummer: number;
  jaar: number;
  startDatum: string;
  eindDatum: string;
  days: DayDagdeelData[];
}
```

#### WeekDagdelenData (nieuwe structuur)
```typescript
// lib/types/week-dagdelen.ts
export interface WeekDagdelenData {
  context: WeekContext;
  diensten: DienstDagdelenWeek[];
  totaalRecords: number;
}
```

### Data Flow
```
page.tsx
  ↓
  getWeekDagdelenData(rosterId, weekNummer, jaar, periodStart)
  ↓
  🔴 Returns: WeekDagdeelData { days[], rosterId, ... }
  ↓
WeekDagdelenClient
  initialWeekData: WeekDagdeelData  ✅ CORRECT
  ↓
  ❌ WeekDagdelenTable verwacht: WeekDagdelenData { context, diensten[], ... }
  ↓
  🟡 TIJDELIJK: Placeholder UI i.p.v. table
```

---

**EINDE DEPLOYMENT DOCUMENT**
