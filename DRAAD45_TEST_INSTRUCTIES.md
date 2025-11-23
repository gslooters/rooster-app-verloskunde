# DRAAD45 - BROWSER TEST INSTRUCTIES

**Deploy URL**: https://rooster-app-verloskunde-production.up.railway.app

---

## 👀 VISUAL VERIFICATIE (30 seconden)

### STAP 1: Open Week Dagdelen View

1. Ga naar deploy URL
2. Login (indien nodig)
3. Navigeer naar: **Planning → Week Dagdelen View**
4. Selecteer een rooster + weeknummer

### STAP 2: Kijk naar Cel Kleuren

**VERWACHT** (variatie zichtbaar):
- 🔴 **Rode cellen** = MOET status (bijv. 3 medewerkers verplicht)
- 🟢 **Groene cellen** = MAG status (bijv. 2 medewerkers optioneel)
- ⚪ **Grijze cellen** = MAG_NIET status (niet ingepland)

**CHECK**:
- [ ] Zie je VERSCHILLENDE kleuren? (❌ DRAAD44 = alles groen)
- [ ] Zijn aantallen VERSCHILLEND? (niet overal 0)
- [ ] Variëren kleuren per team? (GRO vs ORA vs TOT)
- [ ] Variëren kleuren per dagdeel? (Ochtend vs Middag vs Avond)

### STAP 3: Open Browser Console

**Chrome/Edge**: F12 → Console tab  
**Firefox**: F12 → Console tab  
**Safari**: Cmd+Option+C

**ZOEK NAAR**: `[DRAAD45]` logs

**VERWACHT OUTPUT** (per cel):
```
[DRAAD45] Cel init - starting fetch: {...}
[DRAAD45] getCelDataClient START: {...}
[DRAAD45] ✅ roster_period_staffing found: {...}
[DRAAD45] ✅ SUCCESS - Cel data found: {result: {status: "MOET", aantal: 3}}
[DRAAD45] ✅ Cel data loaded: {...}
```

**CHECK**:
- [ ] Zie je `[DRAAD45]` logs?
- [ ] Zie je verschillende `status` waarden? (MOET, MAG, MAG_NIET)
- [ ] Zie je verschillende `aantal` waarden? (niet allemaal 0)
- [ ] Zijn er `✅ SUCCESS` messages?

---

## 🔍 DIEPERE VERIFICATIE (2 minuten)

### TEST 1: Inline Editing

1. **Klik op een groene cel** (MAG status)
2. **VERWACHT**: Cel krijgt blauwe border + input field
3. **Type een cijfer** (bijv. 5)
4. **Druk Enter**
5. **VERWACHT**: 
   - Spinner verschijnt kort
   - Cel toont nieuwe waarde
   - Console: `💾 [DRAAD45] Saving cel update`
   - Console: `✅ [DRAAD45] Save successful`

**CHECK**:
- [ ] Edit mode werkt?
- [ ] Save actie triggert?
- [ ] Nieuwe waarde blijft staan?

### TEST 2: Disabled State

1. **Klik op een grijze cel** (MAG_NIET)
2. **VERWACHT**: Niets gebeurt (cel disabled)
3. **Hover over grijze cel**
4. **VERWACHT**: Geen hover effect (cursor: not-allowed)

**CHECK**:
- [ ] Grijze cellen niet klikbaar?
- [ ] Cursor toont "not-allowed"?

### TEST 3: Loading State

1. **Refresh de pagina** (Ctrl+R / Cmd+R)
2. **Kijk snel naar de tabel** (eerste 500ms)
3. **VERWACHT**: Spinners zichtbaar in cellen
4. **Na 1-2 seconden**: Data geladen, kleuren zichtbaar

**CHECK**:
- [ ] Loading spinners verschijnen?
- [ ] Smooth transitie naar data?
- [ ] Geen flicker/jump?

---

## ✅ SUCCESS CRITERIA

### Minimum Viable Fix (MOET)

- [x] **Niet alle cellen identiek** (❌ DRAAD44 = alles groen, MAG, 0)
- [ ] **Variatie in kleuren** (rood, groen, grijs zichtbaar)
- [ ] **Variatie in aantallen** (niet overal 0)
- [ ] **Console logs aanwezig** ([DRAAD45] prefix)
- [ ] **Editing werkt nog** (inline edit + save)

### Excellent Fix (MOET + MAG)

- [ ] **Loading states smooth** (geen flicker)
- [ ] **Fallback werkt** (grijze cellen bij geen data)
- [ ] **Error handling graceful** (geen crashes)
- [ ] **Performance OK** (laden < 2 sec)
- [ ] **Keyboard navigation** (Tab/Enter/Escape)

---

## ❌ FAIL SCENARIOS

### SCENARIO A: Alles Nog Steeds Identiek

**SYMPTOOM**: Alle cellen groen, MAG, 0 (zoals DRAAD44)  
**DIAGNOSE**: Data pipeline niet correct  
**ACTIE**: 
1. Check console voor `[DRAAD45]` logs
2. Check of `getCelDataClient` aangeroepen wordt
3. Controleer database records (zijn er wel roster_period_staffing entries?)

### SCENARIO B: Allemaal Grijs (MAG_NIET, 0)

**SYMPTOOM**: Alle cellen grijs, aantal 0  
**DIAGNOSE**: Database queries falen (geen matches)  
**ACTIE**:
1. Console → Zoek naar `⚠️  No roster_period_staffing match`
2. Check rosterId, dienstId, datum in logs
3. Verify database heeft data voor die week

### SCENARIO C: Spinners Blijven Hangen

**SYMPTOOM**: Cellen blijven loading state tonen  
**DIAGNOSE**: Database query hangt / network error  
**ACTIE**:
1. Console → Check voor error messages
2. Network tab → Check Supabase requests (failed?)
3. Refresh pagina, try again

### SCENARIO D: Editing Broken

**SYMPTOOM**: Klikken op cel doet niets  
**DIAGNOSE**: State update conflict / disabled niet correct  
**ACTIE**:
1. Console → Check voor JavaScript errors
2. Verify cel niet in loading state (spinner weg?)
3. Verify cel niet disabled (niet grijs?)

---

## 📊 PERFORMANCE CHECK

### Network Tab Monitoring

1. Open DevTools → Network tab
2. Filter: `roster_period`
3. Refresh pagina
4. **VERWACHT**: 
   - Veel requests (315 cellen × 2 queries = 630)
   - Parallel execution (niet sequentieel)
   - Response times: 20-100ms per query
   - Total time: 500-1500ms

**CHECK**:
- [ ] Requests parallel?
- [ ] Response times OK?
- [ ] Total load < 2 sec?

### Memory Leaks Check

1. Open DevTools → Performance tab
2. Start recording
3. Navigeer naar week dagdelen view
4. Wait for load
5. Navigeer weg (andere pagina)
6. Navigeer terug
7. Stop recording
8. **CHECK**: Geen memory groei bij heen-en-weer navigatie

---

## 📧 RAPPORTAGE

### Succes Rapportage

**Als alles werkt**, stuur screenshot + console output:

```
✅ DRAAD45 VERIFICATIE SUCCESVOL

Visuele variatie: Ja
Rode cellen: Ja
Groene cellen: Ja
Grijze cellen: Ja
Aantallen variëren: Ja

Console logs: [DRAAD45] zichtbaar
Editing: Werkt
Performance: < 2 sec

Screenshot: [attach]
Console output: [attach]
```

### Fout Rapportage

**Als iets niet werkt**, stuur details:

```
❌ DRAAD45 VERIFICATIE GEFAALD

Probleem: [beschrijving]
Scenario: [A/B/C/D van hierboven]

Console errors: [copy/paste]
Network errors: [screenshot Network tab]
Visual state: [screenshot tabel]

Browser: [Chrome/Firefox/Safari + versie]
URL: [exacte URL waar probleem optreedt]
```

---

## 🚀 VOLGENDE STAP NA VERIFICATIE

**Als verificatie SUCCESVOL**:
→ **DRAAD46**: Batch query optimalisatie (reduce 630 queries → 2-3)

**Als verificatie GEFAALD**:
→ **DRAAD45.5**: Debug sessie met console output analyse

---

**TEST TIJD**: ~5 minuten totaal  
**DEPLOY URL**: https://rooster-app-verloskunde-production.up.railway.app  
**CONSOLE FILTER**: `[DRAAD45]`
