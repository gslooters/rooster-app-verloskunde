-- DRAAD 103 Stap 2 (GECORRIGEERD): Verwijder 5 planregels uit database
-- Datum: 2024-12-05
-- Beschrijving: Verwijder constraint types die nooit functioneel zijn geweest
--
-- SITUATIE: Alleen planning_constraints tabel heeft 8 records
--            Alle andere tabellen (roster_*) zijn leeg
--
-- Te verwijderen types:
-- 1. availability (Beschikbaarheid)
-- 2. teamdagblokrules (Team dagblok regels)
-- 3. fairnessbalance (Eerlijke verdeling)
-- 4. workloadmax (Max. werkdagen)
-- 5. minserviceperperiod (Min. dienst team)
--
-- Overblijvende types (7 stuks):
-- 1. coverageminimum (Minimale bezetting)
-- 2. employeeservices (Bevoegdheden)
-- 3. preassignments (Pre-planning)
-- 4. consecutiverest (Rustdag na nachtdienst)
-- 5. blocksnextday (Blokkeert volgdag)
-- 6. maxserviceperperiod (Max. dienst per periode)
-- 7. maxconsecutivework (Max. aaneengesloten werk)

BEGIN;

-- Stap 1: Verwijder records uit planning_constraints tabel
DELETE FROM planning_constraints
WHERE type IN (
  'availability',
  'teamdagblokrules',
  'fairnessbalance',
  'workloadmax',
  'minserviceperperiod'
);

-- Stap 2: Update type constraint (CHECK) voor planning_constraints tabel
ALTER TABLE planning_constraints
DROP CONSTRAINT IF EXISTS planning_constraints_type_check;

ALTER TABLE planning_constraints
ADD CONSTRAINT planning_constraints_type_check
CHECK (type IN (
  'coverageminimum',
  'employeeservices',
  'preassignments',
  'consecutiverest',
  'blocksnextday',
  'maxserviceperperiod',
  'maxconsecutivework'
));

-- Stap 3: Update type constraint (CHECK) voor roster_planning_constraints tabel
-- (Ook updaten voor toekomstig gebruik, ook al is tabel nu leeg)
ALTER TABLE roster_planning_constraints
DROP CONSTRAINT IF EXISTS roster_planning_constraints_type_check;

ALTER TABLE roster_planning_constraints
ADD CONSTRAINT roster_planning_constraints_type_check
CHECK (type IN (
  'coverageminimum',
  'employeeservices',
  'preassignments',
  'consecutiverest',
  'blocksnextday',
  'maxserviceperperiod',
  'maxconsecutivework'
));

-- Log wijzigingen
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Tel hoeveel records verwijderd zijn
  SELECT COUNT(*) INTO deleted_count
  FROM planning_constraints
  WHERE type IN (
    'availability',
    'teamdagblokrules',
    'fairnessbalance',
    'workloadmax',
    'minserviceperperiod'
  );
  
  RAISE NOTICE 'DRAAD 103: 5 constraint types verwijderd';
  RAISE NOTICE 'Verwijderde records uit planning_constraints: %', deleted_count;
  RAISE NOTICE 'Type CHECK constraints aangepast voor beide tabellen';
  RAISE NOTICE 'Overgebleven types: 7 (was 12)';
END $$;

COMMIT;

-- Verificatie query (voer NA de migration uit):
-- SELECT type, COUNT(*) as aantal 
-- FROM planning_constraints 
-- GROUP BY type 
-- ORDER BY type;
-- Verwacht: Alleen 7 types, totaal max 8 records
