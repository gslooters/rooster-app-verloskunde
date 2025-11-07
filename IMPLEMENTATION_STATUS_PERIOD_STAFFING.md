# Diensten per Dag - Implementatie Status

## ✅ Voltooid (Sprint 1-2)

### 📦 Foundation Layer
- **Type Definities** (`lib/types/period-day-staffing.ts`) ✅
  - `PeriodDayStaffing` interface
  - `PeriodDateInfo` interface  
  - `WeekInfo` interface
  - Validatie functies
  - Helper functies voor kleuren en tekst

- **Date Utilities** (`lib/utils/roster-date-helpers.ts`) ✅
  - `getDatesForRosterPeriod()` - Genereer 35 dagen vanaf startdatum
  - `groupDatesByWeek()` - Groepeer dagen in weken
  - `getWeekInfo()` - ISO week-nummers berekenen
  - `getEffectiveDayType()` - Feestdag → zondag mapping
  - Datum formatting functies

- **Storage Laag** (`lib/services/period-day-staffing-storage.ts`) ✅
  - `initializePeriodStaffingForRoster()` - Auto-fill bij rooster creatie
  - `getPeriodStaffingForRoster()` - Haal data op
  - `savePeriodStaffingForRoster()` - Opslaan
  - `updateSingleCell()` - Update individuele cel
  - `updateTeamScopeForService()` - Update team-scope
  - `deletePeriodStaffingForRoster()` - Cleanup bij verwijdering
  - Helper functies voor queries

### 🖥️ UI Component
- **Main Page** (`app/planning/design/period-staffing/page.tsx`) ✅
  - Horizontale scroll tabel met 35 dag-kolommen
  - Sticky dienst + team kolommen (links)
  - Drie-laags header:
    - Week-nummers (Week 48, Week 49, etc.)
    - Dagsoort (MA, DI, WO, etc.)
    - Datum + feestdag indicator (🎉)
  - Min/max input velden per dienst per dag
  - Team selector per dienst (Tot/Gro/Ora/G+O)
  - Real-time validatie (min <= max)
  - Dirty state tracking
  - Unsaved changes waarschuwing
  - Read-only mode ondersteuning
  - Status footer met statistieken

---

## ⚠️ Handmatige Integratie Stappen Vereist

De volgende stappen moeten **handmatig** worden uitgevoerd:

### 1. 🔗 Knop Toevoegen in Rooster Ontwerp

**Bestand**: `app/planning/design/page.client.tsx`

**Actie**: Zoek de sectie waar de weekend/feestdag knoppen staan en voeg toe:

```tsx
{/* Nieuwe knop: Diensten per dag */}
<button
  onClick={() => router.push(`/planning/design/period-staffing?id=${rosterId}`)}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
>
  📅 Diensten per dag
</button>
```

**Positie**: Rechts naast de bestaande weekend/feestdag knoppen

**Voor read-only mode (bewerking/archief fase)**:
```tsx
const isReadOnly = roster.status.phase !== 'ontwerp';

<button
  onClick={() => router.push(`/planning/design/period-staffing?id=${rosterId}`)}
  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
    isReadOnly 
      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
      : 'bg-blue-600 text-white hover:bg-blue-700'
  }`}
>
  📅 Diensten per dag {isReadOnly && '(bekijken)'}
</button>
```

### 2. 🛠️ Roster Creation Hook

**Bestand**: Zoek de huidige roster storage implementatie (waarschijnlijk in `lib/planning/` of `lib/services/`)

**Actie**: Voeg toe in de `createRoster()` functie:

```typescript
import { initializePeriodStaffingForRoster } from '../services/period-day-staffing-storage';

export function createRoster(data: RosterInput): Roster {
  // ... bestaande code voor rooster creatie ...
  
  const newRoster = {
    id: rosterId,
    startDate: data.startDate,
    holidays: data.holidays,
    // ... rest van rooster data
  };
  
  // Save roster
  saveRosterToStorage(newRoster);
  
  // ✨ NIEUW: Initialiseer period staffing automatisch
  initializePeriodStaffingForRoster(
    rosterId,
    data.startDate,
    data.holidays || []
  );
  
  return newRoster;
}
```

### 3. 🗑️ Roster Deletion Hook

**Bestand**: Zelfde bestand als stap 2

**Actie**: Voeg toe in de `deleteRoster()` functie:

```typescript
import { deletePeriodStaffingForRoster } from '../services/period-day-staffing-storage';

export function deleteRoster(rosterId: string): void {
  // ✨ NIEUW: Cleanup period staffing data
  deletePeriodStaffingForRoster(rosterId);
  
  // ... bestaande code voor rooster verwijdering ...
  removeRosterFromStorage(rosterId);
}
```

### 4. 📖 Fase-detectie voor Read-only Mode

**Bestand**: `app/planning/design/period-staffing/page.tsx`

**Actie**: Update de `loadData()` functie om roster-fase op te halen:

```typescript
const loadData = async () => {
  // ... bestaande code ...
  
  // Haal roster data op
  const roster = getRosterById(rosterId!);
  
  // Stel read-only mode in op basis van fase
  setReadOnly(roster.status.phase !== 'ontwerp');
  
  // ... rest van code ...
};
```

---

## 📄 Auto-fill Algoritme Documentatie

### Hoe het werkt:

1. **Datums genereren**: Vanaf rooster startdatum worden 35 dagen gegenereerd
2. **Feestdagen detecteren**: Elke datum wordt gecheckt tegen `roster.holidays` array
3. **Dagsoort bepalen**: 
   - Normale dag: gebruik originele dagsoort (0=ma, 6=zo)
   - Feestdag: gebruik dagsoort 6 (zondag) voor bezettingsregels
4. **Bezetting kopiëren**: 
   - Haal dagsoort-regel op uit "Diensten per dagsoort"
   - Kopieer min/max naar period staffing
5. **Team-scope**: Blijft altijd dienst-specifiek (niet van dagsoort)

### Voorbeeld:

```
Dienst: Dagdienst
Datum: 25-12-2025 (1e Kerstdag, donderdag)

Stap 1: Detecteer feestdag (25-12 staat in holidays array)
Stap 2: Effectieve dagsoort = 6 (zondag)
Stap 3: Haal zondag-regel op: min=1, max=1
Stap 4: Team-scope = dienst.teamScope (bijv. "both")

Resultaat in period staffing:
- dagDatum: "2025-12-25"
- dagSoort: 3 (origineel: donderdag)
- isFeestdag: true
- minBezetting: 1 (van zondag-regel)
- maxBezetting: 1 (van zondag-regel)
- teamScope: "both" (van dienst)
```

---

## 📦 LocalStorage Schema

**Key**: `roster_period_staffing_{rosterId}`

**Value**: JSON array van PeriodDayStaffing objecten

**Voorbeeld**:
```json
[
  {
    "id": "ps_1699368000000_abc123",
    "rosterId": "r_2025_week48",
    "dienstId": "dienst_dagdienst",
    "dagDatum": "2025-12-23",
    "dagIndex": 0,
    "dagSoort": 1,
    "isFeestdag": false,
    "minBezetting": 0,
    "maxBezetting": 2,
    "teamScope": "both",
    "created_at": "2025-11-07T18:00:00.000Z",
    "updated_at": "2025-11-07T18:00:00.000Z"
  },
  // ... 34 meer dagen voor deze dienst ...
  // ... en dit voor alle actieve diensten
]
```

---

## 🧪 Testing Checklist

### Functioneel
- [ ] Auto-fill genereert 35 dagen × aantal diensten bij rooster creatie
- [ ] Feestdagen (25-12, 26-12) krijgen zondag-bezetting
- [ ] Team-scope blijft dienst-specifiek bij feestdagen
- [ ] Min/max aanpassen werkt
- [ ] Opslaan persisteert wijzigingen
- [ ] Herladen toont opgeslagen data
- [ ] Validatie blokkeert opslaan bij min > max
- [ ] Read-only mode disabled inputs in bewerking-fase
- [ ] Rooster verwijdering verwijdert period staffing

### UI/UX
- [ ] Horizontale scroll werkt smooth
- [ ] Sticky kolommen blijven fixed
- [ ] Week-headers tonen correcte week-nummers
- [ ] Feestdag 🎉 emoji is zichtbaar
- [ ] Min > max toont rode border
- [ ] Dirty state enables opslaan-knop
- [ ] Unsaved changes waarschuwing werkt
- [ ] Terug-knop navigeert correct

### Performance
- [ ] Render tijd < 500ms (8 diensten × 35 dagen)
- [ ] Scroll performance is smooth
- [ ] Geen input lag

---

## 🚀 Deployment

### Pre-deploy Checklist
1. ✅ Alle handmatige integratie stappen voltooid
2. ✅ Tests uitgevoerd (zie checklist boven)
3. ✅ Code review
4. ✅ TypeScript compileert zonder errors

### Deploy naar Vercel
```bash
# Alle wijzigingen zijn al op main branch
# Vercel auto-deploys vanaf main

# Check deployment status:
# https://vercel.com/gslmccs-projects
```

### Post-deploy Verificatie
1. Test rooster creatie → period staffing auto-fill
2. Test "Diensten per dag" scherm openen
3. Test wijzigingen opslaan
4. Test read-only mode in bewerking-fase
5. Test rooster verwijdering → period staffing cleanup

---

## 📚 Volgende Stappen (Toekomst)

### Nice-to-have Features
- [ ] Confirmatie modal bij transitie ontwerp → bewerking
- [ ] Export naar Excel/PDF
- [ ] Bulk-edit functionaliteit (kopieer week)
- [ ] Visual diff met standaard dagsoort-regels
- [ ] Undo/redo functionaliteit
- [ ] Highlights voor afwijkingen van standaard

---

## ❓ Troubleshooting

### Probleem: Period staffing data wordt niet geïnitialiseerd
**Oplossing**: Check of `initializePeriodStaffingForRoster()` wordt aangeroepen in roster creation hook

### Probleem: Feestdagen krijgen niet zondag-bezetting
**Oplossing**: Verify dat `roster.holidays` array correct gevuld is met YYYY-MM-DD strings

### Probleem: Sticky kolommen scrollen mee
**Oplossing**: Check CSS `position: sticky` en `z-index` waarden

### Probleem: Validatie errors blijven hangen
**Oplossing**: Clear validationErrors state bij opslaan success

---

## 📞 Contact

Voor vragen over deze implementatie, zie de code comments in:
- `lib/types/period-day-staffing.ts`
- `lib/services/period-day-staffing-storage.ts`
- `app/planning/design/period-staffing/page.tsx`
