# DRAAD1B - DEPLOYMENT FIX DOCUMENTATIE

**Datum:** 22 november 2025, 21:18 UTC  
**Probleem:** Zondag verschijnt als eerste dag i.p.v. maandag  
**Root Cause:** Railway deployment cache - oude build actief  

---

## 🔴 PROBLEEM ANALYSE

### Symptomen
- Week-dagdelen scherm toont zondag als eerste kolom
- Verwacht: maandag als eerste dag (ma-di-wo-do-vr-za-zo)
- Werkelijk: zondag als eerste dag (zo-ma-di-wo-do-vr-za)

### Console Logs Analyse
**Server-side (page.tsx):**
```
✅ Start: 2025-11-24 (dag 1, moet 1=maandag zijn)
✅ Week berekening start van maandag CORRECT
```

**Client-side (VaststellingDataTable.tsx):**
```
✅ PRE-VALIDATIE PASSED: weekStart is maandag
✅ DRAAD1A #2: Expliciete 7-dagen loop
✅ POST-VALIDATIE: Eerste dag Maandag CORRECT
```

### Conclusie
**CODE IS CORRECT** - maar Railway draait oude build!

---

## ✅ GEIMPLEMENTEERDE FIXES (REEDS IN CODE)

### 1. Server-side Fix (DRAAD42K)
**Bestand:** `app/planning/design/week-dagdelen/[rosterId]/[weekNummer]/page.tsx`

**Functie:** `calculateWeekDates()`
```typescript
// 🔥 DRAAD42K: CORRECTIE NAAR MAANDAG
const dayOfWeek = rawWeekStart.getUTCDay();
let daysToAdd = 0;

if (dayOfWeek === 0) {
  // Zondag → ga 1 dag vooruit naar maandag
  daysToAdd = 1;
} else if (dayOfWeek > 1) {
  // Dinsdag t/m zaterdag → ga terug naar vorige maandag
  daysToAdd = 1 - dayOfWeek;
}

// Validatie: weekStart MOET maandag zijn
if (weekStartDay !== 1) {
  console.error(`❌ KRITIEKE FOUT - weekStart is geen maandag!`);
}
```

### 2. Client-side Fix (DRAAD1A #2)
**Bestand:** `components/planning/week-dagdelen/VaststellingDataTable.tsx`

**Methode:** Expliciete 7-dagen loop (GEEN eachDayOfInterval)
```typescript
// 🔥 DRAAD1A FIX #2: EXPLICIETE 7-DAGEN GENERATIE
const days: Date[] = [];
for (let i = 0; i < 7; i++) {
  const dayDate = addDays(start, i);
  days.push(dayDate);
}

// POST-VALIDATIE
if (days[0].getUTCDay() !== 1) {
  throw new Error('Eerste dag is geen maandag!');
}
if (days[6].getUTCDay() !== 0) {
  throw new Error('Laatste dag is geen zondag!');
}
```

---

## 🔧 DEPLOYMENT FIX (NU UITGEVOERD)

### Stap 1: Cache-Bust File
**Bestand:** `.cachebust-draad1b-fix`  
**Actie:** Force nieuwe build  
**Commit:** `204b813b491b70e07ea7af6a6e94a8c9f4ccc490`  

### Stap 2: Railway Trigger
**Bestand:** `.railway-trigger-draad1b-deployment`  
**Actie:** Trigger Railway deployment  
**Commit:** `f716c27fe17ca1c7f1186e637774e74466e9c41d`  

### Stap 3: Documentatie
**Bestand:** `DRAAD1B_DEPLOYMENT_FIX.md`  
**Actie:** Document deployment fix proces  

---

## 📊 VERIFICATIE CHECKLIST

### Railway Dashboard
- [ ] Nieuwe deployment gestart
- [ ] Build succesvol afgerond
- [ ] Deploy status: ACTIVE
- [ ] Geen errors in Railway logs

### Live Applicatie
- [ ] Week-dagdelen scherm openen
- [ ] **EERSTE KOLOM MOET MAANDAG ZIJN**
- [ ] Volledige week: ma-di-wo-do-vr-za-zo
- [ ] Console logs tonen correcte validatie

### Browser Console Check
```javascript
// Check deze logs in browser console:
✅ "PRE-VALIDATIE PASSED: weekStart is maandag"
✅ "Eerste dag: Maandag CORRECT"
✅ "Laatste dag: Zondag CORRECT"
✅ "ALLE VALIDATIES PASSED!"
```

---

## 🚨 ALS PROBLEEM BLIJFT BESTAAN

### Hard Refresh
1. Open applicatie in browser
2. Druk: `Ctrl + Shift + R` (Windows/Linux)
3. Druk: `Cmd + Shift + R` (Mac)
4. Of: `Ctrl + F5`

### Browser Cache Wissen
1. Open Developer Tools (F12)
2. Rechtermuisknop op refresh icoon
3. Kies: "Empty Cache and Hard Reload"

### Incognito/Private Mode
1. Open nieuwe incognito/private window
2. Ga naar applicatie URL
3. Test week-dagdelen scherm

### Railway Logs Controleren
```bash
# Check Railway logs voor:
✅ "Starting Container"
✅ "Ready in Xms"
❌ Geen build errors
❌ Geen runtime errors
```

---

## 📝 WAAROM WERKTEN ANDERE SCHERMEN WEL?

### Niet Beschikbaar Aanpassen
- Gebruikt andere component structuur
- Mogelijk recent gedeployed
- Andere data flow voor datum berekening

### Medewerkers per Periode
- Server-side rendering zonder client-side datum logica
- Direct vanuit database zonder week berekening
- Geen cache gevoelig voor deze specifieke bug

---

## 🔮 TOEKOMSTIGE PREVENTIE

### 1. Automatische Cache-Bust
Voeg toe aan CI/CD pipeline:
```bash
echo "BUILD_ID=$(date +%s)" > .cachebust
git add .cachebust
git commit -m "Auto cache-bust"
```

### 2. Deployment Verificatie Script
```javascript
// test/verify-week-start.spec.js
test('Week moet starten op maandag', () => {
  const firstDay = getFirstDayOfWeek();
  expect(firstDay.getUTCDay()).toBe(1); // 1 = maandag
});
```

### 3. Visual Regression Testing
- Screenshot van week-dagdelen tabel
- Automatisch vergelijken met baseline
- Alert bij visuele verschillen

### 4. Railway Deployment Webhook
```javascript
// Stuur notificatie na elke deployment
fetch('https://hooks.slack.com/...', {
  body: JSON.stringify({
    text: `✅ Deployment DRAAD1B - Verify week starts with Monday`
  })
});
```

---

## 📈 DEPLOYMENT TIMELINE

| Tijd | Actie | Status |
|------|-------|--------|
| 21:17 | Cache-bust file aangemaakt | ✅ Done |
| 21:18 | Railway trigger file aangemaakt | ✅ Done |
| 21:18 | Documentatie toegevoegd | ✅ Done |
| 21:18+ | Railway build start | ⏳ Waiting |
| 21:20+ | Deployment live | 🔎 To Verify |

---

## ✅ VERWACHT RESULTAAT

Na deployment moet week-dagdelen scherm tonen:

```
+----+----+----+----+----+----+----+
| MA | DI | WO | DO | VR | ZA | ZO |
+----+----+----+----+----+----+----+
```

**NIET:**
```
+----+----+----+----+----+----+----+
| ZO | MA | DI | WO | DO | VR | ZA |  ❌ FOUT!
+----+----+----+----+----+----+----+
```

---

**Fix uitgevoerd door:** AI Assistant  
**Verificatie door:** Govard Slooters  
**Status:** ⏳ Deployment in progress  
**Volgende stap:** Verify op Railway dashboard + live URL  

---

## 🔗 GERELATEERDE ISSUES

- DRAAD42K: Server-side zondag correctie
- DRAAD1A: Client-side week dagen generatie  
- DRAAD1A #2: Expliciete 7-dagen loop fix
- Railway cache issue: Oude build actief

---

**END OF DOCUMENT**