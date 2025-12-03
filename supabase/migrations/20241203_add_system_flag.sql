-- DRAAD99B: Systeemdiensten Bescherming
-- ============================================================================
-- Deze migratie voegt de is_system kolom toe aan service_types tabel
-- en implementeert database-niveau bescherming tegen verwijdering
-- ============================================================================

-- Stap 1: Voeg is_system kolom toe
-- Deze kolom markeert systeemdiensten die niet verwijderd mogen worden
ALTER TABLE service_types 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Stap 2: Markeer de 4 systeemdiensten
-- DIO, DDO, DIA, DDA zijn kritische systeemdiensten voor automatische blokkering
UPDATE service_types 
SET is_system = true 
WHERE code IN ('DIO', 'DDO', 'DIA', 'DDA');

-- Stap 3: Voeg database trigger toe (optioneel maar aanbevolen)
-- Dit voorkomt DELETE operaties op systeemdiensten op database niveau
-- Zelfs als frontend/backend checks falen, blijft data beschermd

CREATE OR REPLACE FUNCTION prevent_system_service_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system = true THEN
        RAISE EXCEPTION 'Systeemdiensten kunnen niet verwijderd worden: %', OLD.code;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Verwijder oude trigger als die bestaat
DROP TRIGGER IF EXISTS trg_prevent_system_delete ON service_types;

-- Maak nieuwe trigger aan
CREATE TRIGGER trg_prevent_system_delete
BEFORE DELETE ON service_types
FOR EACH ROW
EXECUTE FUNCTION prevent_system_service_delete();

-- Stap 4: Voeg constraint toe voor code wijziging bescherming
-- Dit voorkomt UPDATE van de code kolom voor systeemdiensten

CREATE OR REPLACE FUNCTION prevent_system_service_code_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system = true AND NEW.code != OLD.code THEN
        RAISE EXCEPTION 'Code van systeemdiensten kan niet gewijzigd worden: %', OLD.code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verwijder oude trigger als die bestaat
DROP TRIGGER IF EXISTS trg_prevent_system_code_change ON service_types;

-- Maak nieuwe trigger aan
CREATE TRIGGER trg_prevent_system_code_change
BEFORE UPDATE ON service_types
FOR EACH ROW
EXECUTE FUNCTION prevent_system_service_code_change();

-- Stap 5: Documentatie comments
COMMENT ON COLUMN service_types.is_system IS 
  'TRUE voor systeemdiensten (DIO, DDO, DIA, DDA) die niet verwijderd of aangepast mogen worden. '
  'Deze diensten worden gebruikt voor automatische dagblok blokkering.';

-- Stap 6: Verificatie query (voor handmatige check)
-- Uncomment onderstaande regels om te verifiëren:
-- SELECT code, naam, is_system FROM service_types WHERE is_system = true ORDER BY code;

-- ============================================================================
-- KLAAR VOOR GEBRUIK
-- ============================================================================
-- Na uitvoeren van deze migratie:
-- ✅ is_system kolom bestaat
-- ✅ DIO, DDO, DIA, DDA zijn gemarkeerd als systeemdienst
-- ✅ Database triggers beschermen tegen ongewenste wijzigingen
-- ✅ Frontend en backend kunnen is_system vlag gebruiken
-- ============================================================================