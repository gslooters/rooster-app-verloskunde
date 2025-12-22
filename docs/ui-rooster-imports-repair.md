# UI Rooster Imports Repair - Analyse & Uitvoering

## Overzicht

Deze PR herstelt kapotte imports in de UI-rooster-bestanden, zonder wijzigingen aan het AFL-algoritme.

## Baseline Verificatie

Van de vorige threads geleerd:
- ✅ **AFL is puur backend-algoritme**: werkt op database (`rooster_assignments`, `roosters`, `roster_period_staffing_dagdelen`, etc.)
- ✅ **Bestaande rooster-storage.ts werkt**: bevat `readRosters()`, types, date helpers
- ✅ **UI-bestanden functioneel intact**: logica is gewenst, alleen imports kapot

## Gevonden Problemen

### Kapotte Imports (3 UI-bestanden)

| Bestand | Broken Import | Impact |
|---------|---------------|--------|
| `app/archived/page.tsx` | `@/lib/planning/storage` | Roosters ophalen voor archiefweergave |
| `app/employees/page.tsx` | `@/lib/services/employees-storage` | CRUD medewerkers |
| `app/employees/page.tsx` | `@/lib/types/employee` | Employee type definitions |
| `app/planning/PlanningGrid.tsx` | `@/styles/planning.css` | Grid styling |
| `app/planning/PlanningGrid.tsx` | `@/styles/compact-service.css` | Service badge styling |

## Gecre\u00eberde Oplossingen

### 1. Nieuwe Types: `src/lib/types/employee.ts`

```typescript
employee interface aligned with Supabase schema:
- voornaam, achternaam, email, telefoon
- dienstverband (Loondienst | Freelance | Beroepsbevolking)
- team (Groen | Oranje | Overig)
- aantalwerkdagen (0-35)
- roostervrijdagen: string[] (legacy: ["ma", "di", ...])
- structureel_nbh?: jsonb (NEW AP41 feature)

Helpers:
- getFullName(employee)
- getRosterDisplayName(employee)
- getStructureelNBHDescription(nbh)
- convertRoostervrijdagenToNBH(dagen)
- createEmployeeFromFormData(input)

Validators:
- validateAantalWerkdagen(n)
- validateRoostervrijDagen(dagen)
- normalizeRoostervrijDagen(dagen)

Constants:
- DIENSTVERBAND_OPTIONS
- TEAM_OPTIONS
- DAGEN_VAN_WEEK
- DAGBLOKKEN
```

### 2. Employee CRUD Service: `src/lib/services/employees-storage.ts`

```typescript
read-only & write operations:
- getAllEmployees(): Employee[]
- getEmployeeById(id): Employee | undefined
- createEmployee(input): Employee
- updateEmployee(id, input): Employee | undefined
- removeEmployee(id): boolean
- canDeleteEmployee(id): Promise<{ canDelete, reason }>
- searchEmployees(query): Employee[]
- getActiveEmployeeCount(): number
- getEmployeeCountByTeam(team): number

Opmerking: Gebruikt in-memory storage (kan later naar Supabase API gemigreerd)
```

### 3. CSS Styling Files

#### `src/styles/planning.css`
- 5-week rooster tabel layout
- Sticky headers & first column (medewerker namen)
- Weekend kolommen: rode achtergrond (#fee2e2)
- Week separators: grijze lijnen
- Responsive design (desktop, tablet, mobiel)
- Print-vriendelijke stijlen

#### `src/styles/compact-service.css`
- Service code badges (DG, NB, S, ZW)
- Kleurcodering per service type:
  - **DG** (Dag): blauw (#dbeafe)
  - **NB** (Nacht Bereik): paars (#e9d5ff)
  - **S** (Standby): oranje (#fed7aa)
  - **ZW** (Zwanger): grijs (#e5e7eb)
- Varianten: normal, filled, outline
- Responsive sizing (sm, lg variants)

## UI-Bestanden Hersteld

### 1. `app/archived/page.tsx`
- ✅ Import: `lib/planning/storage` (correct path)
- ✅ Functie: `readRosters()` via storage helper
- ✅ Filter: `status === 'final'` voor afgesloten roosters
- ✅ UI: ArchivedRosterCard component met week/datum formatting
- ✅ Logica intact: geen wijzigingen aan functionaliteit

### 2. `app/employees/page.tsx`
- ✅ Imports: `@/lib/services/employees-storage`, `@/lib/types/employee`
- ✅ Features:
  - Medewerkers lijst tonen (getAllEmployees)
  - Nieuwe medewerker toevoegen (createEmployee)
  - Bestaande wijzigen (updateEmployee)
  - Verwijderen met validatie (removeEmployee + canDeleteEmployee)
  - Roostervrijdagen selector
  - Team & dienstverband dropdowns
  - Validatie: voornaam, achternaam, aantalwerkdagen
- ✅ AP41 Support: structureel_nbh field in form
- ✅ Logica intact: alle CRUD operaties behouden

### 3. `app/planning/PlanningGrid.tsx`
- ✅ CSS imports: `@/styles/planning.css`, `@/styles/compact-service.css`
- ✅ Features:
  - 5-week rooster tabel (35 dagen)
  - Medewerkers als rijen
  - Dagen als kolommen met week separators
  - Service badges per cel
  - Weekend highlighting
  - Responsive layout
  - Click handlers voor cell editing
- ✅ Logica intact: geen wijzigingen aan grid rendering

## AFL-Scheiding Bevestigd

✅ **Geen AFL-code verplaatst naar UI-bestanden**
✅ **Geen wijzigingen aan `src/lib/afl/*` modules**
✅ **UI spreekt NIET direct met AFL algoritmes**
✅ **Data flow**: Database (Supabase) ← → UI & AFL onafhankelijk

## Testing Checklist

- [ ] Deploy branch naar Railway
- [ ] Test archiefpagina: roosters met status `final` tonen
- [ ] Test medewerkerpagina:
  - [ ] Lijst tonen
  - [ ] Nieuw toevoegen
  - [ ] Bewerken
  - [ ] Verwijderen (met validatie)
  - [ ] Roostervrijdagen selector werkt
- [ ] Test PlanningGrid:
  - [ ] 5-week layout correct
  - [ ] Weekend kolommen rood
  - [ ] Service badges tonen
  - [ ] Responsive op tablet
  - [ ] Print-preview werkt
- [ ] Controleer AFL:
  - [ ] Rooster draft → in_progress nog steeds
  - [ ] rooster_assignments vult correct
  - [ ] Geen console errors na UI changes

## Commit History

1. **Commit 1**: Types & helpers (`src/lib/types/employee.ts`)
2. **Commit 2**: Employee CRUD service (`src/lib/services/employees-storage.ts`)
3. **Commit 3**: CSS styling (`src/styles/planning.css`, `src/styles/compact-service.css`)
4. **Commit 4**: UI imports repair (`app/archived/page.tsx`, `app/employees/page.tsx`, `app/planning/PlanningGrid.tsx`)
5. **Commit 5**: Documentation (this file)

## Next Steps

1. ✅ Create PR to main
2. ⏳ Deploy preview to Railway
3. ⏳ Run full test suite
4. ⏳ Merge to main
5. ⏳ Deploy to production

## Technische Notes

- **In-memory storage**: `employees-storage.ts` uses in-memory DB (can be migrated to Supabase)
- **Type safety**: Full TypeScript support throughout
- **Responsive**: All CSS follows mobile-first approach
- **Accessibility**: Form labels, keyboard navigation, color contrast
- **Print-friendly**: CSS optimized for PDF export
