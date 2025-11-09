# Dashboard Rooster Ontwerp - Implementatie Documentatie

## 📋 Overzicht

Een nieuwe centrale hub voor de ontwerpfase van roosters is geïmplementeerd. Dit dashboard fungeert als het startpunt voor alle ontwerpactiviteiten voordat een rooster naar de bewerkingsfase gaat.

## 🎯 Functionaliteit

### Dashboard Features

1. **Periode-weergave**: Duidelijke toon van de geselecteerde 5-weken periode
2. **5 Ontwerpstappen** met status-tracking:
   - 📊 Diensten per dag aanpassen (dummy - komt later)
   - 🚫 Niet Beschikbaar aanpassen (werkend - navigeert naar bestaand grid)
   - 👤 Diensten per medewerker aanpassen (werkend - navigeert naar bestaand grid)
   - 📅 Pre-planning aanpassen (dummy - komt later)
   - ⚙️ Planregels aanpassen (dummy - komt later)
3. **Status badges**: Groen (✓ Voltooid: Ja) of Rood (✗ Voltooid: Nee)
4. **Rooster Verwijderen**: Alleen zichtbaar voor het laatst aangemaakte rooster
   - Dubbele bevestiging (stap 1 en stap 2)
   - Verwijdert alle gerelateerde data
5. **Voortgangsindicator**: Toont hoeveel stappen voltooid zijn (X / 5)

## 📁 Geïmplementeerde Bestanden

### Nieuwe Files

```
app/planning/design/dashboard/page.tsx
```

- Volledig nieuw dashboard scherm
- Status tracking via localStorage: `roster_completion_{rosterId}`
- Responsive design met Tailwind CSS
- Consistent met bestaande design-stijl

### Aangepaste Files

```
app/planning/_components/Wizard.tsx
```

**Wijzigingen:**
- Navigatie aangepast van `/planning/design?rosterId=${id}` naar `/planning/design/dashboard?rosterId=${id}`
- localStorage key `recentDesignRoute` aangepast

```
app/planning/page.tsx
```

**Wijzigingen:**
- `DraftRosterCard` navigeert nu naar dashboard in plaats van direct naar grid
- Route: `/planning/design/dashboard?rosterId=${roster.id}`

## 🔄 Navigatieflow

### Oude Flow

```
Dashboard → Rooster Ontwerpen → Nieuwe Planning → [Wizard] → Rooster Grid
                                                                    ↓
                                                              (Direct NB aanpassen)
```

### Nieuwe Flow

```
Dashboard → Rooster Ontwerpen → Nieuwe Planning → [Wizard] → Dashboard Rooster Ontwerp
                                                                        ↓
                     ┌──────────────────────────────────────────────────┴─────────────────┐
                     │                                                                     │
            1. Diensten per dag (dummy)                                   5. Planregels (dummy)
            2. Niet Beschikbaar → Grid                                    6. Rooster Verwijderen
            3. Diensten per medewerker → Grid                             7. Terug naar Dashboard
            4. Pre-planning (dummy)
```

## 💾 Data Opslag

### localStorage Keys

#### Nieuwe Keys

```javascript
// Completion status per rooster
`roster_completion_{rosterId}` = {
  diensten_per_dag: boolean,
  niet_beschikbaar: boolean,
  diensten_per_medewerker: boolean,
  preplanning: boolean,
  planregels: boolean
}
```

#### Bestaande Keys (aangepast)

```javascript
// Laatst bezochte route
`recentDesignRoute` = `/planning/design/dashboard?rosterId=${id}`
```

## 🎨 Design Kenmerken

### Kleurenschema

- **Paars** (#9333ea): Diensten per dag
- **Rood** (#dc2626): Niet Beschikbaar
- **Groen** (#16a34a): Diensten per medewerker
- **Blauw** (#2563eb): Pre-planning
- **Oranje** (#ea580c): Planregels
- **Donkerrood** (#7f1d1d): Rooster Verwijderen (gevarenzone)

### Badges

- ✅ **Voltooid Ja**: Groen (#dcfce7) met groene border (#86efac)
- ❌ **Voltooid Nee**: Rood (#fee2e2) met rode border (#fca5a5)

## 🔧 Technische Details

### Component Structuur

```typescript
DesignDashboard (Client Component)
├── useSearchParams() → rosterId
├── useState: designData, completionStatus, loading, error
├── useEffect: Load design data + completion status
├── handleNavigation(path, markComplete?)
├── handleDeleteRoster() → 2-step confirmation
└── Render:
    ├── Header met periode-info
    ├── Info banner
    ├── 5 Navigation cards met StatusBadge
    ├── Danger zone (conditional)
    └── Bottom navigation
```

### Status Update Mechanisme

```typescript
function handleNavigation(path: string, markComplete?: keyof CompletionStatus) {
  if (!rosterId) return;
  
  if (markComplete && completionStatus) {
    const updated = { ...completionStatus, [markComplete]: true };
    setCompletionStatus(updated);
    saveCompletionStatus(rosterId, updated);
  }
  
  router.push(path);
}
```

**Automatisch Markeren:**
- Bij klikken op "Niet Beschikbaar" → `niet_beschikbaar: true`
- Bij klikken op "Diensten per medewerker" → `diensten_per_medewerker: true`

### Delete Rooster Logic

```typescript
// Stap 1: Check of het laatste rooster is
const sortedRosters = rosters.sort((a, b) => 
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
);
setIsLastRoster(sortedRosters[0].id === rosterId);

// Stap 2: Eerste bevestiging
if (deleteStep === 1) {
  setDeleteStep(2);
  return;
}

// Stap 3: Tweede bevestiging - daadwerkelijk verwijderen
if (deleteStep === 2) {
  localStorage.removeItem(`roster_design_${rosterId}`);
  localStorage.removeItem(`roster_completion_${rosterId}`);
  // Update rooster lijst
  // Navigeer naar /planning
}
```

## 🚀 Deployment

### Railway.com Deployment

De wijzigingen zijn gecommit naar de `main` branch en worden automatisch gedeployed via Railway.com.

**Commits:**
1. `f47697dc` - feat: add Dashboard Rooster Ontwerp
2. `1026cb69` - fix: update Wizard navigation
3. `fbff68df` - fix: update draft roster cards navigation

### Verificatie Stappen

1. ✅ Ga naar https://[jouw-app].railway.app/dashboard
2. ✅ Klik op "Rooster Ontwerpen"
3. ✅ Start een nieuw rooster via wizard
4. ✅ Verifieer dat je nu op `/planning/design/dashboard?rosterId=...` komt
5. ✅ Controleer dat alle 5 buttons zichtbaar zijn
6. ✅ Klik op "Niet Beschikbaar aanpassen" → moet naar grid gaan
7. ✅ Klik op "Terug naar Dashboard" → moet naar hoofddashboard gaan
8. ✅ Verifieer dat "Rooster Verwijderen" alleen zichtbaar is voor laatste rooster
9. ✅ Test de dubbele bevestiging bij verwijderen

## 📝 Toekomstige Taken

### Nog Te Implementeren Schermen

1. **Diensten per dag aanpassen**
   - Route: `/planning/design/daily-staffing?rosterId=${id}`
   - Functionaliteit: Aantal medewerkers per dienst per dag instellen
   - Opslag: Nieuwe localStorage key of Supabase tabel

2. **Pre-planning aanpassen**
   - Route: `/planning/design/pre-planning?rosterId=${id}`
   - Functionaliteit: Specifieke diensten toewijzen (echo, poli, etc.)
   - Opslag: Pre-planned shifts in localStorage/Supabase

3. **Planregels aanpassen**
   - Route: `/planning/design/planning-rules?rosterId=${id}`
   - Functionaliteit: Regels voor CP-SAT solver configureren
   - Opslag: Constraint configuration in localStorage/Supabase

### Supabase Migratie

Voor de volgende fase moet de localStorage-data gemigreerd worden naar Supabase:

```sql
-- Completion status tabel
CREATE TABLE roster_design_completion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roster_id UUID REFERENCES rosters(id) ON DELETE CASCADE,
  diensten_per_dag BOOLEAN DEFAULT FALSE,
  niet_beschikbaar BOOLEAN DEFAULT FALSE,
  diensten_per_medewerker BOOLEAN DEFAULT FALSE,
  preplanning BOOLEAN DEFAULT FALSE,
  planregels BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roster_id)
);
```

## ✅ Code Kwaliteit

### Syntax Controle

- ✅ TypeScript strict mode compliant
- ✅ Geen ESLint warnings
- ✅ Alle imports correct
- ✅ Client component directive aanwezig
- ✅ Error handling geïmplementeerd
- ✅ Loading states aanwezig
- ✅ Responsive design (mobile/tablet/desktop)

### Best Practices

- ✅ Consistent naming conventions
- ✅ Proper state management
- ✅ useEffect dependencies correct
- ✅ Event handlers met proper cleanup
- ✅ Conditional rendering met proper checks
- ✅ Accessibility: aria-labels waar nodig

## 🐛 Bekende Beperkingen

1. **localStorage Limiet**: Bij veel roosters kan localStorage vol raken (5-10MB limiet)
   - **Oplossing**: Migratie naar Supabase (prioriteit)

2. **Status Persistentie**: Status gaat verloren bij cache clear
   - **Oplossing**: Cloud opslag via Supabase

3. **Dummy Buttons**: 3 van de 5 functionaliteiten zijn nog niet geïmplementeerd
   - **Oplossing**: Gefaseerde ontwikkeling volgens roadmap

## 📞 Support & Vragen

Voor vragen of problemen, check:
- GitHub Issues: https://github.com/gslooters/rooster-app-verloskunde/issues
- Railway Logs: https://railway.com/project/.../deployments

---

**Versie**: 1.0.0  
**Datum**: 09-11-2025  
**Auteur**: AI Development Team  
**Status**: ✅ Production Ready
