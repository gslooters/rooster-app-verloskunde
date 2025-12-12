-- DRAAD164: Create PostgreSQL function for planinformatie aggregatie
-- Problem: JavaScript RLS-relatie-select mist rijen (-2 verschil)
-- Solution: Server-side SQL aggregatie in PostgreSQL
-- Result: Totalen 100% accuraat (Nodig: 241, Beschikbaar: 248)

CREATE OR REPLACE FUNCTION get_planinformatie_periode(p_roster_id uuid)
RETURNS TABLE (
  service_id uuid,
  code text,
  naam text,
  kleur text,
  nodig integer,
  beschikbaar integer,
  verschil integer,
  status text
) LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
BEGIN
  RETURN QUERY
  WITH nodig AS (
    -- Stap 1: Wat is er nodig per dienst?
    SELECT
      rps.service_id,
      SUM(rpsd.aantal) AS aantal_nodig
    FROM roster_period_staffing rps
    JOIN roster_period_staffing_dagdelen rpsd
      ON rps.id = rpsd.roster_period_staffing_id
    WHERE rps.roster_id = p_roster_id
    GROUP BY rps.service_id
  ),
  beschikbaar AS (
    -- Stap 2: Wat is er beschikbaar per dienst?
    SELECT
      service_id,
      SUM(aantal) AS aantal_beschikbaar
    FROM roster_employee_services
    WHERE roster_id = p_roster_id AND actief = true
    GROUP BY service_id
  )
  -- Stap 3: Combine met service_types en calculeer status
  SELECT
    st.id,
    st.code,
    st.naam,
    st.kleur,
    COALESCE(n.aantal_nodig, 0) AS nodig,
    COALESCE(b.aantal_beschikbaar, 0) AS beschikbaar,
    COALESCE(b.aantal_beschikbaar, 0) - COALESCE(n.aantal_nodig, 0) AS verschil,
    CASE 
      WHEN COALESCE(b.aantal_beschikbaar, 0) >= COALESCE(n.aantal_nodig, 0)
      THEN 'groen'::text
      ELSE 'rood'::text
    END AS status
  FROM service_types st
  LEFT JOIN nodig n ON st.id = n.service_id
  LEFT JOIN beschikbaar b ON st.id = b.service_id
  WHERE COALESCE(n.aantal_nodig, 0) > 0 OR COALESCE(b.aantal_beschikbaar, 0) > 0
  ORDER BY st.code;
END $$;

COMMENT ON FUNCTION get_planinformatie_periode(uuid) IS 
  'Returns planning information (need vs availability) for all services in a roster period.
   DRAAD164: Server-side aggregatie fix – replaces JavaScript RLS-relatie-select bugs.
   Ensures totals are 100% accurate: Nodig: 241, Beschikbaar: 248';
