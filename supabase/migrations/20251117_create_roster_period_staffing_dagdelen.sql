-- ============================================================================
-- DRAAD36A: Roster Period Staffing Dagdelen
-- Datum: 2025-11-17
-- ============================================================================
-- Nieuwe tabel voor dagdeel-specifieke bezettingsregels per team
-- Status: MOET, MAG, MAG_NIET, AANGEPAST
-- Aantal: 0-9 (aantal medewerkers vereist)
-- ============================================================================

-- Drop bestaande tabel indien aanwezig (voor herinstallatie)
DROP TABLE IF EXISTS roster_period_staffing_dagdelen CASCADE;

-- Maak hoofdtabel aan
CREATE TABLE roster_period_staffing_dagdelen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key naar parent record (roster_period_staffing)
  roster_period_staffing_id UUID NOT NULL 
    REFERENCES roster_period_staffing(id) ON DELETE CASCADE,
  
  -- Dagdeel identificatie
  dagdeel TEXT NOT NULL CHECK (dagdeel IN ('O', 'M', 'A')),
  
  -- Team identificatie
  team TEXT NOT NULL CHECK (team IN ('TOT', 'GRO', 'ORA')),
  
  -- Bezettingsregels
  status TEXT NOT NULL 
    CHECK (status IN ('MOET', 'MAG', 'MAG_NIET', 'AANGEPAST'))
    DEFAULT 'MAG',
  
  aantal INTEGER NOT NULL 
    CHECK (aantal >= 0 AND aantal <= 9)
    DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unieke constraint: één regel per combinatie
  CONSTRAINT unique_staffing_dagdeel 
    UNIQUE (roster_period_staffing_id, dagdeel, team)
);

-- ============================================================================
-- INDEXEN voor snelle queries
-- ============================================================================

CREATE INDEX idx_rps_dagdelen_parent_id 
  ON roster_period_staffing_dagdelen(roster_period_staffing_id);

CREATE INDEX idx_rps_dagdelen_dagdeel 
  ON roster_period_staffing_dagdelen(dagdeel);

CREATE INDEX idx_rps_dagdelen_team 
  ON roster_period_staffing_dagdelen(team);

CREATE INDEX idx_rps_dagdelen_status 
  ON roster_period_staffing_dagdelen(status);

-- Composite index voor veel voorkomende query (per team + dagdeel)
CREATE INDEX idx_rps_dagdelen_team_dagdeel 
  ON roster_period_staffing_dagdelen(team, dagdeel);

-- ============================================================================
-- TRIGGER voor automatische updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_rps_dagdelen_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rps_dagdelen_updated_at
  BEFORE UPDATE ON roster_period_staffing_dagdelen
  FOR EACH ROW
  EXECUTE FUNCTION update_rps_dagdelen_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE roster_period_staffing_dagdelen ENABLE ROW LEVEL SECURITY;

-- Iedereen kan lezen
CREATE POLICY "Enable read access for all users" 
  ON roster_period_staffing_dagdelen 
  FOR SELECT 
  USING (true);

-- Iedereen kan aanmaken
CREATE POLICY "Enable insert access for all users" 
  ON roster_period_staffing_dagdelen 
  FOR INSERT 
  WITH CHECK (true);

-- Iedereen kan updaten
CREATE POLICY "Enable update access for all users" 
  ON roster_period_staffing_dagdelen 
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Iedereen kan verwijderen
CREATE POLICY "Enable delete access for all users" 
  ON roster_period_staffing_dagdelen 
  FOR DELETE 
  USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE roster_period_staffing_dagdelen IS 
  'DRAAD36A: Dagdeel-specifieke bezettingsregels per team voor roosters';

COMMENT ON COLUMN roster_period_staffing_dagdelen.roster_period_staffing_id IS 
  'Verwijzing naar parent record in roster_period_staffing';

COMMENT ON COLUMN roster_period_staffing_dagdelen.dagdeel IS 
  'Dagdeel code: O=Ochtend, M=Middag, A=Avond';

COMMENT ON COLUMN roster_period_staffing_dagdelen.team IS 
  'Team code: TOT=Totaal, GRO=Groen, ORA=Oranje';

COMMENT ON COLUMN roster_period_staffing_dagdelen.status IS 
  'Status: MOET=verplicht, MAG=optioneel, MAG_NIET=verboden, AANGEPAST=handmatig gewijzigd';

COMMENT ON COLUMN roster_period_staffing_dagdelen.aantal IS 
  'Aantal medewerkers vereist (0-9)';

-- ============================================================================
-- VERIFICATIE QUERIES (voor testen)
-- ============================================================================

-- Verifieer tabel aangemaakt
-- SELECT COUNT(*) FROM roster_period_staffing_dagdelen;

-- Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'roster_period_staffing_dagdelen';

-- Check constraints
-- SELECT conname, contype, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint
-- WHERE conrelid = 'roster_period_staffing_dagdelen'::regclass;
