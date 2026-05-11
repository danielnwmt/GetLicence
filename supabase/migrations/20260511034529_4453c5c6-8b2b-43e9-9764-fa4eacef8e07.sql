
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS asaas_api_key text,
  ADD COLUMN IF NOT EXISTS sicredi_client_id text,
  ADD COLUMN IF NOT EXISTS sicredi_client_secret text,
  ADD COLUMN IF NOT EXISTS sicredi_cert_pem text,
  ADD COLUMN IF NOT EXISTS sicredi_cert_key text,
  ADD COLUMN IF NOT EXISTS sicoob_client_id text,
  ADD COLUMN IF NOT EXISTS sicoob_access_token text,
  ADD COLUMN IF NOT EXISTS sicoob_cert_pem text,
  ADD COLUMN IF NOT EXISTS sicoob_cert_key text;
