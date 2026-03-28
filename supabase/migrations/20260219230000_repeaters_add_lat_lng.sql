-- Add lat/lng to repeaters for map display
ALTER TABLE public.repeaters
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7);
