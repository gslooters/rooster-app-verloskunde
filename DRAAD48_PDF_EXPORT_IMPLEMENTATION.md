# DRAAD48: PDF Export Diensten per Dagdeel Aanpassen

## 🎯 Doelstelling
Implementatie van PDF export functionaliteit voor het scherm "Diensten per Dagdeel Aanpassen" om planners een overzicht te geven van te plannen diensten per team, per datum, per dagdeel.

## 📅 Implementatie Details

### Deployment Informatie
- **Datum**: 24 november 2025, 14:58 CET
- **Status**: ✅ GEÏMPLEMENTEERD EN GEDEPLOYED
- **Commits**: 4 nieuwe commits
- **Railway**: Automatisch gedeployed via GitHub trigger

## 📦 Nieuwe Bestanden

### 1. API Endpoint
**Bestand**: `app/api/planning/service-allocation-pdf/route.ts`

**Functionaliteit**:
- Haalt rooster informatie op
- Voert complexe query uit op `roster_period_staffing_dagdelen`
- Groepeert data per datum → team → dagdeel
- Retourneert gestructureerde JSON voor PDF generatie

**SQL Query Basis**:
```sql
SELECT 
  rps.date AS datum,
  rpsd.team,
  rpsd.dagdeel,
  st.code AS dienstcode,
  rpsd.status,
  rpsd.aantal
FROM roster_period_staffing_dagdelen rpsd
JOIN roster_period_staffing rps ON rpsd.roster_period_staffing_id = rps.id
LEFT JOIN service_types st ON rps.service_id = st.id
WHERE rps.roster_id = $1
  AND rpsd.aantal > 0
ORDER BY rps.date, rpsd.team, rpsd.dagdeel
```

### 2. PDF Generator Library
**Bestand**: `lib/pdf/service-allocation-generator.ts`

**Technologie**: 
- jsPDF v2.5.1
- jspdf-autotable v3.8.2

**Features**:
- A4 Landscape formaat (297mm x 210mm)
- Marges: 2cm (20mm) aan alle kanten
- Automatische paginering (1 week per pagina)
- Herhalende header op elke pagina
- Footer met print timestamp

**Layout per pagina**:
```
┌─────────────────────────────────────────────────────┐
│ Te plannen diensten per team: Periode van ... tm ...│  ← Header (vet, 16pt)
│ Week XX                                              │  ← Weeknummer (12pt)
│                                                      │
│ Maandag, 24 november 2025                           │  ← Datum header (11pt, vet)
│ ┌─────────┬──────────────┬──────────────┬─────────┐│
│ │ Team    │ Ochtend      │ Middag       │ Avond/  ││
│ │         │              │              │ Nacht   ││
│ ├─────────┼──────────────┼──────────────┼─────────┤│
│ │ Groen   │ DDA 🟢 2    │ DDM 🔴 1    │ ...     ││
│ │ Oranje  │ ...          │ ...          │ ...     ││
│ │ Praktijk│ ...          │ ...          │ ...     ││
│ └─────────┴──────────────┴──────────────┴─────────┘│
│                                                      │
│ Dinsdag, 25 november 2025                           │
│ [volgende tabel]                                     │
│                                                      │
│ print: 24/11/2025 14:58:30          ← Footer (8pt) │
└─────────────────────────────────────────────────────┘
```

**Status Indicators**:
- 🔴 MOET (rood cirkel)
- 🟢 MAG (groen cirkel)
- 🔵 AANGEPAST (blauw cirkel)

**Cel Format**:
```
DDA 🟢 2  DDM 🔴 1  DIA 🔵 3
[CODE] [STATUS] [AANTAL in vet]
```

### 3. Frontend Update
**Bestand**: `app/planning/service-allocation/page.tsx`

**Nieuwe Features**:
- PDF export button rechts boven (zoals gevraagd)
- Loading spinner tijdens PDF generatie
- Error handling met duidelijke foutmeldingen
- Download naar eigen drive van gebruiker

**User Flow**:
1. Gebruiker opent scherm "Diensten per Dagdeel Aanpassen"
2. Klik op "PDF export gehele rooster (5 weken)" button
3. Spinner: "PDF wordt gegenereerd..."
4. Data wordt opgehaald via API
5. PDF wordt gegenereerd client-side
6. Browser download dialog verschijnt
7. Gebruiker kan locatie kiezen en opslaan

## 📋 Data Mapping

### Teams (altijd 3)
| Code | Label    |
|------|----------|
| GRO  | Groen    |
| ORA  | Oranje   |
| TOT  | Praktijk |

### Dagdelen
| Code | Label       |
|------|-----------|
| O    | Ochtend     |
| M    | Middag      |
| A    | Avond/Nacht |

### Status
| Waarde    | Indicator | Betekenis           |
|-----------|-----------|---------------------|
| MOET      | 🔴        | Verplichte dienst   |
| MAG       | 🟢        | Optionele dienst    |
| AANGEPAST | 🔵        | Handmatig gewijzigd |

## 🔄 Data Flow

```
[User clicks PDF button]
         ↓
[Frontend: service-allocation/page.tsx]
         ↓
[API Call: /api/planning/service-allocation-pdf?rosterId=X]
         ↓
[Backend: Supabase queries]
  - roosters (rooster info)
  - roster_period_staffing_dagdelen (JOIN)
  - roster_period_staffing (dates)
  - service_types (codes)
         ↓
[Data Grouping: date → team → dagdeel → services[]]
         ↓
[Return JSON to frontend]
         ↓
[PDF Generator: generateServiceAllocationPDF()]
  - Group by week
  - One page per week
  - Tables for each date
  - Format cells with status emojis
         ↓
[Download: Browser save dialog]
```

## 🧪 Testing Checklist

### Functioneel
- [x] PDF button zichtbaar rechts boven
- [x] Loading spinner tijdens generatie
- [x] Error message bij geen data
- [x] Download werkt naar eigen drive
- [ ] Test met echte rooster data (Week 48-52)
- [ ] Verifieer status kleuren in PDF
- [ ] Check cel formatting met meerdere diensten
- [ ] Test paginering over 5 weken

### Visueel
- [ ] A4 Landscape formaat correct
- [ ] Marges 2cm aan alle kanten
- [ ] Header vet en groot
- [ ] Footer klein links onder
- [ ] Status emojis zichtbaar en correct
- [ ] Tabel layout overzichtelijk
- [ ] Geen text overflow in cellen

### Edge Cases
- [x] Geen data → foutmelding
- [ ] Veel diensten per cel → wrapping binnen cel
- [ ] Weekend dagen → zelfde layout als weekdagen
- [ ] Meerdere pagina's → header herhaling

## ⚠️ Known Issues / Future Improvements

### Huidige Beperkingen
1. **Emoji rendering**: Afhankelijk van font support in browser/PDF viewer
   - Alternatief: Gebruik gekleurde vierkantjes i.p.v. emojis
   
2. **Cel overflow**: Bij heel veel diensten kan cel vol raken
   - Oplossing: Font size dynamisch aanpassen
   
3. **Supabase JOIN limitatie**: Complexe queries via client kunnen traag zijn
   - Alternatief: RPC function in Supabase voor betere performance

### Future Enhancements
1. Filter op specifieke weken (niet altijd alle 5)
2. Export naar Excel (XLSX) naast PDF
3. Print preview in browser voor aanpassing
4. Customizable marges en font sizes
5. Logo/branding toevoegen aan header

## 🔧 Maintenance

### Database Dependencies
Let op bij wijzigingen aan:
- `roster_period_staffing_dagdelen` (team, dagdeel, status, aantal)
- `roster_period_staffing` (date, roster_id, service_id)
- `service_types` (code)
- `roosters` (start_date, end_date, naam)

### Code Locaties
- API: `app/api/planning/service-allocation-pdf/route.ts`
- PDF Gen: `lib/pdf/service-allocation-generator.ts`
- Frontend: `app/planning/service-allocation/page.tsx`

## 🚀 Deployment

### GitHub Commits
1. `a459f27` - API endpoint created
2. `10d1e5f` - PDF generator library created
3. `243c66d` - Frontend updated with PDF functionality
4. `ce86605` - Railway deployment triggered

### Railway Auto-Deploy
Railway detecteert automatisch nieuwe commits op `main` branch en start deployment.
Geen manual actions nodig.

### Verify Deployment
1. Check Railway dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Test URL: https://[your-app].railway.app/planning/service-allocation?rosterId=[test-id]
3. Klik op PDF export button
4. Controleer gegenereerde PDF

## 📝 Changelog

### v1.0.0 - 2025-11-24
**Added**:
- PDF export functionaliteit voor diensten per dagdeel
- API endpoint voor gestructureerde data ophaling
- PDF generator met jsPDF + autotable
- Status indicators met emoji's
- Week grouping en paginering
- Error handling en loading states
- Download naar eigen drive functionaliteit

**Technical**:
- A4 Landscape layout
- Automatische paginering (1 week/pagina)
- Herhalende headers
- Footer met timestamp
- Client-side PDF generatie

---

**Geïmplementeerd door**: AI Assistant (Claude)
**Datum**: 24 november 2025
**Prioriteit**: NU ✅
**Status**: DEPLOYED EN KLAAR VOOR TESTING
