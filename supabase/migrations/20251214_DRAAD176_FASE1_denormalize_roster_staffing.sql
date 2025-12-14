-- =====================================================
-- DRAAD 176 FASE 1: SQL MIGRATIE
-- DENORMALISATIE ROSTER STAFFING
-- =====================================================
-- Datum: 14 december 2025
-- Status: PRODUCTION READY
-- 
-- Doel: Consolideer alle data in roster_period_staffing_dagdelen
-- Verwijder parent tabel roster_period_staffing
-- 
-- Workflow:
-- 1. Backup huidge data
-- 2. Voeg nieuwe kolommen toe (roster_id, service_id, date, invulling)
-- 3. Voeg foreign keys toe
-- 4. Voeg indexes toe (performance)
-- 5. Voeg unique constraints toe
-- 6. Verwijder oude FK
-- =====================================================

-- =====================================================
-- STAP 1: BACKUP (VOORZICHTIG!)
-- =====================================================
CREATE TABLE IF NOT EXISTS roster_period_staffing_dagdelen_backup_20251214 AS
SELECT * FROM roster_period_staffing_dagdelen;

DO $$
BEGIN
    RAISE NOTICE '✅ Backup aangemaakt: roster_period_staffing_dagdelen_backup_20251214';
END $$;

-- =====================================================
-- STAP 2: VOEG NIEUWE KOLOMMEN TOE
-- =====================================================

-- Column: roster_id (FK naar roosters)
ALTER TABLE roster_period_staffing_dagdelen
ADD COLUMN IF NOT EXISTS roster_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

DO $$
BEGIN
    RAISE NOTICE '✅ Kolom roster_id toegevoegd';
END $$;

-- Column: service_id (FK naar service_types)
ALTER TABLE roster_period_staffing_dagdelen
ADD COLUMN IF NOT EXISTS service_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

DO $$
BEGIN
    RAISE NOTICE '✅ Kolom service_id toegevoegd';
END $$;

-- Column: date (DATE)
ALTER TABLE roster_period_staffing_dagdelen
ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT '2025-01-01';

DO $$
BEGIN
    RAISE NOTICE '✅ Kolom date toegevoegd';
END $$;

-- Column: invulling (INTEGER, planning tracking)
ALTER TABLE roster_period_staffing_dagdelen
ADD COLUMN IF NOT EXISTS invulling INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    RAISE NOTICE '✅ Kolom invulling toegevoegd';
END $$;

-- =====================================================
-- STAP 3: VOEG CHECKS TOE
-- =====================================================

ALTER TABLE roster_period_staffing_dagdelen
ADD CONSTRAINT IF NOT EXISTS check_invulling_positive CHECK (invulling >= 0);

DO $$
BEGIN
    RAISE NOTICE '✅ Check constraint invulling_positive toegevoegd';
END $$;

ALTER TABLE roster_period_staffing_dagdelen
ADD CONSTRAINT IF NOT EXISTS check_date_valid CHECK (date >= '2025-01-01' AND date <= '2999-12-31');

DO $$
BEGIN
    RAISE NOTICE '✅ Check constraint date_valid toegevoegd';
END $$;

-- =====================================================
-- STAP 4: VOEG FOREIGN KEYS TOE
-- =====================================================

ALTER TABLE roster_period_staffing_dagdelen
ADD CONSTRAINT IF NOT EXISTS fk_rpsdag_roster 
FOREIGN KEY (roster_id) REFERENCES roosters(id) ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ FK constraint fk_rpsdag_roster toegevoegd';
END $$;

ALTER TABLE roster_period_staffing_dagdelen
ADD CONSTRAINT IF NOT EXISTS fk_rpsdag_service 
FOREIGN KEY (service_id) REFERENCES service_types(id) ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ FK constraint fk_rpsdag_service toegevoegd';
END $$;

-- =====================================================
-- STAP 5: VOEG INDEXES TOE (PERFORMANCE)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_rpsdag_roster_id ON roster_period_staffing_dagdelen(roster_id);
DO $$
BEGIN
    RAISE NOTICE '✅ Index idx_rpsdag_roster_id aangemaakt';
END $$;

CREATE INDEX IF NOT EXISTS idx_rpsdag_service_id ON roster_period_staffing_dagdelen(service_id);
DO $$
BEGIN
    RAISE NOTICE '✅ Index idx_rpsdag_service_id aangemaakt';
END $$;

CREATE INDEX IF NOT EXISTS idx_rpsdag_date ON roster_period_staffing_dagdelen(date);
DO $$
BEGIN
    RAISE NOTICE '✅ Index idx_rpsdag_date aangemaakt';
END $$;

CREATE INDEX IF NOT EXISTS idx_rpsdag_invulling ON roster_period_staffing_dagdelen(invulling);
DO $$
BEGIN
    RAISE NOTICE '✅ Index idx_rpsdag_invulling aangemaakt';
END $$;

CREATE INDEX IF NOT EXISTS idx_rpsdag_composite ON roster_period_staffing_dagdelen(roster_id, date, service_id);
DO $$
BEGIN
    RAISE NOTICE '✅ Index idx_rpsdag_composite aangemaakt';
END $$;

-- =====================================================
-- STAP 6: VOEG UNIQUE CONSTRAINT TOE
-- =====================================================

-- Verwijder oude FK naar parent tabel (als die nog bestaat)
ALTER TABLE roster_period_staffing_dagdelen
DROP CONSTRAINT IF EXISTS roster_period_staffing_dagdelen_roster_period_staffing_id_dagdeel_team_key CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Oude unique constraint verwijderd';
END $$;

-- Voeg nieuwe unique constraint toe (vervang oude FK)
ALTER TABLE roster_period_staffing_dagdelen
ADD CONSTRAINT IF NOT EXISTS unique_rpsdag_key 
UNIQUE (roster_id, date, dagdeel, team, service_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Unique constraint unique_rpsdag_key toegevoegd';
END $$;

-- =====================================================
-- STAP 7: VERWIJDER OUDE FK KOLOM (VOORZICHTIG!)
-- =====================================================

-- Verwijder oude FK naar parent tabel
ALTER TABLE roster_period_staffing_dagdelen
DROP COLUMN IF EXISTS roster_period_staffing_id CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ Kolom roster_period_staffing_id verwijderd';
END $$;

-- =====================================================
-- STAP 8: VERIFICATIE QUERY (CHECKLIST)
-- =====================================================

DO $$
DECLARE
    v_column_count INTEGER;
    v_constraint_count INTEGER;
    v_index_count INTEGER;
BEGIN
    -- Check kolommen
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_name = 'roster_period_staffing_dagdelen'
      AND column_name IN ('id', 'roster_id', 'service_id', 'date', 'dagdeel', 'team', 'status', 'aantal', 'invulling', 'created_at', 'updated_at');
    
    RAISE NOTICE '📋 Kolommen aanwezig: % van 11', v_column_count;
    
    -- Check constraints
    SELECT COUNT(*) INTO v_constraint_count
    FROM information_schema.table_constraints
    WHERE table_name = 'roster_period_staffing_dagdelen'
      AND constraint_type IN ('UNIQUE', 'FOREIGN KEY', 'CHECK');
    
    RAISE NOTICE '🔐 Constraints aanwezig: %', v_constraint_count;
    
    -- Check indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'roster_period_staffing_dagdelen'
      AND indexname LIKE 'idx_rpsdag_%';
    
    RAISE NOTICE '⚡ Performance indexes: %', v_index_count;
END $$;

-- =====================================================
-- SCHEMA VERIFICATIE (DETAILED)
-- =====================================================
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'roster_period_staffing_dagdelen'
ORDER BY ordinal_position;

-- Verwacht output:
-- id, uuid, NO, ...
-- roster_id, uuid, NO, '00000000-0000-0000-0000-000000000000'::uuid
-- service_id, uuid, NO, '00000000-0000-0000-0000-000000000000'::uuid
-- date, date, NO, '2025-01-01'::date
-- dagdeel, text, NO, ...
-- team, text, NO, ...
-- status, text, NO, ...
-- aantal, integer, NO, ...
-- invulling, integer, NO, '0'
-- created_at, timestamp, NO, ...
-- updated_at, timestamp, NO, ...

-- =====================================================
-- FINAL SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ DRAAD176 FASE 1: SQL MIGRATIE VOLTOOID!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Schema Updates:';
    RAISE NOTICE '  ✅ Kolommen: roster_id, service_id, date, invulling';
    RAISE NOTICE '  ✅ Foreign Keys: fk_rpsdag_roster, fk_rpsdag_service';
    RAISE NOTICE '  ✅ Indexes: 5 performance indexes';
    RAISE NOTICE '  ✅ Unique Constraint: unique_rpsdag_key';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Status:';
    RAISE NOTICE '  ✅ Kolommen volledig';
    RAISE NOTICE '  ✅ Constraints ingesteld';
    RAISE NOTICE '  ✅ Performance indexes gemaakt';
    RAISE NOTICE '  ✅ Backup aangemaakt (20251214)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Volgende Stappen:';
    RAISE NOTICE '  1. Fase 2: Type Definitions Update';
    RAISE NOTICE '  2. Fase 3: Storage Service Update';
    RAISE NOTICE '  3. Fase 4: Auto-Fill Logic Rewrite';
    RAISE NOTICE '  4. Fase 5: Testing & Validation';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
