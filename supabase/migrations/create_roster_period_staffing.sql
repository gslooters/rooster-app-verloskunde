-- SQL Script voor Roster Period Staffing Tabel
-- Te uit te voeren via Supabase SQL Editor

-- Drop bestaande tabel indien aanwezig (voor clean start)
DROP TABLE IF EXISTS roster_period_staffing CASCADE;

-- Maak hoofdtabel aan
CREATE TABLE roster_period_staffing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id UUID NOT NULL,
  service_id TEXT NOT NULL,
  date DATE NOT NULL,
  min_staff INTEGER NOT NULL DEFAULT 0 CHECK (min_staff >= 0 AND min_staff <= 99),
  max_staff INTEGER NOT NULL DEFAULT 0 CHECK (max_staff >= 0 AND max_staff <= 99),
  team_tot BOOLEAN DEFAULT NULL,
  team_gro BOOLEAN DEFAULT NULL,
  team_ora BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: max moet >= min zijn
  CONSTRAINT valid_staff_range CHECK (max_staff >= min_staff),
  
  -- Unique constraint: één record per roster+service+date combinatie
  CONSTRAINT unique_roster_service_date UNIQUE (roster_id, service_id, date)
);

-- Indexen voor snelle queries
CREATE INDEX idx_roster_period_staffing_roster_id ON roster_period_staffing(roster_id);
CREATE INDEX idx_roster_period_staffing_service_id ON roster_period_staffing(service_id);
CREATE INDEX idx_roster_period_staffing_date ON roster_period_staffing(date);
CREATE INDEX idx_roster_period_staffing_roster_date ON roster_period_staffing(roster_id, date);
CREATE INDEX idx_roster_period_staffing_roster_service ON roster_period_staffing(roster_id, service_id);

-- Trigger functie voor automatische updated_at
CREATE OR REPLACE FUNCTION update_roster_period_staffing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger aanmaken
CREATE TRIGGER trigger_roster_period_staffing_updated_at
  BEFORE UPDATE ON roster_period_staffing
  FOR EACH ROW
  EXECUTE FUNCTION update_roster_period_staffing_updated_at();

-- RLS (Row Level Security) inschakelen
ALTER TABLE roster_period_staffing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Iedereen kan alles lezen (voor nu - later verfijnen)
CREATE POLICY "Enable read access for all users" 
  ON roster_period_staffing 
  FOR SELECT 
  USING (true);

-- RLS Policy: Iedereen kan records aanmaken (voor nu)
CREATE POLICY "Enable insert access for all users" 
  ON roster_period_staffing 
  FOR INSERT 
  WITH CHECK (true);

-- RLS Policy: Iedereen kan records updaten (voor nu)
CREATE POLICY "Enable update access for all users" 
  ON roster_period_staffing 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Iedereen kan records verwijderen (voor nu)
CREATE POLICY "Enable delete access for all users" 
  ON roster_period_staffing 
  FOR DELETE 
  USING (true);

-- Verificatie queries
-- SELECT COUNT(*) FROM roster_period_staffing;
-- SELECT * FROM roster_period_staffing LIMIT 10;

-- Commentaar toevoegen
COMMENT ON TABLE roster_period_staffing IS 'Periode-specifieke bezettingsregels per dienst per dag voor roosters';
COMMENT ON COLUMN roster_period_staffing.roster_id IS 'Verwijzing naar het rooster';
COMMENT ON COLUMN roster_period_staffing.service_id IS 'Verwijzing naar de dienst (service_types)';
COMMENT ON COLUMN roster_period_staffing.date IS 'Specifieke datum voor deze bezettingsregel';
COMMENT ON COLUMN roster_period_staffing.min_staff IS 'Minimum aantal medewerkers vereist (0-99)';
COMMENT ON COLUMN roster_period_staffing.max_staff IS 'Maximum aantal medewerkers toegestaan (0-99)';
COMMENT ON COLUMN roster_period_staffing.team_tot IS 'Team Totaal actief voor deze dienst';
COMMENT ON COLUMN roster_period_staffing.team_gro IS 'Team Groen actief voor deze dienst';
COMMENT ON COLUMN roster_period_staffing.team_ora IS 'Team Oranje actief voor deze dienst';
