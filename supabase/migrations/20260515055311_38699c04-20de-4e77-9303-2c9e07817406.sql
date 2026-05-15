ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS device_ip_v4 text,
  ADD COLUMN IF NOT EXISTS device_ip_v6 text;