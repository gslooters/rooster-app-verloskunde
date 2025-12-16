# 🧪 GREEDY SERVICE TESTEN - COMPLETE UITVOERINGSHANDLEIDING

**Datum:** 16 December 2025  
**Tijd:** Ca. 30-45 minuten  
**Niveau:** Geen technische kennis nodig (browser-based)
**Taal:** Nederlands

---

## 🚀 START HIER

### Wat hebben we nodig?

```
✓ Webbrowser (Chrome, Firefox, Safari of Edge)
✓ Internetverbinding
✓ 15 minuten vrij
✓ Dit document
```

### Keuze: Hoe wil je testen?

```
OPTIE 1: Interactieve Test Suite (MAKKELIJKST)
→ Ga naar METHODE A hieronder

OPTIE 2: Swagger UI (VOELT ALS API DOCS)
→ Ga naar METHODE B hieronder

OPTIE 3: Browser Console (MEESTE CONTROLE)
→ Ga naar METHODE C hieronder
```

---

## 🕺 METHODE A: Interactieve Test Suite (AANBEVOLEN)

### Stap 1: Open de Test Suite

```
Keuze A: Direct openen uit browser
- Ga naar: https://raw.githubusercontent.com/gslooters/rooster-app-verloskunde/main/testing/GREEDY_TEST_SUITE.html
- Klik: rechter muisknop → "Opslaan als"
- Selecteer: Desktop
- Bestandsnaam: GREEDY_TEST_SUITE.html
- Klik: Opslaan

Keuze B: Via GitHub
- Ga naar: https://github.com/gslooters/rooster-app-verloskunde/blob/main/testing/GREEDY_TEST_SUITE.html
- Klik: Raw knop
- Klik: rechter muisknop → "Opslaan als"
- Volg de stappen
```

### Stap 2: Open het bestand in je browser

```
1. Zoek het bestand op je Desktop
2. Dubbelklik: GREEDY_TEST_SUITE.html
3. Je browser opent het bestand
```

### Stap 3: Voer de tests uit

```
🟢 BLAUW SCHERM OPENT

 Aan de linkerkant: "Test Console"
 Aan de rechterkant: "Test Results"

 Stap 3a: Klik op groene knop "Run Health Check"
   ✔ Je ziet: HTTP status + response time
   ✔ Wacht: ~1 seconde
   ✔ Resultaat verschijnt onder de knop

 Stap 3b: Klik op "Test Valid Request"
   ✔ Dit test: geldige aanvraag
   ✔ Verwacht: "Valid: true"

 Stap 3c: Klik op rode knop "Test Invalid UUID"
   ✔ Dit test: foutafhandeling
   ✔ Verwacht: "Valid: false" + error bericht

 Stap 3d: Klik op rode knop "Test Bad Date"
   ✔ Dit test: slechte datum formaat
   ✔ Verwacht: Error bericht

 Stap 3e: Klik op rode knop "Test Bad Date Range"
   ✔ Dit test: omgekeerd datumbereik
   ✔ Verwacht: Error bericht

 Stap 3f: Snelle manier: Klik "RUN ALL TESTS" knop
   ✔ Dit voert alle tests automatisch uit
   ✔ Wacht: ~30 seconden
   ✔ Zie alle resultaten tegelijk
```

### Stap 4: Lees de resultaten

```
🟩 GROEN = OK
🟥 ROOD = FOUT
🟨 GEEL = WAARSCHUWING

In de "Activity Timeline" zie je alle tests in volgorde
Elke regel toont:
  - Tijd van de test
  - Resultaat (OK/FOUT)
  - Details (response time, bericht)
```

---

## 📖 METHODE B: Swagger UI (Interactieve API Docs)

### Stap 1: Open Swagger

```
1. Ga naar: https://greedy-production.up.railway.app/docs
2. Je ziet: mooie interactieve documentatie
```

### Stap 2: Test Health Endpoint

```
1. Zoek: "GET /api/greedy/health" (blauw)
2. Klik erop: het zakt dicht
3. Klik: "Try it out"
4. Klik: "Execute"
5. Zie: Response + status + timing
```

### Stap 3: Test Validation Endpoint

```
1. Zoek: "POST /api/greedy/validate" (groen)
2. Klik erop: het zakt dicht
3. Klik: "Try it out"
4. Je ziet een JSON editor
5. Plak deze data:

{
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "max_shifts_per_employee": 8
}

6. Klik: "Execute"
7. Zie: Response (moet valid: true zijn)
```

### Stap 4: Test Error Cases

```
Voer hetzelfde uit, maar verander de data:

FOUT CASE 1 - Slechte UUID:
{
  "roster_id": "INVALID",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
}
Verwacht: valid: false + duidelijke error

FOUT CASE 2 - Slechte datum:
{
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "01-01-2025",
  "end_date": "2025-01-31"
}
Verwacht: valid: false + "YYYY-MM-DD" error

FOUT CASE 3 - Omgekeerde datum:
{
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-12-31",
  "end_date": "2025-01-01"
}
Verwacht: valid: false + date range error
```

---

## 📒 METHODE C: Browser Console (Geavanceerd)

### Voor fijnproevers die alles zien

### Stap 1: Console openen

```
Windows: F12
macOS: Command + Option + J
Linux: F12

→ Aan onderkant scherm verschijnt: Console
```

### Stap 2: Health Check testen

```
Type in console en druk Enter:

fetch('https://greedy-production.up.railway.app/health')
  .then(r => r.json())
  .then(d => console.log(d))

Je ziet: compleet response object met alle details
```

### Stap 3: Validation testen

```
Type dit in console:

const data = {
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
};

fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))

Je ziet: validation response
```

### Stap 4: Performance testen

```
Type dit in console:

const start = performance.now();
fetch('https://greedy-production.up.railway.app/api/greedy/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({roster_id: "550e8400-e29b-41d4-a716-446655440000", start_date: "2025-01-01", end_date: "2025-01-31"})
})
.then(r => r.json())
.then(d => {
  const elapsed = performance.now() - start;
  console.log('Response time:', elapsed.toFixed(0), 'ms');
  console.log(d);
})

Je ziet: hoe lang het duurde + response
```

---

## 📊 VERWACHTE RESULTATEN

### TEST 1: Health Check ✅

```
Status: 200 OK
Response Time: < 500ms

Je ziet iets als:
{
  "service": "greedy-rostering-engine",
  "version": "1.0.0",
  "status": "ready"
}

Succes als:
✓ Status = 200
✓ "status": "ready"
✓ Sneller dan 500ms
```

### TEST 2: Valid Request ✅

```
Je ziet iets als:
{
  "valid": true,
  "message": "Request is valid",
  "roster_id": "550e8400-e29b-41d4-a716-446655440000",
  "period": "2025-01-01 to 2025-01-31"
}

Succes als:
✓ "valid": true
✓ "message" bevat "valid"
```

### TEST 3: Invalid UUID ✅

```
Je ziet iets als:
{
  "valid": false,
  "message": "Invalid roster_id: 'INVALID' (not valid UUID)",
  "error": "Invalid roster_id: 'INVALID' (not valid UUID)"
}

Succes als:
✓ "valid": false
✓ Error bericht noemt "UUID"
✓ Duidelijk wat er fout is
```

### TEST 4: Bad Date Format ✅

```
Je ziet iets als:
{
  "valid": false,
  "message": "Invalid start_date: '01-01-2025' (expected YYYY-MM-DD)"
}

Succes als:
✓ "valid": false
✓ Noemt "YYYY-MM-DD" format
✓ Duidelijke error
```

### TEST 5: Bad Date Range ✅

```
Je ziet iets als:
{
  "valid": false,
  "message": "Invalid date range: start_date (2025-12-31) must be before end_date (2025-01-01)"
}

Succes als:
✓ "valid": false
✓ Noemt "date range"
✓ Toont de datums
```

---

## 📢 WAARSCHIJNLIJKE PROBLEMEN & OPLOSSINGEN

### Probleem 1: "Cannot reach server"

```
Oorzaak: Service offline of verkeerde URL

Oplossing:
1. Controleer: https://greedy-production.up.railway.app/
2. Moet "ready" antwoord geven
3. Controleer Railway dashboard
4. Service moet groen status hebben
```

### Probleem 2: "CORS Error" (in console)

```
Oorzaak: Browser security (NORMAAL)
Oplossing: Dit is verwacht en geen probleem
De server CORS correct geconfigureerd is
```

### Probleem 3: Test duurt > 5 seconden

```
Oorzaak: Network latency of server traag

Oplossing:
1. Probeer wachten 10 seconden
2. Herlaad pagina (F5)
3. Probeer opnieuw
4. Check internet snelheid
```

### Probleem 4: JSON Parse Error

```
Oorzaak: Slechte JSON in body

Oplossing:
1. Check je data dubbel
2. Zorg alle strings in aanhalingstekens staan
3. Zorg alle komma's correct zijn
4. Gebruik copy-paste van dit document
```

---

## 📋 SCORING TABEL

Tussel na elke test in deze tabel:

```
TEST                          STATUS        TIME      NOTITIES
================================================
Health Check                  ✅/❌         ___ ms    ___________
Valid Request                 ✅/❌         ___ ms    ___________
Invalid UUID Error            ✅/❌         ___ ms    ___________
Bad Date Error                ✅/❌         ___ ms    ___________
Bad Range Error               ✅/❌         ___ ms    ___________
================================================

TOTAAL SCORE:  __/5 tests gepasseerd

GO / NO-GO: ✅ GO (alles groen) / ❌ PROBLEMEN (iets rood)
```

---

## 🌟 WANNEER KLAAR?

### Groen licht om verder te gaan ✅

```
✓ Alle 5 tests groen
✓ Response times < 1 seconde (normaal)
✓ Geen error messages
✓ Alle validaties werken
✓ Error handling werkt
✓ Service antwoordt consistent

Als dit klopt:
🎉 JE BENT KLAAR! ‼️
Ga naar STAP 4: Frontend Integration
```

### Rood licht ❌

```
❌ Enige test mislukt
❌ Timeouts (> 2 seconden)
❌ Server errors (500)
❌ Inconsistente responses

Als dit klopt:
• Debug het probleem
• Check Railway logs
• Controleer Supabase verbinding
• Probeer opnieuw
```

---

## 💲 TIME ESTIMATE

```
Health Check               2-3 min
Validation test           3-4 min
Error handling (3 tests)   10-12 min
Overzicht lezen           5-10 min

TOTAAL:                   20-30 min

Plus buffer: +10 min als debugging nodig
```

---

## 🌟 KORTE SAMENVATTING

```
1. Keuze testmethode (A, B, of C)
2. Open service/test suite
3. Voer tests uit (5 totaal)
4. Lees resultaten
5. Zet scores in tabel
6. Geef signaal: GO of NO-GO
7. Volgende stap:
   - GO: Start STAP 4
   - NO-GO: Debug + retry
```

---

## 📁 DOCUMENT INFO

**Versie:** 1.0  
**Taal:** Nederlands  
**Lastniveau:** Basis (geen coding kennis nodig)  
**Geschikt voor:** HR, projectmanager, tester  
**Geschatte tijd:** 30-45 minuten  

---

## 🌈 VOLGENDE STAP

Als alle tests groen:

```
STAP 4: FRONTEND INTEGRATION
• Frontend update (buttons toevoegen)
• Dashboard aanpassen
• GREEDY knop implementeren
• Solver2 knop behouden (fallback)

Duur: ~1 dag
```

---

**Veel succes met testen! 🚀**

Vragen? Kijk in: `testing/STAP3_TEST_PLAN.md`
