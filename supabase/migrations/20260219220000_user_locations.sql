-- User location updates from Maps page (one row per callsign, updated every minute)
CREATE TABLE public.user_locations (
  id         UUID      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign   TEXT      NOT NULL,
  lat        NUMERIC(10, 7) NOT NULL,
  lng        NUMERIC(10, 7) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (callsign)
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_locations"
  ON public.user_locations
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_user_locations_callsign ON public.user_locations (callsign);
CREATE INDEX idx_user_locations_updated_at ON public.user_locations (updated_at);

CREATE TRIGGER update_user_locations_updated_at
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
