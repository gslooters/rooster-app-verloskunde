# 🧪 TEST PLAN - SUPABASE MIGRATIE VALIDATIE

**Datum**: 12 november 2025  
**Versie**: Post-Migratie v1.0  
**Status**: Ready for Testing

---

## 📋 AUTOMATED TESTS

### Uitvoeren Automated Tests

```bash
# Install dependencies (if not done)
npm install

# Run test script
npx tsx scripts/test-migration.ts
```

### Test Coverage

✅ **Basic Operations**
- `getRosters()` - Haal alle roosters op
- `generateFiveWeekPeriods()` - Genereer perioden

✅ **Full Lifecycle**
- Create roster met `upsertRoster()`
- Verify roster exists met `getRosters()`
- Initialize design data met `initializeRosterDesign()`
- Load design data met `loadRosterDesignData()`
- Delete roster met `deleteRosterById()`

---

## 🖱️ MANUAL TEST CHECKLIST

### 1. Dashboard Test

**URL**: `https://[jouw-app].railway.app/dashboard`

- [ ] Dashboard laadt zonder errors
- [ ] Bestaande roosters worden getoond
- [ ] "Nieuw Rooster" knop is zichtbaar
- [ ] Status badges (draft/in_progress/final) worden correct getoond

### 2. Nieuw Rooster Aanmaken

**Stappen**:
1. Klik op "Nieuw Rooster" knop
2. Selecteer een beschikbare periode
3. Controleer medewerkerslijst
4. Bevestig aanmaken

**Verwacht resultaat**:
- [ ] Wizard opent zonder errors
- [ ] Perioden worden geladen
- [ ] Eerste vrije periode is automatisch geselecteerd
- [ ] Bestaande perioden (draft/in_progress) zijn disabled
- [ ] Medewerkerslijst toont alle actieve medewerkers
- [ ] Na bevestigen: redirect naar rooster dashboard
- [ ] Nieuwe rooster verschijnt in de lijst

### 3. Rooster Ontwerp

**URL**: `https://[jouw-app].railway.app/planning/design/dashboard?rosterId=[ID]`

- [ ] Dashboard laadt met roster data
- [ ] Periode info wordt correct getoond (weeknummers, datums)
- [ ] Medewerkers lijst wordt geladen
- [ ] Status indicators zijn zichtbaar
- [ ] Navigatie tussen stappen werkt

### 4. Planning Grid

**URL**: `https://[jouw-app].railway.app/planning?rosterId=[ID]`

- [ ] Grid laadt zonder errors
- [ ] 5 weken worden getoond (ma t/m zo)
- [ ] Medewerkers rijen zijn zichtbaar
- [ ] Datum headers kloppen
- [ ] Weeknummers kloppen
- [ ] Feestdagen zijn gemarkeerd (indien aanwezig)

### 5. Data Persistentie

**Test flow**:
1. Maak een nieuw rooster aan
2. Voeg wat data toe (bijv. dienst invoeren)
3. Refresh de pagina
4. Navigeer terug naar het rooster

**Verwacht resultaat**:
- [ ] Data blijft behouden na refresh
- [ ] Rooster status wordt correct opgeslagen
- [ ] Wijzigingen zijn zichtbaar na hernieuwde navigatie

### 6. Error Handling

**Test scenarios**:
1. Probeer niet-bestaand rooster ID te openen
2. Verbreek tijdelijk internet connectie
3. Navigeer met onvolledige data

**Verwacht resultaat**:
- [ ] Duidelijke error messages
- [ ] Geen app crashes
- [ ] Loading states worden correct getoond
- [ ] Gebruiker kan terugnavigeren

---

## ⚡ PERFORMANCE CHECKS

### Loading Times

- [ ] Dashboard laadt binnen 2 seconden
- [ ] Roster data laadt binnen 3 seconden  
- [ ] Planning grid laadt binnen 4 seconden
- [ ] Geen visuele "flashing" of layout shifts

### Browser Console

- [ ] Geen JavaScript errors in console
- [ ] Geen failed network requests (behalve verwachte 404s)
- [ ] Supabase queries succesvol (check Network tab)

---

## 🔍 SUPABASE DATABASE CHECKS

### Via Supabase Dashboard

1. **Roosters tabel** (`roosters`)
   - [ ] Nieuwe roosters worden correct aangemaakt
   - [ ] `start_date` en `end_date` zijn correct
   - [ ] `status` field heeft juiste waarden
   - [ ] `created_at` timestamp is recent

2. **Roster Design tabel** (`roster_design`)
   - [ ] Design data wordt aangemaakt bij nieuw rooster
   - [ ] `roster_id` FK is correct
   - [ ] Employee snapshot is compleet
   - [ ] `unavailability_data` JSON is valid

3. **Data Consistency**
   - [ ] Geen orphaned records (design zonder roster)
   - [ ] Alle foreign keys kloppen
   - [ ] Timestamps zijn logisch (created_at < updated_at)

---

## 📊 TEST RESULTATEN

### Automated Test Run

**Datum**: _Vul in na uitvoeren_  
**Duur**: _Vul in_  
**Status**: _PASS / FAIL_

**Details**:
```
[Plak hier output van test script]
```

### Manual Test Run

**Tester**: _Vul in_  
**Datum**: _Vul in_  
**Browser**: _Vul in (Chrome/Firefox/Safari)_

**Samenvatting**:
- Geslaagde tests: _X / Y_
- Gevonden bugs: _X_
- Kritieke issues: _X_

**Opmerkingen**:
```
[Vul hier eventuele opmerkingen in]
```

---

## 🐛 BUG TRACKING

### Gevonden Issues

| # | Beschrijving | Severity | Status | Fix Commit |
|---|--------------|----------|--------|------------|
| 1 | _Bijvoorbeeld: Grid laadt niet_ | High | Open | - |
| 2 | _Bijvoorbeeld: Datum format fout_ | Low | Fixed | abc123 |

**Severity levels**:
- **Critical**: App crashes, data loss
- **High**: Feature werkt niet, maar app draait
- **Medium**: UI issues, kleine bugs
- **Low**: Cosmetische issues

---

## ✅ SIGN-OFF

### Ready for Production?

- [ ] Alle automated tests slagen
- [ ] Alle manual tests slagen
- [ ] Geen critical/high severity bugs
- [ ] Performance is acceptabel
- [ ] Database data is consistent

**Akkoord**: ___________ (naam)  
**Datum**: ___________
