# PrePlanning Components

Deze directory bevat de React components voor het PrePlanning/Planrooster scherm.

## DRAAD 78: PlanningGridDagdelen Component

### Doel
Rendert een rooster grid met **3 kolommen per datum** (Ochtend/Middag/Avond) in plaats van de oude 1-kolom-per-datum structuur.

### Status-based Cel Rendering

Het grid rendert cellen op basis van de `status` waarde uit de database:

| Status | Weergave | Achtergrond | Betekenis | Klikbaar |
|--------|----------|-------------|-----------|----------|
| **0** | `-` | Wit (`#FFFFFF`) | Leeg - nog niet ingepland | ✅ |
| **1** | `ABC` | Dienstkleur uit `service_types.kleur` | Dienst ingepland | ✅ |
| **2** | `▓` | Grijs (`#F3F4F6`) | Geblokkeerd door vorige dienst | ❌ |
| **3** | `NB` | Geel (`#FEF3C7`) | Niet beschikbaar | ✅ |

### Props Interface

```typescript
interface PlanningGridDagdelenProps {
  employees: EmployeeWithServices[];     // Medewerkers met hun diensten
  dateInfo: DateInfo[];                  // Array met dates en weeknummers
  assignments: PrePlanningAssignment[];  // Bestaande dienst assignments
  serviceColors: Record<string, string>; // serviceId -> kleur mapping uit DB
  onCellClick: (employeeId: string, date: string, dagdeel: Dagdeel) => void;
  readOnly?: boolean;                    // Voor status 'final' (afgesloten rooster)
}
```

### Grid Structuur

#### Header (3 rijen)

1. **Rij 1: Weeknummers** - Colspan 3 per week (gecentreerd)
2. **Rij 2: Datums** - Colspan 3 per datum (bijv. "MA 24-11")
3. **Rij 3: Dagdelen** - O | M | A labels

#### Body

- **Kolom 1 (sticky left)**: Medewerkernaam + Team
- **Kolom 2+**: Cellen voor elke datum x dagdeel combinatie (35 dagen x 3 dagdelen = 105 cellen per medewerker)

### Service Kleuren

De component gebruikt een `serviceColors` map die de kleuren uit de database bevat:

```typescript
serviceColors: {
  'uuid-1': '#3B82F6',  // ECH - blauw
  'uuid-2': '#10B981',  // SPR - groen
  'uuid-3': '#F59E0B'   // D - oranje
}
```

**Fallback**: Als een kleur ontbreekt, wordt `#3B82F6` (blauw) gebruikt.

### Cel Click Handler

Wanneer een gebruiker op een cel klikt:

```typescript
onCellClick(employeeId: string, date: string, dagdeel: Dagdeel)
```

**Logica:**
- Status 0 (Leeg): Klikbaar → Open modal (DRAAD 79)
- Status 1 (Dienst): Klikbaar → Open modal (DRAAD 79)
- Status 2 (Geblokkeerd): **NIET** klikbaar
- Status 3 (NB): Klikbaar → Open modal (DRAAD 79)
- Read-only mode: **NIETS** is klikbaar

### Styling & Layout

#### Sticky Elements
- **Header**: Sticky top (`sticky top-0 z-10`)
- **Medewerker kolom**: Sticky left (`sticky left-0 z-10`)
- **Header hoek cel**: Sticky top + left (`z-20` voor layering)

#### Cel Afmetingen
- **Min breedte**: 60px per dagdeel cel
- **Hoogte**: 40px
- **Font size**: 13px (sm)

#### Hover States
- Lege cellen: `hover:bg-gray-50`
- Dienst cellen: `hover:opacity-80`
- NB cellen: `hover:bg-yellow-200`
- Geblokkeerde cellen: Geen hover (cursor-not-allowed)

### Performance Optimalisatie

1. **useMemo** voor weekGroups berekening
2. **useMemo** voor assignmentMap lookup (Map ipv array filter)
3. **useCallback** voor event handlers
4. **Efficient lookups**: O(1) via Map ipv O(n) via array.find()

### TypeScript Types

Alle types zijn gedefinieerd in `@/lib/types/preplanning.ts`:

```typescript
import { 
  PrePlanningAssignment, 
  EmployeeWithServices, 
  Dagdeel,
  CellStatus 
} from '@/lib/types/preplanning';
```

### Gebruik in client.tsx

```typescript
import PlanningGridDagdelen from './components/PlanningGridDagdelen';

// In component:
<PlanningGridDagdelen
  employees={employees}
  dateInfo={dateInfo}
  assignments={assignments}
  serviceColors={serviceColors}
  onCellClick={handleCellClick}
  readOnly={rosterStatus === 'final'}
/>
```

### Toekomstige Uitbreidingen (DRAAD 79)

In de volgende draad wordt de cel click handler gekoppeld aan een modal:

```typescript
function handleCellClick(employeeId: string, date: string, dagdeel: Dagdeel) {
  // Open DienstSelectieModal met:
  // - Huidige assignment (indien aanwezig)
  // - Beschikbare diensten voor medewerker
  // - Opties: Leeg, NB, of dienst kiezen
}
```

### Testing Checklist

✅ Grid toont 3 kolommen per datum (O/M/A)
✅ Week headers correct gegroepeerd
✅ Datum headers correct gegroepeerd
✅ Cellen tonen correct symbool per status
✅ Dienst cellen hebben correcte achtergrondkleur uit database
✅ Fallback kleur werkt (#3B82F6)
✅ Klik op cel triggert console.log (modal komt in DRAAD 79)
✅ Geblokkeerde cellen niet klikbaar
✅ Read-only mode werkt bij status='final'
✅ Sticky headers en columns werken
✅ Geen TypeScript fouten

---

## Volgende Stap: DRAAD 79

**Dienst Selectie Modal Component**
- Modal pop-up bij cel klik
- Lijst met beschikbare diensten voor medewerker
- Opties: Leeg, NB, of specifieke dienst
- Save functionaliteit naar database
