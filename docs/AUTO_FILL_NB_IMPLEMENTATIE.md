# Auto-Fill Niet Beschikbaar (NB) - Implementatie Documentatie

## 🎯 Overzicht

Deze feature vult automatisch "Niet Beschikbaar" (NB) diensten in het Rooster Ontwerp scherm op basis van de standaard niet-beschikbare dagen die zijn ingesteld in het medewerkersprofiel.

## 📚 Achtergrond

### Probleem
- Medewerkers hebben vaste dagen waarop ze niet ingepland willen worden (bijv. weekend, vaste vrije dag)
- Deze informatie werd wel opgeslagen in het medewerkersprofiel (`roostervrijDagen`)
- Maar werd NIET automatisch gebruikt bij het maken van een nieuw rooster
- Planner moest handmatig alle NB-dagen invullen voor elke medewerker

### Oplossing
- Automatisch NB invullen op basis van `roostervrijDagen` uit medewerkersprofiel
- Respecteert handmatige wijzigingen (overschrijft niet)
- Transparante logging voor debugging

## 🛠️ Technische Architectuur

### Bestanden

#### 1. `lib/utils/date-helpers.ts` (NIEUW)
Utility functies voor datum conversie en dag-code validatie.

**Belangrijkste functies:**
```typescript
getWeekdayCode(date: Date): DagCode
// Converteer Date naar 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo'

getWeekdayCodeFromString(dateString: string): DagCode  
// Converteer YYYY-MM-DD string naar dag-code

getDagNaam(dagCode: DagCode): string
// 'ma' -> 'Maandag'

isDateOnAnyWeekday(dateString: string, dagCodes: string[]): boolean
// Check of datum op een van de gegeven dagen valt
```

**Type Safety:**
```typescript
export type DagCode = 'ma' | 'di' | 'wo' | 'do' | 'vr' | 'za' | 'zo';
```

#### 2. `lib/planning/rosterDesign.ts` (VERBETERD)
Core business logic voor rooster ontwerp.

**Verbeterde functie:**
```typescript
export function autofillUnavailability(
  rosterId: string, 
  start_date: string
): boolean
```

**Wat doet het:**
1. Laad rooster ontwerp data
2. Haal ACTUELE employee data op (niet snapshot)
3. Voor elke medewerker:
   - Haal `roostervrijDagen` op
   - Loop door alle 35 dagen (5 weken)
   - Check voor elke dag of dag-code in `roostervrijDagen` staat
   - Vul NB in als:
     - Dag is een roostervrije dag
     - EN er nog geen waarde is ingesteld (respecteer handmatige invoer)
4. Sla design data op
5. Return success status

**Logging:**
```
🚀 Auto-fill NB gestart voor rosterId: r_abc123, start_date: 2025-11-24
👤 Anna van der Berg: roostervrijDagen = [za, zo]
   ✅ Ingevuld: 10 NB cellen | ⏭️  Overgeslagen: 0 (al ingesteld)
👤 Petra Jansen: roostervrijDagen = [ma]
   ✅ Ingevuld: 5 NB cellen | ⏭️  Overgeslagen: 0 (al ingesteld)
✅ Auto-fill voltooid: 15 NB cellen ingevuld, 0 overgeslagen (handmatig ingevoerd)
```

## 📊 Data Flow

```
┌────────────────────────────┐
│  Medewerkersprofiel         │
│  roostervrijDagen: ['za','zo'] │
└────────────┬───────────────┘
              │
              ↓
┌──────────────┬──────────────┐
│ getAllEmployees() │
│ Haal actuele data op    │
└──────────────┬──────────────┘
              │
              ↓
┌──────────────┬──────────────┐
│ autofillUnavailability()    │
│ Loop 35 dagen              │
│ Match dag-codes            │
└──────────────┬──────────────┘
              │
              ↓
┌──────────────┬──────────────┐
│ Voor elk match:            │
│ - Check bestaande waarde   │
│ - Vul NB in (true)         │
│ OF respecteer handmatig    │
└──────────────┬──────────────┘
              │
              ↓
┌──────────────┬──────────────┐
│ RosterDesignData           │
│ unavailabilityData:        │
│   emp123: {                │
│     '2025-11-30': true (NB)│
│     '2025-12-01': true (NB)│
│   }                        │
└────────────────────────────┘
```

## 📝 Gebruikersinstructies

### Voor Planners

**Stap 1: Medewerker Configureren**
1. Ga naar **Medewerkers Beheren**
2. Klik op **Bewerken** bij een medewerker
3. Scroll naar **Standaard Niet Beschikbaar**
4. Vink de dagen aan waarop deze medewerker standaard NB is:
   - Bijv. voor Anna: ☑ za, ☑ zo
   - Bijv. voor Petra: ☑ ma
5. Klik **Bijwerken**

**Stap 2: Rooster Ontwerpen**
1. Ga naar **Planning** > **Nieuw Rooster**
2. Vul periode in (bijv. Week 48-52 2025)
3. Klik **Start Ontwerp**
4. ✅ **Auto-fill gebeurt automatisch!**
   - Alle NB-dagen worden ingevuld op basis van medewerkersprofielen
   - Check de browser console voor details

**Stap 3: Handmatige Aanpassingen (Optioneel)**
- Klik op een NB-cel om deze te wijzigen
- Auto-fill respecteert jouw handmatige wijzigingen
- Bij een volgende auto-fill worden handmatige wijzigingen NIET overschreven

### Voor Ontwikkelaars

**Debugging**
Open browser console (F12) om gedetailleerde logging te zien:
```javascript
🚀 Auto-fill NB gestart voor rosterId: r_xyz
👤 Petra: roostervrijDagen = [ma]
   ✅ Ingevuld: 5 NB cellen | ⏭️  Overgeslagen: 0
✅ Auto-fill voltooid: 15 total NB cells filled
```

**Handmatig Aanroepen**
```typescript
import { autofillUnavailability } from '@/lib/planning/rosterDesign';

// Vul NB in voor bestaand rooster
const success = autofillUnavailability('r_abc123', '2025-11-24');
if (success) {
  console.log('Auto-fill geslaagd!');
}
```

## ✅ Testing Checklist

- [x] Medewerker met 1 roostervrije dag (bijv. 'ma')
- [x] Medewerker met meerdere roostervrije dagen (bijv. 'za', 'zo')
- [x] Medewerker zonder roostervrije dagen (lege array)
- [x] Handmatige override wordt gerespecteerd
- [x] Verschillende roosterperiodes
- [x] Edge case: Volledige week NB
- [x] TypeScript type-safety
- [x] Logging werkt correct

## 🔧 Onderhoud

### Dag-codes Uitbreiden
Als je in de toekomst meer dag-codes wilt toevoegen, update:
1. `lib/utils/date-helpers.ts` - `DagCode` type
2. `lib/types/employee.ts` - `DAGEN_VAN_WEEK` constante

### Performance Optimalisatie
De huidige implementatie gebruikt:
- Map lookup voor employee data (O(1))
- Directe array access voor dag-codes (O(1))
- Totaal: O(n * m) waar n = aantal medewerkers, m = 35 dagen

Voor 12 medewerkers = ~420 operaties (negligible)

## 📊 Metrics

### Code Changes
- **Nieuwe bestanden:** 1 (date-helpers.ts)
- **Gewijzigde bestanden:** 1 (rosterDesign.ts)
- **Toegevoegde functies:** 5
- **Verbeterde functies:** 2
- **Regels code:** ~150 (incl. documentatie)

### Impact
- **Tijdsbesparing:** ~5-10 minuten per rooster (handmatige NB invoer)
- **Foutreductie:** Geen vergeten NB-dagen meer
- **Gebruikerservaring:** Automatisch en transparant

## 🔗 Gerelateerde Documentatie

- [Employee Type Definitie](../lib/types/employee.ts)
- [Roster Design Types](../lib/types/roster.ts)
- [Date Utilities](../lib/utils/date-helpers.ts)

## 📞 Support

Vragen of problemen? Check:
1. Browser console voor debug logs
2. Medewerkersprofiel - zijn `roostervrijDagen` correct ingesteld?
3. Rooster startdatum - is deze correct?

---

**Geïmplementeerd:** November 2025  
**Versie:** 1.0  
**Status:** ✅ Production Ready