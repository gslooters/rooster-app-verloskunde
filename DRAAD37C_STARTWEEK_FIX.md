# DRAAD37C - Startweek Initialisatie Fix

**Datum:** 18 november 2025  
**Status:** ✅ OPGELOST  
**Prioriteit:** URGENT

---

## Probleem

Bij het openen van het scherm "Diensten per Dagdeel periode" werd **Week 47** getoond in plaats van **Week 48**.

### Screenshots

- **Image 1:** Fout - Week 47 wordt getoond (huidige week)
- **Image 2:** Correct - Week 48 moet worden getoond (startweek rooster)

### Root Cause

De `currentWeek` state werd geïnitialiseerd met de **huidige week van vandaag** (18 november 2025 = week 47):

```typescript
// FOUT - Oude code op regel 159
const [currentWeek, setCurrentWeek] = useState<number>(getWeekNumber(new Date()));
```

Terwijl het rooster start op **23 november 2025** (week 48).

---

## Oplossing

De `currentWeek` wordt nu geïnitialiseerd met `null` en wordt ingesteld op de **startweek van het rooster** nadat `rosterInfo` is geladen uit de database.

### Code Wijzigingen

#### 1. State Initialisatie (regel 159)

```typescript
// NIEUW - Initialiseer op null
const [currentWeek, setCurrentWeek] = useState<number | null>(null);
```

#### 2. Set CurrentWeek na laden RosterInfo (regel 205-208)

```typescript
// DRAAD37C FIX: Stel currentWeek in op de startweek van het rooster
const startDate = new Date(roster.start_date);
const startWeek = getWeekNumber(startDate);
setCurrentWeek(startWeek);
console.log('[DAGDEEL PERIODE] Starting at week:', startWeek);
```

#### 3. Update Loading Check (regel 460-462)

```typescript
// DRAAD37C FIX: Wacht tot currentWeek is ingesteld
if (loading || currentWeek === null) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Diensten per dagdeel wordt geladen...</p>
      </div>
    </div>
  );
}
```

#### 4. Update Week Navigation Functions

```typescript
function canGoToPreviousWeek(): boolean {
  if (!rosterInfo || currentWeek === null) return false;
  // ... rest van functie
}

function canGoToNextWeek(): boolean {
  if (!rosterInfo || currentWeek === null) return false;
  // ... rest van functie
}

function handlePreviousWeek() {
  if (canGoToPreviousWeek() && currentWeek !== null) {
    setCurrentWeek(prev => (prev !== null ? prev - 1 : null));
  }
}

function handleNextWeek() {
  if (canGoToNextWeek() && currentWeek !== null) {
    setCurrentWeek(prev => (prev !== null ? prev + 1 : null));
  }
}
```

---

## Logica Flow

### Oude Flow (FOUT)

1. Component mount
2. `currentWeek` = huidige week (47) ← **FOUT**
3. RosterInfo laden (start_date = 2025-11-23 = week 48)
4. Scherm toont week 47 ← **VERKEERD**

### Nieuwe Flow (CORRECT)

1. Component mount
2. `currentWeek` = null
3. Loading screen wordt getoond
4. RosterInfo laden (start_date = 2025-11-23)
5. `currentWeek` = getWeekNumber(start_date) = **48** ← **CORRECT**
6. Scherm toont week 48 ← **JUIST**

---

## Testing

### Test Scenario 1: Rooster start in toekomst

- **Rooster:** 23 nov 2025 - 27 dec 2025 (week 48-52)
- **Vandaag:** 18 nov 2025 (week 47)
- **Verwacht:** Scherm opent op week 48 ✅

### Test Scenario 2: Rooster start vandaag

- **Rooster:** 18 nov 2025 - 22 dec 2025 (week 47-51)
- **Vandaag:** 18 nov 2025 (week 47)
- **Verwacht:** Scherm opent op week 47 ✅

### Test Scenario 3: Rooster start in verleden

- **Rooster:** 4 nov 2025 - 8 dec 2025 (week 45-49)
- **Vandaag:** 18 nov 2025 (week 47)
- **Verwacht:** Scherm opent op week 45 ✅

---

## Impacted Files

- `app/planning/period-staffing/page.tsx` (27.347 bytes)

## Commit Details

- **SHA:** 109e0d7bddf58928225e21e4e3f85bdf22078a41
- **Message:** "DRAAD37C: Fix startweek initialisatie - Start met week 48 ipv huidige week 47"
- **Author:** Govard Slooters
- **Date:** 18 november 2025, 18:30:49 UTC

---

## Deployment

✅ **Code gecommit naar GitHub (main branch)**  
⏳ **Railway deployment in uitvoering**  
🔄 **Automatische deployment via GitHub webhook**

### Railway Project

- **Project:** 90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Service:** fdfbca06-6b41-4ea1-862f-ce48d659a92c
- **Environment:** 9d349f27-4c49-497e-a3f1-d7e50bffc49f

---

## Verificatie Checklist

- [x] Code syntactisch correct
- [x] TypeScript types correct (null toegevoegd aan currentWeek type)
- [x] Null checks toegevoegd aan alle relevante functies
- [x] Loading state update (wacht op currentWeek)
- [x] Console logging toegevoegd voor debugging
- [x] Code gecommit naar GitHub
- [ ] Railway deployment succesvol
- [ ] Productie test: Week 48 wordt getoond bij openen scherm

---

## Technische Details

### State Management

**Type wijziging:**
```typescript
// Van:
const [currentWeek, setCurrentWeek] = useState<number>(...);

// Naar:
const [currentWeek, setCurrentWeek] = useState<number | null>(null);
```

### Null Safety

Alle functies die `currentWeek` gebruiken zijn bijgewerkt met null checks:

- `canGoToPreviousWeek()`
- `canGoToNextWeek()`
- `handlePreviousWeek()`
- `handleNextWeek()`
- Render logic (loading check)

---

## Gerelateerde Issues

Geen

---

## Volgende Stappen

1. Wacht op Railway deployment
2. Test in productie omgeving
3. Verifieer dat week 48 wordt getoond
4. Sluit deze draad af

---

**Einde Documentatie DRAAD37C**