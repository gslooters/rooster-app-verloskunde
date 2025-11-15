-- =====================================================
-- DRAAD31 - FASE 1: Database Migratie
-- Restructure employee_services tabel
-- =====================================================
-- 
-- DOEL: 
-- 1. Gebruik UUID foreign keys naar diensten en medewerkers
-- 2. Voeg 'aantal' kolom toe voor capaciteit per dienst
-- 3. Voeg 'actief' kolom toe voor in/uitschakelen
-- 4. Voeg 'laatst_gewijzigd' toe voor audit trail
--
-- LET OP: dienstwaarde bestaat al in diensten tabel!
-- =====================================================

-- Stap 1: Backup van oude data (voor zekerheid)
CREATE TABLE IF NOT EXISTS employee_services_backup AS 
SELECT * FROM employee_services;

-- Stap 2: Drop oude tabel
DROP TABLE IF EXISTS employee_services CASCADE;

-- Stap 3: Maak nieuwe tabel met correcte structuur
CREATE TABLE employee_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys naar diensten (UUID) en medewerkers (UUID)
  dienst_id UUID NOT NULL REFERENCES diensten(id) ON DELETE CASCADE,
  medewerker_id UUID NOT NULL REFERENCES medewerkers(id) ON DELETE CASCADE,
  
  -- Capaciteit: aantal keer dat deze medewerker deze dienst kan doen
  aantal INTEGER NOT NULL DEFAULT 1 CHECK (aantal >= 0),
  
  -- Actief: is deze toewijzing actief?
  actief BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  aangemaakt_op TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  laatst_gewijzigd TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unieke constraint: één record per medewerker-dienst combinatie
  UNIQUE(medewerker_id, dienst_id)
);

-- Stap 4: Indexes voor performance
CREATE INDEX idx_employee_services_medewerker ON employee_services(medewerker_id);
CREATE INDEX idx_employee_services_dienst ON employee_services(dienst_id);
CREATE INDEX idx_employee_services_actief ON employee_services(actief);

-- Stap 5: Trigger voor automatisch updaten van laatst_gewijzigd
CREATE OR REPLACE FUNCTION update_employee_services_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.laatst_gewijzigd = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_services_timestamp
BEFORE UPDATE ON employee_services
FOR EACH ROW
EXECUTE FUNCTION update_employee_services_timestamp();

-- Stap 6: RLS (Row Level Security) policies
ALTER TABLE employee_services ENABLE ROW LEVEL SECURITY;

-- Iedereen kan lezen (voor rooster planning)
CREATE POLICY "Enable read access for all users" 
  ON employee_services FOR SELECT 
  USING (true);

-- Alleen authenticated users kunnen wijzigen
CREATE POLICY "Enable insert for authenticated users" 
  ON employee_services FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
  ON employee_services FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
  ON employee_services FOR DELETE 
  USING (auth.role() = 'authenticated');

-- Stap 7: Commentaar voor documentatie
COMMENT ON TABLE employee_services IS 'Koppeltabel: welke medewerker kan welke dienst doen, met capaciteit';
COMMENT ON COLUMN employee_services.dienst_id IS 'Referentie naar diensten tabel (UUID)';
COMMENT ON COLUMN employee_services.medewerker_id IS 'Referentie naar medewerkers tabel (UUID)';
COMMENT ON COLUMN employee_services.aantal IS 'Hoeveel keer deze medewerker deze dienst kan/wil doen in roosterperiode';
COMMENT ON COLUMN employee_services.actief IS 'Is deze dienst-toewijzing actief? (voor in/uitschakelen zonder verwijderen)';
COMMENT ON COLUMN employee_services.laatst_gewijzigd IS 'Tijdstip van laatste wijziging (automatisch bijgewerkt)';

-- =====================================================
-- EINDE MIGRATIE
-- =====================================================
-- 
-- VERIFICATIE:
-- SELECT * FROM employee_services;
-- SELECT COUNT(*) FROM employee_services;
--
-- ROLLBACK (indien nodig):
-- DROP TABLE employee_services;
-- ALTER TABLE employee_services_backup RENAME TO employee_services;
-- =====================================================