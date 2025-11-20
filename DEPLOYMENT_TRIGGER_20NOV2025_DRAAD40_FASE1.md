# DEPLOYMENT TRIGGER - DRAAD40 FASE 1

**Datum**: 20 november 2025, 14:16 UTC  
**Draad**: DRAAD40B - Week Dagdelen Detail Scherm  
**Fase**: FASE 1 - Week Boundary Calculator  
**Status**: ✅ COMPLEET

## Wijzigingen

### Nieuwe Bestanden
- `lib/planning/weekBoundaryCalculator.ts` - Week Boundary Calculator implementatie

### Functionaliteit

1. **Type Definities**
   - `WeekBoundary`: Bevat week info + navigatie flags
   - `RosterPeriodInfo`: Volledige 5-weekse periode info

2. **Hoofdfuncties**
   - `getRosterPeriodInfo(rosterId)`: Haalt roster periode + alle 5 weken op
   - `getWeekBoundary(rosterId, weekNummer)`: Haalt specifieke week boundary op

3. **Helper Functies**
   - `isValidWeekNummer(weekNummer)`: Validatie
   - `getNextWeekNummer(currentWeek)`: Volgende week (of null)
   - `getPreviousWeekNummer(currentWeek)`: Vorige week (of null)

## Implementatie Details

### Database Query
```sql
SELECT id, start_date, end_date 
FROM roosters 
WHERE id = '[rosterId]'
```

### Week Berekening
- Week 1-5: Telkens 7 dagen (maandag t/m zondag)
- Week 1: `canGoBack=false`, `canGoForward=true`
- Week 2-4: beide `true`
- Week 5: `canGoBack=true`, `canGoForward=false`

### Validaties
- ✅ Roster bestaat check
- ✅ Start datum is maandag check
- ✅ WeekNummer tussen 1-5 check
- ✅ Error handling met duidelijke messages

## Test Criteria (volgens plan)

- [ ] Week 1: canGoBack=false, canGoForward=true, label="Week 1 van 5"
- [ ] Week 3: canGoBack=true, canGoForward=true, label="Week 3 van 5"
- [ ] Week 5: canGoBack=true, canGoForward=false, label="Week 5 van 5"
- [ ] Invalid week (0, 6) throws error
- [ ] Datums zijn correct (maandag-zondag)

## Volgende Stappen

**FASE 2**: ActionBar Component Update  
- Update `components/planning/week-dagdelen/ActionBar.tsx`
- Verwijder oude features
- Voeg week navigatie toe
- Team filters behouden

## Commits

- `014e85dc` - feat(DRAAD40): FASE 1 - Week Boundary Calculator implementatie

---

**Ready for Deployment** ✅  
**Geschatte tijd FASE 1**: 60 minuten  
**Actuele tijd**: Op schema
