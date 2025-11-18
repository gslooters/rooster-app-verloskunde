# Route Mapping - Rooster Applicatie Verloskunde

**Laatste Update:** 18 november 2025  
**Doel:** Voorkomen van route verwarring tijdens development

---

## 🗺️ Belangrijkste Routes

### Planning & Rooster Ontwerp

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Dashboard Rooster Ontwerp** | `/planning/design/dashboard` | `app/planning/design/dashboard/page.tsx` | Hoofddashboard voor rooster ontwerp |
| **Diensten per Dagdeel** | `/planning/period-staffing` | `app/planning/period-staffing/page.tsx` | Dagdeel staffing (ochtend/middag/avond) per team |
| **Planning Overzicht** | `/planning` | `app/planning/page.tsx` | Overzicht van alle roosters |
| **Nieuw Rooster** | `/planning/new` | `app/planning/new/page.tsx` | Nieuw rooster aanmaken |
| **Bewerk Planning** | `/planning/edit` | `app/planning/edit/page.tsx` | Planning bewerken |
| **Planning Detail** | `/planning/[id]` | `app/planning/[id]/page.tsx` | Specifiek rooster detail |

### Huidige Roosters

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Huidig Rooster** | `/current-roster` | `app/current-roster/page.tsx` | Actueel actief rooster |

### Medewerkers

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Medewerkers Overzicht** | `/employees` | `app/employees/page.tsx` | Lijst van alle medewerkers |

### Services/Diensten

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Services Beheer** | `/services` | `app/services/page.tsx` | Diensten configureren |

### Rapportages

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Rapportages** | `/reports` | `app/reports/page.tsx` | Diverse rapportages |

### Instellingen

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Instellingen** | `/settings` | `app/settings/page.tsx` | Applicatie instellingen |

### Authenticatie

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Login** | `/login` | `app/login/page.tsx` | Inloggen |

### Archief

| Scherm Naam | Route URL | Bestand | Beschrijving |
|-------------|-----------|---------|---------------|
| **Gearchiveerde Items** | `/archived` | `app/archived/page.tsx` | Archief overzicht |

---

## ⚠️ VEROUDERDE/DUPLICATE ROUTES

### Te Verifiëren

| Route URL | Bestand | Status | Actie Nodig |
|-----------|---------|--------|-------------|
| `/diensten-per-dag` | `app/diensten-per-dag/page.tsx` | ⚠️ Mogelijk duplicaat | Verificeer of route nog gebruikt wordt. Indien niet: verwijderen of redirect naar `/planning/period-staffing` |

---

## 📝 Next.js App Router Conventies

### Basis Regels

```
app/
├── folder-naam/
│   └── page.tsx          → Route: /folder-naam
│
├── parent/
│   ├── child/
│   │   └── page.tsx  → Route: /parent/child
│   └── page.tsx      → Route: /parent
│
└── [id]/
    └── page.tsx          → Route: /[dynamische-waarde]
```

### Speciale Bestanden

- `page.tsx` - Route pagina (verplicht voor een route)
- `layout.tsx` - Gedeelde layout voor route en sub-routes
- `loading.tsx` - Loading state
- `error.tsx` - Error boundary
- `not-found.tsx` - 404 pagina

### Private Folders

- `_components/` - Niet toegankelijk als route (begint met underscore)
- `_lib/` - Utility bestanden (niet toegankelijk als route)

---

## 🧪 Route Verificatie Checklist

**Voordat je code wijzigt:**

1. [ ] Vraag gebruiker om **exacte URL** uit browser
2. [ ] Zoek route in deze mapping tabel
3. [ ] Verifieer bestand pad klopt met URL
4. [ ] Check voor mogelijk duplicaten
5. [ ] Maak wijzigingen in **correct** bestand
6. [ ] Test lokaal indien mogelijk
7. [ ] Commit met duidelijke message
8. [ ] Vraag gebruiker om verificatie na deployment

---

## 🔍 Route Debug Hulpmiddelen

### Vind bestand bij URL

```bash
# Voorbeeld: URL is /planning/period-staffing
# Bestand is: app/planning/period-staffing/page.tsx

# Formule:
# URL: /[segment1]/[segment2]
# Bestand: app/[segment1]/[segment2]/page.tsx
```

### Vind alle routes

```bash
# Lijst alle page.tsx bestanden (= routes)
find app -name "page.tsx" -type f

# Converteer naar routes
# app/planning/design/dashboard/page.tsx → /planning/design/dashboard
```

### Check voor duplicaten

```bash
# Zoek vergelijkbare routes
find app -name "*staffing*" -o -name "*dagdeel*"
```

---

## 📚 Handige Links

- [Next.js App Router Routing](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js File Conventions](https://nextjs.org/docs/app/building-your-application/routing#file-conventions)
- [Railway Deployment Docs](https://docs.railway.app/)

---

## 📝 Wijzigingslog

### 2025-11-18
- ✅ Initiële versie aangemaakt
- ⚠️ Geïdentificeerd: mogelijke duplicaat route `/diensten-per-dag`
- 📝 Gedocumenteerd: belangrijkste routes
- 🧪 Toegevoegd: verificatie checklist

---

**Onderhoud:** Update dit document bij elke nieuwe route of wijziging