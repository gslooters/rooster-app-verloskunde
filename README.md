# Rooster App Verloskunde

Een Next.js applicatie voor roosterplanning in de verloskunde praktijk.

---

## 📦 DEPLOYMENT STATUS

**Huidige deployment:** DRAAD-185 STAP 4 - Baseline Verification (15 dec 2025, 17:52 CET)  
**Status:** ✅ BOTH SERVICES BASELINE VERIFIED  
**Build verwachting:** ✅ Railway rebuild triggered  
**Next Phase:** STAP 5 - Differential Analysis

### 🔍 DRAAD-185 STAP 4 - Baseline Verification Complete (15 dec 2025)
- ✅ rooster-app-verloskunde service baseline verified
- ✅ Solver2 (Sequential Solver) service baseline verified
- ✅ Database schema validated against supabasetabellen.txt
- ✅ Soft Constraints Framework (SC1-SC6) verified operational
- ✅ Sequential Solver V2 with EVA4 iterative mode verified
- ✅ Cache-busting checkpoint created with Date.now() tokens
- ✅ Railway deployment trigger configured
- ✅ Completion report: .DRAAD-185-4-EXECUTION-COMPLETE.md

**Phase:** Baseline documentation complete  
**Services Status:** Both LIVE & OPERATIONAL  
**Code Quality:** All metrics verified  
**Next Step:** STAP 5 Differential Analysis  

---

**Vorige deployment:** DRAAD176 - Sequential Solver Data JOIN Fix (13 dec 2025, 14:49 CET)  
**Status:** ✅ LIVE ON MAIN

### 🔧 DRAAD176 - Sequential Solver JOIN Fix (13 dec 2025)
- ✅ Sequential Solver queried child tabel → Fixed to query parent table
- ✅ Missing 'date' field issue → Now has date from parent roster_period_staffing
- ✅ `row.get('date')` returned None → Now gets date from parent properly
- ✅ _parse_date(None) crashes → Now has defensive checks
- ✅ Requirements load from parent + nested JOIN of child dagdelen
- ✅ Cache-busting: DRAAD176 timestamp + random deployment token
- ✅ Railway rebuild trigger included
- ✅ Complete evaluation documentation added

**Problem:** Sequential Solver crashed with `'NoneType' object has no attribute 'split'`  
**Root Cause:** Queried roster_period_staffing_dagdelen (child) instead of roster_period_staffing (parent)  
**Solution:** Query parent table with nested select of children → date field now available  
**Status:** DEPLOYED TO MAIN - awaiting Railway rebuild  

---

**Vorige deployment:** DRAAD74 - Team Kleuren Fix via Employee Snapshot (28 nov 2025, 23:09 CET)  
**Status:** ✅ LIVE

### DRAAD74 - Team Kleuren Fix via Employee Snapshot
- ✅ RosterEmployee interface uitgebreid met team/voornaam/achternaam/dienstverband
- ✅ initializeRosterDesign vult team data in snapshot
- ✅ Team kleuren werken nu correct in UnavailabilityClient
- ✅ Groen/Oranje/Blauw bolletjes per team
- ✅ Debug logging voor team data verificatie
- ✅ Geen database migratie nodig (tabellen leeggemaakt)
- ✅ Cache-busting: draad74-team-data-snapshot-fix-1732833973

### DRAAD73 FIX - NB Scherm UI Verbeteringen
- ✅ Weeknummer weergave in header (Week X - Y)
- ✅ Compacte medewerkernamen (alleen voornaam)
- ✅ Teamkleur indicators verbeterd (groen/oranje/blauw)
- ✅ Legenda verplaatst naar footer (compact)
- ✅ Dubbele instructie-balk verwijderd
- ✅ Layout spacing verbeterd
- ✅ Console logs opgeschoond
- ✅ Force deployment fix: correcte commit nu live

### DRAAD40B5 Fixes
- ✅ Duplicate `TeamDagdeel` import verwijderd uit `WeekDagdelenClient.tsx`
- ✅ Single source of truth: `@/lib/types/week-dagdelen`
- ✅ TypeScript compiler errors opgelost
- ✅ Code quality check geslaagd

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

**Als verkeerde commit live staat:**
1. Overschrijf `.cachebust` met nieuwe timestamp + commit
2. Overschrijf `.railway-trigger` met nieuw random nummer
3. Voeg kleine wijziging toe aan README.md
4. Force rebuild via deze drie file changes
5. Verifieer build draait op correcte commit

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

solver/
├── sequential_solver_v2.py  # Sequential Solver - DRAAD176 fixed
└── ...

railway/
└── DRAAD185-stap4-deployment-trigger.env  # Railway rebuild trigger
```

## Features

### Bezettingsregels Configuratie
- Per dienst per dag minimum/maximum bezetting instellen
- Team-scope selectie per dienst
- Real-time validatie van regels
- Visual feedback voor actieve team-scope

### Sequential Solver (DRAAD176 + DRAAD185 Baseline)
- Deterministic sequential priority queue solver
- Loads requirements from parent table with proper date fields
- Correctly handles parent-child data relationships
- Defensive error handling with clear messages
- Sorts by 3-layer priority (dagdeel → service → team)
- EVA4 Mode: Iterative UPDATE+RE-READ workflow
- All 1470 assignments cached and tracked

### Soft Constraints Framework (DRAAD182 Integration)
- SC1: Service Preferences
- SC2: Even Distribution  
- SC3: Minimum Services (Non-relaxable)
- SC4: Seniority Levels
- SC5: Team Composition
- SC6: No Consecutive Duplicates
- Relaxation Priority Stack with 4 levels
- Planner Flexibility Options (A-D)

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
- **Solver Services**: 
  - rooster-app-verloskunde (Frontend + API)
  - Solver2 (Sequential Solver service - DRAAD176 deployed)

### Deployment Proces

1. Code wijzigingen committen naar `main` branch
2. Railway detecteert push via GitHub webhook
3. Railway start automatisch build proces
4. Bij succesvolle build: automatische deployment
5. Applicatie is live binnen 2-3 minuten

### DRAAD185 STAP 4 Deployment (Baseline Verification)

Speciale deployment instructies voor STAP 4:

1. **Cache Busting**: Included in `.cachebust` and `.cachebust-draad185-stap4`
2. **Force Rebuild**: New deployment token triggers fresh build
3. **Both Services**: rooster-app-verloskunde + Solver2 both verified
4. **Monitoring**: Check logs for successful baseline restoration

### Monitoring

- Railway Dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- Build logs beschikbaar in Railway dashboard
- Deploy status zichtbaar in GitHub commit
- Solver logs: Monitor for data load success indicators

## Development Notes

This project uses:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Supabase for database
- localStorage for local data persistence
- Component-based architecture
- Railway.app for hosting
- Python 3.10+ for Sequential Solver service
- Supabase Python client for database access

## Important Documentation

- **DRAAD-185-4 Execution Report**: [.DRAAD-185-4-EXECUTION-COMPLETE.md](./.DRAAD-185-4-EXECUTION-COMPLETE.md) - Baseline Verification Report
- **Route Mapping**: [ROUTE_MAPPING.md](./ROUTE_MAPPING.md) - Complete overzicht van alle routes
- **Critical Analysis**: [DRAAD36L_CRITICAL_ANALYSIS.md](./DRAAD36L_CRITICAL_ANALYSIS.md) - Lessons learned van route problemen
- **DRAAD176 Evaluation**: [docs/DRAAD176-EVALUATION.md](./docs/DRAAD176-EVALUATION.md) - Complete technical evaluation
- **Deployment Summary**: [DEPLOYMENT-SUMMARY-DRAAD176.md](./DEPLOYMENT-SUMMARY-DRAAD176.md) - Quick reference guide

## Recent Updates

### v2.7 - DRAAD-185 STAP 4 Baseline Verification (15 dec 2025)
- ✅ Both services baseline state verified
- ✅ Database schema validated
- ✅ Soft Constraints Framework (SC1-SC6) verified operational
- ✅ Sequential Solver V2 with EVA4 iterative mode verified
- ✅ Cache-busting with Date.now() tokens
- ✅ Railway deployment triggers configured
- ✅ Complete execution report: .DRAAD-185-4-EXECUTION-COMPLETE.md
- ✅ Ready for STAP 5 Differential Analysis

### v2.6 - DRAAD176 Sequential Solver JOIN Fix (13 dec 2025)
- ✅ Fixed Sequential Solver querying wrong table (child vs parent)
- ✅ Added parent table query with nested child JOIN
- ✅ Made _parse_date() defensive with None checks
- ✅ Cache-busting with Date.now() tokens
- ✅ Railway deployment triggers included
- ✅ Complete evaluation documentation
- ✅ Deployment ready for Solver2 service

### v2.5 - DRAAD74 Team Kleuren Fix (28 nov 2025)
- ✅ RosterEmployee uitgebreid met team/voornaam/achternaam/dienstverband
- ✅ Employee snapshot bevat nu team data
- ✅ Team kleuren werken correct in NB scherm
- ✅ Groen/Oranje/Blauw bolletjes per team
- ✅ Debug logging voor verificatie

### v2.4 - DRAAD73 FIX NB Scherm UI (28 nov 2025)
- ✅ Force deployment fix: correcte commit live
- ✅ Weeknummer weergave in header toegevoegd
- ✅ Compacte medewerkernamen (alleen voornaam)
- ✅ Teamkleur indicators verbeterd
- ✅ Legenda verplaatst naar footer
- ✅ Dubbele instructie verwijderd
- ✅ Layout en spacing verbeterd
- ✅ Console logs opgeschoond

### v2.3 - DRAAD40B5 TypeScript Fixes (20 nov 2025)
- ✅ Fixed duplicate `TeamDagdeel` type import
- ✅ Resolved TypeScript compiler errors
- ✅ Code quality verification complete
- ✅ Deployment ready

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
- [Python Supabase Client](https://supabase.com/docs/reference/python/introduction)
