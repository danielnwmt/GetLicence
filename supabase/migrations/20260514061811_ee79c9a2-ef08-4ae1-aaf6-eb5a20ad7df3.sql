ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS coplan_url text,
  ADD COLUMN IF NOT EXISTS coplan_username text,
  ADD COLUMN IF NOT EXISTS coplan_password text,
  ADD COLUMN IF NOT EXISTS coplan_token text;