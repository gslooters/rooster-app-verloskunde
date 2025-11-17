# DRAAD36A - Diensten per Dag: Dagdelen Implementatie

**Datum**: 17 november 2025  
**Status**: ✅ Backend Compleet | ⏳ Frontend In Ontwikkeling

## 🎯 Doel

Uitbreiding van het rooster-systeem met dagdeel-specifieke bezettingsregels per team. Hiermee kan de planner per dienst, per datum, per dagdeel (Ochtend/Middag/Avond) en per team (Groen/Oranje/Totaal) aangeven:

- **Status**: MOET / MAG / MAG_NIET / AANGEPAST
- **Aantal**: 0-9 medewerkers vereist

## 📦 Deliverables

### ✅ Voltooid

1. **Database Schema**
   - Tabel: `roster_period_staffing_dagdelen`
   - Bestand: `supabase/migrations/20251117_create_roster_period_staffing_dagdelen.sql`
   - Status: Uitgevoerd in Supabase

2. **TypeScript Types**
   - Bestand: `lib/types/roster-period-staffing-dagdeel.ts`
   - Exports: `Dagdeel`, `TeamDagdeel`, `DagdeelStatus`, `RosterPeriodStaffingDagdeel`

3. **Database Storage Layer**
   - Bestand: `lib/services/roster-period-staffing-dagdelen-storage.ts`
   - Functies: CRUD operaties voor dagdeel regels

4. **Generatie Logica**
   - Bestand: `lib/planning/roster-period-staffing-storage.ts` (updated)
   - Functie: `generateRosterPeriodStaffing` nu met automatische dagdelen generatie

### ⏳ In Ontwikkeling

5. **React Component - Diensten per Dag Scherm**
   - Status: Volgende fase
   - Planning: Week 47

## 📊 Database Schema

### Tabel: `roster_period_staffing_dagdelen`

```sql
CREATE TABLE roster_period_staffing_dagdelen (
  id UUID PRIMARY KEY,
  roster_period_staffing_id UUID NOT NULL REFERENCES roster_period_staffing(id) ON DELETE CASCADE,
  dagdeel TEXT NOT NULL CHECK (dagdeel IN ('0', 'M', 'A')),
  team TEXT NOT NULL CHECK (team IN ('TOT', 'GRO', 'ORA')),
  status TEXT NOT NULL CHECK (status IN ('MOET', 'MAG', 'MAG_NIET', 'AANGEPAST')),
  aantal INTEGER NOT NULL CHECK (aantal >= 0 AND aantal <= 9),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roster_period_staffing_id, dagdeel, team)
);
```

### Codes

**Dagdeel**:
- `0` = Ochtend
- `M` = Middag
- `A` = Avond

**Team**:
- `TOT` = Praktijk Totaal
- `GRO` = Team Groen
- `ORA` = Team Oranje

**Status**:
- `MOET` = Verplicht (rood) - standaard aantal: 1
- `MAG` = Optioneel (groen) - standaard aantal: 1
- `MAG_NIET` = Niet toegestaan (grijs) - standaard aantal: 0
- `AANGEPAST` = Handmatig aangepast (blauw) - variabel aantal

## 🔧 Gebruik

### 1. Rooster Aanmaken

Bij het aanmaken van een rooster worden automatisch dagdeel-regels gegenereerd:

```typescript
import { generateRosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';

// Genereer rooster + dagdelen
await generateRosterPeriodStaffing(
  rosterId,
  '2025-11-18', // startDate
  '2025-12-22'  // endDate (5 weken)
);
```

**Wat gebeurt er?**
1. Creëert `roster_period_staffing` records voor elke dienst × elke datum
2. Leest `team_groen_regels`, `team_oranje_regels`, `team_totaal_regels` uit `service_types`
3. Genereert per actief team 3 dagdeel-regels (0/M/A)
4. Bepaalt status en aantal op basis van dagsoort (ma/di/wo/do/vr/za/zo)
5. Feestdagen worden behandeld als zondag

### 2. Dagdeel Regels Ophalen

```typescript
import { getDagdeelRegels } from '@/lib/services/roster-period-staffing-dagdelen-storage';

// Haal alle dagdelen op voor één RPS record
const regels = await getDagdeelRegels(rosterPeriodStaffingId);

// Resultaat: array van RosterPeriodStaffingDagdeel
// Bijvoorbeeld voor dienst DDA op maandag 18-11-2025:
[
  { dagdeel: '0', team: 'GRO', status: 'MAG', aantal: 1 },
  { dagdeel: 'M', team: 'GRO', status: 'MAG', aantal: 1 },
  { dagdeel: 'A', team: 'GRO', status: 'MAG_NIET', aantal: 0 },
  { dagdeel: '0', team: 'ORA', status: 'MOET', aantal: 1 },
  // etc.
]
```

### 3. Dagdeel Regel Updaten

```typescript
import { updateDagdeelRegelSmart } from '@/lib/services/roster-period-staffing-dagdelen-storage';

// Smart update met automatische AANGEPAST detectie
const { success, waarschuwing } = await updateDagdeelRegelSmart(
  regelId,
  'MAG',  // nieuwe status
  2,      // nieuw aantal
  huidigeRegel
);

if (waarschuwing) {
  // Toon waarschuwing aan gebruiker
  console.warn(waarschuwing);
}
```

**Automatische Logica**:
- Als aantal afwijkt van default → status wordt `AANGEPAST`
- MOET → 0: waarschuwing
- MAG_NIET → >0: waarschuwing

## 📝 TypeScript API

### Types

```typescript
type Dagdeel = '0' | 'M' | 'A';
type TeamDagdeel = 'TOT' | 'GRO' | 'ORA';
type DagdeelStatus = 'MOET' | 'MAG' | 'MAG_NIET' | 'AANGEPAST';

interface RosterPeriodStaffingDagdeel {
  id: string;
  roster_period_staffing_id: string;
  dagdeel: Dagdeel;
  team: TeamDagdeel;
  status: DagdeelStatus;
  aantal: number; // 0-9
  created_at: string;
  updated_at: string;
}
```

### Storage Functies

**Create**:
- `createDagdeelRegel(regel: CreateDagdeelRegel)`
- `bulkCreateDagdeelRegels(regels: CreateDagdeelRegel[])`

**Read**:
- `getDagdeelRegels(rosterPeriodStaffingId: string)`
- `getDagdeelRegel(rosterPeriodStaffingId, dagdeel, team)`
- `getDagdeelRegelsVoorRooster(rosterId: string)`

**Update**:
- `updateDagdeelRegel(id: string, updates: UpdateDagdeelRegel)`
- `updateDagdeelRegelSmart(id, nieuweStatus, nieuwAantal, huidigeRegel)`

**Delete**:
- `deleteDagdeelRegels(rosterPeriodStaffingId: string)`

## 🚦 Validatie Regels

### Database Constraints

- `dagdeel` moet `'0'`, `'M'` of `'A'` zijn
- `team` moet `'TOT'`, `'GRO'` of `'ORA'` zijn
- `status` moet `'MOET'`, `'MAG'`, `'MAG_NIET'` of `'AANGEPAST'` zijn
- `aantal` moet tussen 0 en 9 zijn (inclusief)
- Unieke combinatie: `(roster_period_staffing_id, dagdeel, team)`

### TypeScript Validatie

```typescript
import {
  isValidDagdeel,
  isValidTeamDagdeel,
  isValidDagdeelStatus,
  isValidAantal
} from '@/lib/types/roster-period-staffing-dagdeel';

if (!isValidDagdeel('0')) throw new Error('Ongeldige dagdeel');
if (!isValidAantal(5)) throw new Error('Ongeldig aantal');
```

## 🎨 UI Kleuren

```typescript
import { DAGDEEL_STATUS_COLORS } from '@/lib/types/roster-period-staffing-dagdeel';

const kleuren = {
  MOET: '#EF4444',       // Rood
  MAG: '#10B981',        // Groen
  MAG_NIET: '#9CA3AF',   // Grijs
  AANGEPAST: '#3B82F6'   // Blauw
};
```

## 🛠️ Ontwikkeling

### Nieuwe Features Toevoegen

1. **Extra dagdeel toevoegen (bijv. Nacht)**:
   ```sql
   -- Wijzig constraint in tabel
   ALTER TABLE roster_period_staffing_dagdelen 
     DROP CONSTRAINT roster_period_staffing_dagdelen_dagdeel_check;
   
   ALTER TABLE roster_period_staffing_dagdelen
     ADD CONSTRAINT roster_period_staffing_dagdelen_dagdeel_check
     CHECK (dagdeel IN ('0', 'M', 'A', 'N'));
   ```
   
   ```typescript
   // Update type
   export type Dagdeel = '0' | 'M' | 'A' | 'N';
   ```

2. **Extra team toevoegen**:
   - Analoog aan dagdeel
   - Update `TeamDagdeel` type
   - Update database constraint

### Testing

```typescript
// Test dagdelen generatie
import { generateRosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';
import { getDagdeelRegelsVoorRooster } from '@/lib/services/roster-period-staffing-dagdelen-storage';

const rosterId = 'test-roster-id';
await generateRosterPeriodStaffing(rosterId, '2025-11-18', '2025-11-24');

const dagdelen = await getDagdeelRegelsVoorRooster(rosterId);
console.log('Totaal dagdeel regels:', Array.from(dagdelen.values()).flat().length);
```

## 🐛 Troubleshooting

### Foutmelding: "roster_period_staffing_id is verplicht"

**Oorzaak**: Parent record bestaat niet  
**Oplossing**: Zorg dat `roster_period_staffing` record eerst wordt aangemaakt

### Foutmelding: "Ongeldige dagdeel"

**Oorzaak**: Waarde is niet '0', 'M' of 'A'  
**Oplossing**: Gebruik `DAGBLOK_NAAR_DAGDEEL` mapping

```typescript
import { DAGBLOK_NAAR_DAGDEEL } from '@/lib/types/roster-period-staffing-dagdeel';

const dagdeel = DAGBLOK_NAAR_DAGDEEL['O']; // '0'
```

### Geen dagdelen gegenereerd

**Oorzaak**: Service heeft geen `team_xxx_regels` ingesteld  
**Oplossing**: Configureer team regels in Dienst Bewerken scherm

## 📚 Referenties

- **Database Schema**: `supabase/migrations/20251117_create_roster_period_staffing_dagdelen.sql`
- **Types**: `lib/types/roster-period-staffing-dagdeel.ts`
- **Storage**: `lib/services/roster-period-staffing-dagdelen-storage.ts`
- **Generatie**: `lib/planning/roster-period-staffing-storage.ts`
- **Service Types**: `lib/types/service.ts` (voor TeamRegels)

## ✅ Deployment Checklist

- [x] SQL tabel aangemaakt in Supabase
- [x] TypeScript types gecommit
- [x] Storage layer gecommit
- [x] Generatie logica gecommit
- [x] SQL migratie toegevoegd aan repository
- [x] Documentatie aangemaakt
- [ ] Frontend component ontwikkeld
- [ ] Integratie met Dashboard
- [ ] End-to-end testing
- [ ] Productie deployment

---

**Laatste update**: 17 november 2025  
**Auteur**: AI Assistant (via GitHub MCP)  
**DRAAD**: 36A - Actualiseren scherm Diensten per Dag
