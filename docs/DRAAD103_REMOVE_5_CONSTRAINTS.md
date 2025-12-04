# DRAAD 103: Verwijderen 5 Niet-Functionerende Planregels

## Context
Geen van de 5 planregels heeft ooit functioneel gewerkt. Eerder zijn er al 2 verwijderd.
Nu worden de resterende 5 verwijderd uit de codebase en database.

## Verwijderde Constraint Types (5 stuks)

### 1. availability (Beschikbaarheid)
- **Omschrijving**: Medewerker beschikbaarheid
- **Reden verwijdering**: Nooit geïmplementeerd

### 2. teamdagblokrules (Team dagblok regels)
- **Omschrijving**: Team-specifieke dagblok regels
- **Reden verwijdering**: Nooit geïmplementeerd

### 3. fairnessbalance (Eerlijke verdeling)
- **Omschrijving**: Eerlijke verdeling van diensten
- **Reden verwijdering**: Nooit geïmplementeerd

### 4. workloadmax (Max. werkdagen)
- **Omschrijving**: Maximum werkdagen per periode
- **Reden verwijdering**: Nooit geïmplementeerd

### 5. minserviceperperiod (Min. dienst team)
- **Omschrijving**: Minimum diensten per team per periode
- **Reden verwijdering**: Nooit geïmplementeerd

## Overgebleven Constraint Types (7 stuks)

### 1. coverageminimum
- **NL Label**: Minimale bezetting
- **Status**: ✅ Functioneel

### 2. employeeservices
- **NL Label**: Bevoegdheden
- **Status**: ✅ Functioneel

### 3. preassignments
- **NL Label**: Pre-planning
- **Status**: ✅ Functioneel

### 4. consecutiverest
- **NL Label**: Rustdag na nachtdienst
- **Status**: ✅ Functioneel

### 5. blocksnextday
- **NL Label**: Blokkeert volgdag
- **Status**: ✅ Functioneel

### 6. maxserviceperperiod
- **NL Label**: Max. dienst per periode
- **Status**: ✅ Functioneel

### 7. maxconsecutivework
- **NL Label**: Max. aaneengesloten werk
- **Status**: ✅ Functioneel

## Wijzigingen Per Bestand

### TypeScript Type Definitie
**Bestand**: `lib/types/planning-constraint.ts`
- ConstraintType enum: 12 → 7 types
- TYPE_LABELS mapping: 12 → 7 entries
- Commit: ae29b67

### SQL Migration
**Bestand**: `supabase/migrations/20241205_remove_5_constraint_types.sql`
- DELETE alle rijen met deze 5 types uit `roster_planning_constraint`
- DELETE alle rijen met deze 5 types uit `planning_constraint`
- UPDATE CHECK constraint voor `planning_constraint.type`
- UPDATE CHECK constraint voor `roster_planning_constraint.type`
- Commit: 67ab7d6

### UI Component - AddAdHocRuleForm
**Bestand**: `app/planning/design/dashboard/components/AddAdHocRuleForm.tsx`
- CONSTRAINT_TYPES array: 12 → 7 types
- Default type gewijzigd: `workloadmax` → `consecutiverest`
- Dropdown lijst toont nu alleen 7 functionele types
- Commit: 347a7e3

### Andere Components (geen wijzigingen nodig)
Deze components gebruiken TYPE_LABELS uit planning-constraint.ts:
- `app/services/planning-rules/components/RuleCard.tsx`
- `app/planning/design/dashboard/components/RosterRuleCard.tsx`
- `app/planning/design/dashboard/components/RosterPlanningRulesModal.tsx`
- `app/planning/design/dashboard/components/OverrideEditor.tsx`

Deze krijgen automatisch de juiste labels via de geüpdatete TYPE_LABELS.

## Uitvoering SQL Migration

### Handmatig uitvoeren in Supabase SQL Editor:

```sql
-- Kopieer de inhoud van supabase/migrations/20241205_remove_5_constraint_types.sql
-- en voer uit in Supabase SQL Editor
```

### Of via Supabase CLI (indien beschikbaar):

```bash
supabase db push
```

## Verificatie

Na deployment verifiëren:

1. **TypeScript compilatie**:
   ```bash
   npm run build
   ```
   ✅ Moet slagen zonder type errors

2. **Database constraints**:
   ```sql
   -- Test dat oude types niet meer toegestaan zijn
   INSERT INTO planning_constraint (naam, type, parameters, actief) 
   VALUES ('test', 'availability', '{}', true);
   -- Moet falen met CHECK constraint violation
   ```

3. **UI dropdown**:
   - Open rooster design dashboard
   - Klik "Ad-hoc regel toevoegen"
   - Verifieer dat dropdown ALLEEN 7 types toont

4. **Bestaande data**:
   ```sql
   -- Verifieer dat alle oude records verwijderd zijn
   SELECT COUNT(*) FROM planning_constraint 
   WHERE type IN ('availability', 'teamdagblokrules', 'fairnessbalance', 
                  'workloadmax', 'minserviceperperiod');
   -- Moet 0 zijn
   
   SELECT COUNT(*) FROM roster_planning_constraint 
   WHERE type IN ('availability', 'teamdagblokrules', 'fairnessbalance', 
                  'workloadmax', 'minserviceperperiod');
   -- Moet 0 zijn
   ```

## Git Commits

### Commit 1: TypeScript Types
```
ae29b67 - DRAAD 103 Stap 1: Verwijder 5 constraint types uit planning-constraint.ts
```

### Commit 2: SQL Migration
```
67ab7d6 - DRAAD 103 Stap 2: SQL migration - Verwijder 5 constraint types uit database
```

### Commit 3: UI Component
```
347a7e3 - DRAAD 103 Stap 3: Update AddAdHocRuleForm - verwijder 5 constraint types
```

### Commit 4: Documentatie
```
[huidige commit] - DRAAD 103 Stap 4: Documentatie - overzicht verwijderde planregels
```

## Impact Analyse

### ✅ Geen Breaking Changes voor Gebruikers
- De 5 types waren nooit functioneel
- Geen bestaande data gebruikt deze types (of wordt nu verwijderd)
- Gebruikers konden deze regels niet succesvol gebruiken

### ✅ Code Cleanup
- Type safety verbeterd (ongebruikte types verwijderd)
- UI dropdown korter en overzichtelijker
- Database constraints accuraat

### ✅ Toekomstige Ontwikkeling
- Nieuwe planregels kunnen toegevoegd worden volgens zelfde patroon:
  1. Voeg type toe aan ConstraintType enum
  2. Voeg label toe aan TYPE_LABELS
  3. Update database CHECK constraints
  4. Implementeer logica in solver

## Rollback Plan

Indien nodig kunnen types teruggedraaid worden:

1. **Revert TypeScript Types**:
   ```bash
   git revert ae29b67
   ```

2. **Revert Database via SQL**:
   ```sql
   -- Voeg types weer toe aan CHECK constraints
   ALTER TABLE planning_constraint DROP CONSTRAINT planning_constraint_type_check;
   ALTER TABLE planning_constraint ADD CONSTRAINT planning_constraint_type_check
   CHECK (type IN (
     'coverageminimum', 'availability', 'employeeservices', 'preassignments',
     'teamdagblokrules', 'workloadmax', 'consecutiverest', 'blocksnextday',
     'maxserviceperperiod', 'fairnessbalance', 'maxconsecutivework', 'minserviceperperiod'
   ));
   
   -- Idem voor roster_planning_constraint
   ```

3. **Revert UI Component**:
   ```bash
   git revert 347a7e3
   ```

## Status

- ✅ TypeScript types aangepast
- ✅ SQL migration gemaakt
- ✅ UI component aangepast
- ✅ Documentatie compleet
- ⏳ SQL migration uitvoeren in Supabase
- ⏳ Deployment naar Railway
- ⏳ Verificatie in productie

## Volgende Stappen

1. **SQL Migration uitvoeren**:
   - Open Supabase SQL Editor
   - Voer `20241205_remove_5_constraint_types.sql` uit
   - Verifieer met verificatie queries hierboven

2. **Deploy naar Railway**:
   - Railway detecteert automatisch nieuwe commits
   - Wacht op succesvolle build
   - Verifieer deployment logs

3. **Functionele Test**:
   - Login op productie applicatie
   - Open rooster design dashboard
   - Test ad-hoc regel toevoegen
   - Verifieer dropdown alleen 7 types toont

4. **Monitoring**:
   - Check error logs in Railway
   - Monitor Supabase query performance
   - Verifieer geen type errors in browser console

---

**Datum**: 2024-12-05  
**Draad**: DRAAD 103  
**Auteur**: AI Assistant met GitHub MCP tools  
**Review**: Govard Slooters
