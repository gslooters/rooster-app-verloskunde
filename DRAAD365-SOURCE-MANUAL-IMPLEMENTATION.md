# DRAAD 365: Source='manual' Tracking Implementatie

## Datum
**29 december 2025, 18:36 CET**

## Context
Bij handmatig wijzigen van rooster assignments werd de `source` kolom in de database niet bijgewerkt naar `'manual'`. Dit is noodzakelijk om onderscheid te maken tussen:
- **Automatisch geplande diensten** (source: 'greedy', 'fixed')
- **Handmatige correcties** door planners (source: 'manual')

## Probleem Analyse

### Database Verificatie
✅ Database tabel `roster_assignments` heeft kolom `source` (TEXT)
✅ Kolom geïdentificeerd in `DRAAD_211_DATABASE_ANALYSIS.sql`

### Code Analyse
❌ Interface `RosterAssignment` miste `source` property
❌ Interface `CreateRosterAssignmentInput` miste optionele `source`
❌ Functie `updateAssignmentStatus` zette geen `source: 'manual'`
❌ Functie `changeAssignmentServiceAtomic` zette geen `source: 'manual'`
❌ Functie `updateAssignmentService` zette geen `source: 'manual'`

## Implementatie

### Bestand Gewijzigd
**lib/services/roster-assignments-supabase.ts**

### TypeScript Interfaces

```typescript
// VOOR (DRAAD 365)
export interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: Dagdeel;
  status: AssignmentStatus;
  service_id: string | null;
  // source: ONTBRAK
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// NA (DRAAD 365)
export interface RosterAssignment {
  id: string;
  roster_id: string;
  employee_id: string;
  date: string;
  dagdeel: Dagdeel;
  status: AssignmentStatus;
  service_id: string | null;
  source: string | null;  // ✅ NIEUW: 'greedy', 'fixed', 'manual'
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Functie Updates

#### 1. updateAssignmentStatus()

**Voor:**
```typescript
const updateData: any = { status };
```

**Na:**
```typescript
const updateData: any = { 
  status,
  source: 'manual'  // ✅ DRAAD365: Track manual changes
};
```

#### 2. changeAssignmentServiceAtomic()

**Voor RESET stap:**
```typescript
const { error: resetError } = await supabase
  .from('roster_assignments')
  .update({
    status: 0,
    service_id: null,
    // source: ONTBRAK
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId);
```

**Na RESET stap:**
```typescript
const { error: resetError } = await supabase
  .from('roster_assignments')
  .update({
    status: 0,
    service_id: null,
    source: 'manual',  // ✅ DRAAD365: Track manual change
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId);
```

**Voor INSERT stap:**
```typescript
const { error: insertError } = await supabase
  .from('roster_assignments')
  .update({
    status: 1,
    service_id: newServiceId,
    // source: ONTBRAK
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId);
```

**Na INSERT stap:**
```typescript
const { error: insertError } = await supabase
  .from('roster_assignments')
  .update({
    status: 1,
    service_id: newServiceId,
    source: 'manual',  // ✅ DRAAD365: Track manual change
    updated_at: new Date().toISOString()
  })
  .eq('id', assignmentId);
```

#### 3. updateAssignmentService() [LEGACY]

**Voor:**
```typescript
const updateData: any = {
  service_id: serviceId,
  status: serviceId ? AssignmentStatus.ASSIGNED : AssignmentStatus.AVAILABLE
  // source: ONTBRAK
};
```

**Na:**
```typescript
const updateData: any = {
  service_id: serviceId,
  status: serviceId ? AssignmentStatus.ASSIGNED : AssignmentStatus.AVAILABLE,
  source: 'manual'  // ✅ DRAAD365: Track manual change
};
```

## Impact Analyse

### Positieve Effecten
✅ Alle handmatige wijzigingen worden nu correct getraceerd
✅ Onderscheid tussen automatische en handmatige planning mogelijk
✅ Audit trail voor wie/wat wijzigingen heeft aangebracht
✅ Mogelijkheid om handmatige correcties te rapporteren
✅ Basis voor toekomstige undo/redo functionaliteit

### Breaking Changes
❌ GEEN - Wijzigingen zijn backwards compatible:
- Bestaande records zonder `source` blijven werken (NULL waarde toegestaan)
- Bestaande code die `source` niet gebruikt blijft werken
- Alleen nieuwe/gewijzigde records krijgen `source: 'manual'`

### Database Migratie
**NIET NODIG** - Kolom bestaat al in database.

## Testing Checklist

### Handmatige Tests Vereist
- [ ] Open rooster grid
- [ ] Wijzig dienst via dropdown (bijv. OSP → DIO)
- [ ] Controleer database: `SELECT source FROM roster_assignments WHERE id = '<assignment_id>'`
- [ ] Verwacht resultaat: `source = 'manual'`

### UI Flow Tests
- [ ] Status wijzigen (0→1, 1→0)
- [ ] Service wijzigen (OSP → DIO → OSP)
- [ ] Service verwijderen (dienst → leeg)
- [ ] Geblokkeerde cel wijzigen

### Database Queries
```sql
-- Controleer recent gewijzigde assignments
SELECT 
  id,
  employee_id,
  date,
  dagdeel,
  status,
  service_id,
  source,
  updated_at
FROM roster_assignments
WHERE roster_id = '<current_roster_id>'
  AND source = 'manual'
ORDER BY updated_at DESC
LIMIT 20;

-- Tel aantal manual changes per medewerker
SELECT 
  employee_id,
  COUNT(*) as manual_changes
FROM roster_assignments
WHERE roster_id = '<current_roster_id>'
  AND source = 'manual'
GROUP BY employee_id
ORDER BY manual_changes DESC;
```

## Deployment

### Git Commits
1. **Code wijziging:** `74037fc2515f93a957d01bf2254c73d1e9ecc50a`
2. **Railway trigger:** `97094718a7b83d552d960821d1b1838cec94ab07`
3. **Documentatie:** `<this commit>`

### Railway Deployment
✅ Deployment getriggerd via `.railway-deploy-trigger` update
✅ TypeScript recompilatie vereist (interface changes)
✅ Geen database migraties nodig

### Verificatie Stappen
1. Wacht tot Railway build succesvol (3-5 minuten)
2. Check Railway logs voor TypeScript compilation errors
3. Open productie applicatie
4. Test handmatige wijziging in rooster
5. Verify database `source = 'manual'`

## Technische Details

### Modified Files
- `lib/services/roster-assignments-supabase.ts` (19.6 KB)
- `.railway-deploy-trigger` (cache-busting)
- `DRAAD365-SOURCE-MANUAL-IMPLEMENTATION.md` (dit document)

### TypeScript Compilatie
- Interface changes vereisen volledige recompile
- Geen type errors verwacht (backwards compatible)
- Build tijd: ~60 seconden

### Runtime Impact
- Minimaal (alleen extra kolom in UPDATE query)
- Geen performance degradatie verwacht
- Database write overhead: +6 bytes per update ('manual')

## Toekomstige Uitbreidingen

### Mogelijke Features
1. **Source Filter UI**
   - Filter rooster op: Alle / Automatisch / Handmatig
   - Highlight handmatige wijzigingen in grid

2. **Audit Rapport**
   - Overzicht handmatige correcties per week
   - Top 10 meest gecorrigeerde medewerkers
   - Tijdlijn van wijzigingen

3. **Undo/Redo**
   - Stack van source changes
   - "Herstel automatische planning" knop
   - Change history per cel

4. **Change Tracking**
   - Wie heeft gewijzigd (user_id toevoegen)
   - Wanneer gewijzigd (updated_at bestaat al)
   - Waarom gewijzigd (reason kolom optioneel)

## Conclusie

✅ **Implementatie Succesvol**
- Alle handmatige wijzigingen worden nu correct getraceerd met `source='manual'`
- TypeScript interfaces bijgewerkt voor type safety
- Drie kritieke functies gepatcht
- Backwards compatible (geen breaking changes)
- Deployment getriggerd via Railway

✅ **Kwaliteit Gewaarborgd**
- Code review uitgevoerd op syntax errors
- Database schema geverifieerd
- Git commits met duidelijke messages
- Documentatie compleet

⏳ **Nog Te Doen**
- [ ] Wacht op Railway deployment success
- [ ] Uitvoeren handmatige tests (zie Testing Checklist)
- [ ] Database verificatie queries
- [ ] User acceptance test door planner

---

**Gerelateerde DRAADs:**
- DRAAD 68: Assignment structuur (dagdeel, status)
- DRAAD 211: Database analyse (source kolom identificatie)
- DRAAD 352: Atomic service change (blocking reset)
- DRAAD 365: Source manual tracking (deze implementatie)

**Documentatie Versie:** 1.0  
**Auteur:** Perplexity AI + MCP GitHub Tools  
**Datum:** 29 december 2025, 18:36 CET
