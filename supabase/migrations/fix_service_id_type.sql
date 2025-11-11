-- FIX: Wijzig service_id kolom van UUID naar TEXT
-- Datum: 2025-11-11
-- Probleem: Database heeft service_id als UUID, maar moet TEXT zijn voor custom IDs zoals "st2", "nb"

-- STAP 1: Drop foreign key constraint als die bestaat
-- (waarschijnlijk niet, maar voor zekerheid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'roster_period_staffing_service_id_fkey'
        AND table_name = 'roster_period_staffing'
    ) THEN
        ALTER TABLE roster_period_staffing 
        DROP CONSTRAINT roster_period_staffing_service_id_fkey;
        RAISE NOTICE 'Foreign key constraint verwijderd';
    ELSE
        RAISE NOTICE 'Geen foreign key constraint gevonden (OK)';
    END IF;
END $$;

-- STAP 2: Wijzig kolom type van UUID naar TEXT
-- Let op: Bestaande UUID waarden worden automatisch gecast naar TEXT
ALTER TABLE roster_period_staffing 
ALTER COLUMN service_id TYPE TEXT USING service_id::TEXT;

RAISE NOTICE 'Kolom service_id succesvol gewijzigd naar TEXT type';

-- STAP 3: Verificatie
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'roster_period_staffing'
    AND column_name = 'service_id';
    
    RAISE NOTICE 'Service_id kolom type: %', col_type;
    
    IF col_type = 'text' THEN
        RAISE NOTICE '✅ SUCCES: service_id is nu TEXT type';
    ELSE
        RAISE WARNING '❌ FOUT: service_id is nog steeds: %', col_type;
    END IF;
END $$;

-- STAP 4: Toon sample data (optioneel, voor debugging)
-- SELECT service_id, COUNT(*) 
-- FROM roster_period_staffing 
-- GROUP BY service_id 
-- ORDER BY service_id;

-- Opmerking toevoegen
COMMENT ON COLUMN roster_period_staffing.service_id IS 'Custom service ID (TEXT) - bijv. "st2", "nb", "st3" etc. Geen UUID!';
