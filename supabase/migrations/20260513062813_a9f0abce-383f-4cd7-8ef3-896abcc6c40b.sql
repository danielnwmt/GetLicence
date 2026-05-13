ALTER TYPE license_plan ADD VALUE IF NOT EXISTS 'semestral';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_semestral numeric NOT NULL DEFAULT 0;