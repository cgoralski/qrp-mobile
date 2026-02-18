
-- Standalone contacts table (user-created, fully independent)
CREATE TABLE public.contacts (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign        TEXT    NOT NULL DEFAULT '',
  name            TEXT    NOT NULL DEFAULT '',
  frequency       NUMERIC(12, 6) NOT NULL,
  freq_offset     NUMERIC(12, 6)  DEFAULT 0,
  duplex          TEXT    DEFAULT '',
  tone_mode       TEXT    DEFAULT '',
  r_tone_freq     NUMERIC DEFAULT 88.5,
  c_tone_freq     NUMERIC DEFAULT 88.5,
  dtcs_code       TEXT    DEFAULT '023',
  mode            TEXT    DEFAULT 'FM',
  country         TEXT    DEFAULT '',
  region          TEXT    DEFAULT '',
  location_desc   TEXT    DEFAULT '',
  comment         TEXT    DEFAULT '',
  group_tag       TEXT    DEFAULT 'LOCAL',
  source_repeater_id UUID DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contacts"
  ON public.contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_contacts_callsign ON public.contacts (callsign);
CREATE INDEX idx_contacts_frequency ON public.contacts (frequency);
CREATE INDEX idx_contacts_group_tag ON public.contacts (group_tag);

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
