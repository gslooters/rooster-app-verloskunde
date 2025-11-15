-- Migration: Fix RLS policies voor employee_services tabel
-- Datum: 15 november 2025
-- Probleem: 42501 error - "new row violates row-level security policy"
-- Oplossing: Voeg INSERT/UPDATE policies toe

-- Drop bestaande restrictieve policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.employee_services;

-- Maak nieuwe policies voor alle operaties
CREATE POLICY "Enable read access for all users" 
ON public.employee_services 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert access for all users" 
ON public.employee_services 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update access for all users" 
ON public.employee_services 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" 
ON public.employee_services 
FOR DELETE 
USING (true);

-- Verifieer RLS is enabled
ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

-- Commentaar voor documentatie
COMMENT ON TABLE public.employee_services IS 
'Koppeltabel tussen medewerkers en diensten met actief toggle en aantal per periode. RLS policies staan alle operaties toe voor applicatie-gebruikers.';
