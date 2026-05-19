ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS block_schedule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_start_time text,
  ADD COLUMN IF NOT EXISTS block_end_time text;