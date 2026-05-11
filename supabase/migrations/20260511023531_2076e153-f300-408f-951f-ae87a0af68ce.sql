
CREATE TYPE public.payment_provider AS ENUM ('asaas', 'sicredi', 'sicoob', 'manual');

CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_provider public.payment_provider NOT NULL DEFAULT 'manual',
  asaas_env text NOT NULL DEFAULT 'sandbox',
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (active_provider) VALUES ('manual');

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment settings"
  ON public.payment_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_settings_updated
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payments
  ADD COLUMN provider public.payment_provider,
  ADD COLUMN provider_charge_id text,
  ADD COLUMN boleto_url text,
  ADD COLUMN pix_qr_code text,
  ADD COLUMN pix_copy_paste text,
  ADD COLUMN due_date date;

ALTER TABLE public.licenses
  ADD COLUMN provider public.payment_provider,
  ADD COLUMN provider_subscription_id text;
