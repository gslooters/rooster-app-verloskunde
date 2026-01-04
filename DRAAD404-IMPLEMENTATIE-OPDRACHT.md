# 📋 DRAAD 404 - IMPLEMENTATIE OPDRACHT

**Datum**: 4 JAN 2026, 12:37 CET  
**Versie**: 1.0  
**Status**: KLAAR VOOR UITVOERING  
**Geschatte Duur**: 15-20 minuten  
**Risk Level**: 🟢 LAAG  

---

## 🎯 DOELSTELLING

### Probleem
Admin modus ("toon alle diensten" toggle) toont 9 diensten ZONDER team labels.  
User kan niet zien welk team welke dienst is.

### Oplossing
Creëeer nieuwe functie `getServicesForEmployeeWithAllVariants()` die team-varianten ophaalt en 27 entries (9 diensten × 3 teams) retourneert MET team labels.

### Expected Result
- ✅ Admin modus toont 27 entries (DDA [Groen], DDA [Oranje], DDA [Praktijk], DDO [Groen], ...)
- ✅ Gefiltered modus ONGEWIJZIGD (blijft werken zoals nu)
- ✅ Team labels duidelijk zichtbaar in beide modi
- ✅ Sortering: Eerst op code, dan op team

---

## 📂 BESTANDEN TE WIJZIGEN

### Bestand 1: `lib/services/preplanning-storage.ts`
**Actie**: FUNCTIE TOEVOEGEN (na regel ~350, voor `getEmployeeServiceCodes`)

### Bestand 2: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`
**Actie**: IMPORT + FUNCTIE UPDATEN

---

## 🔧 STAP 1: NIEUWE FUNCTIE TOEVOEGEN

### File: `lib/services/preplanning-storage.ts`
**Location**: Voeg toe VÓÓR de functie `getEmployeeServiceCodes()` (na regel ~290)

### Code Template:

```typescript
/**
 * DRAAD404: Haal ALLE team-varianten op voor admin modus
 * 
 * Retourneert ALLE mogelijke service×team combinaties voor admin modus
 * - Haal basis services van medewerker op
 * - Query roster_period_staffing_dagdelen voor ELKE service
 * - Collect team-varianten per service (GRO, ORA, TOT)
 * - Retourneer: 9 diensten × 3 teams = 27 entries
 * 
 * DRAAD404-IMPLEMENTATIE: Nieuwe functie voor admin modus met alle varianten
 * @param employeeId - TEXT ID van de medewerker
 * @param rosterId - UUID van het rooster
 * @param targetDate - Datum (YYYY-MM-DD) voor staffing lookup
 * @param targetDagdeel - Dagdeel (O/M/A) voor staffing lookup
 * @returns Array van ServiceTypeWithTimes met team_variant per entry
 */
export async function getServicesForEmployeeWithAllVariants(
  employeeId: string,
  rosterId: string,
  targetDate: string,
  targetDagdeel: Dagdeel
): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log(
      '[getServicesForEmployeeWithAllVariants] Loading all team variants for admin mode:',
      { employeeId, rosterId, targetDate, targetDagdeel }
    );
    
    // Stap 1: Haal basis services op (zoals normale flow)
    let baseServices = await getServicesForEmployee(employeeId, rosterId);
    
    if (baseServices.length === 0) {
      console.warn('[getServicesForEmployeeWithAllVariants] No base services found');
      return [];
    }
    
    // Stap 2: Voor ELKE service - haal ALLE team-varianten op
    const servicesWithVariants: ServiceTypeWithTimes[] = [];
    
    for (const service of baseServices) {
      // Query: Haal ALLE staffing records voor deze service op target datum/dagdeel
      const { data: staffingData, error } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('id, team, dagdeel, status')
        .eq('roster_id', rosterId)
        .eq('service_id', service.service_id)  // ✅ Use service_id for lookup
        .eq('date', targetDate)
        .eq('dagdeel', targetDagdeel);
      
      if (error) {
        console.warn(
          `[getServicesForEmployeeWithAllVariants] Error querying variants for ${service.code}:`,
          error
        );
        continue;
      }
      
      if (!staffingData || staffingData.length === 0) {
        console.warn(
          `[getServicesForEmployeeWithAllVariants] No variants found for ${service.code} ` +
          `on ${targetDate} ${targetDagdeel} - service may not be configured`
        );
        // Fallback: Voeg service zonder team toe
        servicesWithVariants.push(service);
        continue;
      }
      
      // Voor ELKE team-variant: voeg aparte entry toe
      // Dit zorgt dat service DIO met 3 teams = 3 entries
      for (const variant of staffingData) {
        servicesWithVariants.push({
          ...service,                    // ✅ Behoud alle velden van baseService
          id: variant.id,                // ⭐ Override: variant ID (roster_period_staffing_dagdelen.id)
          team_variant: variant.team,    // ⭐ Add: 'GRO'|'ORA'|'TOT'
          variant_id: variant.id         // ⭐ Add: UUID van staffing record
        });
      }
    }
    
    console.log(
      `✅ Found ${servicesWithVariants.length} service variants ` +
      `(${baseServices.length} services × teams) for admin mode`
    );
    return servicesWithVariants;
  } catch (error) {
    console.error('[getServicesForEmployeeWithAllVariants] Exception:', error);
    // Graceful fallback: Return basis services
    return getServicesForEmployee(employeeId, rosterId);
  }
}
```

### Validatie Checklist:
- [ ] Functie toegevoegd na getServicesForEmployee() definitie
- [ ] Functie toegevoegd VÓÓR getEmployeeServiceCodes()
- [ ] Alle imports aanwezig (supabase)
- [ ] JSDoc comment compleet
- [ ] Error handling present
- [ ] Console logs aanwezig voor debugging

---

## 🔧 STAP 2: IMPORT STATEMENT UPDATEN

### File: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`
**Location**: Line ~13 (huidige import van storage services)

### Current:
```typescript
import { 
  getServicesForEmployee, 
  getServicesForEmployeeFiltered 
} from '@/lib/services/preplanning-storage';
```

### Updated:
```typescript
import { 
  getServicesForEmployee,
  getServicesForEmployeeFiltered,
  getServicesForEmployeeWithAllVariants  // ✅ NIEUW - for admin mode
} from '@/lib/services/preplanning-storage';
```

### Validatie Checklist:
- [ ] Import statement correct
- [ ] Komma's op juiste plaats
- [ ] Geen syntax errors

---

## 🔧 STAP 3: LOADSEVICES() FUNCTIE UPDATEN

### File: `app/planning/design/preplanning/components/DienstSelectieModal.tsx`
**Location**: Line ~79-95 (loadServices async function)

### Current (FOUT):
```typescript
async function loadServices() {
  if (!cellData) return;
  
  setIsLoading(true);
  try {
    let services: ServiceTypeWithTimes[];
    
    if (showAllServices) {
      // Admin modus: toon alle diensten (ongefilterd)
      services = await getServicesForEmployee(cellData.employeeId, cellData.rosterId);  // ❌ FOUT
      console.log('[DienstSelectieModal] Admin mode: loaded', services.length, 'services');
    } else {
      // Normale modus: filter op dagdeel/datum/status
      services = await getServicesForEmployeeFiltered(
        cellData.employeeId,
        cellData.rosterId,
        cellData.date,
        cellData.dagdeel
      );
      console.log('[DienstSelectieModal] Filtered mode: loaded', services.length, 'services');
    }
    
    setAvailableServices(services);
    // ... rest of function unchanged
```

### Updated (FIX):
```typescript
async function loadServices() {
  if (!cellData) return;
  
  setIsLoading(true);
  try {
    let services: ServiceTypeWithTimes[];
    
    if (showAllServices) {
      // ✅ DRAAD404: Admin modus - haal ALLE team-varianten op
      services = await getServicesForEmployeeWithAllVariants(
        cellData.employeeId,
        cellData.rosterId,
        cellData.date,        // ✅ Geef datum door
        cellData.dagdeel      // ✅ Geef dagdeel door
      );
      console.log('[DienstSelectieModal] Admin mode: loaded', services.length, 'service variants (with teams)');
    } else {
      // Gefilterde modus: filter op dagdeel/datum/status - ONGEWIJZIGD
      services = await getServicesForEmployeeFiltered(
        cellData.employeeId,
        cellData.rosterId,
        cellData.date,
        cellData.dagdeel
      );
      console.log('[DienstSelectieModal] Filtered mode: loaded', services.length, 'services');
    }
    
    setAvailableServices(services);
    // ... rest of function unchanged
```

### Validatie Checklist:
- [ ] showAllServices check behouden
- [ ] Functienaam correct (getServicesForEmployeeWithAllVariants)
- [ ] Parameters: employeeId, rosterId, date, dagdeel
- [ ] Console.log updated
- [ ] Gefilterde modus ongewijzigd gelaten
- [ ] setAvailableServices() behouden

---

## 📊 VERIFICATIE

### Na implementatie controleren:

1. **Syntaxis Check**
   - [ ] Code compileert (geen TypeScript errors)
   - [ ] Geen import errors
   - [ ] No missing semicolons

2. **Git Status**
   - [ ] 2 bestanden gewijzigd (preplanning-storage.ts, DienstSelectieModal.tsx)
   - [ ] Geen accidental changes
   - [ ] Diff is clean

3. **Console Logs**
   - [ ] '[getServicesForEmployeeWithAllVariants] Loading all team variants...'
   - [ ] 'Found X service variants (Y services × teams)'
   - [ ] Admin mode logs appear

4. **UI Test (Post-Deploy)**
   - [ ] Admin modus: 27 entries zichtbaar (9 diensten × 3 teams)
   - [ ] Team labels [Groen], [Oranje], [Praktijk] getoond
   - [ ] Sortering correct: DDA [Groen], DDA [Oranje], DDA [Praktijk], DDO [Groen], ...
   - [ ] Gefilterde modus nog steeds goed
   - [ ] Selectie werkt (klik op dienst → geselecteerd)
   - [ ] Save werkt (variant_id opgeslagen)

---

## 🚀 PUSH & DEPLOYMENT

### GitHub Push
```
Commit message:
"DRAAD404: Fix admin mode - add team variants for all 27 service options

- Add getServicesForEmployeeWithAllVariants() to preplanning-storage.ts
- Update DienstSelectieModal.tsx to use new function in admin mode
- Admin mode now shows all 9 services × 3 teams = 27 entries with team labels
- Filtered mode unchanged (still works perfectly)
- Team labels clearly distinguish [Groen], [Oranje], [Praktijk]
- Sorting: by code first, then by team

Cache-busting: Updated timestamp for Railway deployment"
```

### Railway Deployment
- [ ] GitHub push triggers Railway auto-build
- [ ] Monitor build progress (5-8 minutes)
- [ ] Verify deployment success
- [ ] Clear browser cache before testing

---

## 📝 EDGE CASES HANDLED

### 1. Service ZONDER team-varianten
**Handling**: 
- Log warning
- Fallback: Service zonder team label
- Voorkom lege resultaten

### 2. Datum/Dagdeel GEEN staffing records
**Handling**:
- Log warning  
- Fallback: Gebruik getServicesForEmployee() (basis lijst)
- Graceful degradation

### 3. No Services For Employee
**Handling**:
- Return empty array
- UI shows "Geen diensten beschikbaar"
- No crash

---

## 🔄 ROLLBACK PLAN

If something breaks:

1. **Quick Rollback**
   - Revert last 2 commits in GitHub
   - Railway auto-deploys previous version
   - Admin mode reverts to old (broken) behavior

2. **Investigation**
   - Check browser console for errors
   - Check Railway logs for backend errors
   - Verify Supabase query results

---

## ✅ SIGN-OFF CHECKLIST

Before considering implementation complete:

- [ ] Code changes made (2 files)
- [ ] Syntax validated (no TypeScript errors)
- [ ] Git commits pushed to main
- [ ] Railway deployment triggered
- [ ] Deployment completed successfully
- [ ] Browser cache cleared
- [ ] Admin mode tested: 27 entries visible
- [ ] Team labels visible in admin mode
- [ ] Filtered mode still works perfectly
- [ ] Selection logic works (variant_id correct)
- [ ] Save/database works (data persisted)
- [ ] No console errors
- [ ] All edge cases tested

---

## 📞 SUPPORT

If issues arise during implementation:

1. **Check GitHub diff** - What changed?
2. **Check Railway logs** - Any build errors?
3. **Check browser console** - Client-side errors?
4. **Check Supabase** - Query results correct?
5. **Review edge cases** - Missing null checks?

---

## 🎯 SUCCESS CRITERIA

✅ Implementation is successful when:

1. **Admin Mode (showAllServices = true)**
   - Shows 27 entries (not 9)
   - Each entry has team_variant: 'GRO'|'ORA'|'TOT'
   - Team labels rendered: [Groen], [Oranje], [Praktijk]
   - Sorting correct: code first, team second

2. **Filtered Mode (showAllServices = false)**
   - Unchanged from current behavior
   - Still shows correct entries for date/dagdeel
   - Still shows team labels
   - No regression

3. **User Experience**
   - User can clearly see which team each service is for
   - Selection works (no confusion)
   - No UI glitches or performance issues

---

## 📋 FINAL NOTES

- **Risk**: LOW (isolated change, no impact on other components)
- **Testing**: Comprehensive UI testing post-deployment
- **Rollback**: Quick and easy if needed
- **Duration**: 15-20 minutes total
- **Priority**: HIGH (critical UX fix)

---

**Klaar voor uitvoering!** ✅

*Implementatie opdracht: 4 JAN 2026, 12:37 CET*  
*Volgende draad: DRAAD404-IMPLEMENTATIE PHASE 1*