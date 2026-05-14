ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS gdrive_service_account_json text,
  ADD COLUMN IF NOT EXISTS gdrive_folder_id text,
  ADD COLUMN IF NOT EXISTS backup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_retention_days integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS backup_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS backup_last_status text,
  ADD COLUMN IF NOT EXISTS backup_last_file_id text;