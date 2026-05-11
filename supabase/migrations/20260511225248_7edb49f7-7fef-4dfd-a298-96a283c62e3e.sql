ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vps_storage_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vps_storage_unit text NOT NULL DEFAULT 'GB';