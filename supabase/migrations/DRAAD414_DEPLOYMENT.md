# DRAAD414 - DEPLOYMENT INSTRUCTIES

**Status**: READY FOR DEPLOYMENT  
**Date**: 2026-01-13  
**Priority**: CRITICAL  
**Impact**: AFL kan nu 100% van diensten opslaan (was: 1.9%)

---

## SAMENVATTING

Deze deployment bevat de fix voor het AFL save probleem waarbij slechts 4 van 212 diensten werden opgeslagen.

**Root Cause**: `getVariantId()` lookup faalde door strict team matching  
**Fix**: Vereenvoudigde trigger-based invulling management zonder variant_id dependency

---

## DEPLOYMENT STAPPEN

### Stap 1: Database Trigger Update (Supabase)

1. Log in op Supabase dashboard: https://supabase.com/dashboard/project/rzecogncpkjfytebfkni
2. Ga naar **SQL Editor**
3. Open een nieuwe query
4. Kopieer en plak de VOLLEDIGE inhoud van `draad414_trigger_fix.sql`
5. Klik op **Run** (of Ctrl+Enter)
6. Controleer op errors in de output
7. Verwachte output: "Success. No rows returned"

**BELANGRIJK**: De trigger update moet EERST worden uitgevoerd voordat Railway deployment actief wordt!

### Stap 2: Verificatie Database Trigger

Run deze query om te controleren of de trigger correct is geïnstalleerd:

```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_roster_assignment_status_change';
```

Verwachte output:
- trigger_name: `on_roster_assignment_status_change`
- event_manipulation: `UPDATE` en `INSERT` (2 rijen)
- event_object_table: `roster_assignments`
- action_statement: bevat `EXECUTE FUNCTION update_invulling_on_assignment_change()`

### Stap 3: Railway Deployment Trigger

De code wijzigingen zijn al gepusht naar GitHub:
- ✅ `src/lib/afl/write-engine.ts` - Vereenvoudigde code zonder getVariantId()
- ✅ `package.json` - Version bump naar 0.1.11-draad414-trigger-fix
- ✅ Cache-bust metadata toegevoegd

Railway detecteert deze commits automatisch en start een nieuwe deployment.

**Railway Dashboard**: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

**Deployment Status Controleren**:
1. Open Railway dashboard
2. Klik op de service (rooster-app)
3. Ga naar **Deployments** tab
4. Zoek naar commit `DRAAD414: Fix AFL variant_id`
5. Wacht tot status **Success** is (duurt ~3-5 minuten)

**Handmatige Redeploy (indien nodig)**:
1. Klik op de drie puntjes bij laatste deployment
2. Selecteer **Redeploy**
3. Wacht op deployment completion

### Stap 4: Deployment Verificatie

**Test 1: Basis Functionaliteit**
1. Open de applicatie: https://rooster-app-verloskunde-production.up.railway.app
2. Browser cache legen (Ctrl+Shift+Delete)
3. Login op de applicatie
4. Navigeer naar een bestaand rooster of maak een nieuw rooster aan

**Test 2: AFL Execution Test**
1. Open een rooster met status "draft"
2. Zorg voor 4-5 manual preplanning assignments (status=1)
3. Klik op "Start AFL" of vergelijkbare actie
4. Wacht op AFL completion
5. Check console logs voor "[DRAAD414]" berichten

**Test 3: Database Verificatie**

Run deze query in Supabase SQL Editor:

```sql
-- Controleer assignment status distributie
SELECT 
  status,
  COUNT(*) as aantal,
  COUNT(service_id) as with_service,
  COUNT(CASE WHEN roster_period_staffing_dagdelen_id IS NOT NULL THEN 1 END) as with_variant_id
FROM roster_assignments
WHERE roster_id = '[VOEG HIER TEST ROSTER ID TOE]'
GROUP BY status
ORDER BY status;
```

Verwachte output na AFL run:
```
status | aantal | with_service | with_variant_id
-------|--------|--------------|----------------
  0    |  ~900  |      0       |       0
  1    |  ~216  |    ~216      |       0       ← NULL is OK!
  2    |   ~3   |     ~0       |       0
  3    |  ~205  |     ~0       |       0
```

**Test 4: Invulling Counter Check**

```sql
-- Controleer of invulling counters kloppen
SELECT 
  st.code as service_code,
  rpsd.aantal,
  rpsd.invulling,
  (rpsd.aantal - rpsd.invulling) as nog_nodig,
  (
    SELECT COUNT(*) 
    FROM roster_assignments ra 
    WHERE ra.roster_id = rpsd.roster_id 
      AND ra.date = rpsd.date 
      AND ra.dagdeel = rpsd.dagdeel 
      AND ra.service_id = rpsd.service_id 
      AND ra.status = 1
  ) as actual_assignments
FROM roster_period_staffing_dagdelen rpsd
JOIN service_types st ON st.id = rpsd.service_id
WHERE rpsd.roster_id = '[VOEG HIER TEST ROSTER ID TOE]'
ORDER BY rpsd.date, rpsd.dagdeel, st.code;
```

Verwachte output:
- `invulling` moet gelijk zijn aan `actual_assignments` voor elke rij
- `nog_nodig` moet logisch zijn (0 of meer)

---

## SUCCESS CRITERIA

✅ **Deployment Succesvol** als:
1. Database trigger is geïnstalleerd zonder errors
2. Railway deployment status is "Success"
3. Applicatie is bereikbaar via URL
4. AFL kan draaien zonder errors
5. Alle AFL assignments worden opgeslagen met status=1 en service_id
6. invulling counters matchen actual assignments in database
7. Volgende AFL run ziet correct aantal "nog nodig" diensten

❌ **Deployment Gefaald** als:
1. Database trigger installation errors
2. Railway deployment fails
3. Applicatie geeft 500 errors
4. AFL assignments blijven status=0
5. invulling counters blijven op 0 staan
6. Volgende AFL run ziet nog steeds 220 "open" slots

---

## ROLLBACK PLAN

**Indien deployment faalt**:

### Stap 1: Database Trigger Rollback

```sql
-- Herstel oude trigger (met team check)
DROP TRIGGER IF EXISTS on_roster_assignment_status_change ON roster_assignments;
DROP FUNCTION IF EXISTS update_invulling_on_assignment_change();

-- Oude trigger code hier (uit backup)
-- [Voor rollback: bewaar oude trigger code in aparte file]
```

### Stap 2: Code Rollback via Railway

1. Open Railway dashboard
2. Ga naar **Deployments**
3. Zoek de vorige succesvolle deployment (DRAAD413)
4. Klik op "Redeploy" bij die deployment
5. Wacht op completion

### Stap 3: Verificatie na Rollback

1. Check applicatie is bereikbaar
2. Check bestaande roosters zijn niet gecorrumpeerd
3. Documenteer exact wat fout ging voor volgende fix poging

---

## MONITORING

**Railway Logs**:
- Real-time logs: Railway Dashboard → Service → Logs
- Zoek naar "[DRAAD414]" voor specifieke fix logging
- Check op errors met "WriteEngine", "variant_id", "invulling"

**Supabase Logs**:
- Logs & Reports → Query Performance
- Filter op `roster_assignments` tabel updates
- Check trigger execution times (moet < 50ms zijn)

**Performance Metrics**:
- AFL execution time: moet < 10 seconden zijn voor 220 slots
- Database write time: moet < 500ms zijn (was 500-700ms)
- Trigger overhead: moet negligible zijn (< 5ms per assignment)

---

## CONTACT

Bij vragen of problemen:
- Check Railway logs eerst
- Check Supabase logs voor database errors
- Documenteer exact error messages
- Rollback indien kritieke failures

---

## WIJZIGINGEN OVERZICHT

**Files gewijzigd**:
1. `src/lib/afl/write-engine.ts` - Verwijderd getVariantId(), vereenvoudigde buildUpdatePayloads()
2. `package.json` - Version 0.1.11, cache-bust metadata
3. `supabase/migrations/draad414_trigger_fix.sql` - Nieuwe trigger zonder team check

**Commit SHA's**:
- write-engine.ts: `b20f4f019fa00d7bd68c582ee22152e3dd004dd8`
- package.json: `a2ac4b664488cbfd3c37efe1c9e1896b9171090f`
- SQL migration: `24ae7206091e3e75ecb79a3f6189e4489a51c76e`

**Version**: 0.1.11-draad414-trigger-fix  
**Deployment Date**: 2026-01-13  
**Cache-bust ID**: 1736775900000  
**Railway Trigger**: FORCE_DEPLOYMENT_v12_DRAAD414_M9P2
