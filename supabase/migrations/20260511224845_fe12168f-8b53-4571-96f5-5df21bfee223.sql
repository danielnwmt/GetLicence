ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vps_specs text DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_unit text NOT NULL DEFAULT 'GB';