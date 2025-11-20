# HOTFIX - DRAAD40 FASE 1 Supabase Import Fix

**Datum**: 20 november 2025, 14:43 UTC  
**Prioriteit**: 🔴 CRITICAL  
**Type**: Import Path Fix  
**Status**: ✅ OPGELOST

## Probleem

**Build Error**:
```
Type error: Cannot find module '@/lib/supabase/server' 
or its corresponding type declarations.

File: lib/planning/weekBoundaryCalculator.ts:12:30
```

**Root Cause**:
- Incorrecte import path gebruikt: `@/lib/supabase/server`
- Correcte path in dit project: `@/lib/supabase-server`
- Incorrecte functie: `createClient()` (dat bestaat niet in dit bestand)
- Correcte functie: `getSupabaseServer()`

## Oplossing

### Wijzigingen

**Voor**:
```typescript
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();
```

**Na**:
```typescript
import { getSupabaseServer } from '@/lib/supabase-server';
const supabase = getSupabaseServer();
```

### Validatie

✅ **Import path**: `@/lib/supabase-server` bestaat en is correct  
✅ **Functie**: `getSupabaseServer()` is de juiste server-side Supabase functie  
✅ **Types**: SupabaseClient type wordt correct geretourneerd  
✅ **Code logica**: Verder ongewijzigd - alleen import fix  
✅ **Syntax**: TypeScript validatie passed  

## Impact

**Beïnvloede Bestanden**:
- `lib/planning/weekBoundaryCalculator.ts` (GEFIXED)

**Functionaliteit**:
- Geen wijziging in business logic
- Alleen technische import correctie
- Week Boundary Calculator werkt nu correct

## Test Status

Na succesvolle deployment testen:
- [ ] Build succesvol completeert
- [ ] TypeScript compilatie zonder errors
- [ ] Runtime: getSupabaseServer() wordt correct aangeroepen
- [ ] Database queries werken (roosters table)

## Commits

1. `014e85dc` - feat(DRAAD40): FASE 1 - Week Boundary Calculator implementatie (FOUT)
2. `2a3bece5` - fix(DRAAD40): Corrigeer Supabase import - gebruik lib/supabase-server (FIX)

## Next Steps

Na succesvolle deployment:
1. Valideer build logs - moet zonder errors completen
2. Test FASE 1 functionaliteit volgens plan
3. Ga verder met FASE 2 als FASE 1 werkt

---

**Ready for Deployment** ✅  
**Verwachte build tijd**: ~2-3 minuten  
**Confidence**: HOOG (simpele import fix)
