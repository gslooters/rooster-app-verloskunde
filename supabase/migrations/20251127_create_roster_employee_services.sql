-- ============================================================================
-- DRAAD66: Roster Employee Services Tabel
-- ============================================================================
-- Doel: Periode-specifieke dienst configuraties per medewerker
-- Gebruik: Direct uitvoeren in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STAP 1: Tabel Aanmaken
-- ============================================================================

CREATE TABLE IF NOT EXISTS roster_employee_services (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  roster_id UUID NOT NULL 
    REFERENCES roosters(id) 
    ON DELETE CASCADE,
    
  employee_id TEXT NOT NULL 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
    
  service_id UUID NOT NULL 
    REFERENCES service_types(id) 
    ON DELETE RESTRICT,
  
  -- Data Velden
  aantal INTEGER NOT NULL DEFAULT 0
    CHECK (aantal >= 0),
    
  actief BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit Velden
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Business Constraint
  CONSTRAINT unique_roster_employee_service 
    UNIQUE (roster_id, employee_id, service_id)
);

-- ============================================================================
-- STAP 2: Indexes voor Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_roster_employee_services_roster 
  ON roster_employee_services(roster_id);

CREATE INDEX IF NOT EXISTS idx_roster_employee_services_employee 
  ON roster_employee_services(employee_id);

CREATE INDEX IF NOT EXISTS idx_roster_employee_services_service 
  ON roster_employee_services(service_id);

CREATE INDEX IF NOT EXISTS idx_roster_employee_services_roster_employee 
  ON roster_employee_services(roster_id, employee_id);

-- ============================================================================
-- STAP 3: Row Level Security (RLS)
-- ============================================================================

ALTER TABLE roster_employee_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roster_employee_services"
  ON roster_employee_services 
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert roster_employee_services"
  ON roster_employee_services 
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update roster_employee_services"
  ON roster_employee_services 
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete roster_employee_services"
  ON roster_employee_services 
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- STAP 4: Autofill Functie
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_roster_employee_services(p_roster_id UUID)
RETURNS TABLE(
  inserted_count INTEGER,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_employee_snapshot JSONB;
  v_employee JSONB;
  v_insert_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_original_employee_id TEXT;
  v_is_active BOOLEAN;
BEGIN
  -- Haal employee_snapshot op
  SELECT employee_snapshot INTO v_employee_snapshot
  FROM roster_design
  WHERE roster_id = p_roster_id;
  
  IF v_employee_snapshot IS NULL THEN
    RETURN QUERY SELECT 
      0::INTEGER,
      false::BOOLEAN,
      'Geen employee_snapshot gevonden voor roster_id: ' || p_roster_id::TEXT;
    RETURN;
  END IF;
  
  -- Loop door medewerkers in snapshot
  FOR v_employee IN SELECT * FROM jsonb_array_elements(v_employee_snapshot)
  LOOP
    v_original_employee_id := v_employee->>'originalEmployeeId';
    v_is_active := (v_employee->>'isSnapshotActive')::BOOLEAN;
    
    -- Alleen actieve medewerkers
    IF v_is_active = true THEN
      
      -- Kopieer ALLE employee_services voor deze medewerker
      WITH inserted_rows AS (
        INSERT INTO roster_employee_services (
          roster_id,
          employee_id,
          service_id,
          aantal,
          actief,
          created_at,
          updated_at
        )
        SELECT 
          p_roster_id,
          v_original_employee_id,
          es.service_id,
          es.aantal,
          es.actief,
          NOW(),
          NOW()
        FROM employee_services es
        WHERE es.employee_id = v_original_employee_id
        ON CONFLICT (roster_id, employee_id, service_id) 
          DO NOTHING
        RETURNING 1
      )
      SELECT COUNT(*)::INTEGER INTO v_insert_count FROM inserted_rows;
      
      v_total_count := v_total_count + v_insert_count;
      
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_total_count::INTEGER,
    true::BOOLEAN,
    'Succesvol ' || v_total_count::TEXT || ' records aangemaakt';
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      0::INTEGER,
      false::BOOLEAN,
      'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STAP 5: Helper Functie - Verwijder Roster Employee Services
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_roster_employee_services(p_roster_id UUID)
RETURNS TABLE(
  deleted_count INTEGER,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_delete_count INTEGER := 0;
BEGIN
  DELETE FROM roster_employee_services
  WHERE roster_id = p_roster_id;
  
  GET DIAGNOSTICS v_delete_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    v_delete_count::INTEGER,
    true::BOOLEAN,
    'Succesvol ' || v_delete_count::TEXT || ' records verwijderd';
    
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT 
      0::INTEGER,
      false::BOOLEAN,
      'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STAP 6: Comments
-- ============================================================================

COMMENT ON TABLE roster_employee_services IS 
  'Periode-specifieke dienst configuraties per medewerker';

COMMENT ON COLUMN roster_employee_services.aantal IS 
  'Gewenst aantal van deze dienst voor deze medewerker in deze periode';

COMMENT ON FUNCTION populate_roster_employee_services IS 
  'Automatisch vullen roster_employee_services vanuit employee_services';

-- ============================================================================
-- VERIFICATIE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'roster_employee_services'
  ) THEN
    RAISE NOTICE '✅ Tabel roster_employee_services succesvol aangemaakt';
  END IF;
END $$;
