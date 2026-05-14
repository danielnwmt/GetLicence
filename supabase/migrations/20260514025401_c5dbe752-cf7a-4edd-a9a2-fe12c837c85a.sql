ALTER TABLE public.products ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'license';
ALTER TABLE public.products DROP COLUMN IF EXISTS price_storage_gb;
ALTER TABLE public.products DROP COLUMN IF EXISTS price_vps_monthly;