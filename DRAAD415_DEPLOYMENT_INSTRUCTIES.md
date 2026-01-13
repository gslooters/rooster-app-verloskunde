# DRAAD415 DEPLOYMENT INSTRUCTIES

**Versie**: 0.1.12-draad415-smart-trigger  
**Datum**: 2026-01-13  
**Prioriteit**: CRITICAL  
**Impact**: Fix voor invulling counter die 3× te hoog telt

---

## 🚨 EXECUTIVE SUMMARY

**PROBLEEM**:
- DRAAD414 trigger verhoogt invulling op ALLE team variants (GRO, ORA, TOT) tegelijk
- Resultaat: 387 rijen met invulling > 0 (verwacht: 212)
- Elke dienst telt 3× mee (voor alle teams)
- 342 rijen waar invulling > aantal (logisch onmogelijk)

**OPLOSSING**:
- Smart variant_id lookup in write-engine (3 fallback strategies)
- Database trigger gebruikt variant_id als primary, team-aware fallback als secondary
- Update ALLEEN de gevonden variant (niet alle teams)
- Filter op aantal > 0 en status != 'MAG_NIET'

**VERWACHT RESULTAAT**:
- ~212 rijen met invulling > 0 (niet 387)
- 0 rijen waar invulling > aantal
- Team distributie: GRO ~80, ORA ~80, TOT ~52 (niet 213/213/214)
- Variant_id coverage > 95%

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Voordat je begint:

- [ ] Backup van huidige database trigger (zie hieronder)
- [ ] Backup van `roster_period_staffing_dagdelen` data
- [ ] Backup van `roster_assignments` data
- [ ] Test roster ID beschikbaar voor testing
- [ ] Railway.com account toegang
- [ ] Supabase SQL Editor toegang

### Backup Commands

```sql
-- Backup trigger function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_invulling_on_assignment_change';

-- Backup data (export to CSV via Supabase dashboard)
SELECT * FROM roster_period_staffing_dagdelen WHERE roster_id = '[YOUR_TEST_ROSTER_ID]';
SELECT * FROM roster_assignments WHERE roster_id = '[YOUR_TEST_ROSTER_ID]';
```

---

## 🚀 DEPLOYMENT STAPPEN

### STAP 1: Railway Deployment (Write-Engine)

**Status**: ✅ AUTOMATISCH - Code is al gepusht naar GitHub

De volgende files zijn al bijgewerkt:
- `src/lib/afl/write-engine.ts` - Smart variant_id lookup
- `package.json` - Versie 0.1.12-draad415-smart-trigger

**Railway zal automatisch deployen**:
1. Ga naar [Railway Project](https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f)
2. Klik op service `rooster-app-verloskunde`
3. Wacht tot deployment compleet is (2-3 minuten)
4. Check deployment logs voor errors
5. Zoek naar `[DRAAD415]` log berichten

**Verificatie**:
```
RAILWAY LOGS VERWACHT:
[DRAAD415] AFL write starting - smart variant_id lookup with trigger fallback
[DRAAD415] Looking for variant: team=GRO, service=...
[DRAAD415] ✓ Strategy 1: Found team match GRO
[DRAAD415] Variant_id coverage: 200/212 (94%)
```

---

### STAP 2: Database Trigger Update (Supabase)

**Kritisch**: Volgorde is belangrijk! Write-engine EERST, dan trigger.

1. **Open Supabase SQL Editor**:
   - Ga naar [Supabase Dashboard](https://supabase.com/dashboard/project/rzecogncpkjfytebfkni/sql)
   - Klik op "New query"

2. **Run Trigger Fix**:
   ```sql
   -- Kopieer VOLLEDIGE inhoud van:
   -- supabase/migrations/draad415_trigger_fix.sql
   ```
   - Klik op "Run" (Ctrl+Enter)
   - Controleer output voor errors
   - Verwacht: `[DRAAD415] Nieuwe smart trigger geïnstalleerd`

3. **Verificatie**:
   ```sql
   -- Check of trigger bestaat
   SELECT tgname, tgtype, tgenabled
   FROM pg_trigger
   WHERE tgname = 'on_roster_assignment_status_change';
   
   -- Expected: 1 row, tgenabled = 'O' (enabled)
   ```

**Rollback bij problemen**:
Zie sectie "ROLLBACK PLAN" onderaan dit document.

---

### STAP 3: Data Cleanup

**Doel**: Reset alle invulling counters naar correcte waarden.

1. **Update Roster ID**:
   - Open `supabase/migrations/draad415_data_cleanup.sql`
   - Vervang ALLE `'[ROSTER_ID]'` met je test roster ID
   - Bijvoorbeeld: `'550e8400-e29b-41d4-a716-446655440000'`

2. **Run Cleanup Script**:
   - Kopieer aangepaste script naar Supabase SQL Editor
   - Klik op "Run"
   - Controleer alle query resultaten

3. **Verwachte Output**:
   ```
   [DRAAD415] Stap 1: Resetting all invulling counters to 0...
   [DRAAD415] Reset complete. All invulling values are now 0.
   [DRAAD415] Stap 2: Recalculating invulling from actual assignments...
   [DRAAD415] Recalculation complete.
   
   Query 1: rows_with_invulling ≈ 212, total_invulling = 212
   Query 2: violation_count = 0
   Query 3: GRO ~80, ORA ~80, TOT ~52 (NOT 213/213/214)
   ```

---

### STAP 4: Test Suite

**Doel**: Automatisch alle tests uitvoeren.

1. **Update Roster ID**:
   - Open `supabase/migrations/draad415_tests.sql`
   - Vervang ALLE `'[TEST_ROSTER_ID]'` met je test roster ID

2. **Run Test Suite**:
   - Kopieer aangepaste script naar Supabase SQL Editor
   - Klik op "Run"
   - Alle tests moeten PASSED tonen

3. **Verwachte Tests**:
   - ✅ TEST 1 PASSED: invulling_count (212) <= assignment_count (212)
   - ✅ TEST 2 PASSED: No rows with invulling > aantal
   - ✅ TEST 3 PASSED: total_invulling (212) = total_assignments (212)
   - ✅ TEST 4 PASSED: No rows with aantal=0 and invulling>0
   - ✅ TEST 5 PASSED: Variant_id coverage 94% (200 of 212)

**Als een test FAILED**:
- STOP ONMIDDELLIJK
- Controleer logs voor details
- Zie "TROUBLESHOOTING" sectie
- Overweeg rollback

---

### STAP 5: Functionele Test (NIEUW AFL RUN)

**Doel**: Test met nieuwe AFL run dat trigger correct werkt.

1. **Maak nieuw test rooster**:
   - Ga naar web interface
   - Maak nieuw rooster aan
   - Voeg 4 manual assignments toe (verschillende teams)

2. **Run AFL**:
   - Klik op "Autofill" knop
   - Wacht tot complete
   - Check AFL rapport

3. **Verwachte Resultaat**:
   ```
   AFL RAPPORT:
   - 212 assignments created (status=1)
   - 12 blocked assignments (status=2 of 3)
   - Invulling: ~212 rijen met invulling > 0
   - GEEN violations (invulling > aantal)
   - Team distributie: NIET gelijk (GRO ~80, ORA ~80, TOT ~52)
   ```

4. **Verificatie Queries**:
   ```sql
   -- Check invulling count
   SELECT COUNT(*) 
   FROM roster_period_staffing_dagdelen
   WHERE roster_id = '[NEW_ROSTER_ID]' AND invulling > 0;
   -- Expected: ~212 (NOT 387!)
   
   -- Check violations
   SELECT COUNT(*)
   FROM roster_period_staffing_dagdelen
   WHERE roster_id = '[NEW_ROSTER_ID]' AND invulling > aantal;
   -- Expected: 0
   
   -- Check team distribution
   SELECT team, SUM(invulling) as total
   FROM roster_period_staffing_dagdelen
   WHERE roster_id = '[NEW_ROSTER_ID]'
   GROUP BY team;
   -- Expected: GRO ~80, ORA ~80, TOT ~52 (NOT equal!)
   
   -- Check variant_id coverage
   SELECT 
     COUNT(*) FILTER (WHERE roster_period_staffing_dagdelen_id IS NOT NULL) as with_id,
     COUNT(*) as total
   FROM roster_assignments
   WHERE roster_id = '[NEW_ROSTER_ID]' AND status = 1;
   -- Expected: with_id > 190 (>90%)
   ```

---

## ✅ SUCCESS CRITERIA

Deployment is succesvol als:

1. **Railway Deployment**:
   - ✅ No build errors
   - ✅ Service is running
   - ✅ Logs tonen `[DRAAD415]` berichten

2. **Database Trigger**:
   - ✅ Trigger is installed
   - ✅ No SQL errors
   - ✅ Logs tonen DRAAD415 notices

3. **Data Cleanup**:
   - ✅ Invulling counters reset to 0
   - ✅ Recalculated correctly
   - ✅ ~212 rijen met invulling > 0
   - ✅ 0 violations (invulling > aantal)

4. **Test Suite**:
   - ✅ All 5 tests PASSED
   - ✅ Variant_id coverage > 90%

5. **Functional Test**:
   - ✅ New AFL run completes successfully
   - ✅ Invulling count = assignment count
   - ✅ Team distribution NOT equal
   - ✅ No violations

---

## ❌ ROLLBACK PLAN

Als deployment faalt:

### Rollback Stap 1: Database Trigger

```sql
-- Drop DRAAD415 trigger
DROP TRIGGER IF EXISTS on_roster_assignment_status_change ON roster_assignments;
DROP FUNCTION IF EXISTS update_invulling_on_assignment_change();

-- Restore DRAAD414 trigger
-- [PLAK HIER BACKUP VAN DRAAD414 TRIGGER]
-- Zie pre-deployment backup commands
```

### Rollback Stap 2: Railway Deployment

1. Ga naar [Railway Deployments](https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f/deployments)
2. Find DRAAD414 deployment (commit SHA: 83026a4a)
3. Klik op "..." menu
4. Klik "Redeploy"
5. Wacht tot deployment compleet

### Rollback Stap 3: Data Restore

```sql
-- Restore from backup CSV
-- Use Supabase dashboard "Import data" functie
-- Of SQL COPY command met backup file
```

---

## 🔍 TROUBLESHOOTING

### Probleem: Railway deployment fails

**Symptomen**: Build errors, TypeScript errors

**Oplossing**:
```bash
# Check Railway logs
# Look for TypeScript compilation errors
# Check if supabase client is initialized correctly
```

### Probleem: Trigger SQL errors

**Symptomen**: Syntax errors, function not found

**Oplossing**:
```sql
-- Check PostgreSQL version
SELECT version();
-- Must be >= 12.0

-- Check if required tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('roster_assignments', 'roster_period_staffing_dagdelen');
-- Must return 2 rows
```

### Probleem: Test suite fails

**Symptomen**: TEST X FAILED

**Oplossing**:
1. Check welke test faalt
2. Run detail query voor die test
3. Check logs in Railway en Supabase
4. Als nodig, rollback en debug

### Probleem: Variant_id coverage < 90%

**Symptomen**: TEST 5 WARNING of FAILED

**Mogelijke Oorzaken**:
- Veel diensten hebben geen capaciteit (aantal=0)
- Service_types zijn niet correct geconfigureerd
- Team matching faalt

**Oplossing**:
```sql
-- Check detail waarom variant_id NULL is
SELECT 
  ra.id,
  ra.date,
  ra.dagdeel,
  st.code as service,
  ra.team,
  ra.roster_period_staffing_dagdelen_id
FROM roster_assignments ra
JOIN service_types st ON st.id = ra.service_id
WHERE ra.roster_id = '[ROSTER_ID]'
  AND ra.status = 1
  AND ra.roster_period_staffing_dagdelen_id IS NULL
LIMIT 10;

-- Check of matching variants bestaan
SELECT 
  date,
  dagdeel,
  service_id,
  team,
  aantal,
  status
FROM roster_period_staffing_dagdelen
WHERE roster_id = '[ROSTER_ID]'
  AND date = '[PROBLEEM_DATE]'
  AND dagdeel = '[PROBLEEM_DAGDEEL]'
  AND service_id = '[PROBLEEM_SERVICE]';
```

---

## 📊 MONITORING

Na deployment, monitor:

### Railway Logs

Zoek naar:
- `[DRAAD415]` log berichten
- Error messages
- Performance metrics (database_write_ms)

**Verwacht**:
```
[DRAAD415] AFL write starting
[DRAAD415] ✓ Strategy 1: Found team match
[DRAAD415] Variant_id coverage: 94%
[DRAAD415] AFL write complete: 212 assignments updated
```

### Supabase Logs

Zoek naar:
- Trigger notices: `[DRAAD415] Invulling +1 via variant_id`
- Warnings: `[DRAAD415] No suitable variant found`
- Errors

### Performance

Monitor:
- AFL run time (should be ~10-15 sec)
- Database write time (should be ~400-600ms)
- No timeouts or locks

---

## 📝 DEPLOYMENT METADATA

**Commits**:
- write-engine.ts: `a3054a3e`
- package.json: `5c0dd057`
- draad415_trigger_fix.sql: `8c7c211d`
- draad415_data_cleanup.sql: `89fa855b`
- draad415_tests.sql: `1448288f`

**Railway Trigger**: `FORCE_DEPLOYMENT_v13_DRAAD415_X7Y9`

**Cache Bust ID**: `1736776300000`

**Version**: `0.1.12-draad415-smart-trigger`

---

## 👍 NEXT STEPS NA SUCCESVOLLE DEPLOYMENT

1. **Productie Data Cleanup**:
   - Run `draad415_data_cleanup.sql` op productie roster(s)
   - Verifieer resultaten

2. **Monitor**:
   - Eerste 3 AFL runs monitoren
   - Check invulling counters blijven correct
   - Check performance metrics

3. **Documenteer**:
   - Update CHANGELOG.md
   - Update team documentatie
   - Share learnings met team

4. **Plan Volgende Draad**:
   - DRAAD416: Performance optimalisatie?
   - DRAAD416: Extra validaties?
   - DRAAD416: UI improvements?

---

## ℹ️ CONTACT & SUPPORT

Bij problemen:
1. Check deze instructies nogmaals
2. Check TROUBLESHOOTING sectie
3. Check Railway en Supabase logs
4. Overweeg rollback als kritiek

---

**✅ EINDE INSTRUCTIES**

Succes met de deployment! 🚀
