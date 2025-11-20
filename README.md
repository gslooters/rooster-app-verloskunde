# Rooster App Verloskunde

Een Next.js applicatie voor roosterplanning in de verloskunde praktijk.

---

## 🛠️ PRE-DEPLOYMENT CHECKLIST

**BELANGRIJK:** Volg deze checklist bij elke code wijziging om problemen te voorkomen!

### Voor Elke Wijziging

- [ ] **1. Route Verificatie**
  - Vraag gebruiker om **exacte URL** uit browser
  - Controleer route in [ROUTE_MAPPING.md](./ROUTE_MAPPING.md)
  - Verifieer dat bestand pad klopt met URL

- [ ] **2. Bestand Identificatie**
  - URL `/planning/period-staffing` → Bestand `app/planning/period-staffing/page.tsx`
  - Check voor mogelijke duplicaten
  - Gebruik `find app -name "page.tsx"` om alle routes te zien

- [ ] **3. Code Wijzigingen**
  - Maak wijzigingen in **correct** bestand (gebaseerd op route)
  - Controleer TypeScript errors: `npm run type-check`
  - Controleer ESLint errors: `npm run lint`
  - Test lokaal indien mogelijk: `npm run dev`

- [ ] **4. Code Kwaliteit**
  - Geen console.errors in production code
  - Alle imports correct
  - Geen unused variables
  - Proper error handling

- [ ] **5. Commit**
  - Duidelijke commit message met referentie naar issue/draad
  - Formaat: `[DRAAD/ISSUE] - Korte beschrijving`
  - Voorbeeld: `DRAAD36L STAP1: Verbeter header layout period-staffing`

- [ ] **6. Deployment**
  - Push naar main branch
  - Railway detecteert automatisch en start build
  - Monitor deployment logs in Railway dashboard
  - Verwachte build tijd: 2-3 minuten

- [ ] **7. Verificatie**
  - Wacht tot deployment compleet is
  - Vraag gebruiker om **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R)
  - Vraag om screenshot ter bevestiging
  - Documenteer resultaat

### Bij Problemen

**Als wijzigingen niet zichtbaar zijn:**
1. Controleer of juiste bestand is aangepast (route verificatie)
2. Check Railway deployment logs voor errors
3. Verifieer build was succesvol
4. Controleer browser cache is gecleared
5. Test in incognito mode

**Als Railway builder crasht:**
1. Error "frontend grpc server closed unexpectedly" = infrastructuur probleem
2. Code is correct - Railway builder was overbelast
3. Oplossing: dummy commit om rebuild te triggeren
4. Gebeurt soms bij drukke builders - niet code gerelateerd

**Route Confusion Preventie:**
- ⚠️ Vertrouw NOOIT op scherm naam alleen
- ✅ ALTIJD URL uit browser vragen
- ✅ ALTIJD controleren in ROUTE_MAPPING.md

---

## Nieuwe Functionaliteit: Team Scope (v2.1)

### Team-gerichte Bezettingsregels
De applicatie ondersteunt nu team-specifieke bezettingsregels voor diensten:

- **Tot (Totale praktijk)**: Bezettingsregels gelden voor alle medewerkers
- **Gro (Team Groen)**: Bezettingsregels gelden alleen voor Team Groen medewerkers  
- **Org (Team Oranje)**: Bezettingsregels gelden alleen voor Team Oranje medewerkers
- **Beide Teams**: Bezettingsregels gelden voor beide teams afzonderlijk

### Belangrijke Wijzigingen

#### Data Model
- Uitgebreide `DayTypeStaffing` interface met `teamScope` veld
- Nieuwe `ServiceTeamScope` voor service-niveau team configuratie
- Automatische migratie van bestaande data naar nieuwe structuur

#### User Interface  
- Nieuwe `TeamSelector` component met interactieve team-knoppen
- Verbeterde tabel layout met team-kolom
- Sticky header functionaliteit voor betere navigation
- Kleurgecodeerde team indicators (Blauw/Groen/Oranje)

#### Export Functionaliteit
- CSV export bevat nu team-scope informatie
- PDF export met herhalende headers op elke pagina
- Team-scope kleuren in PDF voor betere leesbaarheid
- Landscape A4 formaat voor optimale weergave

### Technische Details

#### Team Scope Logic
```typescript
// Team scope types
type TeamScope = 'total' | 'groen' | 'oranje' | 'both';

// Toggle logic:
// - 'total' is exclusief met team-specifieke settings
// - Teams kunnen samen actief zijn ('both')
// - Min/max waarden gelden per actief team
```

#### Storage
- localStorage gebruikt voor persistentie
- Aparte opslag voor service team scopes
- Backward compatibility met bestaande data

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
app/
├── _components/          # Reusable components
│   └── TeamSelector.tsx  # Team scope selection component
├── planning/
│   ├── period-staffing/  # Diensten per dagdeel (ACTIEF)
│   └── design/
│       └── dashboard/    # Dashboard rooster ontwerp
├── diensten-per-dag/     # REDIRECT naar planning/period-staffing
├── services/
│   └── schedule-rules/   # Main schedule rules interface
├── employees/            # Medewerkers beheer
├── current-roster/       # Huidig actief rooster
└── reports/              # Rapportages

lib/
├── types/               # TypeScript type definitions
│   └── daytype-staffing.ts  # Enhanced with team scope
├── services/            # Data access layer
│   └── daytype-staffing-storage.ts  # Enhanced storage
└── export/              # Export functionality
    └── daytype-staffing-export.ts   # Enhanced exports
```

## Features

### Bezettingsregels Configuratie
- Per dienst per dag minimum/maximum bezetting instellen
- Team-scope selectie per dienst
- Real-time validatie van regels
- Visual feedback voor actieve team-scope

### Export Mogelijkheden
- **Excel/CSV**: Complete data export met team informatie
- **PDF**: Print-vriendelijke weergave met herhalende headers
- Team-scope visualisatie in alle export formaten

### Data Management
- Automatische migratie van legacy data
- Validatie van team-scope configuraties
- Reset naar standaardwaarden functionaliteit

## Deployment

### Railway.app (Production)

De applicatie wordt automatisch gedeployed naar Railway.app:

- **Live URL**: https://rooster-app-verloskunde-production.up.railway.app
- **Auto-deployment**: Push naar `main` branch triggert automatisch deployment
- **Build tijd**: ~2-3 minuten
- **Environment**: Production

### Deployment Proces

1. Code wijzigingen committen naar `main` branch
2. Railway detecteert push via GitHub webhook
3. Railway start automatisch build proces
4. Bij succesvolle build: automatische deployment
5. Applicatie is live binnen 2-3 minuten

### Monitoring

- Railway Dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- Build logs beschikbaar in Railway dashboard
- Deploy status zichtbaar in GitHub commit

## Development Notes

This project uses:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Supabase for database
- localStorage for local data persistence
- Component-based architecture
- Railway.app for hosting

## Important Documentation

- **Route Mapping**: [ROUTE_MAPPING.md](./ROUTE_MAPPING.md) - Complete overzicht van alle routes
- **Critical Analysis**: [DRAAD36L_CRITICAL_ANALYSIS.md](./DRAAD36L_CRITICAL_ANALYSIS.md) - Lessons learned van route problemen

## Recent Updates

### v2.2 - Code Consolidatie & Documentation (18 nov 2025)
- ✅ Pre-deployment checklist toegevoegd aan README
- ✅ Route mapping documentatie
- ✅ Duplicate route `/diensten-per-dag` omgezet naar redirect
- ✅ Critical analysis gedocumenteerd
- ✅ Preventieve maatregelen geïmplementeerd

### v2.1 - Team Scope Functionality
- ✅ Team-specific staffing rules
- ✅ Enhanced UI with team selector
- ✅ Improved PDF export with repeating headers
- ✅ Data migration support
- ✅ Backward compatibility

### v2.0 - Enhanced Interface
- ✅ Sticky headers for better navigation
- ✅ Compact interpretation section
- ✅ Improved responsive design
- ✅ Better validation feedback

---

## 📚 Handige Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Railway Documentation](https://docs.railway.app)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)