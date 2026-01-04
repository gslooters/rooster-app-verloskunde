# 🔍 DRAAD 404 - TEAM LABELS ONTBREKEN IN ADMIN MODUS - ROOT CAUSE

**Datum**: 4 JAN 2026, 12:35 CET  
**Status**: 🎯 **ROOT CAUSE GEÏDENTIFICEERD**  
**Severity**: 🔴 **KRITIEK - Admin modus toont geen team context**  

---

## ✅ CORRECTE ANALYSE

### Situatie Helder:

**Image 10 = ADMIN MODUS** (toggle "toon alle diensten" staat AAN)
- Toont: 9 diensten ZONDER team labels ❌
- Gewenst: 9 diensten × 3 teams = 27 entries met labels ✅
- Gebruiker zegt: "Gefilterde modus is nu PRIMA; admin modus niet goed"

---

## 🎯 ROOT CAUSE GEVONDEN

### De Data Flow:

#### ADMIN MODUS (showAllServices = TRUE) ❌
```javascript
// DienstSelectieModal.tsx line 81-84
if (showAllServices) {
  services = await getServicesForEmployee(cellData.employeeId, cellData.rosterId);
}

// preplanning-storage.ts line 266-279
export async function getServicesForEmployee(...) {
  let services: ServiceTypeWithTimes[] = (data || [])
    .map((item: any) => ({
      id: item.service_types.id,
      code: item.service_types.code,
      naam: item.service_types.naam,
      kleur: item.service_types.kleur || '#3B82F6',
      start_tijd: item.service_types.begintijd || '09:00',
      eind_tijd: item.service_types.eindtijd || '17:00',
      service_id: item.service_types.id,
      actief: true
      // ❌ GEEN team_variant!
      // ❌ GEEN variant_id!
    }));
  
  return services;  // Retourneert: DDA, DDO, DIA, DIO, ECH, GRB, MSP, OSP, SWZ (9 entries)
}
```

**Result**: 9 services ZONDER team context ❌

---

#### GEFILTERDE MODUS (showAllServices = FALSE) ✅
```javascript
// DienstSelectieModal.tsx line 85-91
else {
  services = await getServicesForEmployeeFiltered(
    cellData.employeeId,
    cellData.rosterId,
    cellData.date,
    cellData.dagdeel
  );
}

// preplanning-storage.ts line 537-560
export async function getServicesForEmployeeFiltered(...) {
  for (const service of baseServices) {
    // Query roster_period_staffing_dagdelen
    const { data: staffingData } = await supabase
      .from('roster_period_staffing_dagdelen')
      .select('id, dagdeel, status, team')  // ✅ Haalt TEAM op!
      .eq('roster_id', rosterId)
      .eq('service_id', service.id)
      .eq('date', date);
    
    // Voor ELKE team-variant: aparte entry
    for (const dagdeelData of dagdeelDataList) {
      filteredServices.push({
        ...service,
        id: dagdeelData.id,                  // ✅ Variant ID
        team_variant: dagdeelData.team,      // ✅ 'GRO'|'ORA'|'TOT'
        variant_id: dagdeelData.id           // ✅ UUID
      });
    }
  }
  
  return filteredServices;  // Retourneert: 27 entries MET team_variant ✅
}
```

**Result**: 27 services MET team context ✅

---

## 🔧 DE FIX

### Probleem:
`getServicesForEmployee()` retourneert GEEN team-varianten

### Oplossing:
Creëer nieuwe functie `getServicesForEmployeeWithAllVariants()` die:
1. Haal ALLE services van medewerker op (zoals getServicesForEmployee)
2. Voor ELKE service: Query roster_period_staffing_dagdelen
3. Voor ELKE datum in roster: Haal ALLE team-varianten op
4. Result: Alle mogelijke combinaties (service × team)

---

## 📋 IMPLEMENTATIE PLAN

### Stap 1: Nieuwe Functie in preplanning-storage.ts

```typescript
/**
 * DRAAD404: Haal ALLE team-varianten op voor admin modus
 * Retourneert ALLE mogelijke service×team combinaties voor een rooster
 * 
 * Logic:
 * - Haal basis services van medewerker op
 * - Voor elke service: Query roster_period_staffing_dagdelen
 * - Collect UNIEKE team-varianten (GRO, ORA, TOT)
 * - Voor elke unieke combinatie: Creëer entry
 * 
 * Result: 9 diensten × 3 teams = 27 entries
 */
export async function getServicesForEmployeeWithAllVariants(
  employeeId: string,
  rosterId: string,
  targetDate: string,
  targetDagdeel: Dagdeel
): Promise<ServiceTypeWithTimes[]> {
  try {
    console.log('[getServicesForEmployeeWithAllVariants] Loading all variants for admin mode');
    
    // Stap 1: Haal basis services op (zoals normale flow)
    let baseServices = await getServicesForEmployee(employeeId, rosterId);
    
    // Stap 2: Voor ELKE service - haal ALLE team-varianten op
    const servicesWithVariants: ServiceTypeWithTimes[] = [];
    
    for (const service of baseServices) {
      // Query: Haal ALLE staffing records voor deze service op target datum/dagdeel
      const { data: staffingData, error } = await supabase
        .from('roster_period_staffing_dagdelen')
        .select('id, team, dagdeel, status')
        .eq('roster_id', rosterId)
        .eq('service_id', service.service_id)
        .eq('date', targetDate)
        .eq('dagdeel', targetDagdeel);
      
      if (error || !staffingData || staffingData.length === 0) {
        console.warn(`[getServicesForEmployeeWithAllVariants] No variants for ${service.code}`);
        // Fallback: Voeg service zonder team toe
        servicesWithVariants.push(service);
        continue;
      }
      
      // Voor ELKE team-variant: voeg aparte entry toe
      for (const variant of staffingData) {
        servicesWithVariants.push({
          ...service,
          id: variant.id,                    // Override: variant ID
          team_variant: variant.team,        // 'GRO'|'ORA'|'TOT'
          variant_id: variant.id             // UUID
        });
      }
    }
    
    console.log(`✅ Found ${servicesWithVariants.length} service variants (with teams) for admin mode`);
    return servicesWithVariants;
  } catch (error) {
    console.error('[getServicesForEmployeeWithAllVariants] Error:', error);
    // Fallback: Return basis services
    return getServicesForEmployee(employeeId, rosterId);
  }
}
```

---

### Stap 2: Update DienstSelectieModal.tsx

```typescript
// Line 81-92: Update loadServices() function

async function loadServices() {
  if (!cellData) return;
  
  setIsLoading(true);
  try {
    let services: ServiceTypeWithTimes[];
    
    if (showAllServices) {
      // ✅ NIEUWE FUNCTIE - Admin modus MET team-varianten
      services = await getServicesForEmployeeWithAllVariants(
        cellData.employeeId,
        cellData.rosterId,
        cellData.date,        // ✅ Geef datum door
        cellData.dagdeel      // ✅ Geef dagdeel door
      );
      console.log('[DienstSelectieModal] Admin mode: loaded', services.length, 'service variants');
    } else {
      // Gefilterde modus - ONGEWIJZIGD (werkt al goed!)
      services = await getServicesForEmployeeFiltered(
        cellData.employeeId,
        cellData.rosterId,
        cellData.date,
        cellData.dagdeel
      );
      console.log('[DienstSelectieModal] Filtered mode: loaded', services.length, 'services');
    }
    
    setAvailableServices(services);
    // ... rest unchanged
  }
}
```

---

### Stap 3: Import Statement

```typescript
// DienstSelectieModal.tsx - line ~13
import { 
  getServicesForEmployee,
  getServicesForEmployeeFiltered,
  getServicesForEmployeeWithAllVariants  // ✅ NIEUWE IMPORT
} from '@/lib/services/preplanning-storage';
```

---

## 🎯 RESULTAAT NA FIX

### Admin Modus (showAllServices = true)
```
✅ DDA [Groen]
✅ DDA [Oranje]
✅ DDA [Praktijk]
✅ DDO [Groen]
✅ DDO [Oranje]
✅ DDO [Praktijk]
✅ DIA [Groen]
✅ DIA [Oranje]
✅ DIA [Praktijk]
✅ DIO [Groen]
✅ DIO [Oranje]
✅ DIO [Praktijk]
... (total 27 entries)

Sortering: Eerst op code (DDA, DDO, DIA, DIO, ECH, ...)
           Dan op team (Groen, Oranje, Praktijk)
```

### Gefilterde Modus (showAllServices = false)
```
✅ ONGEWIJZIGD - blijft werken zoals nu
✅ Toont alleen diensten voor specifiek dagdeel
✅ Met team labels per variant
```

---

## 📊 CHECKLIST

- [ ] Nieuwe functie `getServicesForEmployeeWithAllVariants()` toevoegen
- [ ] Import statement updaten in DienstSelectieModal.tsx
- [ ] loadServices() functie updaten voor admin modus
- [ ] Code pushen naar GitHub
- [ ] Railway deployment triggeren
- [ ] Testen: Admin modus toont 27 entries met labels
- [ ] Testen: Gefilterde modus nog steeds goed
- [ ] Testen: Sortering werkt (code → team)
- [ ] Testen: Selectie werkt correct

---

## ⚠️ EDGE CASES

1. **Wat als service GEEN team-varianten heeft?**
   - Fallback: Toon service zonder team label
   - Voorkom lege lijst

2. **Wat als datum/dagdeel geen staffing heeft?**
   - Fallback: Gebruik getServicesForEmployee() (basis lijst)
   - Log waarschuwing

3. **Performance bij 27 entries?**
   - Acceptabel (kleine dataset)
   - Virtualisatie niet nodig

---

## ✅ VALIDATIE

### Test Cases:

1. **Admin modus - alle varianten**
   - [ ] 27 entries zichtbaar (9 diensten × 3 teams)
   - [ ] Team labels [Groen], [Oranje], [Praktijk] getoond
   - [ ] Sortering: DDA [Groen], DDA [Oranje], DDA [Praktijk], DDO [Groen], ...

2. **Gefilterde modus - ongewijzigd**
   - [ ] Alleen diensten voor specifiek dagdeel
   - [ ] Met team labels
   - [ ] Geen regressie

3. **Selectie logic**
   - [ ] Klik op "DIO [Groen]" → juiste variant_id geselecteerd
   - [ ] Save → juiste service_id + variant_id opgeslagen

4. **Edge cases**
   - [ ] Service zonder team → toont zonder label
   - [ ] Leeg resultaat → toont boodschap

---

**Status**: KLAAR VOOR IMPLEMENTATIE ✅  
**Geschatte tijd**: 15-20 minuten  
**Risk**: LAAG (geïsoleerde wijziging)

---

*Analyse compleet: 4 JAN 2026, 12:35 CET*