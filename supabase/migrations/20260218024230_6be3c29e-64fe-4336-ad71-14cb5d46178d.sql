
-- Create repeaters table matching CHIRP CSV format
CREATE TABLE public.repeaters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_index INTEGER,
  name TEXT NOT NULL,
  frequency NUMERIC(10, 6) NOT NULL,
  duplex TEXT DEFAULT '',
  freq_offset NUMERIC(10, 6) DEFAULT 0,
  tone_mode TEXT DEFAULT '',
  r_tone_freq NUMERIC(6, 1) DEFAULT 88.5,
  c_tone_freq NUMERIC(6, 1) DEFAULT 88.5,
  dtcs_code TEXT DEFAULT '023',
  dtcs_polarity TEXT DEFAULT 'NN',
  rx_dtcs_code TEXT DEFAULT '023',
  cross_mode TEXT DEFAULT 'Tone->Tone',
  mode TEXT DEFAULT 'FM',
  t_step NUMERIC(5, 2) DEFAULT 5.00,
  skip TEXT DEFAULT '',
  power TEXT DEFAULT '50W',
  comment TEXT DEFAULT '',
  callsign TEXT,
  location_desc TEXT,
  country TEXT NOT NULL DEFAULT 'Unknown',
  region TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.repeaters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on repeaters"
  ON public.repeaters
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_repeaters_frequency ON public.repeaters (frequency);
CREATE INDEX idx_repeaters_country ON public.repeaters (country);
CREATE INDEX idx_repeaters_callsign ON public.repeaters (callsign);
CREATE INDEX idx_repeaters_mode ON public.repeaters (mode);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_repeaters_updated_at
  BEFORE UPDATE ON public.repeaters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
