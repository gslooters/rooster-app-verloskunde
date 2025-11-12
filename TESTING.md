# 🧪 Quick Start - App Testen

## 🚀 Direct Beginnen

### 1. Automated Tests (5 minuten)

```bash
# Installeer dependencies (eenmalig)
npm install

# Run test script
npx tsx scripts/test-migration.ts
```

**Verwacht resultaat**: Alle tests groen ✅

### 2. Manual Testing (15 minuten)

**Open je app**: `https://[jouw-railway-app].railway.app`

#### Test Scenario 1: Dashboard

1. 🏠 Ga naar Dashboard
2. ✅ Check: Bestaande roosters zichtbaar?
3. ✅ Check: "Nieuw Rooster" knop werkt?

#### Test Scenario 2: Nieuw Rooster

1. 🎯 Klik "Nieuw Rooster"
2. 🗓️ Selecteer eerste vrije periode
3. 👥 Controleer medewerkerslijst
4. ✅ Bevestig aanmaken
5. ✅ Check: Redirect naar rooster dashboard?

#### Test Scenario 3: Planning Grid

1. 📋 Open een rooster
2. ✅ Check: 5 weken zichtbaar?
3. ✅ Check: Medewerkers rijen geladen?
4. ✅ Check: Datums kloppen?

#### Test Scenario 4: Data Persistentie

1. 💾 Maak wijziging in rooster
2. 🔄 Refresh pagina (F5)
3. ✅ Check: Data nog aanwezig?

---

## 🔍 Dieper Testen

Voor uitgebreide test checklist: zie **[TEST_RESULTS.md](./TEST_RESULTS.md)**

---

## ❓ Problemen?

### Test Script Faalt

```bash
# Check environment variables
cat .env.local

# Verifieer Supabase connectie
# NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten gevuld zijn
```

### App Laadt Niet

1. Check Railway logs: `railway logs`
2. Check browser console (F12)
3. Verifieer Supabase status

### Database Errors

1. Check Supabase dashboard
2. Verifieer table schema's
3. Check RLS policies

---

## 📊 Status Checken

### Railway Deployment

```bash
# Check deployment status
railway status

# View live logs
railway logs --follow
```

### Database Health

1. Open Supabase Dashboard
2. Ga naar Table Editor
3. Check `roosters` table heeft data
4. Check `roster_design` table heeft data

---

## ✅ Klaar voor Productie?

- [ ] Automated tests: PASS
- [ ] Manual tests: PASS  
- [ ] Geen console errors
- [ ] Performance OK (<3s laden)
- [ ] Data persistent na refresh

**Als alles groen is: GO! 🎉**
