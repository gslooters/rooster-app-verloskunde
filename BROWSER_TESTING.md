# 🌐 BROWSER TESTING - GEEN TERMINAL NODIG

**⚠️ BELANGRIJK**: Alle tests worden uitgevoerd via de browser. Geen terminal, geen command line.

---

## 📍 HOE TE TESTEN

### Stap 1: Open je App

🔗 **URL**: `https://[jouw-railway-app].railway.app`

Je Railway URL vind je:
1. Ga naar https://railway.app
2. Login
3. Open project: `rooster-app-verloskunde`
4. Klik op je service
5. Tab "Settings" → kopieer "Public URL"

---

## ✅ TEST CHECKLIST

### TEST 1: Dashboard Werkt (⌛ 2 min)

1. 🏠 **Ga naar**: `/dashboard`
2. **Check**:
   - [ ] Pagina laadt zonder errors
   - [ ] Je ziet bestaande roosters (of melding "Geen roosters")
   - [ ] "Nieuw Rooster" knop is zichtbaar
   - [ ] Geen rode error messages

**✅ PASS** als alles laadt  
**❌ FAIL** als errors of witte pagina

---

### TEST 2: Nieuw Rooster Aanmaken (⌛ 5 min)

1. **Klik** op "Nieuw Rooster" knop
2. **Check Wizard opent**:
   - [ ] Modal/popup verschijnt
   - [ ] Perioden worden getoond
   - [ ] Eerste vrije periode is geselecteerd (rood omkaderd)
   - [ ] Bestaande perioden zijn disabled (grijs)

3. **Klik** "Verder" knop
4. **Check Medewerkerslijst**:
   - [ ] Tabel met medewerkers verschijnt
   - [ ] Kolommen: Team, Naam, Actief
   - [ ] Minimaal 1 medewerker zichtbaar

5. **Klik** "Ja" bij akkoord vraag
6. **Check Bevestiging**:
   - [ ] Periode info wordt getoond
   - [ ] "Ja, aanmaken" knop beschikbaar

7. **Klik** "Ja, aanmaken"
8. **Check Resultaat**:
   - [ ] Loading indicator verschijnt
   - [ ] Redirect naar rooster dashboard
   - [ ] URL bevat `?rosterId=`
   - [ ] Geen error messages

**✅ PASS** als rooster is aangemaakt  
**❌ FAIL** als errors tijdens proces

---

### TEST 3: Roster Dashboard Laadt (⌛ 3 min)

1. **Vanaf** vorige test (of open rooster uit lijst)
2. **Check URL**: bevat `/planning/design/dashboard?rosterId=`
3. **Check Pagina**:
   - [ ] Dashboard laadt
   - [ ] Periode info zichtbaar (weeknummers, datums)
   - [ ] Status indicators aanwezig
   - [ ] Navigatie knoppen werken
   - [ ] Geen console errors (F12 → Console tab)

**✅ PASS** als dashboard volledig laadt  
**❌ FAIL** als witte pagina of errors

---

### TEST 4: Planning Grid Opent (⌛ 3 min)

1. **Navigeer** naar Planning Grid (via menu of link)
2. **Check URL**: `/planning?rosterId=`
3. **Check Grid**:
   - [ ] Tabel wordt getoond
   - [ ] 5 weken zichtbaar (35 kolommen)
   - [ ] Weeknummers in headers
   - [ ] Datums correct (dd-mm formaat)
   - [ ] Medewerkers als rijen
   - [ ] Geen "undefined" of "null" teksten

**✅ PASS** als grid correct toont  
**❌ FAIL** als lege grid of errors

---

### TEST 5: Data Persistentie (⌛ 5 min)

1. **Maak** een wijziging:
   - Voeg dienst toe (als mogelijk)
   - Of: verander status
   - Of: noteer huidige roster ID

2. **Refresh** pagina (F5 of Ctrl+R)
3. **Check**:
   - [ ] Pagina laadt opnieuw
   - [ ] Data is NIET verloren
   - [ ] Zelfde roosters zichtbaar
   - [ ] Wijziging is behouden

4. **Navigeer** weg en terug:
   - Ga naar dashboard
   - Open zelfde rooster opnieuw
   - [ ] Data nog steeds aanwezig

**✅ PASS** als data blijft bestaan  
**❌ FAIL** als data verdwijnt

---

### TEST 6: Browser Console Check (⌛ 2 min)

1. **Open** Developer Tools:
   - Chrome/Edge: F12
   - Firefox: F12
   - Safari: Cmd+Option+I (Mac)

2. **Ga** naar Console tab
3. **Check**:
   - [ ] Geen rode errors
   - [ ] Geen "Failed to fetch" messages
   - [ ] Geen "Uncaught" errors
   - Warnings (geel) zijn OK

4. **Ga** naar Network tab
5. **Refresh** pagina
6. **Check**:
   - [ ] Requests naar Supabase slagen (groen)
   - [ ] Geen 500/400 errors (behalve evt. 404 voor images)

**✅ PASS** als geen kritieke errors  
**❌ FAIL** als rode errors

---

## 📊 SUPABASE DATABASE CHECK

### Via Supabase Dashboard (⌛ 5 min)

1. **Login** op https://supabase.com
2. **Open** je project
3. **Ga** naar "Table Editor"

#### Check Roosters Tabel
4. **Klik** op `roosters` tabel
5. **Check**:
   - [ ] Nieuwe rows zichtbaar
   - [ ] `start_date` en `end_date` correct (YYYY-MM-DD)
   - [ ] `status` = draft/in_progress/final
   - [ ] `created_at` heeft recente timestamp

#### Check Roster Design Tabel
6. **Klik** op `roster_design` tabel
7. **Check**:
   - [ ] Rows voor nieuwe roosters
   - [ ] `roster_id` komt overeen met roosters tabel
   - [ ] `employees` JSON bevat array
   - [ ] `unavailability_data` JSON is valid

**✅ PASS** als data correct in database  
**❌ FAIL** als data ontbreekt of incorrect

---

## 📝 RESULTATEN RAPPORTEREN

### Vul in na testen:

```markdown
## MIJN TEST RESULTATEN

Datum: [12 nov 2025]
Tester: [Jouw naam]
Browser: [Chrome / Firefox / Safari]

### Tests
- [ ] TEST 1: Dashboard Werkt
- [ ] TEST 2: Nieuw Rooster Aanmaken  
- [ ] TEST 3: Roster Dashboard Laadt
- [ ] TEST 4: Planning Grid Opent
- [ ] TEST 5: Data Persistentie
- [ ] TEST 6: Browser Console Check
- [ ] Supabase Database Check

### Problemen Gevonden
1. [Beschrijf probleem]
2. [Beschrijf probleem]

### Conclusie
- [ ] ✅ ALLE TESTS GESLAAGD - Ready for use!
- [ ] ❌ ISSUES GEVONDEN - Needs fixes
```

---

## 🐛 PROBLEEM? ZO OPLOSSEN

### App laadt niet
1. Check Railway deployment status
2. Ga naar https://railway.app
3. Open je project → bekijk logs
4. Zoek naar errors in deployment

### Data verdwijnt
1. Check Supabase status: https://status.supabase.com
2. Verifieer environment variables in Railway
3. Check browser localStorage (F12 → Application tab)

### Console errors
1. Screenshot maken van error
2. Noteer op welke pagina het gebeurt
3. Check of Supabase credentials kloppen

---

## ✅ SUCCESS CRITERIA

**Je bent klaar als**:
- ✅ Alle 6 tests slagen
- ✅ Geen rode errors in console
- ✅ Data persistent na refresh
- ✅ Supabase database gevuld

**Dan is de migratie succesvol!** 🎉
