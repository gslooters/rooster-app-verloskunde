# HOTFIX: Datum en Weeknummer Bug - Deployment Verificatie

**Datum:** 12 november 2025  
**Priority:** 🔴 KRITIEK  
**Status:** ✅ GEMERGED & DEPLOYING

---

## Samenvatting Fix

Probleem opgelost waarbij het **Rooster Ontwerp** scherm verkeerde weeknummers en datums toonde:
- **Voor fix:** Week 46-50 (incorrect)
- **Na fix:** Week 48-52 (correct - zoals in database)

---

## Technische Details

### Root Cause
1. `roster_design` tabel heeft GEEN `start_date` kolom
2. `start_date` en `end_date` zitten in `roosters` tabel
3. `getRosterDesignByRosterId()` deed geen JOIN met roosters tabel
4. Frontend kreeg geen periode data en gebruikte fallback naar huidige datum

### Oplossing
- **Backend:** JOIN `roster_design` met `roosters` tabel via `roster_id`
- **Frontend:** Gebruik `start_date` uit database, verbeterde error handling

### Gewijzigde Bestanden
1. `lib/services/roster-design-supabase.ts` - JOIN query toegevoegd
2. `app/planning/design/page.client.tsx` - Error handling + logging

---

## Deployment Status

### 1. Code Merged
- ✅ Pull Request #33 gemerged naar `main`
- ✅ Commit SHA: `79530e532b4c3bfa437ec7773b7b5edf25049c0b`

### 2. Railway Deployment
Railway detecteert automatisch de push naar `main` en start deployment:

**Expected timeline:**
- 0-30 sec: Railway detecteert push
- 30 sec - 2 min: Build process (npm install, next build)
- 2-3 min: Deploy nieuwe versie
- 3-4 min: Health checks + live

**Check deployment status:**
1. Open Railway dashboard: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
2. Kijk naar "Deployments" tab
3. Laatste deployment moet status "Active" hebben

---

## Verificatie Stappen

### Na Deployment (3-4 minuten)

#### 1. Browser Test
1. Open de app in browser
2. Navigeer naar **Dashboard** > **Rooster Planning**
3. Klik op een bestaand rooster (bijv. periode week 48-52)
4. Open **Rooster Ontwerp** scherm

#### 2. Visuele Checks
✅ **Weeknummer titels:**
- Moet tonen: "Week 48", "Week 49", "Week 50", "Week 51", "Week 52"
- **NIET:** "Week 46", "Week 47", etc.

✅ **Periode titel:**
- Moet tonen: "Rooster Ontwerp : Periode Week 48 - Week 52 2025"

✅ **Datum subtitle:**
- Moet tonen: "Van 24 november 2025 tot en met 28 december 2025"

✅ **Tabel kolommen:**
- Maandag kolom moet beginnen met datum "24" (24 nov)
- Laatste zondag moet eindigen met datum "28" (28 dec)

#### 3. Console Logs (Developer Tools)
Open browser console (F12) en check logs:

```javascript
// Verwachte output:
✅ Loaded roster design data: {
  rosterId: "...",
  start_date: "2025-11-24",
  end_date: "2025-12-28",
  employees: [aantal]
}

✅ Computing period from start_date: 2025-11-24

✅ Computed values: {
  startISO: "2025-11-24",
  periodTitle: "Rooster Ontwerp : Periode Week 48 - Week 52 2025",
  dateSubtitle: "Van 24 november 2025 tot en met 28 december 2025",
  weekNumbers: [48, 49, 50, 51, 52]
}
```

#### 4. Functionaliteit Test
✅ Diensten per dag aanpassen werkt
✅ NB (niet-beschikbaar) knoppen werken
✅ Max diensten invoer werkt
✅ Geen error meldingen in console

---

## Rollback Procedure

Als er TOCH problemen zijn na deployment:

### Optie 1: Git Revert (Aanbevolen)
```bash
# Lokaal
git checkout main
git pull origin main
git revert 79530e532b4c3bfa437ec7773b7b5edf25049c0b
git push origin main

# Railway deployed automatisch de revert binnen 2-3 minuten
```

### Optie 2: Railway Manual Rollback
1. Open Railway dashboard
2. Ga naar "Deployments"
3. Zoek vorige werkende deployment
4. Klik "Redeploy"

---

## Bekende Limitaties

1. **Nieuwe roosters:** Als een rooster wordt aangemaakt zonder start_date in roosters tabel, krijgt gebruiker foutmelding "Geen periode data beschikbaar"
   - **Oplossing:** Zorg dat rooster aanmaak proces altijd start_date in roosters tabel zet

2. **Oude data:** Als er oude roster_design records zijn zonder gekoppeld rooster in roosters tabel, falen de queries
   - **Oplossing:** INNER JOIN zorgt dat alleen roosters met geldige koppeling worden getoond

---

## Next Steps

### Direct (na deployment)
- [ ] Verificatie uitgevoerd door planner/gebruiker
- [ ] Screenshots van correcte weeknummers
- [ ] Bevestiging dat diensten aanpassen werkt

### Korte termijn (deze week)
- [ ] Voeg unit tests toe voor weeknummer berekening
- [ ] Voeg integration test toe voor JOIN query
- [ ] Review andere schermen die mogelijk zelfde bug hebben

### Lange termijn (volgende sprint)
- [ ] Evalueer database schema: moet start_date in roster_design?
- [ ] Voeg foreign key constraints toe (als nog niet aanwezig)
- [ ] Automatische data validatie bij rooster aanmaken

---

## Contact

Bij vragen of problemen:
- **Developer:** Perplexity AI (via chat interface)
- **Repository:** https://github.com/gslooters/rooster-app-verloskunde
- **Railway Project:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

---

**⚠️ LET OP:** Dit is een kritieke fix. Verifieer de deployment zo snel mogelijk na live gaan.
