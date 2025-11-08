# 🚀 Deployment Instructies: Diensten Supabase Integratie

**Sprint:** Diensten Cloud Opslag v1.0  
**Datum:** 8 november 2025  
**Status:** ✅ Code gedeployed naar GitHub

---

## 🎯 Wat is er geïmplementeerd?

### Backend (`lib/services/diensten-storage.ts`)
- ✅ Volledige CRUD operaties via Supabase
- ✅ Realtime subscriptions voor live updates
- ✅ Systeemdiensten bescherming (NB, ===)
- ✅ Referential integrity checks (schedules + employees)
- ✅ Health check en read-only fallback bij storing
- ✅ Cache strategie voor offline resilience

### Frontend (`app/services/types/page.tsx`)
- ✅ Async data loading met proper error handling
- ✅ Realtime subscriptions UI integratie
- ✅ Supabase health indicator in UI
- ✅ Loading states en submitting feedback
- ✅ Disabled buttons tijdens database outage

---

## 🛠️ Railway Deployment Stappen

### 1️⃣ Git Push Verificatie

```bash
# Controleer of laatste commits zichtbaar zijn op GitHub
git log --oneline -5

# Verwachte output:
# 8f32018 🔄 UPDATE: Diensten UI met async Supabase + realtime sync
# e7d80f8 🚀 FEAT: Volledige Supabase integratie voor diensten met realtime sync
```

✅ **Status:** Beide commits zijn succesvol gepusht!

---

### 2️⃣ Railway Auto-Deploy Trigger

Railway detecteert automatisch nieuwe commits op de `main` branch en start een nieuwe build.

**Verificatie:**
1. Ga naar [Railway Dashboard](https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f)
2. Selecteer de `roosterVA` service
3. Klik op de **"Deployments"** tab
4. Controleer of er een nieuwe deployment is gestart

**Verwachte status:**
```
Building... → Deploying... → Active ✅
```

---

### 3️⃣ Environment Variables Check

Controleer of de Supabase credentials correct zijn ingesteld in Railway:

**Vereiste variabelen:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://iamfbmjjqvjqbpqwgpzl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Verificatie in Railway:**
1. Ga naar **Settings** → **Variables**
2. Controleer of beide variabelen aanwezig zijn
3. Klik **Redeploy** als je wijzigingen hebt gemaakt

---

### 4️⃣ Supabase Database Verificatie

Controleer of de `service_types` tabel correct is ingesteld:

**Vereiste kolommen:**
```sql
CREATE TABLE service_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  naam TEXT NOT NULL,
  beschrijving TEXT,
  begintijd TEXT NOT NULL DEFAULT '08:00',
  eindtijd TEXT NOT NULL DEFAULT '16:00',
  duur NUMERIC NOT NULL DEFAULT 8,
  kleur TEXT NOT NULL DEFAULT '#10B981',
  dienstwaarde NUMERIC NOT NULL DEFAULT 1,
  system BOOLEAN NOT NULL DEFAULT false,
  actief BOOLEAN NOT NULL DEFAULT true,
  planregels TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Verificatie:**
1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard/project/iamfbmjjqvjqbpqwgpzl)
2. Klik op **Table Editor**
3. Selecteer `service_types` tabel
4. Controleer of systeemdiensten (NB, ===) aanwezig zijn met `system = true`

⚠️ **Belangrijk:** Systeemdiensten moeten handmatig toegevoegd worden als ze nog niet bestaan:

```sql
INSERT INTO service_types (id, code, naam, beschrijving, begintijd, eindtijd, duur, kleur, dienstwaarde, system, actief, planregels)
VALUES 
  ('st1', 'NB', 'Niet Beschikbaar', 'Medewerker is niet beschikbaar voor inpl', '00:00', '00:00', 0, '#FFE066', 0.0, true, true, NULL),
  ('st2', '===', 'Rooster vrij', 'De medewerker is deze dag vrij volgens h', '00:00', '00:00', 0, '#B7E5CD', 1.0, true, true, NULL)
ON CONFLICT (code) DO NOTHING;
```

---

### 5️⃣ Realtime Subscriptions Verificatie

Controleer of Supabase Realtime is ingeschakeld voor de `service_types` tabel:

**Stappen:**
1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard/project/iamfbmjjqvjqbpqwgpzl)
2. Klik op **Database** → **Replication**
3. Zoek naar `service_types` in de lijst
4. Zorg dat **"Enable Realtime"** is aangevinkt (✅)

---

## 🧪 Testing Checklist

### Na deployment, test het volgende:

#### ✅ Basis Functionaliteit
- [ ] Diensten pagina laadt zonder errors
- [ ] Alle diensten zijn zichtbaar (inclusief NB en ===)
- [ ] Systeemdiensten hebben "SYSTEEM" badge
- [ ] Health indicator toont "Online" (🟢)

#### ✅ CRUD Operaties
- [ ] **Create:** Nieuwe dienst aanmaken werkt
- [ ] **Read:** Diensten worden opgehaald uit Supabase
- [ ] **Update:** Bestaande dienst bewerken werkt
- [ ] **Delete:** Dienst verwijderen werkt (niet voor systeemdiensten)

#### ✅ Systeemdiensten Bescherming
- [ ] NB en === hebben geen "Bewerken" of "Verwijderen" knoppen
- [ ] Poging om systeemdienst te verwijderen geeft foutmelding
- [ ] Alleen "Actief" toggle werkt voor systeemdiensten

#### ✅ Realtime Sync (test met 2 browser tabs)
1. Open de diensten pagina in 2 verschillende tabs
2. Voeg een nieuwe dienst toe in tab 1
3. Controleer of de dienst **automatisch** verschijnt in tab 2 (binnen 1-2 seconden)
4. Bewerk een dienst in tab 2
5. Controleer of de wijziging **automatisch** verschijnt in tab 1

#### ✅ Referential Integrity
- [ ] Dienst die in een rooster zit kan niet verwijderd worden
- [ ] Dienst die gekoppeld is aan medewerker kan niet verwijderd worden
- [ ] Foutmelding toont specifieke reden waarom niet verwijderd kan worden

#### ✅ Error Handling
- [ ] Bij Supabase storing: health indicator toont "Offline" (🟡)
- [ ] Bij Supabase storing: waarschuwingsbanner verschijnt bovenaan pagina
- [ ] Bij Supabase storing: "Nieuwe Dienst" knop is disabled
- [ ] Bij Supabase storing: cached diensten blijven zichtbaar (read-only)

---

## 🐛 Troubleshooting

### Probleem: Diensten laden niet

**Mogelijke oorzaken:**
1. Supabase credentials niet correct in Railway
2. `service_types` tabel bestaat niet
3. RLS policies blokkeren toegang

**Oplossing:**
```sql
-- Disable RLS tijdelijk voor development
ALTER TABLE service_types DISABLE ROW LEVEL SECURITY;
```

---

### Probleem: Realtime updates werken niet

**Mogelijke oorzaken:**
1. Realtime niet ingeschakeld voor tabel
2. Supabase plan limiet bereikt (max 200 concurrent connections)

**Oplossing:**
1. Check Replication settings in Supabase
2. Controleer Supabase logs voor errors

---

### Probleem: "Database niet bereikbaar" melding

**Mogelijke oorzaken:**
1. Supabase project is gepauzeerd
2. Network connectivity issues
3. Rate limiting

**Oplossing:**
1. Controleer Supabase project status
2. Wacht 1-2 minuten en refresh pagina
3. Check browser console voor specifieke error messages

---

## 📊 Monitoring

### Railway Logs Checken

```bash
# Open Railway CLI (optioneel)
railway logs

# Verwachte output (geen errors):
# ✅ Services loaded asynchronously
# 📡 Starting realtime subscription for service_types...
# 📡 Subscription status: SUBSCRIBED
```

### Supabase Logs Checken

1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard/project/iamfbmjjqvjqbpqwgpzl)
2. Klik op **Logs** in het menu
3. Selecteer **Database** logs
4. Zoek naar queries op `service_types` tabel

---

## ✅ Success Criteria

Deployment is succesvol als:

1. ✅ Railway deployment status = "Active"
2. ✅ Applicatie is bereikbaar via Railway URL
3. ✅ Diensten pagina laadt zonder errors
4. ✅ Health indicator toont "Online"
5. ✅ Nieuwe dienst aanmaken werkt
6. ✅ Realtime sync werkt tussen tabs
7. ✅ Systeemdiensten zijn beschermd
8. ✅ Referential integrity checks werken

---

## 🔗 Nuttige Links

- **Railway Project:** https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f
- **Supabase Project:** https://supabase.com/dashboard/project/iamfbmjjqvjqbpqwgpzl
- **GitHub Repository:** https://github.com/gslooters/rooster-app-verloskunde
- **Live App URL:** [Wordt ingevuld na deployment]

---

## 📝 Volgende Stappen

Na succesvolle deployment van diensten:

1. **STAP 2:** Roosters (Periods) tabel migreren naar Supabase
2. **STAP 3:** Beschikbaarheid (Availability) tabel implementeren
3. **STAP 4:** Dienst toewijzingen (Schedules) tabel implementeren
4. **STAP 5:** Bezettingseisen implementeren

---

**Laatst bijgewerkt:** 8 november 2025  
**Versie:** 1.0  
**Status:** 🟢 Ready for deployment