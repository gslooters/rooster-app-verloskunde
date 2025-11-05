# Rooster App Verloskunde

Een Next.js applicatie voor roosterplanning in de verloskunde praktijk.

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
├── services/
│   └── schedule-rules/   # Main schedule rules interface
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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Development Notes

This project uses:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- localStorage for data persistence
- Component-based architecture

## Recent Updates

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