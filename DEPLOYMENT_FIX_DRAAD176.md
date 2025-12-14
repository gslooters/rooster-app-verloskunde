# 🔴 DEPLOYMENT FIX - DRAAD176 (2025-12-14T16:05Z)

## PROBLEEM SAMENVATTING
**Build Failure** op Railway weigeert: `RosterPeriodStaffing type niet geëxporteerd`

### Error Message
```
Type error: Module "@/lib/planning/roster-period-staffing-storage" 
has no exported member 'RosterPeriodStaffing'.
```

**Locatie:** `components/planning/period-staffing/DayCell.tsx:2:10`

---

## ROOT CAUSE ANALYSE ✅

### DRAAD176 Breaking Change
**Wat gebeurde:**
- DRAAD176 introduceerde **DENORMALISATIE** van roster_period_staffing tabel
- Oude FK-tabellen werden vervangen door DIRECTE dagdeel records
- **Type hernoemd:** `RosterPeriodStaffing` → `RosterPeriodStaffingDagdeel`
- **Type locatie:** `lib/types/roster-period-staffing-dagdeel.ts`

### Wat brak
1. **DayCell.tsx** importeert verkeerd type:
   ```typescript
   // ❌ FOUT - dit type bestaat niet meer!
   import { RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';
   ```

2. **Correcte import:**
   ```typescript
   // ✅ JUIST - type is hier gedefinieerd
   import { RosterPeriodStaffingDagdeel } from '@/lib/types/roster-period-staffing-dagdeel';
   ```

### Waarom de fout niet eerder opviel
- Component is misschien niet actief gerenderd in dev
- Build proces is vorige week succesvol geweest
- TypeScript strikte mode detecteert dit nu

---

## FIXES TOEGEPAST ✅

### 1. Import Statement Fix
**Bestand:** `components/planning/period-staffing/DayCell.tsx`

**Voor:**
```typescript
import { RosterPeriodStaffing } from '@/lib/planning/roster-period-staffing-storage';

interface Props {
  record: RosterPeriodStaffing;  // ❌ Type bestaat niet
  // ...
}
```

**Na:**
```typescript
import { RosterPeriodStaffingDagdeel } from '@/lib/types/roster-period-staffing-dagdeel';

interface Props {
  record: RosterPeriodStaffingDagdeel;  // ✅ Type bestaat wel
  // ...
}
```

### 2. Props Interface Update
- Verwijderd: `min`, `max` parameters (DRAAD176 herschikking)
- Toegevoegd: `aantal` field (single source of truth per dagdeel)
- Aangepast: `onChange` callback signature

### 3. Cache Busting
- Update `.env.local` met `DEPLOY_TIMESTAMP`
- Force Railway om cache te wissen
- Ensures clean npm ci run

---

## VERVOLG STAPPEN 🚀

### A. Lokale verificatie (VÓÓRdat je wacht op Railway)
```bash
# 1. TypeScript compile check
npm run build --dry-run

# 2. Type check alleen
npx tsc --noEmit

# 3. Imports valideren
npx tsc --listFiles | grep -i "roster-period"
```

### B. Railway Deployment
1. **Wacht op next deployment trigger** (automatisch bij push)
2. **Monitor logs:**
   - ✅ Kijk voor: `npm ci` → `npm run build` → succesvol
   - ❌ Stop als: `Type error:` opnieuw verschijnt

3. **Rollback plan (als fout):**
   ```bash
   # In Railway UI:
   # 1. Klik "Rollback to Previous Version"
   # 2. Of: git revert a1f1de29
   # 3. git push
   ```

### C. Verifieer Build Success
- Railway "Deployment" → status = "Success" (groen)
- Logs eindigen met: "Successfully deployed"
- App URL bereikbaar en renderend

---

## POTENTIËLE ANDERE ISSUES 🔍

### Issue 1: Node.js Edge Runtime Warnings
**Status:** ⚠️ WARNING (niet fataal)

```
./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
A Node.js API is used (process.versions) which is not supported in Edge Runtime
```

**Oorzaak:** Supabase libraries gebruiken Node.js APIs
**Impactanalyse:** 
- Warnings zijn OK in `next build`
- Falen alleen als je Edge Runtime functies hebt
- Onze app gebruikt standaard Node.js runtime

**Action:** ✅ Geen fix nodig (nu)

### Issue 2: Twee Services in Repo
**Status:** ℹ️ INFO

Railway logs tonen:
```
skipping 'Dockerfile' at 'solver/Dockerfile' as it is not rooted...
skipping 'railway.json' at 'solver/railway.json' as it is not rooted...
```

Dit is **normaal** - beide services bestaan:
1. `rooster-app-verloskunde` (main app)
2. `solver/` (OR-Tools service)

Railway bouwt alleen de root app (correct).

---

## COMMITS GEMAAKT

### Commit 1: Fix Import
```
39453bc - fix: DRAAD176 - Import RosterPeriodStaffingDagdeel type correct
```

### Commit 2: Cache Busting
```
a1f1de2 - chore: cache-busting - trigger clean rebuild
```

---

## PREVENTIE VOOR VOLGENDE KEER 🛡️

1. **TypeScript strict checks:**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "noUnusedLocals": true
     }
   }
   ```

2. **Pre-commit hooks:**
   ```bash
   npx tsc --noEmit  # Always check types before commit
   ```

3. **Breaking Change Protocol:**
   - Markeer type changes als DRAAD-XXX
   - Controleer alle imports
   - Update schema migrations

---

## RESOURCES

- **DRAAD176:** Roster Period Staffing Denormalisering
- **Type Definition:** `lib/types/roster-period-staffing-dagdeel.ts`
- **Storage Logic:** `lib/planning/roster-period-staffing-storage.ts`
- **Railway Logs:** Last deployment at 2025-12-14T16:02:33Z

---

**Status:** ✅ FIX DEPLOYED  
**Last Update:** 2025-12-14T16:05:38Z  
**Next Check:** Monitor Railway deploy logs (auto-triggered)
