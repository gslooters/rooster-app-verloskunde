# OPDRACHT: AFL Rapport Uitbreiding - Ontbrekende Diensten Detail + PDF Export

**Datum:** 13 januari 2026  
**Project:** Rooster-app Verloskunde  
**Repository:** https://github.com/gslooters/rooster-app-verloskunde  
**Deployment:** Railway (https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f)  

---

## Samenvatting

Het AFL-rapport toont nu een samenvatting met totalen (8 ontbrekende diensten), maar mist een **detailoverzicht** van welke specifieke diensten nog niet zijn ingevuld. Deze opdracht breidt het AFL-rapport uit met:

1. **Detailoverzicht ontbrekende diensten** - gegroepeerd per dag met dagdeel/team/dienstcode
2. **PDF export functionaliteit** - via browser print-to-PDF functie met vaste kopregel

---

## Context & Huidige Situatie

### Wat werkt nu

- AFL-rapport modal toont bezettingsgraad, aantal ingeplande diensten, en totaal aantal ontbrekende diensten
- Het getal "8 diensten" komt uit de database en klopt precies
- Rapport is al PDF-vriendelijk gestyled (geen animaties, goede kleuren)
- Component: `components/afl/AflReportModal.tsx`

### Screenshot AFL Rapport (huidig)

```
┌─────────────────────────────────────────────────────┐
│  ✅ Optimaal bezet                                  │
│                                                     │
│  BEZETTINGSGRAAD    DIENSTEN INGEPLAND   NOG IN TE │
│       96.4%              212                8       │
│  van benodigd        van 220           diensten    │
└─────────────────────────────────────────────────────┘
│  ⚠️ Waarschuwingen & Opmerkingen                   │
│  ⚠ 8 diensten zijn nog niet ingevuld (3.6%)        │
└─────────────────────────────────────────────────────┘
│  📉 Nog In Te Vullen Diensten                      │
│  Er zijn 8 diensten nog in te vullen:              │
│  [totalen en voortgangsbalk]                       │
└─────────────────────────────────────────────────────┘
```

**Wat ontbreekt:** De specifieke lijst van welke 8 diensten (datum, dagdeel, team, dienstcode)

---

## Database Query - Ontbrekende Diensten

### SQL Query (reeds gevalideerd)

```sql
WITH staffing AS (
  SELECT
    rpsd.date,
    rpsd.dagdeel,
    rpsd.team,
    st.code AS dienst_code,
    COALESCE(rpsd.aantal, 0)    AS benodigd,
    COALESCE(rpsd.invulling, 0) AS ingepland
  FROM roster_period_staffing_dagdelen rpsd
  JOIN service_types st
    ON st.id = rpsd.service_id
  WHERE rpsd.roster_id = '29ef7f1f-e10b-4f2d-b766-abbcf906b99f'
)
SELECT
  date,
  dagdeel,
  team,
  dienst_code,
  (benodigd - ingepland) AS ontbrekend_aantal
FROM staffing
WHERE (benodigd - ingepland) > 0
ORDER BY date, dagdeel, team, dienst_code;
```

### Resultaat (8 rijen)

| date       | dagdeel | team | dienst_code | ontbrekend_aantal |
|------------|---------|------|-------------|-------------------|
| 2025-11-26 | M       | ORA  | MSP         | 1                 |
| 2025-12-02 | O       | TOT  | SWZ         | 1                 |
| 2025-12-10 | M       | TOT  | GRB         | 1                 |
| 2025-12-16 | O       | TOT  | SWZ         | 1                 |
| 2025-12-17 | M       | TOT  | GRB         | 1                 |
| 2025-12-19 | O       | TOT  | ECH         | 1                 |
| 2025-12-23 | O       | TOT  | SWZ         | 1                 |
| 2025-12-24 | M       | TOT  | GRB         | 1                 |

**✅ Dit is GOED - query is correct en gevalideerd**

---

## Specificaties Uitbreiding

### 1. Detailoverzicht Ontbrekende Diensten

#### Data bron
- **Actuele stand aan het einde van AFL** (niet live, maar snapshot)
- Parameter: `roster_id` (uit AFL execution result)
- Query uitvoeren bij laden van het AFL rapport

#### Groepering & Weergave
- **Groepering:** Per dag, met subtotalen per dag
- **Sortering:** Datum oplopend, binnen dag: dagdeel (M→O→N), dan team, dan dienstcode
- **Formaat:**

```
📅 Maandag 26 november 2025 (1 dienst)
  ├─ Ochtend (M) │ Team ORA │ MSP │ 1 nodig

📅 Maandag 2 december 2025 (1 dienst)
  ├─ Avond (O) │ Team TOT │ SWZ │ 1 nodig

📅 Dinsdag 10 december 2025 (1 dienst)
  ├─ Ochtend (M) │ Team TOT │ GRB │ 1 nodig

... etc.
```

#### Lege staat
Als er **geen** ontbrekende diensten zijn:
```
✅ Alle diensten zijn ingevuld!
Geen nog in te vullen diensten - het rooster is compleet.
```

#### UI Styling
- Gebruik bestaande Tailwind kleuren en stijl
- Kleurcodering dagdelen:
  - **M** (ochtend): 🌅 amber/yellow
  - **O** (avond): 🌆 orange
  - **N** (nacht): 🌙 indigo/blue
- Toon dienstcode in badge (rounded, colored)
- Leesbaarheid op papier/PDF is prioriteit

### 2. PDF Export Functionaliteit

#### Methode
- **Browser print-to-PDF** (via `window.print()`)
- **GEEN** server-side rendering (keep it simple)

#### Print Styling
- Verberg navigatie/knoppen bij printen (`@media print`)
- Toon vaste kopregel met:
  - Organisatienaam/logo (optioneel)
  - Roosterperiode (start - eind datum)
  - AFL Run ID
  - Generatiedatum & tijd
- Break-before/after voor secties (page breaks)
- Zorg dat tabel niet over pagina's splitst (grouping intact)

#### Export Knop
- **Positie:** Footer van modal, naast "Terug" knop
- **Tekst:** "📄 Exporteer naar PDF" of "🖨️ Afdrukken"
- **Actie:** `window.print()` met print stylesheet actief

#### Print CSS Voorbeeld
```css
@media print {
  /* Verberg knoppen */
  button, .no-print { display: none !important; }
  
  /* Vaste kopregel */
  .print-header {
    position: fixed;
    top: 0;
    width: 100%;
    background: white;
    border-bottom: 2px solid #333;
    padding: 10mm;
  }
  
  /* Voorkom page breaks binnen groepen */
  .day-group {
    page-break-inside: avoid;
  }
  
  /* Marges */
  @page {
    margin: 20mm;
  }
}
```

---

## Technische Aanpak

### Stap 1: Backend - API Endpoint voor Ontbrekende Diensten

**Bestand:** `src/app/api/afl/missing-services/route.ts` (NIEUW)

**Endpoint:** `POST /api/afl/missing-services`

**Input:**
```json
{
  "roster_id": "29ef7f1f-e10b-4f2d-b766-abbcf906b99f"
}
```

**Output:**
```json
{
  "success": true,
  "roster_id": "29ef7f1f-e10b-4f2d-b766-abbcf906b99f",
  "total_missing": 8,
  "missing_services": [
    {
      "date": "2025-11-26",
      "dagdeel": "M",
      "team": "ORA",
      "dienst_code": "MSP",
      "ontbrekend_aantal": 1
    },
    ... 7 more items
  ],
  "grouped_by_date": {
    "2025-11-26": {
      "date_formatted": "Dinsdag 26 november 2025",
      "total_missing": 1,
      "services": [ ... ]
    },
    "2025-12-02": { ... },
    ...
  }
}
```

**Implementatie:**
1. Ontvang `roster_id` uit request body
2. Voer SQL query uit (zie boven)
3. Groupeer resultaten per datum
4. Format datum naar Nederlandse weergave
5. Return JSON response

### Stap 2: Frontend - Data Ophalen & State Management

**Bestand:** `components/afl/AflReportModal.tsx` (UPDATE)

**Wijzigingen:**
1. Voeg `useState` toe voor missing services data
2. Voeg `useEffect` toe om data te fetchen bij modal open
3. Loading state tijdens fetch
4. Error handling

**Code Voorbeeld:**
```typescript
const [missingServices, setMissingServices] = useState<any>(null);
const [loadingMissing, setLoadingMissing] = useState(true);

useEffect(() => {
  if (isOpen && reportData?.rosterId) {
    fetchMissingServices(reportData.rosterId);
  }
}, [isOpen, reportData?.rosterId]);

async function fetchMissingServices(rosterId: string) {
  setLoadingMissing(true);
  try {
    const response = await fetch('/api/afl/missing-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster_id: rosterId })
    });
    const data = await response.json();
    setMissingServices(data);
  } catch (error) {
    console.error('Error fetching missing services:', error);
  } finally {
    setLoadingMissing(false);
  }
}
```

### Stap 3: Frontend - UI Component voor Detail Overzicht

**Locatie in Modal:** Na sectie "Nog In Te Vullen Diensten" (vervang of uitbreiden)

**Component Structuur:**
```tsx
{/* Detailoverzicht Ontbrekende Diensten */}
<div className="space-y-3">
  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
    📋 Detailoverzicht Ontbrekende Diensten
  </h3>
  
  {loadingMissing ? (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="text-gray-600 mt-4">Laden...</p>
    </div>
  ) : missingServices?.total_missing === 0 ? (
    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
      <CheckCircle2 size={32} className="mx-auto text-green-600 mb-2" />
      <p className="text-lg font-semibold text-green-800">
        Alle diensten zijn ingevuld!
      </p>
    </div>
  ) : (
    <div className="space-y-4">
      {Object.entries(missingServices?.grouped_by_date || {}).map(([date, dayData]: [string, any]) => (
        <div key={date} className="day-group bg-white border-2 border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900">
              📅 {dayData.date_formatted}
            </h4>
            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              {dayData.total_missing} {dayData.total_missing === 1 ? 'dienst' : 'diensten'}
            </span>
          </div>
          
          <div className="space-y-2">
            {dayData.services.map((service: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 pl-4 py-2 border-l-4 border-blue-400">
                <span className={`px-3 py-1 rounded text-sm font-semibold ${
                  service.dagdeel === 'M' ? 'bg-yellow-100 text-yellow-800' :
                  service.dagdeel === 'O' ? 'bg-orange-100 text-orange-800' :
                  'bg-indigo-100 text-indigo-800'
                }`}>
                  {service.dagdeel === 'M' ? '🌅 Ochtend' :
                   service.dagdeel === 'O' ? '🌆 Avond' :
                   '🌙 Nacht'}
                </span>
                <span className="text-gray-700">Team <strong>{service.team}</strong></span>
                <span className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">
                  {service.dienst_code}
                </span>
                <span className="text-red-600 font-semibold">
                  {service.ontbrekend_aantal} nodig
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

### Stap 4: PDF Export - Print Styling

**Bestand:** `components/afl/AflReportModal.tsx` (UPDATE)

**Wijzigingen:**
1. Voeg print stylesheet toe (inline of external CSS)
2. Voeg print-header component toe (alleen zichtbaar bij print)
3. Voeg export knop toe in footer

**Print Header Component:**
```tsx
{/* Print Header - alleen zichtbaar bij printen */}
<div className="hidden print:block fixed top-0 left-0 right-0 bg-white border-b-2 border-gray-800 p-6 z-50">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">AFL Roostering Rapport</h1>
      <p className="text-sm text-gray-600 mt-1">
        Roosterperiode: {reportData?.period_start} - {reportData?.period_end}
      </p>
    </div>
    <div className="text-right text-sm text-gray-600">
      <p>Run ID: {reportData?.afl_run_id?.substring(0, 12)}...</p>
      <p>Gegenereerd: {new Date().toLocaleString('nl-NL')}</p>
    </div>
  </div>
</div>
```

**Export Knop:**
```tsx
{/* Footer */}
<div className="sticky bottom-0 border-t-2 border-gray-300 bg-gray-50 px-8 py-4 flex justify-between items-center no-print">
  <p className="text-xs text-gray-600">
    📋 Dit rapport kan geëxporteerd worden naar PDF
  </p>
  <div className="flex gap-3">
    <button
      onClick={() => window.print()}
      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-md flex items-center gap-2"
    >
      🖨️ Afdrukken / PDF
    </button>
    <button
      onClick={onClose}
      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-md"
    >
      ← Terug
    </button>
  </div>
</div>
```

**Print CSS:**
```tsx
<style jsx global>{`
  @media print {
    /* Verberg elementen */
    .no-print,
    button:not(.print-only) {
      display: none !important;
    }
    
    /* Body aanpassingen */
    body {
      background: white !important;
    }
    
    /* Modal aanpassingen */
    .fixed.inset-0.z-\[9999\] {
      position: relative !important;
      z-index: auto !important;
      padding: 0 !important;
    }
    
    /* Print header ruimte */
    .print\:block {
      display: block !important;
    }
    
    /* Voorkom page breaks */
    .day-group {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    /* Pagina marges */
    @page {
      margin: 20mm 15mm;
      size: A4 portrait;
    }
    
    /* Eerste sectie ruimte voor header */
    .space-y-8 > :first-child {
      margin-top: 100px;
    }
  }
`}</style>
```

---

## Validatie & Testing

### Checklist Functionaliteit

- [ ] API endpoint `/api/afl/missing-services` werkt
- [ ] Query retourneert exact aantal records als totaal in AFL rapport
- [ ] Groepering per datum werkt correct
- [ ] Nederlandse datum formatting klopt
- [ ] UI toont alle ontbrekende diensten gegroepeerd
- [ ] Dagdeel kleuren kloppen (M=geel, O=oranje, N=blauw)
- [ ] Lege staat werkt (bij 0 ontbrekende diensten)
- [ ] Print knop opent print dialog
- [ ] Print preview toont rapport zonder knoppen
- [ ] Print header verschijnt met juiste informatie
- [ ] Pagina breaks werken correct (geen gesplitste dagen)
- [ ] PDF export behoudt styling en kleuren

### Test Scenarios

1. **Test met 8 ontbrekende diensten** (huidige data)
   - Verwacht: 8 regels, gegroepeerd over 8 dagen
   
2. **Test met 0 ontbrekende diensten** (volledig rooster)
   - Verwacht: "Alle diensten zijn ingevuld" melding
   
3. **Test met veel ontbrekende diensten** (incomplete rooster)
   - Verwacht: overzichtelijke groepering, geen performance issues
   
4. **PDF Export test**
   - Chrome: Print to PDF
   - Firefox: Print to PDF
   - Edge: Print to PDF
   - Controleer: kopregel, styling, geen knoppen

---

## Deployment Workflow

### Stappen (via GitHub MCP tools)

1. **Lees bestaande code**
   - `components/afl/AflReportModal.tsx`
   - Begrijp huidige structuur en props

2. **Maak API endpoint**
   - Bestand: `src/app/api/afl/missing-services/route.ts`
   - Implementeer SQL query
   - Test lokaal (Railway logs)

3. **Update AflReportModal**
   - Voeg data fetching toe
   - Voeg detail component toe
   - Voeg print styling toe
   - Voeg export knop toe

4. **Commit & Push**
   - Commit message: "feat(afl): Add missing services detail and PDF export to AFL report"
   - Push naar main branch

5. **Railway Deploy**
   - Automatische deployment via GitHub webhook
   - Monitor logs op Railway dashboard

6. **Test op productie**
   - Open AFL rapport
   - Controleer detail weergave
   - Test PDF export

---

## Verwachte Resultaat

### Voor (huidige situatie)
```
AFL Rapport:
- Bezettingsgraad: 96.4%
- Ingepland: 212 van 220
- Nog in te vullen: 8 diensten
- [geen detail]
```

### Na (gewenste situatie)
```
AFL Rapport:
- Bezettingsgraad: 96.4%
- Ingepland: 212 van 220
- Nog in te vullen: 8 diensten

📋 Detailoverzicht Ontbrekende Diensten:

📅 Dinsdag 26 november 2025 (1 dienst)
  🌅 Ochtend | Team ORA | MSP | 1 nodig

📅 Maandag 2 december 2025 (1 dienst)
  🌆 Avond | Team TOT | SWZ | 1 nodig

... (6 meer)

[🖨️ Afdrukken / PDF] [← Terug]
```

**PDF Export:**
- Kopregel met organisatie, periode, run ID, datum
- Volledige rapport inhoud
- Geen knoppen/UI elementen
- Professionele opmaak

---

## Technische Opmerkingen

### Database Toegang
- Gebruik bestaande Supabase client (`@supabase/supabase-js`)
- Service role key uit environment variables
- Error handling voor database queries

### Type Safety
- Definieer types voor missing services response
- TypeScript interfaces voor props
- Validatie van API responses

### Performance
- Query is efficient (WHERE clause op indexed roster_id)
- Client-side grouping is OK (max ~100 records verwacht)
- Lazy loading: alleen bij modal open

### Browser Compatibiliteit
- Print functie werkt in alle moderne browsers
- CSS print media queries zijn widely supported
- Fallback: manual "Ctrl+P" instructie

---

## Vragen & Antwoorden (uit vorige chat)

**Q1: Actuele stand of snapshot?**  
A: Actuele stand aan het einde van AFL (parameter: roster_id uit AFL result)

**Q2: Groepering?**  
A: Per dag met subtotalen, zodat planning snel kan bijsturen

**Q3: PDF export methode?**  
A: Print naar PDF via browser (eenvoudig, betrouwbaar)

**Q4: Kopregel?**  
A: Ja, met organisatie/roosterperiode/run-id, leesbare opmaak

---

## Succesindicatoren

✅ **Opdracht geslaagd als:**

1. AFL rapport toont alle 8 ontbrekende diensten in detail
2. Diensten zijn gegroepeerd per dag met duidelijke weergave
3. Print knop opent print dialog met PDF-vriendelijke weergave
4. PDF bevat kopregel met rooster informatie
5. Styling is behouden in PDF export
6. Geen errors in console of Railway logs
7. Gebruiker kan rapport printen/opslaan zonder technische kennis

---

## Prioriteit & Scope

**Prioriteit:** 🔥 Hoog (directe gebruikerswens)

**Scope:** Medium (2-3 bestanden, 1-2 uur werk)

**Risico:** Laag (geen breaking changes, additive features)

---

## Volgende Stappen (voor nieuwe draad)

1. Lees deze opdracht volledig door
2. Verifieer toegang tot GitHub repo (MCP tools)
3. Lees huidige `AflReportModal.tsx` code
4. Implementeer API endpoint
5. Update frontend component
6. Test lokaal (Railway logs)
7. Commit & deploy
8. Valideer op productie
9. Rapporteer resultaat

---

**BELANGRIJK:**  
- Gebruik ALLEEN GitHub MCP tools (geen terminal/git/lokaal)
- Commit messages in Engels (conventionele format)
- Test na elke wijziging via Railway logs
- Rapporteer in Nederlands
- Lever hoogste kwaliteit code

---

**Klaar voor implementatie!** 🚀