-- DRAAD345: Create serviceblockingrules table
-- Missing table that was referenced in code but never created
-- This causes "Could not find the table public.serviceblockingrules" errors

CREATE TABLE IF NOT EXISTS public.serviceblockingrules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blockerserviceid UUID NOT NULL,
  blockedserviceid UUID NOT NULL,
  actief BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign keys to servicetypes
  CONSTRAINT fk_blockerservice FOREIGN KEY (blockerserviceid) 
    REFERENCES servicetypes(id) ON DELETE CASCADE,
  CONSTRAINT fk_blockedservice FOREIGN KEY (blockedserviceid) 
    REFERENCES servicetypes(id) ON DELETE CASCADE,
  
  -- Prevent self-blocking and duplicates
  CONSTRAINT no_self_blocking CHECK (blockerserviceid != blockedserviceid),
  CONSTRAINT unique_block_rule UNIQUE (blockerserviceid, blockedserviceid)
);

-- Create index for faster lookups
CREATE INDEX idx_serviceblockingrules_blocker 
  ON public.serviceblockingrules(blockerserviceid);

CREATE INDEX idx_serviceblockingrules_blocked 
  ON public.serviceblockingrules(blockedserviceid);

CREATE INDEX idx_serviceblockingrules_actief 
  ON public.serviceblockingrules(actief) 
  WHERE actief = TRUE;

-- Enable RLS for security
ALTER TABLE public.serviceblockingrules ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read active rules
CREATE POLICY "serviceblockingrules_read" 
  ON public.serviceblockingrules 
  FOR SELECT 
  TO authenticated 
  USING (TRUE);

-- Policy: Allow authenticated users to manage rules
CREATE POLICY "serviceblockingrules_write" 
  ON public.serviceblockingrules 
  FOR ALL 
  TO authenticated 
  USING (TRUE) 
  WITH CHECK (TRUE);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_serviceblockingrules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_serviceblockingrules_updated_at ON public.serviceblockingrules;

CREATE TRIGGER tr_serviceblockingrules_updated_at
  BEFORE UPDATE ON public.serviceblockingrules
  FOR EACH ROW
  EXECUTE FUNCTION update_serviceblockingrules_updated_at();

-- Log creation
COMMENT ON TABLE public.serviceblockingrules IS 'Service blocking rules: which services block which other services';
COMMENT ON COLUMN public.serviceblockingrules.blockerserviceid IS 'Service that is assigned - blocks others';
COMMENT ON COLUMN public.serviceblockingrules.blockedserviceid IS 'Service that cannot be assigned when blocker is active';
COMMENT ON COLUMN public.serviceblockingrules.actief IS 'Whether this blocking rule is active';
