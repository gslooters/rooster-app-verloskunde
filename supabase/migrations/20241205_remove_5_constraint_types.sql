-- DRAAD 103 Stap 2: Verwijder 5 planregels uit database
-- Datum: 2024-12-05
-- Beschrijving: Verwijder constraint types die nooit functioneel zijn geweest
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

-- Stap 1: Verwijder alle constraints met deze types uit roster_planning_constraint
DELETE FROM roster_planning_constraint
WHERE type IN (
  'availability',
  'teamdagblokrules',
  'fairnessbalance',
  'workloadmax',
  'minserviceperperiod'
);

-- Stap 2: Verwijder alle base constraints met deze types uit planning_constraint
DELETE FROM planning_constraint
WHERE type IN (
  'availability',
  'teamdagblokrules',
  'fairnessbalance',
  'workloadmax',
  'minserviceperperiod'
);

-- Stap 3: Update type constraint (CHECK) voor planning_constraint tabel
ALTER TABLE planning_constraint
DROP CONSTRAINT IF EXISTS planning_constraint_type_check;

ALTER TABLE planning_constraint
ADD CONSTRAINT planning_constraint_type_check
CHECK (type IN (
  'coverageminimum',
  'employeeservices',
  'preassignments',
  'consecutiverest',
  'blocksnextday',
  'maxserviceperperiod',
  'maxconsecutivework'
));

-- Stap 4: Update type constraint (CHECK) voor roster_planning_constraint tabel
ALTER TABLE roster_planning_constraint
DROP CONSTRAINT IF EXISTS roster_planning_constraint_type_check;

ALTER TABLE roster_planning_constraint
ADD CONSTRAINT roster_planning_constraint_type_check
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
  pc_deleted INTEGER;
  rpc_deleted INTEGER;
BEGIN
  -- Tel verwijderde rijen
  GET DIAGNOSTICS pc_deleted = ROW_COUNT;
  
  RAISE NOTICE 'DRAAD 103: 5 constraint types verwijderd';
  RAISE NOTICE 'Constraints verwijderd uit planning_constraint en roster_planning_constraint';
  RAISE NOTICE 'Type CHECK constraints aangepast voor beide tabellen';
  RAISE NOTICE 'Overgebleven types: 7 (was 12)';
END $$;

COMMIT;
