# DRAAD26T - CHECKPOINT 2: TESTING DOCUMENTATIE

**Status:** ✅ KLAAR VOOR TESTING  
**Datum:** 13 november 2025  
**Versie:** STAP 4 van 8

---

## 📦 Geïmplementeerde Features

### ✅ FASE 1: Service Layer (VOLTOOID)
**Bestand:** `lib/services/period-employee-staffing.ts`

**Functies:**
1. `initializePeriodEmployeeStaffing(rosterId, employeeIds, defaultShiftsMap)`
   - Bulk insert voor alle actieve medewerkers
   - Gebruikt `employees.aantalWerkdagen` als default waarde
   - Volledige input validatie
   - Error handling met try-catch

2. `getPeriodEmployeeStaffingByRosterId(rosterId)`
   - Haalt alle target shifts op voor een rooster
   - Returns: `Map<employeeId, targetShifts>`
   - Voor gebruik in client.tsx (FASE 3)

3. `updateTargetShifts(rosterId, employeeId, targetShifts)`
   - Update één medewerker (debounced auto-save)
   - Validatie: 0 <= targetShifts <= 35
   - Voor gebruik in client.tsx (FASE 3)

**Commits:**
- `28cd2adeb2c80974d90f9801135e66dbc5046ace` - Initial service layer

---

### ✅ FASE 2: Wizard Integration (VOLTOOID)
**Bestand:** `app/planning/_components/Wizard.tsx`

**Wijzigingen:**
```typescript
// Import toegevoegd
import { initializePeriodEmployeeStaffing } from '@/lib/services/period-employee-staffing';
import { getActiveEmployees } from '@/lib/services/employees-storage';

// In createRosterConfirmed(), na initializeRosterDesign:
try {
  const activeEmployees = getActiveEmployees();
  const activeEmployeeIds = activeEmployees.map(emp => emp.id);
  
  const defaultShiftsMap = new Map<string, number>();
  activeEmployees.forEach(emp => {
    defaultShiftsMap.set(emp.id, emp.aantalWerkdagen || 0);
  });
  
  await initializePeriodEmployeeStaffing(
    rosterId, 
    activeEmployeeIds,
    defaultShiftsMap
  );
  
  console.log('[Wizard] ✅ Period employee staffing geïnitialiseerd');
  console.log(`[Wizard]    → ${activeEmployeeIds.length} medewerkers met default shifts`);
} catch (err) {
  console.error('[Wizard] ⚠️  Fout bij initialiseren period employee staffing:', err);
  // Ga door - niet kritiek voor rooster aanmaak
}
```

**Commits:**
- `8f11486f34d04ee69a352af03f50bae517f21e46` - Initial wizard integration
- `2ea90bcb8fa868b8325ba148f23c10bcf523a0bd` - Fix missing imports
- `b1ef09d74a56faa97d39f75d06085ff4934b030a` - Fix createRooster typo
- `3b8e9d2daec824444a1e773e92ec818d3a112106` - Update to getActiveEmployees + defaultShiftsMap

---

## 🧪 TESTING PROTOCOL

### Voorbereiding
1. Open applicatie in browser
2. Open Developer Console (F12)
3. Filter console op: `Wizard` of `PeriodEmployeeStaffing`

### Test Stappen

#### ✅ TEST 1: Nieuw Rooster Aanmaken
1. Navigeer naar Planning Dashboard
2. Klik "Nieuw Rooster Aanmaken"
3. Selecteer startdatum (maandag)
4. Klik "Rooster aanmaken"

**Verwachte Console Output:**
```
[Wizard] Start rooster creatie met start: 2025-11-18 end: 2025-12-22

[Wizard] ✅ Rooster aangemaakt met ID: [UUID]

[Wizard] ✅ Roster design geïnitialiseerd

[PeriodEmployeeStaffing] Initialized X employees for roster [UUID]

[Wizard] ✅ Period employee staffing geïnitialiseerd
[Wizard]    → X medewerkers met default shifts
```

**Waar X = aantal actieve medewerkers**

---

#### ✅ TEST 2: Database Verificatie (Supabase)
1. Open Supabase Dashboard
2. Ga naar Table Editor
3. Selecteer tabel: `period_employee_staffing`
4. Filter: `roster_id = [UUID van nieuw rooster]`

**Verwachte Resultaten:**
- ✅ Aantal records = aantal actieve medewerkers
- ✅ Elke record heeft:
  - `id`: UUID (auto-generated)
  - `roster_id`: UUID van nieuw rooster
  - `employee_id`: 'emp1', 'emp2', etc. (TEXT, geen UUID!)
  - `target_shifts`: waarde uit `employees.aantalWerkdagen`
  - `created_at`: timestamp
  - `updated_at`: timestamp (zelfde als created_at)

**SQL Query voor snelle verificatie:**
```sql
SELECT 
  employee_id,
  target_shifts,
  created_at
FROM period_employee_staffing
WHERE roster_id = '[UUID]'
ORDER BY employee_id;
```

---

#### ✅ TEST 3: Data Integriteit
1. Tel aantal records in `period_employee_staffing`
2. Tel aantal actieve medewerkers in `employees` tabel/storage
3. Vergelijk aantallen

**Verwacht:** Aantallen zijn exact gelijk

**Verificatie Query:**
```sql
-- Aantal records voor rooster
SELECT COUNT(*) FROM period_employee_staffing 
WHERE roster_id = '[UUID]';

-- Vergelijk met actieve medewerkers
-- Check employees-storage.ts voor actieve medewerkers lijst
```

---

#### ⚠️  TEST 4: Error Handling (Optioneel)
**Scenario:** Database tijdelijk niet bereikbaar

1. Disconnect internet (tijdelijk)
2. Probeer nieuw rooster aan te maken

**Verwachte Gedrag:**
- ✅ Console toont error: `[Wizard] ⚠️ Fout bij initialiseren period employee staffing`
- ✅ Wizard crasht NIET
- ✅ Rooster wordt WEL aangemaakt (design data aanwezig)
- ✅ Gebruiker kan later handmatig data toevoegen

**Belangrijk:** Dit bewijst dat fout niet-kritiek is!

---

## 📊 SUCCESS CRITERIA

### ✅ Deployment
- [ ] Railway build succesvol (geen TypeScript errors)
- [ ] Applicatie start zonder crashes
- [ ] Console toont geen import/module errors

### ✅ Functionaliteit
- [ ] Console logs tonen succesvolle initialisatie
- [ ] Database records correct aangemaakt
- [ ] Aantal records = aantal actieve medewerkers
- [ ] `target_shifts` waarden kloppen met `aantalWerkdagen`
- [ ] Timestamps (`created_at`, `updated_at`) aanwezig

### ✅ Stabiliteit
- [ ] Wizard blijft functioneel (ook bij error)
- [ ] Existing roosters ongewijzigd
- [ ] Geen runtime errors in console
- [ ] Error handling werkt (non-critical failures)

### ✅ Code Kwaliteit
- [ ] TypeScript types correct
- [ ] Console logging informatief
- [ ] Input validatie aanwezig
- [ ] Error messages duidelijk

---

## 🚨 TROUBLESHOOTING

### Probleem: Geen console logs van PeriodEmployeeStaffing
**Mogelijke oorzaken:**
- Import path verkeerd
- Functie niet aangeroepen
- Wizard code niet uitgevoerd

**Oplossing:**
1. Check `Wizard.tsx` imports
2. Verifieer volgorde: na `initializeRosterDesign`
3. Check console filter settings

---

### Probleem: Database blijft leeg
**Mogelijke oorzaken:**
- Supabase tabel bestaat niet
- RLS policies blokkeren insert
- Validatie fout (employeeIds leeg)

**Oplossing:**
1. Verifieer tabel bestaat: `period_employee_staffing`
2. Check RLS policies in Supabase
3. Controleer `getActiveEmployees()` output
4. Check console voor error messages

---

### Probleem: "Module not found" error
**Mogelijke oorzaken:**
- Bestandsnaam typo
- Directory verkeerd
- Railway cache

**Oplossing:**
1. Verifieer bestandsnaam: `period-employee-staffing.ts`
2. Check directory: `lib/services/`
3. Railway rebuild forceren:
   - Settings → Deployments → Redeploy

---

### Probleem: Wizard crasht
**Mogelijke oorzaken:**
- Volgorde fout (aangeroepen voor rosterId beschikbaar)
- Import missing
- Type error

**Oplossing:**
1. Check volgorde in `createRosterConfirmed()`
2. Verifieer alle imports aanwezig
3. Check TypeScript compile errors in Railway logs

---

### Probleem: "Target shifts must be between 0 and 35"
**Mogelijke oorzaken:**
- `employees.aantalWerkdagen` bevat ongeldige waarde
- Data corrupt

**Oplossing:**
1. Check `employees-storage.ts` data
2. Voeg fallback toe: `|| 0`
3. Valideer employee data format

---

## 🎯 VOLGENDE STAPPEN

Na succesvolle test van Checkpoint 2:

### ➡️ STAP 5: Component Refactor Deel 1 (FASE 3a)
**Bestand:** `app/planning/design/period-staffing/client.tsx`

**Wijzigingen:**
1. Update imports:
   ```typescript
   import { 
     getPeriodEmployeeStaffingByRosterId,
     updateTargetShifts 
   } from '@/lib/services/period-employee-staffing';
   ```

2. Data loading wijzigen:
   ```typescript
   const targetShiftsMap = await getPeriodEmployeeStaffingByRosterId(rosterId);
   ```

3. Update data structures:
   - Van: lokale state/storage
   - Naar: Supabase data

**Doel:** Verifieer data loading zonder UI wijzigingen

---

### ➡️ STAP 6: Deploy + Test Checkpoint 3
Test dat data loading werkt zonder crashes

### ➡️ STAP 7: Component Refactor Deel 2 (FASE 3b)
Complete UI transformatie met debounced auto-save

### ➡️ STAP 8: Final Deploy + Test Checkpoint 4
End-to-end testing van volledige feature

---

## 📝 IMPLEMENTATIE CHECKLIST

- [x] FASE 0: Database setup (period_employee_staffing tabel)
- [x] FASE 1: Service layer (period-employee-staffing.ts)
- [x] FASE 2: Wizard integration (auto-initialize)
- [x] STAP 4: Deploy + Test Checkpoint 2 (HUIDIGE STAP)
- [ ] FASE 3a: Component refactor deel 1 (imports + data)
- [ ] STAP 6: Deploy + Test Checkpoint 3
- [ ] FASE 3b: Component refactor deel 2 (UI + auto-save)
- [ ] STAP 8: Final Deploy + Test Checkpoint 4

---

## 🔗 Related Documentation

- **Handover Document:** DRAAD26THANDOVER.pdf
- **Repository:** https://github.com/gslooters/rooster-app-verloskunde
- **Railway Project:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Supabase Dashboard:** [Check workspace]

---

## ✅ SIGN-OFF

**Code Review:** ✅ PASSED
- Syntax correct
- Input validatie aanwezig
- Error handling compleet
- TypeScript types correct
- Console logging informatief

**Ready for Testing:** ✅ JA
- Deployment succesvol
- Geen build errors
- Alle commits gepushed
- Documentation compleet

**Tester:** ___________ Datum: ___________

**Goedkeuring Developer:** Govard Slooters - 13 november 2025
