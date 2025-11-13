# DRAAD26R - Startdatum Fix: Niet Beschikbaar Scherm

**Status:** ✅ OPGELOST EN GEDEPLOYED  
**Datum:** 13 november 2025  
**Prioriteit:** URGENT  
**Commits:**
- `307902691a88834851c928551cad54470fd443ea` - Fix startdatum logica
- `9c446afa64e84908d57dbca3a66d2e3a08e849a9` - Version bump

---

## 🔴 Probleem

Het "Niet Beschikbaar aanpassen" scherm toonde de verkeerde startdatum en week-alignment:

### Symptomen:
1. **Verkeerde startdatum**: Rooster startte op **zondag 23-11** in plaats van **maandag 24-11**
2. **Verkeerde NB dagen**: Medewerkers' niet-beschikbare dagen stonden op de verkeerde datums
3. **Inconsistentie**: Het "Diensten per Dag" scherm toonde wel de correcte data (vanaf maandag)

### Voorbeeld van de fout:

**Verwacht (zoals in Diensten per Dag scherm):**
```
Week 48: Ma 24/11 | Di 25/11 | Wo 26/11 | Do 27/11 | Vr 28/11 | Za 29/11
```

**Werkelijk (in NB scherm, FOUT):**
```
Week 48: Zo 23/11 | Ma 24/11 | Di 25/11 | Wo 26/11 | Do 27/11 | Vr 28/11 | Za 29/11
```

---

## 🔍 Root Cause Analyse

### Gevonden in bestand:
`app/planning/design/unavailability/UnavailabilityClient.tsx`

### Problematische code (oud):
```typescript
const startDate = new Date(designData.start_date || Date.now());
const dates: Date[] = Array(35).fill(0).map((_, i) => { 
  let d = new Date(startDate); 
  d.setDate(startDate.getDate() + i); 
  return d; 
});
```

**Probleem:**
- Gebruikte `designData.start_date` direct uit database
- Deze datum was zondag 23-11 (1 dag te vroeg)
- Geen correctie naar maandag zoals andere schermen wel doen

---

## ✅ Oplossing

### Nieuwe functie toegevoegd:
```typescript
function getDaysInRangeStartingMonday(referenceDate: Date): Date[] {
  const refDate = new Date(referenceDate);
  
  // Vind de eerste maandag
  const dayOfWeek = refDate.getDay(); // 0 = zo, 1 = ma, 2 = di, etc.
  
  let daysToAdd = 0;
  if (dayOfWeek === 0) {
    // Als het zondag is, ga 1 dag vooruit naar maandag
    daysToAdd = 1;
  } else if (dayOfWeek > 1) {
    // Als het dinsdag of later is, ga terug naar vorige maandag
    daysToAdd = 1 - dayOfWeek; // negatief getal
  }
  // Als dayOfWeek === 1 (maandag), blijft daysToAdd 0
  
  const firstMonday = new Date(refDate);
  firstMonday.setDate(refDate.getDate() + daysToAdd);
  firstMonday.setHours(0, 0, 0, 0);
  
  // Genereer 35 dagen vanaf deze eerste maandag
  const dates: Date[] = [];
  for (let i = 0; i < 35; i++) {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}
```

### Aangeroepen in component:
```typescript
const referenceDate = designData.start_date 
  ? new Date(designData.start_date + 'T00:00:00')
  : new Date();

const dates = getDaysInRangeStartingMonday(referenceDate);
```

---

## ✨ Resultaat

### Voor de fix:
- ❌ Rooster begon op zondag 23-11
- ❌ NB dagen stonden op verkeerde datums
- ❌ Inconsistent met "Diensten per Dag" scherm

### Na de fix:
- ✅ Rooster begint op maandag 24-11
- ✅ NB dagen staan op correcte datums
- ✅ Consistent met alle andere schermen
- ✅ Weeknummers kloppen

---

## 📝 Technische Details

### Bestanden gewijzigd:
1. **app/planning/design/unavailability/UnavailabilityClient.tsx**
   - Nieuwe functie `getDaysInRangeStartingMonday()` toegevoegd
   - Oude datumgeneratie vervangen
   - Console logging toegevoegd voor debugging

2. **app/version.txt**
   - Versie gebumpt naar `nb-startdatum-fix-2025-11-13T15:50:00Z`

### Logica van de fix:

**Situatie 1: Input is zondag (dag 0)**
```
Input:  Zondag 23-11
Actie:  daysToAdd = 1 (vooruit)
Output: Maandag 24-11 ✅
```

**Situatie 2: Input is maandag (dag 1)**
```
Input:  Maandag 24-11
Actie:  daysToAdd = 0 (geen wijziging)
Output: Maandag 24-11 ✅
```

**Situatie 3: Input is woensdag (dag 3)**
```
Input:  Woensdag 26-11
Actie:  daysToAdd = -2 (terug naar maandag)
Output: Maandag 24-11 ✅
```

---

## 🛡️ Kwaliteitsborging

### Code review checklist:
- ✅ Syntaxcontrole uitgevoerd
- ✅ Console logging toegevoegd voor debugging
- ✅ Edge cases getest (zondag, maandag, andere dagen)
- ✅ Backward compatible (gebruikt fallback naar Date.now())
- ✅ TypeScript types correct
- ✅ Geen breaking changes

### Test scenario's:

| Scenario | Input Datum | Verwachte Output | Status |
|----------|-------------|------------------|--------|
| Zondag als start | 23-11-2025 (zo) | 24-11-2025 (ma) | ✅ |
| Maandag als start | 24-11-2025 (ma) | 24-11-2025 (ma) | ✅ |
| Midden van week | 26-11-2025 (wo) | 24-11-2025 (ma) | ✅ |
| Zaterdag als start | 29-11-2025 (za) | 24-11-2025 (ma) | ✅ |
| Geen start_date | null/undefined | Huidige week ma | ✅ |

---

## 🚀 Deployment

### Status:
✅ **GEDEPLOYED NAAR PRODUCTIE**

### Deployment stappen:
1. ✅ Code committed naar `main` branch
2. ✅ Version.txt geupdate
3. ✅ Railway auto-deploy getriggered
4. ⏳ **Volgende stap:** Gebruiker moet deployment verificatie uitvoeren

### Verwachte deployment tijd:
- Railway build: ~2-3 minuten
- Deploy: ~1 minuut
- Totaal: ~3-5 minuten

---

## 📝 Verificatie Instructies

Na deployment, controleer het volgende:

### 1. Open "Niet Beschikbaar aanpassen" scherm

### 2. Controleer de headers:
```
Eerste kolom moet zijn: Ma 24/11
Laatste kolom (week 48): Za 29/11
```

### 3. Vergelijk met "Diensten per Dag" scherm:
- Beide moeten beginnen op **maandag 24-11**
- Beide moeten eindigen op **zondag 28-12**
- Weeknummers moeten identiek zijn

### 4. Test NB markering:
- Klik op een lege cel -> moet NB worden
- Controleer of datum klopt met verwachting
- Check in "Diensten per Dag" of NB daar ook correct verschijnt

---

## 🐛 Bekende Issues (opgelost)

### Issue 1: Zondag als startdatum
- **Status:** ✅ OPGELOST
- **Fix:** `getDaysInRangeStartingMonday()` corrigeert automatisch naar maandag

### Issue 2: Inconsistentie tussen schermen
- **Status:** ✅ OPGELOST
- **Fix:** Beide schermen gebruiken nu dezelfde logica

---

## 📊 Impact Analyse

### Geïmpacteerde functionaliteit:
- ✅ **Niet Beschikbaar scherm:** Datum headers nu correct
- ✅ **NB markering:** Opgeslagen op correcte datum
- ✅ **Weeknummer display:** Consistent met andere schermen

### Niet geïmpacteerde functionaliteit:
- ✅ **Diensten per Dag:** Geen wijziging (werkte al correct)
- ✅ **Dashboard:** Geen wijziging
- ✅ **Export functies:** Geen wijziging
- ✅ **Database:** Geen schema wijzigingen

---

## 🔐 Rollback Procedure

**Indien nodig, rollback naar vorige commit:**

```bash
git revert 307902691a88834851c928551cad54470fd443ea
git push origin main
```

**Of via GitHub UI:**
1. Ga naar commit history
2. Selecteer commit `1760e3a4b0df750471e50a6993ebe030351b85b7` (voor de fix)
3. Klik "Revert"

---

## 📚 Gerelateerde Documentatie

- **HOTFIX_DATUM_WEEKNUMMER.md**: Eerdere datum/weeknummer fixes
- **AUTO_FILL_NB_IMPLEMENTATIE.md**: NB auto-fill functionaliteit
- **lib/utils/date-helpers.ts**: Datum utility functies

---

## ✅ Conclusie

De startdatum fout in het "Niet Beschikbaar aanpassen" scherm is succesvol opgelost:

1. **Root cause geïdentificeerd:** Directe gebruik van `start_date` zonder correctie naar maandag
2. **Fix geïmplementeerd:** Nieuwe `getDaysInRangeStartingMonday()` functie
3. **Getest:** Alle edge cases gecovered
4. **Gedeployed:** Code staat klaar in productie
5. **Gedocumenteerd:** Volledig implementatierapport beschikbaar

**Status: ✅ GEREED VOOR PRODUCTIE**

---

*Implementatie uitgevoerd door: AI Assistant (Perplexity)*  
*Review vereist door: Govard Slooters*  
*Deployment verificatie: Te voltooien na Railway deploy*