-- Schema completo Axis Licenças (Postgres 14+)
-- Equivalente ao schema da versão Lovable Cloud, sem RLS (single-tenant local).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ====== Tipos ======
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_plan AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('asaas', 'sicredi', 'sicoob', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====== Usuários (substitui auth.users do Supabase) ======
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name            text,
  email                text,
  cpf_cnpj             text,
  phone                text,
  address_zip          text,
  address_street       text,
  address_number       text,
  address_complement   text,
  address_neighborhood text,
  address_city         text,
  address_state        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  description         text,
  price_monthly       numeric NOT NULL DEFAULT 0,
  price_yearly        numeric NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  cost_vps            numeric NOT NULL DEFAULT 0,
  cost_storage        numeric NOT NULL DEFAULT 0,
  cost_other          numeric NOT NULL DEFAULT 0,
  profit_margin       numeric NOT NULL DEFAULT 0,
  vps_specs           text DEFAULT '',
  storage_amount      numeric NOT NULL DEFAULT 0,
  storage_unit        text NOT NULL DEFAULT 'GB',
  vps_storage_amount  numeric NOT NULL DEFAULT 0,
  vps_storage_unit    text NOT NULL DEFAULT 'GB',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id               uuid NOT NULL REFERENCES products(id),
  license_key              text NOT NULL DEFAULT (
    upper(
      substring(encode(gen_random_bytes(4), 'hex') from 1 for 4) || '-' ||
      substring(encode(gen_random_bytes(4), 'hex') from 1 for 4) || '-' ||
      substring(encode(gen_random_bytes(4), 'hex') from 1 for 4) || '-' ||
      substring(encode(gen_random_bytes(4), 'hex') from 1 for 4)
    )
  ),
  plan                     license_plan NOT NULL DEFAULT 'monthly',
  status                   license_status NOT NULL DEFAULT 'pending',
  starts_at                timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz NOT NULL,
  auto_renew               boolean NOT NULL DEFAULT true,
  notes                    text,
  provider                 payment_provider,
  provider_subscription_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licenses_user_idx ON licenses(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_id         uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  amount             numeric NOT NULL,
  method             text,
  status             payment_status NOT NULL DEFAULT 'pending',
  paid_at            timestamptz,
  reference          text,
  notes              text,
  provider           payment_provider,
  provider_charge_id text,
  boleto_url         text,
  pix_qr_code        text,
  pix_copy_paste     text,
  due_date           date,
  barcode            text,
  invoice_url        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_license_idx ON payments(license_id);

CREATE TABLE IF NOT EXISTS payment_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_provider       payment_provider NOT NULL DEFAULT 'manual',
  asaas_env             text NOT NULL DEFAULT 'sandbox',
  webhook_token         text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  notes                 text,
  asaas_api_key         text,
  sicredi_client_id     text,
  sicredi_client_secret text,
  sicredi_cert_pem      text,
  sicredi_cert_key      text,
  sicoob_client_id      text,
  sicoob_access_token   text,
  sicoob_cert_pem       text,
  sicoob_cert_key       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Linha única default
INSERT INTO payment_settings (active_provider)
SELECT 'manual'
WHERE NOT EXISTS (SELECT 1 FROM payment_settings);

-- Trigger genérico de updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','profiles','products','licenses','payments','payment_settings']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated ON %I; ' ||
      'CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I ' ||
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;
