ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_storage_gb numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_vps_monthly numeric NOT NULL DEFAULT 0;