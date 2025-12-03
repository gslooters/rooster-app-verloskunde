# DRAAD98D - Service Types Table Fix

**Status**: ✅ GEÏMPLEMENTEERD  
**Datum**: 2025-12-03 14:53 CET  
**Commit**: db3f007797b1717a1d9d41922041ddf760633e66

## Probleem Analyse

### Foutmelding
Bij starten van de CP-SAT solver verscheen deze fout:
```
[err] message: "Could not find the table 'public.services' in the schema cache"
[err] code: 'PGRST205'
[err] hint: "Perhaps you meant the table 'public.service_types'"
```

### Root Cause
De solver API route (`app/api/roster/solve/route.ts`) probeerde data op te halen uit een niet-bestaande tabel `services`. De correcte tabelnaam volgens het database schema is `service_types`.

### Locatie Fout
**File**: `app/api/roster/solve/route.ts`  
**Regels**: 95-99

```typescript
// ❌ FOUT
const { data: services, error: svcError } = await supabase
  .from('services')        // Verkeerde tabelnaam
  .select('id, code, naam, dagdeel, is_nachtdienst')
  .eq('active', true);     // Verkeerde kolomnaam
```

## Geïmplementeerde Oplossing

### Fix 1: Correcte Tabelnaam
```typescript
// ✅ CORRECT
const { data: services, error: svcError } = await supabase
  .from('service_types')   // Correcte tabelnaam
  .select('id, code, naam, dagdeel, is_nachtdienst')
  .eq('actief', true);     // Correcte kolomnaam (Nederlands)
```

### Fix 2: Schema Compliance
Volgens database schema (`AlletabellenNEW.txt`):
- Tabel: `service_types` (niet `services`)
- Actief kolom: `actief` (boolean, niet `active`)
- Andere kolommen: correct gebruikt

## Commits

1. **8baf0a09** - FIX DRAAD98D: Corrigeer services tabel naar service_types + actief kolom
2. **a1dad09d** - CACHE-BUST DRAAD98D: Nieuwe timestamp na service_types fix  
3. **db3f0077** - RAILWAY TRIGGER DRAAD98D: Force deploy na service_types fix

## Cache Busting

### Nieuwe Files
- `public/version-draad98d.json` - Timestamp: 1733238789000

### Updated Files  
- `railway-trigger.txt` - Random: #98457

## Testing Checklist

### Pre-Deploy Verificatie
- [x] Code syntax correct (geen TypeScript errors)
- [x] Tabelnaam `service_types` overeenkomt met database schema
- [x] Kolomnaam `actief` overeenkomt met database schema
- [x] Andere queries in dezelfde file correct (employees, etc.)
- [x] Cache-busting geïmplementeerd
- [x] Railway trigger updated

### Post-Deploy Verificatie (uit te voeren)
- [ ] Rooster aanmaken werkt (wizard flow)
- [ ] "Roosterbewerking starten" button werkt zonder fout
- [ ] Services worden correct opgehaald uit `service_types`
- [ ] Solver API returnt succesvol response
- [ ] Console toont geen PGRST205 error meer
- [ ] Railway logs tonen succesvolle service fetch

## Verwachte Resultaat

Na deployment:
1. ✅ Solver API haalt services op uit `service_types` tabel
2. ✅ Query gebruikt correcte `actief` kolom filter
3. ✅ OR-Tools solver ontvangt correcte dienst-data
4. ✅ Rooster assignments worden gegenereerd
5. ✅ Roster status update naar `in_progress`
6. ✅ Geen database schema errors meer

## Railway Deployment

**Auto-deploy**: Railway detecteert nieuwe commits op `main` branch  
**Verwachte tijd**: 2-3 minuten  
**Verificatie**: Check Railway logs voor:
```
[Solver API] Data verzameld: X medewerkers, Y diensten
```

Waar `Y` > 0 moet zijn (aantal actieve diensten uit `service_types`).

## Rollback Plan

Indien problemen:
1. Revert naar commit `7555a84e` (voor DRAAD98D)
2. Of: Handmatige fix via Railway environment variables
3. Database schema is ongewijzigd (geen rollback nodig)

## Related Issues

- DRAAD98A: Employee naam mapping (voornaam + achternaam)
- DRAAD98B: Date kolom naming (date ipv datum)  
- DRAAD98C: Employee actief filter (actief ipv active)
- **DRAAD98D**: Service types tabel + actief kolom ← **DEZE FIX**

## Database Schema Reference

```sql
-- service_types tabel (correct)
CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  naam text NOT NULL,
  dagdeel text NOT NULL,
  actief boolean DEFAULT true,  -- Nederlands
  is_nachtdienst boolean DEFAULT false,
  color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

**Implementatie voltooid**: 2025-12-03 14:53 CET  
**Deployment status**: ⏳ Wachtend op Railway auto-deploy  
**Next step**: Verifieer deployment via Railway dashboard
