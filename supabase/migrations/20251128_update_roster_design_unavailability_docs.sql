-- Documentatie update voor roster_design.unavailability_data
-- Geen schema wijziging - JSONB accepteert nieuwe structuur automatisch
-- 
-- OUDE STRUCTUUR (deprecated):
-- { "emp1": { "2025-11-24": true, "2025-11-25": false } }
-- 
-- NIEUWE STRUCTUUR (dagdeel-ondersteuning):
-- { 
--   "emp1": { 
--     "2025-11-24": { "O": true, "M": false, "A": true },
--     "2025-11-25": { "O": false, "M": true, "A": false }
--   } 
-- }
-- 
-- Waarbij:
-- - O = Ochtend (09:00-13:00)
-- - M = Middag (13:00-18:00)
-- - A = Avond/Nacht (18:00-09:00)
-- - true = Niet Beschikbaar
-- - false of afwezig = Beschikbaar
-- 
-- Backward compatibility: boolean waarde wordt geïnterpreteerd als hele dag

COMMENT ON COLUMN roster_design.unavailability_data IS 
'Niet-beschikbaarheid per medewerker, datum en dagdeel. 
Format: { [employeeId]: { [date]: { O?: boolean, M?: boolean, A?: boolean } } }
Waarbij O=Ochtend, M=Middag, A=Avond/Nacht. 
Legacy boolean waarden worden geïnterpreteerd als hele dag NB.';
