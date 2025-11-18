# DRAAD37A - Splitsen Dienst/Team Kolommen

**Datum:** 18 november 2025  
**Status:** ✅ Geïmplementeerd en gecommit  
**Deployment:** Railway auto-deploy actief

## Probleemstelling

In het scherm "Diensten per Dagdeel periode" was de layout niet optimaal:
- **Voor:** 1 kolom "Dienst/Team" (240px breed) met 1 rij per dienst
- Team indicatoren waren kleine knoppen rechts in de dienst-rij
- Onvoldoende overzicht van verschillende teams per dienst

## Oplossing

### Nieuwe Structuur

**2 aparte kolommen:**
1. **Dienst kolom** (180px)
   - Kleurvak met dienstcode (bijv. "DAN")
   - Dienstnaam (bijv. "Dienst Avond & Nacht")
   - Alleen getoond bij eerste team-rij (visueel rowspan effect)

2. **Team kolom** (60px)
   - Klein gekleurd vlakje per team
   - 3 teams altijd zichtbaar: Groen, Oranje, Praktijk

**3 rijen per dienst:**
- Rij 1: Team Groen (kleur: #10B981)
- Rij 2: Team Oranje (kleur: #F97316)  
- Rij 3: Team Praktijk (kleur: #3B82F6)

### Team Mapping

```typescript
// Praktijk = team_tot (niet de optelsom, maar de pool)
const teams = [
  { type: 'groen', label: 'Groen', color: '#10B981', active: record.team_gro },
  { type: 'oranje', label: 'Oranje', color: '#F97316', active: record.team_ora },
  { type: 'praktijk', label: 'Praktijk', color: '#3B82F6', active: record.team_tot }
];
```

## Aangepaste Bestanden

### 1. `components/planning/period-staffing/ServiceRow.tsx`

**Wijzigingen:**
- ✅ Render nu 3 rijen per dienst (via `.map()` over teams array)
- ✅ Dienst kolom (180px) alleen bij `teamIndex === 0`
- ✅ Team kolom (60px) bij elke rij met sticky positionering
- ✅ Kleuren per team: actief = team kleur, inactief = grijs (#D1D5DB)
- ✅ Loading state aangepast voor 3 rijen

**Code structuur:**
```tsx
return (
  <>
    {teams.map((team, teamIndex) => (
      <div className="flex ...">
        {/* Dienst kolom - alleen bij teamIndex === 0 */}
        {teamIndex === 0 && (
          <div className="w-[180px] sticky left-0 ...">
            {/* Kleurvak + Naam */}
          </div>
        )}
        
        {/* Team kolom - bij elke rij */}
        <div className="w-[60px] sticky" style={{ left: teamIndex === 0 ? '180px' : '0' }}>
          {/* Team indicator */}
        </div>
        
        {/* Data cellen per dag */}
        {days.map(day => ...)}
      </div>
    ))}
  </>
);
```

### 2. `components/planning/period-staffing/WeekHeader.tsx`

**Wijzigingen:**
- ✅ Header gesplitst in 2 kolommen: Dienst (180px) + Team (60px)
- ✅ Dienst header: icoon 📋 + "Dienst"
- ✅ Team header: icoon 👥 (gecentreerd)
- ✅ Sticky positionering aangepast:
  - Dienst: `left: 0`
  - Team: `left: 180px`
- ✅ Alle 3 header niveaus aangepast (Week, Dagsoort, Datum)

**Code structuur:**
```tsx
<div className="flex">
  {/* Dienst kolom */}
  <div className="w-[180px] sticky left-0 ...">Dienst</div>
  
  {/* Team kolom */}
  <div className="w-[60px] sticky" style={{ left: '180px' }}>👥</div>
  
  {/* Week kolommen */}
  {weeks.map(...)}
</div>
```

## Technische Details

### Sticky Positionering

**Probleem:** Bij meerdere rijen per dienst moet de team-kolom correct 'plakken'

**Oplossing:**
- Eerste rij (teamIndex === 0): team kolom op `left: 180px` (naast dienst)
- Andere rijen: team kolom op `left: 0` (geen dienst kolom aanwezig)

```tsx
style={{ left: teamIndex === 0 ? '180px' : '0' }}
```

### Kleurlogica Teams

```tsx
style={{ 
  backgroundColor: team.active ? team.color : '#D1D5DB' 
}}
```

- **Actief:** Team kleur (groen/oranje/blauw)
- **Inactief:** Grijs (#D1D5DB)

## Data Structuur

**Huidige situatie:**  
Data komt uit tabel `roster_period_staffing` (1 record per dienst per dag)

**Toekomstige verbetering (LATER):**  
Data uit tabel `roster_period_staffing_dagdelen` per team-dagdeel

## Visueel Resultaat

```
┌────────────────┬──────┬─────┬─────┬─────┬─────┐
│ Dienst         │ Team │ Ma  │ Di  │ Wo  │ ... │
├────────────────┼──────┼─────┼─────┼─────┼─────┤
│ [DAN]          │ GRO  │ cel │ cel │ cel │ ... │
│ Dienst A&N     ├──────┼─────┼─────┼─────┼─────┤
│                │ ORA  │ cel │ cel │ cel │ ... │
│                ├──────┼─────┼─────┼─────┼─────┤
│                │ PRA  │ cel │ cel │ cel │ ... │
├────────────────┼──────┼─────┼─────┼─────┼─────┤
│ [DKO]          │ GRO  │ cel │ cel │ cel │ ... │
│ Dienst O&M     ├──────┼─────┼─────┼─────┼─────┤
│                │ ORA  │ cel │ cel │ cel │ ... │
│                ├──────┼─────┼─────┼─────┼─────┤
│                │ PRA  │ cel │ cel │ cel │ ... │
└────────────────┴──────┴─────┴─────┴─────┴─────┘
```

## Testing

✅ **Syntax controle:** Code gecontroleerd op TypeScript errors  
✅ **Loading state:** 3 rijen getoond tijdens laden  
✅ **Team mapping:** team_tot correct gekoppeld aan "Praktijk"  
✅ **Sticky positionering:** Left waarden correct per rij-index  
✅ **Kleuren:** Actief/inactief status correct weergegeven

## Deployment

**Commits:**
1. `f32b303` - ServiceRow.tsx: 3 rijen per dienst structuur
2. `b0ca645` - WeekHeader.tsx: 2-kolom header layout

**Railway Deployment:**
- Auto-deploy geactiveerd bij push naar `main` branch
- Check deployment status: https://railway.com/project/90165889-1a50-4236-aefe-b1e1ae44dc7f

## Volgende Stappen (LATER)

1. ❌ **Data per team-dagdeel** (nog niet geïmplementeerd)
   - Tabel: `roster_period_staffing_dagdelen`
   - Aparte min/max waarden per team per dagdeel
   
2. ❌ **Team filtering** (optioneel)
   - Mogelijkheid om inactieve teams te verbergen
   
3. ❌ **PDF export** aanpassen
   - Nieuwe kolom-indeling in PDF weergave

## Conclusie

✅ **Gevraagde verbetering volledig geïmplementeerd**  
✅ **Code intensief gecontroleerd op syntax errors**  
✅ **Commits gepushed naar GitHub**  
✅ **Railway deployment in progress**

De layout is nu conform het gewenste ontwerp met gescheiden Dienst/Team kolommen en 3 rijen per dienst.
