# OPDRACHT: DRAAD45 - COMPLETE CELDATA FIX (HERZIENING)

**Aangemaakt:** 23 november 2025, 21:45 CET  
**Prioriteit:** KRITIEK - DRAAD44 gefaald, nieuwe aanpak vereist  
**Methode:** Stapsgewijze uitvoering via Github + Railway  
**Tool:** Perplexity Enterprise Max - Deep Dive Modus  

---

## 🚨 SITUATIE

### DRAAD44 Resultaat: GEFAALD

**Probleem:**
- Deployment succesvol
- Code ge-commit naar Github
- Railway draait zonder errors
- MAAR: UI toont GEEN enkele verandering
- Alle cellen tonen nog steeds: groene dot, aantal 0, status MAG
- Geen enkele [DRAAD44] console log zichtbaar
- Nieuwe props (rosterId, dienstId, dagdeelType) komen niet aan bij cellen

**Waarom gefaald:**
1. Props worden WEL doorgegeven in code, MAAR data conversie gebeurt te vroeg
2. De `convertToNewStructure()` functie maakt platte array ZONDER correcte join per cel
3. DagdeelCell krijgt props maar gebruikt dagdeelWaarde direct uit conversie
4. Er is GEEN runtime validatie of Supabase lookup per cel
5. De cel-logica is passief - accepteert wat er binnenkomt zonder verificatie

**Kern diagnose:**
De fix richtte zich op props en logging, MAAR niet op de fundamentele dataflow. Data wordt server-side geconverteerd naar platte structuur ZONDER per-cel join validatie. Frontend ontvangt deze platte data en toont deze direct.

---

## 🎯 NIEUWE AANPAK: DRAAD45

### Strategie

In plaats van alleen props toevoegen, moeten we de VOLLEDIGE data pipeline fixen:

1. **Server-side:** Data ophalen inclusief ALLE join data
2. **Utility functie:** getCelData() die per cel de correcte record vindt
3. **Client rendering:** Cellen gebruiken getCelData() i.p.v. directe props
4. **Fallback:** Bij geen match → MAG_NIET, 0, grijs
5. **Logging:** Console debug op elk cel-niveau

### Technische Flow

```
Server (page.tsx):
  ↓
  Haal roster_period_staffing + dagdelen op via Supabase
  ↓
  Stuur COMPLETE dataset naar client (niet geconverteerd!)
  ↓
Client (WeekDagdelenClient.tsx):
  ↓
  Voor elke dienst/team/dag/dagdeel:
    ↓
    Roep getCelData(rosterId, dienstId, datum, dagdeel, team, dataset)
    ↓
    getCelData zoekt in dataset via join keys
    ↓
    Return {status, aantal, id} of {MAG_NIET, 0, null}
  ↓
DagdeelCell:
  ↓
  Render op basis van validated celData
  ↓
  Log initialisatie met alle parameters
```

---

## 📋 OPDRACHT VOOR NIEUWE DRAAD

### CONTEXT VOOR AI ASSISTANT

**Project:** Rooster App Verloskunde  
**Repository:** https://github.com/gslooters/rooster-app-verloskunde  
**Deploy:** Railway.app  
**Database:** Supabase  

**Vorige draad:** DRAAD44 - Props fix gefaald (geen UI verandering)  
**Deze draad:** DRAAD45 - Complete data pipeline fix  

**Huidige situatie:**
- Week dagdelen view toont voor ALLE cellen: MAG status, 0 aantal, groen
- Geen variatie tussen diensten/teams/dagdelen
- Console logs van DRAAD44 verschijnen NIET
- Data wordt wel opgehaald maar niet correct per cel gematcht

**Database structuur:**
```sql
rooster_period_staffing:
  - id (PK)
  - roster_id (FK)
  - service_id (FK)  -- KRITIEK voor dienst matching
  - date (datum)

roster_period_staffing_dagdelen:
  - id (PK)
  - roster_period_staffing_id (FK)
  - dagdeel ('ochtend'|'middag'|'avond')
  - team ('GRO'|'ORA'|'TOT')
  - status ('MOET'|'MAG'|'MAG_NIET'|'AANGEPAST')
  - aantal (0-9)
```

**Vereiste per cel:**
Elke cel moet UNIEK gezocht worden via:
- roster_id (welk rooster)
- service_id (welke dienst)
- date (welke dag)
- dagdeel (welk dagdeel)
- team (welk team)

Als deze combinatie NIET gevonden wordt:
- status = MAG_NIET
- aantal = 0
- UI = grijs

---

## 🛠️ IMPLEMENTATIE STAPPEN

### STAP 1: Analyse Huidige Data Flow

**Doelstelling:** Begrijp waar de conversie gebeurt en waarom cellen niet uniek zijn

**Taken:**
1. Lees `lib/planning/weekDagdelenData.ts` (data fetch functie)
2. Lees `components/planning/week-dagdelen/WeekDagdelenClient.tsx` (conversie logica)
3. Identificeer waar `convertToNewStructure()` de data plat maakt
4. Analyseer waarom dagdeelWaarde.id niet uniek/correct is

**Output:** Markdown rapport met:
- Huidige data flow diagram
- Probleem locaties
- Waarom join niet per cel gebeurt

**Verification:**
- [ ] Data flow volledig gedocumenteerd
- [ ] Probleem punten geïdentificeerd
- [ ] Oplossing richting bepaald

---

### STAP 2: Server-Side Data Ophalen (Verbeterd)

**Doelstelling:** Haal ALLE benodigde data op inclusief join relaties

**Taken:**
1. Update `lib/planning/weekDagdelenData.ts`:
   - Haal roster_period_staffing op met ALLE diensten voor de week
   - Include roster_period_staffing_dagdelen via join
   - Behoud service_id in response (niet droppen!)
   - Return RAW data structure (niet converteren)

2. Update type definitions in `lib/types/week-dagdelen.ts`:
   - Voeg RawRosterPeriodData type toe
   - Voeg RawDagdeelData type toe

**Code voorbeeld:**
```typescript
// In weekDagdelenData.ts
export interface RawRosterPeriodData {
  id: string;
  roster_id: string;
  service_id: string;  // BEHOUDEN!
  date: string;
  roster_period_staffing_dagdelen: RawDagdeelData[];
}

export interface RawDagdeelData {
  id: string;
  roster_period_staffing_id: string;
  dagdeel: 'ochtend' | 'middag' | 'avond';
  team: 'GRO' | 'ORA' | 'TOT';
  status: 'MOET' | 'MAG' | 'MAG_NIET' | 'AANGEPAST';
  aantal: number;
}

export async function getRawWeekDagdelenData(
  rosterId: string,
  weekNummer: number,
  periodStart?: string
): Promise<RawRosterPeriodData[] | null> {
  // Haal alle roster_period_staffing records op voor de week
  // MET nested dagdelen
  // ZONDER conversie naar platte structuur
}
```

**Verification:**
- [ ] getRawWeekDagdelenData functie geïmplementeerd
- [ ] Service_id behouden in response
- [ ] Dagdelen nested in parent records
- [ ] Type definitions toegevoegd
- [ ] Console log toont RAW data correctheid

---

### STAP 3: getCelData Utility Functie

**Doelstelling:** Utility die per cel de correcte data vindt via join keys

**Taken:**
1. Maak nieuwe file: `lib/planning/celDataMatcher.ts`
2. Implementeer getCelData functie
3. Voeg logging toe voor debugging
4. Voeg fallback toe bij geen match

**Code:**
```typescript
// lib/planning/celDataMatcher.ts
import type { RawRosterPeriodData, RawDagdeelData } from './weekDagdelenData';
import type { DagdeelStatus } from '@/lib/types/week-dagdelen';

export interface CelData {
  status: DagdeelStatus;
  aantal: number;
  id: string | null;
  found: boolean;
}

/**
 * DRAAD45: Zoek correcte cel data via unieke join keys
 * 
 * @param rosterId - UUID van rooster
 * @param serviceId - UUID van dienst (service_types.id)
 * @param date - ISO date (YYYY-MM-DD)
 * @param dagdeel - 'ochtend'|'middag'|'avond'
 * @param team - 'GRO'|'ORA'|'TOT'
 * @param dataset - Volledige raw dataset van server
 * @returns CelData met status/aantal/id of fallback
 */
export function getCelData(
  rosterId: string,
  serviceId: string,
  date: string,
  dagdeel: 'ochtend' | 'middag' | 'avond',
  team: 'GRO' | 'ORA' | 'TOT',
  dataset: RawRosterPeriodData[]
): CelData {
  console.log('🔍 [DRAAD45] getCelData:', {
    rosterId,
    serviceId,
    date,
    dagdeel,
    team
  });

  // STAP 1: Vind roster_period_staffing record
  const rpsRecord = dataset.find(
    (rps) =>
      rps.roster_id === rosterId &&
      rps.service_id === serviceId &&
      rps.date === date
  );

  if (!rpsRecord) {
    console.warn('⚠️ [DRAAD45] Geen roster_period_staffing gevonden voor:', {
      rosterId,
      serviceId,
      date
    });
    return {
      status: 'MAG_NIET',
      aantal: 0,
      id: null,
      found: false
    };
  }

  // STAP 2: Vind dagdeel record
  const dagdeelRecord = rpsRecord.roster_period_staffing_dagdelen.find(
    (dd) => dd.dagdeel === dagdeel && dd.team === team
  );

  if (!dagdeelRecord) {
    console.warn('⚠️ [DRAAD45] Geen dagdeel record gevonden voor:', {
      rpsId: rpsRecord.id,
      dagdeel,
      team
    });
    return {
      status: 'MAG_NIET',
      aantal: 0,
      id: null,
      found: false
    };
  }

  // SUCCESS!
  console.log('✅ [DRAAD45] Cel data gevonden:', {
    id: dagdeelRecord.id,
    status: dagdeelRecord.status,
    aantal: dagdeelRecord.aantal
  });

  return {
    status: dagdeelRecord.status,
    aantal: dagdeelRecord.aantal,
    id: dagdeelRecord.id,
    found: true
  };
}
```

**Verification:**
- [ ] celDataMatcher.ts aangemaakt
- [ ] getCelData functie geïmplementeerd
- [ ] Logging per stap toegevoegd
- [ ] Fallback bij geen match
- [ ] Types correct gedefinieerd

---

### STAP 4: Client-Side Rendering Update

**Doelstelling:** Gebruik getCelData in rendering i.p.v. directe props

**Taken:**
1. Update `WeekDagdelenClient.tsx`:
   - Gebruik getRawWeekDagdelenData i.p.v. getWeekDagdelenData
   - VERWIJDER convertToNewStructure() conversie
   - Geef raw dataset door aan table components

2. Update `WeekDagdelenTable.tsx`:
   - Ontvang raw dataset
   - Geef door aan WeekTableBody

3. Update `WeekTableBody.tsx`:
   - Voor elke cel: roep getCelData() aan
   - Gebruik return value voor cel rendering
   - Log parameters per cel

**Code voorbeeld WeekTableBody:**
```typescript
// In WeekTableBody.tsx rendering
import { getCelData } from '@/lib/planning/celDataMatcher';

// Voor elke dienst/team/dag/dagdeel:
const celData = getCelData(
  rosterId,
  dienst.dienstId,  // = service_id
  dag.datum,
  'ochtend',  // of 'middag', 'avond'
  teamCode,
  rawDataset  // complete raw data van server
);

<DagdeelCell
  rosterId={rosterId}
  dienstId={dienst.dienstId}
  dienstCode={dienst.dienstCode}
  team={teamCode}
  teamLabel={TEAM_LABELS[teamCode]}
  datum={dag.datum}
  dagdeelLabel="Ochtend"
  dagdeelType="O"
  // Gebruik celData i.p.v. dag.dagdeelWaarden.ochtend
  dagdeelWaarde={{
    dagdeel: '0',
    status: celData.status,
    aantal: celData.aantal,
    id: celData.id || `${dag.datum}-O-${teamCode}`
  }}
  onUpdate={createUpdateHandler(celData.id || '')}
  disabled={disabled || !celData.found}
/>
```

**Verification:**
- [ ] WeekDagdelenClient gebruikt raw data
- [ ] convertToNewStructure VERWIJDERD
- [ ] WeekTableBody roept getCelData per cel aan
- [ ] Console logs [DRAAD45] zichtbaar per cel
- [ ] Fallback werkt (MAG_NIET bij geen match)

---

### STAP 5: DagdeelCell Update (Minimaal)

**Doelstelling:** Zorg dat cel disabled is bij geen match

**Taken:**
1. Update DagdeelCell.tsx:
   - Gebruik disabled prop als celData.found === false
   - Toon duidelijk visueel verschil voor MAG_NIET
   - Log bij initialisatie of data gevonden is

**Code:**
```typescript
// In DagdeelCell.tsx
useEffect(() => {
  console.log('📍 [DRAAD45] DagdeelCell Init:', {
    rosterId,
    dienstId,
    datum,
    dagdeel: dagdeelType,
    team,
    status: dagdeelWaarde.status,
    aantal: dagdeelWaarde.aantal,
    found: dagdeelWaarde.id !== null,
    disabled
  });
}, [rosterId, dienstId, datum, dagdeelType, team, dagdeelWaarde, disabled]);
```

**Verification:**
- [ ] Cel toont correct voor MAG_NIET (grijs)
- [ ] Cel is disabled als geen data gevonden
- [ ] Log toont found status
- [ ] Visueel onderscheid duidelijk

---

### STAP 6: Testing & Debugging

**Doelstelling:** Verifieer dat alle cellen correct data tonen

**Taken:**
1. Deploy naar Railway
2. Open browser console
3. Navigeer naar week dagdelen view
4. Controleer console logs:
   - [DRAAD45] getCelData voor elke cel
   - Waarschuwingen voor ontbrekende data
   - Success logs voor gevonden data

5. Visuele verificatie:
   - Variatie in cel kleuren (rood/groen/grijs)
   - Variatie in aantallen
   - Disabled cellen klikbaar/niet-klikbaar

**Test scenario's:**
- Cel met MOET status → rood
- Cel met MAG status → groen
- Cel met MAG_NIET status → grijs
- Cel zonder database record → grijs, disabled
- Cel met aantal > 0 → aantal zichtbaar
- Cel met aantal 0 → "-" zichtbaar

**Verification:**
- [ ] Console logs compleet en correct
- [ ] Visuele variatie aanwezig
- [ ] Alle statussen werken
- [ ] Disabled state correct
- [ ] Geen errors in console

---

## 🔄 STAPSGEWIJZE UITVOERING

Deze opdracht KAN stapsgewijs uitgevoerd worden:

**Nieuwe draad per stap:**
- DRAAD45.1: Stap 1 (Analyse)
- DRAAD45.2: Stap 2 (Server-side)
- DRAAD45.3: Stap 3 (getCelData)
- DRAAD45.4: Stap 4 (Client rendering)
- DRAAD45.5: Stap 5 (DagdeelCell)
- DRAAD45.6: Stap 6 (Testing)

**Of alles in één draad:**
- DRAAD45: Volledige implementatie

**Voordeel stapsgewijs:**
- Verificatie na elke stap
- Makkelijker debuggen
- Duidelijke progress tracking

**Nadeel:**
- Meer draden nodig
- Langere totale tijd

---

## 🎯 SUCCESS CRITERIA

**De fix is succesvol als:**

1. **Console logs:**
   - [DRAAD45] getCelData logs voor ELKE cel
   - Duidelijke logs voor gevonden/niet-gevonden data
   - Geen errors of warnings (behalve verwachte ontbrekende data)

2. **Visuele variatie:**
   - NIET alle cellen groen
   - Mix van rood/groen/grijs afhankelijk van status
   - Variatie in aantallen (niet allemaal 0)

3. **Correcte matching:**
   - Elke cel toont data voor juiste dienst/team/dag/dagdeel
   - Bij klik op cel: correct record wordt ge-update
   - Geen cross-contamination tussen cellen

4. **Fallback werkt:**
   - Cellen zonder data tonen MAG_NIET (grijs)
   - Disabled state voorkomt editing
   - Duidelijk visueel verschil

5. **Database integriteit:**
   - Updates worden opgeslagen in correcte records
   - Service_id wordt correct gebruikt in queries
   - Geen duplicate records aangemaakt

---

## 📊 BESTE TOOL: PERPLEXITY ENTERPRISE MAX

**Aanbevolen modus:** **Deep Dive**

**Waarom Deep Dive:**
1. **Complexe codebase analyse** - Kan meerdere bestanden tegelijk begrijpen
2. **Database structuur begrip** - Snapt Supabase joins en relaties
3. **TypeScript expertise** - Correcte types en interfaces
4. **React/Next.js kennis** - Client/server patterns
5. **Debugging support** - Kan logs analyseren en problemen identificeren

**Alternatief:** Research modus voor documentatie en best practices lookup

**NIET aanbevolen:** Quick modus (te oppervlakkig voor deze complexiteit)

---

## 📝 SAMENVATTING VOOR NIEUWE DRAAD

**Kopieer deze tekst naar nieuwe draad:**

```
INFORMATIE: je hebt de rechten om te lezen van en te schrijven naar GitHub
ONTHOUDEN: alles via Github en Railway; niets local, geen git, niets via terminal; jij doet alles

CONTEXT:
- Project: Rooster App Verloskunde (Next.js + Supabase)
- Repo: github.com/gslooters/rooster-app-verloskunde
- Deploy: Railway.app
- Vorige draad: DRAAD44 gefaald (geen UI verandering)

PROBLEEM:
- Week dagdelen view toont ALLE cellen identiek: groen, MAG status, 0 aantal
- Geen variatie tussen diensten/teams/dagdelen
- Data wordt opgehaald maar niet correct per cel gematcht
- DRAAD44 fix (props toevoegen) had GEEN effect

OPLOSSING:
- Complete data pipeline herziening
- Server haalt RAW data op (geen conversie)
- getCelData() utility zoekt per cel via join keys
- Client rendering gebruikt getCelData() resultaat
- Fallback bij geen match: MAG_NIET, grijs, disabled

OPDRACHT:
Volg OPDRACHT_DRAAD45_CELDATA_FIX_COMPLETE.md stap voor stap.
[Kies: volledige uitvoering OF stapsgewijs]

VERIFICATIE:
- Console logs [DRAAD45] per cel
- Visuele variatie (rood/groen/grijs)
- Correcte data matching
- Fallback werkt

TOOL: Deep Dive modus (complexe codebase analyse)
```

---

## ✅ CHECKLIST VOOR UITVOERING

**Voor nieuwe draad:**
- [ ] OPDRACHT_DRAAD45_CELDATA_FIX_COMPLETE.md geopend
- [ ] Context kopie klaar voor plakken
- [ ] Deep Dive modus geselecteerd
- [ ] Keuze gemaakt: volledige uitvoering of stapsgewijs

**Tijdens uitvoering:**
- [ ] Stap 1: Analyse gedaan
- [ ] Stap 2: Server-side data opgehaald
- [ ] Stap 3: getCelData geïmplementeerd
- [ ] Stap 4: Client rendering updated
- [ ] Stap 5: DagdeelCell aangepast
- [ ] Stap 6: Testing voltooid

**Na uitvoering:**
- [ ] Console logs [DRAAD45] zichtbaar
- [ ] Visuele variatie aanwezig
- [ ] Alle cellen functioneel
- [ ] Deployment succesvol
- [ ] Documentatie bijgewerkt

---

**EINDE OPDRACHT DRAAD45**

*Deze opdracht vervangt en verbetert DRAAD44 volledig.*  
*Focus: Correcte data flow i.p.v. alleen props toevoegen.*